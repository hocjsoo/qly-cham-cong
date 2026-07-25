// src/pages/ReportPage.jsx
// Báo cáo 5 tab: 🔒 Chốt Công (ET_Staff 2026) / 📄 Bảng Chi Tiết Cá Nhân (Mẫu Phiếu Chấm Công) / Tổng quan / Bảng tính công / Xếp hạng

import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Download, Trophy, BarChart3, Calculator, TrendingUp, TrendingDown, Lock, Unlock, History, Edit2, CheckCircle2, X, AlertTriangle, FileSpreadsheet, FileText, UserCheck, Printer, Building2, ShieldCheck, FileType, Eye } from 'lucide-react';
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

export default function ReportPage() {
  const { user } = useAuthStore();
  const isAdminOrManager = ['admin', 'manager'].includes(user?.role);

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

  useEffect(() => { loadTab(); }, [month, year, tab, selectedDetailUserId]);

  const loadTab = async () => {
    setLoading(true);
    try {
      if (tab === 'timesheet_lock') {
        const { data } = await api.get(`/timesheet-lock/full-matrix?month=${month}&year=${year}`);
        setMatrixData(data);
      } else if (tab === 'individual_detail') {
        const queryUser = selectedDetailUserId || user._id;
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
  const handleToggleLock = async (userId = null, currentLocked = false) => {
    const actionText = currentLocked ? 'Mở chốt công' : 'Chốt công';
    const targetText = userId ? 'nhân viên này' : `toàn bộ công ty Tháng ${month}/${year}`;
    if (!window.confirm(`Bạn có chắc muốn ${actionText} cho ${targetText}?`)) return;

    try {
      await api.post('/timesheet-lock/toggle', {
        month,
        year,
        user_id: userId,
        is_locked: !currentLocked,
        note: `${actionText} bởi ${user.full_name}`,
      });
      toast.success(`Đã ${actionText} thành công! 🔒`);
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
          scale: 3, // 3x ultra-sharp resolution
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false,
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.96);
        const orientation = isIndividual ? 'p' : 'l'; // portrait vs landscape
        const pdf = new jsPDF(orientation, 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();

        const imgProps = pdf.getImageProperties(imgData);
        const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;

        let heightLeft = imgHeight;
        let position = 0;

        pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeight);
        heightLeft -= pdfHeight;

        while (heightLeft >= 10) {
          position = heightLeft - imgHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeight);
          heightLeft -= pdfHeight;
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

  // Staff rows to display in table
  const displayedStaffRows = (matrixData?.staff_rows || []).filter(r => {
    if (!filterStaffId) return true;
    return r.id === filterStaffId;
  });

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
              <Lock size={13} /> Chốt Công ET_Staff
            </button>
            <button onClick={() => setTab('individual_detail')} className={`chip${tab === 'individual_detail' ? ' active' : ''}`}>
              <FileText size={13} /> Bảng Chi Tiết Cá Nhân
            </button>
            <button onClick={() => setTab('overview')} className={`chip${tab === 'overview' ? ' active' : ''}`}>
              <BarChart3 size={13} /> Tổng quan
            </button>
            <button onClick={() => setTab('payroll')} className={`chip${tab === 'payroll' ? ' active' : ''}`}>
              <Calculator size={13} /> Bảng tính công
            </button>
            <button onClick={() => setTab('ranking')} className={`chip${tab === 'ranking' ? ' active' : ''}`}>
              <Trophy size={13} /> Xếp hạng
            </button>
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
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => handleToggleLock(null, matrixData?.global_locked)}
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
            </div>

            {/* BẢNG CHẤM CÔNG KHỚP 100% MẪU ET_STAFF 2026 */}
            {loading ? (
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

                <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse', textAlign: 'center', whiteSpace: 'nowrap' }}>
                  <thead>
                    {/* Row 1 Header: Titles & Weekdays with Sticky Columns */}
                    <tr style={{ background: '#1e293b', color: '#ffffff', fontWeight: 800 }}>
                      <th className="table-sticky-col-1" style={{ padding: '8px 10px', textAlign: 'left', minWidth: '55px', background: '#1e293b', border: '1px solid #334155' }}>ID</th>
                      <th className="table-sticky-col-2" style={{ padding: '8px 10px', textAlign: 'left', minWidth: '140px', background: '#1e293b', border: '1px solid #334155' }}>NHÂN SỰ</th>
                      <th className="table-sticky-col-3" style={{ padding: '8px 10px', minWidth: '70px', background: '#1e293b', border: '1px solid #334155' }}>NV</th>

                      {/* Summary Columns Header */}
                      <th style={{ padding: '6px 8px', background: '#0f172a', border: '1px solid #334155' }}>NLV tại VP</th>
                      <th style={{ padding: '6px 8px', background: '#0f172a', border: '1px solid #334155' }}>CT Trong nước</th>
                      <th style={{ padding: '6px 8px', background: '#0f172a', border: '1px solid #334155' }}>CT Nước ngoài</th>
                      <th style={{ padding: '6px 8px', background: '#0f172a', border: '1px solid #334155' }}>Work from home</th>
                      <th style={{ padding: '6px 8px', background: '#0f172a', border: '1px solid #334155' }}>Nghỉ phép</th>
                      <th style={{ padding: '6px 8px', background: '#0f172a', border: '1px solid #334155' }}>Nghỉ ốm</th>
                      <th style={{ padding: '6px 8px', background: '#0f172a', border: '1px solid #334155' }}>Nghỉ không lương</th>
                      <th style={{ padding: '6px 8px', background: '#0f172a', border: '1px solid #334155' }}>Khác</th>

                      {/* Days Weekday Row */}
                      {matrixData.header_days.map(hd => (
                        <th key={hd.day} style={{ padding: '4px 6px', background: hd.isWeekend ? '#475569' : '#334155', minWidth: '28px', border: '1px solid #334155' }}>
                          {hd.weekday}
                        </th>
                      ))}

                      {isAdminOrManager && <th style={{ padding: '8px 10px', minWidth: '50px', border: '1px solid #334155' }}>Chốt</th>}
                    </tr>

                    {/* Row 2 Header: Days 01..31 */}
                    <tr style={{ background: '#0f172a', color: '#ffffff', fontWeight: 800 }}>
                      <th colSpan="3" className="table-sticky-col-1" style={{ padding: '4px 10px', textAlign: 'left', background: '#0f172a', border: '1px solid #334155' }}>BẢNG CHẤM CÔNG THÁNG</th>
                      <th colSpan="8" style={{ padding: '4px 8px', fontSize: '10px', color: '#94a3b8', border: '1px solid #334155' }}>TỔNG CỘNG THEO LOẠI CÔNG</th>

                      {matrixData.header_days.map(hd => (
                        <th key={hd.day} style={{ padding: '4px 6px', background: hd.isWeekend ? '#334155' : '#0f172a', border: '1px solid #334155' }}>
                          {hd.dayStr}
                        </th>
                      ))}

                      {isAdminOrManager && <th style={{ padding: '4px', border: '1px solid #334155' }}>—</th>}
                    </tr>
                  </thead>

                  <tbody>
                    {displayedStaffRows.map((r, idx) => (
                      <tr key={r.id} style={{ borderBottom: '1px solid var(--border-muted)', background: idx % 2 === 0 ? 'transparent' : 'var(--bg-raised)' }}>
                        <td className="table-sticky-col-1" style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 800, color: 'var(--primary)' }}>{r.code}</td>
                        <td className="table-sticky-col-2" style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: 'var(--text)' }}>{r.full_name}</td>
                        <td className="table-sticky-col-3" style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>{r.role_label}</td>

                        {/* Summary Column Values */}
                        <td style={{ padding: '8px 6px', fontWeight: 700, color: '#10b981' }}>{r.nlv_office.toFixed(2)}</td>
                        <td style={{ padding: '8px 6px', fontWeight: 700, color: '#3b82f6' }}>{r.ct_domestic.toFixed(2)}</td>
                        <td style={{ padding: '8px 6px', fontWeight: 700, color: '#8b5cf6' }}>{r.ct_foreign.toFixed(2)}</td>
                        <td style={{ padding: '8px 6px', fontWeight: 700, color: '#06b6d4' }}>{r.wfh.toFixed(2)}</td>
                        <td style={{ padding: '8px 6px', fontWeight: 700, color: '#10b981' }}>{r.annual_leave.toFixed(2)}</td>
                        <td style={{ padding: '8px 6px', fontWeight: 700, color: '#ef4444' }}>{r.sick_leave.toFixed(2)}</td>
                        <td style={{ padding: '8px 6px', fontWeight: 700, color: '#64748b' }}>{r.unpaid_leave.toFixed(2)}</td>
                        <td style={{ padding: '8px 6px', fontWeight: 700, color: '#94a3b8' }}>{r.other_leave.toFixed(2)}</td>

                        {/* Day Cell Symbols */}
                        {r.days.map(d => {
                          const isWk = matrixData.header_days.find(hd => hd.day === d.day)?.isWeekend;
                          return (
                            <td
                              key={d.day}
                              onClick={() => {
                                if (isAdminOrManager) {
                                  setSelectedCell({ user_id: r.id, staff_name: r.full_name, dateStr: d.dateStr, current_symbol: d.symbol });
                                  setCellSymbol(d.symbol || 'x');
                                  setCellReason('');
                                }
                              }}
                              style={{
                                padding: '6px 4px', fontWeight: 800, cursor: isAdminOrManager ? 'pointer' : 'default',
                                background: isWk ? 'rgba(255,255,255,0.03)' : 'transparent',
                                color: d.symbol === 'x' || d.symbol === '0,75x' ? '#10b981' :
                                       d.symbol === '0,5x' ? '#f59e0b' :
                                       d.symbol === 'CT1' ? '#3b82f6' :
                                       d.symbol === 'CT2' ? '#8b5cf6' :
                                       d.symbol === 'WFH' ? '#06b6d4' :
                                       d.symbol === 'P' ? '#10b981' :
                                       d.symbol === 'O' ? '#ef4444' :
                                       d.symbol === 'KL' ? '#64748b' : 'var(--text)'
                              }}
                              title={isAdminOrManager ? `Bấm để chỉnh sửa ô công ngày ${d.dateStr}` : d.symbol}
                            >
                              {d.symbol || '—'}
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
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: 📄 BẢNG CHI TIẾT CHẤM CÔNG CÁ NHÂN (100% KHỚP MẪU) */}
        {tab === 'individual_detail' && (
          <div>
            {/* Staff Selector dropdown for Admin */}
            {isAdminOrManager && matrixData?.staff_rows && (
              <div className="card" style={{ padding: '10px 14px', marginBottom: '12px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    👤 Select Staff / Chọn nhân viên:
                  </span>
                  <select
                    className="form-select"
                    style={{ width: '280px', fontSize: '13px', padding: '6px 10px' }}
                    value={selectedDetailUserId || user._id}
                    onChange={e => setSelectedDetailUserId(e.target.value)}
                  >
                    {matrixData.staff_rows.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.code} - {s.full_name} ({s.role_label})
                      </option>
                    ))}
                  </select>
                  <button onClick={handlePrintIndividual} className="btn btn--ghost" style={{ padding: '6px 12px', fontSize: '12px', marginLeft: 'auto' }}>
                    <Printer size={14} /> In phiếu công
                  </button>
                </div>
              </div>
            )}

            {loading ? (
              <div className="skeleton-card" style={{ height: '400px', borderRadius: '16px' }} />
            ) : !individualDetail ? (
              <div className="card empty-state"><div className="empty-state__title">Không có dữ liệu phiếu công</div></div>
            ) : (
              <div ref={individualRef} className="card animate-fade-in" style={{ padding: '20px', background: '#ffffff', color: '#0f172a', fontFamily: 'Arial, sans-serif', fontSize: '11px', border: '1px solid #cbd5e1', borderRadius: '12px' }}>
                {/* Title Banner */}
                <div style={{ textAlign: 'center', fontSize: '20px', fontWeight: '900', marginBottom: '14px', textTransform: 'uppercase', color: '#0f172a', letterSpacing: '1px' }}>
                  BẢNG CHI TIẾT CHẤM CÔNG
                </div>

                {/* Banner 1: Header Employee Info */}
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10px', fontSize: '11px', border: '1px solid #1e293b' }}>
                  <tbody>
                    <tr style={{ background: '#fef08a', color: '#0f172a' }}>
                      <td style={{ border: '1px solid #1e293b', padding: '6px 10px', fontWeight: 'bold', width: '20%' }}>Mã nhân viên: {indUser.id}</td>
                      <td style={{ border: '1px solid #1e293b', padding: '6px 10px', fontWeight: 'bold', width: '45%' }}>Tên nhân viên: {indUser.full_name}</td>
                      <td style={{ border: '1px solid #1e293b', padding: '6px 10px', fontWeight: 'bold', width: '35%' }}>Bộ phận: {indUser.department_name}</td>
                    </tr>
                  </tbody>
                </table>

                {/* Summary Table Grid 1 & 2 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                  {/* Grid Left: Hours & Late/Early */}
                  <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #1e293b', fontSize: '10px' }}>
                    <tbody>
                      <tr>
                        <td style={{ border: '1px solid #1e293b', padding: '4px 8px', fontWeight: 'bold', background: '#f8fafc', color: '#0f172a' }}>Ngày thường</td>
                        <td style={{ border: '1px solid #1e293b', padding: '4px 8px', textAlign: 'center', color: '#0f172a' }}>{indSum.work_hours_normal}h</td>
                        <td style={{ border: '1px solid #1e293b', padding: '4px 8px', fontWeight: 'bold', background: '#f8fafc', color: '#0f172a' }}>Tăng ca 1</td>
                        <td style={{ border: '1px solid #1e293b', padding: '4px 8px', textAlign: 'center', color: '#0f172a' }}>{indSum.ot1_hours}h</td>
                        <td style={{ border: '1px solid #1e293b', padding: '4px 8px', fontWeight: 'bold', background: '#f8fafc', color: '#0f172a' }}>Đi trễ</td>
                        <td style={{ border: '1px solid #1e293b', padding: '4px 8px', textAlign: 'center', color: '#0f172a' }}>Số lần: {indSum.late_count}</td>
                      </tr>
                      <tr>
                        <td style={{ border: '1px solid #1e293b', padding: '4px 8px', fontWeight: 'bold', background: '#f8fafc', color: '#0f172a' }}>Cuối tuần</td>
                        <td style={{ border: '1px solid #1e293b', padding: '4px 8px', textAlign: 'center', color: '#0f172a' }}>{indSum.work_hours_weekend}h</td>
                        <td style={{ border: '1px solid #1e293b', padding: '4px 8px', fontWeight: 'bold', background: '#f8fafc', color: '#0f172a' }}>Tăng ca 2</td>
                        <td style={{ border: '1px solid #1e293b', padding: '4px 8px', textAlign: 'center', color: '#0f172a' }}>{indSum.ot2_hours}h</td>
                        <td style={{ border: '1px solid #1e293b', padding: '4px 8px', fontWeight: 'bold', background: '#f8fafc', color: '#0f172a' }}>Về sớm</td>
                        <td style={{ border: '1px solid #1e293b', padding: '4px 8px', textAlign: 'center', color: '#0f172a' }}>Số lần: {indSum.early_count}</td>
                      </tr>
                      <tr style={{ background: '#e2e8f0', fontWeight: 'bold', color: '#0f172a' }}>
                        <td style={{ border: '1px solid #1e293b', padding: '4px 8px' }}>TỔNG</td>
                        <td style={{ border: '1px solid #1e293b', padding: '4px 8px', textAlign: 'center' }}>{indSum.total_work_hours}h</td>
                        <td style={{ border: '1px solid #1e293b', padding: '4px 8px' }}>Tăng ca 3</td>
                        <td style={{ border: '1px solid #1e293b', padding: '4px 8px', textAlign: 'center' }}>{indSum.ot3_hours}h</td>
                        <td style={{ border: '1px solid #1e293b', padding: '4px 8px' }}>Số phút trễ</td>
                        <td style={{ border: '1px solid #1e293b', padding: '4px 8px', textAlign: 'center', color: indSum.late_minutes > 0 ? '#ef4444' : '#0f172a' }}>{indSum.late_minutes}p</td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Grid Right: Leave counts */}
                  <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #1e293b', fontSize: '10px', textAlign: 'center' }}>
                    <thead>
                      <tr style={{ background: '#1e293b', color: '#ffffff' }}>
                        <th colSpan="12" style={{ border: '1px solid #1e293b', padding: '4px' }}>Các loại vắng</th>
                      </tr>
                      <tr style={{ background: '#f1f5f9', fontWeight: 'bold', color: '#0f172a' }}>
                        <td style={{ border: '1px solid #1e293b', padding: '3px' }}>V</td>
                        <td style={{ border: '1px solid #1e293b', padding: '3px' }}>OM</td>
                        <td style={{ border: '1px solid #1e293b', padding: '3px' }}>TS</td>
                        <td style={{ border: '1px solid #1e293b', padding: '3px' }}>R</td>
                        <td style={{ border: '1px solid #1e293b', padding: '3px' }}>Ro</td>
                        <td style={{ border: '1px solid #1e293b', padding: '3px' }}>P</td>
                        <td style={{ border: '1px solid #1e293b', padding: '3px' }}>F</td>
                        <td style={{ border: '1px solid #1e293b', padding: '3px' }}>CO</td>
                        <td style={{ border: '1px solid #1e293b', padding: '3px' }}>CD</td>
                        <td style={{ border: '1px solid #1e293b', padding: '3px' }}>H</td>
                        <td style={{ border: '1px solid #1e293b', padding: '3px' }}>CT</td>
                        <td style={{ border: '1px solid #1e293b', padding: '3px' }}>Le</td>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ color: '#0f172a' }}>
                        <td style={{ border: '1px solid #1e293b', padding: '5px' }}>{lc.V || 0}</td>
                        <td style={{ border: '1px solid #1e293b', padding: '5px' }}>{lc.OM || 0}</td>
                        <td style={{ border: '1px solid #1e293b', padding: '5px' }}>{lc.TS || 0}</td>
                        <td style={{ border: '1px solid #1e293b', padding: '5px' }}>{lc.R || 0}</td>
                        <td style={{ border: '1px solid #1e293b', padding: '5px' }}>{lc.Ro || 0}</td>
                        <td style={{ border: '1px solid #1e293b', padding: '5px' }}>{lc.P || 0}</td>
                        <td style={{ border: '1px solid #1e293b', padding: '5px' }}>{lc.F || 0}</td>
                        <td style={{ border: '1px solid #1e293b', padding: '5px' }}>{lc.CO || 0}</td>
                        <td style={{ border: '1px solid #1e293b', padding: '5px' }}>{lc.CD || 0}</td>
                        <td style={{ border: '1px solid #1e293b', padding: '5px' }}>{lc.H || 0}</td>
                        <td style={{ border: '1px solid #1e293b', padding: '5px' }}>{lc.CT || 0}</td>
                        <td style={{ border: '1px solid #1e293b', padding: '5px' }}>{lc.Le || 0}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Main Detailed Logs Table */}
                <div style={{ fontStyle: 'italic', fontSize: '10px', marginBottom: '4px', textAlign: 'center', fontWeight: 'bold', color: '#0f172a' }}>Chi tiết điểm danh hàng ngày</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #1e293b', fontSize: '10px', textAlign: 'center' }}>
                  <thead>
                    <tr style={{ background: '#1e293b', color: '#ffffff', fontWeight: 'bold' }}>
                      <th rowSpan="2" style={{ border: '1px solid #334155', padding: '6px 4px' }}>Ngày</th>
                      <th rowSpan="2" style={{ border: '1px solid #334155', padding: '6px 4px' }}>Thứ</th>
                      <th colSpan="2" style={{ border: '1px solid #334155', padding: '4px' }}>1</th>
                      <th colSpan="2" style={{ border: '1px solid #334155', padding: '4px' }}>2</th>
                      <th colSpan="2" style={{ border: '1px solid #334155', padding: '4px' }}>3</th>
                      <th rowSpan="2" style={{ border: '1px solid #334155', padding: '6px 4px' }}>Trễ</th>
                      <th rowSpan="2" style={{ border: '1px solid #334155', padding: '6px 4px' }}>Sớm</th>
                      <th rowSpan="2" style={{ border: '1px solid #334155', padding: '6px 4px' }}>Công</th>
                      <th rowSpan="2" style={{ border: '1px solid #334155', padding: '6px 4px' }}>T.Giờ</th>
                      <th rowSpan="2" style={{ border: '1px solid #334155', padding: '6px 4px' }}>T.Ca1</th>
                      <th rowSpan="2" style={{ border: '1px solid #334155', padding: '6px 4px' }}>T.Ca2</th>
                      <th rowSpan="2" style={{ border: '1px solid #334155', padding: '6px 4px' }}>T.Ca3</th>
                      <th rowSpan="2" style={{ border: '1px solid #334155', padding: '6px 4px' }}>Nơi làm việc</th>
                    </tr>
                    <tr style={{ background: '#334155', color: '#ffffff', fontWeight: 'bold' }}>
                      <th style={{ border: '1px solid #475569', padding: '3px' }}>Vào</th>
                      <th style={{ border: '1px solid #475569', padding: '3px' }}>Ra</th>
                      <th style={{ border: '1px solid #475569', padding: '3px' }}>Vào</th>
                      <th style={{ border: '1px solid #475569', padding: '3px' }}>Ra</th>
                      <th style={{ border: '1px solid #475569', padding: '3px' }}>Vào</th>
                      <th style={{ border: '1px solid #475569', padding: '3px' }}>Ra</th>
                    </tr>
                  </thead>
                  <tbody>
                    {indLogs.map((row) => (
                      <tr key={row.day} style={{ background: row.isWeekend ? '#f1f5f9' : '#ffffff', color: '#0f172a' }}>
                        <td style={{ border: '1px solid #cbd5e1', padding: '4px' }}>{row.dateFormatted}</td>
                        <td style={{ border: '1px solid #cbd5e1', padding: '4px', fontWeight: row.isWeekend ? 'bold' : 'normal' }}>{row.weekday}</td>
                        <td style={{ border: '1px solid #cbd5e1', padding: '4px' }}>{row.shift1.in}</td>
                        <td style={{ border: '1px solid #cbd5e1', padding: '4px' }}>{row.shift1.out}</td>
                        <td style={{ border: '1px solid #cbd5e1', padding: '4px' }}>{row.shift2.in}</td>
                        <td style={{ border: '1px solid #cbd5e1', padding: '4px' }}>{row.shift2.out}</td>
                        <td style={{ border: '1px solid #cbd5e1', padding: '4px' }}>{row.shift3.in}</td>
                        <td style={{ border: '1px solid #cbd5e1', padding: '4px' }}>{row.shift3.out}</td>
                        <td style={{ border: '1px solid #cbd5e1', padding: '4px', color: row.lateMins ? '#ef4444' : '#0f172a', fontWeight: row.lateMins ? 'bold' : 'normal' }}>{row.lateMins}</td>
                        <td style={{ border: '1px solid #cbd5e1', padding: '4px' }}>{row.earlyMins}</td>
                        <td style={{ border: '1px solid #cbd5e1', padding: '4px', fontWeight: 'bold' }}>{row.workCredit}</td>
                        <td style={{ border: '1px solid #cbd5e1', padding: '4px' }}>{row.totalHours || ''}</td>
                        <td style={{ border: '1px solid #cbd5e1', padding: '4px' }}>{row.ot1}</td>
                        <td style={{ border: '1px solid #cbd5e1', padding: '4px' }}>{row.ot2}</td>
                        <td style={{ border: '1px solid #cbd5e1', padding: '4px' }}>{row.ot3}</td>
                        <td style={{ border: '1px solid #cbd5e1', padding: '4px' }}>{row.locationName}</td>
                      </tr>
                    ))}
                    {/* Bottom Summary Row */}
                    <tr style={{ fontWeight: 'bold', background: '#e2e8f0', color: '#0f172a' }}>
                      <td colSpan="10" style={{ border: '1px solid #1e293b', padding: '6px', textAlign: 'left' }}>
                        Tổng công: {indSum.total_work_hours} giờ
                      </td>
                      <td colSpan="6" style={{ border: '1px solid #1e293b', padding: '6px', textAlign: 'center' }}>
                        {indSum.total_work_hours}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Signature Block */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px', textAlign: 'center' }}>
                  <div style={{ minWidth: '200px' }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '50px', color: '#0f172a' }}>Kí tên</div>
                    <div style={{ fontWeight: 'bold', textDecoration: 'underline', color: '#0f172a' }}>{indUser.full_name}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: OVERVIEW */}
        {tab === 'overview' && report?.summary && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', marginBottom: '14px' }}>
              <div className="card" style={{ padding: '12px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>TỔNG NHÂN VIÊN</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--primary)' }}>{report.summary.total_users}</div>
              </div>
              <div className="card" style={{ padding: '12px' }}>
                <div style={{ fontSize: '11px', color: 'var(--green)' }}>ĐÚNG GIỜ TẬP THỂ</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--green)' }}>{report.summary.on_time_rate}%</div>
              </div>
              <div className="card" style={{ padding: '12px' }}>
                <div style={{ fontSize: '11px', color: 'var(--yellow)' }}>TỔNG LƯỢT MUỘN</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--yellow)' }}>{report.summary.total_late_days}</div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: PAYROLL */}
        {tab === 'payroll' && payroll?.payroll && (
          <div className="card" style={{ padding: '12px', overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '8px' }}>Họ tên</th>
                  <th style={{ padding: '8px' }}>Phòng ban</th>
                  <th style={{ padding: '8px' }}>Công đi làm</th>
                  <th style={{ padding: '8px' }}>Lượt muộn</th>
                  <th style={{ padding: '8px' }}>Trừ công muộn</th>
                  <th style={{ padding: '8px' }}>CÔNG TÍNH LƯƠNG</th>
                </tr>
              </thead>
              <tbody>
                {payroll.payroll.map((p, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border-muted)' }}>
                    <td style={{ padding: '8px', fontWeight: 700 }}>{p.full_name}</td>
                    <td style={{ padding: '8px' }}>{p.department_name}</td>
                    <td style={{ padding: '8px', color: 'var(--green)' }}>{p.work_days_credit}</td>
                    <td style={{ padding: '8px', color: 'var(--yellow)' }}>{p.late_days}</td>
                    <td style={{ padding: '8px', color: 'var(--red)' }}>-{p.late_penalty_credit}</td>
                    <td style={{ padding: '8px', fontWeight: 800, color: 'var(--primary)' }}>{p.final_payroll_credit} công</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 5: RANKING */}
        {tab === 'ranking' && ranking?.rankings && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {ranking.rankings.map((r) => (
              <div key={r.user_id} className="card" style={{ padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ fontSize: '20px' }}>{RANK_MEDALS[r.rank] || `#${r.rank}`}</div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 700 }}>{r.full_name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{r.department_name}</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--primary)' }}>{r.score} điểm</div>
                  <div style={{ fontSize: '11px', color: 'var(--green)' }}>Tỷ lệ đúng giờ: {r.on_time_rate}%</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* OFF-SCREEN HIGH-DEF PRINT WRAPPER FOR PDF MATRIX GENERATION (1480px Expanded Width, No Scrollbar Clipping) */}
      <div style={{ position: 'absolute', left: '-9999px', top: '-9999px', width: '1480px', pointerEvents: 'none' }}>
        <div ref={pdfMatrixPrintRef} style={{ background: '#ffffff', color: '#0f172a', padding: '20px', fontFamily: 'Arial, sans-serif', width: '1480px' }}>
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

                <th style={{ padding: '6px 8px', background: '#0f172a', border: '1px solid #334155' }}>NLV tại VP</th>
                <th style={{ padding: '6px 8px', background: '#0f172a', border: '1px solid #334155' }}>CT Trong nước</th>
                <th style={{ padding: '6px 8px', background: '#0f172a', border: '1px solid #334155' }}>CT Nước ngoài</th>
                <th style={{ padding: '6px 8px', background: '#0f172a', border: '1px solid #334155' }}>Work from home</th>
                <th style={{ padding: '6px 8px', background: '#0f172a', border: '1px solid #334155' }}>Nghỉ phép</th>
                <th style={{ padding: '6px 8px', background: '#0f172a', border: '1px solid #334155' }}>Nghỉ ốm</th>
                <th style={{ padding: '6px 8px', background: '#0f172a', border: '1px solid #334155' }}>Nghỉ không lương</th>
                <th style={{ padding: '6px 8px', background: '#0f172a', border: '1px solid #334155' }}>Khác</th>

                {matrixData?.header_days?.map(hd => (
                  <th key={hd.day} style={{ padding: '4px 6px', background: hd.isWeekend ? '#475569' : '#334155', minWidth: '28px', border: '1px solid #334155' }}>
                    {hd.weekday}
                  </th>
                ))}
              </tr>

              <tr style={{ background: '#0f172a', color: '#ffffff', fontWeight: 800 }}>
                <th colSpan="3" style={{ padding: '6px 10px', textAlign: 'left', border: '1px solid #334155' }}>BẢNG CHẤM CÔNG THÁNG</th>
                <th colSpan="8" style={{ padding: '6px 8px', fontSize: '10px', color: '#94a3b8', border: '1px solid #334155' }}>TỔNG CỘNG THEO LOẠI CÔNG</th>

                {matrixData?.header_days?.map(hd => (
                  <th key={hd.day} style={{ padding: '4px 6px', background: hd.isWeekend ? '#334155' : '#0f172a', border: '1px solid #334155' }}>
                    {hd.dayStr}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {displayedStaffRows.map((r, idx) => (
                <tr key={r.id} style={{ background: idx % 2 === 0 ? '#ffffff' : '#f8fafc', color: '#0f172a', borderBottom: '1px solid #cbd5e1' }}>
                  <td style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 800, color: '#2563eb', border: '1px solid #cbd5e1' }}>{r.code}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: '#0f172a', border: '1px solid #cbd5e1' }}>{r.full_name}</td>
                  <td style={{ padding: '8px 10px', color: '#475569', border: '1px solid #cbd5e1' }}>{r.role_label}</td>

                  <td style={{ padding: '8px 6px', fontWeight: 700, color: '#059669', border: '1px solid #cbd5e1' }}>{r.nlv_office.toFixed(2)}</td>
                  <td style={{ padding: '8px 6px', fontWeight: 700, color: '#2563eb', border: '1px solid #cbd5e1' }}>{r.ct_domestic.toFixed(2)}</td>
                  <td style={{ padding: '8px 6px', fontWeight: 700, color: '#7c3aed', border: '1px solid #cbd5e1' }}>{r.ct_foreign.toFixed(2)}</td>
                  <td style={{ padding: '8px 6px', fontWeight: 700, color: '#0891b2', border: '1px solid #cbd5e1' }}>{r.wfh.toFixed(2)}</td>
                  <td style={{ padding: '8px 6px', fontWeight: 700, color: '#059669', border: '1px solid #cbd5e1' }}>{r.annual_leave.toFixed(2)}</td>
                  <td style={{ padding: '8px 6px', fontWeight: 700, color: '#dc2626', border: '1px solid #cbd5e1' }}>{r.sick_leave.toFixed(2)}</td>
                  <td style={{ padding: '8px 6px', fontWeight: 700, color: '#475569', border: '1px solid #cbd5e1' }}>{r.unpaid_leave.toFixed(2)}</td>
                  <td style={{ padding: '8px 6px', fontWeight: 700, color: '#64748b', border: '1px solid #cbd5e1' }}>{r.other_leave.toFixed(2)}</td>

                  {r.days.map(d => {
                    const isWk = matrixData?.header_days?.find(hd => hd.day === d.day)?.isWeekend;
                    return (
                      <td
                        key={d.day}
                        style={{
                          padding: '6px 4px', fontWeight: 800, border: '1px solid #cbd5e1',
                          background: isWk ? '#edf2f7' : 'transparent',
                          color: d.symbol === 'x' || d.symbol === '0,75x' ? '#059669' :
                                 d.symbol === '0,5x' ? '#d97706' :
                                 d.symbol === 'CT1' ? '#2563eb' :
                                 d.symbol === 'CT2' ? '#7c3aed' :
                                 d.symbol === 'WFH' ? '#0891b2' :
                                 d.symbol === 'P' ? '#059669' :
                                 d.symbol === 'O' ? '#dc2626' :
                                 d.symbol === 'KL' ? '#475569' : '#0f172a'
                        }}
                      >
                        {d.symbol || '—'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
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
                <th rowSpan="2" style={{ border: '1px solid #334155', padding: '6px 4px' }}>Ngày</th>
                <th rowSpan="2" style={{ border: '1px solid #334155', padding: '6px 4px' }}>Thứ</th>
                <th colSpan="2" style={{ border: '1px solid #334155', padding: '4px' }}>1</th>
                <th colSpan="2" style={{ border: '1px solid #334155', padding: '4px' }}>2</th>
                <th colSpan="2" style={{ border: '1px solid #334155', padding: '4px' }}>3</th>
                <th rowSpan="2" style={{ border: '1px solid #334155', padding: '6px 4px' }}>Trễ</th>
                <th rowSpan="2" style={{ border: '1px solid #334155', padding: '6px 4px' }}>Sớm</th>
                <th rowSpan="2" style={{ border: '1px solid #334155', padding: '6px 4px' }}>Công</th>
                <th rowSpan="2" style={{ border: '1px solid #334155', padding: '6px 4px' }}>T.Giờ</th>
                <th rowSpan="2" style={{ border: '1px solid #334155', padding: '6px 4px' }}>T.Ca1</th>
                <th rowSpan="2" style={{ border: '1px solid #334155', padding: '6px 4px' }}>T.Ca2</th>
                <th rowSpan="2" style={{ border: '1px solid #334155', padding: '6px 4px' }}>T.Ca3</th>
                <th rowSpan="2" style={{ border: '1px solid #334155', padding: '6px 4px' }}>Nơi làm việc</th>
              </tr>
              <tr style={{ background: '#334155', color: '#ffffff', fontWeight: 'bold' }}>
                <th style={{ border: '1px solid #475569', padding: '4px' }}>Vào</th>
                <th style={{ border: '1px solid #475569', padding: '4px' }}>Ra</th>
                <th style={{ border: '1px solid #475569', padding: '4px' }}>Vào</th>
                <th style={{ border: '1px solid #475569', padding: '4px' }}>Ra</th>
                <th style={{ border: '1px solid #475569', padding: '4px' }}>Vào</th>
                <th style={{ border: '1px solid #475569', padding: '4px' }}>Ra</th>
              </tr>
            </thead>
            <tbody>
              {indLogs.map((row) => (
                <tr key={row.day} style={{ background: row.isWeekend ? '#f1f5f9' : '#ffffff', color: '#0f172a' }}>
                  <td style={{ border: '1px solid #cbd5e1', padding: '4px' }}>{row.dateFormatted}</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '4px', fontWeight: row.isWeekend ? 'bold' : 'normal' }}>{row.weekday}</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '4px' }}>{row.shift1.in}</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '4px' }}>{row.shift1.out}</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '4px' }}>{row.shift2.in}</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '4px' }}>{row.shift2.out}</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '4px' }}>{row.shift3.in}</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '4px' }}>{row.shift3.out}</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '4px', color: row.lateMins ? '#ef4444' : '#0f172a', fontWeight: row.lateMins ? 'bold' : 'normal' }}>{row.lateMins}</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '4px' }}>{row.earlyMins}</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '4px', fontWeight: 'bold' }}>{row.workCredit}</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '4px' }}>{row.totalHours || ''}</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '4px' }}>{row.ot1}</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '4px' }}>{row.ot2}</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '4px' }}>{row.ot3}</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '4px' }}>{row.locationName}</td>
                </tr>
              ))}
              {/* Bottom Summary Row */}
              <tr style={{ fontWeight: 'bold', background: '#e2e8f0', color: '#0f172a' }}>
                <td colSpan="10" style={{ border: '1.5px solid #1e293b', padding: '7px', textAlign: 'left' }}>
                  Tổng công: {indSum.total_work_hours} giờ
                </td>
                <td colSpan="6" style={{ border: '1.5px solid #1e293b', padding: '7px', textAlign: 'center' }}>
                  {indSum.total_work_hours}
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

      {/* MODAL 1: OVERRIDE CELL WITH MANDATORY REASON */}
      {selectedCell && (
        <div className="modal-overlay" onClick={() => setSelectedCell(null)}>
          <div className="modal-sheet animate-slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px', margin: '0 auto' }}>
            <div className="modal-sheet__handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit2 size={18} color="var(--primary)" />
                <h3 style={{ fontSize: '16px', fontWeight: 800 }}>Chỉnh Sửa Ô Công</h3>
              </div>
              <button onClick={() => setSelectedCell(null)} className="btn btn--ghost" style={{ padding: '4px 8px' }}><X size={18} /></button>
            </div>

            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', background: 'var(--bg-raised)', padding: '10px', borderRadius: '8px', marginBottom: '12px' }}>
              <div>Nhân sự: <strong>{selectedCell.staff_name}</strong></div>
              <div>Ngày: <strong>{selectedCell.dateStr}</strong> (Hiện tại: <code>{selectedCell.current_symbol || '—'}</code>)</div>
            </div>

            <div className="form-group">
              <label className="form-label">Ký hiệu công mới *</label>
              <select className="form-select" value={cellSymbol} onChange={e => setCellSymbol(e.target.value)}>
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

            <div className="form-group">
              <label className="form-label">Lý do chỉnh sửa * (Bắt buộc lưu Lịch sử Audit Log)</label>
              <textarea
                className="form-input"
                rows={3}
                value={cellReason}
                onChange={e => setCellReason(e.target.value)}
                placeholder="Nhập lý do điều chỉnh ô công..."
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
              <button onClick={() => setSelectedCell(null)} className="btn btn--ghost btn--full">Hủy</button>
              <button onClick={handleSaveCellOverride} disabled={submittingCell} className="btn btn--primary btn--full">
                {submittingCell ? <span className="spinner" /> : 'Lưu & Ghi Lịch Sử'}
              </button>
            </div>
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
    </div>
  );
}
