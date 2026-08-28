import ImageLightbox from "../components/ImageLightbox";
// src/pages/ExpensesPage.jsx
// Quản lý Bảng Tổng Hợp Chi Tiêu & Hoàn Ứng Cty — Chuẩn theo mẫu Google Sheets

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Plus, Search, Download, Check, X, CreditCard,
  Trash2, Camera, LayoutList, LayoutGrid
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import useAuthStore from '../stores/authStore';
import HeaderActions from '../components/HeaderActions';
import { downloadBlob } from '../utils/downloadBlob';

const formatVND = (amount) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);
};

const formatDate = (isoDate) => {
  if (!isoDate) return '—';
  const parts = isoDate.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return isoDate;
};

export default function ExpensesPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const isAdminOrLeader = ['admin', 'leader', 'manager'].includes(user?.role);

  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState({
    totalApprovedAmount: 0,
    totalPendingAmount: 0,
    totalPendingCount: 0,
    totalUnpaidAmount: 0,
    totalPaidAmount: 0,
    myTotalApproved: 0,
    myTotalUnpaid: 0,
  });
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [filterUser, setFilterUser] = useState('all');
  const [filterApproval, setFilterApproval] = useState('all');
  const [filterPayment, setFilterPayment] = useState('all');
  const [filterVat, setFilterVat] = useState('all');
  const [filterMonth, setFilterMonth] = useState('all');
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString());
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'grid'

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(null); // expense object
  const [rejectionReason, setRejectionReason] = useState('');
  const [fullBillImage, setFullBillImage] = useState(null);
  const [viewingStaffDetail, setViewingStaffDetail] = useState(null); // { url, title }

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

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterUser !== 'all') params.append('user_id', filterUser);
      if (filterApproval !== 'all') params.append('approval_status', filterApproval);
      if (filterPayment !== 'all') params.append('payment_status', filterPayment);
      if (filterVat !== 'all') params.append('has_vat', filterVat);
      if (filterMonth !== 'all') params.append('month', filterMonth);
      if (filterYear !== 'all') params.append('year', filterYear);
      if (search.trim()) params.append('search', search.trim());

      const { data } = await api.get(`/expenses?${params.toString()}`);
      setExpenses(data.expenses || []);
      if (data.summary) setSummary(data.summary);
    } catch {
      toast.error('Lỗi tải danh sách chi tiêu');
    } finally {
      setLoading(false);
    }
  }, [filterUser, filterApproval, filterPayment, filterVat, filterMonth, filterYear, search]);

  const loadStaffList = useCallback(async () => {
    try {
      const { data } = await api.get('/users');
      if (Array.isArray(data)) setStaffList(data);
    } catch {}
  }, []);

  useEffect(() => {
    const delay = search.trim() ? 300 : 0;
    const timer = window.setTimeout(loadData, delay);
    return () => window.clearTimeout(timer);
  }, [loadData, search]);

  useEffect(() => {
    loadStaffList();
  }, [loadStaffList]);

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

  const handleCreateExpense = async () => {
    if (!formDesc.trim()) {
      toast.error('Vui lòng nhập mô tả khoản chi');
      return;
    }
    const cleanAmount = Number(String(formAmount).replace(/\D/g, ''));
    if (!cleanAmount || cleanAmount <= 0) {
      toast.error('Vui lòng nhập số tiền chi hợp lệ');
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

      toast.success('Đã gửi báo cáo chi tiêu thành công! 💵');
      setShowCreateModal(false);
      // Reset form
      setFormDate(todayStr);
      setFormDesc('');
      setFormAmount('');
      setFormVat(false);
      setFormReceipt(null);
      setFormNotes('');
      loadData();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Lỗi gửi chi tiêu');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (expenseId, status, reason = '') => {
    try {
      await api.put(`/expenses/${expenseId}/approve`, {
        status,
        rejection_reason: reason,
      });
      toast.success(status === 'approved' ? 'Đã duyệt khoản chi tiêu! ✅' : 'Đã từ chối khoản chi tiêu');
      setShowRejectModal(null);
      setRejectionReason('');
      loadData();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Lỗi xử lý duyệt chi');
    }
  };

  const handleMarkPaid = async (expenseId, currentStatus) => {
    if (!isAdmin) {
      toast.error('Chỉ Admin mới có quyền xác nhận hoàn ứng');
      return;
    }
    const nextStatus = currentStatus === 'paid' ? 'unpaid' : 'paid';
    try {
      await api.put(`/expenses/${expenseId}/pay`, {
        payment_status: nextStatus,
      });
      toast.success(nextStatus === 'paid' ? 'Đã xác nhận thanh toán hoàn ứng! 💳' : 'Đã chuyển về chưa thanh toán');
      loadData();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Lỗi cập nhật thanh toán');
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
      loadData();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Lỗi xóa chi tiêu');
    }
  };

  const handleExportCSV = () => {
    if (expenses.length === 0) {
      toast.error("Không có dữ liệu để xuất file");
      return;
    }

    const headers = [
      "STT",
      "Ngày giao dịch",
      "Mô tả khoản chi",
      "Người chi",
      "Số tiền (VNĐ)",
      "Trạng thái duyệt",
      "Trạng thái hoàn tiền",
      "Hóa đơn VAT",
      "Ngân hàng",
      "Số tài khoản nhận tiền",
      "Chi nhánh",
      "Ghi chú"
    ];

    const escapeCsv = (str) => "\"" + String(str || "").replace(/"/g, "''") + "\"";

    const rows = filteredExpenses.map((expItem, idx) => {
      const spenderUser = staffList.find(s => String(s._id || s.id) === String(expItem.user_id?._id || expItem.user_id)) || {};
      const spenderName = expItem.user_id?.full_name || expItem.user_name || spenderUser.full_name || "—";
      const approvalVi = expItem.approval_status === "approved" ? "Đã duyệt" : expItem.approval_status === "rejected" ? "Từ chối" : "Chờ duyệt";
      const paymentVi = expItem.payment_status === "paid" ? "Đã trả" : "Chưa trả";
      const vatVi = expItem.has_vat_invoice ? "Có VAT" : "Không VAT";

      return [
        idx + 1,
        formatDate(expItem.date),
        escapeCsv(expItem.description),
        escapeCsv(spenderName),
        expItem.amount,
        escapeCsv(approvalVi),
        escapeCsv(paymentVi),
        escapeCsv(vatVi),
        escapeCsv(spenderUser.bank_name),
        escapeCsv(spenderUser.bank_account),
        escapeCsv(spenderUser.branch),
        escapeCsv(expItem.notes)
      ];
    });

    const totalRow = [
      "TỔNG CỘNG",
      "",
      "Tổng các khoản chi",
      "",
      summary.totalApprovedAmount || 0,
      escapeCsv("Chờ duyệt: " + (summary.totalPendingCount || 0) + " khoản"),
      escapeCsv("Chưa hoàn tiền: " + formatVND(summary.totalUnpaidAmount || 0)),
      "",
      "",
      "",
      "",
      ""
    ];

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(",")), totalRow.join(",")].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    downloadBlob(blob, "Bang_Ke_Chi_Tieu_Hoan_Ung_ET_" + new Date().toISOString().slice(0, 10) + ".csv");
    toast.success("Đã xuất bảng chi tiêu hoàn ứng thành công! 📄");
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
              onClick={handleExportCSV}
              className="btn btn--ghost"
              style={{ padding: '7px 10px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '5px' }}
              title="Xuất bảng Excel / CSV nộp kế toán"
            >
              <Download size={15} /> Xuất Excel
            </button>
            <HeaderActions />
          </div>
        </div>
      </div>

      <div className="container container--wide" style={{ paddingTop: '16px' }}>
        {/* Top Financial KPI Summary Cards */}
        <div className="kpi-grid-4" style={{ marginBottom: "16px" }}>
          <div className="stat-card-modern">
            <div className="stat-card-modern__value" style={{ color: "var(--primary)" }}>
              {formatVND(summary.totalApprovedAmount)}
            </div>
            <div className="stat-card-modern__label">💰 Tổng Đã Duyệt Chi</div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Khoản chi hợp lệ</div>
          </div>

          <div
            onClick={() => setFilterApproval(filterApproval === "pending" ? "all" : "pending")}
            className="stat-card-modern card--interactive"
            style={{
              cursor: "pointer",
              border: filterApproval === "pending" ? "2px solid var(--yellow)" : "1px solid var(--border)",
              background: filterApproval === "pending" ? "var(--yellow-soft)" : "var(--bg-card)"
            }}
          >
            <div className="stat-card-modern__value" style={{ color: "var(--yellow)" }}>
              {summary.totalPendingCount} khoản ({formatVND(summary.totalPendingAmount)})
            </div>
            <div className="stat-card-modern__label">⏳ Chờ Duyệt Chi</div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Cần Admin xem xét</div>
          </div>

          <div
            onClick={() => setFilterPayment(filterPayment === "unpaid" ? "all" : "unpaid")}
            className="stat-card-modern card--interactive"
            style={{
              cursor: "pointer",
              border: filterPayment === "unpaid" ? "2px solid var(--red)" : "1px solid var(--border)",
              background: filterPayment === "unpaid" ? "var(--red-soft)" : "var(--bg-card)"
            }}
          >
            <div className="stat-card-modern__value" style={{ color: "var(--red)" }}>
              {formatVND(summary.totalUnpaidAmount)}
            </div>
            <div className="stat-card-modern__label">💸 Chưa Hoàn Tiền</div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Cần chuyển khoản trả</div>
          </div>

          <div
            onClick={() => setFilterPayment(filterPayment === "paid" ? "all" : "paid")}
            className="stat-card-modern card--interactive"
            style={{
              cursor: "pointer",
              border: filterPayment === "paid" ? "2px solid var(--green)" : "1px solid var(--border)",
              background: filterPayment === "paid" ? "var(--green-soft)" : "var(--bg-card)"
            }}
          >
            <div className="stat-card-modern__value" style={{ color: "var(--green)" }}>
              {formatVND(summary.totalPaidAmount)}
            </div>
            <div className="stat-card-modern__label">💳 Đã Hoàn Ứng</div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Đã thanh toán xong</div>
          </div>
        </div>

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
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            {/* Filter Spender */}
            <select
              className="form-select"
              style={{ width: 'auto', minWidth: '140px', fontSize: '12.5px', padding: '6px 10px', height: '34px' }}
              value={filterUser}
              onChange={e => setFilterUser(e.target.value)}
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
              onChange={e => setFilterApproval(e.target.value)}
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
              onChange={e => setFilterPayment(e.target.value)}
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
              onChange={e => setFilterVat(e.target.value)}
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
              onChange={e => setFilterMonth(e.target.value)}
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
              onChange={e => setFilterYear(e.target.value)}
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
                <LayoutList size={13} /> Bảng Excel
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
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[1, 2, 3].map(i => <div key={i} className="skeleton-card" style={{ height: '70px', borderRadius: '10px' }} />)}
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">💵</div>
            <div className="empty-state__title">Chưa có khoản chi tiêu nào</div>
            <div className="empty-state__desc">Bấm "Báo Cáo Chi Tiêu" để thêm khoản chi tiêu hộ công ty mới</div>
          </div>
        ) : viewMode === 'table' ? (
          /* TABLE VIEW MODE */
          <div className="card animate-fade-in" style={{ padding: 0, overflowX: 'auto', borderRadius: '12px', border: '1px solid var(--border)', maxWidth: '100%' }}>
            <table style={{ width: '100%', minWidth: '980px', fontSize: '12.5px', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--bg-raised)', borderBottom: '1px solid var(--border)', color: 'var(--text)', fontWeight: 800 }}>
                  <th style={{ padding: '12px 14px', width: '45px', textAlign: 'center', whiteSpace: 'nowrap' }}>STT</th>
                  <th style={{ padding: '12px 14px', width: '105px', whiteSpace: 'nowrap' }}>NGÀY GIAO DỊCH</th>
                  <th style={{ padding: '12px 14px', minWidth: '180px', whiteSpace: 'nowrap' }}>MÔ TẢ KHOẢN CHI</th>
                  <th style={{ padding: '12px 14px', minWidth: '140px', whiteSpace: 'nowrap' }}>NGƯỜI CHI</th>
                  <th style={{ padding: '12px 14px', width: '130px', textAlign: 'right', whiteSpace: 'nowrap' }}>SỐ TIỀN</th>
                  <th style={{ padding: '12px 14px', width: '130px', textAlign: 'center', whiteSpace: 'nowrap' }}>TRẠNG THÁI DUYỆT</th>
                  <th style={{ padding: '12px 14px', width: '125px', textAlign: 'center', whiteSpace: 'nowrap' }}>TRẠNG THÁI TRẢ</th>
                  <th style={{ padding: '12px 14px', width: '110px', textAlign: 'center', whiteSpace: 'nowrap' }}>HÓA ĐƠN VAT</th>
                  <th style={{ padding: '12px 14px', width: '80px', textAlign: 'center', whiteSpace: 'nowrap' }}>ẢNH BILL</th>
                  {isAdminOrLeader && (
                    <th style={{ padding: '12px 14px', width: '160px', textAlign: 'center', whiteSpace: 'nowrap' }}>THAO TÁC</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.map((exp, idx) => {
                  const isOwner = String(exp.user_id?._id || exp.user_id) === String(user?._id);
                  const isApproved = exp.approval_status === 'approved';
                  const isPending = exp.approval_status === 'pending';
                  const isRejected = exp.approval_status === 'rejected';
                  const isPaid = exp.payment_status === 'paid';

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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <img
                            src={exp.user_id?.avatar_url || '/logo.png'}
                            alt=""
                            style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                            onError={e => { e.target.src = '/logo.png'; }}
                          />
                          <span style={{ fontWeight: 600, color: 'var(--text)' }}>
                            {exp.user_id?.full_name || 'Nhân viên'}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <strong style={{ fontSize: '13.5px', color: 'var(--primary)' }}>
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
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: (isAdminOrLeader || isOwner) ? 'pointer' : 'default' }}>
                          <input
                            type="checkbox"
                            checked={Boolean(exp.has_vat_invoice)}
                            onChange={() => (isAdminOrLeader || isOwner) && handleToggleVat(exp._id)}
                            disabled={!isAdminOrLeader && !isOwner}
                            style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
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

                      {/* Admin Quick Action Column */}
                      {isAdminOrLeader && (
                        <td style={{ padding: '10px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                            {isPending && (
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

                            {isApproved && isAdmin && (
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

                            <button
                              onClick={() => handleDelete(exp._id)}
                              className="btn btn--ghost"
                              style={{ padding: '3px 6px', fontSize: '11px', color: 'var(--text-muted)' }}
                              title="Xóa khoản chi"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      )}
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

              return (
                <div key={exp._id} className="card animate-fade-in" style={{ padding: '14px', position: 'relative' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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

                  <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--primary)', marginBottom: '8px' }}>
                    {formatVND(exp.amount)}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    <span>👤 {exp.user_id?.full_name || 'Nhân viên'}</span>
                    <span>{exp.has_vat_invoice ? '🧾 Có VAT' : '—'}</span>
                  </div>

                  {exp.receipt_url && (
                    <div style={{ marginBottom: '10px' }}>
                      <img
                        src={exp.receipt_url}
                        alt="Bill"
                        onClick={() => setFullBillImage({ url: exp.receipt_url, title: exp.description })}
                        style={{ width: '100%', height: '100px', objectFit: 'cover', borderRadius: '8px', cursor: 'pointer', border: '1px solid var(--border)' }}
                      />
                    </div>
                  )}

                  {isAdminOrLeader && (
                    <div style={{ display: 'flex', gap: '6px', marginTop: '10px', borderTop: '1px solid var(--border-muted)', paddingTop: '8px' }}>
                      {isPending && (
                        <>
                          <button onClick={() => handleApprove(exp._id, 'approved')} className="btn btn--primary btn--full" style={{ padding: '6px', fontSize: '11.5px' }}>
                            Duyệt chi
                          </button>
                          <button onClick={() => setShowRejectModal(exp)} className="btn btn--ghost btn--full" style={{ padding: '6px', fontSize: '11.5px', color: 'var(--red)' }}>
                            Từ chối
                          </button>
                        </>
                      )}
                      {isApproved && isAdmin && (
                        <button
                          onClick={() => handleMarkPaid(exp._id, exp.payment_status)}
                          className="btn btn--ghost btn--full"
                          style={{ padding: '6px', fontSize: '11.5px', color: isPaid ? 'var(--text-muted)' : 'var(--green)', fontWeight: 600 }}
                        >
                          {isPaid ? 'Đổi về chưa trả' : '💳 Xác nhận đã hoàn ứng'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
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
</div>
  );
}
