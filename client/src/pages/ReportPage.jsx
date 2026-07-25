// src/pages/ReportPage.jsx
// Báo cáo 4 tab: Tổng quan / 🔒 Chốt Công (Mẫu thủ công ET_Staff 2026) / Bảng tính công / Xếp hạng nhân viên

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Download, Trophy, BarChart3, Calculator, TrendingUp, TrendingDown, Lock, Unlock, History, Edit2, CheckCircle2, X, AlertTriangle, FileSpreadsheet } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import toast from 'react-hot-toast';
import api from '../services/api';
import useAuthStore from '../stores/authStore';
import HeaderActions from '../components/HeaderActions';

const MONTHS = ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6',
  'Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];

const RANK_MEDALS = { 1: '🥇', 2: '🥈', 3: '🥉' };
const SYMBOLS = ['x', '0,75x', '0,5x', 'CT1', 'CT2', 'WFH', 'P', 'O', 'KL', 'K'];

export default function ReportPage() {
  const { user } = useAuthStore();
  const isAdminOrManager = ['admin', 'manager'].includes(user?.role);

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [tab, setTab] = useState('timesheet_lock'); // 'timesheet_lock' | 'overview' | 'payroll' | 'ranking'

  // Data states
  const [report, setReport] = useState(null);
  const [trend, setTrend] = useState(null);
  const [payroll, setPayroll] = useState(null);
  const [ranking, setRanking] = useState(null);
  const [matrixData, setMatrixData] = useState(null);
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

  useEffect(() => { loadTab(); }, [month, year, tab]);

  const loadTab = async () => {
    setLoading(true);
    try {
      if (tab === 'timesheet_lock') {
        const { data } = await api.get(`/timesheet-lock/full-matrix?month=${month}&year=${year}`);
        setMatrixData(data);
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

  const exportExcel = async () => {
    try {
      toast.loading('Đang tạo file Excel mẫu ET_Staff 2026...', { id: 'excel' });
      const response = await api.get(`/export/excel?month=${month}&year=${year}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `ET_Staff_${year}_Thang_${String(month).padStart(2,'0')}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Đã tải file Excel Bảng Chấm Công! 📊', { id: 'excel' });
    } catch {
      toast.error('Lỗi xuất Excel', { id: 'excel' });
    }
  };

  return (
    <div className="page">
      {/* Header */}
      <div className="header">
        <div className="header__inner">
          <div>
            <div className="header__title">Báo cáo & Chốt công</div>
            <div className="header__subtitle">Tháng {month}/{year} · ET Architects</div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button onClick={exportExcel} className="btn btn--primary" style={{ padding: '6px 14px', fontSize: '13px' }}>
              <FileSpreadsheet size={15} /> Xuất Excel
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
            <div className="card" style={{ padding: '12px 16px', marginBottom: '14px', background: 'var(--bg-card)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span className={`badge ${matrixData?.global_locked ? 'badge--danger' : 'badge--success'}`} style={{ fontSize: '13px', padding: '6px 12px', fontWeight: 800 }}>
                    {matrixData?.global_locked ? '🔒 ĐÃ CHỐT CÔNG THÁNG' : '🔓 BẢNG CÔNG CHƯA CHỐT'}
                  </span>
                  {matrixData?.global_lock_info && (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
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
              <div className="card animate-fade-in" style={{ padding: '4px', overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse', textAlign: 'center', whiteSpace: 'nowrap' }}>
                  <thead>
                    {/* Row 1 Header: Titles & Weekdays */}
                    <tr style={{ background: '#2d3748', color: '#ffffff', fontWeight: 800 }}>
                      <th style={{ padding: '8px 10px', textAlign: 'left', minWidth: '60px' }}>ID</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left', minWidth: '140px' }}>NHÂN SỰ</th>
                      <th style={{ padding: '8px 10px', minWidth: '70px' }}>NV</th>

                      {/* Summary Columns Header */}
                      <th style={{ padding: '6px 8px', background: '#1a202c' }}>NLV tại VP</th>
                      <th style={{ padding: '6px 8px', background: '#1a202c' }}>CT Trong nước</th>
                      <th style={{ padding: '6px 8px', background: '#1a202c' }}>CT Nước ngoài</th>
                      <th style={{ padding: '6px 8px', background: '#1a202c' }}>Work from home</th>
                      <th style={{ padding: '6px 8px', background: '#1a202c' }}>Nghỉ phép</th>
                      <th style={{ padding: '6px 8px', background: '#1a202c' }}>Nghỉ ốm</th>
                      <th style={{ padding: '6px 8px', background: '#1a202c' }}>Nghỉ không lương</th>
                      <th style={{ padding: '6px 8px', background: '#1a202c' }}>Khác</th>

                      {/* Days Weekday Row */}
                      {matrixData.header_days.map(hd => (
                        <th key={hd.day} style={{ padding: '4px 6px', background: hd.isWeekend ? '#4a5568' : '#2d3748', minWidth: '28px' }}>
                          {hd.weekday}
                        </th>
                      ))}

                      {isAdminOrManager && <th style={{ padding: '8px 10px', minWidth: '80px' }}>Chốt</th>}
                    </tr>

                    {/* Row 2 Header: Days 01..31 */}
                    <tr style={{ background: '#1a202c', color: '#ffffff', fontWeight: 800 }}>
                      <th colSpan="3" style={{ padding: '4px 10px', textAlign: 'left' }}>BẢNG CHẤM CÔNG THÁNG</th>
                      <th colSpan="8" style={{ padding: '4px 8px', fontSize: '10px', color: '#a0aec0' }}>TỔNG CỘNG THEO LOẠI CÔNG</th>

                      {matrixData.header_days.map(hd => (
                        <th key={hd.day} style={{ padding: '4px 6px', background: hd.isWeekend ? '#2d3748' : '#1a202c', borderTop: '1px solid #4a5568' }}>
                          {hd.dayStr}
                        </th>
                      ))}

                      {isAdminOrManager && <th style={{ padding: '4px' }}>—</th>}
                    </tr>
                  </thead>

                  <tbody>
                    {matrixData.staff_rows.map((r, idx) => (
                      <tr key={r.id} style={{ borderBottom: '1px solid var(--border-muted)', background: idx % 2 === 0 ? 'transparent' : 'var(--bg-raised)' }}>
                        <td style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 800, color: 'var(--primary)' }}>{r.code}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: 'var(--text)' }}>{r.full_name}</td>
                        <td style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>{r.role_label}</td>

                        {/* Summary Column Values */}
                        <td style={{ padding: '8px 6px', fontWeight: 700, color: 'var(--green)' }}>{r.nlv_office.toFixed(2)}</td>
                        <td style={{ padding: '8px 6px', fontWeight: 700, color: 'var(--primary)' }}>{r.ct_domestic.toFixed(2)}</td>
                        <td style={{ padding: '8px 6px', fontWeight: 700, color: '#8b5cf6' }}>{r.ct_foreign.toFixed(2)}</td>
                        <td style={{ padding: '8px 6px', fontWeight: 700, color: 'var(--blue)' }}>{r.wfh.toFixed(2)}</td>
                        <td style={{ padding: '8px 6px', fontWeight: 700, color: 'var(--green)' }}>{r.annual_leave.toFixed(2)}</td>
                        <td style={{ padding: '8px 6px', fontWeight: 700, color: 'var(--yellow)' }}>{r.sick_leave.toFixed(2)}</td>
                        <td style={{ padding: '8px 6px', fontWeight: 700, color: 'var(--text-muted)' }}>{r.unpaid_leave.toFixed(2)}</td>
                        <td style={{ padding: '8px 6px', fontWeight: 700, color: 'var(--text-secondary)' }}>{r.other_leave.toFixed(2)}</td>

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
                                color: d.symbol === 'x' || d.symbol === '0,75x' ? 'var(--green)' :
                                       d.symbol === '0,5x' ? 'var(--yellow)' :
                                       d.symbol === 'CT1' ? 'var(--primary)' :
                                       d.symbol === 'CT2' ? '#8b5cf6' :
                                       d.symbol === 'WFH' ? 'var(--blue)' :
                                       d.symbol === 'P' ? 'var(--green)' :
                                       d.symbol === 'O' ? 'var(--yellow)' :
                                       d.symbol === 'KL' ? 'var(--text-muted)' : 'var(--text)'
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

        {/* TAB 2: OVERVIEW */}
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

        {/* TAB 3: PAYROLL */}
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

        {/* TAB 4: RANKING */}
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
    </div>
  );
}
