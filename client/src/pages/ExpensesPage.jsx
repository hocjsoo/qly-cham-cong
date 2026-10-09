import ImageLightbox from "../components/ImageLightbox";
// src/pages/ExpensesPage.jsx
// Quản lý Bảng Tổng Hợp Chi Tiêu & Hoàn Ứng Cty — Chuẩn theo mẫu Google Sheets

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus, Search, Download, Check, X, CreditCard,
  Trash2, Camera, LayoutList, LayoutGrid, Table2,
  FileSpreadsheet
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import useAuthStore from '../stores/authStore';
import HeaderActions from '../components/HeaderActions';
import useLatestRequest from '../hooks/useLatestRequest';
import { downloadBlob } from '../utils/downloadBlob';
import { sanitizeCsvCell } from '../utils/exportCsv';
import ReimbursementMatrixTable from '../components/expenses/ReimbursementMatrixTable';
import AdvanceFundSummaryCard from '../components/expenses/AdvanceFundSummaryCard';
import FundDepositModal from '../components/expenses/FundDepositModal';
import FundHistoryModal from '../components/expenses/FundHistoryModal';

const formatVND = (amount) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);
};

const formatDate = (isoDate) => {
  if (!isoDate) return '—';
  const parts = isoDate.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return isoDate;
};

const EMPTY_SUMMARY = {
  totalApprovedAmount: 0, totalPendingAmount: 0, totalPendingCount: 0,
  totalUnpaidAmount: 0, totalPaidAmount: 0, myTotalApproved: 0, myTotalUnpaid: 0,
};
const EMPTY_EXPENSES = [];

