// src/pages/ReportPage.jsx
// Báo cáo 5 tab: 🔒 Chốt Công (ET_Staff 2026) / 📄 Bảng Chi Tiết Cá Nhân (Mẫu Phiếu Chấm Công) / Tổng quan / Bảng tính công / Xếp hạng

import { useState, useEffect, useRef, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Download, Trophy, BarChart3, Calculator, TrendingUp, TrendingDown, Lock, Unlock, History, Edit2, CheckCircle2, X, AlertTriangle, FileSpreadsheet, FileText, UserCheck, Printer, Building2, ShieldCheck, FileType, Eye, Search, Filter } from 'lucide-react';
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
  const isAdminOrManager = isAdmin;

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [tab, setTab] = useState('timesheet_lock'); // 'timesheet_lock' | 'individual_detail' | 'overview' | 'payroll' | 'ranking'

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

  // Lock Confirm State
  const [lockConfirm, setLockConfirm] = useState(null); // { userId, currentLocked, actionText, targetText }

  // Edit Cell Modal State
  const [selectedCell, setSelectedCell] = useState(null);
  const [cellSymbol, setCellSymbol] = useState('x');
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

  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState('pdf'); // 'pdf' | 'excel'
  const [exportTarget, setExportTarget] = useState('matrix'); // 'matrix' (Bảng tổng hợp) | 'individual' (Phiếu chi tiết)
  const [exportScope, setExportScope] = useState('all'); // 'all' | 'single'
  const [selectedExportUser, setSelectedExportUser] = useState('');
  const [filterStaffId, setFilterStaffId] = useState('');

  // PDF Preview State
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
  const [pdfInstance, setPdfInstance] = useState(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [showPdfPreviewModal, setShowPdfPreviewModal] = useState(false);

  // Departments from Database API
  const [dbDepartments, setDbDepartments] = useState([]);

  useEffect(() => {
    api.get('/departments').then(res => {
      if (Array.isArray(res.data)) {
        setDbDepartments(res.data);
      }
    }).catch(() => {});
  }, []);

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

      return matchSearch && matchDept;
    });
  }, [matrixData, searchQuery, deptFilter]);

  useEffect(() => {
    loadTab();
  }, [month, year, tab, selectedDetailUserId]);

  const loadTab = async () => {
    setLoading(true);
    try {
      if (tab === 'timesheet_lock') {
        const { data } = await api.get(`/timesheet-lock/full-matrix?month=${month}&year=${year}`);
        setMatrixData(data);
      } else if (tab === 'individual_detail') {
        const queryUser = selectedDetailUserId || user?._id || user?.id;
        const { data } = await api.get(`/reports/individual-detail?user_id=${queryUser}&month=${month}&year=${year}`);
        setIndividualDetail(data);
      } else if (tab === 'overview') {
        const [rRes, tRes] = await Promise.all([
          api.get(`/reports/monthly?month=${month}&year=${year}`),
          api.get('/reports/trend?months=6'),
        ]);
        setReport(rRes.data);
        setTrend(tRes.data);
      } else if (tab === 'payroll') {
        const { data } = await api.get(`/reports/payroll?month=${month}&year=${year}`);
        setPayroll(data);
      } else if (tab === 'ranking') {
        const { data } = await api.get(`/reports/ranking?month=${month}&year=${year}`);
        setRanking(data);
      }
    } catch { toast.error('Lỗi tải dữ liệu'); }
    finally { setLoading(false); }
  };

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
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

  // Sửa Ô Công Có Ghi Lý Do
  const handleSaveCellOverride = async () => {
    if (!selectedCell) return;
    if (!cellReason.trim()) {
      toast.error('Vui lòng nhập Lý do chỉnh sửa công');
      return;
    }

    setSubmittingCell(true);
    try {
      await api.post('/timesheet-lock/override-cell', {
        user_id: selectedCell.user_id,
        date: selectedCell.dateStr,
        new_symbol: cellSymbol,
        reason: cellReason.trim(),
      });
      toast.success(`Đã điều chỉnh ngày ${selectedCell.dateStr} thành [${cellSymbol}] & lưu lịch sử! ✅`);
      setSelectedCell(null);
      setCellReason('');
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
      const fileNameSuffix = userObj ? `_${userObj.full_name.replace(/\s+/g, '_')}` : '';

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
    const isIndividual = (exportTarget === 'individual' || tab === 'individual_detail');
    const queryUser = targetUserId || (exportScope === 'single' ? selectedExportUser : '');
    setFilterStaffId(queryUser);
    setShowExportModal(false);
    setGeneratingPdf(true);
    toast.loading('Đang khởi tạo file PDF A4 sắc nét 100%...', { id: 'pdf' });

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
    if (exportFormat === 'excel') {
      exportExcel(exportScope === 'single' ? selectedExportUser : null);
    } else {
      handleGeneratePdfPreview(exportScope === 'single' ? selectedExportUser : null);
    }
  };

  // Tải File PDF Về Máy
  const handleDownloadPdf = () => {
    if (!pdfInstance) return;
    const userObj = matrixData?.staff_rows?.find(s => s.id === filterStaffId);
    const fileNameSuffix = userObj ? `_${userObj.full_name.replace(/\s+/g, '_')}` : '';

    pdfInstance.save(`ET_Staff_${year}_Thang_${String(month).padStart(2,'0')}${fileNameSuffix}_BangCong.pdf`);
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

  return (
    <div className="page">
      {/* Header */}
      <div className="header">
        <div className="header__inner">
          <div>
            <div className="header__title">Báo cáo & Chốt công</div>
            <div className="header__subtitle">Tháng {month}/{year} · ET Architects</div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => setShowExportModal(true)} disabled={generatingPdf} className="btn btn--primary" style={{ padding: '8px 16px', fontSize: '13px', gap: '6px' }}>
              {generatingPdf ? <span className="spinner" /> : <><Download size={16} /> 📥 Xuất Bảng Công (PDF/Excel)</>}
            </button>
            <HeaderActions />
          </div>
        </div>
      </div>

      <div className="container" style={{ paddingTop: '16px' }}>
        {/* Month Picker & Tabs */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
          {/* Month Stepper */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-card)', padding: '4px 10px', borderRadius: '10px', border: '1px solid var(--border)' }}>
            <button onClick={prevMonth} className="theme-toggle-btn" style={{ width: '28px', height: '28px' }}><ChevronLeft size={16} /></button>
            <span style={{ fontWeight: 800, fontSize: '14px', color: 'var(--primary)', minWidth: '110px', textAlign: 'center' }}>
              {MONTHS[month - 1]} {year}
            </span>
            <button onClick={nextMonth} className="theme-toggle-btn" style={{ width: '28px', height: '28px' }}><ChevronRight size={16} /></button>
          </div>

          {/* Navigation Tabs */}
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto' }}>
            <button onClick={() => setTab('timesheet_lock')} className={`chip${tab === 'timesheet_lock' ? ' active' : ''}`}>
              <Lock size={13} /> {isAdminOrManager ? 'Chốt Công ET_Staff' : 'Bảng Chấm Công Tổng Hợp'}
            </button>
            <button onClick={() => setTab('individual_detail')} className={`chip${tab === 'individual_detail' ? ' active' : ''}`}>
              <FileText size={13} /> Bảng Chi Tiết Cá Nhân
            </button>
            {isAdminOrManager && (
              <>
                <button onClick={() => setTab('overview')} className={`chip${tab === 'overview' ? ' active' : ''}`}>
                  <BarChart3 size={13} /> Tổng quan
                </button>
                <button onClick={() => setTab('payroll')} className={`chip${tab === 'payroll' ? ' active' : ''}`}>
                  <Calculator size={13} /> Bảng tính công
                </button>
                <button onClick={() => setTab('ranking')} className={`chip${tab === 'ranking' ? ' active' : ''}`}>
                  <Trophy size={13} /> Xếp hạng
                </button>
              </>
            )}
          </div>
        </div>

        {/* TAB 1: 🔒 CHỐT CÔNG MẪU THỦ CÔNG ET_STAFF 2026 */}
        {tab === 'timesheet_lock' && (
          <div>
            {/* Action Bar & Lock Status */}
            <div className="card" style={{ padding: '12px 16px', marginBottom: '14px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
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

                {isAdminOrManager && (
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
                )}
              </div>

              {/* Quick Matrix Filter Bar */}
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border-muted)', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
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
                {(searchQuery || deptFilter) && (
                  <button
                    onClick={() => { setSearchQuery(''); setDeptFilter(''); }}
                    className="btn btn--ghost"
                    style={{ padding: '4px 8px', fontSize: '11px' }}
                  >
                    Xóa lọc
                  </button>
                )}
              </div>
            </div>

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
                  bg = 'rgba(148, 163, 184, 0.15)'; color = 'var(--text-muted)';
                }

                return (
                  <span style={{
                    display: 'inline-block', padding: '1px 5px', borderRadius: '4px',
                    background: bg, color: color, fontWeight: 800, fontSize: '10px'
                  }}>
                    {symbol}
                  </span>
                );
              };

              return (
                /* BẢNG CHẤM CÔNG KHỚP 100% MẪU ET_STAFF 2026 */
                loading ? (
                  <div className="skeleton-card" style={{ height: '300px', borderRadius: '16px' }} />
                ) : !matrixData || !matrixData.staff_rows ? (
                  <div className="card empty-state"><div className="empty-state__title">Không có dữ liệu chốt công</div></div>
                ) : (
                  <div ref={timesheetRef} className="card animate-fade-in" style={{ padding: '12px', overflowX: 'auto', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '14px' }}>
                    {/* Corporate Header Banner */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '2px solid var(--primary)', paddingBottom: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Building2 size={24} color="var(--primary)" />
                        <div>
                          <div style={{ fontSize: '16px', fontWeight: 900, color: 'var(--primary)', letterSpacing: '0.5px' }}>
                            BẢNG CHẤM CÔNG NHÂN SỰ — ET ARCHITECTS
                          </div>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                            THÁNG {month} NĂM {year} {filterStaffId && `(Nhân sự: ${matrixData.staff_rows.find(s=>s.id===filterStaffId)?.full_name})`}
                          </div>
                        </div>
                      </div>
                      <div style={{ fontSize: '11px', textAlign: 'right', color: 'var(--text-muted)' }}>
                        <div>Mẫu quản lý: <strong>ET_Staff {year}</strong></div>
                        <div>Trạng thái: <strong style={{ color: matrixData.global_locked ? 'var(--red)' : 'var(--green)' }}>{matrixData.global_locked ? 'ĐÃ CHỐT CÔNG' : 'ĐANG CẬP NHẬT'}</strong></div>
                      </div>
                    </div>

                    <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'separate', borderSpacing: 0, textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <thead>
                        {/* Row 1 Header: Titles & Weekdays with Sticky Columns */}
                        <tr style={{ background: 'var(--bg-raised)', color: 'var(--text)', fontWeight: 800 }}>
                          <th className="table-sticky-col-1" style={{ padding: '8px 10px', textAlign: 'left', minWidth: '55px', borderBottom: '1px solid var(--border)' }}>ID</th>
                          <th className="table-sticky-col-2" style={{ padding: '8px 10px', textAlign: 'left', minWidth: '140px', borderBottom: '1px solid var(--border)' }}>NHÂN SỰ</th>
                          <th className="table-sticky-col-3" style={{ padding: '8px 10px', minWidth: '70px', borderBottom: '1px solid var(--border)' }}>NV</th>

                          {/* Summary Columns Header */}
                          <th style={{ padding: '6px 8px', background: 'rgba(99, 102, 241, 0.08)', color: '#10b981', borderBottom: '1px solid var(--border)', borderLeft: '1px solid var(--border)' }}>NLV tại VP</th>
                          <th style={{ padding: '6px 8px', background: 'rgba(99, 102, 241, 0.08)', color: '#3b82f6', borderBottom: '1px solid var(--border)' }}>CT Trong nước</th>
                          <th style={{ padding: '6px 8px', background: 'rgba(99, 102, 241, 0.08)', color: '#8b5cf6', borderBottom: '1px solid var(--border)' }}>CT Nước ngoài</th>
                          <th style={{ padding: '6px 8px', background: 'rgba(99, 102, 241, 0.08)', color: '#06b6d4', borderBottom: '1px solid var(--border)' }}>Work from home</th>
                          <th style={{ padding: '6px 8px', background: 'rgba(99, 102, 241, 0.08)', color: '#10b981', borderBottom: '1px solid var(--border)' }}>Nghỉ phép</th>
                          <th style={{ padding: '6px 8px', background: 'rgba(99, 102, 241, 0.08)', color: '#ef4444', borderBottom: '1px solid var(--border)' }}>Nghỉ ốm</th>
                          <th style={{ padding: '6px 8px', background: 'rgba(99, 102, 241, 0.08)', color: '#64748b', borderBottom: '1px solid var(--border)' }}>Nghỉ không lương</th>
                          <th style={{ padding: '6px 8px', background: 'rgba(99, 102, 241, 0.08)', color: '#94a3b8', borderBottom: '1px solid var(--border)' }}>Khác</th>

                          {/* Days Weekday Row */}
                          {matrixData.header_days.map(hd => {
                            const isSun = hd.weekday === 'CN' || hd.isSunday;
                            return (
                              <th key={hd.day} style={{
                                padding: '4px 6px',
                                background: isSun ? 'rgba(239, 68, 68, 0.12)' : 'var(--bg-raised)',
                                color: isSun ? '#ef4444' : 'var(--text-muted)',
                                minWidth: '28px', borderBottom: '1px solid var(--border)', borderLeft: '1px solid var(--border-muted)'
                              }}>
                                {hd.weekday}
                              </th>
                            );
                          })}

                          {isAdminOrManager && <th style={{ padding: '8px 10px', minWidth: '50px', borderBottom: '1px solid var(--border)' }}>Chốt</th>}
                        </tr>

                        {/* Row 2 Header: Days 01..31 */}
                        <tr style={{ background: 'var(--bg-card)', color: 'var(--text)', fontWeight: 800 }}>
                          <th colSpan="3" className="table-sticky-col-1" style={{ padding: '4px 10px', textAlign: 'left', borderBottom: '2px solid var(--primary)' }}>BẢNG CHẤM CÔNG THÁNG</th>
                          <th colSpan="8" style={{ padding: '4px 8px', fontSize: '10px', color: 'var(--primary)', background: 'rgba(99, 102, 241, 0.12)', borderBottom: '2px solid var(--primary)' }}>TỔNG CỘNG THEO LOẠI CÔNG</th>

                          {matrixData.header_days.map(hd => {
                            const isSun = hd.weekday === 'CN' || hd.isSunday;
                            return (
                              <th key={hd.day} style={{
                                padding: '4px 6px',
                                background: isSun ? 'rgba(239, 68, 68, 0.15)' : 'var(--bg-card)',
                                color: isSun ? '#ef4444' : 'var(--text)',
                                borderBottom: '2px solid var(--primary)', borderLeft: '1px solid var(--border-muted)'
                              }}>
                                {hd.dayStr}
                              </th>
                            );
                          })}

                          {isAdminOrManager && <th style={{ padding: '4px', borderBottom: '2px solid var(--primary)' }}>—</th>}
                        </tr>
                      </thead>

                      <tbody>
                        {displayedStaffRows.map((r, idx) => (
                          <tr key={r.id} style={{ borderBottom: '1px solid var(--border-muted)', background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}>
                            <td className="table-sticky-col-1" style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 800, color: 'var(--primary)' }}>{r.code}</td>
                            <td className="table-sticky-col-2" style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: 'var(--text)' }}>{r.full_name}</td>
                            <td className="table-sticky-col-3" style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>{r.role_label}</td>

                            {/* Summary Column Values */}
                            <td style={{ padding: '6px 4px', borderLeft: '1px solid var(--border-muted)' }}>{renderSummaryVal(r.nlv_office, '#10b981')}</td>
                            <td style={{ padding: '6px 4px' }}>{renderSummaryVal(r.ct_domestic, '#3b82f6')}</td>
                            <td style={{ padding: '6px 4px' }}>{renderSummaryVal(r.ct_foreign, '#8b5cf6')}</td>
                            <td style={{ padding: '6px 4px' }}>{renderSummaryVal(r.wfh, '#06b6d4')}</td>
                            <td style={{ padding: '6px 4px' }}>{renderSummaryVal(r.annual_leave, '#8b5cf6')}</td>
                            <td style={{ padding: '6px 4px' }}>{renderSummaryVal(r.sick_leave, '#ef4444')}</td>
                            <td style={{ padding: '6px 4px' }}>{renderSummaryVal(r.unpaid_leave, '#64748b')}</td>
                            <td style={{ padding: '6px 4px' }}>{renderSummaryVal(r.other_leave, '#94a3b8')}</td>

                            {/* Day Cell Symbols */}
                            {r.days.map(d => {
                              const hdObj = matrixData.header_days.find(hd => hd.day === d.day);
                              const isSun = hdObj?.weekday === 'CN' || hdObj?.isSunday;
                              return (
                                <td
                                  key={d.day}
                                  onClick={() => {
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
                                    });
                                    setCellSymbol(d.symbol || 'x');
                                    setCellReason('');
                                  }}
                                  style={{
                                    padding: '6px 2px',
                                    cursor: 'pointer',
                                    background: isSun ? 'rgba(239, 68, 68, 0.03)' : 'transparent',
                                    borderLeft: '1px solid var(--border-muted)',
                                    position: 'relative',
                                  }}
                                  title={`Bấm xem chi tiết ngày ${d.dateStr}${d.is_modified ? ' (Đã sửa công)' : ''}`}
                                >
                                  {renderDaySymbol(d.symbol, isSun)}
                                  {d.is_modified && (
                                    <span
                                      style={{
                                        position: 'absolute',
                                        top: '2px',
                                        right: '2px',
                                        width: '5px',
                                        height: '5px',
                                        borderRadius: '50%',
                                        background: '#f59e0b',
                                      }}
                                      title="Ô công đã được điều chỉnh"
                                    />
                                  )}
                                </td>
                              );
                            })}

                            {/* Lock Action Button per Staff */}
                            {isAdminOrManager && (
                              <td style={{ padding: '6px' }}>
                                <button
                                  onClick={() => handleToggleLock(r.id, r.is_locked)}
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
                          <td colSpan="3" className="table-sticky-col-1" style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--primary)', fontWeight: 800 }}>
                            TỔNG CỘNG HỆ THỐNG ({displayedStaffRows.length} NV)
                          </td>
                          <td style={{ padding: '6px 4px', borderLeft: '1px solid var(--border-muted)' }}>{renderSummaryVal(displayedStaffRows.reduce((s, r) => s + r.nlv_office, 0), '#10b981')}</td>
                          <td style={{ padding: '6px 4px' }}>{renderSummaryVal(displayedStaffRows.reduce((s, r) => s + r.ct_domestic, 0), '#3b82f6')}</td>
                          <td style={{ padding: '6px 4px' }}>{renderSummaryVal(displayedStaffRows.reduce((s, r) => s + r.ct_foreign, 0), '#8b5cf6')}</td>
                          <td style={{ padding: '6px 4px' }}>{renderSummaryVal(displayedStaffRows.reduce((s, r) => s + r.wfh, 0), '#06b6d4')}</td>
                          <td style={{ padding: '6px 4px' }}>{renderSummaryVal(displayedStaffRows.reduce((s, r) => s + r.annual_leave, 0), '#8b5cf6')}</td>
                          <td style={{ padding: '6px 4px' }}>{renderSummaryVal(displayedStaffRows.reduce((s, r) => s + r.sick_leave, 0), '#ef4444')}</td>
                          <td style={{ padding: '6px 4px' }}>{renderSummaryVal(displayedStaffRows.reduce((s, r) => s + r.unpaid_leave, 0), '#64748b')}</td>
                          <td style={{ padding: '6px 4px' }}>{renderSummaryVal(displayedStaffRows.reduce((s, r) => s + r.other_leave, 0), '#94a3b8')}</td>
                          {matrixData.header_days.map(hd => (
                            <td key={hd.day} style={{ padding: '6px 4px', fontSize: '10px', color: 'var(--text-muted)', opacity: 0.2 }}>—</td>
                          ))}
                          {isAdminOrManager && <td style={{ padding: '6px', color: 'var(--text-muted)', opacity: 0.2 }}>—</td>}
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )
              );
            })()}
          </div>
        )}

        {/* TAB 2: 📄 BẢNG CHI TIẾT CHẤM CÔNG CÁ NHÂN (MẪU PHIẾU CÔNG) */}
        {tab === 'individual_detail' && (
          <div className="animate-fade-in">
            {/* Staff Selector dropdown for Admin */}
            {isAdminOrManager && matrixData?.staff_rows && (
              <div className="card" style={{ padding: '12px 16px', marginBottom: '16px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <UserCheck size={16} color="var(--primary)" /> Chọn nhân viên xem chi tiết:
                  </span>
                  <select
                    className="form-select"
                    style={{ width: '280px', fontSize: '13px', padding: '6px 12px', fontWeight: 600 }}
                    value={selectedDetailUserId || user._id}
                    onChange={e => setSelectedDetailUserId(e.target.value)}
                  >
                    {matrixData.staff_rows.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.code} - {s.full_name} ({s.role_label})
                      </option>
                    ))}
                  </select>
                  <button onClick={handlePrintIndividual} className="btn btn--ghost" style={{ padding: '6px 14px', fontSize: '12px', marginLeft: 'auto', gap: '6px' }}>
                    <Printer size={15} /> In phiếu công
                  </button>
                </div>
              </div>
            )}

            {loading ? (
              <div className="skeleton-card" style={{ height: '400px', borderRadius: '16px' }} />
            ) : !individualDetail ? (
              <div className="card empty-state"><div className="empty-state__title">Không có dữ liệu phiếu công</div></div>
            ) : (
              <div ref={individualRef} className="card animate-fade-in" style={{ padding: '24px', background: '#ffffff', color: '#0f172a', fontFamily: 'Arial, sans-serif', fontSize: '11px', border: '1px solid #cbd5e1', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
                {/* Title Banner */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '3px solid #1e293b', paddingBottom: '12px', marginBottom: '16px' }}>
                  <div>
                    <div style={{ fontSize: '20px', fontWeight: 900, textTransform: 'uppercase', color: '#1e293b', letterSpacing: '0.5px' }}>
                      BẢNG CHI TIẾT CHẤM CÔNG CÁ NHÂN
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#475569', marginTop: '2px' }}>
                      THÁNG {month} NĂM {year} · ET ARCHITECTS
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: '11px', color: '#64748b' }}>
                    <div>Mã NV: <strong style={{ color: '#2563eb', fontSize: '13px' }}>{indUser.id}</strong></div>
                    <div>Nhân sự: <strong style={{ color: '#0f172a', fontSize: '13px' }}>{indUser.full_name}</strong></div>
                    <div>Phòng ban: <strong>{indUser.department_name}</strong></div>
                  </div>
                </div>

                {/* Summary Cards Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', marginBottom: '16px' }}>
                  <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748b' }}>TỔNG GIỜ LÀM</div>
                    <div style={{ fontSize: '18px', fontWeight: 900, color: '#059669', marginTop: '2px' }}>{indSum.total_work_hours}h</div>
                  </div>
                  <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748b' }}>NGÀY THƯỜNG</div>
                    <div style={{ fontSize: '18px', fontWeight: 900, color: '#2563eb', marginTop: '2px' }}>{indSum.work_hours_normal}h</div>
                  </div>
                  <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748b' }}>TỔNG TĂNG CA</div>
                    <div style={{ fontSize: '18px', fontWeight: 900, color: '#7c3aed', marginTop: '2px' }}>
                      {((indSum.ot1_hours || 0) + (indSum.ot2_hours || 0) + (indSum.ot3_hours || 0)).toFixed(1)}h
                    </div>
                  </div>
                  <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748b' }}>ĐẦY ĐỦ CÔNG</div>
                    <div style={{ fontSize: '18px', fontWeight: 900, color: '#059669', marginTop: '2px' }}>
                      {indLogs.filter(r => parseFloat(r.workCredit) >= 1 || r.workCredit === 'x').length} ngày
                    </div>
                  </div>
                </div>

                {/* Main Detailed Logs Table */}
                <div style={{ fontSize: '12px', marginBottom: '8px', fontWeight: 800, color: '#1e293b' }}>
                  📋 Nhật ký điểm danh chi tiết từng ngày
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #cbd5e1', fontSize: '11px', textAlign: 'center' }}>
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

                      let creditBadge = <span style={{ color: '#94a3b8' }}>0 công (Vắng)</span>;
                      if (numCredit >= 1 || row.workCredit === '1.0' || row.workCredit === 'x') {
                        creditBadge = <span style={{ color: '#059669', fontWeight: 800 }}>1.0 công (Đủ công)</span>;
                      } else if (numCredit > 0) {
                        creditBadge = <span style={{ color: '#d97706', fontWeight: 800 }}>{numCredit} công (Nửa ngày)</span>;
                      } else if (row.workCredit && row.workCredit !== '0' && row.workCredit !== '—') {
                        creditBadge = <span style={{ color: '#7c3aed', fontWeight: 800 }}>{row.workCredit}</span>;
                      }

                      return (
                        <tr key={row.day} style={{ background: isSun ? '#fef2f2' : row.isWeekend ? '#f8fafc' : '#ffffff', color: '#0f172a' }}>
                          <td style={{ border: '1px solid #cbd5e1', padding: '6px 4px', fontWeight: 700 }}>{row.dateFormatted}</td>
                          <td style={{ border: '1px solid #cbd5e1', padding: '6px 4px', fontWeight: 700, color: isSun ? '#dc2626' : '#0f172a' }}>{row.weekday}</td>
                          <td style={{ border: '1px solid #cbd5e1', padding: '6px 4px', color: '#059669', fontWeight: 700 }}>{inTime}</td>
                          <td style={{ border: '1px solid #cbd5e1', padding: '6px 4px', color: '#2563eb', fontWeight: 700 }}>{outTime}</td>
                          <td style={{ border: '1px solid #cbd5e1', padding: '6px 4px', fontWeight: 700, color: '#475569' }}>{row.workCredit || '—'}</td>
                          <td style={{ border: '1px solid #cbd5e1', padding: '6px 4px' }}>{creditBadge}</td>
                          <td style={{ border: '1px solid #cbd5e1', padding: '6px 4px', fontWeight: 800 }}>{row.totalHours ? `${row.totalHours}h` : '—'}</td>
                          <td style={{ border: '1px solid #cbd5e1', padding: '6px 4px', fontWeight: 800, color: otVal > 0 ? '#7c3aed' : '#cbd5e1' }}>{otStr}</td>
                          <td style={{ border: '1px solid #cbd5e1', padding: '6px 4px', color: '#475569' }}>{row.locationName}</td>
                        </tr>
                      );
                    })}
                    {/* Bottom Summary Row */}
                    <tr style={{ fontWeight: 'bold', background: '#e2e8f0', color: '#0f172a' }}>
                      <td colSpan="6" style={{ border: '1px solid #1e293b', padding: '8px 10px', textAlign: 'left' }}>
                        TỔNG CỘNG THÁNG {month}/{year}:
                      </td>
                      <td colSpan="3" style={{ border: '1px solid #1e293b', padding: '8px', textAlign: 'center', color: '#059669', fontSize: '12px' }}>
                        {indSum.total_work_hours} giờ làm việc
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Signature Block */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px', textAlign: 'center' }}>
                  <div style={{ minWidth: '220px' }}>
                    <div style={{ fontWeight: 'bold', color: '#64748b', fontSize: '11px', marginBottom: '4px' }}>XÁC NHẬN CỦA NHÂN VIÊN</div>
                    <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '45px' }}>(Ký và ghi rõ họ tên)</div>
                    <div style={{ fontWeight: 'bold', textDecoration: 'underline', color: '#0f172a', fontSize: '13px' }}>{indUser.full_name}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: OVERVIEW */}
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
            {(trend?.months || trend?.monthly_stats) && (trend?.months || trend?.monthly_stats).length > 0 && (
              <div className="card" style={{ padding: '16px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '14px', fontWeight: 800, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <BarChart3 size={18} color="var(--primary)" /> Biểu đồ xu hướng đúng giờ 6 tháng gần nhất
                </div>
                <div style={{ width: '100%', height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trend.months || trend.monthly_stats}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-muted)" />
                      <XAxis dataKey="label" stroke="var(--text-secondary)" fontSize={12} />
                      <YAxis stroke="var(--text-secondary)" fontSize={12} domain={[0, 100]} />
                      <Tooltip
                        contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px' }}
                        formatter={(val) => [`${val}%`, 'Tỷ lệ đúng giờ']}
                      />
                      <Bar dataKey="attendance_rate" fill="var(--primary)" radius={[6, 6, 0, 0]}>
                        {(trend.months || trend.monthly_stats).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={(entry.attendance_rate ?? entry.on_time_rate) >= 90 ? '#10b981' : (entry.attendance_rate ?? entry.on_time_rate) >= 80 ? '#3b82f6' : '#f59e0b'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: PAYROLL */}
        {tab === 'payroll' && payroll?.payroll && (
          <div className="card animate-fade-in" style={{ padding: '16px', overflowX: 'auto', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid var(--border-muted)', paddingBottom: '10px' }}>
              <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calculator size={18} /> Bảng Tổng Hợp Công Tính Lương (Nhân Sự Đang Làm Việc) — Tháng {month}/{year}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Nhân sự đang làm việc: <strong>{payroll.payroll.length}</strong>
              </div>
            </div>

            <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse', textAlign: 'left', whiteSpace: 'nowrap' }}>
              <thead>
                <tr style={{ background: 'var(--bg-raised)', color: 'var(--text-secondary)', fontWeight: 700, borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '10px 12px' }}>HỌ VÀ TÊN</th>
                  <th style={{ padding: '10px 12px' }}>PHÒNG BAN</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center' }}>NGÀY ĐI LÀM</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center' }}>GIỜ OT</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center' }}>LƯỢT ĐI MUỘN</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center' }}>TRỪ CÔNG MUỘN</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>CÔNG THỰC NHẬN</th>
                </tr>
              </thead>
              <tbody>
                {payroll.payroll.map((p, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border-muted)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--text)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--primary-soft)', color: 'var(--primary)', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px' }}>
                          {p.full_name?.charAt(0)}
                        </div>
                        {p.full_name}
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>{p.department_name || 'KTS'}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 800, color: 'var(--green)' }}>{p.present_days ?? p.work_days_credit ?? 0} ngày</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: '#8b5cf6' }}>{p.ot_hours || 0}h</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', color: p.late_days > 0 ? 'var(--yellow)' : 'var(--text-muted)' }}>{p.late_days || 0} lần ({p.total_late_minutes || 0}p)</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', color: (p.penalty_days > 0 || p.late_penalty_credit > 0) ? 'var(--red)' : 'var(--text-muted)', fontWeight: 700 }}>
                      {(p.penalty_days > 0 || p.late_penalty_credit > 0) ? `-${p.penalty_days || p.late_penalty_credit}` : '0'}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: '6px', background: 'var(--primary-soft)', color: 'var(--primary)', fontWeight: 900, fontSize: '13px' }}>
                        {p.total_work_days ?? p.final_payroll_credit ?? 0} công
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 5: RANKING LEADERBOARD */}
        {tab === 'ranking' && (ranking?.ranking || ranking?.rankings) && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Top Header Card */}
            <div className="card" style={{ padding: '14px 16px', background: 'var(--bg-card)', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Trophy size={20} color="var(--yellow)" /> Bảng Xếp Hạng Kỷ Luật Chấm Công (Đang Làm Việc) — Tháng {month}/{year}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Cập nhật tự động theo tỷ lệ đúng giờ
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
              {(ranking.ranking || ranking.rankings).map((r) => {
                const medal = RANK_MEDALS[r.rank];
                const pRate = r.punctuality_rate ?? r.on_time_rate ?? 0;
                const scoreColor = pRate >= 90 ? 'var(--green)' : pRate >= 75 ? 'var(--yellow)' : 'var(--red)';

                return (
                  <div
                    key={r.user_id}
                    className="card"
                    style={{
                      padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      background: r.rank === 1 ? 'rgba(245, 158, 11, 0.08)' : 'var(--bg-card)',
                      border: r.rank === 1 ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid var(--border)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ fontSize: '24px', fontWeight: 900, width: '32px', textAlign: 'center' }}>
                        {medal || <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>#{r.rank}</span>}
                      </div>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text)' }}>{r.full_name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{r.department_name || 'KTS'}</div>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '16px', fontWeight: 900, color: 'var(--primary)' }}>{r.score} điểm</div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: scoreColor, marginTop: '2px' }}>
                        Đúng giờ: {pRate}%
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
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
              {displayedStaffRows.map((r, idx) => {
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
                  TỔNG CỘNG HỆ THỐNG ({displayedStaffRows.length} NV)
                </td>
                <td style={{ padding: '8px 6px', border: '1px solid #cbd5e1', color: '#059669' }}>
                  {displayedStaffRows.reduce((s, r) => s + r.nlv_office, 0).toFixed(2)}
                </td>
                <td style={{ padding: '8px 6px', border: '1px solid #cbd5e1', color: '#2563eb' }}>
                  {displayedStaffRows.reduce((s, r) => s + r.ct_domestic, 0).toFixed(2)}
                </td>
                <td style={{ padding: '8px 6px', border: '1px solid #cbd5e1', color: '#7c3aed' }}>
                  {displayedStaffRows.reduce((s, r) => s + r.ct_foreign, 0).toFixed(2)}
                </td>
                <td style={{ padding: '8px 6px', border: '1px solid #cbd5e1', color: '#0891b2' }}>
                  {displayedStaffRows.reduce((s, r) => s + r.wfh, 0).toFixed(2)}
                </td>
                <td style={{ padding: '8px 6px', border: '1px solid #cbd5e1', color: '#7c3aed' }}>
                  {displayedStaffRows.reduce((s, r) => s + r.annual_leave, 0).toFixed(2)}
                </td>
                <td style={{ padding: '8px 6px', border: '1px solid #cbd5e1', color: '#dc2626' }}>
                  {displayedStaffRows.reduce((s, r) => s + r.sick_leave, 0).toFixed(2)}
                </td>
                <td style={{ padding: '8px 6px', border: '1px solid #cbd5e1', color: '#475569' }}>
                  {displayedStaffRows.reduce((s, r) => s + r.unpaid_leave, 0).toFixed(2)}
                </td>
                <td style={{ padding: '8px 6px', border: '1px solid #cbd5e1', color: '#64748b' }}>
                  {displayedStaffRows.reduce((s, r) => s + r.other_leave, 0).toFixed(2)}
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
                  <div style={{ marginTop: '2px' }}>
                    <span className="badge badge--neutral" style={{ fontSize: '11px', fontWeight: 800 }}>
                      Ký hiệu: [{selectedCell.current_symbol || '—'}]
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Daily Attendance Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
              <div className="card" style={{ padding: '10px', background: 'var(--bg-card)' }}>
                <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginBottom: '3px' }}>🕒 Giờ Check-in / Out</div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>
                  {selectedCell.check_in_time || '—'} ➔ {selectedCell.check_out_time || '—'}
                </div>
                {selectedCell.is_late && (
                  <div style={{ fontSize: '10.5px', color: 'var(--red)', fontWeight: 600, marginTop: '2px' }}>
                    ⚠️ Muộn {selectedCell.late_minutes} phút
                  </div>
                )}
              </div>

              <div className="card" style={{ padding: '10px', background: 'var(--bg-card)' }}>
                <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginBottom: '3px' }}>⏱️ Thời Gian Làm Việc</div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary)' }}>
                  {selectedCell.total_hours || 0} giờ
                  {selectedCell.ot_hours > 0 && (
                    <span style={{ fontSize: '11px', color: '#ef4444', marginLeft: '4px' }}>(+{selectedCell.ot_hours}h OT)</span>
                  )}
                </div>
                <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {selectedCell.check_in_type === 'wfh' ? '🏠 Work from home' :
                   selectedCell.check_in_type === 'site' ? '🚗 Đi công tác' : '🏢 Tại văn phòng'}
                </div>
              </div>
            </div>

            {/* Notes Section if any */}
            {selectedCell.notes && (
              <div style={{ background: 'var(--primary-subtle, rgba(59, 130, 246, 0.08))', border: '1px solid var(--primary-soft)', padding: '10px 12px', borderRadius: '8px', marginBottom: '12px' }}>
                <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '2px' }}>
                  📝 Ghi Chú Ngày Điểm Danh:
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text)' }}>
                  {selectedCell.notes}
                </div>
              </div>
            )}

            {/* Audit History Box (If cell was modified) */}
            {selectedCell.audit_logs && selectedCell.audit_logs.length > 0 && (
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
            )}

            {/* Admin / Leader Edit Section */}
            {isAdminOrManager ? (
              <div style={{ borderTop: '1px solid var(--border-muted)', paddingTop: '12px', marginTop: '12px' }}>
                <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Edit2 size={13} color="var(--primary)" /> Điều Chỉnh Ký Hiệu Ô Công (Admin)
                </div>

                <div className="form-group" style={{ marginBottom: '8px' }}>
                  <label className="form-label" style={{ fontSize: '11px' }}>Ký hiệu công mới *</label>
                  <select className="form-select" value={cellSymbol} onChange={e => setCellSymbol(e.target.value)} style={{ fontSize: '12.5px' }}>
                    <option value="x">x : Đủ công (1.0)</option>
                    <option value="0,75x">0,75x : 3/4 công (0.75)</option>
                    <option value="0,5x">0,5x : 1/2 công (0.5)</option>
                    <option value="CT1">CT1 : CT Trong nước</option>
                    <option value="CT2">CT2 : CT Nước ngoài</option>
                    <option value="WFH">WFH : Work from home</option>
                    <option value="P">P : Nghỉ phép</option>
                    <option value="O">O : Nghỉ ốm</option>
                    <option value="KL">KL : Nghỉ không lương</option>
                    <option value="K">K : Khác</option>
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: '10px' }}>
                  <label className="form-label" style={{ fontSize: '11px' }}>Lý do chỉnh sửa * (Bắt buộc)</label>
                  <textarea
                    className="form-input"
                    rows={2}
                    value={cellReason}
                    onChange={e => setCellReason(e.target.value)}
                    placeholder="Nhập lý do điều chỉnh ô công..."
                    style={{ fontSize: '12px' }}
                  />
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
                <h3 style={{ fontSize: '16px', fontWeight: 800 }}>Tùy Chọn Xuất Bảng Chấm Công</h3>
              </div>
              <button onClick={() => setShowExportModal(false)} className="btn btn--ghost" style={{ padding: '4px 8px' }}><X size={18} /></button>
            </div>

            {/* Step 1: Target type */}
            <div style={{ marginBottom: '14px' }}>
              <label className="form-label" style={{ marginBottom: '6px' }}>1. Chọn loại bảng công cần xuất</label>
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
                  <Lock size={15} /> Bảng Tổng Hợp ET_Staff
                </button>
                <button
                  type="button"
                  onClick={() => setExportTarget('individual')}
                  style={{
                    padding: '10px 8px', borderRadius: '10px', border: exportTarget === 'individual' ? '2px solid var(--primary)' : '1px solid var(--border)',
                    background: exportTarget === 'individual' ? 'var(--primary-soft)' : 'var(--bg-raised)',
                    color: exportTarget === 'individual' ? 'var(--primary)' : 'var(--text)',
                    fontWeight: 700, fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer'
                  }}
                >
                  <FileText size={15} /> Phiếu Cá Nhân Chi Tiết
                </button>
              </div>
            </div>

            {/* Step 2: Format selection */}
            <div style={{ marginBottom: '14px' }}>
              <label className="form-label" style={{ marginBottom: '6px' }}>2. Chọn định dạng file xuất</label>
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
                  onClick={() => setExportFormat('excel')}
                  style={{
                    padding: '10px', borderRadius: '10px', border: exportFormat === 'excel' ? '2px solid var(--primary)' : '1px solid var(--border)',
                    background: exportFormat === 'excel' ? 'var(--primary-soft)' : 'var(--bg-raised)',
                    color: exportFormat === 'excel' ? 'var(--primary)' : 'var(--text)',
                    fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer'
                  }}
                >
                  <FileSpreadsheet size={16} /> Excel (.xlsx)
                </button>
              </div>
            </div>

            {/* Step 3: Scope selection */}
            <div style={{ marginBottom: '16px' }}>
              <label className="form-label" style={{ marginBottom: '6px' }}>3. Chọn phạm vi nhân sự</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                  <input type="radio" name="exportScope" checked={exportScope === 'all'} onChange={() => setExportScope('all')} />
                  <strong>📊 Toàn bộ nhân sự (Toàn công ty)</strong>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                  <input type="radio" name="exportScope" checked={exportScope === 'single'} onChange={() => setExportScope('single')} />
                  <strong>👤 Chọn theo từng nhân viên</strong>
                </label>
              </div>

              {exportScope === 'single' && (
                <div style={{ marginTop: '10px' }}>
                  <select
                    className="form-select"
                    value={selectedExportUser}
                    onChange={e => setSelectedExportUser(e.target.value)}
                  >
                    <option value="">-- Chọn nhân viên cần xuất --</option>
                    {(matrixData?.staff_rows || []).map(s => (
                      <option key={s.id} value={s.id}>
                        {s.code} - {s.full_name} ({s.role_label})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Execute Button */}
            <button
              onClick={handleExecuteExport}
              disabled={exportScope === 'single' && !selectedExportUser}
              className="btn btn--primary btn--full"
              style={{ padding: '12px', justifyContent: 'center', gap: '8px', fontSize: '14px', fontWeight: 800 }}
            >
              {exportFormat === 'pdf' ? <FileType size={18} /> : <FileSpreadsheet size={18} />}
              {exportFormat === 'pdf' ? 'Tạo & Xem Trước File PDF (Sắc Nét A4)' : 'Xuất File Excel Ngay'}
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
