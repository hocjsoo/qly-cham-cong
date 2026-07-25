// src/pages/ReportPage.jsx
// Báo cáo 3 tab: Tổng quan / Bảng tính công / Xếp hạng nhân viên

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Download, Trophy, BarChart3, Calculator, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import toast from 'react-hot-toast';
import api from '../services/api';
import HeaderActions from '../components/HeaderActions';

const MONTHS = ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6',
  'Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];

const RANK_MEDALS = { 1: '🥇', 2: '🥈', 3: '🥉' };
const RANK_COLORS = { 1: 'var(--yellow)', 2: '#94a3b8', 3: '#cd7f32' };

export default function ReportPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [tab, setTab] = useState('overview'); // 'overview' | 'payroll' | 'ranking'
  const [report, setReport] = useState(null);
  const [trend, setTrend] = useState(null);
  const [payroll, setPayroll] = useState(null);
  const [ranking, setRanking] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadTab(); }, [month, year, tab]);

  const loadTab = async () => {
    setLoading(true);
    try {
      if (tab === 'overview') {
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

  const exportCSV = () => {
    if (!report?.report) return;
    const rows = [
      ['Họ tên', 'Phòng ban', 'Có mặt', 'Đi muộn', 'Vắng', 'Nghỉ phép', 'Tổng giờ', 'OT', 'Tổng phút muộn'],
      ...report.report.map(r => [
        r.full_name, r.department_name,
        r.present_days, r.late_days, r.absent_days, r.leave_days,
        r.total_hours, r.ot_hours, r.total_late_minutes,
      ]),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bao-cao-${year}-${String(month).padStart(2,'0')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Đã xuất CSV!');
  };

  const exportExcel = async () => {
    try {
      toast.loading('Đang tạo file Excel...', { id: 'excel' });
      const response = await api.get(`/export/excel?month=${month}&year=${year}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `bao-cao-cham-cong-${year}-${String(month).padStart(2,'0')}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Đã tải file Excel! 📊', { id: 'excel' });
    } catch {
      toast.error('Lỗi xuất Excel', { id: 'excel' });
    }
  };

  const s = report?.summary;

  return (
    <div className="page">
      <div className="header">
        <div className="header__inner">
          <div>
            <div className="header__title">Báo cáo</div>
            <div className="header__subtitle">Tổng hợp chấm công</div>
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            {tab === 'overview' && (
              <>
                <button onClick={exportExcel} className="btn btn--primary" style={{ padding: '6px 10px', fontSize: '12px' }}>
                  <Download size={14} /> xlsx
                </button>
                <button onClick={exportCSV} className="btn btn--ghost" style={{ padding: '6px 10px', fontSize: '12px' }}>
                  CSV
                </button>
              </>
            )}
            <HeaderActions />
          </div>
        </div>
      </div>

      <div className="container" style={{ paddingTop: '14px' }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', overflowX: 'auto' }}>
          {[
            { key: 'overview', label: '📊 Tổng quan' },
            { key: 'payroll', label: '🧮 Bảng tính công' },
            { key: 'ranking', label: '🏆 Xếp hạng' },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} className={`chip${tab === t.key ? ' active' : ''}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Month nav */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', padding: '10px 14px' }}>
          <button onClick={prevMonth} className="theme-toggle-btn" style={{ width: '32px', height: '32px' }}>
            <ChevronLeft size={16} />
          </button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: '15px' }}>{MONTHS[month - 1]}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Năm {year}</div>
          </div>
          <button onClick={nextMonth} className="theme-toggle-btn" style={{ width: '32px', height: '32px' }}>
            <ChevronRight size={16} />
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[1,2,3,4].map(i => <div key={i} className="skeleton-card" style={{ height: '60px', borderRadius: '12px' }} />)}
          </div>
        ) : (
          <>
            {/* ============ TAB: OVERVIEW ============ */}
            {tab === 'overview' && (
              <div>
                {/* Summary cards */}
                {s && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginBottom: '12px' }}>
                    {[
                      { label: 'Tổng nhân viên', value: s.total_employees, color: 'var(--primary)', bg: 'var(--primary-soft)' },
                      { label: 'Ca làm trong tháng', value: s.total_attendance_days, color: 'var(--green)', bg: 'var(--green-soft)' },
                      { label: 'Tổng giờ làm', value: `${s.total_hours}h`, color: 'var(--blue)', bg: 'var(--blue-soft)' },
                      { label: 'Lượt đi muộn', value: s.total_late_cases, color: 'var(--red)', bg: 'var(--red-soft)' },
                    ].map((item, i) => (
                      <div key={i} className="card" style={{ padding: '12px', background: item.bg }}>
                        <div style={{ fontSize: '22px', fontWeight: 800, color: item.color }}>{item.value}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{item.label}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* 6-month trend chart */}
                {trend?.months?.length > 0 && (
                  <div className="card" style={{ marginBottom: '12px', padding: '14px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '10px', color: 'var(--text-secondary)' }}>
                      📈 Xu hướng chấm công 6 tháng
                    </div>
                    <ResponsiveContainer width="100%" height={140}>
                      <BarChart data={trend.months} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-muted)" />
                        <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                        <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                        <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px' }} />
                        <Bar dataKey="present" radius={[4,4,0,0]} name="Đúng giờ">
                          {trend.months.map((entry, index) => (
                            <Cell key={index} fill={index === trend.months.length - 1 ? 'var(--primary)' : 'var(--primary-soft)'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Per-employee table */}
                {report?.report?.length > 0 && (
                  <div className="card" style={{ padding: '8px', overflowX: 'auto' }}>
                    <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse', whiteSpace: 'nowrap' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                          <th style={{ padding: '6px 8px', textAlign: 'left' }}>Nhân viên</th>
                          <th style={{ padding: '6px 8px', textAlign: 'center' }}>Có mặt</th>
                          <th style={{ padding: '6px 8px', textAlign: 'center' }}>Muộn</th>
                          <th style={{ padding: '6px 8px', textAlign: 'center' }}>Tổng giờ</th>
                          <th style={{ padding: '6px 8px', textAlign: 'center' }}>OT</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.report.map((r, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid var(--border-muted)', background: i % 2 === 0 ? 'transparent' : 'var(--bg-raised)' }}>
                            <td style={{ padding: '6px 8px' }}>
                              <div style={{ fontWeight: 600 }}>{r.full_name}</div>
                              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{r.department_name}</div>
                            </td>
                            <td style={{ padding: '6px 8px', textAlign: 'center', color: 'var(--green)', fontWeight: 700 }}>{r.present_days}</td>
                            <td style={{ padding: '6px 8px', textAlign: 'center', color: r.late_days > 0 ? 'var(--red)' : 'var(--text-muted)' }}>{r.late_days}</td>
                            <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 600 }}>{r.total_hours}h</td>
                            <td style={{ padding: '6px 8px', textAlign: 'center', color: 'var(--blue)' }}>{r.ot_hours > 0 ? `+${r.ot_hours}h` : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ============ TAB: PAYROLL ============ */}
            {tab === 'payroll' && (
              <div>
                <div className="card" style={{ padding: '12px', marginBottom: '12px', background: 'var(--primary-soft)', border: '1px solid var(--primary)' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)', marginBottom: '6px' }}>📌 Công thức tính ngày công:</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                    <div>• <strong>Giờ thường / 8</strong> = Ngày công quy đổi</div>
                    <div>• <strong>Giờ OT × 1.5 / 8</strong> = Ngày công OT quy đổi</div>
                    <div>• <strong>Phạt muộn nhẹ</strong> (1-10p) = -0.25 ngày | <strong>Muộn</strong> (11-30p) = -0.5 ngày | <strong>Muộn nhiều</strong> (&gt;30p) = -1 ngày</div>
                    <div>• <strong>Tổng = Ngày thường + OT - Phạt</strong></div>
                  </div>
                </div>

                {payroll?.payroll?.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {payroll.payroll.map((p, i) => (
                      <div key={i} className="card animate-fade-in" style={{ padding: '14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '10px' }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '14px' }}>{p.full_name}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{p.department_name}</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--primary)', lineHeight: 1 }}>
                              {p.total_work_days}
                            </div>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>/ {p.standard_work_days} ngày công</div>
                          </div>
                        </div>

                        {/* Progress bar */}
                        <div className="progress-bar" style={{ marginBottom: '10px', height: '8px' }}>
                          <div className="progress-bar__fill" style={{
                            width: `${Math.min(100, (p.total_work_days / p.standard_work_days) * 100)}%`,
                            background: p.total_work_days >= p.standard_work_days * 0.9 ? 'var(--green)' : p.total_work_days >= p.standard_work_days * 0.7 ? 'var(--yellow)' : 'var(--red)',
                          }} />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', fontSize: '11px', textAlign: 'center' }}>
                          <div>
                            <div style={{ fontWeight: 700, color: 'var(--green)' }}>{p.attendance_days}d</div>
                            <div style={{ color: 'var(--text-muted)' }}>Ngày TT</div>
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: 'var(--blue)' }}>+{p.ot_equivalent_days}d</div>
                            <div style={{ color: 'var(--text-muted)' }}>OT (×1.5)</div>
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: 'var(--red)' }}>-{p.penalty_days}d</div>
                            <div style={{ color: 'var(--text-muted)' }}>Phạt muộn</div>
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: 'var(--text)' }}>{p.absent_days}d</div>
                            <div style={{ color: 'var(--text-muted)' }}>Vắng</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <div className="empty-state__icon">🧮</div>
                    <div className="empty-state__title">Không có dữ liệu</div>
                    <div className="empty-state__desc">Chưa có bản ghi chấm công trong tháng này</div>
                  </div>
                )}
              </div>
            )}

            {/* ============ TAB: RANKING ============ */}
            {tab === 'ranking' && (
              <div>
                <div className="card" style={{ padding: '12px', marginBottom: '12px', background: 'var(--yellow-soft)', border: '1px solid var(--yellow)' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    <strong>🏆 Điểm xếp hạng</strong> = Đúng giờ (50%) + Tỷ lệ có mặt (30%) + Tổng giờ làm (20%)
                  </div>
                </div>

                {ranking?.ranking?.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {ranking.ranking.map((r, i) => (
                      <div key={i} className="card animate-fade-in" style={{
                        padding: '14px',
                        border: r.rank <= 3 ? `2px solid ${RANK_COLORS[r.rank] || 'var(--border)'}` : '1px solid var(--border)',
                        background: r.rank === 1 ? 'rgba(250, 204, 21, 0.05)' : 'var(--bg-card)',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          {/* Rank badge */}
                          <div style={{
                            width: '40px', height: '40px', flexShrink: 0, borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: r.rank <= 3 ? '22px' : '14px', fontWeight: 800,
                            background: r.rank <= 3 ? 'transparent' : 'var(--bg-raised)',
                            color: r.rank <= 3 ? 'inherit' : 'var(--text-muted)',
                          }}>
                            {RANK_MEDALS[r.rank] || `#${r.rank}`}
                          </div>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: '14px' }}>{r.full_name}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{r.department_name}</div>

                            {/* Mini stats row */}
                            <div style={{ display: 'flex', gap: '10px', fontSize: '11px', marginTop: '4px', flexWrap: 'wrap' }}>
                              <span style={{ color: 'var(--green)' }}>✓ {r.on_time_days} đúng giờ</span>
                              {r.late_days > 0 && <span style={{ color: 'var(--red)' }}>⏰ {r.late_days} muộn</span>}
                              <span style={{ color: 'var(--primary)' }}>{r.total_hours}h</span>
                              {r.ot_hours > 0 && <span style={{ color: 'var(--blue)' }}>OT +{r.ot_hours}h</span>}
                            </div>
                          </div>

                          <div style={{ textAlign: 'center', flexShrink: 0 }}>
                            <div style={{
                              fontSize: '22px', fontWeight: 800,
                              color: r.rank === 1 ? 'var(--yellow)' : r.rank === 2 ? '#94a3b8' : r.rank === 3 ? '#cd7f32' : 'var(--text)',
                            }}>
                              {r.score}
                            </div>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>điểm</div>
                            <div style={{ marginTop: '4px' }}>
                              <span className={`badge ${r.punctuality_rate >= 90 ? 'badge--success' : r.punctuality_rate >= 70 ? 'badge--warning' : 'badge--danger'}`} style={{ fontSize: '10px' }}>
                                {r.punctuality_rate}% đúng giờ
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <div className="empty-state__icon">🏆</div>
                    <div className="empty-state__title">Chưa có dữ liệu</div>
                    <div className="empty-state__desc">Chưa có bản ghi chấm công trong tháng này để xếp hạng</div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
