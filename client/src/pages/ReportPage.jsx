// src/pages/ReportPage.jsx
// Báo cáo 5 tab: 🔒 Chốt Công (ET_Staff 2026) / 📄 Bảng Chi Tiết Cá Nhân (Mẫu Phiếu Chấm Công) / Tổng quan / Bảng tính công / Xếp hạng

import { useState, useEffect, useRef, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Download, Trophy, BarChart3, Calculator, TrendingUp, TrendingDown, Lock, Unlock, History, Edit2, CheckCircle2, X, AlertTriangle, FileSpreadsheet, FileText, UserCheck, Printer, Building2, ShieldCheck, FileType, Eye, Search, Filter, Calendar, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import toast from 'react-hot-toast';
import api from '../services/api';
import useAuthStore from '../stores/authStore';
import HeaderActions from '../components/HeaderActions';

const MONTHS = ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6',
  'Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];

const RANK_MEDALS = { 1: '🥇', 2: '🥈', 3: '🥉' };

// Confirm Dialog Component
function ConfirmDialog({ title, message, confirmLabel = 'Xác nhận', danger = true, onConfirm, onCancel }) {
  return (
    <div className="modal-overlay" style={{ zIndex: 99999 }}>
      <div className="modal-sheet animate-slide-up" style={{ maxWidth: '380px' }}>
        <div className="modal-sheet__handle" />
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
          <AlertTriangle size={22} color={danger ? 'var(--red)' : 'var(--yellow)'} />
          <div style={{ fontSize: '15px', fontWeight: 700 }}>{title}</div>
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '18px' }}>{message}</div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={onCancel} className="btn btn--ghost btn--full">Hủy bỏ</button>
          <button onClick={onConfirm} className="btn btn--full" style={{ background: danger ? 'var(--red)' : 'var(--primary)', color: '#fff', border: 'none', fontWeight: 700 }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ReportPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [tab, setTab] = useState('timesheet_lock'); // 'timesheet_lock' | 'individual_detail' | 'overview' | 'payroll' | 'ranking'

  // Responsive View Mode: 'cards' (Mặc định trên mobile) hoặc 'table' (Bảng ngang 31 ngày)
  const [viewMode, setViewMode] = useState(() => (typeof window !== 'undefined' && window.innerWidth < 768 ? 'cards' : 'table'));
  const [tableDisplayMode, setTableDisplayMode] = useState('days'); // 'days' | 'summary' | 'full'
  const [expandedStaffIds, setExpandedStaffIds] = useState(new Set());
  const [mobileWeekIndex, setMobileWeekIndex] = useState(() => {
    const firstDayOffset = (new Date(now.getFullYear(), now.getMonth(), 1).getDay() + 6) % 7;
    return Math.floor((firstDayOffset + now.getDate() - 1) / 7);
  });

  // Data states
  const [report, setReport] = useState(null);
  const [trend, setTrend] = useState(null);
  const [payroll, setPayroll] = useState(null);
  const [ranking, setRanking] = useState(null);
  const [matrixData, setMatrixData] = useState(null);
  const [individualDetail, setIndividualDetail] = useState(null);
  const [selectedDetailUserId, setSelectedDetailUserId] = useState('');
  const [loading, setLoading] = useState(true);

  // Search & Filter state for Matrix View
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [attendanceFilter, setAttendanceFilter] = useState('');
  const [staffTypeFilter, setStaffTypeFilter] = useState('');

  // Lock Confirm State
  const [lockConfirm, setLockConfirm] = useState(null); // { userId, currentLocked, actionText, targetText }

  // Edit Cell Modal State
  const [selectedCell, setSelectedCell] = useState(null);
  const [cellSymbol, setCellSymbol] = useState('x');
  const [cellOtHours, setCellOtHours] = useState(0);
  const [cellCheckIn, setCellCheckIn] = useState('08:30');
  const [cellCheckOut, setCellCheckOut] = useState('17:30');
  const [cellReason, setCellReason] = useState('');
  const [submittingCell, setSubmittingCell] = useState(false);

  // Audit Logs Modal State
  const [showAuditLogs, setShowAuditLogs] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Unified Export Modal State
  const timesheetRef = useRef(null);
  const individualRef = useRef(null);
  const pdfMatrixPrintRef = useRef(null);
  const pdfIndividualPrintRef = useRef(null);
  const matrixTableScrollRef = useRef(null);
  const matrixTopScrollRef = useRef(null);
  const [matrixScrollMetrics, setMatrixScrollMetrics] = useState({
    scrollWidth: 0,
    clientWidth: 0,
    left: 0,
    width: 0,
    showFloating: false,
  });

  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState('pdf'); // 'pdf' | 'excel'
  const [exportTarget, setExportTarget] = useState('matrix'); // 'matrix' (Bảng tổng hợp) | 'individual' (Phiếu chi tiết)
  const [exportScope, setExportScope] = useState('all'); // 'all' | 'single'
  const [selectedExportUser, setSelectedExportUser] = useState('');
  const [filterStaffId, setFilterStaffId] = useState('');

  // PDF Preview State
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
  const [pdfInstance, setPdfInstance] = useState(null);
  const [pdfDownloadName, setPdfDownloadName] = useState('');
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [showPdfPreviewModal, setShowPdfPreviewModal] = useState(false);

  // Departments from Database API
  const [dbDepartments, setDbDepartments] = useState([]);
  const [staffDirectory, setStaffDirectory] = useState([]);
  const [viewingStaffProfile, setViewingStaffProfile] = useState(null);
  const [loadingStaffProfile, setLoadingStaffProfile] = useState(false);

  useEffect(() => {
    const syncResponsiveView = () => setViewMode(window.innerWidth < 768 ? 'cards' : 'table');
    syncResponsiveView();
    window.addEventListener('resize', syncResponsiveView);
    return () => window.removeEventListener('resize', syncResponsiveView);
  }, []);

  useEffect(() => () => {
    if (pdfBlobUrl) window.URL.revokeObjectURL(pdfBlobUrl);
  }, [pdfBlobUrl]);

  useEffect(() => {
    api.get('/departments').then(res => {
      if (Array.isArray(res.data)) {
        setDbDepartments(res.data);
      }
    }).catch(() => {});
  }, []);

  const openStaffProfile = async (matrixRow) => {
    const rowId = String(matrixRow.id || matrixRow._id);
    const cached = staffDirectory.find(person => String(person.id || person._id) === rowId);
    setViewingStaffProfile(cached || {
      ...matrixRow,
      employee_code: matrixRow.code,
      position: matrixRow.role_label,
    });
    if (cached) return;

    setLoadingStaffProfile(true);
    try {
      const { data } = await api.get('/users?active_only=true');
      const users = Array.isArray(data) ? data : [];
      setStaffDirectory(users);
      const fullProfile = users.find(person => String(person.id || person._id) === rowId);
      if (fullProfile) setViewingStaffProfile(fullProfile);
    } catch {
      // Dữ liệu tóm tắt trong bảng vẫn đủ để modal hoạt động nếu danh bạ tạm thời lỗi.
    } finally {
      setLoadingStaffProfile(false);
    }
  };

  const departmentOptions = useMemo(() => {
    const set = new Set();
    dbDepartments.forEach(d => {
      if (d.name) set.add(d.name.trim());
    });
    if (matrixData?.staff_rows) {
      matrixData.staff_rows.forEach(r => {
        if (r.department_name) set.add(r.department_name.trim());
        if (Array.isArray(r.department_ids)) {
          r.department_ids.forEach(dName => {
            if (typeof dName === 'string' && dName.trim()) set.add(dName.trim());
            else if (dName?.name) set.add(dName.name.trim());
          });
        }
      });
    }
    return Array.from(set).sort();
  }, [dbDepartments, matrixData]);

  const displayedStaffRows = useMemo(() => {
    if (!matrixData?.staff_rows) return [];
    return matrixData.staff_rows.filter(r => {
      const q = searchQuery.trim().toLowerCase();
      const matchSearch = !q ||
        r.full_name?.toLowerCase().includes(q) ||
        r.code?.toLowerCase().includes(q);

      const staffDepts = [
        r.department_name,
        ...(Array.isArray(r.department_ids) ? r.department_ids.map(d => typeof d === 'string' ? d : d?.name) : [])
      ].filter(Boolean);

      const matchDept = !deptFilter || staffDepts.includes(deptFilter) || r.department_name === deptFilter;
      const matchAttendance = !attendanceFilter ||
        (attendanceFilter === 'late' && Number(r.late_count || 0) > 0) ||
        (attendanceFilter === 'early' && Number(r.early_count || 0) > 0) ||
        (attendanceFilter === 'ot' && Number(r.total_ot_hours || 0) > 0);
      const matchStaffType = !staffTypeFilter || r.employee_type === staffTypeFilter;

      return matchSearch && matchDept && matchAttendance && matchStaffType;
    });
  }, [matrixData, searchQuery, deptFilter, attendanceFilter, staffTypeFilter]);

  const pdfMatrixRows = useMemo(() => {
    const sourceRows = matrixData?.staff_rows || [];
    if (!filterStaffId) return sourceRows;
    return sourceRows.filter(row => String(row.id) === String(filterStaffId));
  }, [matrixData, filterStaffId]);

  useEffect(() => {
    if (viewMode !== 'table') return undefined;

    const scroller = matrixTableScrollRef.current;
    if (!scroller) return undefined;

    const updateScrollMetrics = () => {
      const rect = scroller.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const hasHorizontalOverflow = scroller.scrollWidth > scroller.clientWidth + 1;
      setMatrixScrollMetrics({
        scrollWidth: scroller.scrollWidth,
        clientWidth: scroller.clientWidth,
        left: Math.max(0, rect.left),
        width: Math.min(rect.width, window.innerWidth - Math.max(0, rect.left)),
        showFloating: hasHorizontalOverflow
          && rect.top < viewportHeight - 24
          && rect.bottom > viewportHeight,
      });
    };

    updateScrollMetrics();
    const frameId = window.requestAnimationFrame(updateScrollMetrics);
    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(updateScrollMetrics)
      : null;
    resizeObserver?.observe(scroller);
    if (scroller.firstElementChild) resizeObserver?.observe(scroller.firstElementChild);
    window.addEventListener('resize', updateScrollMetrics);
    window.addEventListener('scroll', updateScrollMetrics, { passive: true });

    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updateScrollMetrics);
      window.removeEventListener('scroll', updateScrollMetrics);
    };
  }, [matrixData, viewMode, tableDisplayMode, displayedStaffRows.length]);

  const syncMatrixScroll = (source, targetRef) => {
    const target = targetRef.current;
    if (target && Math.abs(target.scrollLeft - source.scrollLeft) > 1) {
      target.scrollLeft = source.scrollLeft;
    }
  };

  useEffect(() => {
    if (!matrixScrollMetrics.showFloating) return;
    const floatingScroller = matrixTopScrollRef.current;
    const tableScroller = matrixTableScrollRef.current;
    if (floatingScroller && tableScroller) {
      floatingScroller.scrollLeft = tableScroller.scrollLeft;
    }
  }, [matrixScrollMetrics.showFloating]);

  useEffect(() => {
    // Chỉ Admin mới xem các tab 2-5; Leader & Employee chỉ xem tab timesheet_lock
    if (isAdmin || tab === 'timesheet_lock') {
      loadTab();
    }
  }, [isAdmin, month, year, tab, selectedDetailUserId]);

  const loadTab = async () => {
    setLoading(true);
    try {
      if (tab === 'timesheet_lock') {
        const { data } = await api.get(`/timesheet-lock/full-matrix?month=${month}&year=${year}`);
        setMatrixData(data);
      } else if (tab === 'overview' && isAdmin) {
        const [rRes, tRes] = await Promise.all([
          api.get(`/reports/monthly?month=${month}&year=${year}`),
          api.get('/reports/trend?months=6'),
        ]);
        setReport(rRes.data);
        setTrend(tRes.data);
      } else if (tab === 'payroll' && isAdmin) {
        const { data } = await api.get(`/reports/payroll?month=${month}&year=${year}`);
        setPayroll(data);
      } else if (tab === 'ranking' && isAdmin) {
        const { data } = await api.get(`/reports/ranking?month=${month}&year=${year}`);
        setRanking(data);
      } else if (tab === 'individual_detail' && isAdmin) {
        const queryUser = selectedDetailUserId ? `&user_id=${selectedDetailUserId}` : '';
        const { data } = await api.get(`/reports/individual-detail?month=${month}&year=${year}${queryUser}`);
        setIndividualDetail(data);
      }
    } catch { toast.error('Lỗi tải dữ liệu'); }
    finally { setLoading(false); }
  };

  const prevMonth = () => {
    setMobileWeekIndex(0);
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    setMobileWeekIndex(0);
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  // Toggle Chốt Công Toàn Bộ Công Ty Hoặc Nhân Viên
  const triggerToggleLock = (userId = null, currentLocked = false) => {
    const actionText = currentLocked ? 'Mở chốt công' : 'Chốt công';
    const targetText = userId ? 'nhân viên này' : `toàn bộ công ty Tháng ${month}/${year}`;
    setLockConfirm({ userId, currentLocked, actionText, targetText });
  };

  const executeToggleLock = async () => {
    if (!lockConfirm) return;
    const { userId, currentLocked, actionText } = lockConfirm;
    try {
      await api.post('/timesheet-lock/toggle', {
        month,
        year,
        user_id: userId,
        is_locked: !currentLocked,
        note: `${actionText} bởi ${user.full_name}`,
      });
      toast.success(`Đã ${actionText} thành công! 🔒`);
      setLockConfirm(null);
      loadTab();
    } catch {
      toast.error('Lỗi chốt/mở chốt công');
    }
  };

  // Sửa Ô Công & Xác Nhận Giờ OT Có Ghi Lý Do
  const handleSaveCellOverride = async () => {
    if (!selectedCell) return;
    if (!cellReason.trim()) {
      toast.error('Vui lòng nhập Lý do chỉnh sửa công');
      return;
    }

    setSubmittingCell(true);
    try {
      const parsedOt = Math.max(0, parseFloat(cellOtHours) || 0);
      await api.post('/timesheet-lock/override-cell', {
        user_id: selectedCell.user_id,
        date: selectedCell.dateStr,
        new_symbol: cellSymbol,
        ot_hours: parsedOt,
        reason: cellReason.trim(),
      });
      toast.success(`Đã điều chỉnh ngày ${selectedCell.dateStr} thành [${cellSymbol}]${parsedOt > 0 ? ` (+${parsedOt}h OT)` : ''} & lưu lịch sử! ✅`);
      setSelectedCell(null);
      setCellReason('');
      setCellOtHours(0);
      loadTab();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Lỗi chỉnh sửa ô công');
    } finally {
      setSubmittingCell(false);
    }
  };

  // Tải Lịch Sử Audit Logs Chỉnh Sửa
  const fetchAuditLogs = async () => {
    setLoadingLogs(true);
    try {
      const { data } = await api.get(`/timesheet-lock/audit-logs?month=${month}&year=${year}`);
      setAuditLogs(Array.isArray(data) ? data : []);
      setShowAuditLogs(true);
    } catch {
      toast.error('Lỗi tải lịch sử chỉnh sửa');
    } finally {
      setLoadingLogs(false);
    }
  };

  // 1. Xuất Excel
  const exportExcel = async (targetUserId = null) => {
    try {
      const queryUser = targetUserId || (exportScope === 'single' ? selectedExportUser : '');
      const userObj = matrixData?.staff_rows?.find(s => s.id === queryUser);
      const safeName = userObj?.full_name?.replace(/[\\/:*?"<>|]/g, '').trim().replace(/\s+/g, '_');
      const fileNameSuffix = safeName ? `_${safeName}` : '';

      toast.loading(`Đang tạo file Excel mẫu ET_Staff ${year}...`, { id: 'excel' });
      const response = await api.get(`/export/excel?month=${month}&year=${year}${queryUser ? `&user_id=${queryUser}` : ''}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `ET_Staff_${year}_Thang_${String(month).padStart(2,'0')}${fileNameSuffix}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Đã tải file Excel Bảng Chấm Công thành công! 📊', { id: 'excel' });
      setShowExportModal(false);
    } catch {
      toast.error('Lỗi xuất Excel', { id: 'excel' });
    }
  };

  // 2. Xuất & Xem Trước File PDF Chuẩn A4 Sắc Nét (jsPDF High-Def Offscreen Renderer)
  const handleGeneratePdfPreview = async (targetUserId = null) => {
    const isIndividual = exportTarget === 'individual';
    const queryUser = targetUserId || (exportScope === 'single' ? selectedExportUser : '');
    if (isIndividual && !queryUser) {
      toast.error('Vui lòng chọn nhân sự cần xuất phiếu cá nhân');
      return;
    }

    const userObj = matrixData?.staff_rows?.find(s => String(s.id) === String(queryUser));
    const safeName = userObj?.full_name?.replace(/[\\/:*?"<>|]/g, '').trim().replace(/\s+/g, '_');
    setPdfDownloadName(`Bang_Cong_Thang_${String(month).padStart(2, '0')}_${year}${safeName ? `_${safeName}` : '_Toan_Cong_Ty'}.pdf`);
    setFilterStaffId(queryUser);
    setShowExportModal(false);
    setGeneratingPdf(true);
    toast.loading(isIndividual ? 'Đang tạo phiếu chấm công cá nhân...' : 'Đang tạo bảng công PDF toàn công ty...', { id: 'pdf' });

    if (isIndividual) {
      try {
        const { data } = await api.get(`/reports/individual-detail?month=${month}&year=${year}&user_id=${queryUser}`);
        setIndividualDetail(data);
      } catch (err) {
        toast.error(err?.response?.data?.error || 'Không tải được dữ liệu phiếu cá nhân', { id: 'pdf' });
        setGeneratingPdf(false);
        setFilterStaffId('');
        return;
      }
    }

    const printEl = isIndividual ? pdfIndividualPrintRef.current : pdfMatrixPrintRef.current;

    if (!printEl) {
      toast.error('Chưa sẵn sàng mẫu PDF', { id: 'pdf' });
      setGeneratingPdf(false);
      return;
    }

    setTimeout(async () => {
      try {
        const canvas = await html2canvas(printEl, {
          scale: 2.5, // 2.5x ultra-sharp resolution
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false,
          windowWidth: isIndividual ? 1000 : 2200,
          scrollX: 0,
          scrollY: 0,
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.96);
        const orientation = isIndividual ? 'p' : 'l'; // portrait vs landscape
        const pdf = new jsPDF(orientation, 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();

        const margin = 5; // 5mm margin around PDF page
        const printableWidth = pdfWidth - (margin * 2);
        const imgProps = pdf.getImageProperties(imgData);
        const imgHeight = (imgProps.height * printableWidth) / imgProps.width;

        let heightLeft = imgHeight;
        let position = margin;

        pdf.addImage(imgData, 'JPEG', margin, position, printableWidth, imgHeight);
        heightLeft -= (pdfHeight - (margin * 2));

        while (heightLeft >= 10) {
          position = heightLeft - imgHeight + margin;
          pdf.addPage();
          pdf.addImage(imgData, 'JPEG', margin, position, printableWidth, imgHeight);
          heightLeft -= (pdfHeight - (margin * 2));
        }

        const blobUrl = pdf.output('bloburl');
        setPdfBlobUrl(blobUrl);
        setPdfInstance(pdf);
        setShowPdfPreviewModal(true);
        toast.success('Đã tạo xong file PDF A4 sắc nét! 📄', { id: 'pdf' });
      } catch (err) {
        console.error('PDF error:', err);
        toast.error('Lỗi tạo file PDF bảng công', { id: 'pdf' });
      } finally {
        setGeneratingPdf(false);
        setFilterStaffId('');
      }
    }, 200);
  };

  // Thực thi nút Nộp trong Modal Xuất Bảng Công
  const handleExecuteExport = () => {
    if ((exportTarget === 'individual' || exportScope === 'single') && !selectedExportUser) {
      toast.error('Vui lòng chọn nhân sự cần xuất');
      return;
    }
    if (exportTarget === 'individual' && exportFormat !== 'pdf') {
      toast.error('Phiếu cá nhân hiện được xuất ở định dạng PDF');
      return;
    }
    if (exportFormat === 'excel') {
      exportExcel(exportScope === 'single' ? selectedExportUser : null);
    } else {
      handleGeneratePdfPreview(exportScope === 'single' ? selectedExportUser : null);
    }
  };

  const openExportDialog = () => {
    setExportTarget('matrix');
    setExportFormat('pdf');
    setExportScope('all');
    setSelectedExportUser('');
    setShowExportModal(true);
  };

  // Tải File PDF Về Máy
  const handleDownloadPdf = () => {
    if (!pdfInstance) return;
    pdfInstance.save(pdfDownloadName || `Bang_Cong_Thang_${String(month).padStart(2, '0')}_${year}.pdf`);
    toast.success('Đã tải file PDF bảng công về máy thành công! 📥');
  };

  // In Bảng Chi Tiết Cá Nhân
  const handlePrintIndividual = () => {
    window.print();
  };

  const indUser = individualDetail?.user || {};
  const indSum = individualDetail?.summary || {};
  const indLogs = individualDetail?.daily_logs || [];
  const lc = indSum.leave_counts || {};

  // Không còn chặn nhân viên — employee xem bảng công toàn cty ở chế độ read-only

  return (
    <div className="page">
      {/* Header */}
      <div className="header">
        <div className="header__inner">
          <div>
            <div className="header__title">Bảng chấm công nhân sự</div>
            <div className="header__subtitle">Theo dõi công, chuyên cần và OT toàn công ty · Tháng {month}/{year}</div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            {isAdmin && (
              <button onClick={openExportDialog} disabled={generatingPdf} className="btn btn--primary" style={{ padding: '8px 16px', fontSize: '13px', gap: '6px' }}>
                {generatingPdf ? <span className="spinner" /> : <><Download size={16} /> 📥 Xuất Bảng Công (PDF/Excel)</>}
              </button>
            )}
            <HeaderActions />
          </div>
        </div>
      </div>

      <div className="container" style={{ paddingTop: '16px' }}>
        {/* Admin analysis tabs */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: isAdmin ? '10px' : '0', flexWrap: 'wrap', gap: '8px' }}>
          {/* Navigation Tabs — Chỉ Admin mới thấy các tab phân tích (Leader & Employee chỉ xem Bảng Chấm Công) */}
          {isAdmin && (
            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto' }}>
              <button onClick={() => setTab('timesheet_lock')} className={`chip${tab === 'timesheet_lock' ? ' active' : ''}`}>
                <Lock size={13} /> Bảng Chấm Công
              </button>
              <button onClick={() => setTab('overview')} className={`chip${tab === 'overview' ? ' active' : ''}`}>
                <BarChart3 size={13} /> Tổng quan
              </button>
            </div>
          )}
        </div>

        {/* TAB 1: 🔒 CHỐT CÔNG MẪU THỦ CÔNG ET_STAFF 2026 */}
        {tab === 'timesheet_lock' && (
          <div>
            {/* Action Bar & Lock Status */}
            <div className="card timesheet-filter-card" style={{ padding: '12px 16px', marginBottom: '14px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              {/* Nút chốt/mở chốt, trạng thái & lịch sử sửa — chỉ Admin mới thấy */}
              {isAdmin && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '12px', paddingBottom: '10px', borderBottom: '1px solid var(--border-muted)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span className={`badge ${matrixData?.global_locked ? 'badge--danger' : 'badge--success'}`} style={{ fontSize: '13px', padding: '6px 14px', fontWeight: 800, borderRadius: '8px' }}>
                      {matrixData?.global_locked ? '🔒 ĐÃ CHỐT CÔNG THÁNG' : '🔓 BẢNG CÔNG CHƯA CHỐT'}
                    </span>
                    {matrixData?.global_lock_info && (
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        Chốt bởi <strong>{matrixData.global_lock_info.locked_by_name}</strong> lúc {new Date(matrixData.global_lock_info.locked_at).toLocaleString('vi-VN')}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button
                      onClick={() => triggerToggleLock(null, matrixData?.global_locked)}
                      className={`btn ${matrixData?.global_locked ? 'btn--ghost' : 'btn--primary'}`}
                      style={{ padding: '6px 12px', fontSize: '12px' }}
                    >
                      {matrixData?.global_locked ? <><Unlock size={14} /> Mở chốt công</> : <><Lock size={14} /> Chốt công tháng</>}
                    </button>
                    <button
                      onClick={fetchAuditLogs}
                      className="btn btn--ghost"
                      style={{ padding: '6px 12px', fontSize: '12px', borderColor: 'var(--primary)', color: 'var(--primary)' }}
                    >
                      <History size={14} /> Lịch sử sửa công
                    </button>
                  </div>
                </div>
              )}

              {/* Quick Matrix Filter Bar & View Mode Toggle */}
              <div className="timesheet-toolbar" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
                <div className="timesheet-toolbar__filters" style={{ display: 'flex', gap: '8px', flex: 1, minWidth: '240px', flexWrap: 'wrap' }}>
                  <div className="timesheet-toolbar__month">
                    <button onClick={prevMonth} type="button" aria-label="Tháng trước"><ChevronLeft size={16} /></button>
                    <strong>{MONTHS[month - 1]} {year}</strong>
                    <button onClick={nextMonth} type="button" aria-label="Tháng sau"><ChevronRight size={16} /></button>
                  </div>
                  <div style={{ position: 'relative', flex: 1, minWidth: '160px' }}>
                    <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                    <input
                      type="text"
                      className="form-input"
                      style={{ paddingLeft: '30px', padding: '6px 10px 6px 30px', fontSize: '12px' }}
                      placeholder="Tìm tên, mã nhân sự..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                    />
                  </div>
                  {departmentOptions.length > 0 && (
                    <select
                      className="form-input"
                      style={{ width: 'auto', padding: '6px 10px', fontSize: '12px', minWidth: '130px' }}
                      value={deptFilter}
                      onChange={e => setDeptFilter(e.target.value)}
                    >
                      <option value="">Tất cả phòng ban</option>
                      {departmentOptions.map((dept, idx) => (
                        <option key={idx} value={dept}>{dept}</option>
                      ))}
                    </select>
                  )}

                  <select
                    className="form-input"
                    style={{ width: 'auto', padding: '6px 10px', fontSize: '12px', minWidth: '132px' }}
                    value={attendanceFilter}
                    onChange={e => setAttendanceFilter(e.target.value)}
                    aria-label="Lọc chuyên cần"
                  >
                    <option value="">Tất cả chuyên cần</option>
                    <option value="late">Có đi muộn</option>
                    <option value="early">Có về sớm</option>
                    <option value="ot">Có tăng ca OT</option>
                  </select>

                  <select
                    className="form-input"
                    style={{ width: 'auto', padding: '6px 10px', fontSize: '12px', minWidth: '130px' }}
                    value={staffTypeFilter}
                    onChange={e => setStaffTypeFilter(e.target.value)}
                    aria-label="Lọc loại nhân sự"
                  >
                    <option value="">Tất cả nhân sự</option>
                    <option value="NS">Nhân sự chính thức</option>
                    <option value="TV">Thử việc</option>
                    <option value="TTS">Thực tập sinh</option>
                  </select>

                  {(searchQuery || deptFilter || attendanceFilter || staffTypeFilter) && (
                    <button
                      onClick={() => { setSearchQuery(''); setDeptFilter(''); setAttendanceFilter(''); setStaffTypeFilter(''); }}
                      className="btn btn--ghost"
                      style={{ padding: '4px 8px', fontSize: '11px' }}
                    >
                      Xóa lọc
                    </button>
                  )}
                </div>

              </div>
            </div>

            {matrixData?.staff_rows && (() => {
              const totalOffice = displayedStaffRows.reduce((sum, row) => sum + Number(row.nlv_office || 0), 0);
              const totalOt = displayedStaffRows.reduce((sum, row) => sum + Number(row.total_ot_hours || 0), 0);
              const totalLate = displayedStaffRows.reduce((sum, row) => sum + Number(row.late_count || 0), 0);
              const totalEarly = displayedStaffRows.reduce((sum, row) => sum + Number(row.early_count || 0), 0);
              const sundayCount = (matrixData.header_days || []).filter(day => day.isSunday || day.weekday === 'CN').length;
              const standardDays = matrixData.standard_working_days || ((matrixData.days_in_month || 31) - sundayCount);
              const stats = [
                { label: 'Nhân sự hiển thị', value: displayedStaffRows.length, unit: 'người', tone: 'blue', icon: '👥' },
                { label: 'Ngày công chuẩn', value: standardDays, unit: 'ngày', tone: 'slate', icon: '▦' },
                { label: 'Tổng công văn phòng', value: totalOffice.toFixed(2), unit: '', tone: 'green', icon: '🏢' },
                { label: 'Tổng giờ OT', value: `${totalOt.toFixed(1)}h`, unit: '', tone: 'purple', icon: '↗' },
                { label: 'Lượt đi muộn', value: totalLate, unit: '', tone: 'amber', icon: '⏱' },
                { label: 'Lượt về sớm', value: totalEarly, unit: '', tone: 'red', icon: '↙' },
              ];
              return (
                <div className="timesheet-stats" aria-label="Tổng quan bảng chấm công">
                  {stats.map(stat => (
                    <div key={stat.label} className={`timesheet-stat timesheet-stat--${stat.tone}`}>
                      <span className="timesheet-stat__label">{stat.label}</span>
                      <div className="timesheet-stat__content"><div><strong>{stat.value}</strong><small>{stat.unit}</small></div><i>{stat.icon}</i></div>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Helper UI functions for Timesheet Matrix */}
            {(() => {
              const renderSummaryVal = (val, color) => {
                if (!val || val === 0) {
                  return <span style={{ opacity: 0.2, color: 'var(--text-muted)', fontWeight: 500 }}>—</span>;
                }
                return (
                  <span style={{
                    fontWeight: 800, color: color, padding: '2px 6px',
                    borderRadius: '6px', background: `${color}1e`, fontSize: '11px', display: 'inline-block'
                  }}>
                    {val.toFixed(2)}
                  </span>
                );
              };

              const renderDaySymbol = (symbol, isWeekend) => {
                if (isWeekend) return null;
                if (!symbol || symbol === '—') {
                  return <span style={{ opacity: isWeekend ? 0.15 : 0.25, color: 'var(--text-muted)' }}>—</span>;
                }

                let bg = 'transparent';
                let color = 'var(--text)';

                if (symbol === 'x' || symbol === '1.0x') {
                  bg = 'var(--green-soft)'; color = 'var(--green)';
                } else if (symbol === '0,75x' || symbol === '0.75x') {
                  bg = 'var(--green-soft)'; color = 'var(--green)';
                } else if (symbol === '0,5x' || symbol === '0.5x') {
                  bg = 'var(--yellow-soft)'; color = 'var(--yellow)';
                } else if (symbol === 'CT1') {
                  bg = 'var(--blue-soft)'; color = 'var(--blue)';
                } else if (symbol === 'CT2') {
                  bg = 'rgba(139, 92, 246, 0.15)'; color = '#8b5cf6';
                } else if (symbol === 'WFH') {
                  bg = 'rgba(6, 182, 212, 0.15)'; color = '#06b6d4';
                } else if (symbol === 'P') {
                  bg = 'rgba(139, 92, 246, 0.15)'; color = '#8b5cf6';
                } else if (symbol === 'O') {
                  bg = 'var(--red-soft)'; color = 'var(--red)';
                } else if (symbol === 'KL') {
                  bg = 'rgba(100, 116, 139, 0.15)'; color = 'var(--text-muted)';
                } else if (symbol === 'L') {
                  bg = 'rgba(236, 72, 153, 0.15)'; color = '#db2777';
                }

                return (
                  <span className="timesheet-day-symbol" style={{ background: bg, color }}>
                    {symbol}
                  </span>
                );
              };

              if (loading) {
                return <div className="skeleton-card" style={{ height: '300px', borderRadius: '16px' }} />;
              }

              if (!matrixData || !matrixData.staff_rows) {
                return <div className="card empty-state"><div className="empty-state__title">Không có dữ liệu chốt công</div></div>;
              }

              const showSummaryColumns = tableDisplayMode !== 'days';
              const showDayColumns = tableDisplayMode !== 'summary';
              const weekdaySlot = { T2: 0, T3: 1, T4: 2, T5: 3, T6: 4, T7: 5, CN: 6 };
              const mobileWeeks = [];
              let currentWeek = Array(7).fill(null);
              (matrixData.header_days || []).forEach((headerDay, index) => {
                const slot = weekdaySlot[headerDay.weekday];
                if (slot === undefined) return;
                currentWeek[slot] = headerDay;
                if (slot === 6 || index === matrixData.header_days.length - 1) {
                  mobileWeeks.push(currentWeek);
                  currentWeek = Array(7).fill(null);
                }
              });
              const safeMobileWeekIndex = Math.min(mobileWeekIndex, Math.max(0, mobileWeeks.length - 1));
              const selectedMobileWeek = mobileWeeks[safeMobileWeekIndex] || [];
              const mobileWeekDays = selectedMobileWeek.filter(Boolean);
              const mobileWeekLabel = mobileWeekDays.length
                ? `${String(mobileWeekDays[0].day).padStart(2, '0')}–${String(mobileWeekDays[mobileWeekDays.length - 1].day).padStart(2, '0')}/${String(month).padStart(2, '0')}`
                : `Tháng ${month}`;

              return (
                <div>
                  {/* CHẾ ĐỘ 1: DẠNG THẺ GỌN TỐI ƯU CHO MOBILE (CARDS VIEW) */}
                  {viewMode === 'cards' && (
                    <div className="animate-fade-in">
                      {/* Multi-card expand / collapse buttons */}
                      <div className="timesheet-card-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', marginBottom: '10px' }}>
                        <button
                          onClick={() => setExpandedStaffIds(new Set(displayedStaffRows.map(r => r.id)))}
                          className="btn btn--ghost"
                          style={{ fontSize: '11px', padding: '3px 8px', color: 'var(--primary)', fontWeight: 600 }}
                          title="Mở rộng tất cả lịch chấm công của nhân sự"
                        >
                          📂 Mở tất cả
                        </button>
                        <button
                          onClick={() => setExpandedStaffIds(new Set())}
                          className="btn btn--ghost"
                          style={{ fontSize: '11px', padding: '3px 8px', color: 'var(--text-muted)' }}
                          title="Thu gọn toàn bộ lịch chấm công"
                        >
                          📁 Thu gọn
                        </button>
                      </div>

                      <div className="timesheet-mobile-week-nav">
                        <button type="button" onClick={() => setMobileWeekIndex(index => Math.max(0, index - 1))} disabled={safeMobileWeekIndex === 0} aria-label="Tuần trước">
                          <ChevronLeft size={16} />
                        </button>
                        <div>
                          <strong>Tuần {safeMobileWeekIndex + 1}</strong>
                          <span>{mobileWeekLabel}</span>
                        </div>
                        <button type="button" onClick={() => setMobileWeekIndex(index => Math.min(mobileWeeks.length - 1, index + 1))} disabled={safeMobileWeekIndex >= mobileWeeks.length - 1} aria-label="Tuần sau">
                          <ChevronRight size={16} />
                        </button>
                      </div>

                      {/* Staff Cards List */}
                      <div className="timesheet-staff-card-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '12px' }}>
                        {displayedStaffRows.map((r) => {
                          const isExpanded = expandedStaffIds.has(r.id);

                          return (
                            <div key={r.id} className="card timesheet-staff-card" style={{ padding: '14px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', transition: 'all 0.2s ease' }}>
                              {/* Staff Header Row */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
                                <button type="button" className="timesheet-person-button" onClick={() => openStaffProfile(r)} aria-label={`Xem hồ sơ ${r.full_name}`}>
                                    <img
                                      src={r.avatar_url || '/logo.png'}
                                      alt={r.full_name}
                                      style={{ width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '2px solid var(--border)' }}
                                      onError={e => { e.target.src = '/logo.png'; }}
                                    />
                                  <div style={{ minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                      <span style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text)' }}>{r.full_name}</span>
                                      <span style={{ fontSize: '10px', fontWeight: 800, padding: '1px 6px', borderRadius: '4px', background: 'var(--primary-soft)', color: 'var(--primary)' }}>
                                        {r.code}
                                      </span>
                                      {r.is_attendance_exempt && (
                                        <span style={{ fontSize: '10px', fontWeight: 800, padding: '1px 6px', borderRadius: '4px', background: 'rgba(99, 102, 241, 0.15)', color: 'var(--primary)' }}>
                                          🛡️ Miễn chấm
                                        </span>
                                      )}
                                    </div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                      {r.department_name || r.role_label}
                                    </div>
                                  </div>
                                </button>

                                {/* Main Work Metric */}
                                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                  <div style={{ fontSize: '18px', fontWeight: 900, color: 'var(--green)' }}>
                                    {(r.nlv_office || 0).toFixed(2)}
                                    <span style={{ fontSize: '11px', fontWeight: 600, marginLeft: '3px' }}>công</span>
                                  </div>
                                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Công VP</div>
                                </div>
                              </div>

                              <div className="timesheet-mobile-weekstrip">
                                {selectedMobileWeek.map((headerDay, slot) => {
                                  if (!headerDay) return <div key={`empty-${slot}`} className="timesheet-mobile-day is-empty" />;
                                  const dayData = r.days.find(day => day.day === headerDay.day);
                                  const isSunday = headerDay.weekday === 'CN' || headerDay.isSunday;
                                  return (
                                    <button
                                      type="button"
                                      key={headerDay.day}
                                      className={`timesheet-mobile-day${isSunday ? ' is-sunday' : ''}`}
                                      disabled={isSunday}
                                      onClick={() => {
                                        if (!dayData || isSunday) return;
                                        setSelectedCell({
                                          user_id: r.id, staff_name: r.full_name, staff_code: r.code,
                                          department_name: r.department_name, dateStr: dayData.dateStr,
                                          day: dayData.day, weekday: headerDay.weekday,
                                          current_symbol: dayData.symbol, check_in_time: dayData.check_in_time,
                                          check_out_time: dayData.check_out_time, total_hours: dayData.total_hours,
                                          ot_hours: dayData.ot_hours, is_late: dayData.is_late,
                                          late_minutes: dayData.late_minutes, is_early_leave: dayData.is_early_leave,
                                          early_minutes: dayData.early_minutes, status: dayData.status,
                                          notes: dayData.notes, check_in_type: dayData.check_in_type,
                                          is_modified: dayData.is_modified, audit_logs: dayData.audit_logs || [],
                                          is_locked: r.is_locked,
                                        });
                                        setCellSymbol(dayData.symbol || 'x');
                                        setCellOtHours(dayData.ot_hours || 0);
                                        setCellReason('');
                                      }}
                                      aria-label={`${r.full_name}, ngày ${headerDay.day}: ${isSunday ? 'Chủ nhật để trống' : dayData?.symbol || 'Trống'}`}
                                    >
                                      <span>{headerDay.weekday}<small>{String(headerDay.day).padStart(2, '0')}</small></span>
                                      <b>{isSunday ? '' : renderDaySymbol(dayData?.symbol, false)}</b>
                                    </button>
                                  );
                                })}
                              </div>

                              {/* Metric Pills Grid */}
                              <div className="timesheet-card-metrics" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', padding: '8px', background: 'var(--bg-raised)', borderRadius: '8px', marginBottom: '10px', textAlign: 'center' }}>
                                <div>
                                  <div style={{ color: 'var(--text-muted)', fontSize: '10px' }}>CT1</div><div style={{ fontWeight: 800, fontSize: '12px', marginTop: '2px' }}>{r.ct_domestic || 0}</div>
                                </div>
                                <div>
                                  <div style={{ color: 'var(--text-muted)', fontSize: '10px' }}>CT2</div><div style={{ fontWeight: 800, fontSize: '12px', marginTop: '2px' }}>{r.ct_foreign || 0}</div>
                                </div>
                                <div>
                                  <div style={{ color: 'var(--text-muted)', fontSize: '10px' }}>WFH</div><div style={{ fontWeight: 800, fontSize: '12px', marginTop: '2px' }}>{r.wfh || 0}</div>
                                </div>
                                <div>
                                  <div style={{ color: 'var(--text-muted)', fontSize: '10px' }}>Phép</div><div style={{ fontWeight: 800, fontSize: '12px', marginTop: '2px' }}>{r.annual_leave || 0}</div>
                                </div>
                                <div>
                                  <div style={{ color: 'var(--text-muted)', fontSize: '10px' }}>Ốm</div><div style={{ fontWeight: 800, fontSize: '12px', marginTop: '2px' }}>{r.sick_leave || 0}</div>
                                </div>
                                <div>
                                  <div style={{ color: 'var(--text-muted)', fontSize: '10px' }}>KL / K</div><div style={{ fontWeight: 800, fontSize: '12px', marginTop: '2px' }}>{r.unpaid_leave || 0} / {r.other_leave || 0}</div>
                                </div>
                                <div>
                                  <div style={{ color: 'var(--text-muted)', fontSize: '10px' }}>Muộn / Sớm</div><div style={{ fontWeight: 800, fontSize: '12px', marginTop: '2px' }}>{r.late_count || 0} / {r.early_count || 0}</div>
                                </div>
                                <div>
                                  <div style={{ color: 'var(--text-muted)', fontSize: '10px' }}>OT</div><div style={{ fontWeight: 800, fontSize: '12px', marginTop: '2px' }}>{r.total_ot_hours || 0}h</div>
                                </div>
                              </div>

                              {/* Expandable Daily Details Grid */}
                              <div>
                                <button
                                  onClick={() => {
                                    setExpandedStaffIds(prev => {
                                      const next = new Set(prev);
                                      if (next.has(r.id)) next.delete(r.id);
                                      else next.add(r.id);
                                      return next;
                                    });
                                  }}
                                  className="btn btn--ghost btn--full"
                                  style={{ padding: '6px 10px', fontSize: '11px', justifyContent: 'space-between', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                                >
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Calendar size={13} color="var(--primary)" />
                                    {isExpanded ? 'Thu gọn cả tháng' : 'Xem cả tháng'}
                                  </span>
                                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                </button>

                                {isExpanded && (
                                  <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed var(--border)' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(40px, 1fr))', gap: '4px' }}>
                                      {r.days.map(d => {
                                        const hdObj = matrixData.header_days.find(hd => hd.day === d.day);
                                        const isSun = hdObj?.weekday === 'CN' || hdObj?.isSunday;
                                        const isModified = d.is_modified;
                                        const isLate = d.is_late;
                                        const hasOt = d.ot_hours > 0;

                                        // Phân biệt màu sắc trực quan theo từng loại công
                                        let bg = 'var(--bg-raised)';
                                        let border = isSun ? '1px solid rgba(239, 68, 68, 0.25)' : '1px solid var(--border)';
                                        let dayColor = isSun ? '#ef4444' : 'var(--text-muted)';
                                        let symbolColor = 'var(--text-muted)';
                                        let cellOpacity = 0.45;

                                        if (d.symbol && d.symbol !== '—') {
                                          cellOpacity = 1;
                                          dayColor = isSun ? '#ef4444' : 'var(--text-secondary)';

                                          if (d.symbol === 'x' || d.symbol === '1.0x') {
                                            bg = 'rgba(16, 185, 129, 0.08)';
                                            border = '1px solid rgba(16, 185, 129, 0.35)';
                                            symbolColor = '#10b981';
                                          } else if (d.symbol === '0,75x' || d.symbol === '0.75x') {
                                            bg = 'rgba(16, 185, 129, 0.08)';
                                            border = '1px solid rgba(16, 185, 129, 0.35)';
                                            symbolColor = '#059669';
                                          } else if (d.symbol === '0,5x' || d.symbol === '0.5x') {
                                            bg = 'rgba(245, 158, 11, 0.08)';
                                            border = '1px solid rgba(245, 158, 11, 0.35)';
                                            symbolColor = '#d97706';
                                          } else if (d.symbol === 'CT1') {
                                            bg = 'rgba(59, 130, 246, 0.08)';
                                            border = '1px solid rgba(59, 130, 246, 0.35)';
                                            symbolColor = '#3b82f6';
                                          } else if (d.symbol === 'CT2') {
                                            bg = 'rgba(139, 92, 246, 0.08)';
                                            border = '1px solid rgba(139, 92, 246, 0.35)';
                                            symbolColor = '#8b5cf6';
                                          } else if (d.symbol === 'WFH') {
                                            bg = 'rgba(6, 182, 212, 0.08)';
                                            border = '1px solid rgba(6, 182, 212, 0.35)';
                                            symbolColor = '#06b6d4';
                                          } else if (d.symbol === 'P') {
                                            bg = 'rgba(139, 92, 246, 0.08)';
                                            border = '1px solid rgba(139, 92, 246, 0.35)';
                                            symbolColor = '#8b5cf6';
                                          } else if (d.symbol === 'O') {
                                            bg = 'rgba(239, 68, 68, 0.08)';
                                            border = '1px solid rgba(239, 68, 68, 0.35)';
                                            symbolColor = '#ef4444';
                                          } else if (d.symbol === 'KL' || d.symbol === 'K') {
                                            bg = 'rgba(100, 116, 139, 0.08)';
                                            border = '1px solid rgba(100, 116, 139, 0.3)';
                                            symbolColor = '#64748b';
                                          } else if (d.symbol === 'L') {
                                            bg = 'rgba(236, 72, 153, 0.12)';
                                            border = '1px solid rgba(236, 72, 153, 0.4)';
                                            symbolColor = '#db2777';
                                          }
                                        } else if (hdObj?.isHoliday) {
                                          bg = 'rgba(236, 72, 153, 0.08)';
                                          dayColor = '#db2777';
                                        } else if (isSun) {
                                          bg = 'rgba(239, 68, 68, 0.05)';
                                        }

                                        if (isModified) {
                                          border = '1.5px solid #f59e0b';
                                        }

                                        return (
                                          <div
                                            key={d.day}
                                            onClick={() => {
                                              if (isSun) return;
                                              setSelectedCell({
                                                user_id: r.id,
                                                staff_name: r.full_name,
                                                staff_code: r.code,
                                                department_name: r.department_name,
                                                dateStr: d.dateStr,
                                                day: d.day,
                                                weekday: hdObj?.weekday,
                                                current_symbol: d.symbol,
                                                check_in_time: d.check_in_time,
                                                check_out_time: d.check_out_time,
                                                total_hours: d.total_hours,
                                                ot_hours: d.ot_hours,
                                                is_late: d.is_late,
                                                late_minutes: d.late_minutes,
                                                status: d.status,
                                                notes: d.notes,
                                                check_in_type: d.check_in_type,
                                                is_modified: d.is_modified,
                                                audit_logs: d.audit_logs || [],
                                                is_locked: r.is_locked
                                              });
                                              setCellSymbol(d.symbol || 'x');
                                              setCellOtHours(d.ot_hours || 0);
                                              setCellReason('');
                                            }}
                                            style={{
                                              padding: '4px 2px',
                                              textAlign: 'center',
                                              borderRadius: '6px',
                                              background: bg,
                                              border: border,
                                              opacity: cellOpacity,
                                              cursor: !isSun ? 'pointer' : 'default',
                                              transition: 'all 0.15s ease'
                                            }}
                                            title={isSun ? `${d.dateStr}: Chủ nhật để trống` : `${d.dateStr}: [${d.symbol || 'Không công'}]${d.is_late ? ` (⚠️ Muộn ${d.late_minutes}p)` : ''}${d.is_early_leave ? ` (🚪 Sớm ${d.early_minutes}p)` : ''}${hasOt ? ` (🔥 OT: ${d.ot_hours}h)` : ''}`}
                                          >
                                            <div style={{ fontSize: '9px', fontWeight: 600, color: dayColor }}>{d.day}</div>
                                            <div style={{ fontSize: '11px', fontWeight: 800, color: symbolColor, marginTop: '1px' }}>
                                              {isSun ? '' : (d.symbol || '—')}
                                            </div>
                                            {!isSun && (isLate || hasOt) && (
                                              <div style={{ display: 'flex', justifyContent: 'center', gap: '2px', marginTop: '1px' }}>
                                                {isLate && <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#ef4444' }} />}
                                                {hasOt && <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#8b5cf6' }} />}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>

                                    {/* Mini Legend Chú Thích Màu */}
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px', padding: '6px 8px', background: 'var(--bg-raised)', borderRadius: '6px', fontSize: '10px', color: 'var(--text-secondary)' }}>
                                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                        <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#10b981' }} /> x: Đủ công
                                      </span>
                                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                        <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#06b6d4' }} /> WFH
                                      </span>
                                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                        <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#3b82f6' }} /> CT1/CT2
                                      </span>
                                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                        <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#8b5cf6' }} /> P: Nghỉ phép
                                      </span>
                                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                        <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#ef4444' }} /> O: Nghỉ ốm
                                      </span>
                                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                        <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#d97706' }} /> 0.5x
                                      </span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* 📊 VIEW MODE: TABLE (Full 31-day Horizontal Spreadsheet) */}
                  {viewMode === 'table' && (
                    <div className="timesheet-table-region">
                      {matrixScrollMetrics.showFloating && (
                        <div
                          ref={matrixTopScrollRef}
                          className="timesheet-top-scrollbar"
                          onScroll={event => syncMatrixScroll(event.currentTarget, matrixTableScrollRef)}
                          aria-label="Cuộn ngang bảng chấm công"
                          style={{
                            left: `${matrixScrollMetrics.left}px`,
                            width: `${matrixScrollMetrics.width}px`,
                          }}
                        >
                          <div style={{ width: `${matrixScrollMetrics.scrollWidth}px`, height: '1px' }} />
                        </div>
                      )}
                    <div
                      ref={matrixTableScrollRef}
                      className="timesheet-table-shell"
                      onScroll={event => syncMatrixScroll(event.currentTarget, matrixTopScrollRef)}
                      style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '16px', background: 'var(--bg-card)' }}
                    >
                      {/* Corporate Timesheet Banner */}
                      <div className="timesheet-banner-compact timesheet-board-head" style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                        <div>
                          <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span>Tháng {String(month).padStart(2, '0')} / {year}</span>
                          </div>
                          {(() => {
                            const sunCount = matrixData.header_days ? matrixData.header_days.filter(h => h.isSunday || h.weekday === 'CN').length : 0;
                            const stdDays = matrixData.standard_working_days || ((matrixData.days_in_month || 31) - sunCount);
                            return (
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <span>{displayedStaffRows.length} nhân sự · {stdDays} ngày công chuẩn · Chọn chế độ phù hợp để bảng dễ đối chiếu hơn</span>
                              </div>
                            );
                          })()}
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          <div style={{ display: 'inline-flex', gap: '2px', padding: '3px', border: '1px solid var(--border)', borderRadius: '9px', background: 'var(--bg-card)' }} aria-label="Chế độ hiển thị bảng công">
                            {[
                              ['days', 'Ngày công'],
                              ['summary', 'Tổng hợp'],
                              ['full', 'Đầy đủ'],
                            ].map(([mode, label]) => (
                              <button
                                key={mode}
                                type="button"
                                onClick={() => setTableDisplayMode(mode)}
                                aria-pressed={tableDisplayMode === mode}
                                style={{
                                  minHeight: '30px', padding: '4px 10px', border: 0, borderRadius: '7px', cursor: 'pointer',
                                  background: tableDisplayMode === mode ? 'var(--primary)' : 'transparent',
                                  color: tableDisplayMode === mode ? '#fff' : 'var(--text-muted)',
                                  fontSize: '10px', fontWeight: 800,
                                }}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                          <div className="timesheet-legend">
                            <span className="timesheet-legend__item is-green"><i />x · 0,5x · 0,75x</span>
                            <span className="timesheet-legend__item is-blue"><i />CT1 · CT2 · WFH</span>
                            <span className="timesheet-legend__item is-purple"><i />P · O · KL · K</span>
                            <span className="timesheet-legend__item is-red"><i />CN để trống</span>
                          </div>
                          {matrixData.global_locked && (
                            <span className="badge badge--warning" style={{ fontSize: '11px' }}>
                              🔒 Đã chốt công
                            </span>
                          )}
                        </div>
                      </div>

                      <table className="timesheet-matrix" style={{ width: 'max-content', minWidth: '100%', fontSize: '11px', borderCollapse: 'separate', borderSpacing: 0, textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <thead>
                          {/* Row 1 Header: Titles & Weekdays with Sticky Columns */}
                          <tr style={{ background: 'var(--bg-raised)', color: 'var(--text)', fontWeight: 800 }}>
                            <th className="table-sticky-col-1" style={{ padding: '6px 10px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>NHÂN SỰ</th>
                            <th style={{ padding: '6px 8px', minWidth: '104px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>PHÒNG BAN</th>
                            <th style={{ padding: '6px 8px', minWidth: '75px', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>CHỨC VỤ</th>

                            {/* Summary Columns Header */}
                            {showSummaryColumns && <>
                              <th title="Công tại văn phòng">VP</th>
                              <th title="Công tác trong nước">CT1</th>
                              <th title="Công tác nước ngoài">CT2</th>
                              <th title="Làm việc tại nhà">WFH</th>
                              <th title="Nghỉ phép">P</th>
                              <th title="Nghỉ ốm">O</th>
                              <th title="Nghỉ không lương">KL</th>
                              <th title="Nghỉ khác">K</th>
                              <th className="timesheet-attention-col" title="Số lượt đi muộn">Muộn</th>
                              <th className="timesheet-attention-col" title="Số lượt về sớm">Sớm</th>
                              <th title="Tổng giờ tăng ca">OT</th>
                            </>}

                            {/* Day and weekday in one compact header, matching preview */}
                            {showDayColumns && matrixData.header_days.map(hd => {
                              const isSun = hd.weekday === 'CN' || hd.isSunday;
                              const isHol = hd.isHoliday;
                              return (
                                <th key={hd.day} style={{
                                  padding: '3px 1px',
                                  background: isHol ? 'rgba(236, 72, 153, 0.18)' : isSun ? 'rgba(239, 68, 68, 0.12)' : 'var(--bg-raised)',
                                  color: isHol ? '#db2777' : isSun ? '#ef4444' : 'var(--text-muted)',
                                  minWidth: '42px', width: '42px',
                                  fontSize: '10px', fontWeight: isHol || isSun ? 800 : 600,
                                  borderBottom: '2px solid var(--primary)', borderLeft: '1px solid var(--border-muted)'
                                }} title={isHol ? `🏖️ Nghỉ Lễ: ${hd.holidayName || 'Ngày lễ'}` : isSun ? 'Chủ Nhật' : hd.weekday}>
                                  <strong style={{ display: 'block', fontSize: '11px', color: isHol ? '#db2777' : isSun ? '#ef4444' : 'var(--text)' }}>{hd.dayStr}</strong>
                                  <small style={{ display: 'block', marginTop: '2px', fontSize: '8px', color: isHol ? '#db2777' : isSun ? '#ef4444' : 'var(--text-muted)' }}>{isHol ? 'LỄ' : hd.weekday}</small>
                                </th>
                              );
                            })}
                            {isAdmin && <th style={{ minWidth: '42px', padding: '4px', borderBottom: '2px solid var(--primary)', background: 'var(--bg-raised)', color: 'var(--text-muted)' }}>Khóa</th>}
                          </tr>
                        </thead>

                        <tbody>
                          {displayedStaffRows.map((r, idx) => (
                            <tr key={r.id} style={{ borderBottom: '1px solid var(--border-muted)', background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}>
                              <td className="table-sticky-col-1" style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700, color: 'var(--text)', fontSize: '11.5px' }}>
                                <button type="button" className="timesheet-person-button" onClick={() => openStaffProfile(r)} aria-label={`Xem hồ sơ ${r.full_name}`}>
                                  <img src={r.avatar_url || '/logo.png'} alt="" style={{ width: '34px', height: '34px', flex: '0 0 auto', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border)' }} onError={e => { e.currentTarget.src = '/logo.png'; }} />
                                  <div style={{ minWidth: 0 }}>
                                    <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.full_name}</span>
                                    <small style={{ display: 'block', marginTop: '2px', color: 'var(--text-muted)', fontSize: '9px' }}>{r.code}</small>
                                  </div>
                                </button>
                              </td>
                              <td style={{ padding: '5px 8px', minWidth: '104px', textAlign: 'left', color: 'var(--text-secondary)', fontSize: '11px' }}>
                                {r.department_name || 'Chưa phân'}
                              </td>
                              <td style={{ padding: '5px 6px', color: 'var(--text-secondary)', fontSize: '11px' }}>{r.role_label}</td>

                              {/* Summary Column Values */}
                              {showSummaryColumns && <>
                                <td style={{ padding: '4px 3px', borderLeft: '1px solid var(--border-muted)' }}>{renderSummaryVal(r.nlv_office, '#10b981')}</td>
                                <td style={{ padding: '4px 3px' }}>{renderSummaryVal(r.ct_domestic, '#3b82f6')}</td>
                                <td style={{ padding: '4px 3px' }}>{renderSummaryVal(r.ct_foreign, '#8b5cf6')}</td>
                                <td style={{ padding: '4px 3px' }}>{renderSummaryVal(r.wfh, '#06b6d4')}</td>
                                <td style={{ padding: '4px 3px' }}>{renderSummaryVal(r.annual_leave, '#8b5cf6')}</td>
                                <td style={{ padding: '4px 3px' }}>{renderSummaryVal(r.sick_leave, '#ef4444')}</td>
                                <td style={{ padding: '4px 3px' }}>{renderSummaryVal(r.unpaid_leave, '#64748b')}</td>
                                <td style={{ padding: '4px 3px' }}>{renderSummaryVal(r.other_leave, '#94a3b8')}</td>
                                <td style={{ padding: '4px 3px', background: r.late_count > 0 ? 'rgba(245, 158, 11, 0.06)' : 'transparent' }}>{renderSummaryVal(r.late_count, '#d97706')}</td>
                                <td style={{ padding: '4px 3px', background: r.early_count > 0 ? 'rgba(239, 68, 68, 0.05)' : 'transparent' }}>{renderSummaryVal(r.early_count, '#ef4444')}</td>

                                {/* GIỜ OT */}
                                <td style={{ padding: '4px 3px', fontWeight: (r.total_ot_hours > 0 ? 800 : 500), color: (r.total_ot_hours > 0 ? '#8b5cf6' : 'var(--text-muted)') }}>
                                  {r.total_ot_hours > 0 ? (
                                    <span style={{ background: 'rgba(139, 92, 246, 0.15)', padding: '2px 5px', borderRadius: '4px', fontSize: '10.5px' }}>
                                      {r.total_ot_hours}h
                                    </span>
                                  ) : <span style={{ opacity: 0.18 }}>—</span>}
                                </td>
                              </>}

                              {/* Day Cell Symbols */}
                              {showDayColumns && r.days.map(d => {
                                const hdObj = matrixData.header_days.find(hd => hd.day === d.day);
                                const isSun = hdObj?.weekday === 'CN' || hdObj?.isSunday;
                                const isHol = hdObj?.isHoliday;
                                return (
                                  <td
                                    className="timesheet-day-cell"
                                    key={d.day}
                                    onClick={() => {
                                      if (isSun) return;
                                      setSelectedCell({
                                        user_id: r.id,
                                        staff_name: r.full_name,
                                        staff_code: r.code,
                                        department_name: r.department_name,
                                        dateStr: d.dateStr,
                                        day: d.day,
                                        weekday: hdObj?.weekday,
                                        current_symbol: d.symbol,
                                        check_in_time: d.check_in_time,
                                        check_out_time: d.check_out_time,
                                        total_hours: d.total_hours,
                                        ot_hours: d.ot_hours,
                                        is_late: d.is_late,
                                        late_minutes: d.late_minutes,
                                        is_early_leave: d.is_early_leave,
                                        early_minutes: d.early_minutes,
                                        status: d.status,
                                        notes: d.notes,
                                        check_in_type: d.check_in_type,
                                        is_modified: d.is_modified,
                                        audit_logs: d.audit_logs || [],
                                        holiday_name: hdObj?.holidayName || null,
                                      });
                                      setCellSymbol(d.symbol || (isHol ? 'L' : 'x'));
                                      setCellOtHours(d.ot_hours || 0);
                                      setCellReason('');
                                    }}
                                    style={{
                                      padding: '6px 7px',
                                      minWidth: '42px', width: '42px',
                                      cursor: !isSun ? 'pointer' : 'default',
                                      background: isHol ? 'rgba(236, 72, 153, 0.05)' : isSun ? 'rgba(239, 68, 68, 0.03)' : 'transparent',
                                      borderLeft: '1px solid var(--border-muted)',
                                    }}
                                    title={isSun ? `${d.dateStr} (${r.full_name}): Chủ nhật để trống` : `${d.dateStr} (${r.full_name}): [${d.symbol || '—'}]${isHol ? ` · 🏖️ Nghỉ Lễ: ${hdObj.holidayName || 'Ngày lễ'}` : ''}${d.is_late ? ` · ⚠️ Muộn ${d.late_minutes}p` : ''}${d.is_early_leave ? ` · 🚪 Về sớm ${d.early_minutes}p` : ''}${d.ot_hours > 0 ? ` · 🔥 OT ${d.ot_hours}h` : ''}${d.check_in_time ? ` (${d.check_in_time} ➔ ${d.check_out_time || '?'})` : ''}${isAdmin ? ' — Bấm để xem/sửa' : ' — Bấm để xem'}`}
                                  >
                                    {renderDaySymbol(d.symbol, isSun)}
                                  </td>
                                );
                              })}

                              {/* Lock Action Button per Staff — chỉ Admin */}
                              {isAdmin && (
                                <td style={{ padding: '6px' }}>
                                  <button
                                    onClick={() => triggerToggleLock(r.id, r.is_locked)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px' }}
                                    title={r.is_locked ? 'Mở chốt công riêng NV này' : 'Chốt công riêng NV này'}
                                  >
                                    {r.is_locked ? '🔒' : '🔓'}
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>

                        {/* System Total Footer Row */}
                        <tfoot style={{ borderTop: '2px solid var(--primary)' }}>
                          <tr style={{ background: 'var(--bg-raised)', fontWeight: 800, color: 'var(--text)' }}>
                            <td className="table-sticky-col-1" style={{ padding: '6px 6px', textAlign: 'left', color: 'var(--primary)', fontWeight: 800, fontSize: '11px' }}>
                              TỔNG CỘNG HỆ THỐNG ({displayedStaffRows.length} NV)
                            </td>
                            <td style={{ padding: '4px 4px', color: 'var(--text-muted)', opacity: 0.2 }}>—</td>
                            <td style={{ padding: '4px 4px', color: 'var(--text-muted)', opacity: 0.2 }}>—</td>
                            {showSummaryColumns && <>
                              <td style={{ padding: '4px 3px', borderLeft: '1px solid var(--border-muted)' }}>{renderSummaryVal(displayedStaffRows.reduce((s, r) => s + r.nlv_office, 0), '#10b981')}</td>
                              <td style={{ padding: '4px 3px' }}>{renderSummaryVal(displayedStaffRows.reduce((s, r) => s + r.ct_domestic, 0), '#3b82f6')}</td>
                              <td style={{ padding: '4px 3px' }}>{renderSummaryVal(displayedStaffRows.reduce((s, r) => s + r.ct_foreign, 0), '#8b5cf6')}</td>
                              <td style={{ padding: '4px 3px' }}>{renderSummaryVal(displayedStaffRows.reduce((s, r) => s + r.wfh, 0), '#06b6d4')}</td>
                              <td style={{ padding: '4px 3px' }}>{renderSummaryVal(displayedStaffRows.reduce((s, r) => s + r.annual_leave, 0), '#8b5cf6')}</td>
                              <td style={{ padding: '4px 3px' }}>{renderSummaryVal(displayedStaffRows.reduce((s, r) => s + r.sick_leave, 0), '#ef4444')}</td>
                              <td style={{ padding: '4px 3px' }}>{renderSummaryVal(displayedStaffRows.reduce((s, r) => s + r.unpaid_leave, 0), '#64748b')}</td>
                              <td style={{ padding: '4px 3px' }}>{renderSummaryVal(displayedStaffRows.reduce((s, r) => s + r.other_leave, 0), '#94a3b8')}</td>
                              <td style={{ padding: '4px 3px' }}>{renderSummaryVal(displayedStaffRows.reduce((s, r) => s + (r.late_count || 0), 0), '#d97706')}</td>
                              <td style={{ padding: '4px 3px' }}>{renderSummaryVal(displayedStaffRows.reduce((s, r) => s + (r.early_count || 0), 0), '#ef4444')}</td>
                              <td style={{ padding: '4px 3px', color: '#8b5cf6', fontWeight: 800 }}>
                                {renderSummaryVal(displayedStaffRows.reduce((s, r) => s + (r.total_ot_hours || 0), 0), '#8b5cf6')}
                              </td>
                            </>}
                            {showDayColumns && matrixData.header_days.map(hd => (
                              <td key={hd.day} className="timesheet-day-cell" style={{ padding: '6px 7px', minWidth: '42px', width: '42px', fontSize: '9px', color: 'var(--text-muted)', opacity: 0.2 }}>{hd.isSunday || hd.weekday === 'CN' ? '' : '—'}</td>
                            ))}
                            {isAdmin && <td />}
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* TAB 2: OVERVIEW */}
        {tab === 'overview' && report?.summary && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Top Stat Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
              <div className="card" style={{ padding: '16px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>TỔNG NHÂN VIÊN ĐANG LÀM</div>
                  <UserCheck size={18} color="var(--primary)" />
                </div>
                <div style={{ fontSize: '24px', fontWeight: 900, color: 'var(--primary)', marginTop: '6px' }}>
                  {report.summary.total_employees ?? report.summary.total_users ?? 0}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>Chỉ tính nhân viên đang làm việc</div>
              </div>

              <div className="card" style={{ padding: '16px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--green)', textTransform: 'uppercase' }}>TỶ LỆ ĐÚNG GIỜ</div>
                  <CheckCircle2 size={18} color="var(--green)" />
                </div>
                <div style={{ fontSize: '24px', fontWeight: 900, color: 'var(--green)', marginTop: '6px' }}>
                  {report.summary.total_attendance_days > 0 
                    ? Math.round(((report.summary.total_attendance_days - (report.summary.total_late_cases || 0)) / report.summary.total_attendance_days) * 100)
                    : 100}%
                </div>
                <div style={{ fontSize: '11px', color: 'var(--green)', marginTop: '4px' }}>Thống kê toàn công ty</div>
              </div>

              <div className="card" style={{ padding: '16px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--yellow)', textTransform: 'uppercase' }}>LƯỢT ĐI MUỘN</div>
                  <AlertTriangle size={18} color="var(--yellow)" />
                </div>
                <div style={{ fontSize: '24px', fontWeight: 900, color: 'var(--yellow)', marginTop: '6px' }}>
                  {report.summary.total_late_cases ?? report.summary.total_late_days ?? 0}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>Lượt trễ trong Tháng {month}</div>
              </div>
            </div>

            {/* Attendance Trend Chart */}
            {(() => {
              const trendData = trend?.months || trend?.monthly_stats || [];
              if (!trendData.length) return null;
              return (
                <div className="card" style={{ padding: '16px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '14px', fontWeight: 800, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <BarChart3 size={18} color="var(--primary)" /> Biểu đồ xu hướng đúng giờ 6 tháng gần nhất
                  </div>
                  <div style={{ width: '100%', height: 260 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-muted)" />
                        <XAxis dataKey="label" stroke="var(--text-secondary)" fontSize={12} />
                        <YAxis stroke="var(--text-secondary)" fontSize={12} domain={[0, 100]} />
                        <Tooltip
                          contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px' }}
                          formatter={(val) => [`${val}%`, 'Tỷ lệ đúng giờ']}
                        />
                        <Bar dataKey="attendance_rate" fill="var(--primary)" radius={[6, 6, 0, 0]}>
                          {trendData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={(entry.attendance_rate ?? entry.on_time_rate) >= 90 ? '#10b981' : (entry.attendance_rate ?? entry.on_time_rate) >= 80 ? '#3b82f6' : '#f59e0b'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* OFF-SCREEN HIGH-DEF PRINT WRAPPER FOR PDF MATRIX GENERATION (2150px Expanded Width for All 31 Days) */}
      <div style={{ position: 'absolute', left: '-9999px', top: '-9999px', width: '2150px', pointerEvents: 'none' }}>
        <div ref={pdfMatrixPrintRef} style={{ background: '#ffffff', color: '#0f172a', padding: '20px', fontFamily: 'Arial, sans-serif', width: '2150px' }}>
          {/* Corporate Header Banner */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '3px solid #1e293b', paddingBottom: '10px' }}>
            <div>
              <div style={{ fontSize: '18px', fontWeight: 900, color: '#1e293b', letterSpacing: '0.5px' }}>
                BẢNG CHẤM CÔNG NHÂN SỰ — ET ARCHITECTS
              </div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#475569' }}>
                THÁNG {month} NĂM {year} {filterStaffId && `(Nhân sự: ${matrixData?.staff_rows?.find(s=>s.id===filterStaffId)?.full_name})`}
              </div>
            </div>
            <div style={{ fontSize: '11px', textAlign: 'right', color: '#64748b' }}>
              <div>Mẫu quản lý: <strong>ET_Staff {year}</strong></div>
              <div>Trạng thái: <strong style={{ color: matrixData?.global_locked ? '#ef4444' : '#10b981' }}>{matrixData?.global_locked ? 'ĐÃ CHỐT CÔNG' : 'ĐANG CẬP NHẬT'}</strong></div>
            </div>
          </div>

          <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse', textAlign: 'center', whiteSpace: 'nowrap', border: '1px solid #1e293b' }}>
            <thead>
              <tr style={{ background: '#1e293b', color: '#ffffff', fontWeight: 800 }}>
                <th style={{ padding: '8px 10px', textAlign: 'left', minWidth: '60px', border: '1px solid #334155' }}>ID</th>
                <th style={{ padding: '8px 10px', textAlign: 'left', minWidth: '140px', border: '1px solid #334155' }}>NHÂN SỰ</th>
                <th style={{ padding: '8px 10px', minWidth: '70px', border: '1px solid #334155' }}>NV</th>

                <th style={{ padding: '6px 8px', background: '#0f172a', border: '1px solid #334155', color: '#10b981' }}>NLV tại VP</th>
                <th style={{ padding: '6px 8px', background: '#0f172a', border: '1px solid #334155', color: '#3b82f6' }}>CT Trong nước</th>
                <th style={{ padding: '6px 8px', background: '#0f172a', border: '1px solid #334155', color: '#8b5cf6' }}>CT Nước ngoài</th>
                <th style={{ padding: '6px 8px', background: '#0f172a', border: '1px solid #334155', color: '#06b6d4' }}>Work from home</th>
                <th style={{ padding: '6px 8px', background: '#0f172a', border: '1px solid #334155', color: '#8b5cf6' }}>Nghỉ phép</th>
                <th style={{ padding: '6px 8px', background: '#0f172a', border: '1px solid #334155', color: '#ef4444' }}>Nghỉ ốm</th>
                <th style={{ padding: '6px 8px', background: '#0f172a', border: '1px solid #334155', color: '#64748b' }}>Nghỉ không lương</th>
                <th style={{ padding: '6px 8px', background: '#0f172a', border: '1px solid #334155', color: '#94a3b8' }}>Khác</th>

                {matrixData?.header_days?.map(hd => {
                  const isSun = hd.weekday === 'CN' || hd.isSunday;
                  return (
                    <th key={hd.day} style={{ padding: '4px 6px', background: isSun ? '#991b1b' : '#334155', color: isSun ? '#fca5a5' : '#ffffff', minWidth: '28px', border: '1px solid #334155' }}>
                      {hd.weekday}
                    </th>
                  );
                })}
              </tr>

              <tr style={{ background: '#0f172a', color: '#ffffff', fontWeight: 800 }}>
                <th colSpan="3" style={{ padding: '6px 10px', textAlign: 'left', border: '1px solid #334155' }}>BẢNG CHẤM CÔNG THÁNG</th>
                <th colSpan="8" style={{ padding: '6px 8px', fontSize: '10px', color: '#94a3b8', border: '1px solid #334155' }}>TỔNG CỘNG THEO LOẠI CÔNG</th>

                {matrixData?.header_days?.map(hd => {
                  const isSun = hd.weekday === 'CN' || hd.isSunday;
                  return (
                    <th key={hd.day} style={{ padding: '4px 6px', background: isSun ? '#7f1d1d' : '#0f172a', color: isSun ? '#fca5a5' : '#ffffff', border: '1px solid #334155' }}>
                      {hd.dayStr}
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody>
              {pdfMatrixRows.map((r, idx) => {
                const renderPdfSum = (val, color) => {
                  if (!val || val === 0) return <span style={{ color: '#cbd5e1', opacity: 0.3 }}>—</span>;
                  return <span style={{ fontWeight: 800, color }}>{val.toFixed(2)}</span>;
                };

                return (
                  <tr key={r.id} style={{ background: idx % 2 === 0 ? '#ffffff' : '#f8fafc', color: '#0f172a', borderBottom: '1px solid #cbd5e1' }}>
                    <td style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 800, color: '#2563eb', border: '1px solid #cbd5e1' }}>{r.code}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: '#0f172a', border: '1px solid #cbd5e1' }}>{r.full_name}</td>
                    <td style={{ padding: '8px 10px', color: '#475569', border: '1px solid #cbd5e1' }}>{r.role_label}</td>

                    <td style={{ padding: '8px 6px', border: '1px solid #cbd5e1' }}>{renderPdfSum(r.nlv_office, '#059669')}</td>
                    <td style={{ padding: '8px 6px', border: '1px solid #cbd5e1' }}>{renderPdfSum(r.ct_domestic, '#2563eb')}</td>
                    <td style={{ padding: '8px 6px', border: '1px solid #cbd5e1' }}>{renderPdfSum(r.ct_foreign, '#7c3aed')}</td>
                    <td style={{ padding: '8px 6px', border: '1px solid #cbd5e1' }}>{renderPdfSum(r.wfh, '#0891b2')}</td>
                    <td style={{ padding: '8px 6px', border: '1px solid #cbd5e1' }}>{renderPdfSum(r.annual_leave, '#7c3aed')}</td>
                    <td style={{ padding: '8px 6px', border: '1px solid #cbd5e1' }}>{renderPdfSum(r.sick_leave, '#dc2626')}</td>
                    <td style={{ padding: '8px 6px', border: '1px solid #cbd5e1' }}>{renderPdfSum(r.unpaid_leave, '#475569')}</td>
                    <td style={{ padding: '8px 6px', border: '1px solid #cbd5e1' }}>{renderPdfSum(r.other_leave, '#64748b')}</td>

                    {r.days.map(d => {
                      const hdObj = matrixData?.header_days?.find(hd => hd.day === d.day);
                      const isSun = hdObj?.weekday === 'CN' || hdObj?.isSunday;
                      return (
                        <td
                          key={d.day}
                          style={{
                            padding: '6px 4px', fontWeight: 800, border: '1px solid #cbd5e1',
                            background: isSun ? '#fef2f2' : 'transparent',
                            color: d.symbol === 'x' || d.symbol === '0,75x' ? '#059669' :
                                   d.symbol === '0,5x' ? '#d97706' :
                                   d.symbol === 'CT1' ? '#2563eb' :
                                   d.symbol === 'CT2' ? '#7c3aed' :
                                   d.symbol === 'WFH' ? '#0891b2' :
                                   d.symbol === 'P' ? '#7c3aed' :
                                   d.symbol === 'O' ? '#dc2626' :
                                   d.symbol === 'KL' ? '#475569' : '#0f172a'
                          }}
                        >
                          {d.symbol || '—'}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>

            {/* Total Footer Row for PDF */}
            <tfoot>
              <tr style={{ background: '#f1f5f9', fontWeight: 800, color: '#0f172a', borderTop: '2px solid #1e293b' }}>
                <td colSpan="3" style={{ padding: '8px 10px', textAlign: 'left', color: '#1e293b', border: '1px solid #cbd5e1' }}>
                  TỔNG CỘNG HỆ THỐNG ({pdfMatrixRows.length} NV)
                </td>
                <td style={{ padding: '8px 6px', border: '1px solid #cbd5e1', color: '#059669' }}>
                  {pdfMatrixRows.reduce((s, r) => s + r.nlv_office, 0).toFixed(2)}
                </td>
                <td style={{ padding: '8px 6px', border: '1px solid #cbd5e1', color: '#2563eb' }}>
                  {pdfMatrixRows.reduce((s, r) => s + r.ct_domestic, 0).toFixed(2)}
                </td>
                <td style={{ padding: '8px 6px', border: '1px solid #cbd5e1', color: '#7c3aed' }}>
                  {pdfMatrixRows.reduce((s, r) => s + r.ct_foreign, 0).toFixed(2)}
                </td>
                <td style={{ padding: '8px 6px', border: '1px solid #cbd5e1', color: '#0891b2' }}>
                  {pdfMatrixRows.reduce((s, r) => s + r.wfh, 0).toFixed(2)}
                </td>
                <td style={{ padding: '8px 6px', border: '1px solid #cbd5e1', color: '#7c3aed' }}>
                  {pdfMatrixRows.reduce((s, r) => s + r.annual_leave, 0).toFixed(2)}
                </td>
                <td style={{ padding: '8px 6px', border: '1px solid #cbd5e1', color: '#dc2626' }}>
                  {pdfMatrixRows.reduce((s, r) => s + r.sick_leave, 0).toFixed(2)}
                </td>
                <td style={{ padding: '8px 6px', border: '1px solid #cbd5e1', color: '#475569' }}>
                  {pdfMatrixRows.reduce((s, r) => s + r.unpaid_leave, 0).toFixed(2)}
                </td>
                <td style={{ padding: '8px 6px', border: '1px solid #cbd5e1', color: '#64748b' }}>
                  {pdfMatrixRows.reduce((s, r) => s + r.other_leave, 0).toFixed(2)}
                </td>
                {matrixData?.header_days?.map(hd => (
                  <td key={hd.day} style={{ padding: '6px 4px', fontSize: '10px', color: '#94a3b8', border: '1px solid #cbd5e1' }}>—</td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* OFF-SCREEN HIGH-DEF PRINT WRAPPER FOR INDIVIDUAL DETAILED PDF SLIP */}
      <div style={{ position: 'absolute', left: '-9999px', top: '-9999px', width: '900px', pointerEvents: 'none' }}>
        <div ref={pdfIndividualPrintRef} style={{ background: '#ffffff', color: '#0f172a', padding: '24px', fontFamily: 'Arial, sans-serif', width: '900px' }}>
          {/* Title Banner */}
          <div style={{ textAlign: 'center', fontSize: '22px', fontWeight: '900', marginBottom: '16px', textTransform: 'uppercase', color: '#0f172a', letterSpacing: '1px' }}>
            BẢNG CHI TIẾT CHẤM CÔNG
          </div>

          {/* Banner 1: Header Employee Info */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '12px', fontSize: '12px', border: '1.5px solid #1e293b' }}>
            <tbody>
              <tr style={{ background: '#fef08a', color: '#0f172a' }}>
                <td style={{ border: '1.5px solid #1e293b', padding: '8px 12px', fontWeight: 'bold', width: '22%' }}>Mã nhân viên: {indUser.id}</td>
                <td style={{ border: '1.5px solid #1e293b', padding: '8px 12px', fontWeight: 'bold', width: '45%' }}>Tên nhân viên: {indUser.full_name}</td>
                <td style={{ border: '1.5px solid #1e293b', padding: '8px 12px', fontWeight: 'bold', width: '33%' }}>Bộ phận: {indUser.department_name}</td>
              </tr>
            </tbody>
          </table>

          {/* Summary Table Grid 1 & 2 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            {/* Grid Left: Hours & Late/Early */}
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1.5px solid #1e293b', fontSize: '11px' }}>
              <tbody>
                <tr>
                  <td style={{ border: '1px solid #1e293b', padding: '5px 8px', fontWeight: 'bold', background: '#f8fafc', color: '#0f172a' }}>Ngày thường</td>
                  <td style={{ border: '1px solid #1e293b', padding: '5px 8px', textAlign: 'center', color: '#0f172a' }}>{indSum.work_hours_normal}h</td>
                  <td style={{ border: '1px solid #1e293b', padding: '5px 8px', fontWeight: 'bold', background: '#f8fafc', color: '#0f172a' }}>Tăng ca 1</td>
                  <td style={{ border: '1px solid #1e293b', padding: '5px 8px', textAlign: 'center', color: '#0f172a' }}>{indSum.ot1_hours}h</td>
                  <td style={{ border: '1px solid #1e293b', padding: '5px 8px', fontWeight: 'bold', background: '#f8fafc', color: '#0f172a' }}>Đi trễ</td>
                  <td style={{ border: '1px solid #1e293b', padding: '5px 8px', textAlign: 'center', color: '#0f172a' }}>Số lần: {indSum.late_count}</td>
                </tr>
                <tr>
                  <td style={{ border: '1px solid #1e293b', padding: '5px 8px', fontWeight: 'bold', background: '#f8fafc', color: '#0f172a' }}>Cuối tuần</td>
                  <td style={{ border: '1px solid #1e293b', padding: '5px 8px', textAlign: 'center', color: '#0f172a' }}>{indSum.work_hours_weekend}h</td>
                  <td style={{ border: '1px solid #1e293b', padding: '5px 8px', fontWeight: 'bold', background: '#f8fafc', color: '#0f172a' }}>Tăng ca 2</td>
                  <td style={{ border: '1px solid #1e293b', padding: '5px 8px', textAlign: 'center', color: '#0f172a' }}>{indSum.ot2_hours}h</td>
                  <td style={{ border: '1px solid #1e293b', padding: '5px 8px', fontWeight: 'bold', background: '#f8fafc', color: '#0f172a' }}>Về sớm</td>
                  <td style={{ border: '1px solid #1e293b', padding: '5px 8px', textAlign: 'center', color: '#0f172a' }}>Số lần: {indSum.early_count}</td>
                </tr>
                <tr style={{ background: '#e2e8f0', fontWeight: 'bold', color: '#0f172a' }}>
                  <td style={{ border: '1.5px solid #1e293b', padding: '5px 8px' }}>TỔNG</td>
                  <td style={{ border: '1.5px solid #1e293b', padding: '5px 8px', textAlign: 'center' }}>{indSum.total_work_hours}h</td>
                  <td style={{ border: '1.5px solid #1e293b', padding: '5px 8px' }}>Tăng ca 3</td>
                  <td style={{ border: '1.5px solid #1e293b', padding: '5px 8px', textAlign: 'center' }}>{indSum.ot3_hours}h</td>
                  <td style={{ border: '1.5px solid #1e293b', padding: '5px 8px' }}>Số phút trễ</td>
                  <td style={{ border: '1.5px solid #1e293b', padding: '5px 8px', textAlign: 'center', color: indSum.late_minutes > 0 ? '#ef4444' : '#0f172a' }}>{indSum.late_minutes}p</td>
                </tr>
              </tbody>
            </table>

            {/* Grid Right: Leave counts */}
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1.5px solid #1e293b', fontSize: '11px', textAlign: 'center' }}>
              <thead>
                <tr style={{ background: '#1e293b', color: '#ffffff' }}>
                  <th colSpan="12" style={{ border: '1px solid #1e293b', padding: '6px' }}>Các loại vắng</th>
                </tr>
                <tr style={{ background: '#f1f5f9', fontWeight: 'bold', color: '#0f172a' }}>
                  <td style={{ border: '1px solid #1e293b', padding: '4px' }}>V</td>
                  <td style={{ border: '1px solid #1e293b', padding: '4px' }}>OM</td>
                  <td style={{ border: '1px solid #1e293b', padding: '4px' }}>TS</td>
                  <td style={{ border: '1px solid #1e293b', padding: '4px' }}>R</td>
                  <td style={{ border: '1px solid #1e293b', padding: '4px' }}>Ro</td>
                  <td style={{ border: '1px solid #1e293b', padding: '4px' }}>P</td>
                  <td style={{ border: '1px solid #1e293b', padding: '4px' }}>F</td>
                  <td style={{ border: '1px solid #1e293b', padding: '4px' }}>CO</td>
                  <td style={{ border: '1px solid #1e293b', padding: '4px' }}>CD</td>
                  <td style={{ border: '1px solid #1e293b', padding: '4px' }}>H</td>
                  <td style={{ border: '1px solid #1e293b', padding: '4px' }}>CT</td>
                  <td style={{ border: '1px solid #1e293b', padding: '4px' }}>Le</td>
                </tr>
              </thead>
              <tbody>
                <tr style={{ color: '#0f172a' }}>
                  <td style={{ border: '1px solid #1e293b', padding: '6px' }}>{lc.V || 0}</td>
                  <td style={{ border: '1px solid #1e293b', padding: '6px' }}>{lc.OM || 0}</td>
                  <td style={{ border: '1px solid #1e293b', padding: '6px' }}>{lc.TS || 0}</td>
                  <td style={{ border: '1px solid #1e293b', padding: '6px' }}>{lc.R || 0}</td>
                  <td style={{ border: '1px solid #1e293b', padding: '6px' }}>{lc.Ro || 0}</td>
                  <td style={{ border: '1px solid #1e293b', padding: '6px' }}>{lc.P || 0}</td>
                  <td style={{ border: '1px solid #1e293b', padding: '6px' }}>{lc.F || 0}</td>
                  <td style={{ border: '1px solid #1e293b', padding: '6px' }}>{lc.CO || 0}</td>
                  <td style={{ border: '1px solid #1e293b', padding: '6px' }}>{lc.CD || 0}</td>
                  <td style={{ border: '1px solid #1e293b', padding: '6px' }}>{lc.H || 0}</td>
                  <td style={{ border: '1px solid #1e293b', padding: '6px' }}>{lc.CT || 0}</td>
                  <td style={{ border: '1px solid #1e293b', padding: '6px' }}>{lc.Le || 0}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Main Detailed Logs Table */}
          <div style={{ fontStyle: 'italic', fontSize: '11px', marginBottom: '6px', textAlign: 'center', fontWeight: 'bold', color: '#0f172a' }}>Chi tiết điểm danh hàng ngày</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1.5px solid #1e293b', fontSize: '11px', textAlign: 'center' }}>
            <thead>
              <tr style={{ background: '#1e293b', color: '#ffffff', fontWeight: 'bold' }}>
                <th style={{ border: '1px solid #334155', padding: '8px 6px' }}>Ngày</th>
                <th style={{ border: '1px solid #334155', padding: '8px 6px' }}>Thứ</th>
                <th style={{ border: '1px solid #334155', padding: '8px 6px', color: '#34d399' }}>Giờ vào</th>
                <th style={{ border: '1px solid #334155', padding: '8px 6px', color: '#60a5fa' }}>Giờ ra</th>
                <th style={{ border: '1px solid #334155', padding: '8px 6px' }}>Loại công</th>
                <th style={{ border: '1px solid #334155', padding: '8px 6px' }}>Đủ công ngày</th>
                <th style={{ border: '1px solid #334155', padding: '8px 6px' }}>Giờ làm ngày</th>
                <th style={{ border: '1px solid #334155', padding: '8px 6px', color: '#c084fc' }}>Giờ OT ngày</th>
                <th style={{ border: '1px solid #334155', padding: '8px 6px' }}>Nơi làm việc</th>
              </tr>
            </thead>
            <tbody>
              {indLogs.map((row) => {
                const isSun = row.weekday === 'CN' || row.weekday === 'Chủ Nhật';
                const inTime = row.shift1?.in || row.shift2?.in || row.shift3?.in || '—';
                const outTime = row.shift3?.out || row.shift2?.out || row.shift1?.out || '—';
                const otVal = (row.ot1 || 0) + (row.ot2 || 0) + (row.ot3 || 0);
                const otStr = otVal > 0 ? `${otVal.toFixed(1)}h` : '—';
                const numCredit = parseFloat(row.workCredit || 0);

                let creditBadge = <span style={{ color: '#64748b' }}>0 công (Vắng)</span>;
                if (numCredit >= 1 || row.workCredit === '1.0' || row.workCredit === 'x') {
                  creditBadge = <span style={{ color: '#059669', fontWeight: 800 }}>1.0 công (Đủ công)</span>;
                } else if (numCredit > 0) {
                  creditBadge = <span style={{ color: '#d97706', fontWeight: 800 }}>{numCredit} công (Nửa ngày)</span>;
                } else if (row.workCredit && row.workCredit !== '0' && row.workCredit !== '—') {
                  creditBadge = <span style={{ color: '#7c3aed', fontWeight: 800 }}>{row.workCredit}</span>;
                }

                return (
                  <tr key={row.day} style={{ background: isSun ? '#fef2f2' : row.isWeekend ? '#f8fafc' : '#ffffff', color: '#0f172a' }}>
                    <td style={{ border: '1px solid #cbd5e1', padding: '5px 4px', fontWeight: 700 }}>{row.dateFormatted}</td>
                    <td style={{ border: '1px solid #cbd5e1', padding: '5px 4px', fontWeight: 700, color: isSun ? '#dc2626' : '#0f172a' }}>{row.weekday}</td>
                    <td style={{ border: '1px solid #cbd5e1', padding: '5px 4px', color: '#059669', fontWeight: 700 }}>{inTime}</td>
                    <td style={{ border: '1px solid #cbd5e1', padding: '5px 4px', color: '#2563eb', fontWeight: 700 }}>{outTime}</td>
                    <td style={{ border: '1px solid #cbd5e1', padding: '5px 4px', fontWeight: 700, color: '#475569' }}>{row.workCredit || '—'}</td>
                    <td style={{ border: '1px solid #cbd5e1', padding: '5px 4px' }}>{creditBadge}</td>
                    <td style={{ border: '1px solid #cbd5e1', padding: '5px 4px', fontWeight: 800 }}>{row.totalHours ? `${row.totalHours}h` : '—'}</td>
                    <td style={{ border: '1px solid #cbd5e1', padding: '5px 4px', fontWeight: 800, color: otVal > 0 ? '#7c3aed' : '#cbd5e1' }}>{otStr}</td>
                    <td style={{ border: '1px solid #cbd5e1', padding: '5px 4px', color: '#475569' }}>{row.locationName}</td>
                  </tr>
                );
              })}
              {/* Bottom Summary Row */}
              <tr style={{ fontWeight: 'bold', background: '#e2e8f0', color: '#0f172a' }}>
                <td colSpan="6" style={{ border: '1.5px solid #1e293b', padding: '7px 10px', textAlign: 'left' }}>
                  TỔNG CỘNG THÁNG {month}/{year}:
                </td>
                <td colSpan="3" style={{ border: '1.5px solid #1e293b', padding: '7px', textAlign: 'center', color: '#059669', fontSize: '12px' }}>
                  {indSum.total_work_hours} giờ làm việc
                </td>
              </tr>
            </tbody>
          </table>

          {/* Signature Block */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '28px', textAlign: 'center' }}>
            <div style={{ minWidth: '220px' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '55px', color: '#0f172a' }}>Kí tên</div>
              <div style={{ fontWeight: 'bold', textDecoration: 'underline', color: '#0f172a' }}>{indUser.full_name}</div>
            </div>
          </div>
        </div>
      </div>

      {/* EMPLOYEE DIRECTORY PROFILE — same interaction as Weekly Schedule */}
      {viewingStaffProfile && (
        <div className="modal-overlay" onClick={() => setViewingStaffProfile(null)}>
          <div className="modal-sheet animate-slide-up timesheet-profile-modal" onClick={event => event.stopPropagation()}>
            <div className="modal-sheet__handle" />
            <div className="timesheet-profile-modal__heading">
              <div><h3>Hồ sơ nhân sự</h3><span>Thông tin danh bạ công ty</span></div>
              <button type="button" className="btn btn--ghost" onClick={() => setViewingStaffProfile(null)} aria-label="Đóng"><X size={18} /></button>
            </div>

            <section className="timesheet-profile-card">
              <div className="timesheet-profile-card__hero">
                <img src={viewingStaffProfile.avatar_url || '/logo.png'} alt={viewingStaffProfile.full_name} onError={event => { event.currentTarget.src = '/logo.png'; }} />
                <div>
                  <h4>{viewingStaffProfile.full_name}</h4>
                  <span>{viewingStaffProfile.employee_code || viewingStaffProfile.code || 'NS'} · {viewingStaffProfile.position || viewingStaffProfile.role_label || 'Nhân viên'}</span>
                </div>
              </div>

              {loadingStaffProfile && <div className="timesheet-profile-loading"><span className="spinner" /> Đang đồng bộ hồ sơ...</div>}

              <dl className="timesheet-profile-card__details">
                <div><dt>Loại nhân sự</dt><dd>{{ NS: 'Nhân sự chính thức', TV: 'Thử việc', TTS: 'Thực tập sinh' }[viewingStaffProfile.employee_type] || viewingStaffProfile.employee_type || 'Nhân sự chính thức'}</dd></div>
                <div><dt>Vai trò</dt><dd>{viewingStaffProfile.role === 'admin' ? 'Admin' : ['leader', 'manager'].includes(viewingStaffProfile.role) ? 'Leader' : 'Nhân viên'}</dd></div>
                <div><dt>Phòng ban</dt><dd>{viewingStaffProfile.department_name || viewingStaffProfile.department_id?.name || 'Chưa phân phòng'}</dd></div>
                <div><dt>Ngày vào công ty</dt><dd>{viewingStaffProfile.join_date || (viewingStaffProfile.start_year ? `Năm ${viewingStaffProfile.start_year}` : 'Chưa cập nhật')}</dd></div>
                <div><dt>Email</dt><dd>{viewingStaffProfile.email || 'Chưa cập nhật'}</dd></div>
                <div><dt>Số điện thoại</dt><dd>{viewingStaffProfile.phone || 'Chưa cập nhật'}</dd></div>
                <div><dt>Trạng thái làm việc</dt><dd>{viewingStaffProfile.employment_status || 'Đang làm việc'}</dd></div>
                <div><dt>Địa điểm gửi xe</dt><dd>{viewingStaffProfile.parking_location || 'Chưa cập nhật'}</dd></div>
                <div className="is-wide"><dt>Xe & biển số</dt><dd>{viewingStaffProfile.vehicle_info || viewingStaffProfile.license_plate || 'Chưa cập nhật'}</dd></div>
              </dl>

              {isAdmin && (viewingStaffProfile.bank_name || viewingStaffProfile.bank_account || viewingStaffProfile.branch) && (
                <div className="timesheet-profile-bank">
                  <strong>🏦 Tài khoản ngân hàng</strong>
                  <dl>
                    <div><dt>Ngân hàng</dt><dd>{viewingStaffProfile.bank_name || 'Chưa cập nhật'}</dd></div>
                    <div><dt>Số tài khoản</dt><dd>{viewingStaffProfile.bank_account || 'Chưa cập nhật'}</dd></div>
                    <div><dt>Chi nhánh</dt><dd>{viewingStaffProfile.branch || 'Chưa cập nhật'}</dd></div>
                  </dl>
                </div>
              )}
            </section>

            <div className="timesheet-profile-modal__actions">
              <button type="button" className="btn btn--ghost" onClick={() => setViewingStaffProfile(null)}>Đóng</button>
              {isAdmin && (
                <button type="button" className="btn btn--primary" onClick={() => {
                  setSelectedExportUser(String(viewingStaffProfile.id || viewingStaffProfile._id));
                  setExportTarget('individual');
                  setExportFormat('pdf');
                  setExportScope('single');
                  setViewingStaffProfile(null);
                  setShowExportModal(true);
                }}><FileText size={16} /> Xuất phiếu cá nhân</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: CHI TIẾT NGÀY ĐIỂM DANH & CHỈNH SỬA Ô CÔNG */}
      {selectedCell && (
        <div className="modal-overlay" onClick={() => setSelectedCell(null)}>
          <div className="modal-sheet animate-slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px', margin: '0 auto' }}>
            <div className="modal-sheet__handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={18} color="var(--primary)" />
                <h3 style={{ fontSize: '16px', fontWeight: 800 }}>Chi Tiết Ngày Điểm Danh</h3>
              </div>
              <button onClick={() => setSelectedCell(null)} className="btn btn--ghost" style={{ padding: '4px 8px' }}><X size={18} /></button>
            </div>

            {/* Employee & Date Banner */}
            <div style={{ background: 'var(--bg-raised)', padding: '12px', borderRadius: '10px', marginBottom: '12px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text)' }}>
                    {selectedCell.staff_name}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    #{selectedCell.staff_code || 'NS'} · {selectedCell.department_name || 'Phòng ban'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--primary)' }}>
                    {selectedCell.weekday ? `${selectedCell.weekday}, ` : ''}{selectedCell.dateStr}
                  </div>
                  <div style={{ marginTop: '3px' }}>
                    <span
                      className={`badge ${
                        ['x', '0,75x', '0,5x', 'CT1', 'CT2', 'WFH'].includes(selectedCell.current_symbol) ? 'badge--success' :
                        ['P', 'O'].includes(selectedCell.current_symbol) ? 'badge--warning' :
                        ['KL', 'K'].includes(selectedCell.current_symbol) ? 'badge--danger' : 'badge--neutral'
                      }`}
                      style={{ fontSize: '11px', fontWeight: 800, padding: '3px 8px' }}
                    >
                      {selectedCell.current_symbol ? `Ký hiệu: [${selectedCell.current_symbol}]` : 'Chưa có ký hiệu'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Daily Attendance Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
              <div className="card" style={{ padding: '10px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginBottom: '3px' }}>🕒 Giờ Check-in / Out</div>
                {selectedCell.check_in_time || selectedCell.check_out_time ? (
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>
                    {selectedCell.check_in_time || 'Chưa vào'} ➔ {selectedCell.check_out_time || 'Chưa ra'}
                  </div>
                ) : (
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    {selectedCell.weekday === 'CN' ? '🏖️ Nghỉ Chủ Nhật' :
                     selectedCell.dateStr > new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }) ? '⏳ Chưa đến ngày' :
                     '🚫 Không có check-in'}
                  </div>
                )}
                {selectedCell.is_late && (
                  <div style={{ fontSize: '10.5px', color: 'var(--yellow)', fontWeight: 700, marginTop: '2px' }}>
                    ⚠️ Muộn {selectedCell.late_minutes} phút
                  </div>
                )}
                {selectedCell.is_early_leave && (
                  <div style={{ fontSize: '10.5px', color: 'var(--red)', fontWeight: 700, marginTop: '2px' }}>
                    🚪 Về sớm {selectedCell.early_minutes} phút
                  </div>
                )}
              </div>

              <div className="card" style={{ padding: '10px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginBottom: '3px' }}>⏱️ Thời Gian Làm Việc</div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: selectedCell.total_hours > 0 ? 'var(--primary)' : 'var(--text-muted)' }}>
                  {selectedCell.total_hours > 0 ? `${selectedCell.total_hours} giờ` : '0 giờ'}
                  {selectedCell.ot_hours > 0 && (
                    <span style={{ fontSize: '11px', color: '#ef4444', marginLeft: '4px' }}>(+{selectedCell.ot_hours}h OT)</span>
                  )}
                </div>
                <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {selectedCell.check_in_type === 'wfh' ? '🏠 Work from home' :
                   selectedCell.check_in_type === 'site' ? '🚗 Đi công tác' :
                   selectedCell.total_hours > 0 ? '🏢 Tại văn phòng' : '—'}
                </div>
              </div>
            </div>

            {/* Notes Section if any */}
            <div style={{ background: selectedCell.notes ? 'var(--primary-subtle, rgba(59, 130, 246, 0.08))' : 'var(--bg-card)', border: '1px solid var(--border)', padding: '10px 12px', borderRadius: '8px', marginBottom: '12px' }}>
              <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '2px' }}>
                📝 Ghi Chú Ngày:
              </div>
              <div style={{ fontSize: '12px', color: selectedCell.notes ? 'var(--text)' : 'var(--text-muted)', fontStyle: selectedCell.notes ? 'normal' : 'italic' }}>
                {selectedCell.notes || 'Không có ghi chú thêm.'}
              </div>
            </div>

            {/* Audit History Box */}
            {selectedCell.audit_logs && selectedCell.audit_logs.length > 0 ? (
              <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1.5px solid #f59e0b', padding: '10px 12px', borderRadius: '8px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#d97706', fontWeight: 800, fontSize: '11.5px', marginBottom: '6px' }}>
                  <History size={14} /> ⚠️ LỊCH SỬ ĐIỀU CHỈNH CÔNG ({selectedCell.audit_logs.length} lần)
                </div>
                {selectedCell.audit_logs.map((log, idx) => (
                  <div key={idx} style={{ fontSize: '11.5px', color: 'var(--text)', borderTop: idx > 0 ? '1px dashed rgba(245, 158, 11, 0.3)' : 'none', paddingTop: idx > 0 ? '6px' : 0, marginTop: idx > 0 ? '6px' : 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Thay đổi: <code>[{log.old_symbol}]</code> ➔ <strong style={{ color: 'var(--primary)' }}>[{log.new_symbol}]</strong></span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '10.5px' }}>{new Date(log.modified_at).toLocaleString('vi-VN')}</span>
                    </div>
                    <div style={{ marginTop: '2px', color: 'var(--text-secondary)' }}>
                      👤 Người sửa: <strong>{log.modified_by_name}</strong>
                    </div>
                    <div style={{ marginTop: '2px', fontStyle: 'italic', color: '#b45309' }}>
                      💬 Lý do: "{log.reason}"
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', padding: '6px 10px', background: 'var(--bg-raised)', borderRadius: '6px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span>✨ Dữ liệu nguyên bản từ máy chấm công / GPS (Chưa qua điều chỉnh)</span>
              </div>
            )}

            {/* Chỉ Admin được chỉnh sửa; Leader và nhân viên chỉ xem chi tiết */}
            {isAdmin ? (
              <div style={{ borderTop: '1px solid var(--border-muted)', paddingTop: '12px', marginTop: '12px' }}>
                <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Edit2 size={13} color="var(--primary)" /> Điều Chỉnh Ký Hiệu & Giờ OT (Chỉ Admin)
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '8px', marginBottom: '8px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px' }}>Ký hiệu công mới *</label>
                    <select className="form-select" value={cellSymbol} onChange={e => setCellSymbol(e.target.value)} style={{ fontSize: '12.5px' }}>
                      <option value="x">x : Đủ 1 công (1.0)</option>
                      <option value="0,75x">0,75x : 3/4 công (0.75)</option>
                      <option value="0,5x">0,5x : 1/2 công (0.5)</option>
                      <option value="CT1">CT1 : CT Trong nước (1.0)</option>
                      <option value="CT2">CT2 : CT Nước ngoài (1.0)</option>
                      <option value="WFH">WFH : Work from home (1.0)</option>
                      <option value="P">P : Nghỉ phép năm</option>
                      <option value="O">O : Nghỉ ốm</option>
                      <option value="KL">KL : Nghỉ không lương</option>
                      <option value="L">L : Nghỉ Lễ công ty</option>
                      <option value="K">K : Khác</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      🔥 Giờ OT (Tăng ca)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="12"
                      className="form-input"
                      value={cellOtHours}
                      onChange={e => setCellOtHours(e.target.value)}
                      placeholder="0"
                      style={{ fontSize: '12.5px', padding: '6px 8px' }}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '10px' }}>
                  <label className="form-label" style={{ fontSize: '11px' }}>Lý do chỉnh sửa / duyệt giải trình * (Bắt buộc lưu lịch sử)</label>
                  <textarea
                    className="form-input"
                    rows={2}
                    value={cellReason}
                    onChange={e => setCellReason(e.target.value)}
                    placeholder="Nhập lý do điều chỉnh ký hiệu công hoặc duyệt giải trình quên chấm..."
                    style={{ fontSize: '12px' }}
                  />
                  <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '3px' }}>
                    💡 Giờ check-in/out do nhân sự tự chấm. Nếu quên chấm, Admin duyệt ký hiệu công & xác nhận số giờ OT theo giải trình.
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => setSelectedCell(null)} className="btn btn--ghost btn--full" style={{ padding: '8px' }}>Đóng</button>
                  <button onClick={handleSaveCellOverride} disabled={submittingCell} className="btn btn--primary btn--full" style={{ padding: '8px' }}>
                    {submittingCell ? <span className="spinner" /> : 'Lưu & Ghi Lịch Sử'}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button onClick={() => setSelectedCell(null)} className="btn btn--ghost btn--full" style={{ padding: '8px' }}>Đóng</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 2: AUDIT LOGS HISTORY MODAL */}
      {showAuditLogs && (
        <div className="modal-overlay" onClick={() => setShowAuditLogs(false)}>
          <div className="modal-sheet animate-slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px', margin: '0 auto' }}>
            <div className="modal-sheet__handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <History size={18} color="var(--primary)" />
                <h3 style={{ fontSize: '16px', fontWeight: 800 }}>Lịch Sử Chỉnh Sửa Ô Công</h3>
              </div>
              <button onClick={() => setShowAuditLogs(false)} className="btn btn--ghost" style={{ padding: '4px 8px' }}><X size={18} /></button>
            </div>

            <div style={{ overflowY: 'auto', maxHeight: '380px' }}>
              {auditLogs.length === 0 ? (
                <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  ⚪ Chưa có lịch sử chỉnh sửa công nào trong tháng {month}/{year}
                </div>
              ) : (
                auditLogs.map(log => (
                  <div key={log._id} className="card" style={{ padding: '10px 12px', marginBottom: '8px', background: 'var(--bg-raised)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 800, color: 'var(--primary)' }}>{log.user_name}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{new Date(log.modified_at).toLocaleString('vi-VN')}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text)' }}>
                      Ngày <strong>{log.date}</strong>: Thay đổi từ <code>[{log.old_symbol}]</code> ➔ <strong style={{ color: 'var(--green)' }}>[{log.new_symbol}]</strong>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      👤 Thực hiện bởi: <strong>{log.modified_by_name}</strong>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', fontStyle: 'italic' }}>
                      💬 Lý do: "{log.reason}"
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: UNIFIED EXPORT OPTIONS MODAL (EXCEL & PDF) */}
      {showExportModal && (
        <div className="modal-overlay" onClick={() => setShowExportModal(false)}>
          <div className="modal-sheet animate-slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: '460px', margin: '0 auto' }}>
            <div className="modal-sheet__handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Download size={20} color="var(--primary)" />
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0 }}>Xuất bảng chấm công</h3>
                  <div style={{ marginTop: '2px', color: 'var(--text-muted)', fontSize: '11px' }}>Tháng {String(month).padStart(2, '0')}/{year}</div>
                </div>
              </div>
              <button onClick={() => setShowExportModal(false)} className="btn btn--ghost" style={{ padding: '4px 8px' }}><X size={18} /></button>
            </div>

            {/* Step 1: Target type */}
            <div style={{ marginBottom: '14px' }}>
              <label className="form-label" style={{ marginBottom: '6px' }}>1. Nội dung cần xuất</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setExportTarget('matrix')}
                  style={{
                    padding: '10px 8px', borderRadius: '10px', border: exportTarget === 'matrix' ? '2px solid var(--primary)' : '1px solid var(--border)',
                    background: exportTarget === 'matrix' ? 'var(--primary-soft)' : 'var(--bg-raised)',
                    color: exportTarget === 'matrix' ? 'var(--primary)' : 'var(--text)',
                    fontWeight: 700, fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer'
                  }}
                >
                  <FileSpreadsheet size={15} /> Bảng công tổng hợp
                </button>
                <button
                  type="button"
                  onClick={() => { setExportTarget('individual'); setExportFormat('pdf'); setExportScope('single'); }}
                  style={{
                    padding: '10px 8px', borderRadius: '10px', border: exportTarget === 'individual' ? '2px solid var(--primary)' : '1px solid var(--border)',
                    background: exportTarget === 'individual' ? 'var(--primary-soft)' : 'var(--bg-raised)',
                    color: exportTarget === 'individual' ? 'var(--primary)' : 'var(--text)',
                    fontWeight: 700, fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer'
                  }}
                >
                  <FileText size={15} /> Phiếu cá nhân
                </button>
              </div>
            </div>

            {/* Step 2: Format selection */}
            <div style={{ marginBottom: '14px' }}>
              <label className="form-label" style={{ marginBottom: '6px' }}>2. Định dạng file</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setExportFormat('pdf')}
                  style={{
                    padding: '10px', borderRadius: '10px', border: exportFormat === 'pdf' ? '2px solid var(--primary)' : '1px solid var(--border)',
                    background: exportFormat === 'pdf' ? 'var(--primary-soft)' : 'var(--bg-raised)',
                    color: exportFormat === 'pdf' ? 'var(--primary)' : 'var(--text)',
                    fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer'
                  }}
                >
                  <FileType size={16} /> File PDF (.pdf)
                </button>
                <button
                  type="button"
                  onClick={() => { setExportFormat('excel'); setExportTarget('matrix'); }}
                  disabled={exportTarget === 'individual'}
                  style={{
                    padding: '10px', borderRadius: '10px', border: exportFormat === 'excel' ? '2px solid var(--primary)' : '1px solid var(--border)',
                    background: exportFormat === 'excel' ? 'var(--primary-soft)' : 'var(--bg-raised)',
                    color: exportFormat === 'excel' ? 'var(--primary)' : 'var(--text)',
                    fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: exportTarget === 'individual' ? 'not-allowed' : 'pointer', opacity: exportTarget === 'individual' ? 0.45 : 1
                  }}
                >
                  <FileSpreadsheet size={16} /> Excel (.xlsx)
                </button>
              </div>
            </div>

            {/* Step 3: Scope selection — individual export always requires one employee */}
            <div style={{ marginBottom: '16px' }}>
              <label className="form-label" style={{ marginBottom: '6px' }}>3. Phạm vi nhân sự</label>
              {exportTarget === 'matrix' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: exportScope === 'single' ? '10px' : 0 }}>
                  <button type="button" onClick={() => setExportScope('all')} className={`chip ${exportScope === 'all' ? 'active' : ''}`} style={{ justifyContent: 'center', margin: 0, minHeight: '38px' }}>Toàn công ty</button>
                  <button type="button" onClick={() => setExportScope('single')} className={`chip ${exportScope === 'single' ? 'active' : ''}`} style={{ justifyContent: 'center', margin: 0, minHeight: '38px' }}>Một nhân sự</button>
                </div>
              )}

              {(exportTarget === 'individual' || exportScope === 'single') && (
                <select className="form-select" value={selectedExportUser} onChange={e => setSelectedExportUser(e.target.value)}>
                  <option value="">Chọn nhân sự cần xuất</option>
                  {(matrixData?.staff_rows || []).map(s => (
                    <option key={s.id} value={s.id}>{s.code} — {s.full_name}</option>
                  ))}
                </select>
              )}
            </div>

            <div style={{ marginBottom: '14px', padding: '10px 12px', borderRadius: '10px', background: 'var(--bg-raised)', color: 'var(--text-secondary)', fontSize: '11px', lineHeight: 1.5 }}>
              {exportTarget === 'individual'
                ? 'Phiếu cá nhân: PDF khổ A4 dọc, gồm công tháng và chi tiết ngày chấm.'
                : exportFormat === 'excel'
                  ? 'Excel: phù hợp lưu trữ, lọc dữ liệu và tiếp tục tính toán.'
                  : 'PDF tổng hợp: khổ A4 ngang, phù hợp xem, in và ký duyệt.'}
            </div>

            {/* Execute Button */}
            <button
              onClick={handleExecuteExport}
              disabled={(exportTarget === 'individual' || exportScope === 'single') && !selectedExportUser}
              className="btn btn--primary btn--full"
              style={{ padding: '12px', justifyContent: 'center', gap: '8px', fontSize: '14px', fontWeight: 800 }}
            >
              {exportFormat === 'pdf' ? <FileType size={18} /> : <FileSpreadsheet size={18} />}
              {exportFormat === 'pdf' ? 'Tạo và xem trước PDF' : 'Tải file Excel'}
            </button>
          </div>
        </div>
      )}

      {/* MODAL 4: SERIOUS CORPORATE PDF PREVIEW & DOWNLOAD MODAL */}
      {showPdfPreviewModal && (
        <div className="modal-overlay" onClick={() => setShowPdfPreviewModal(false)}>
          <div
            className="modal-sheet animate-slide-up"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '90vw',
              width: '920px',
              margin: '0 auto',
            }}
          >
            <div className="modal-sheet__handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileType size={20} color="var(--primary)" />
                <h3 style={{ fontSize: '16px', fontWeight: 800 }}>Xem Trước File PDF Bảng Chấm Công Chuẩn A4 Sắc Nét</h3>
              </div>
              <button onClick={() => setShowPdfPreviewModal(false)} className="btn btn--ghost" style={{ padding: '4px 8px' }}><X size={18} /></button>
            </div>

            {/* PDF Embedded View */}
            <div style={{ border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', height: '65vh', background: '#525659', marginBottom: '14px' }}>
              {pdfBlobUrl ? (
                <iframe
                  title="PDF Preview"
                  src={pdfBlobUrl}
                  width="100%"
                  height="100%"
                  style={{ border: 'none' }}
                />
              ) : (
                <div style={{ padding: '40px', textAlign: 'center', color: '#ffffff' }}>Đang tạo file PDF...</div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', alignItems: 'center' }}>
              <button onClick={() => setShowPdfPreviewModal(false)} className="btn btn--ghost">Đóng</button>
              <button onClick={handleDownloadPdf} className="btn btn--primary" style={{ gap: '6px', padding: '8px 16px', fontSize: '13px', fontWeight: 800 }}>
                <Download size={16} /> 📄 Tải File PDF Về Máy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Dialog for Lock/Unlock */}
      {lockConfirm && (
        <ConfirmDialog
          title={`${lockConfirm.actionText}?`}
          message={`Bạn có chắc chắn muốn ${lockConfirm.actionText.toLowerCase()} cho ${lockConfirm.targetText}?`}
          confirmLabel={lockConfirm.actionText}
          danger={!lockConfirm.currentLocked}
          onConfirm={executeToggleLock}
          onCancel={() => setLockConfirm(null)}
        />
      )}
    </div>
  );
}
