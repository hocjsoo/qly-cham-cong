// src/pages/DashboardPage.jsx
// Dashboard — Stat cards, attendance ratio bar, search+filter, CSV export

import { useState, useEffect } from 'react';
import {
  RefreshCw, Users, UserCheck, Clock, UserX, Download,
  MapPin, ExternalLink, X, Search, AlertTriangle, TrendingUp, Gift, Bell
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import toast from 'react-hot-toast';
import api from '../services/api';
import useAuthStore from '../stores/authStore';
import HeaderActions from '../components/HeaderActions';
import { exportAttendanceToCSV } from '../utils/exportCsv';

const fmt = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });
};

const STATUS_MAP = {
  checked_in:  { label: 'Đang làm', cls: 'badge--success' },
  checked_out: { label: 'Đã về',    cls: 'badge--neutral' },
  absent:      { label: 'Vắng',     cls: 'badge--danger' },
};

const TYPE_MAP = {
  office: '🏢 VP', site: '🏗️ CT', client: '👔 KH', wfh: '🏠 WFH',
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--bg-raised)', border: '1px solid var(--border)',
      borderRadius: '8px', padding: '8px 12px', fontSize: '12px',
    }}>
      <div style={{ fontWeight: 700, marginBottom: '4px' }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.fill }}>{p.name}: <strong>{p.value}</strong></div>
      ))}
    </div>
  );
};

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [data, setData] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [trend, setTrend] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [geo, setGeo] = useState(null);
  const [birthdays, setBirthdays] = useState([]);
  const [announcements, setAnnouncements] = useState([]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [d, p] = await Promise.all([
        api.get('/dashboard/today'),
        api.get('/dashboard/pending-count'),
      ]);
      setData(d.data);
      setPendingCount(p.data.pending_count);
      setLastRefresh(new Date());

      // Load 6-month trend in background (admin/manager only)
      api.get('/reports/trend?months=6').then(r => setTrend(r.data)).catch(() => {});
    } catch { toast.error('Lỗi tải dashboard'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);
  useEffect(() => {
    const i = setInterval(fetchData, 120000);
    return () => clearInterval(i);
  }, []);

  // Load birthdays and announcements
  useEffect(() => {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
    const month = now.getMonth() + 1;
    api.get(`/announcements/birthdays?month=${month}`).then(r => setBirthdays(r.data?.birthdays || [])).catch(() => {});
    api.get('/announcements/pinned').then(r => setAnnouncements(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, []);

  const s = data?.summary || {};
  const staff = data?.staff || [];
  const filtered = staff.filter(p => {
    const matchFilter = filter === 'all' ? true : p.today_status === filter;
    const matchSearch = p.full_name?.toLowerCase().includes(search.toLowerCase()) ||
                        p.email?.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const initials = user?.full_name?.split(' ').map(w => w[0]).slice(-2).join('').toUpperCase() || '?';

  return (
    <div className="page">
      <div className="header">
        <div className="header__inner">
          <div>
            <div className="header__title">Dashboard</div>
            <div className="header__subtitle">
              {new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit' })}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <button onClick={() => exportAttendanceToCSV(staff, data?.date)} className="btn btn--ghost" style={{ padding: '7px 10px', fontSize: '12px' }}>
              <Download size={14} /> CSV
            </button>
            <button onClick={fetchData} disabled={loading} className="theme-toggle-btn">
              <RefreshCw size={16} style={{ animation: loading ? 'spin 0.6s linear infinite' : 'none' }} />
            </button>
            <HeaderActions />
            <div className="avatar">{initials}</div>
          </div>
        </div>
      </div>

      <div className="container" style={{ paddingTop: '14px' }}>
        {/* Stat cards */}
        {data && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginBottom: '12px' }}>
            {[
              { icon: <Users size={18} />, label: 'Tổng', value: s.total, color: 'var(--primary)', bg: 'var(--primary-soft)' },
              { icon: <UserCheck size={18} />, label: 'Có mặt', value: s.present_total, color: 'var(--green)', bg: 'var(--green-soft)' },
              { icon: <Clock size={18} />, label: 'Đang làm', value: s.checked_in, color: 'var(--blue)', bg: 'var(--blue-soft)' },
              { icon: <UserX size={18} />, label: 'Vắng', value: s.absent, color: 'var(--red)', bg: 'var(--red-soft)' },
            ].map((item, i) => (
              <div key={i} className="stat-card animate-fade-in">
                <div className="stat-card__icon" style={{ background: item.bg, color: item.color }}>
                  {item.icon}
                </div>
                <div>
                  <div className="stat-card__value">{item.value}</div>
                  <div className="stat-card__label">{item.label}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Visual attendance ratio bar */}
        {s.total > 0 && (
          <div className="card animate-fade-in" style={{ marginBottom: '12px', padding: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
              <span>Tỷ lệ có mặt hôm nay</span>
              <span style={{ color: 'var(--green)' }}>{Math.round((s.present_total / s.total) * 100)}%</span>
            </div>
            <div className="progress-bar" style={{ height: '8px', background: 'var(--bg-input)' }}>
              <div style={{ display: 'flex', height: '100%', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${(s.checked_in / s.total) * 100}%`, background: 'var(--green)', transition: 'width 0.5s' }} title="Đang làm" />
                <div style={{ width: `${(s.checked_out / s.total) * 100}%`, background: 'var(--blue)', transition: 'width 0.5s' }} title="Đã về" />
                <div style={{ width: `${(s.absent / s.total) * 100}%`, background: 'var(--red-soft)', transition: 'width 0.5s' }} title="Vắng" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--green)' }} /> Đang làm ({s.checked_in})
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--blue)' }} /> Đã về ({s.checked_out})
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--red)' }} /> Vắng ({s.absent})
              </span>
            </div>
          </div>
        )}

        {/* Pinned Announcements */}
        {announcements.length > 0 && (
          <div className="card animate-fade-in" style={{ marginBottom: '12px', padding: '12px', borderLeft: '4px solid var(--primary)', background: 'var(--primary-soft)' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Bell size={16} /> Thông báo đã ghim ({announcements.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {announcements.map(ann => (
                <div key={ann._id} style={{ fontSize: '12px', color: 'var(--text)' }}>
                  <strong>{ann.title}</strong>: {ann.content}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Birthdays this month */}
        {birthdays.length > 0 && (
          <div className="card animate-fade-in" style={{ marginBottom: '12px', padding: '12px', background: 'var(--yellow-soft)', border: '1px solid var(--yellow)' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--yellow)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Gift size={16} /> Sinh nhật nhân sự tháng {new Date().getMonth() + 1} ({birthdays.length})
            </div>
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
              {birthdays.map(b => (
                <div key={b._id} style={{ background: 'var(--bg-raised)', padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                  {b.avatar_url ? (
                    <img src={b.avatar_url} alt={b.full_name} style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--primary)', color: '#fff', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                      {b.full_name.slice(0, 1)}
                    </div>
                  )}
                  <div>
                    <div style={{ fontWeight: 600 }}>{b.full_name}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>🎂 {b.dob} (ngày {b.day})</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 6-Month Trend Mini Chart */}
        {trend?.months?.length > 0 && (
          <div className="card animate-fade-in" style={{ marginBottom: '12px', padding: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
              <TrendingUp size={14} color="var(--primary)" />
              <span style={{ fontSize: '12px', fontWeight: 600 }}>Xu hướng 6 tháng</span>
            </div>
            <ResponsiveContainer width="100%" height={100}>
              <BarChart data={trend.months} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="present" name="Có mặt" radius={[2, 2, 0, 0]}>
                  {trend.months.map((_, i) => (
                    <Cell key={i} fill={i === trend.months.length - 1 ? 'var(--primary)' : 'var(--green)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Pending banner */}
        {pendingCount > 0 && (
          <div className="card animate-fade-in" style={{
            marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px',
            background: 'var(--yellow-soft)', borderColor: 'var(--yellow)',
          }}>
            <AlertTriangle size={18} color="var(--yellow)" />
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              <strong style={{ color: 'var(--yellow)' }}>{pendingCount} đơn</strong> đang chờ duyệt
            </span>
          </div>
        )}

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: '8px' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-input"
            placeholder="Tìm theo tên nhân viên..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: '32px', fontSize: '13px', padding: '6px 12px 6px 32px' }}
          />
        </div>

        {/* Filter chips */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', overflowX: 'auto', paddingBottom: '2px' }}>
          {[
            { value: 'all', label: `Tất cả (${staff.length})` },
            { value: 'checked_in', label: `Đang làm (${s.checked_in || 0})` },
            { value: 'checked_out', label: `Đã về (${s.checked_out || 0})` },
            { value: 'absent', label: `Vắng (${s.absent || 0})` },
          ].map(c => (
            <button key={c.value} onClick={() => setFilter(c.value)} className={`chip${filter === c.value ? ' active' : ''}`}>
              {c.label}
            </button>
          ))}
        </div>

        {/* Staff list */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="skeleton-card" style={{ height: '60px', borderRadius: '12px' }} />
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {filtered.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state__icon">🔍</div>
                <div className="empty-state__title">Không tìm thấy</div>
                <div className="empty-state__desc">Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm</div>
              </div>
            ) : filtered.map((p) => {
              const cfg = STATUS_MAP[p.today_status] || STATUS_MAP.absent;
              return (
                <div key={p.user_id} className="person-row animate-fade-in">
                  <div className="avatar" style={{ width: '34px', height: '34px', fontSize: '12px' }}>
                    {p.full_name?.split(' ').map(w => w[0]).slice(-2).join('').toUpperCase()}
                  </div>
                  <div className="person-row__info">
                    <div className="person-row__name">{p.full_name}</div>
                    <div className="person-row__meta">
                      {p.department_name || '—'}
                      {p.total_hours > 0 && ` · ${p.total_hours}h`}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <span className={`badge ${cfg.cls}`}>{cfg.label}</span>
                    {p.check_in_time && (
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {fmt(p.check_in_time)} ·{' '}
                        <button onClick={() => setGeo(p)} style={{
                          background: 'none', border: 'none', color: 'var(--primary)',
                          cursor: 'pointer', fontSize: '11px', fontFamily: 'inherit', padding: 0, textDecoration: 'underline',
                        }}>
                          {TYPE_MAP[p.check_in_type] || p.check_in_type}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '11px', marginTop: '14px', paddingBottom: '8px' }}>
          {fmt(lastRefresh.toISOString())} · Tự cập nhật mỗi 2 phút
        </p>
      </div>

      {/* GPS Modal */}
      {geo && (
        <div className="modal-overlay" onClick={() => setGeo(null)}>
          <div className="modal-sheet animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="modal-sheet__handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '15px' }}>Vị trí check-in</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{geo.full_name}</div>
              </div>
              <button onClick={() => setGeo(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ background: 'var(--bg)', borderRadius: '8px', padding: '12px', marginBottom: '12px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <MapPin size={16} color="var(--primary)" />
                <strong style={{ fontSize: '14px' }}>{TYPE_MAP[geo.check_in_type] || geo.check_in_type}</strong>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Check-in lúc: {fmt(geo.check_in_time)}</div>
              {geo.check_out_time && (
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>Check-out lúc: {fmt(geo.check_out_time)} ({geo.total_hours}h)</div>
              )}
            </div>

            <a
              href={`https://www.google.com/maps/search/?api=1&query=${geo.check_in_lat || 10.7769},${geo.check_in_lng || 106.7009}`}
              target="_blank"
              rel="noreferrer"
              className="btn btn--primary btn--full"
              style={{ textDecoration: 'none' }}
            >
              <ExternalLink size={16} /> Mở vị trí trên Google Maps
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