export default function ExpensesPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  const [expenseResult, setExpenseResult] = useState(null);
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;
  const [search, setSearch] = useState('');
  const [filterUser, setFilterUser] = useState('all');
  const [filterApproval, setFilterApproval] = useState('all');
  const [filterPayment, setFilterPayment] = useState('all');
  const [filterVat, setFilterVat] = useState('all');
  const [filterMonth, setFilterMonth] = useState('all');
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString());
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'grid' | 'matrix'
  const [matrixScopeFilter, setMatrixScopeFilter] = useState('unpaid'); // 'unpaid' | 'all' | 'paid'
  const matrixHideZeros = true;
  const sessionKey = `${user?._id || user?.id || ''}:${user?.role || ''}`;
  const expenseKey = JSON.stringify([sessionKey, currentPage, filterUser, filterApproval, filterPayment, filterVat, filterMonth, filterYear, search.trim()]);
  const currentResult = expenseResult?.key === expenseKey ? expenseResult : null;
  const expenses = currentResult?.expenses || EMPTY_EXPENSES;
  const summary = currentResult?.summary || EMPTY_SUMMARY;
  const { beginRequest: beginExpenseRequest, cancelRequest: cancelExpenseRequest } = useLatestRequest(expenseKey);
  const { beginRequest: beginStaffRequest } = useLatestRequest(sessionKey);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(null); // expense object
  const [rejectionReason, setRejectionReason] = useState('');
  const [fullBillImage, setFullBillImage] = useState(null);
  const [viewingStaffDetail, setViewingStaffDetail] = useState(null);

  // Form State
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
  const [formDate, setFormDate] = useState(todayStr);
  const [formDesc, setFormDesc] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formVat, setFormVat] = useState(false);
  const [formReceipt, setFormReceipt] = useState(null);
  const [formNotes, setFormNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  // Fund State
  const [fundsData, setFundsData] = useState(null);
  const [showFundDepositModal, setShowFundDepositModal] = useState(false);
  const [showFundHistoryModal, setShowFundHistoryModal] = useState(false);

  const loadFunds = useCallback(async () => {
    try {
      const { data } = await api.get('/funds');
      setFundsData(data);
    } catch {}
  }, []);

  const loadData = useCallback(async () => {
    const request = beginExpenseRequest();
    if (!request) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', String(currentPage));
      params.append('limit', String(pageSize));
      if (filterUser !== 'all') params.append('user_id', filterUser);
      if (filterApproval !== 'all') params.append('approval_status', filterApproval);
      if (filterPayment !== 'all') params.append('payment_status', filterPayment);
      if (filterVat !== 'all') params.append('has_vat', filterVat);
      if (filterMonth !== 'all') params.append('month', filterMonth);
      if (filterYear !== 'all') params.append('year', filterYear);
      if (search.trim()) params.append('search', search.trim());

      const { data } = await api.get(`/expenses?${params.toString()}`, { signal: request.signal });
      if (!request.isCurrent()) return;
      const fetchedExpenses = data.expenses || [];
      const fetchedSummary = data.summary || {};
      setExpenseResult({ key: expenseKey, expenses: fetchedExpenses, summary: fetchedSummary });

      if (fetchedSummary.totalPages && currentPage > fetchedSummary.totalPages) {
        setCurrentPage(Math.max(1, fetchedSummary.totalPages));
      } else if (fetchedExpenses.length === 0 && currentPage > 1) {
        setCurrentPage(1);
      }
      loadFunds();
    } catch {
      if (request.isCurrent()) toast.error('Lỗi tải danh sách chi tiêu');
    } finally {
      if (request.isCurrent()) setLoading(false);
    }
  }, [currentPage, filterUser, filterApproval, filterPayment, filterVat, filterMonth, filterYear, search, expenseKey, beginExpenseRequest, loadFunds]);

  const loadStaffList = useCallback(async () => {
    const request = beginStaffRequest();
    if (!request) return;
    try {
      const { data } = await api.get('/users', { signal: request.signal });
      if (request.isCurrent() && Array.isArray(data)) setStaffList(data);
    } catch {}
  }, [beginStaffRequest]);

  useEffect(() => {
    setLoading(true);
    const delay = search.trim() ? 300 : 0;
    const timer = window.setTimeout(loadData, delay);
    return () => {
      window.clearTimeout(timer);
      cancelExpenseRequest();
    };
  }, [loadData, search, cancelExpenseRequest]);

  useEffect(() => {
    loadStaffList();
    loadFunds();
  }, [loadStaffList, loadFunds]);

  const handleImageCapture = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Vui lòng chọn tệp hình ảnh hợp lệ');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 800; // Nén ảnh bill vừa phải để nhẹ đường truyền
        let w = img.width, h = img.height;
        if (w > h) { if (w > maxDim) { h = Math.round((h * maxDim) / w); w = maxDim; } }
        else { if (h > maxDim) { w = Math.round((w * maxDim) / h); h = maxDim; } }
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        setFormReceipt(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleCreateExpense = async (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    if (!formDesc.trim()) {
      toast.error('Vui lòng nhập mô tả khoản chi');
      return;
    }
    const cleanAmount = Number(String(formAmount).replace(/\D/g, ''));
    if (!cleanAmount || cleanAmount <= 0) {
      toast.error('Số tiền chi tiêu phải lớn hơn 0 VNĐ');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/expenses', {
        date: formDate,
        description: formDesc.trim(),
        amount: cleanAmount,
        has_vat_invoice: formVat,
        receipt_url: formReceipt,
        notes: formNotes.trim() || null,
      });

      toast.success('Báo cáo khoản chi tiêu thành công! 🎉');
      setShowCreateModal(false);
      setFormDesc('');
      setFormAmount('');
      setFormVat(false);
      setFormReceipt(null);
      setFormNotes('');
      setCurrentPage(1);
      loadData();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Lỗi gửi báo cáo chi tiêu');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (expenseId, status = 'approved', rejection_reason = '') => {
    try {
      await api.put(`/expenses/${expenseId}/approve`, {
        status,
        rejection_reason: rejection_reason.trim() || undefined,
      });
      toast.success(status === 'approved' ? 'Đã duyệt khoản chi ✅' : 'Đã từ chối khoản chi ❌');
      setShowRejectModal(null);
      setRejectionReason('');
      loadData();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Lỗi cập nhật trạng thái chi tiêu');
    }
  };

  const handleMarkPaid = async (expenseId, currentStatus) => {
    const nextStatus = currentStatus === 'paid' ? 'unpaid' : 'paid';
    try {
      await api.put(`/expenses/${expenseId}/pay`, { payment_status: nextStatus });
      toast.success(nextStatus === 'paid' ? 'Đã hoàn ứng thành công 💵' : 'Đã chuyển về chưa trả');
      loadData();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Lỗi cập nhật hoàn ứng');
    }
  };

  const handleToggleVat = async (expenseId) => {
    try {
      await api.put(`/expenses/${expenseId}/vat`);
      toast.success('Đã cập nhật trạng thái VAT');
      loadData();
    } catch {
      toast.error('Lỗi cập nhật VAT');
    }
  };

  const handleDelete = async (expenseId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa khoản chi này?')) return;
    try {
      await api.delete(`/expenses/${expenseId}`);
      toast.success('Đã xóa khoản chi thành công');
      if (expenses.length === 1 && currentPage > 1) {
        setCurrentPage(p => Math.max(1, p - 1));
      } else {
        loadData();
      }
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Lỗi xóa chi tiêu');
    }
  };

  const handleExportCSV = async () => {
    const toastId = toast.loading('Đang chuẩn bị dữ liệu xuất CSV...');
    try {
      const params = new URLSearchParams();
      params.append('export', 'true');
      if (filterUser !== 'all') params.append('user_id', filterUser);
      if (filterApproval !== 'all') params.append('approval_status', filterApproval);
      if (filterPayment !== 'all') params.append('payment_status', filterPayment);
      if (filterVat !== 'all') params.append('has_vat', filterVat);
      if (filterMonth !== 'all') params.append('month', filterMonth);
      if (filterYear !== 'all') params.append('year', filterYear);
      if (search.trim()) params.append('search', search.trim());

      const { data } = await api.get(`/expenses?${params.toString()}`);
      const fullList = data.expenses || [];
      if (fullList.length === 0) {
        toast.dismiss(toastId);
        toast.error('Không có dữ liệu để xuất file');
        return;
      }

      const headers = [
        'STT',
        'Ngày giao dịch',
        'Mô tả khoản chi',
        'Người chi',
        'Số tiền (VNĐ)',
        'Trạng thái duyệt',
        'Trạng thái hoàn tiền',
        'Hóa đơn VAT',
        'Ngân hàng',
        'Số tài khoản nhận tiền',
        'Chi nhánh',
        'Ghi chú'
      ];

      let totalAmount = 0;
      const rows = fullList.map((expItem, idx) => {
        totalAmount += Number(expItem.amount) || 0;
        const spenderUser = staffList.find(s => String(s._id || s.id) === String(expItem.user_id?._id || expItem.user_id)) || {};
        const spenderName = expItem.user_id?.full_name || expItem.user_name || spenderUser.full_name || '—';
        const approvalVi = expItem.approval_status === 'approved' ? 'Đã duyệt' : expItem.approval_status === 'rejected' ? 'Từ chối' : 'Chờ duyệt';
        const paymentVi = expItem.payment_status === 'paid' ? 'Đã trả' : 'Chưa trả';
        const vatVi = expItem.has_vat_invoice ? 'Có VAT' : 'Không VAT';
        const rawStk = spenderUser.bank_account ? String(spenderUser.bank_account).trim() : '';

        return [
          idx + 1,
          sanitizeCsvCell(formatDate(expItem.date)),
          sanitizeCsvCell(expItem.description),
          sanitizeCsvCell(spenderName),
          expItem.amount,
          sanitizeCsvCell(approvalVi),
          sanitizeCsvCell(paymentVi),
          sanitizeCsvCell(vatVi),
          sanitizeCsvCell(spenderUser.bank_name),
          // Định dạng ="STK" để Excel nhận diện chuẩn Text, tuyệt đối không bị biến thành số mũ 1,251E+13
          rawStk ? `="${rawStk}"` : '—',
          sanitizeCsvCell(spenderUser.branch),
          sanitizeCsvCell(expItem.notes)
        ];
      });

      const totalRow = [
        'TỔNG CỘNG',
        '""',
        sanitizeCsvCell(`Tổng ${fullList.length} khoản chi`),
        '""',
        totalAmount,
        '""',
        '""',
        '""',
        '""',
        '""',
        '""',
        '""'
      ];

      const BOM = '\uFEFF';
      const csvContent = BOM + [
        headers.map(sanitizeCsvCell).join(','),
        ...rows.map(r => r.join(',')),
        totalRow.join(',')
      ].join('\r\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      downloadBlob(blob, `DS_Chi_Tieu_ET_${new Date().toISOString().slice(0, 10)}.csv`);
      toast.dismiss(toastId);
      toast.success('Đã tải xuống file CSV (STK chuẩn Text) thành công!');
    } catch {
      toast.dismiss(toastId);
      toast.error('Lỗi khi xuất file CSV');
    }
  };

  const handleExportExcel = async () => {
    const toastId = toast.loading('Đang chuẩn bị file Excel XLSX chuẩn kế toán...');
    try {
      const params = new URLSearchParams();
      if (filterUser !== 'all') params.append('user_id', filterUser);
      if (filterApproval !== 'all') params.append('approval_status', filterApproval);
      if (filterPayment !== 'all') params.append('payment_status', filterPayment);
      if (filterVat !== 'all') params.append('has_vat', filterVat);
      if (filterMonth !== 'all') params.append('month', filterMonth);
      if (filterYear !== 'all') params.append('year', filterYear);
      if (search.trim()) params.append('search', search.trim());

      const res = await api.get(`/export/expenses?${params.toString()}`, { responseType: 'blob' });
      downloadBlob(res.data, `Bang_Ke_Chi_Tieu_ET_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.dismiss(toastId);
      toast.success('Đã tải xuống file Excel XLSX chuyên nghiệp! 📊');
    } catch {
      toast.dismiss(toastId);
      toast.error('Lỗi khi xuất file Excel');
    }
  };

  // Filter list by search locally if needed
  const filteredExpenses = expenses.filter(exp => {
    if (!search.trim()) return true;
    const q = search.toLowerCase().trim();
    const desc = (exp.description || '').toLowerCase();
    const user = (exp.user_id?.full_name || '').toLowerCase();
    const amount = String(exp.amount || '');
    return desc.includes(q) || user.includes(q) || amount.includes(q);
  });

  const resolveExpenseStaff = exp => {
    const populatedUser = exp?.user_id && typeof exp.user_id === 'object' ? exp.user_id : {};
    const expenseUserId = String(populatedUser._id || exp?.user_id || '');
    const matchedStaff = staffList.find(staff => String(staff._id || staff.id) === expenseUserId);

    return {
      ...populatedUser,
      ...(matchedStaff || {}),
      _id: matchedStaff?._id || populatedUser._id || exp?.user_id,
      full_name: matchedStaff?.full_name || populatedUser.full_name || exp?.user_name || 'Nhân viên',
    };
  };

  // Tên rút gọn độc nhất chuẩn bảng tính (Minh, Ninh, Q.Anh, M.Anh...)
  const shortNameMap = useMemo(() => {
    const list = staffList && staffList.length > 0 ? staffList : [];
    const counts = {};
    list.forEach(u => {
      const parts = (u.full_name || '').trim().split(/\s+/);
      const last = parts[parts.length - 1] || 'NV';
      counts[last] = (counts[last] || 0) + 1;
    });
    const map = new Map();
    list.forEach(u => {
      const id = String(u._id || u.id || '');
      const parts = (u.full_name || '').trim().split(/\s+/);
      const last = parts[parts.length - 1] || 'NV';
      if (counts[last] > 1 && parts.length > 1) {
        const mid = parts[parts.length - 2];
        map.set(id, `${mid.charAt(0)}.${last}`);
      } else {
        map.set(id, last);
      }
    });
    return map;
  }, [staffList]);

  // Cột nhân sự trong Ma trận Hoàn ứng
  const allMatrixUsers = useMemo(() => {
    const userMap = new Map();
    (staffList || []).forEach(u => {
      const id = String(u._id || u.id || '');
      if (id && u.employment_status !== 'resigned' && u.employment_status !== 'Đã nghỉ việc') {
        const name = u.full_name || 'Nhân viên';
        userMap.set(id, {
          id,
          full_name: name,
          short_name: shortNameMap.get(id) || name.split(' ').pop(),
          avatar_url: u.avatar_url,
          employee_code: u.employee_code,
          department_name: u.department_name,
          bank_name: u.bank_name || null,
          bank_account: u.bank_account || null,
          branch: u.branch || null,
        });
      }
    });
    expenses.forEach(exp => {
      const id = String(exp.user_id?._id || exp.user_id || '');
      if (id && !userMap.has(id)) {
        const name = exp.user_id?.full_name || exp.user_name || 'Nhân viên';
        userMap.set(id, {
          id,
          full_name: name,
          short_name: shortNameMap.get(id) || name.split(' ').pop(),
          avatar_url: exp.user_id?.avatar_url,
          employee_code: exp.user_id?.employee_code,
          department_name: exp.user_id?.department_name,
          bank_name: exp.user_id?.bank_name || null,
          bank_account: exp.user_id?.bank_account || null,
          branch: exp.user_id?.branch || null,
        });
      }
    });
    return Array.from(userMap.values());
  }, [staffList, expenses, shortNameMap]);

  // Dữ liệu Ma trận Hoàn ứng (Pivot Matrix)
  const matrixData = useMemo(() => {
    const rawList = filteredExpenses.filter(exp => {
      if (matrixScopeFilter === 'unpaid') return exp.payment_status !== 'paid' && exp.approval_status !== 'rejected';
      if (matrixScopeFilter === 'paid') return exp.payment_status === 'paid';
      return true;
    });

    const groupMap = new Map();
    rawList.forEach(exp => {
      const desc = (exp.description || '').trim();
      const date = exp.date || '';
      // Gom nhóm: nếu cùng mô tả "CHI TIÊU CTY" thì gom chung 1 dòng lớn như ảnh mẫu Google Sheets
      const isGeneralCompanyExpense = desc.toLowerCase() === 'chi tiêu cty';
      const groupKey = isGeneralCompanyExpense ? 'chi tiêu cty' : `${date}__${desc}`;
      if (!groupMap.has(groupKey)) {
        groupMap.set(groupKey, {
          key: groupKey,
          title: isGeneralCompanyExpense ? 'CHI TIÊU CTY' : (desc || (date ? formatDate(date) : 'Khoản chi')),
          date: isGeneralCompanyExpense ? null : date,
          userAmounts: {},
          total: 0,
          items: [],
        });
      }
      const g = groupMap.get(groupKey);
      const uid = String(exp.user_id?._id || exp.user_id || '');
      g.userAmounts[uid] = (g.userAmounts[uid] || 0) + (exp.amount || 0);
      g.total += (exp.amount || 0);
      g.items.push(exp);
    });

    const rows = Array.from(groupMap.values()).sort((a, b) => {
      if (a.title === 'CHI TIÊU CTY') return -1;
      if (b.title === 'CHI TIÊU CTY') return 1;
      return (b.date || '').localeCompare(a.date || '');
    });

    const userTotals = new Map();
    let grandTotal = 0;
    allMatrixUsers.forEach(u => {
      const sum = rows.reduce((acc, r) => acc + (r.userAmounts[u.id] || 0), 0);
      userTotals.set(u.id, sum);
      grandTotal += sum;
    });

    const displayUsers = matrixHideZeros
      ? allMatrixUsers.filter(u => (userTotals.get(u.id) || 0) > 0)
      : allMatrixUsers;

    return {
      rows,
      displayUsers,
      userTotals,
      grandTotal,
    };
  }, [filteredExpenses, matrixScopeFilter, allMatrixUsers, matrixHideZeros]);

  const handleExportMatrixCSV = () => {
    const { rows, displayUsers, userTotals, grandTotal } = matrixData;
    if (!displayUsers.length || !rows.length) {
      toast.error('Không có dữ liệu ma trận để xuất file');
      return;
    }

    const headers = [
      'KHOẢN CHI / NGÀY',
      ...displayUsers.map(u => `${u.short_name} (${formatVND(userTotals.get(u.id) || 0)})`),
      `TỔNG CỘNG (${formatVND(grandTotal)})`
    ];

    const topSummaryRow = [
      'TỔNG',
      ...displayUsers.map(u => userTotals.get(u.id) || 0),
      grandTotal
    ];

    const dataRows = rows.map(r => [
      sanitizeCsvCell(r.title + (r.date ? ` (${formatDate(r.date)})` : '')),
      ...displayUsers.map(u => r.userAmounts[u.id] || 0),
      r.total
    ]);

    const BOM = '\uFEFF';
    const csvContent = BOM + [
      headers.map(sanitizeCsvCell).join(','),
      topSummaryRow.map(v => typeof v === 'number' ? v : sanitizeCsvCell(v)).join(','),
      ...dataRows.map(row => row.map(v => typeof v === 'number' ? v : sanitizeCsvCell(v)).join(','))
    ].join('\r\n');

    downloadBlob(
      new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }),
      `bang-ma-tran-hoan-ung-${matrixScopeFilter}-${filterMonth !== 'all' ? `thang-${filterMonth}-` : ''}${filterYear}.csv`
    );
    toast.success('Đã tải xuống bảng ma trận hoàn ứng CSV');
  };

  return (
    <div className="page">
      {/* Header */}
      <div className="header">
        <div className="header__inner header__inner--wide">
          <div>
            <div className="header__title">Bảng Tổng Hợp Chi Tiêu & Hoàn Ứng</div>
            <div className="header__subtitle">Theo dõi & thanh toán các khoản chi hộ công ty</div>
          </div>
          <div className="page-header-actions" style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn btn--primary"
              style={{ padding: '7px 12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              <Plus size={15} /> Báo Cáo Chi Tiêu
            </button>
            <button
              onClick={handleExportExcel}
              className="btn btn--ghost"
              style={{ padding: '7px 11px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--green)', borderColor: 'var(--green)' }}
              title="Xuất file Excel XLSX chuẩn kế toán (2 Sheet, format số và STK chống lỗi)"
            >
              <FileSpreadsheet size={15} /> Xuất Excel
            </button>
            <button
              onClick={handleExportCSV}
              className="btn btn--ghost"
              style={{ padding: '7px 10px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '5px' }}
              title="Xuất file CSV nộp kế toán (mở được bằng Excel)"
            >
              <Download size={15} /> Xuất CSV
            </button>
            <HeaderActions />
          </div>
        </div>
      </div>

      <div className="container container--wide" style={{ paddingTop: '16px' }}>
        {/* Advance Fund & Cashflow Summary Card (Hợp nhất 1 hàng duy nhất) */}
        <AdvanceFundSummaryCard
          fundStats={fundsData?.stats}
          summary={summary}
          onOpenDepositModal={() => setShowFundDepositModal(true)}
          onOpenHistoryModal={() => setShowFundHistoryModal(true)}
          onFilterPending={() => {
            setFilterApproval(filterApproval === 'pending' ? 'all' : 'pending');
            setCurrentPage(1);
          }}
          onFilterPaid={() => {
            setFilterPayment(filterPayment === 'paid' ? 'all' : 'paid');
            setCurrentPage(1);
          }}
          onFilterUnpaid={() => {
            setFilterPayment(filterPayment === 'unpaid' ? 'all' : 'unpaid');
            setCurrentPage(1);
          }}
          currentPaymentFilter={filterPayment}
          currentApprovalFilter={filterApproval}
          formatVND={formatVND}
          isAdmin={isAdmin}
          isFundHolder={isAdmin || Boolean(fundsData?.funds?.some(f => String(f.holder_id?._id || f.holder_id) === String(user?._id)))}
        />

        {/* Filter Controls Toolbar */}
        <div className="card" style={{ padding: '12px 14px', marginBottom: '14px' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Search Input */}
            <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: '32px', fontSize: '13px', height: '34px' }}
                placeholder="Tìm nội dung, người chi, số tiền..."
                value={search}
                onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
              />
            </div>

            {/* Filter Spender */}
            <select
              className="form-select"
              style={{ width: 'auto', minWidth: '140px', fontSize: '12.5px', padding: '6px 10px', height: '34px' }}
              value={filterUser}
              onChange={e => { setFilterUser(e.target.value); setCurrentPage(1); }}
            >
              <option value="all">👤 Người chi: Tất cả</option>
              {staffList.map(s => (
                <option key={s._id || s.id} value={s._id || s.id}>{s.full_name}</option>
              ))}
            </select>

            {/* Filter Approval Status */}
            <select
              className="form-select"
              style={{ width: 'auto', fontSize: '12.5px', padding: '6px 10px', height: '34px' }}
              value={filterApproval}
              onChange={e => { setFilterApproval(e.target.value); setCurrentPage(1); }}
            >
              <option value="all">📋 Duyệt: Tất cả</option>
              <option value="pending">⏳ Chờ duyệt</option>
              <option value="approved">✅ Đã duyệt</option>
              <option value="rejected">❌ Từ chối</option>
            </select>

            {/* Filter Payment Status */}
            <select
              className="form-select"
              style={{ width: 'auto', fontSize: '12.5px', padding: '6px 10px', height: '34px' }}
              value={filterPayment}
              onChange={e => { setFilterPayment(e.target.value); setCurrentPage(1); }}
            >
              <option value="all">💳 Hoàn tiền: Tất cả</option>
              <option value="unpaid">💸 Chưa trả</option>
              <option value="paid">💳 Đã trả</option>
            </select>

            {/* Filter VAT */}
            <select
              className="form-select"
              style={{ width: 'auto', fontSize: '12.5px', padding: '6px 10px', height: '34px' }}
              value={filterVat}
              onChange={e => { setFilterVat(e.target.value); setCurrentPage(1); }}
            >
              <option value="all">🧾 VAT: Tất cả</option>
              <option value="true">☑ Có hóa đơn VAT</option>
              <option value="false">☐ Không có VAT</option>
            </select>

            {/* Filter Month */}
            <select
              className="form-select"
              style={{ width: 'auto', fontSize: '12.5px', padding: '6px 10px', height: '34px' }}
              value={filterMonth}
              onChange={e => { setFilterMonth(e.target.value); setCurrentPage(1); }}
            >
              <option value="all">📅 Tháng: Tất cả</option>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                <option key={m} value={String(m)}>Tháng {m}</option>
              ))}
            </select>

            {/* Filter Year */}
            <select
              className="form-select"
              style={{ width: 'auto', fontSize: '12.5px', padding: '6px 10px', height: '34px' }}
              value={filterYear}
              onChange={e => { setFilterYear(e.target.value); setCurrentPage(1); }}
            >
              {[2024, 2025, 2026, 2027].map(y => (
                <option key={y} value={String(y)}>Năm {y}</option>
              ))}
            </select>

            {/* View Mode Toggle */}
            <div style={{ display: 'flex', background: 'var(--bg-input)', borderRadius: '8px', padding: '2px', border: '1px solid var(--border)', marginLeft: 'auto' }}>
              <button
                onClick={() => setViewMode('table')}
                style={{
                  padding: '5px 9px', border: 'none', borderRadius: '6px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600,
                  background: viewMode === 'table' ? 'var(--bg-card)' : 'transparent',
                  color: viewMode === 'table' ? 'var(--primary)' : 'var(--text-muted)',
                }}
              >
                <LayoutList size={13} /> Bảng Chi Tiết
              </button>
              <button
                onClick={() => setViewMode('matrix')}
                style={{
                  padding: '5px 9px', border: 'none', borderRadius: '6px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600,
                  background: viewMode === 'matrix' ? 'var(--bg-card)' : 'transparent',
                  color: viewMode === 'matrix' ? 'var(--primary)' : 'var(--text-muted)',
                }}
                title="Bảng ma trận tổng hợp theo người (mẫu Google Sheets)"
              >
                <Table2 size={13} /> Ma Trận Hoàn Ứng
              </button>
              <button
                onClick={() => setViewMode('grid')}
                style={{
                  padding: '5px 9px', border: 'none', borderRadius: '6px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600,
                  background: viewMode === 'grid' ? 'var(--bg-card)' : 'transparent',
                  color: viewMode === 'grid' ? 'var(--primary)' : 'var(--text-muted)',
                }}
              >
                <LayoutGrid size={13} /> Thẻ Card
              </button>
            </div>
          </div>
        </div>

        {/* Expenses List */}
        {loading && currentResult && <div role="status" style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '10px' }}>Đang cập nhật khoản chi…</div>}
        {loading && !currentResult ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[1, 2, 3].map(i => <div key={i} className="skeleton-card" style={{ height: '70px', borderRadius: '10px' }} />)}
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">💵</div>
            <div className="empty-state__title">Chưa có khoản chi tiêu nào</div>
            <div className="empty-state__desc">Bấm "Báo Cáo Chi Tiêu" để thêm khoản chi tiêu hộ công ty mới</div>
          </div>
        ) : viewMode === 'matrix' ? (
          /* MATRIX VIEW MODE (Chuẩn theo mẫu Google Sheets - Component Hóa) */
          <ReimbursementMatrixTable
            matrixData={matrixData}
            matrixScopeFilter={matrixScopeFilter}
            setMatrixScopeFilter={setMatrixScopeFilter}
            handleExportMatrixCSV={handleExportMatrixCSV}
            handleExportExcel={handleExportExcel}
            formatVND={formatVND}
            formatDate={formatDate}
            staffList={staffList}
            handleMarkPaid={handleMarkPaid}
            isAdmin={isAdmin}
            user={user}
            fundStats={fundsData?.stats}
          />
        ) : viewMode === 'table' ? (
          /* TABLE VIEW MODE */
          <div className="card animate-fade-in" style={{ padding: 0, overflowX: 'auto', borderRadius: '12px', border: '1px solid var(--border)', maxWidth: '100%' }}>
            <table style={{ width: '100%', minWidth: '980px', fontSize: '12.5px', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--bg-raised)', borderBottom: '1px solid var(--border)', color: 'var(--text)', fontWeight: 800 }}>
                  <th style={{ padding: '12px 14px', width: '45px', textAlign: 'center', whiteSpace: 'nowrap' }}>STT</th>
                  <th style={{ padding: '12px 14px', width: '105px', whiteSpace: 'nowrap' }}>NGÀY GIAO DỊCH</th>
                  <th style={{ padding: '12px 14px', minWidth: '180px', whiteSpace: 'nowrap' }}>MÔ TẢ KHOẢN CHI</th>
                  <th style={{ padding: '12px 14px', minWidth: '130px', whiteSpace: 'nowrap' }}>NGƯỜI CHI</th>
                  <th style={{ padding: '12px 14px', width: '130px', textAlign: 'right', whiteSpace: 'nowrap' }}>SỐ TIỀN</th>
                  <th style={{ padding: '12px 14px', width: '120px', textAlign: 'center', whiteSpace: 'nowrap' }}>TRẠNG THÁI DUYỆT</th>
                  <th style={{ padding: '12px 14px', width: '125px', textAlign: 'center', whiteSpace: 'nowrap' }}>TRẠNG THÁI TRẢ</th>
                  <th style={{ padding: '12px 14px', width: '100px', textAlign: 'center', whiteSpace: 'nowrap' }}>HÓA ĐƠN VAT</th>
                  <th style={{ padding: '12px 14px', width: '80px', textAlign: 'center', whiteSpace: 'nowrap' }}>ẢNH BILL</th>
                  <th style={{ padding: '12px 14px', width: '180px', textAlign: 'center', whiteSpace: 'nowrap' }}>THAO TÁC</th>
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.map((exp, idx) => {
                  const isApproved = exp.approval_status === 'approved';
                  const isPending = exp.approval_status === 'pending';
                  const isRejected = exp.approval_status === 'rejected';
                  const isPaid = exp.payment_status === 'paid';
                  const ownerId = String(exp.user_id?._id || exp.user_id || '');
                  const isOwner = ownerId === String(user?._id);

                  const canApprove = exp.can_approve !== undefined ? exp.can_approve : (isAdmin && isPending);
                  const canDelete = exp.can_delete !== undefined ? exp.can_delete : (isAdmin || (isOwner && isPending));
                  const canToggleVat = exp.can_toggle_vat !== undefined ? exp.can_toggle_vat : (isAdmin || (isOwner && isPending));
                  const canMarkPaid = exp.can_mark_paid !== undefined ? exp.can_mark_paid : (isAdmin && isApproved);
                  const hasAnyAction = canApprove || canDelete || canMarkPaid;

                  return (
                    <tr
                      key={exp._id}
                      style={{
                        borderBottom: '1px solid var(--border-muted)',
                        background: idx % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-raised)',
                      }}
                    >
                      <td style={{ padding: '10px 14px', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'center' }}>
                        {idx + 1}
                      </td>
                      <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {formatDate(exp.date)}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: '13px' }}>
                          {exp.description}
                        </div>
                        {exp.notes && (
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            💬 {exp.notes}
                          </div>
                        )}
                        {isRejected && exp.rejection_reason && (
                          <div style={{ fontSize: '11px', color: 'var(--red)', marginTop: '2px', fontWeight: 600 }}>
                            ⚠️ Lý do từ chối: {exp.rejection_reason}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          className="staff-profile-trigger"
                          onClick={() => setViewingStaffDetail(resolveExpenseStaff(exp))}
                          title={`Xem hồ sơ ${exp.user_id?.full_name || exp.user_name || 'nhân viên'}`}
                        >
                          <img
                            src={exp.user_id?.avatar_url || '/logo.png'}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            width={24}
                            height={24}
                            style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                            onError={e => { e.target.src = '/logo.png'; }}
                          />
                          <span style={{ fontWeight: 600, color: 'var(--text)' }}>
                            {exp.user_id?.full_name || 'Nhân viên'}
                          </span>
                        </button>
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <strong style={{ fontSize: '13.5px', color: 'var(--primary)', fontVariantNumeric: 'tabular-nums' }}>
                          {formatVND(exp.amount)}
                        </strong>
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <span
                          className={`badge ${isApproved ? 'badge--success' : isPending ? 'badge--warning' : 'badge--danger'}`}
                          style={{ fontSize: '11px', padding: '3px 8px' }}
                        >
                          {isApproved ? '✅ Đã duyệt' : isPending ? '⏳ Chờ duyệt' : '❌ Từ chối'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <span
                          className={`badge ${isPaid ? 'badge--success' : 'badge--danger'}`}
                          style={{ fontSize: '11px', padding: '3px 8px' }}
                        >
                          {isPaid ? '💳 Đã trả' : '⏳ Chưa trả'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: canToggleVat ? 'pointer' : 'default' }}>
                          <input
                            type="checkbox"
                            checked={Boolean(exp.has_vat_invoice)}
                            onChange={() => canToggleVat && handleToggleVat(exp._id)}
                            disabled={!canToggleVat}
                            style={{ accentColor: 'var(--primary)', cursor: canToggleVat ? 'pointer' : 'default' }}
                          />
                          <span style={{ fontSize: '11px', color: exp.has_vat_invoice ? 'var(--primary)' : 'var(--text-muted)', fontWeight: exp.has_vat_invoice ? 700 : 500 }}>
                            {exp.has_vat_invoice ? 'Có VAT' : 'Không'}
                          </span>
                        </label>
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        {exp.receipt_url ? (
                          <button
                            onClick={() => setFullBillImage({ url: exp.receipt_url, title: `Hóa đơn: ${exp.description}` })}
                            className="btn btn--ghost"
                            style={{ padding: '4px 8px', fontSize: '11px', color: 'var(--primary)' }}
                            title="Bấm để xem ảnh hóa đơn / bill"
                          >
                            📸 Xem bill
                          </button>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>—</span>
                        )}
                      </td>

                      {/* Quick Action Column */}
                      <td style={{ padding: '10px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', alignItems: 'center' }}>
                          {canApprove && (
                            <>
                              <button
                                onClick={() => handleApprove(exp._id, 'approved')}
                                className="btn btn--primary"
                                style={{ padding: '3px 8px', fontSize: '11px', background: 'var(--green)' }}
                                title="Duyệt chi"
                              >
                                <Check size={12} /> Duyệt
                              </button>
                              <button
                                onClick={() => setShowRejectModal(exp)}
                                className="btn btn--ghost"
                                style={{ padding: '3px 8px', fontSize: '11px', color: 'var(--red)' }}
                                title="Từ chối chi"
                              >
                                <X size={12} />
                              </button>
                            </>
                          )}

                          {canMarkPaid && (
                            <button
                              onClick={() => handleMarkPaid(exp._id, exp.payment_status)}
                              className="btn btn--ghost"
                              style={{
                                padding: '3px 8px', fontSize: '11px',
                                color: isPaid ? 'var(--text-muted)' : 'var(--green)',
                                borderColor: isPaid ? 'var(--border)' : 'var(--green)',
                                fontWeight: 600
                              }}
                              title={isPaid ? 'Đổi về chưa thanh toán' : 'Xác nhận đã chuyển khoản trả tiền'}
                            >
                              <CreditCard size={12} style={{ marginRight: '3px' }} />
                              {isPaid ? 'Hủy trả' : 'Xác nhận trả'}
                            </button>
                          )}

                          {canDelete && (
                            <button
                              onClick={() => handleDelete(exp._id)}
                              className="btn btn--ghost"
                              style={{ padding: '3px 6px', fontSize: '11px', color: 'var(--text-muted)' }}
                              title="Xóa khoản chi"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}

                          {!hasAnyAction && (
                            <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* CARD GRID VIEW MODE */
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
            {filteredExpenses.map(exp => {
              const isApproved = exp.approval_status === 'approved';
              const isPending = exp.approval_status === 'pending';
              const isPaid = exp.payment_status === 'paid';
              const ownerId = String(exp.user_id?._id || exp.user_id || '');
              const isOwner = ownerId === String(user?._id);

              const canApprove = exp.can_approve !== undefined ? exp.can_approve : (isAdmin && isPending);
              const canDelete = exp.can_delete !== undefined ? exp.can_delete : (isAdmin || (isOwner && isPending));
              const canMarkPaid = exp.can_mark_paid !== undefined ? exp.can_mark_paid : (isAdmin && isApproved);
              const hasAnyAction = canApprove || canDelete || canMarkPaid;

              return (
                <div key={exp._id} className="card animate-fade-in" style={{ padding: '14px', position: 'relative' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span className={`badge ${isApproved ? 'badge--success' : isPending ? 'badge--warning' : 'badge--danger'}`} style={{ fontSize: '10.5px' }}>
                        {isApproved ? '✅ Đã duyệt' : isPending ? '⏳ Chờ duyệt' : '❌ Từ chối'}
                      </span>
                      <span className={`badge ${isPaid ? 'badge--success' : 'badge--danger'}`} style={{ fontSize: '10.5px' }}>
                        {isPaid ? '💳 Đã trả' : '⏳ Chưa trả'}
                      </span>
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
                      📅 {formatDate(exp.date)}
                    </span>
                  </div>

                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)', marginBottom: '6px' }}>
                    {exp.description}
                  </div>

                  <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--primary)', marginBottom: '8px', fontVariantNumeric: 'tabular-nums' }}>
                    {formatVND(exp.amount)}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px', flexWrap: 'wrap', gap: '4px' }}>
                    <button
                      type="button"
                      className="staff-profile-trigger"
                      onClick={() => setViewingStaffDetail(resolveExpenseStaff(exp))}
                      title={`Xem hồ sơ ${exp.user_id?.full_name || exp.user_name || 'nhân viên'}`}
                    >
                      👤 Chi: {exp.user_id?.full_name || exp.user_name || 'Nhân viên'}
                    </button>
                    <span>{exp.has_vat_invoice ? '🧾 Có VAT' : '—'}</span>
                  </div>

                  {exp.receipt_url && (
                    <div style={{ marginBottom: '10px' }}>
                      <img
                        src={exp.receipt_url}
                        alt="Bill"
                        loading="lazy"
                        decoding="async"
                        onClick={() => setFullBillImage({ url: exp.receipt_url, title: exp.description })}
                        style={{ width: '100%', height: '100px', objectFit: 'cover', borderRadius: '8px', cursor: 'pointer', border: '1px solid var(--border)' }}
                      />
                    </div>
                  )}

                  {hasAnyAction && (
                    <div style={{ display: 'flex', gap: '6px', marginTop: '10px', borderTop: '1px solid var(--border-muted)', paddingTop: '8px' }}>
                      {canApprove && (
                        <>
                          <button onClick={() => handleApprove(exp._id, 'approved')} className="btn btn--primary btn--full" style={{ padding: '6px', fontSize: '11.5px' }}>
                            Duyệt chi
                          </button>
                          <button onClick={() => setShowRejectModal(exp)} className="btn btn--ghost btn--full" style={{ padding: '6px', fontSize: '11.5px', color: 'var(--red)' }}>
                            Từ chối
                          </button>
                        </>
                      )}
                      {canMarkPaid && (
                        <button
                          onClick={() => handleMarkPaid(exp._id, exp.payment_status)}
                          className="btn btn--ghost btn--full"
                          style={{ padding: '6px', fontSize: '11.5px', color: isPaid ? 'var(--text-muted)' : 'var(--green)', fontWeight: 600 }}
                        >
                          {isPaid ? 'Đổi về chưa trả' : '💳 Xác nhận đã hoàn ứng'}
                        </button>
                      )}

                      {canDelete && !canApprove && !canMarkPaid && (
                        <button
                          onClick={() => handleDelete(exp._id)}
                          className="btn btn--ghost btn--full"
                          style={{ padding: '6px', fontSize: '11.5px', color: 'var(--red)' }}
                        >
                          <Trash2 size={12} style={{ marginRight: '4px' }} /> Xóa khoản chi
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Controls */}
        {!loading && (summary.totalPages > 1 || (summary.totalCount || expenses.length) > pageSize) && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '10px',
              marginTop: '16px',
              padding: '12px 16px',
              background: 'var(--bg-card)',
              borderRadius: '10px',
              border: '1px solid var(--border)',
              fontSize: '12.5px',
            }}
          >
            <div style={{ color: 'var(--text-muted)' }}>
              Hiển thị <strong style={{ color: 'var(--text)' }}>{(currentPage - 1) * pageSize + 1}</strong> – <strong style={{ color: 'var(--text)' }}>{Math.min(currentPage * pageSize, summary.totalCount || expenses.length)}</strong> trên tổng số <strong style={{ color: 'var(--primary)' }}>{summary.totalCount || expenses.length}</strong> khoản chi
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                className="btn btn--ghost"
                style={{ padding: '5px 10px', fontSize: '12px' }}
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                ‹ Trang trước
              </button>
              <span style={{ fontWeight: 700, padding: '0 6px', color: 'var(--text-secondary)' }}>
                {currentPage} / {summary.totalPages || 1}
              </span>
              <button
                className="btn btn--ghost"
                style={{ padding: '5px 10px', fontSize: '12px' }}
                disabled={currentPage >= (summary.totalPages || 1)}
                onClick={() => setCurrentPage((p) => Math.min(summary.totalPages || 1, p + 1))}
              >
                Trang sau ›
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Báo Cáo Chi Tiêu Mới */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-sheet animate-slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="modal-sheet__handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0 }}>💵 Báo Cáo Chi Tiêu & Hoàn Ứng</h3>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>Khai báo khoản chi hộ công ty để được hoàn tiền</div>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="btn btn--ghost" style={{ padding: '4px 8px' }}>
                <X size={18} />
              </button>
            </div>

            <div className="form-group">
              <label className="form-label">Ngày giao dịch *</label>
              <input
                type="date"
                className="form-input"
                value={formDate}
                onChange={e => setFormDate(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Mô tả khoản chi *</label>
              <input
                type="text"
                className="form-input"
                placeholder="VD: Mua cf tiếp khách, Circle K công tác, Mua đồ thắp hương..."
                value={formDesc}
                onChange={e => setFormDesc(e.target.value)}
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label">Số tiền chi (VNĐ) *</label>
              <input
                type="text"
                className="form-input"
                placeholder="VD: 150000"
                value={formAmount}
                onChange={e => {
                  const val = e.target.value.replace(/\D/g, '');
                  setFormAmount(val ? Number(val).toLocaleString('vi-VN') : '');
                }}
              />
              {formAmount && (
                <div style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 700, marginTop: '4px' }}>
                  💰 Bằng chữ: {formatVND(Number(String(formAmount).replace(/\D/g, '')))}
                </div>
              )}
            </div>

            {/* Checkbox VAT */}
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={formVat}
                  onChange={e => setFormVat(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }}
                />
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>
                  Khoản chi này có Hóa đơn VAT
                </span>
              </label>
            </div>

            {/* Receipt Photo Upload */}
            <div className="form-group">
              <label className="form-label">📸 Ảnh hóa đơn / Bill thanh toán</label>
              <input type="file" ref={fileInputRef} onChange={handleImageCapture} accept="image/*" style={{ display: 'none' }} />
              {formReceipt ? (
                <div style={{ position: 'relative', width: '100%', height: '130px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                  <img src={formReceipt} alt="Bill preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button
                    type="button"
                    onClick={() => setFormReceipt(null)}
                    style={{ position: 'absolute', top: '6px', right: '6px', background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="btn btn--ghost btn--full"
                  style={{ padding: '12px', border: '1.5px dashed var(--border)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: 'var(--primary)', fontWeight: 600 }}
                >
                  <Camera size={18} /> Chụp ảnh / Tải ảnh Bill hóa đơn
                </button>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Ghi chú thêm</label>
              <textarea
                className="form-input"
                rows={2}
                placeholder="Ghi chú thêm nếu cần..."
                value={formNotes}
                onChange={e => setFormNotes(e.target.value)}
              />
            </div>

            <button
              onClick={handleCreateExpense}
              disabled={submitting}
              className="btn btn--primary btn--full btn--lg"
              style={{ marginTop: '8px' }}
            >
              {submitting ? <span className="spinner" /> : 'Gửi Báo Cáo Chi Tiêu'}
            </button>
          </div>
        </div>
      )}

      {/* Reject Reason Modal */}
      {showRejectModal && (
        <div className="modal-overlay" onClick={() => setShowRejectModal(null)}>
          <div className="modal-sheet animate-slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-sheet__handle" />
            <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--red)', marginBottom: '12px' }}>
              ❌ Từ Chối Phê Duyệt Khoản Chi
            </h3>
            <div className="form-group">
              <label className="form-label">Lý do từ chối *</label>
              <textarea
                className="form-input"
                rows={3}
                placeholder="VD: Thiếu hóa đơn hợp lệ / Sai số tiền..."
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                autoFocus
              />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setShowRejectModal(null)} className="btn btn--ghost btn--full">Hủy</button>
              <button
                onClick={() => handleApprove(showRejectModal._id, 'rejected', rejectionReason)}
                className="btn btn--full"
                style={{ background: 'var(--red)', color: '#fff', border: 'none', fontWeight: 700 }}
              >
                Xác Nhận Từ Chối
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bill Image Lightbox */}
      <ImageLightbox image={fullBillImage} onClose={() => setFullBillImage(null)} />
    
      {/* Staff Detail & Bank Profile Modal Sheet */}
      {viewingStaffDetail && typeof document !== "undefined" && createPortal(
        <div className="modal-overlay" style={{ zIndex: 999999, padding: "16px" }} onClick={() => setViewingStaffDetail(null)}>
          <div className="modal-sheet animate-slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: "440px", margin: "0 auto", padding: "20px 18px" }}>
            <div className="modal-sheet__handle" />

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", paddingBottom: "12px", borderBottom: "1px solid var(--border)" }}>
              <h3 style={{ fontSize: "16px", fontWeight: 800, margin: 0, color: "var(--text)" }}>👤 Hồ Sơ Nhân Sự & Thanh Toán</h3>
              <button onClick={() => setViewingStaffDetail(null)} className="btn btn--ghost" style={{ padding: "4px 8px" }}><X size={18} /></button>
            </div>

            <div style={{ textAlign: "center", marginBottom: "18px" }}>
              <img
                src={viewingStaffDetail.avatar_url || "/logo.png"}
                alt=""
                style={{ width: "74px", height: "74px", borderRadius: "50%", objectFit: "cover", margin: "0 auto 8px", border: "3px solid var(--primary)", display: "block" }}
                onError={e => { e.target.src = "/logo.png"; }}
              />
              <h2 style={{ fontSize: "17px", fontWeight: 800, margin: "4px 0 2px", color: "var(--text)" }}>{viewingStaffDetail.full_name}</h2>
              <div style={{ fontSize: "12px", color: "var(--primary)", fontWeight: 700 }}>#{viewingStaffDetail.employee_code || "NS"} · {viewingStaffDetail.position || "Nhân sự"}</div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px", fontSize: "13px" }}>
              <div style={{ background: "var(--bg-input)", padding: "10px 12px", borderRadius: "10px", border: "1px solid var(--border)", display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted)" }}>Email:</span>
                <strong>{viewingStaffDetail.email || "Chưa cập nhật"}</strong>
              </div>
              <div style={{ background: "var(--bg-input)", padding: "10px 12px", borderRadius: "10px", border: "1px solid var(--border)", display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted)" }}>Số điện thoại:</span>
                {viewingStaffDetail.phone ? (
                  <a href={"tel:" + viewingStaffDetail.phone} style={{ fontWeight: 700, color: "var(--primary)", textDecoration: "none" }}>{viewingStaffDetail.phone}</a>
                ) : <strong>Chưa cập nhật</strong>}
              </div>
              <div style={{ background: "var(--bg-input)", padding: "10px 12px", borderRadius: "10px", border: "1px solid var(--border)", display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted)" }}>Phòng ban:</span>
                <strong>{viewingStaffDetail.department_name || "Văn phòng"}</strong>
              </div>

              {/* Bank Account Details for Reimbursement */}
              <div style={{ background: "var(--primary-soft)", padding: "12px 14px", borderRadius: "12px", border: "1px solid color-mix(in srgb, var(--primary) 30%, var(--border))", marginTop: "4px" }}>
                <div style={{ fontSize: "11px", fontWeight: 800, color: "var(--primary)", textTransform: "uppercase", marginBottom: "8px", letterSpacing: "0.04em" }}>
                  💳 Thông Tin Nhận Tiền Hoàn Ứng
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                  <span style={{ color: "var(--text-secondary)" }}>Ngân hàng:</span>
                  <strong>{viewingStaffDetail.bank_name || "Chưa cập nhật"}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                  <span style={{ color: "var(--text-secondary)" }}>Số tài khoản:</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <strong style={{ color: "var(--primary)", fontSize: "14px", fontVariantNumeric: "tabular-nums" }}>{viewingStaffDetail.bank_account || "Chưa cập nhật"}</strong>
                    {viewingStaffDetail.bank_account && (
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(viewingStaffDetail.bank_account);
                          toast.success("Đã copy số tài khoản!");
                        }}
                        className="btn btn--ghost"
                        style={{ padding: "2px 6px", fontSize: "10px" }}
                      >
                        Copy
                      </button>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-secondary)" }}>Chi nhánh:</span>
                  <strong>{viewingStaffDetail.branch || "Chưa cập nhật"}</strong>
                </div>
              </div>
            </div>

            <button onClick={() => setViewingStaffDetail(null)} className="btn btn--primary btn--full">Đóng</button>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Nạp Quỹ & Lịch Sử Quỹ Tạm Ứng */}
      <FundDepositModal
        isOpen={showFundDepositModal}
        onClose={() => setShowFundDepositModal(false)}
        staffList={staffList}
        onSuccess={() => { loadFunds(); loadData(); }}
        formatVND={formatVND}
      />

      <FundHistoryModal
        isOpen={showFundHistoryModal}
        onClose={() => setShowFundHistoryModal(false)}
        funds={fundsData?.funds || []}
        isAdmin={isAdmin}
        onSuccess={() => { loadFunds(); loadData(); }}
        formatVND={formatVND}
        formatDate={formatDate}
      />
    </div>
  );
}
