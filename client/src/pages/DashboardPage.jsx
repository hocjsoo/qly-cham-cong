import ImageLightbox from "../components/ImageLightbox";
// src/pages/DashboardPage.jsx
// Dashboard — Stat cards, attendance ratio bar, search+filter, CSV export

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  RefreshCw, Users, UserCheck, Clock, UserX, Download,
  MapPin, ExternalLink, X, Search, AlertTriangle, TrendingUp, Gift, Bell, Megaphone,
  Edit3, Save, Trash2, Settings
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

const createEmptyDashboard = () => ({
  date: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }),
  summary: { total: 0, checked_in: 0, checked_out: 0, absent: 0, present_total: 0 },
  staff: [],
  my_projects: [],
});

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
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAdminOrLeader = user?.role === 'admin' || user?.role === 'leader' || user?.role === 'manager';
  const [data, setData] = useState(null);
  const [allProjects, setAllProjects] = useState([]);

  const checkIsMyProject = (p, currentUser) => {
    if (!p || !currentUser) return false;
    const uid = String(currentUser._id || currentUser.id || '');
    const uname = (currentUser.full_name || '').toLowerCase().trim();
    const ucode = (currentUser.employee_code || '').toLowerCase().trim();
    const uemail = (currentUser.email || '').toLowerCase().trim();
    
    // 1. Check members (ID, employee_code, email, hoặc exact full_name)
    if (Array.isArray(p.members)) {
      const isMember = p.members.some(m => {
        if (!m) return false;
        const mId = String(m._id || m.id || m || '');
        if (uid && mId && mId === uid) return true;

        const mCode = String(m.employee_code || '').toLowerCase().trim();
        if (ucode && mCode && mCode === ucode) return true;

        const mEmail = String(m.email || '').toLowerCase().trim();
        if (uemail && mEmail && mEmail === uemail) return true;

        const mName = String(m.full_name || '').toLowerCase().trim();
        if (uname && mName && mName === uname) return true;

        return false;
      });
      if (isMember) return true;
    }

    // 2. Check pm_id (Ưu tiên tuyệt đối pm_id)
    const pmId = String(p.pm_id?._id || p.pm_id?.id || p.pm_id || '');
    if (uid && pmId && pmId === uid) return true;

    // 3. Check pm_name (Chỉ áp dụng so khớp chính xác 100% họ tên cho dự án cũ chưa có pm_id)
    if (!pmId && p.pm_name && uname) {
      const pmNameLower = p.pm_name.toLowerCase().trim();
      if (pmNameLower === uname) return true;
    }

    return false;
  };
  const [pendingCount, setPendingCount] = useState(0);
  const [trend, setTrend] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [geo, setGeo] = useState(null);
  const [birthdays, setBirthdays] = useState([]);
  const [anniversaries, setAnniversaries] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
  const [editExpiryDate, setEditExpiryDate] = useState('');
  const [savingExpiry, setSavingExpiry] = useState(false);
  const [showAnnivSettingsModal, setShowAnnivSettingsModal] = useState(false);
  const [annivDisplayMode, setAnnivDisplayMode] = useState('month');
  const [annivDisplayDays, setAnnivDisplayDays] = useState(7);
  const [savingAnnivSettings, setSavingAnnivSettings] = useState(false);
  const [selectedBirthday, setSelectedBirthday] = useState(null);
  const [selectedAnniversary, setSelectedAnniversary] = useState(null);
  const [selectedHoliday, setSelectedHoliday] = useState(null);
  const [viewingStaffDetail, setViewingStaffDetail] = useState(null);
  const [, setFlaggedList] = useState([]);
  const [verifyingId, setVerifyingId] = useState(null);
  const [fullAvatarImage, setFullAvatarImage] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [allowRecheckin, setAllowRecheckin] = useState(true);
  const [flaggedTab] = useState('pending'); // 'pending' | 'all' | 'approved' | 'rejected' | 'photo'
  const [flaggedCounts, setFlaggedCounts] = useState({ total: 0, pending: 0, approved: 0, rejected: 0, with_photo: 0 });

  const fetchFlagged = useCallback(async (targetTab = flaggedTab) => {
    if (user?.role === 'admin' || user?.role === 'leader' || user?.role === 'manager') {
      try {
        const queryStatus = targetTab === 'photo' ? 'all' : targetTab;
        const hasPhotoParam = targetTab === 'photo' ? '&has_photo=true' : '';
        const { data } = await api.get(`/attendance/flagged?status=${queryStatus}${hasPhotoParam}`);
        setFlaggedList(Array.isArray(data?.flagged) ? data.flagged : []);
        if (data?.counts) {
          setFlaggedCounts(data.counts);
        }
      } catch {
        setFlaggedList([]);
      }
    } else {
      setFlaggedList([]);
    }
  }, [flaggedTab, user?.role]);

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

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      if (!isAdminOrLeader) {
        const projRes = await api.get('/projects?active_only=true&compact=true').catch(() => ({ data: [] }));
        setData(createEmptyDashboard());
        setPendingCount(0);
        setAllProjects(Array.isArray(projRes?.data) ? projRes.data : (projRes?.data?.projects || []));
        setLastRefresh(new Date());
        return;
      }

      const [d, p, projRes] = await Promise.all([
        api.get('/dashboard/today'),
        api.get('/dashboard/pending-count'),
        api.get('/projects?active_only=true&compact=true').catch(() => ({ data: [] })),
      ]);
      const resData = d?.data;
      if (resData && typeof resData === 'object' && resData.summary) {
        setData(resData);
      } else {
        console.warn('Dashboard received invalid payload:', resData);
        setData(createEmptyDashboard());
      }
      setPendingCount(typeof p?.data?.pending_count === 'number' ? p.data.pending_count : 0);
      setAllProjects(Array.isArray(projRes?.data) ? projRes.data : (projRes?.data?.projects || []));
      setLastRefresh(new Date());
      fetchFlagged();

      if (isAdminOrLeader) {
        api.get('/reports/trend?months=6').then(r => setTrend(r.data)).catch(() => {});
      }
    } catch (err) {
      console.error('FetchData error:', err);
      toast.error('Lỗi tải dashboard');
      setData(createEmptyDashboard());
    } finally {
      setLoading(false);
    }
  }, [fetchFlagged, isAdminOrLeader]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    const i = setInterval(fetchData, 120000);
    return () => clearInterval(i);
  }, [fetchData]);

  // Load birthdays, anniversaries, holidays and announcements
  useEffect(() => {
    const todayVN = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
    const [yearVal, monthVal] = todayVN.split('-').map(Number);
    const monthStr = String(monthVal).padStart(2, '0');
    api.get(`/announcements/birthdays?month=${monthVal}`).then(r => setBirthdays(r.data?.birthdays || [])).catch(() => {});
    api.get(`/announcements/anniversaries?month=${monthVal}`).then(r => setAnniversaries(r.data?.anniversaries || [])).catch(() => {});
    api.get(`/holidays?year=${yearVal}&month=${monthVal}`).then(r => {
      const raw = Array.isArray(r.data) ? r.data : [];
      const monthHols = raw.filter(h => (h.date && h.date.includes(`-${monthStr}-`)) || (h.end_date && h.end_date.includes(`-${monthStr}-`)));
      setHolidays(monthHols);
    }).catch(() => {});
    api.get('/announcements/pinned').then(r => setAnnouncements(Array.isArray(r.data) ? r.data : [])).catch(() => {});
    api.get('/settings').then(r => {
      const s = r.data?.settings || r.data || {};
      if (s.anniversary_display_mode) setAnnivDisplayMode(s.anniversary_display_mode);
      if (s.anniversary_display_days) setAnnivDisplayDays(s.anniversary_display_days);
    }).catch(() => {});
  }, []);

  const handleSaveAnnivSettings = async () => {
    setSavingAnnivSettings(true);
    try {
      await api.put('/settings', {
        anniversary_display_mode: annivDisplayMode,
        anniversary_display_days: annivDisplayDays,
      });
      toast.success('Đã cập nhật chu kỳ hiển thị Kỷ niệm & Sinh nhật thành công! 🎉');
      setShowAnnivSettingsModal(false);
      // Reload birthdays & anniversaries
      const todayVN = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
      const [, monthVal] = todayVN.split('-').map(Number);
      api.get(`/announcements/birthdays?month=${monthVal}`).then(r => setBirthdays(r.data?.birthdays || [])).catch(() => {});
      api.get(`/announcements/anniversaries?month=${monthVal}`).then(r => setAnniversaries(r.data?.anniversaries || [])).catch(() => {});
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Lỗi lưu cấu hình chu kỳ hiển thị');
    } finally {
      setSavingAnnivSettings(false);
    }
  };

  // Sync editExpiryDate whenever selectedAnnouncement changes
  useEffect(() => {
    if (selectedAnnouncement) {
      if (selectedAnnouncement.expires_at) {
        const d = new Date(selectedAnnouncement.expires_at);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const mins = String(d.getMinutes()).padStart(2, '0');
        setEditExpiryDate(`${year}-${month}-${day}T${hours}:${mins}`);
      } else {
        setEditExpiryDate('');
      }
    }
  }, [selectedAnnouncement]);

  const handleSetExpiryPreset = (days) => {
    if (days === null) {
      setEditExpiryDate('');
      return;
    }
    const target = new Date();
    if (days === 'end_of_month') {
      const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0);
      target.setFullYear(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate());
      target.setHours(23, 59, 0, 0);
    } else {
      target.setDate(target.getDate() + Number(days));
      target.setHours(23, 59, 0, 0);
    }
    const year = target.getFullYear();
    const month = String(target.getMonth() + 1).padStart(2, '0');
    const day = String(target.getDate()).padStart(2, '0');
    const hours = String(target.getHours()).padStart(2, '0');
    const mins = String(target.getMinutes()).padStart(2, '0');
    setEditExpiryDate(`${year}-${month}-${day}T${hours}:${mins}`);
  };

  const handleSaveAnnouncementExpiry = async () => {
    if (!selectedAnnouncement) return;
    setSavingExpiry(true);
    try {
      const payload = {
        expires_at: editExpiryDate ? new Date(editExpiryDate).toISOString() : null,
      };
      await api.put(`/announcements/${selectedAnnouncement._id}`, payload);
      toast.success('Đã cập nhật thời gian hiển thị thông báo thành công! ✅');
      
      setAnnouncements(prev => prev.map(a => a._id === selectedAnnouncement._id ? { ...a, expires_at: payload.expires_at } : a));
      setSelectedAnnouncement(prev => prev ? { ...prev, expires_at: payload.expires_at } : null);
    } catch (err) {
      console.error('Update expiry error:', err);
      toast.error(err?.response?.data?.error || 'Lỗi cập nhật thời gian hiển thị');
    } finally {
      setSavingExpiry(false);
    }
  };

  const handleDeleteAnnouncement = async () => {
    if (!selectedAnnouncement) return;
    if (!window.confirm('Bạn có chắc chắn muốn gỡ thông báo này khỏi Bảng tin không?')) return;
    setSavingExpiry(true);
    try {
      await api.delete(`/announcements/${selectedAnnouncement._id}`);
      toast.success('Đã gỡ thông báo thành công! ✅');
      setAnnouncements(prev => prev.filter(a => a._id !== selectedAnnouncement._id));
      setSelectedAnnouncement(null);
    } catch (err) {
      console.error('Delete announcement error:', err);
      toast.error('Lỗi gỡ thông báo');
    } finally {
      setSavingExpiry(false);
    }
  };

  const s = data?.summary || {};
  const staff = data?.staff || [];
  const filtered = staff.filter(p => {
    const matchFilter = filter === 'all' ? true : p.today_status === filter;
    const matchSearch = p.full_name?.toLowerCase().includes(search.toLowerCase()) ||
                        p.email?.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

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

  const isAdmin = user?.role === 'admin';
  const myProjsFromAll = allProjects.filter(p => checkIsMyProject(p, user));
  const combinedProjects = myProjsFromAll.length > 0
    ? myProjsFromAll
    : (isAdmin ? (data?.my_projects || allProjects.slice(0, 6)) : (data?.my_projects || []));

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
            {isAdminOrLeader && (
              <button onClick={() => exportAttendanceToCSV(staff, data?.date)} className="btn btn--ghost" style={{ padding: '7px 10px', fontSize: '12px', gap: '4px' }}>
                <Download size={14} /> CSV
              </button>
            )}
            <button onClick={fetchData} disabled={loading} className="theme-toggle-btn" title="Làm mới dữ liệu">
              <RefreshCw size={16} style={{ animation: loading ? 'spin 0.6s linear infinite' : 'none' }} />
            </button>
            <HeaderActions />
            <img
              src={user?.avatar_url || '/logo.png'}
              alt={user?.full_name || 'User'}
              style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--primary)', flexShrink: 0 }}
              onError={e => { e.target.src = '/logo.png'; }}
            />
          </div>
        </div>
      </div>

      <div className="container" style={{ paddingTop: '14px' }}>
        {!isAdminOrLeader && (
          <div className="card animate-fade-in" style={{
            marginBottom: '14px', padding: '16px 18px',
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(59, 130, 246, 0.06) 100%)',
            border: '1px solid rgba(99, 102, 241, 0.35)',
            borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <img
                src={user?.avatar_url || '/logo.png'}
                alt={user?.full_name}
                style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--primary)', flexShrink: 0 }}
                onError={e => { e.target.src = '/logo.png'; }}
              />
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)' }}>{user?.full_name}</span>
                  <span className="badge badge--info" style={{ fontSize: '11px', fontWeight: 700 }}>#{user?.employee_code || 'NS'}</span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  🏢 {user?.department_name || 'Kiến trúc ET'} · {user?.position || 'Nhân viên'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bento Grid Stat Cards (Admin/Leader only) */}
        {isAdminOrLeader && data && (
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

        {/* Visual attendance ratio bar (Admin/Leader only) */}
        {isAdminOrLeader && s.total > 0 && (
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

        {/* Flagged Attendance Alert Banner (Admin & Leader) */}
        {isAdminOrLeader && flaggedCounts.pending > 0 && (
          <div className="card animate-fade-in" style={{
            marginBottom: '14px', padding: '12px 14px',
            background: 'var(--yellow-soft)',
            border: '1px solid var(--yellow)',
            borderRadius: '12px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ background: 'var(--yellow)', color: '#000', width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flexShrink: 0 }}>
                🛡️
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text)' }}>
                  Có {flaggedCounts.pending} ca chấm công có cảnh báo / ảnh selfie cần đối soát
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  Chấm công dự phòng ngoài GPS hoặc thiết bị chưa định danh
                </div>
              </div>
            </div>
            <button
              onClick={() => navigate('/requests?tab=flagged')}
              className="btn btn--primary"
              style={{ fontSize: '12px', padding: '6px 14px', fontWeight: 700, whiteSpace: 'nowrap' }}
            >
              Xử lý tại Portal Phê Duyệt →
            </button>
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
                  <div style={{ fontWeight: 700, color: 'var(--primary)', marginBottom: '4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>📌 {ann.title}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {ann.expires_at && (
                        <span style={{ fontSize: '10px', background: 'rgba(59, 130, 246, 0.12)', color: 'var(--primary)', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                          ⏳ Hiện đến: {new Date(ann.expires_at).toLocaleDateString('vi-VN')}
                        </span>
                      )}
                      {user?.role === 'admin' && (
                        <span style={{ fontSize: '10.5px', background: 'rgba(99, 102, 241, 0.15)', color: 'var(--primary)', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                          ✏️ Sửa thời hạn
                        </span>
                      )}
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 500 }}>
                        Xem chi tiết →
                      </span>
                    </div>
                  </div>
                  <div style={{ color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {ann.content}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Widget: Dự Án Đang Tham Gia */}
        {combinedProjects.length > 0 && (
          <div
            className="card animate-fade-in"
            style={{
              marginBottom: '14px', padding: '14px 16px',
              background: 'linear-gradient(135deg, rgba(59,130,246,0.08) 0%, rgba(99,102,241,0.04) 100%)',
              border: '1px solid rgba(59,130,246,0.3)',
              borderRadius: '14px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ background: 'var(--primary-soft)', padding: '4px 8px', borderRadius: '6px', fontSize: '14px' }}>🏗️</span>
                <span>Dự Án Đang Tham Gia</span>
                <span className="badge badge--info" style={{ fontSize: '11px', fontWeight: 800 }}>• {combinedProjects.length} dự án</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px' }}>
              {combinedProjects.map(proj => (
                <div
                  key={proj._id || proj.id}
                  onClick={() => navigate('/projects')}
                  style={{
                    background: 'var(--bg-card)', padding: '10px 12px', borderRadius: '10px',
                    border: '1px solid var(--border)', fontSize: '12px', minWidth: '220px', flexShrink: 0,
                    boxShadow: 'var(--shadow-xs)', cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                    {proj.avatar_url ? (
                      <img
                        src={proj.avatar_url}
                        alt={proj.name}
                        style={{ width: '28px', height: '28px', borderRadius: '6px', objectFit: 'cover', border: '1px solid var(--primary)', flexShrink: 0 }}
                        onError={e => { e.target.style.display = 'none'; }}
                      />
                    ) : null}
                    <div style={{ fontWeight: 800, color: 'var(--text)', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      {proj.name}
                    </div>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span>🏷️ {proj.code || 'DA'}</span>
                    {proj.deadline && <span>⏱️ {proj.deadline}</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ flex: 1, height: '6px', background: 'var(--bg-raised)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', width: `${Math.min(100, Math.max(0, proj.progress || 0))}%`,
                        background: (proj.progress || 0) >= 100 ? 'var(--blue)' : 'var(--green)',
                        borderRadius: '3px'
                      }} />
                    </div>
                    <span style={{ fontSize: '10px', fontWeight: 700 }}>{proj.progress || 0}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Widget: Kỷ Niệm Làm Việc, Sinh Nhật & Sự Kiện */}
        {(() => {
          const todayVN = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
          const [yearStr, monthStrNum] = todayVN.split('-');
          const monthStr = `${yearStr}-${monthStrNum}`;
          const currentMonthHolidays = holidays.filter(h =>
            (h.date && h.date.startsWith(monthStr)) || (h.end_date && h.end_date.startsWith(monthStr))
          );
          const totalMonthEvents = (anniversaries?.length || 0) + birthdays.length + currentMonthHolidays.length;

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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '6px' }}>
                <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--yellow)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ background: 'rgba(245, 158, 11, 0.2)', padding: '4px 8px', borderRadius: '6px', fontSize: '14px' }}>🎁</span>
                  <span>Kỷ Niệm Gắn Bó, Sinh Nhật & Sự Kiện</span>
                  <span className="badge badge--warning" style={{ fontSize: '11px', fontWeight: 800 }}>• {totalMonthEvents} sự kiện</span>
                </div>
                {isAdminOrLeader && (
                  <button
                    onClick={() => setShowAnnivSettingsModal(true)}
                    className="btn btn--ghost"
                    style={{
                      fontSize: '11px', padding: '3px 8px', color: 'var(--yellow)',
                      background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.35)',
                      borderRadius: '6px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer'
                    }}
                    title="Cài đặt chu kỳ hiển thị sự kiện kỷ niệm & sinh nhật"
                  >
                    <Settings size={12} /> Sửa thời gian hiện
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px' }}>
                {/* Work Anniversaries */}
                {anniversaries?.map((a, aIdx) => (
                  <div
                    key={`anniv-${a._id || a.user_id || aIdx}`}
                    onClick={() => setSelectedAnniversary(a)}
                    className="card--interactive"
                    style={{
                      background: 'var(--bg-card)', padding: '8px 12px', borderRadius: '10px',
                      border: '1px solid var(--primary)', fontSize: '12px', display: 'flex',
                      alignItems: 'center', gap: '10px', flexShrink: 0, cursor: 'pointer',
                      boxShadow: 'var(--shadow-xs)'
                    }}
                    title="Click để xem chi tiết vinh danh cống hiến"
                  >
                    <img
                      src={a.avatar_url || '/logo.png'}
                      alt={a.full_name}
                      style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--primary)', flexShrink: 0 }}
                      onError={e => { e.target.src = '/logo.png'; }}
                    />
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span>{a.full_name}</span>
                        <span style={{ fontSize: '10px', color: 'var(--primary)', fontWeight: 600 }}>#{a.employee_code || 'NS'}</span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 700, marginTop: '1px' }}>
                        🎉 {a.badge || `Tròn ${a.years_count || a.years || 1} năm cống hiến`} ({a.anniversary_date || (a.start_year ? `Năm ${a.start_year}` : '')})
                      </div>
                    </div>
                  </div>
                ))}

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
                    <img
                      src={b.avatar_url || '/logo.png'}
                      alt={b.full_name}
                      style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--yellow)', flexShrink: 0 }}
                      onError={e => { e.target.src = '/logo.png'; }}
                    />
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

        {/* NON-ADMIN/LEADER: Quick Portal Utilities Grid */}
        {!isAdminOrLeader && (
          <div className="card animate-fade-in" style={{
            marginBottom: '14px', padding: '14px 16px',
            background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '14px'
          }}>
            <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>⚡ Tiện Ích & Chức Năng Nhanh</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px' }}>
              {[
                { to: '/projects', icon: '🚀', label: 'Dự Án', desc: `${combinedProjects.length} dự án` },
                { to: '/leaderboard', icon: '🏆', label: 'Xếp Hạng', desc: 'Thi đua chuyên cần' },
                { to: '/vehicles', icon: '🚲', label: 'Gửi Xe', desc: 'Phương tiện' },
                { to: '/expenses', icon: '🧾', label: 'Chi Tiêu', desc: 'Bảng hoàn ứng' },
                { to: '/profile', icon: '👤', label: 'Cá Nhân', desc: 'Tài khoản & xe' },
              ].map(item => (
                <div
                  key={item.to}
                  onClick={() => navigate(item.to)}
                  className="card--interactive"
                  style={{
                    padding: '12px 10px', borderRadius: '10px', background: 'var(--bg-raised)',
                    border: '1px solid var(--border)', textAlign: 'center', cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px'
                  }}
                >
                  <span style={{ fontSize: '22px' }}>{item.icon}</span>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text)' }}>{item.label}</span>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{item.desc}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ADMIN & LEADER: 6-Month Trend Mini Chart */}
        {isAdminOrLeader && trend?.months?.length > 0 && (
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

        {/* ADMIN & LEADER: Pending banner */}
        {isAdminOrLeader && pendingCount > 0 && (
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

        {/* ADMIN & LEADER: Search & Staff Attendance List */}
        {isAdminOrLeader && (
          <>
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
                      <img
                        src={p.avatar_url || '/logo.png'}
                        alt={p.full_name}
                        onClick={(e) => {
                          e.stopPropagation();
                          setFullAvatarImage({ url: p.avatar_url || '/logo.png', title: p.full_name });
                        }}
                        title="Click để phóng to ảnh"
                        style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '2px solid var(--primary)', cursor: 'zoom-in' }}
                        onError={e => { e.target.src = '/logo.png'; }}
                      />
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
          </>
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



      {/* Staff Account & Detail Profile Modal Sheet */}
      {viewingStaffDetail && typeof document !== "undefined" && createPortal(
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
                <img
                  src={viewingStaffDetail.avatar_url || '/logo.png'}
                  alt={viewingStaffDetail.full_name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  onError={e => { e.target.src = '/logo.png'; }}
                />
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

            {/* Bank Info for Admin */}
            {isAdminOrLeader && (viewingStaffDetail.bank_name || viewingStaffDetail.bank_account) && (
              <div style={{ background: "var(--primary-soft)", padding: "12px 14px", borderRadius: "12px", border: "1px solid color-mix(in srgb, var(--primary) 30%, var(--border))", marginBottom: "16px" }}>
                <div style={{ fontSize: "11px", fontWeight: 800, color: "var(--primary)", textTransform: "uppercase", marginBottom: "6px" }}>💳 Tài Khoản Ngân Hàng</div>
                <div style={{ fontSize: "13px", display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                  <span style={{ color: "var(--text-secondary)" }}>Ngân hàng:</span>
                  <strong>{viewingStaffDetail.bank_name || "—"}</strong>
                </div>
                <div style={{ fontSize: "13px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "var(--text-secondary)" }}>Số tài khoản:</span>
                  <strong style={{ color: "var(--primary)", fontSize: "14px", fontVariantNumeric: "tabular-nums" }}>{viewingStaffDetail.bank_account || "—"}</strong>
                </div>
              </div>
            )}

            <button onClick={() => setViewingStaffDetail(null)} className="btn btn--primary btn--full">
              Đóng
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Fullsize Avatar Lightbox Modal */}
      <ImageLightbox image={fullAvatarImage} onClose={() => setFullAvatarImage(null)} />

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
                <img
                  src={selectedBirthday.avatar_url || '/logo.png'}
                  alt={selectedBirthday.full_name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  onError={e => { e.target.src = '/logo.png'; }}
                />
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

      {/* Announcement Detail Modal — Redesigned Spacious & Premium */}
      {selectedAnnouncement && (
        <div className="modal-overlay" style={{ zIndex: 999999, padding: '16px' }} onClick={() => setSelectedAnnouncement(null)}>
          <div
            className="modal-sheet animate-slide-up"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '560px', width: '100%', margin: '0 auto',
              padding: '24px 26px', borderRadius: '20px',
              boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
              border: '1px solid var(--border)'
            }}
          >
            <div className="modal-sheet__handle" />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '38px', height: '38px', borderRadius: '12px',
                  background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(168, 85, 247, 0.2))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '1px solid rgba(99, 102, 241, 0.3)'
                }}>
                  <Megaphone size={20} color="var(--primary)" />
                </div>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                    📢 Thông Báo Công Ty
                  </div>
                  <h3 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text)', margin: 0, lineHeight: 1.2 }}>
                    Nội dung thông báo
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setSelectedAnnouncement(null)}
                className="btn btn--ghost"
                style={{ width: '36px', height: '36px', borderRadius: '50%', padding: 0 }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{
              background: 'var(--primary-soft)', padding: '12px 16px', borderRadius: '12px',
              border: '1px solid rgba(99, 102, 241, 0.2)', marginBottom: '16px'
            }}>
              <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)', lineHeight: 1.4, marginBottom: '6px' }}>
                {selectedAnnouncement.title}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                <span>📅 {selectedAnnouncement.created_at ? new Date(selectedAnnouncement.created_at).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Hôm nay'}</span>
                <span>•</span>
                <span>👤 Ban Giám Đốc</span>
                <span className="badge badge--info" style={{ fontSize: '10px', padding: '2px 8px' }}>Chính thức</span>
              </div>
            </div>

            <div style={{
              background: 'var(--bg-raised)', padding: '18px 20px', borderRadius: '14px',
              border: '1px solid var(--border)', fontSize: '14px', color: 'var(--text)',
              lineHeight: 1.7, whiteSpace: 'pre-line', marginBottom: '22px',
              maxHeight: '360px', overflowY: 'auto'
            }}>
              {selectedAnnouncement.content}
            </div>

            <button
              onClick={() => setSelectedAnnouncement(null)}
              className="btn btn--primary btn--full btn--lg"
              style={{ padding: '12px', fontSize: '14px', fontWeight: 800, borderRadius: '12px' }}
            >
              Đã hiểu & Xác nhận ✓
            </button>
          </div>
        </div>
      )}

      {/* Birthday Detail Modal */}
      {selectedBirthday && (
        <div className="modal-overlay" style={{ zIndex: 999999, padding: '16px' }} onClick={() => setSelectedBirthday(null)}>
          <div
            className="modal-sheet animate-slide-up"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '520px', width: '100%', margin: '0 auto',
              padding: '24px 26px', borderRadius: '20px',
              boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
              border: '1px solid rgba(245, 158, 11, 0.4)'
            }}
          >
            <div className="modal-sheet__handle" />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '42px', height: '42px', borderRadius: '12px',
                  background: 'rgba(245, 158, 11, 0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '1.5px solid var(--yellow)', fontSize: '22px'
                }}>
                  🎂
                </div>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--yellow)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                    Chúc Mừng Sinh Nhật
                  </div>
                  <h3 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text)', margin: 0, lineHeight: 1.2 }}>
                    Sinh Nhật Tháng Này 🎉
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setSelectedBirthday(null)}
                className="btn btn--ghost"
                style={{ width: '36px', height: '36px', borderRadius: '50%', padding: 0 }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Profile Highlight Card */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(217, 119, 6, 0.05) 100%)',
              padding: '16px', borderRadius: '14px',
              border: '1px solid rgba(245, 158, 11, 0.3)', marginBottom: '16px',
              display: 'flex', alignItems: 'center', gap: '14px'
            }}>
              <img
                src={selectedBirthday.avatar_url || '/logo.png'}
                alt={selectedBirthday.full_name}
                style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--yellow)', flexShrink: 0 }}
                onError={e => { e.target.src = '/logo.png'; }}
              />
              <div>
                <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)' }}>
                  {selectedBirthday.full_name}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  #{selectedBirthday.employee_code || 'NS'} · {selectedBirthday.position || 'Nhân viên'}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>
                  🏢 {selectedBirthday.department_name || 'Phòng ban'}
                </div>
              </div>
            </div>

            {/* Birthday Date Info */}
            <div style={{
              background: 'var(--bg-raised)', padding: '14px 16px', borderRadius: '12px',
              border: '1px solid var(--border)', marginBottom: '16px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Ngày sinh nhật:</div>
                <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--yellow)', marginTop: '2px' }}>
                  🎂 Ngày {selectedBirthday.day || selectedBirthday.dob}
                </div>
              </div>
              {selectedBirthday.phone && (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Số điện thoại chúc mừng:</div>
                  <a href={`tel:${selectedBirthday.phone}`} style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary)', textDecoration: 'none' }}>
                    📞 {selectedBirthday.phone}
                  </a>
                </div>
              )}
            </div>

            {/* Birthday Message Box */}
            <div style={{
              background: 'var(--bg-card)', padding: '14px 16px', borderRadius: '12px',
              border: '1px dashed rgba(245, 158, 11, 0.4)', fontSize: '13px', color: 'var(--text)',
              lineHeight: 1.6, marginBottom: '20px'
            }}>
              ✨ <strong>Kiến trúc ET kính chúc</strong> {selectedBirthday.full_name} một sinh nhật thật nhiều niềm vui, sức khỏe dồi dào, hạnh phúc và gặt hái thêm nhiều thành công rực rỡ cùng đại gia đình công ty! 🎁🥂
            </div>

            {user?.role === 'admin' && (
              <div style={{ marginBottom: '14px', display: 'flex', justifyContent: 'center' }}>
                <button
                  onClick={() => {
                    setSelectedBirthday(null);
                    setShowAnnivSettingsModal(true);
                  }}
                  className="btn btn--ghost"
                  style={{
                    fontSize: '11.5px', color: 'var(--yellow)',
                    background: 'rgba(245, 158, 11, 0.10)', border: '1px dashed rgba(245, 158, 11, 0.4)',
                    borderRadius: '8px', padding: '6px 12px', fontWeight: 700,
                    display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer'
                  }}
                >
                  <Settings size={13} /> Sửa chu kỳ hiển thị sự kiện & sinh nhật
                </button>
              </div>
            )}

            <button
              onClick={() => setSelectedBirthday(null)}
              className="btn btn--primary btn--full btn--lg"
              style={{ padding: '12px', fontSize: '14px', fontWeight: 800, borderRadius: '12px' }}
            >
              Đóng cửa sổ ✓
            </button>
          </div>
        </div>
      )}

      {/* Work Anniversary Detail Modal */}
      {selectedAnniversary && (
        <div className="modal-overlay" style={{ zIndex: 999999, padding: '16px' }} onClick={() => setSelectedAnniversary(null)}>
          <div
            className="modal-sheet animate-slide-up"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '520px', width: '100%', margin: '0 auto',
              padding: '24px 26px', borderRadius: '20px',
              boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
              border: '1px solid var(--primary)'
            }}
          >
            <div className="modal-sheet__handle" />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '42px', height: '42px', borderRadius: '12px',
                  background: 'var(--primary-soft)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '1.5px solid var(--primary)', fontSize: '22px'
                }}>
                  🏅
                </div>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                    Vinh Danh & Tri Ân
                  </div>
                  <h3 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text)', margin: 0, lineHeight: 1.2 }}>
                    Kỷ Niệm Cống Hiến Gắn Bó 🏆
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setSelectedAnniversary(null)}
                className="btn btn--ghost"
                style={{ width: '36px', height: '36px', borderRadius: '50%', padding: 0 }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Profile Highlight Card */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.12) 0%, rgba(99, 102, 241, 0.05) 100%)',
              padding: '16px', borderRadius: '14px',
              border: '1px solid var(--primary-soft)', marginBottom: '16px',
              display: 'flex', alignItems: 'center', gap: '14px'
            }}>
              <img
                src={selectedAnniversary.avatar_url || '/logo.png'}
                alt={selectedAnniversary.full_name}
                style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--primary)', flexShrink: 0 }}
                onError={e => { e.target.src = '/logo.png'; }}
              />
              <div>
                <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)' }}>
                  {selectedAnniversary.full_name}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  #{selectedAnniversary.employee_code || 'NS'} · {selectedAnniversary.position || 'Nhân viên'}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>
                  🏢 {selectedAnniversary.department_name || 'Phòng ban'}
                </div>
              </div>
            </div>

            {/* Work Anniversary Milestone Card */}
            <div style={{
              background: 'var(--bg-raised)', padding: '14px 16px', borderRadius: '12px',
              border: '1px solid var(--border)', marginBottom: '16px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Cột mốc cống hiến:</div>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--primary)', marginTop: '2px' }}>
                    🏆 {selectedAnniversary.badge || `Tròn ${selectedAnniversary.years_count || selectedAnniversary.years || 1} Năm Gắn Bó`}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Thời gian gia nhập:</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)', marginTop: '2px' }}>
                    {selectedAnniversary.anniversary_date || (selectedAnniversary.start_year ? `Năm ${selectedAnniversary.start_year}` : 'Thành viên cốt cán')}
                  </div>
                </div>
              </div>
            </div>

            {/* Appreciation Note (Only display if custom message is provided) */}
            {(selectedAnniversary.custom_message || selectedAnniversary.message) && (
              <div style={{
                background: 'var(--bg-card)', padding: '14px 16px', borderRadius: '12px',
                border: '1px dashed var(--primary)', fontSize: '13px', color: 'var(--text)',
                lineHeight: 1.6, marginBottom: '20px'
              }}>
                🌟 {selectedAnniversary.custom_message || selectedAnniversary.message}
              </div>
            )}

            {user?.role === 'admin' && (
              <div style={{ marginBottom: '14px', display: 'flex', justifyContent: 'center' }}>
                <button
                  onClick={() => {
                    setSelectedAnniversary(null);
                    setShowAnnivSettingsModal(true);
                  }}
                  className="btn btn--ghost"
                  style={{
                    fontSize: '11.5px', color: 'var(--primary)',
                    background: 'var(--primary-soft)', border: '1px dashed var(--primary)',
                    borderRadius: '8px', padding: '6px 12px', fontWeight: 700,
                    display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer'
                  }}
                >
                  <Settings size={13} /> Sửa chu kỳ hiển thị sự kiện & kỷ niệm
                </button>
              </div>
            )}

            <button
              onClick={() => setSelectedAnniversary(null)}
              className="btn btn--primary btn--full btn--lg"
              style={{ padding: '12px', fontSize: '14px', fontWeight: 800, borderRadius: '12px' }}
            >
              Đóng cửa sổ ✓
            </button>
          </div>
        </div>
      )}

      {/* Holiday / Event Detail Modal — Full Rich Text Display */}
      {selectedHoliday && (
        <div className="modal-overlay" style={{ zIndex: 999999, padding: '16px' }} onClick={() => setSelectedHoliday(null)}>
          <div
            className="modal-sheet animate-slide-up"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '560px', width: '100%', margin: '0 auto',
              padding: '24px 26px', borderRadius: '20px',
              boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
              border: '1px solid #8b5cf6'
            }}
          >
            <div className="modal-sheet__handle" />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '40px', height: '40px', borderRadius: '12px',
                  background: 'rgba(139, 92, 246, 0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '1.5px solid #8b5cf6', fontSize: '20px'
                }}>
                  🏖️
                </div>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: '#8b5cf6', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                    Thông Báo Nghỉ Lễ Công Ty
                  </div>
                  <h3 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text)', margin: 0, lineHeight: 1.2 }}>
                    {selectedHoliday.name}
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setSelectedHoliday(null)}
                className="btn btn--ghost"
                style={{ width: '36px', height: '36px', borderRadius: '50%', padding: 0 }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{
              background: 'rgba(139, 92, 246, 0.08)', padding: '14px 16px', borderRadius: '12px',
              border: '1px solid rgba(139, 92, 246, 0.25)', marginBottom: '16px'
            }}>
              <div style={{ fontSize: '15px', fontWeight: 800, color: '#8b5cf6', marginBottom: '4px' }}>
                🗓️ Lịch nghỉ áp dụng:
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text)', fontWeight: 600 }}>
                {selectedHoliday.date} {selectedHoliday.end_date && selectedHoliday.end_date !== selectedHoliday.date ? `→ ${selectedHoliday.end_date}` : ''}
              </div>
            </div>

            {selectedHoliday.note && (
              <div style={{
                background: 'var(--bg-raised)', padding: '18px 20px', borderRadius: '14px',
                border: '1px solid var(--border)', fontSize: '14px', color: 'var(--text)',
                lineHeight: 1.7, whiteSpace: 'pre-line', marginBottom: '22px',
                maxHeight: '380px', overflowY: 'auto'
              }}>
                <div style={{ fontWeight: 800, color: '#8b5cf6', marginBottom: '8px', fontSize: '12px' }}>
                  💬 NỘI DUNG THÔNG BÁO CHI TIẾT:
                </div>
                {selectedHoliday.note}
              </div>
            )}

            <button
              onClick={() => setSelectedHoliday(null)}
              className="btn btn--primary btn--full btn--lg"
              style={{ padding: '12px', fontSize: '14px', fontWeight: 800, borderRadius: '12px', background: '#8b5cf6', borderColor: '#8b5cf6' }}
            >
              Đã hiểu & Xác nhận ✓
            </button>
          </div>
        </div>
      )}

      {/* Announcement Detail Modal */}
      {selectedAnnouncement && (
        <div className="modal-overlay" style={{ zIndex: 999999, padding: '16px' }} onClick={() => setSelectedAnnouncement(null)}>
          <div
            className="modal-sheet animate-slide-up"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '560px', width: '100%', margin: '0 auto',
              padding: '24px 26px', borderRadius: '20px',
              boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
              border: '1.5px solid var(--primary)'
            }}
          >
            <div className="modal-sheet__handle" />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '42px', height: '42px', borderRadius: '12px',
                  background: 'var(--primary-soft)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '1.5px solid var(--primary)', fontSize: '20px', flexShrink: 0
                }}>
                  📢
                </div>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                    Thông Báo Từ Ban Giám Đốc / Admin
                  </div>
                  <h3 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text)', margin: 0, lineHeight: 1.3 }}>
                    {selectedAnnouncement.title}
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setSelectedAnnouncement(null)}
                className="btn btn--ghost"
                style={{ width: '36px', height: '36px', borderRadius: '50%', padding: 0 }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Author & Timestamp */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--bg-raised)', borderRadius: '8px', marginBottom: '14px', fontSize: '11.5px', color: 'var(--text-muted)' }}>
              <span>👤 Người đăng: <strong style={{ color: 'var(--text)' }}>{selectedAnnouncement.created_by?.full_name || 'Ban Giám Đốc'}</strong></span>
              {selectedAnnouncement.created_at && (
                <span>🕒 {new Date(selectedAnnouncement.created_at).toLocaleDateString('vi-VN')}</span>
              )}
            </div>

            {/* Content Box */}
            <div style={{
              background: 'var(--bg-raised)', padding: '18px 20px', borderRadius: '14px',
              border: '1px solid var(--border)', fontSize: '14px', color: 'var(--text)',
              lineHeight: 1.7, whiteSpace: 'pre-line', marginBottom: '16px',
              maxHeight: '340px', overflowY: 'auto'
            }}>
              {selectedAnnouncement.content}
            </div>

            {/* Current Display Validity Info */}
            <div style={{
              background: selectedAnnouncement.expires_at ? 'rgba(59, 130, 246, 0.08)' : 'var(--bg-raised)',
              border: '1px solid var(--border)',
              padding: '10px 14px', borderRadius: '10px', marginBottom: '16px', fontSize: '12px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clock size={15} color="var(--primary)" />
                <span style={{ color: 'var(--text-muted)' }}>Thời hạn hiển thị:</span>
                <strong style={{ color: 'var(--text)' }}>
                  {selectedAnnouncement.expires_at
                    ? `Đến ${new Date(selectedAnnouncement.expires_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ngày ${new Date(selectedAnnouncement.expires_at).toLocaleDateString('vi-VN')}`
                    : '♾️ Ghim liên tục (Không giới hạn)'}
                </strong>
              </div>
            </div>

            {/* Admin Interactive Expiry Editor Section */}
            {user?.role === 'admin' && (
              <div style={{
                background: 'var(--bg-card)', padding: '14px 16px', borderRadius: '14px',
                border: '1.5px solid var(--primary)', marginBottom: '18px',
                boxShadow: 'var(--shadow-xs)'
              }}>
                <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                  <Edit3 size={15} /> CHỈNH SỬA THỜI GIAN HIỆN THÔNG BÁO (ADMIN)
                </div>

                <div style={{ marginBottom: '10px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                    Chọn ngày & giờ kết thúc hiển thị:
                  </label>
                  <input
                    type="datetime-local"
                    className="input"
                    value={editExpiryDate}
                    onChange={e => setEditExpiryDate(e.target.value)}
                    style={{ fontSize: '13px', padding: '8px 12px', width: '100%', borderRadius: '8px' }}
                  />
                </div>

                {/* Quick Presets Buttons */}
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '5px' }}>⚡ Mốc chọn nhanh:</div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => handleSetExpiryPreset(3)}
                      className="btn btn--secondary"
                      style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '6px' }}
                    >
                      +3 Ngày
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetExpiryPreset(7)}
                      className="btn btn--secondary"
                      style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '6px' }}
                    >
                      +7 Ngày
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetExpiryPreset(14)}
                      className="btn btn--secondary"
                      style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '6px' }}
                    >
                      +14 Ngày
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetExpiryPreset('end_of_month')}
                      className="btn btn--secondary"
                      style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '6px' }}
                    >
                      Cuối tháng
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetExpiryPreset(null)}
                      className="btn btn--secondary"
                      style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '6px', color: 'var(--text-muted)' }}
                    >
                      Vô thời hạn
                    </button>
                  </div>
                </div>

                {/* Save and Delete Actions */}
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
                  <button
                    type="button"
                    onClick={handleDeleteAnnouncement}
                    disabled={savingExpiry}
                    className="btn btn--danger"
                    style={{ fontSize: '12px', padding: '6px 12px', gap: '5px' }}
                  >
                    <Trash2 size={14} /> Gỡ thông báo
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveAnnouncementExpiry}
                    disabled={savingExpiry}
                    className="btn btn--primary"
                    style={{ fontSize: '12px', padding: '6px 14px', gap: '5px', fontWeight: 700 }}
                  >
                    <Save size={14} /> {savingExpiry ? 'Đang lưu...' : 'Lưu thời hạn'}
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={() => setSelectedAnnouncement(null)}
              className="btn btn--secondary btn--full btn--lg"
              style={{ padding: '10px', fontSize: '13px', fontWeight: 700, borderRadius: '10px' }}
            >
              Đóng cửa sổ
            </button>
          </div>
        </div>
      )}

      {/* Anniversary & Birthday Display Duration Modal (Admin) */}
      {showAnnivSettingsModal && (
        <div className="modal-overlay" style={{ zIndex: 999999, padding: '16px' }} onClick={() => setShowAnnivSettingsModal(false)}>
          <div
            className="modal-sheet animate-slide-up"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '520px', width: '100%', margin: '0 auto',
              padding: '24px 26px', borderRadius: '20px',
              boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
              border: '1.5px solid var(--yellow)'
            }}
          >
            <div className="modal-sheet__handle" />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '42px', height: '42px', borderRadius: '12px',
                  background: 'rgba(245, 158, 11, 0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '1.5px solid var(--yellow)', fontSize: '20px', flexShrink: 0
                }}>
                  ⚙️
                </div>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--yellow)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                    Quản Trị Hệ Thống
                  </div>
                  <h3 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text)', margin: 0, lineHeight: 1.3 }}>
                    Cài Đặt Thời Gian Hiện Kỷ Niệm & Sinh Nhật
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setShowAnnivSettingsModal(false)}
                className="btn btn--ghost"
                style={{ width: '36px', height: '36px', borderRadius: '50%', padding: 0 }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{
              background: 'var(--bg-raised)', padding: '16px', borderRadius: '14px',
              border: '1px solid var(--border)', marginBottom: '20px'
            }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text)', marginBottom: '8px' }}>
                Chu kỳ hiển thị Kỷ niệm gắn bó & Sinh nhật:
              </label>
              <select
                value={annivDisplayMode}
                onChange={e => setAnnivDisplayMode(e.target.value)}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: '8px',
                  border: '1px solid var(--border)', background: 'var(--bg-card)',
                  color: 'var(--text)', fontSize: '13px', fontWeight: 600,
                  outline: 'none', marginBottom: '12px'
                }}
              >
                <option value="month">📅 Trọn vẹn trong tháng (Toàn bộ nhân sự có sự kiện trong tháng)</option>
                <option value="exact_day">🎯 Đúng ngày diễn ra (Chỉ hiển thị đúng ngày sinh nhật / kỷ niệm)</option>
                <option value="week">🗓️ Trong tuần diễn ra (Trước/sau 3 ngày quanh ngày kỷ niệm)</option>
                <option value="days_around">⏳ Tùy chỉnh số ngày (Trước/sau X ngày)</option>
              </select>

              {annivDisplayMode === 'days_around' && (
                <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed var(--border)' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Số ngày hiển thị trước & sau ngày sự kiện:
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={annivDisplayDays}
                      onChange={e => setAnnivDisplayDays(Math.max(1, Math.min(30, parseInt(e.target.value) || 1)))}
                      style={{
                        width: '90px', padding: '8px 10px', borderRadius: '8px',
                        border: '1px solid var(--border)', background: 'var(--bg-card)',
                        color: 'var(--text)', fontSize: '13px', fontWeight: 700, textAlign: 'center'
                      }}
                    />
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>ngày (từ 1 đến 30 ngày)</span>
                  </div>
                </div>
              )}

              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '10px', lineHeight: 1.5, background: 'var(--bg-card)', padding: '8px 12px', borderRadius: '8px' }}>
                💡 <em>Sau khi lưu, widget Trang chủ sẽ lọc và hiển thị danh sách Kỷ niệm, Sinh nhật theo đúng chu kỳ cài đặt mà không cần thao tác thủ công.</em>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowAnnivSettingsModal(false)}
                className="btn btn--secondary"
                style={{ fontSize: '13px', padding: '8px 16px', borderRadius: '10px' }}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleSaveAnnivSettings}
                disabled={savingAnnivSettings}
                className="btn btn--primary"
                style={{
                  fontSize: '13px', padding: '8px 20px', borderRadius: '10px',
                  fontWeight: 800, gap: '6px', background: 'var(--yellow)', borderColor: 'var(--yellow)', color: '#000'
                }}
              >
                <Save size={15} /> {savingAnnivSettings ? 'Đang lưu...' : 'Lưu chu kỳ hiển thị'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
