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
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });
  } catch {
    return '—';
  }
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
  const [holidays, setHolidays] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
  const [selectedBirthday, setSelectedBirthday] = useState(null);
  const [selectedHoliday, setSelectedHoliday] = useState(null);
  const [viewingStaffDetail, setViewingStaffDetail] = useState(null);
  const [flaggedList, setFlaggedList] = useState([]);
  const [verifyingId, setVerifyingId] = useState(null);
  const [fullAvatarImage, setFullAvatarImage] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [allowRecheckin, setAllowRecheckin] = useState(true);

  const fetchFlagged = async () => {
    if (user?.role === 'admin') {
      try {
        const { data } = await api.get('/attendance/flagged');
        setFlaggedList(Array.isArray(data?.flagged) ? data.flagged : []);
      } catch { setFlaggedList([]); }
    } else {
      setFlaggedList([]);
    }
  };

  const handleVerifyAttendance = async (id, action) => {
    setVerifyingId(id);
    try {
      const { data } = await api.put(`/attendance/approve-flagged/${id}`, { action });
      toast.success(data.message || 'Đã xử lý xác minh!');
      fetchFlagged();
      fetchData();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Lỗi xử lý xác minh');
    } finally {
      setVerifyingId(null);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectTarget) return;
    setVerifyingId(rejectTarget._id);
    try {
      const { data } = await api.put(`/attendance/approve-flagged/${rejectTarget._id}`, {
        action: 'reject',
        reviewer_note: rejectReason || 'Từ chối bởi Quản lý',
        allow_recheckin: allowRecheckin
      });
      toast.success(data.message || 'Đã xử lý từ chối!');
      setRejectTarget(null);
      setRejectReason('');
      fetchFlagged();
      fetchData();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Lỗi xử lý từ chối');
    } finally {
      setVerifyingId(null);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [d, p] = await Promise.all([
        api.get('/dashboard/today'),
        api.get('/dashboard/pending-count'),
      ]);
      const resData = d?.data;
      if (resData && typeof resData === 'object' && resData.summary) {
        setData(resData);
      } else {
        console.warn('Dashboard received invalid payload:', resData);
        setData({
          date: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }),
          summary: { total: 0, checked_in: 0, checked_out: 0, absent: 0, present_total: 0 },
          staff: []
        });
      }
      setPendingCount(typeof p?.data?.pending_count === 'number' ? p.data.pending_count : 0);
      setLastRefresh(new Date());
      fetchFlagged();

      api.get('/reports/trend?months=6').then(r => setTrend(r.data)).catch(() => {});
    } catch (err) {
      console.error('FetchData error:', err);
      toast.error('Lỗi tải dashboard');
      setData({
        date: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }),
        summary: { total: 0, checked_in: 0, checked_out: 0, absent: 0, present_total: 0 },
        staff: []
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);
  useEffect(() => {
    const i = setInterval(fetchData, 120000);
    return () => clearInterval(i);
  }, []);

  // Load birthdays, holidays and announcements
  useEffect(() => {
    const todayVN = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
    const [yearVal, monthVal] = todayVN.split('-').map(Number);
    api.get(`/announcements/birthdays?month=${monthVal}`).then(r => setBirthdays(r.data?.birthdays || [])).catch(() => {});
    api.get(`/holidays?year=${yearVal}`).then(r => setHolidays(Array.isArray(r.data) ? r.data : [])).catch(() => {});
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

  if (loading && !data) {
    return (
      <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
        <div style={{ textAlign: 'center' }}>
          <RefreshCw size={32} style={{ animation: 'spin 1s linear infinite', color: 'var(--primary)', marginBottom: '12px' }} />
          <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-secondary)' }}>
            Đang tải dữ liệu Dashboard...
          </div>
        </div>
      </div>
    );
  }

  if (!data && !loading) {
    return (
      <div className="page" style={{ padding: '40px 16px' }}>
        <div className="empty-state" style={{ maxWidth: '400px', margin: '0 auto', textAlign: 'center' }}>
          <div className="empty-state__icon" style={{ fontSize: '40px', marginBottom: '12px' }}>⚠️</div>
          <div className="empty-state__title" style={{ fontSize: '16px', fontWeight: 800 }}>Chưa thể kết nối tới máy chủ</div>
          <div className="empty-state__desc" style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '8px 0 16px' }}>
            Hệ thống trên Render đang khởi động lại. Vui lòng bấm thử lại bên dưới.
          </div>
          <button onClick={fetchData} className="btn btn--primary" style={{ padding: '8px 18px', fontSize: '13px' }}>
            <RefreshCw size={14} /> Thử lại ngay
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="header">
        <div className="header__inner">
          <div>
            <div className="header__title">
              Xin chào, {user?.full_name?.split(' ').pop() || 'bạn'}! 👋
            </div>
            <div className="header__subtitle">
              {new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <button onClick={() => exportAttendanceToCSV(staff, data?.date)} className="btn btn--ghost" style={{ padding: '7px 10px', fontSize: '12px', gap: '4px' }}>
              <Download size={14} /> CSV
            </button>
            <button onClick={fetchData} disabled={loading} className="theme-toggle-btn" title="Làm mới dữ liệu">
              <RefreshCw size={16} style={{ animation: loading ? 'spin 0.6s linear infinite' : 'none' }} />
            </button>
            <HeaderActions />
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt={user.full_name} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--primary)' }} />
            ) : (
              <div className="avatar">{initials}</div>
            )}
          </div>
        </div>
      </div>

      <div className="container" style={{ paddingTop: '14px' }}>
        {/* Bento Grid Stat Cards */}
        {data && (
          <div className="grid-desktop-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: '14px' }}>
            {[
              { icon: <Users size={22} />, label: 'TỔNG NHÂN SỰ', value: s.total, color: 'var(--primary)', bg: 'var(--primary-soft)', border: '1px solid var(--primary-glow)' },
              { icon: <UserCheck size={22} />, label: 'CÓ MẶT HÔM NAY', value: s.present_total, color: 'var(--green)', bg: 'var(--green-soft)', border: '1px solid rgba(16, 185, 129, 0.3)' },
              { icon: <Clock size={22} />, label: 'ĐANG LÀM VIỆC', value: s.checked_in, color: 'var(--blue)', bg: 'var(--blue-soft)', border: '1px solid rgba(6, 182, 212, 0.3)' },
              { icon: <UserX size={22} />, label: 'VẮNG MẶT', value: s.absent, color: 'var(--red)', bg: 'var(--red-soft)', border: '1px solid rgba(244, 63, 94, 0.3)' },
            ].map((item, i) => (
              <div key={i} className="stat-card card--interactive animate-fade-in" style={{ border: item.border, borderRadius: '14px', padding: '14px' }}>
                <div className="stat-card__icon" style={{ background: item.bg, color: item.color, borderRadius: '12px' }}>
                  {item.icon}
                </div>
                <div>
                  <div className="stat-card__value" style={{ fontSize: '24px', fontWeight: 900 }}>{item.value}</div>
                  <div className="stat-card__label" style={{ fontSize: '10px', letterSpacing: '0.5px' }}>{item.label}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Visual attendance ratio bar */}
        {s.total > 0 && (
          <div className="card animate-fade-in" style={{ marginBottom: '14px', padding: '14px', borderRadius: '14px', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', fontWeight: 700, marginBottom: '8px' }}>
              <span style={{ color: 'var(--text)' }}>Tỷ lệ đi làm toàn công ty</span>
              <span style={{ color: 'var(--green)', background: 'var(--green-soft)', padding: '2px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 900 }}>
                {Math.round((s.present_total / s.total) * 100)}% CÓ MẶT
              </span>
            </div>
            <div className="progress-bar" style={{ height: '10px', background: 'var(--bg-input)', borderRadius: '6px', padding: '2px' }}>
              <div style={{ display: 'flex', height: '100%', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${(s.checked_in / s.total) * 100}%`, background: 'var(--green)', transition: 'width 0.5s' }} title="Đang làm" />
                <div style={{ width: `${(s.checked_out / s.total) * 100}%`, background: 'var(--blue)', transition: 'width 0.5s' }} title="Đã về" />
                <div style={{ width: `${(s.absent / s.total) * 100}%`, background: 'var(--red-soft)', transition: 'width 0.5s' }} title="Vắng" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '14px', fontSize: '11px', color: 'var(--text-secondary)', marginTop: '8px', flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 600 }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--green)' }} /> Đang làm ({s.checked_in})
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 600 }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--blue)' }} /> Đã về ({s.checked_out})
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 600 }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--red)' }} /> Vắng mặt ({s.absent})
              </span>
            </div>
          </div>
        )}

        {/* Flagged Attendance & Selfie Verification Card (Admin Only) */}
        {user?.role === 'admin' && flaggedList.length > 0 && (
          <div className="card animate-fade-in" style={{
            marginBottom: '14px', padding: '14px 16px',
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            borderRadius: '14px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={18} />
                <span>🛡️ CẢNH BÁO THIẾT BỊ & DUYỆT XÁC MINH SELFIE</span>
                <span className="badge badge--danger" style={{ fontSize: '11px', fontWeight: 900 }}>
                  {flaggedList.length} CẦN DUYỆT
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {flaggedList.map(item => (
                <div key={item._id} style={{
                  background: 'var(--bg-card)', padding: '12px', borderRadius: '12px',
                  border: '1px solid var(--border)', display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '220px' }}>
                    {item.selfie_url ? (
                      <img
                        src={item.selfie_url}
                        alt="Selfie"
                        onClick={() => setFullAvatarImage({ url: item.selfie_url, title: `Ảnh Selfie: ${item.user_id?.full_name || 'Nhân viên'}` })}
                        style={{
                          width: 52, height: 52, borderRadius: '10px', objectFit: 'cover',
                          border: '2px solid var(--red)', cursor: 'pointer'
                        }}
                        title="Click để phóng to ảnh Selfie"
                      />
                    ) : (
                      <div style={{
                        width: 52, height: 52, borderRadius: '10px', background: 'var(--red-soft)',
                        color: 'var(--red)', fontSize: '10px', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontWeight: 700, textAlign: 'center', padding: '4px'
                      }}>
                        Chưa có Selfie
                      </div>
                    )}

                    <div>
                      <div style={{ fontWeight: 800, fontSize: '13px', color: 'var(--text)' }}>
                        👤 {item.user_id?.full_name || 'Nhân viên'}
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '6px' }}>#{item.user_id?.code || 'NS'}</span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--red)', fontWeight: 700, marginTop: '2px' }}>
                        🚨 Cảnh báo: Dùng chung máy / Chấm hộ
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Lúc: {fmt(item.check_in_time)} · Ngày: {item.date} {item.check_in_note ? `· ${item.check_in_note}` : ''}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', width: '100%', maxWidth: '240px' }}>
                    <button
                      onClick={() => handleVerifyAttendance(item._id, 'approve')}
                      disabled={verifyingId === item._id}
                      className="btn btn--primary"
                      style={{ flex: 1, fontSize: '12px', padding: '6px 10px', background: 'var(--green)', borderColor: 'var(--green)' }}
                    >
                      ✅ Duyệt ca này
                    </button>
                    <button
                      onClick={() => setRejectTarget(item)}
                      disabled={verifyingId === item._id}
                      className="btn btn--ghost"
                      style={{ flex: 1, fontSize: '12px', padding: '6px 10px', color: 'var(--red)', borderColor: 'var(--red)' }}
                    >
                      ❌ Từ chối
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pinned Announcements */}
        {announcements.length > 0 && (
          <div className="card animate-fade-in" style={{ marginBottom: '12px', padding: '14px', borderLeft: '4px solid var(--primary)', background: 'var(--primary-soft)' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Bell size={16} /> Thông báo & Sự kiện nổi bật ({announcements.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {announcements.map(ann => (
                <div
                  key={ann._id}
                  onClick={() => setSelectedAnnouncement(ann)}
                  style={{
                    fontSize: '12px', color: 'var(--text)', cursor: 'pointer',
                    padding: '8px 10px', borderRadius: '8px', background: 'var(--bg-card)',
                    border: '1px solid var(--border)', transition: 'all 0.15s'
                  }}
                  className="card--interactive"
                >
                  <div style={{ fontWeight: 700, color: 'var(--primary)', marginBottom: '2px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>📌 {ann.title}</span>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 500 }}>
                      Xem chi tiết →
                    </span>
                  </div>
                  <div style={{ color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {ann.content}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Birthdays & Events this month — Redesigned SaaS Festive Theme */}
        {(() => {
          const todayVN = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
          const [yearStr, monthStrNum] = todayVN.split('-');
          const monthNum = parseInt(monthStrNum, 10);
          const monthStr = `${yearStr}-${monthStrNum}`;
          const currentMonthHolidays = holidays.filter(h =>
            (h.date && h.date.startsWith(monthStr)) || (h.end_date && h.end_date.startsWith(monthStr))
          );
          const totalMonthEvents = birthdays.length + currentMonthHolidays.length;

          if (totalMonthEvents === 0) return null;

          return (
            <div
              className="card animate-fade-in"
              style={{
                marginBottom: '14px', padding: '14px 16px',
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(217, 119, 6, 0.05) 100%)',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                boxShadow: '0 4px 20px rgba(245, 158, 11, 0.08)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--yellow)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ background: 'rgba(245, 158, 11, 0.2)', padding: '4px 8px', borderRadius: '6px', fontSize: '14px' }}>🎁</span>
                  <span>Sinh nhật & Sự kiện tháng {monthNum}</span>
                  <span className="badge badge--warning" style={{ fontSize: '11px', fontWeight: 800 }}>• {totalMonthEvents} sự kiện</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px' }}>
                {/* Birthdays */}
                {birthdays.map(b => (
                  <div
                    key={`b-${b._id}`}
                    onClick={() => setSelectedBirthday(b)}
                    className="card--interactive"
                    style={{
                      background: 'var(--bg-card)', padding: '8px 12px', borderRadius: '10px',
                      border: '1px solid var(--border)', fontSize: '12px', display: 'flex',
                      alignItems: 'center', gap: '10px', flexShrink: 0, cursor: 'pointer',
                      boxShadow: 'var(--shadow-xs)'
                    }}
                    title="Click để xem chi tiết sinh nhật"
                  >
                    {b.avatar_url ? (
                      <img src={b.avatar_url} alt={b.full_name} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--yellow)' }} />
                    ) : (
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--yellow)', color: '#000', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                        {b.full_name?.split(' ').map(w => w[0]).slice(-2).join('').toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span>{b.full_name}</span>
                        <span style={{ fontSize: '10px', color: 'var(--primary)', fontWeight: 600 }}>#{b.employee_code || 'NS'}</span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--yellow)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', marginTop: '1px' }}>
                        <span>🎂 Ngày {b.day}</span>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>· {b.department_name}</span>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Holidays & Events */}
                {currentMonthHolidays.map(h => {
                  const isSingleDay = !h.end_date || h.end_date === h.date;
                  const startDay = h.date?.split('-')[2];
                  const endDay = h.end_date?.split('-')[2];
                  const dateLabel = isSingleDay ? `Ngày ${startDay}` : `Từ ${startDay} → ${endDay}`;

                  return (
                    <div
                      key={`h-${h._id}`}
                      onClick={() => setSelectedHoliday(h)}
                      className="card--interactive"
                      style={{
                        background: 'var(--bg-card)', padding: '8px 12px', borderRadius: '10px',
                        border: '1px solid #8b5cf6', fontSize: '12px', display: 'flex',
                        alignItems: 'center', gap: '10px', flexShrink: 0, cursor: 'pointer',
                        boxShadow: 'var(--shadow-xs)'
                      }}
                      title="Click để xem chi tiết ngày lễ / sự kiện"
                    >
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%', background: 'rgba(139, 92, 246, 0.15)',
                        color: '#8b5cf6', fontSize: '18px', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', border: '1px solid #8b5cf6', flexShrink: 0
                      }}>
                        🎌
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span>{h.name}</span>
                        </div>
                        <div style={{ fontSize: '11px', color: '#8b5cf6', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', marginTop: '1px' }}>
                          <span>🗓️ {dateLabel}</span>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>· Nghỉ lễ</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

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
                <div
                  key={p.user_id}
                  onClick={() => setViewingStaffDetail(p)}
                  className="person-row animate-fade-in card--interactive"
                  style={{ cursor: 'pointer' }}
                >
                  {p.avatar_url ? (
                    <img
                      src={p.avatar_url}
                      alt={p.full_name}
                      onClick={(e) => {
                        e.stopPropagation();
                        setFullAvatarImage({ url: p.avatar_url, title: p.full_name });
                      }}
                      title="Click để phóng to ảnh"
                      style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '2px solid var(--primary)', cursor: 'zoom-in' }}
                      onError={e => { e.target.onerror=null; e.target.src=''; }}
                    />
                  ) : (
                    <div className="avatar" style={{ width: 38, height: 38, fontSize: '13px', flexShrink: 0 }}>
                      {p.full_name?.split(' ').map(w => w[0]).slice(-2).join('').toUpperCase()}
                    </div>
                  )}
                  <div className="person-row__info">
                    <div className="person-row__name">{p.full_name}</div>
                    <div className="person-row__meta">
                      {p.department_name || '—'}
                      {p.total_hours > 0 && ` · ${p.total_hours}h`}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
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

      {/* Announcement Detail Modal Sheet */}
      {selectedAnnouncement && (
        <div className="modal-overlay" onClick={() => setSelectedAnnouncement(null)}>
          <div className="modal-sheet animate-slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px', margin: '0 auto' }}>
            <div className="modal-sheet__handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Bell size={20} color="var(--primary)" />
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)' }}>
                  Chi tiết thông báo
                </h3>
              </div>
              <button onClick={() => setSelectedAnnouncement(null)} className="btn btn--ghost" style={{ padding: '4px 8px' }}><X size={18} /></button>
            </div>

            <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--primary)', marginBottom: '8px' }}>
              📌 {selectedAnnouncement.title}
            </div>

            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '14px', display: 'flex', gap: '12px' }}>
              <span>📅 Ngày đăng: {selectedAnnouncement.created_at ? new Date(selectedAnnouncement.created_at).toLocaleString('vi-VN') : 'Mới cập nhật'}</span>
              {selectedAnnouncement.created_by?.full_name && (
                <span>👤 Người gửi: {selectedAnnouncement.created_by.full_name}</span>
              )}
            </div>

            <div style={{
              background: 'var(--bg-input)', padding: '14px', borderRadius: '10px',
              border: '1px solid var(--border)', fontSize: '13px', color: 'var(--text)',
              lineHeight: 1.6, whiteSpace: 'pre-wrap', marginBottom: '18px'
            }}>
              {selectedAnnouncement.content}
            </div>

            <button onClick={() => setSelectedAnnouncement(null)} className="btn btn--primary btn--full">
              Đóng
            </button>
          </div>
        </div>
      )}

      {/* Staff Account & Detail Profile Modal Sheet */}
      {viewingStaffDetail && (
        <div className="modal-overlay" onClick={() => setViewingStaffDetail(null)}>
          <div className="modal-sheet animate-slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px', margin: '0 auto', padding: '20px 18px' }}>
            <div className="modal-sheet__handle" />

            {/* Header Bar with distinct border */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: 'var(--text)' }}>👤 Thông Tin Nhân Viên</h3>
              <button onClick={() => setViewingStaffDetail(null)} className="btn btn--ghost" style={{ padding: '4px 8px' }}><X size={18} /></button>
            </div>

            {/* Avatar Header Section - Clean Block with no overlap */}
            <div style={{ textAlign: 'center', marginTop: '10px', marginBottom: '20px', clear: 'both' }}>
              <div
                style={{
                  width: '96px', height: '96px', margin: '0 auto 12px',
                  borderRadius: '50%', border: '4px solid var(--primary)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.25)', overflow: 'hidden',
                  display: 'block', background: 'var(--bg-raised)',
                  cursor: viewingStaffDetail.avatar_url ? 'zoom-in' : 'default'
                }}
                onClick={() => {
                  if (viewingStaffDetail.avatar_url) {
                    setFullAvatarImage({ url: viewingStaffDetail.avatar_url, title: viewingStaffDetail.full_name });
                  }
                }}
                title={viewingStaffDetail.avatar_url ? 'Click để xem ảnh lớn' : ''}
              >
                {viewingStaffDetail.avatar_url ? (
                  <img
                    src={viewingStaffDetail.avatar_url}
                    alt={viewingStaffDetail.full_name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                ) : (
                  <div className="avatar" style={{ width: '100%', height: '100%', fontSize: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {viewingStaffDetail.full_name?.split(' ').map(w => w[0]).slice(-2).join('').toUpperCase()}
                  </div>
                )}
              </div>

              <h2 style={{ fontSize: '18px', fontWeight: 800, marginTop: '6px', marginBottom: '2px', color: 'var(--text)' }}>{viewingStaffDetail.full_name}</h2>
              <div style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 700 }}>#{viewingStaffDetail.employee_code || 'NS-000'}</div>
            </div>

            {/* Information List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '18px' }}>
              <div style={{ background: 'var(--bg-input)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Email: </span>
                <strong>{viewingStaffDetail.email}</strong>
              </div>
              <div style={{ background: 'var(--bg-input)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Số điện thoại: </span>
                <strong>{viewingStaffDetail.phone || 'Chưa cập nhật'}</strong>
              </div>
              <div style={{ background: 'var(--bg-input)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Phòng ban: </span>
                <strong>{viewingStaffDetail.department_name || 'Chưa phân'}</strong>
              </div>
              <div style={{ background: 'var(--bg-input)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Trạng thái hôm nay: </span>
                <strong style={{ color: viewingStaffDetail.today_status === 'checked_in' ? 'var(--green)' : 'var(--text-muted)' }}>
                  {STATUS_MAP[viewingStaffDetail.today_status]?.label || 'Vắng'}
                  {viewingStaffDetail.check_in_time ? ` (Vào lúc ${fmt(viewingStaffDetail.check_in_time)})` : ''}
                </strong>
              </div>
            </div>

            <button onClick={() => setViewingStaffDetail(null)} className="btn btn--primary btn--full">
              Đóng
            </button>
          </div>
        </div>
      )}

      {/* Fullsize Avatar Lightbox Modal */}
      {fullAvatarImage && (
        <div className="modal-overlay" onClick={() => setFullAvatarImage(null)} style={{ background: 'rgba(0, 0, 0, 0.9)', zIndex: 999999, alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh', textAlign: 'center' }}>
            <button
              onClick={() => setFullAvatarImage(null)}
              style={{
                position: 'absolute', top: '-40px', right: '0', background: 'rgba(255,255,255,0.2)',
                border: 'none', color: '#fff', width: '32px', height: '32px', borderRadius: '50%',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
            >
              <X size={20} />
            </button>
            <img
              src={fullAvatarImage.url}
              alt={fullAvatarImage.title}
              style={{ maxWidth: '85vw', maxHeight: '80vh', borderRadius: '16px', objectFit: 'contain', boxShadow: '0 20px 50px rgba(0,0,0,0.8)', border: '2px solid rgba(255,255,255,0.2)' }}
            />
            <div style={{ color: '#fff', marginTop: '12px', fontSize: '14px', fontWeight: 700 }}>
              📸 {fullAvatarImage.title}
            </div>
          </div>
        </div>
      )}

      {/* Birthday Celebration & Event Detail Modal Sheet */}
      {selectedBirthday && (
        <div className="modal-overlay" onClick={() => setSelectedBirthday(null)}>
          <div className="modal-sheet animate-slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px', margin: '0 auto', padding: '20px 18px' }}>
            <div className="modal-sheet__handle" />

            {/* Header Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Gift size={20} color="var(--yellow)" />
                <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: 'var(--yellow)' }}>🎉 Sự Kiện Sinh Nhật</h3>
              </div>
              <button onClick={() => setSelectedBirthday(null)} className="btn btn--ghost" style={{ padding: '4px 8px' }}><X size={18} /></button>
            </div>

            {/* Avatar Header Block — Clean non-overlapping layout */}
            <div style={{ textAlign: 'center', marginTop: '10px', marginBottom: '20px', clear: 'both' }}>
              <div
                style={{
                  width: '96px', height: '96px', margin: '0 auto 12px',
                  borderRadius: '50%', border: '4px solid var(--yellow)',
                  boxShadow: '0 8px 24px rgba(245, 158, 11, 0.25)', overflow: 'hidden',
                  display: 'block', background: 'var(--bg-raised)',
                  cursor: selectedBirthday.avatar_url ? 'zoom-in' : 'default'
                }}
                onClick={() => {
                  if (selectedBirthday.avatar_url) {
                    setFullAvatarImage({ url: selectedBirthday.avatar_url, title: selectedBirthday.full_name });
                  }
                }}
                title={selectedBirthday.avatar_url ? 'Click để xem ảnh lớn' : ''}
              >
                {selectedBirthday.avatar_url ? (
                  <img
                    src={selectedBirthday.avatar_url}
                    alt={selectedBirthday.full_name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                ) : (
                  <div className="avatar" style={{ width: '100%', height: '100%', fontSize: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--yellow)', color: '#000' }}>
                    {selectedBirthday.full_name?.split(' ').map(w => w[0]).slice(-2).join('').toUpperCase()}
                  </div>
                )}
              </div>

              <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--yellow)', marginBottom: '4px' }}>
                🎂 Sinh nhật tháng {new Date().getMonth() + 1}
              </div>
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text)', marginBottom: '2px' }}>{selectedBirthday.full_name}</h2>
              <div style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 700 }}>#{selectedBirthday.employee_code || 'NS-000'}</div>
            </div>

            {/* Event Details Grid */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
              <div style={{ background: 'var(--yellow-soft)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--yellow)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '16px' }}>🎈</span>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--yellow)', fontWeight: 700 }}>NGÀY SINH NHẬT</div>
                  <strong style={{ fontSize: '14px', color: 'var(--text)' }}>Ngày {selectedBirthday.day} tháng {new Date().getMonth() + 1} ({selectedBirthday.dob})</strong>
                </div>
              </div>
              <div style={{ background: 'var(--bg-input)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Phòng ban: </span>
                <strong>{selectedBirthday.department_name}</strong>
              </div>
              <div style={{ background: 'var(--bg-input)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Chức danh: </span>
                <strong>{selectedBirthday.position || 'Nhân viên'}</strong>
              </div>
              {selectedBirthday.email && (
                <div style={{ background: 'var(--bg-input)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Email: </span>
                  <strong>{selectedBirthday.email}</strong>
                </div>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setSelectedBirthday(null)} className="btn btn--ghost btn--full">Đóng</button>
              <button
                onClick={() => {
                  const target = selectedBirthday;
                  setSelectedBirthday(null);
                  setViewingStaffDetail(target);
                }}
                className="btn btn--primary btn--full"
                style={{ fontWeight: 700 }}
              >
                👤 Xem tài khoản đầy đủ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Selected Holiday Detail Modal */}
      {selectedHoliday && (
        <div className="modal-overlay" onClick={() => setSelectedHoliday(null)}>
          <div className="modal-sheet animate-slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', margin: '0 auto' }}>
            <div className="modal-sheet__handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ fontWeight: 800, fontSize: '15px', color: '#8b5cf6', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>🎌 CHI TIẾT SỰ KIỆN / NGÀY LỄ</span>
              </div>
              <button onClick={() => setSelectedHoliday(null)} className="btn btn--ghost" style={{ padding: '4px 8px' }}><X size={18} /></button>
            </div>

            <div className="card" style={{ padding: '16px', marginBottom: '16px', background: 'rgba(139, 92, 246, 0.1)', border: '1px solid #8b5cf6', borderRadius: '12px' }}>
              <div style={{ fontSize: '18px', fontWeight: 800, color: '#8b5cf6', marginBottom: '6px' }}>
                🏖️ {selectedHoliday.name.toUpperCase()}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text)', fontWeight: 600, marginBottom: '4px' }}>
                Áp dụng: <strong>{selectedHoliday.date}</strong> {selectedHoliday.end_date && selectedHoliday.end_date !== selectedHoliday.date ? `→ ${selectedHoliday.end_date}` : ''}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px', background: 'var(--bg-card)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                💬 {selectedHoliday.note || 'Theo quy định của Nhà nước & Công ty.'}
              </div>
            </div>

            <button onClick={() => setSelectedHoliday(null)} className="btn btn--primary btn--full" style={{ fontWeight: 700 }}>
              Đóng
            </button>
          </div>
        </div>
      )}

      {/* Reject Flagged Attendance Modal Sheet */}
      {rejectTarget && (
        <div className="modal-overlay" onClick={() => setRejectTarget(null)}>
          <div className="modal-sheet animate-slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px', margin: '0 auto' }}>
            <div className="modal-sheet__handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={20} color="var(--red)" />
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--red)' }}>
                  Từ chối ca chấm công
                </h3>
              </div>
              <button onClick={() => setRejectTarget(null)} className="btn btn--ghost" style={{ padding: '4px 8px' }}><X size={18} /></button>
            </div>

            <div style={{ background: 'var(--bg-input)', padding: '12px', borderRadius: '10px', marginBottom: '14px', border: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 800, fontSize: '13px', color: 'var(--text)' }}>
                👤 Nhân viên: {rejectTarget.user_id?.full_name || 'Nhân viên'} (#{rejectTarget.user_id?.code || 'NS'})
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Lúc: {fmt(rejectTarget.check_in_time)} · Ngày: {rejectTarget.date}
              </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                Lý do từ chối / Ghi chú:
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="VD: Dùng chung máy, Ảnh không đúng chính chủ..."
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                style={{ width: '100%', fontSize: '13px' }}
              />
            </div>

            <div style={{ marginBottom: '18px', background: 'var(--bg-card)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={allowRecheckin}
                  onChange={e => setAllowRecheckin(e.target.checked)}
                  style={{ width: '16px', height: '16px' }}
                />
                <span>🗑️ Xóa dữ liệu hôm nay để nhân viên CHẤM CÔNG LẠI</span>
              </label>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', marginLeft: '26px' }}>
                (Nếu chọn, nhân viên có thể dùng điện thoại/máy tính chính chủ để bấm Check-in lại ngay)
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setRejectTarget(null)} className="btn btn--ghost" style={{ flex: 1 }}>
                Hủy
              </button>
              <button
                onClick={handleConfirmReject}
                disabled={verifyingId === rejectTarget._id}
                className="btn btn--primary"
                style={{ flex: 1, background: 'var(--red)', borderColor: 'var(--red)' }}
              >
                Xác nhận từ chối
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
