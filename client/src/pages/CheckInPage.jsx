// src/pages/CheckInPage.jsx
// GPS bắt buộc — Auto-acquire GPS khi mở trang, Hiển thị khoảng cách văn phòng, Block check-in nếu thiếu GPS

import { useState, useEffect, useRef, useMemo } from 'react';
import { MapPin, CheckCircle, LogOut, Flame, Clock, Navigation, AlertTriangle, ChevronRight, Crosshair, Wifi, WifiOff, Building2, X, Megaphone, Calendar, HeartPulse, Send, FileText, Sparkles, Briefcase, Shield, ChevronDown, ChevronUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';
import useAuthStore from '../stores/authStore';
import HeaderActions from '../components/HeaderActions';
import { getDeviceFingerprint } from '../utils/deviceFingerprint';

const LOCATION_TYPES = [
  { value: 'office',  label: '🏢 Văn phòng',       desc: 'Trong bán kính GPS' },
  { value: 'site',    label: '🏗️ Công trình',       desc: 'Chọn dự án đang chạy' },
  { value: 'client',  label: '👔 Gặp Khách hàng',  desc: 'GPS ghi nhận vị trí' },
  { value: 'wfh',     label: '🏠 Làm việc tại nhà', desc: 'WFH với GPS xác nhận' },
];

const LATE_TIERS = {
  on_time:     { label: 'Đúng giờ',                    cls: 'badge--success', icon: '✅' },
  late_minor:  { label: 'Muộn nhẹ 1–30p (1.0 công)',   cls: 'badge--warning', icon: '⏰' },
  late_medium: { label: 'Muộn trừ công (>30p - 0.75c)', cls: 'badge--danger',  icon: '⚠️' },
  late_severe: { label: 'Muộn nhiều (0.75 công)',       cls: 'badge--danger',  icon: '🚨' },
};

const fmt = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });
};

const entityId = value => String(value?._id || value?.id || value || '');

const getCurrentWeekStart = () => {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
  const date = new Date(`${today}T12:00:00.000Z`);
  const weekday = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - weekday + 1);
  return date.toISOString().slice(0, 10);
};

const formatDutyDate = value => {
  if (!value) return '';
  return new Date(`${value}T12:00:00.000Z`).toLocaleDateString('vi-VN', {
    weekday: 'long', day: '2-digit', month: '2-digit', timeZone: 'Asia/Ho_Chi_Minh'
  });
};

function getDistanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(Δφ/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

export default function CheckInPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const [today, setToday] = useState(null);
  const [office, setOffice] = useState(null);
  const [offices, setOffices] = useState([]);
  const [projects, setProjects] = useState([]);
  const [myProjects, setMyProjects] = useState([]);
  const [birthdays, setBirthdays] = useState([]);
  const [anniversaries, setAnniversaries] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [weeklyDutySchedule, setWeeklyDutySchedule] = useState(null);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
  const [selectedBirthday, setSelectedBirthday] = useState(null);
  const [selectedAnniversary, setSelectedAnniversary] = useState(null);
  const [selectedHoliday, setSelectedHoliday] = useState(null);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState(null);
  const [selected, setSelected] = useState('office');
  const [isOutsideOffice, setIsOutsideOffice] = useState(false);
  const [outsideType, setOutsideType] = useState('wfh'); // 'wfh' | 'client' | 'site'
  const [selectedProject, setSelectedProject] = useState('');
  const [note, setNote] = useState('');
  const [checkoutNote, setCheckoutNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [now, setNow] = useState(new Date());

  // GPS state
  const [gpsPosition, setGpsPosition] = useState(null);  // { lat, lng, accuracy }
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState(null);

  // Anti-fraud Step-Up Selfie state & Photo Fallback state
  const [showSelfieModal, setShowSelfieModal] = useState(false);
  const [selfieReason, setSelfieReason] = useState('');
  const [selfieImage, setSelfieImage] = useState(null);
  const fileInputRef = useRef(null);

  // Collapsible Widgets states for clean mobile view
  const [showQuickRequests, setShowQuickRequests] = useState(false);
  const [showMyProjects, setShowMyProjects] = useState(false);
  const [showEvents, setShowEvents] = useState(false);

  // Explanation suggestion modal
  const [showExplanationModal, setShowExplanationModal] = useState(false);
  const [explanationReason, setExplanationReason] = useState('');
  const [explanationType, setExplanationType] = useState('late');

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Auto-acquire GPS on mount
  useEffect(() => {
    acquireGPS();
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const todayVN = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
      const [yearVal, monthVal] = todayVN.split('-').map(Number);

      const [todayRes, settingsRes, projRes, locRes, annRes, bdayRes, annivRes, holRes, dutyRes] = await Promise.all([
        api.get('/attendance/today'),
        api.get('/settings'),
        api.get('/projects?active_only=true'),
        api.get('/locations'),
        api.get('/announcements/pinned').catch(() => ({ data: [] })),
        api.get(`/announcements/birthdays?month=${monthVal}`).catch(() => ({ data: { birthdays: [] } })),
        api.get(`/announcements/anniversaries?month=${monthVal}`).catch(() => ({ data: { anniversaries: [] } })),
        api.get(`/holidays?year=${yearVal}&month=${monthVal}`).catch(() => ({ data: [] })),
        api.get(`/tts-schedules?week_start=${getCurrentWeekStart()}`).catch(() => ({ data: null })),
      ]);
      setToday(todayRes.data.attendance || null);
      setSettings(settingsRes.data?.settings || settingsRes.data || null);
      setAnnouncements(Array.isArray(annRes?.data) ? annRes.data : []);
      setBirthdays(bdayRes.data?.birthdays || []);
      setAnniversaries(annivRes.data?.anniversaries || []);
      setWeeklyDutySchedule(dutyRes.data);
      
      const currentMonthStr = String(monthVal).padStart(2, '0');
      const rawHolidays = Array.isArray(holRes?.data) ? holRes.data : [];
      const monthHolidays = rawHolidays.filter(h => {
        const d = h.date || '';
        const ed = h.end_date || '';
        return d.includes(`-${currentMonthStr}-`) || ed.includes(`-${currentMonthStr}-`);
      });
      setHolidays(monthHolidays);

      const rawLocations = Array.isArray(locRes?.data) ? locRes.data : locRes?.data?.locations || [];
      const allActiveOffices = (todayRes.data.offices && todayRes.data.offices.length > 0)
        ? todayRes.data.offices
        : rawLocations.filter(l => l.is_active !== false);

      setOffices(allActiveOffices);

      const activeOffice = todayRes.data.office || allActiveOffices[0] || settingsRes.data?.setting?.office;
      if (activeOffice) setOffice(activeOffice);

      const rawProjects = Array.isArray(projRes?.data) ? projRes.data : (projRes?.data?.projects || []);
      const activeProjects = rawProjects.filter(p => p.is_active !== false && p.status !== 'Hoàn thành' && p.status !== 'Tạm dừng' && p.status !== 'cancelled');
      setProjects(activeProjects);

      // Filter projects where current user is a member or PM
      const uid = String(user?._id || user?.id || '');
      const uname = (user?.full_name || '').toLowerCase().trim();
      const myProjs = rawProjects.filter(p => {
        const isMember = Array.isArray(p.members) && p.members.some(m => {
          const mId = String(m?._id || m?.id || m || '');
          if (mId && mId === uid) return true;
          const mName = String(m?.full_name || '').toLowerCase().trim();
          if (uname && mName && (mName.includes(uname) || uname.includes(mName))) return true;
          return false;
        });
        if (isMember) return true;
        const pmId = String(p.pm_id?._id || p.pm_id?.id || p.pm_id || '');
        if (pmId && pmId === uid) return true;
        if (p.pm_name && uname) {
          const pmNameLower = p.pm_name.toLowerCase().trim();
          if (pmNameLower.includes(uname) || uname.includes(pmNameLower)) return true;
        }
        return false;
      });
      setMyProjects(myProjs.length > 0 ? myProjs : activeProjects.slice(0, 4));
    } catch {
      toast.error('Lỗi tải thông tin chấm công');
    } finally {
      setLoading(false);
    }
  };

  const acquireGPS = () => {
    if (!navigator.geolocation) {
      setGpsError('Trình duyệt không hỗ trợ GPS Geolocation.');
      toast.error('Trình duyệt không hỗ trợ GPS Geolocation.');
      return;
    }
    setGpsLoading(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
        });
        setGpsLoading(false);
      },
      (err) => {
        setGpsLoading(false);
        let msg = 'Không thể lấy vị trí GPS.';
        if (err.code === 1) msg = 'Bạn đã từ chối quyền truy cập vị trí. Vui lòng cho phép quyền GPS trong Cài đặt trình duyệt.';
        else if (err.code === 2) msg = 'Không xác định được vị trí GPS (mất sóng/tín hiệu yếu).';
        else if (err.code === 3) msg = 'Quá thời gian chờ lấy vị trí GPS (Timeout).';
        setGpsError(msg);
        toast.error(msg, { duration: 6000 });
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  const handleSelfieFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result;
      setSelfieImage(base64);
      handleCheckIn(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleCheckIn = async (overrideSelfie = null, overrideType = null) => {
    const checkInType = overrideType || (isOutsideOffice ? outsideType : 'office');

    if (!gpsPosition) {
      toast.error('Bắt buộc có vị trí GPS để chấm công. Vui lòng bật quyền định vị trên thiết bị!');
      return;
    }

    setSubmitting(true);
    try {
      let deviceInfo = {};
      try {
        deviceInfo = await getDeviceFingerprint();
      } catch (fpErr) {
        console.warn('Fingerprint error:', fpErr);
      }

      const payload = {
        lat: gpsPosition.lat,
        lng: gpsPosition.lng,
        type: checkInType,
        project_id: (isOutsideOffice && outsideType === 'site') ? (selectedProject || null) : null,
        note: note.trim() || null,
        device_fingerprint: deviceInfo.fingerprint,
        hardware_uuid: deviceInfo.hardware_uuid || deviceInfo.fingerprint,
        device_name: deviceInfo.device_name,
        screen_info: deviceInfo.screen_info,
      };

      if (overrideSelfie || selfieImage) {
        payload.selfie_url = overrideSelfie || selfieImage;
        payload.step_up_confirmed = true;
      }

      const { data } = await api.post('/attendance/checkin', payload);

      toast.success(data.message || 'Check-in thành công!');
      setToday(data.attendance);
      setShowSelfieModal(false);
      setSelfieImage(null);

      if (data.is_flagged) {
        toast('Ghi nhận chấm công có cờ xác thực! Đã gửi thông báo cho Ban Giám Đốc đối soát.', { icon: '🛡️', duration: 8000 });
      }

      if (data.device_warning) {
        toast(data.device_warning, { icon: '🛡️', duration: 8000 });
      }

      if (data.far_warning) {
        toast(data.far_warning, { icon: '⚠️', duration: 6000 });
      }

      if (data.attendance?.is_late || checkInType === 'wfh') {
        setExplanationType(data.attendance?.is_late ? 'late' : 'business_trip');
        setShowExplanationModal(true);
      }
    } catch (err) {
      const errorData = err?.response?.data || err?.data;
      const errorMsg = errorData?.error || errorData?.message || err?.message || 'Lỗi chấm công';

      if (errorData?.step_up_required) {
        setSelfieReason(errorMsg);
        setShowSelfieModal(true);
        toast.error(errorMsg, { duration: 6000 });
      } else if (errorData?.suggest_business_trip || errorData?.suggest_selfie_supplement || errorData?.suggest_photo_fallback) {
        toast.error(errorMsg, { duration: 8000 });
        setTimeout(() => {
          toast((t) => (
            <div>
              <div style={{ fontWeight: 600, marginBottom: '6px' }}>Vị trí ngoài bán kính! Chọn phương án tiếp tục:</div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button className="btn btn--primary" style={{ flex: 1, fontSize: '11px', padding: '6px' }}
                  onClick={() => {
                    toast.dismiss(t.id);
                    setSelfieReason('Chụp ảnh selfie xác thực vị trí ngoài bán kính văn phòng');
                    setShowSelfieModal(true);
                  }}>
                  📸 Chụp ảnh Selfie xác thực
                </button>
                <button className="btn btn--ghost" style={{ flex: 1, fontSize: '11px', padding: '6px' }}
                  onClick={() => { toast.dismiss(t.id); setSelected('wfh'); setTimeout(() => handleCheckIn(null, 'wfh'), 100); }}>
                  🏠 Chấm WFH
                </button>
              </div>
            </div>
          ), { duration: 9000 });
        }, 500);
      } else {
        toast.error(errorData?.error || 'Lỗi chấm công');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckOut = async () => {
    if (!gpsPosition) {
      toast.error('Cần có GPS để check-out.');
      acquireGPS();
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await api.post('/attendance/checkout', {
        lat: gpsPosition.lat,
        lng: gpsPosition.lng,
        note: checkoutNote.trim() || null,
      });
      toast.success(data.message);
      setToday(data.attendance);

      if (data.outside_office_radius || data.suggest_explanation) {
        toast((t) => (
          <div>
            <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '4px' }}>
              📍 Check-Out Ngoài Văn Phòng
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>
              Vị trí cách VP {data.distance_meters ? `${data.distance_meters}m` : ''}. Tạo đơn giải trình ngay để Admin duyệt tính đủ công!
            </div>
            <button
              className="btn btn--primary btn--full"
              style={{ fontSize: '11px', padding: '5px' }}
              onClick={() => {
                toast.dismiss(t.id);
                setExplanationType('business_trip');
                setShowExplanationModal(true);
              }}
            >
              📝 Tạo Đơn Giải Trình Ngay
            </button>
          </div>
        ), { duration: 8000 });
      } else if (data.attendance?.ot_hours > 0) {
        setExplanationType('overtime');
        setShowExplanationModal(true);
      }
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Lỗi check-out');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateExplanationRequest = async () => {
    if (!explanationReason.trim()) { toast.error('Vui lòng nhập lý do giải trình'); return; }
    try {
      const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
      await api.post('/requests', { type: explanationType, start_date: todayStr, reason: explanationReason.trim() });
      toast.success('Đã gửi đơn giải trình thành công! 📋');
      setShowExplanationModal(false);
      setExplanationReason('');
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Lỗi tạo đơn giải trình');
    }
  };

  // Real-time distance from closest office / branch / home location
  const closestOffice = useMemo(() => {
    if (!offices || offices.length === 0) return office;
    if (!gpsPosition) return offices[0] || office;
    let minD = Infinity;
    let best = offices[0] || office;
    for (const loc of offices) {
      if (loc.lat && loc.lng) {
        const d = getDistanceMeters(gpsPosition.lat, gpsPosition.lng, loc.lat, loc.lng);
        if (d < minD) {
          minD = d;
          best = loc;
        }
      }
    }
    return best;
  }, [gpsPosition, offices, office]);

  const targetOffice = closestOffice || office;

  const distanceFromOffice = gpsPosition && targetOffice?.lat && targetOffice?.lng
    ? Math.round(getDistanceMeters(gpsPosition.lat, gpsPosition.lng, targetOffice.lat, targetOffice.lng))
    : null;
  const isInOfficeRange = distanceFromOffice !== null && targetOffice?.radius_m
    ? distanceFromOffice <= targetOffice.radius_m
    : null;

  const timeStr = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = now.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });

  const att = today;
  const isCheckedIn = Boolean(att?.check_in_time);
  const isCheckedOut = Boolean(att?.check_out_time);
  const isOtNow = isCheckedIn && !isCheckedOut && now.getHours() >= 18;
  const lateConfig = LATE_TIERS[att?.late_tier] || (att?.is_late ? LATE_TIERS.late_medium : LATE_TIERS.on_time);

  const myDutyAssignments = useMemo(() => {
    const currentUserId = entityId(user);
    const duties = weeklyDutySchedule?.schedule?.duties || [];
    if (!currentUserId) return [];

    return duties.flatMap(duty => {
      const groups = [];
      const officeTeam = duty.office_cleaning_user_ids || [];
      const restroomTeam = duty.restroom_cleaning_user_ids || [];

      if (officeTeam.some(person => entityId(person) === currentUserId)) {
        groups.push({
          label: 'Dọn văn phòng',
          companions: officeTeam.filter(person => entityId(person) !== currentUserId).map(person => person.full_name),
        });
      }
      if (restroomTeam.some(person => entityId(person) === currentUserId)) {
        groups.push({
          label: 'Dọn nhà vệ sinh',
          companions: restroomTeam.filter(person => entityId(person) !== currentUserId).map(person => person.full_name),
        });
      }

      return groups.length ? [{ date: duty.date, groups }] : [];
    });
  }, [weeklyDutySchedule, user]);

  const restroomAssignments = useMemo(() => {
    const duties = weeklyDutySchedule?.schedule?.duties || [];
    return duties.flatMap(duty => {
      const names = (duty.restroom_cleaning_user_ids || []).map(person => person.full_name).filter(Boolean);
      return names.length ? [{ date: duty.date, names }] : [];
    });
  }, [weeklyDutySchedule]);

  return (
    <div className="page">
      <div className="header">
        <div className="header__inner">
          <div>
            <div className="header__title">ET Office Portal</div>
            <div className="header__subtitle">Xin chào, {user?.full_name}</div>
          </div>
          <HeaderActions />
        </div>
      </div>

      <div className="container" style={{ paddingTop: '16px' }}>
        {/* Pinned Announcements */}
        {announcements.length > 0 && (
          <div className="card animate-fade-in" style={{ marginBottom: '12px', padding: '14px', borderLeft: '4px solid var(--primary)', background: 'var(--primary-soft)' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Megaphone size={16} /> Thông báo & Sự kiện nổi bật ({announcements.length})
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

        {/* Weekly cleaning duty reminder */}
        {weeklyDutySchedule && (
          <section
            className="card animate-fade-in"
            aria-label="Lịch trực nhật tuần này"
            style={{
              marginBottom: '12px', padding: '12px 14px', borderLeft: '4px solid var(--yellow)',
              background: 'color-mix(in srgb, var(--yellow) 7%, var(--bg-card))'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px', color: 'var(--text)', fontSize: '13px', fontWeight: 700 }}>
                <Calendar size={16} color="var(--yellow)" /> Lịch trực tuần này
              </div>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => navigate('/tts-schedule')}
                style={{ minHeight: '30px', padding: '4px 8px', fontSize: '10px' }}
              >
                Xem lịch <ChevronRight size={13} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 270px), 1fr))', gap: '8px' }}>
              <article style={{ padding: '10px 11px', border: '1px solid var(--border)', borderRadius: '9px', background: 'var(--bg-card)' }}>
                <strong style={{ display: 'block', marginBottom: '6px', color: 'var(--primary)', fontSize: '11px' }}>🧹 Phân công của bạn</strong>
                {myDutyAssignments.length > 0 ? (
                  <div style={{ display: 'grid', gap: '6px' }}>
                    {myDutyAssignments.map(assignment => (
                      <div key={assignment.date} style={{ color: 'var(--text-secondary)', fontSize: '11px', lineHeight: 1.5 }}>
                        <strong style={{ color: 'var(--text)' }}>{formatDutyDate(assignment.date)}:</strong>{' '}
                        {assignment.groups.map((group, index) => (
                          <span key={group.label}>
                            {index > 0 && ' · '}{group.label}
                            {group.companions.length > 0
                              ? <> cùng <strong style={{ color: 'var(--text)' }}>{group.companions.join(', ')}</strong></>
                              : ' (thực hiện một mình)'}
                          </span>
                        ))}
                      </div>
                    ))}
                  </div>
                ) : (
                  <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Tuần này bạn chưa được phân công trực nhật.</span>
                )}
              </article>

              <article style={{ padding: '10px 11px', border: '1px solid var(--border)', borderRadius: '9px', background: 'var(--bg-card)' }}>
                <strong style={{ display: 'block', marginBottom: '6px', color: '#0f766e', fontSize: '11px' }}>🧼 Người dọn nhà vệ sinh tuần này</strong>
                {restroomAssignments.length > 0 ? (
                  <div style={{ display: 'grid', gap: '6px' }}>
                    {restroomAssignments.map(assignment => (
                      <div key={assignment.date} style={{ color: 'var(--text-secondary)', fontSize: '11px', lineHeight: 1.5 }}>
                        <strong style={{ color: 'var(--text)' }}>{formatDutyDate(assignment.date)}:</strong>{' '}
                        {assignment.names.join(', ')}
                      </div>
                    ))}
                  </div>
                ) : (
                  <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Chưa có người được phân công.</span>
                )}
              </article>
            </div>
          </section>
        )}

        {/* Work Shift Info Badge */}
        {(() => {
          const shiftStart = settings?.work_start_time || '09:00';
          const shiftEnd = settings?.work_end_time || '18:30';
          const shiftLabel = `Ca ${shiftStart} – ${shiftEnd}`;

          return (
            <>
              <div style={{
                marginBottom: '12px', padding: '8px 12px', borderRadius: '10px',
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '14px' }}>⏰</span>
                  <span><strong>Ca làm việc:</strong> {shiftStart} – {shiftEnd}</span>
                </div>
                <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                  Đi muộn quá 30p tính trừ 0.25 công nếu không có giải trình được duyệt
                </span>
              </div>

              {/* GPS Status Banner */}
              <div className="card animate-fade-in" style={{
                marginBottom: '12px', padding: '10px 14px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: '10px',
                background: gpsPosition
                  ? (isInOfficeRange === true ? 'var(--green-soft)' : isInOfficeRange === false ? 'var(--yellow-soft)' : 'var(--bg-card)')
                  : gpsError ? 'var(--red-soft)' : 'var(--bg-card)',
                border: gpsPosition
                  ? `1px solid ${isInOfficeRange === true ? 'var(--green)' : isInOfficeRange === false ? 'var(--yellow)' : 'var(--border)'}`
                  : gpsError ? '1px solid var(--red)' : '1px solid var(--border)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Navigation size={18} color={gpsPosition ? (isInOfficeRange === true ? 'var(--green)' : 'var(--yellow)') : gpsError ? 'var(--red)' : 'var(--text-muted)'} />
                  <div>
                    {gpsLoading ? (
                      <div style={{ fontSize: '12px', fontWeight: 600 }}>⏳ Đang lấy vị trí GPS...</div>
                    ) : gpsPosition ? (
                      <>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: isInOfficeRange === true ? 'var(--green)' : isInOfficeRange === false ? 'var(--yellow)' : 'var(--text)' }}>
                          {isInOfficeRange === true
                            ? `✅ Trong văn phòng (${distanceFromOffice}m cách ${targetOffice?.name || 'VP'})`
                            : isInOfficeRange === false
                              ? `⚠️ Cách ${targetOffice?.name || 'Văn phòng'} ${distanceFromOffice}m (bán kính cho phép: ${targetOffice?.radius_m || 250}m)`
                              : `📍 GPS: ${gpsPosition.lat.toFixed(4)}, ${gpsPosition.lng.toFixed(4)}`}
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Độ chính xác: ±{gpsPosition.accuracy}m</div>
                      </>
                    ) : gpsError ? (
                      <div style={{ fontSize: '12px', color: 'var(--red)', fontWeight: 600 }}>{gpsError}</div>
                    ) : (
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Bắt buộc có GPS để chấm công</div>
                    )}
                  </div>
                </div>
                <button
                  onClick={acquireGPS}
                  disabled={gpsLoading}
                  className="btn btn--ghost"
                  style={{ padding: '4px 10px', fontSize: '11px', flexShrink: 0 }}
                >
                  <Crosshair size={13} /> {gpsLoading ? 'Đang lấy...' : 'Làm mới'}
                </button>
              </div>

              {/* Banner Thông Báo Miễn Chấm Công */}
              {user?.is_attendance_exempt && (
                <div className="card animate-fade-in" style={{
                  marginBottom: '16px', padding: '14px 16px',
                  background: 'rgba(99, 102, 241, 0.08)',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  borderRadius: '12px',
                  display: 'flex', alignItems: 'center', gap: '12px'
                }}>
                  <Shield size={24} color="var(--primary)" style={{ flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--primary)' }}>
                      🛡️ Bạn thuộc diện Miễn Chấm Công hàng ngày
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      Tài khoản của bạn không cần thực hiện điểm danh GPS / Selfie và không bị theo dõi chấm công trên hệ thống.
                    </div>
                  </div>
                </div>
              )}

              {/* Clock Hero Card */}
              <div className="checkin-hero animate-fade-in" style={{ marginBottom: '16px' }}>
                <div className="checkin-hero__date">
                  {dateStr}
                </div>
                <div className="checkin-hero__time">
                  {timeStr}
                </div>

                {loading ? (
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Đang tải...</div>
                ) : isCheckedOut ? (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '20px', background: 'var(--primary-soft)', color: 'var(--primary)', fontSize: '13px', fontWeight: 600 }}>
                    <CheckCircle size={16} /> Đã hoàn thành ca làm ({att.total_hours}h - {att.work_units || 1.0} công)
                  </div>
                ) : isCheckedIn ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '20px', background: isOtNow ? 'var(--blue-soft)' : 'var(--green-soft)', color: isOtNow ? 'var(--blue)' : 'var(--green)', fontSize: '13px', fontWeight: 600 }}>
                      {isOtNow ? <Flame size={16} /> : <Clock size={16} />}
                      {isOtNow ? `🔥 ĐANG TĂNG CA (OT) từ ${fmt(att.check_in_time)}` : `Đang làm việc từ ${fmt(att.check_in_time)}`}
                    </div>
                    <span className={`badge ${lateConfig.cls}`}>{lateConfig.icon} {lateConfig.label}</span>
                  </div>
                ) : (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '20px', background: 'var(--bg-card-hover)', color: 'var(--text-muted)', fontSize: '13px' }}>
                    Chưa chấm công hôm nay ({shiftLabel})
                  </div>
                )}
              </div>

              {/* OT / Muộn / WFH banner gợi ý đơn */}
              {isCheckedIn && !isCheckedOut && (att?.is_late || att?.check_in_type === 'wfh' || isOtNow) && (
                <div className="card animate-fade-in" style={{
                  marginBottom: '14px', padding: '12px 14px',
                  background: isOtNow ? 'var(--blue-soft)' : 'var(--yellow-soft)',
                  borderColor: isOtNow ? 'var(--blue)' : 'var(--yellow)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <AlertTriangle size={20} color={isOtNow ? 'var(--blue)' : 'var(--yellow)'} />
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700 }}>
                        {isOtNow ? `Đang làm quá ${shiftEnd} (Tăng ca OT)` : att.is_late ? `Đi muộn ${att.late_minutes} phút` : 'Làm việc tại nhà (WFH)'}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Tạo đơn để Admin duyệt và hoàn đủ 1.0 công</div>
                    </div>
                  </div>
                  <button onClick={() => { setExplanationType(isOtNow ? 'overtime' : att.is_late ? 'late' : 'business_trip'); setShowExplanationModal(true); }} className="btn btn--primary" style={{ fontSize: '12px', padding: '6px 12px', whiteSpace: 'nowrap' }}>
                    Giải trình <ChevronRight size={14} />
                  </button>
                </div>
              )}

              {/* Check-In Form */}
              {!isCheckedIn ? (
                <div className="card animate-fade-in" style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <MapPin size={18} color="var(--primary)" /> CHẤM CÔNG VÀO CA
                    </div>
                    <span className="badge badge--success" style={{ fontSize: '11px' }}>{shiftLabel}</span>
                  </div>

                  {/* Checkbox làm việc ngoài công ty */}
                  <div
                    onClick={() => setIsOutsideOffice(!isOutsideOffice)}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: '10px',
                      padding: '12px 14px', borderRadius: '10px',
                      background: isOutsideOffice ? 'var(--primary-soft)' : 'var(--bg-raised)',
                      border: `1px solid ${isOutsideOffice ? 'var(--primary)' : 'var(--border)'}`,
                      cursor: 'pointer', transition: 'all 0.2s', marginBottom: '14px'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isOutsideOffice}
                      onChange={e => setIsOutsideOffice(e.target.checked)}
                      style={{ marginTop: '2px', cursor: 'pointer', width: '16px', height: '16px' }}
                      onClick={e => e.stopPropagation()}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: isOutsideOffice ? 'var(--primary)' : 'var(--text)' }}>
                        💼 Chấm công ngoài văn phòng (WFH / Khách hàng / Công trình)
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {isOutsideOffice
                          ? 'Hệ thống lưu tọa độ GPS vị trí thực tế của bạn. Sau khi chấm công, bạn có thể nộp Đơn giải trình gửi Quản lý phê duyệt.'
                          : 'Mặc định chấm công tại văn phòng trong bán kính GPS.'}
                      </div>
                    </div>
                  </div>

                  {/* If outside office: compact pill selector for WFH / Client / Site */}
                  {isOutsideOffice && (
                    <div className="animate-fade-in" style={{ marginBottom: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                        Chọn hình thức làm việc ngoài văn phòng:
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => setOutsideType('wfh')}
                          className={`chip ${outsideType === 'wfh' ? 'active' : ''}`}
                          style={{ padding: '7px 12px', fontSize: '12px' }}
                        >
                          🏠 Làm tại nhà (WFH)
                        </button>
                        <button
                          type="button"
                          onClick={() => setOutsideType('client')}
                          className={`chip ${outsideType === 'client' ? 'active' : ''}`}
                          style={{ padding: '7px 12px', fontSize: '12px' }}
                        >
                          👔 Gặp khách hàng
                        </button>
                        <button
                          type="button"
                          onClick={() => setOutsideType('site')}
                          className={`chip ${outsideType === 'site' ? 'active' : ''}`}
                          style={{ padding: '7px 12px', fontSize: '12px' }}
                        >
                          🏗️ Công trình / Dự án
                        </button>
                      </div>

                      {outsideType === 'site' && projects.length > 0 && (
                        <div className="form-group animate-fade-in" style={{ marginBottom: 0, marginTop: '4px' }}>
                          <label className="form-label" style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)' }}>
                            🏗️ Chọn dự án / công trình đang hoạt động
                          </label>
                          <select
                            className="form-input"
                            value={selectedProject}
                            onChange={e => setSelectedProject(e.target.value)}
                            style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', fontSize: '12px' }}
                          >
                            <option value="">-- Không thuộc dự án cụ thể --</option>
                            {projects.map(p => (
                              <option key={p._id || p.id} value={p._id || p.id}>
                                {p.name} ({p.code || 'DA'})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '12px' }}>Ghi chú địa điểm / Lý do (Không bắt buộc)</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="VD: Gặp khách hàng tại Cầu Giấy, làm WFH..."
                          value={note}
                          onChange={e => setNote(e.target.value)}
                          style={{ fontSize: '12px' }}
                        />
                      </div>
                    </div>
                  )}

                  {!isOutsideOffice && (
                    <div className="form-group" style={{ marginBottom: '14px' }}>
                      <label className="form-label" style={{ fontSize: '12px' }}>Ghi chú (Không bắt buộc)</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Ghi chú thêm nếu có..."
                        value={note}
                        onChange={e => setNote(e.target.value)}
                        style={{ fontSize: '12px' }}
                      />
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
                    <button
                      onClick={() => handleCheckIn()}
                      disabled={submitting || gpsLoading || !gpsPosition}
                      className="btn btn--primary btn--full btn--lg"
                      style={{ opacity: (!gpsPosition || gpsLoading) ? 0.6 : 1, padding: '14px', fontSize: '15px', fontWeight: 800 }}
                    >
                      {gpsLoading ? '⏳ Đang lấy GPS...' : !gpsPosition ? '📍 Bắt buộc có GPS để chấm công' : submitting ? <span className="spinner" /> : `📍 BẮT ĐẦU CA (CHECK-IN ${shiftStart} - ${shiftEnd})`}
                    </button>
                  </div>

                  {!gpsPosition && !gpsLoading && (
                    <div style={{ textAlign: 'center', marginTop: '8px' }}>
                      <button onClick={acquireGPS} className="btn btn--ghost" style={{ fontSize: '12px' }}>
                        <Crosshair size={13} /> Lấy lại vị trí GPS ngay
                      </button>
                    </div>
                  )}
                </div>
              ) : !isCheckedOut ? (
                <div className="card animate-fade-in" style={{ marginBottom: '16px' }}>
                  <button
                    onClick={handleCheckOut}
                    disabled={submitting || !gpsPosition}
                    className="btn btn--full btn--lg"
                    style={{ background: 'var(--red)', color: '#fff', border: 'none', opacity: !gpsPosition ? 0.6 : 1, padding: '14px', fontSize: '15px', fontWeight: 800 }}
                  >
                    {submitting ? <span className="spinner" /> : <><LogOut size={16} /> CHECK-OUT KẾT THÚC CA</>}
                  </button>
                </div>
              ) : null}
            </>
          );
        })()}

        {/* HUB TIỆN ÍCH: ĐƠN NGHỈ PHÉP & BÁO CÁO ADMIN (Collapsible Accordion) */}
        <div className="card animate-fade-in" style={{ marginBottom: '12px', padding: '12px 14px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px' }}>
          <div
            onClick={() => setShowQuickRequests(!showQuickRequests)}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={16} color="var(--primary)" />
              <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text)' }}>
                NỘP ĐƠN NGHỈ PHÉP & BÁO CÁO ADMIN
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                onClick={(e) => { e.stopPropagation(); navigate('/requests'); }}
                style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 700, padding: '2px 6px', borderRadius: '4px' }}
              >
                Quản lý đơn từ →
              </span>
              <button
                type="button"
                className="btn btn--ghost"
                style={{ padding: '3px', height: '26px', width: '26px', borderRadius: '50%', color: 'var(--text-muted)' }}
              >
                {showQuickRequests ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
            </div>
          </div>

          {showQuickRequests && (
            <div className="animate-fade-in" style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
              <div
                onClick={() => navigate('/requests?type=annual_leave')}
                style={{
                  padding: '12px 14px', borderRadius: '10px',
                  background: 'var(--green-soft)', border: '1px solid rgba(5, 150, 105, 0.25)',
                  cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '4px',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Calendar size={15} /> 🏖️ Nghỉ phép năm
                  </div>
                  <span className="badge badge--success" style={{ fontSize: '10px', padding: '2px 6px' }}>Kế hoạch trước</span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  Xin nghỉ phép trước 1 tuần, tự động trừ ngày phép khi Admin duyệt.
                </div>
              </div>

              <div
                onClick={() => navigate('/requests?type=sick_leave')}
                style={{
                  padding: '12px 14px', borderRadius: '10px',
                  background: 'var(--yellow-soft)', border: '1px solid rgba(217, 119, 6, 0.25)',
                  cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '4px',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--yellow)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <HeartPulse size={15} /> 🏥 Nghỉ ốm / Đột xuất
                  </div>
                  <span className="badge badge--warning" style={{ fontSize: '10px', padding: '2px 6px' }}>Báo gấp</span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  Báo cáo nhanh trường hợp ốm đau, việc gia đình đột xuất gửi Admin.
                </div>
              </div>

              <div
                onClick={() => navigate('/requests?type=wfh')}
                style={{
                  padding: '12px 14px', borderRadius: '10px',
                  background: 'var(--blue-soft)', border: '1px solid rgba(37, 99, 235, 0.25)',
                  cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '4px',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--blue)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Briefcase size={15} /> 💼 Giải trình WFH / Công tác
                  </div>
                  <span className="badge badge--info" style={{ fontSize: '10px', padding: '2px 6px' }}>Ngoài công ty</span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  Làm việc tại nhà hoặc đi công tác ngoài công ty được tính đủ công.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* WIDGET: DỰ ÁN CỦA TÔI (Collapsible Accordion) */}
        {myProjects.length > 0 && (
          <div className="card animate-fade-in" style={{ marginBottom: '12px', padding: '12px 14px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px' }}>
            <div
              onClick={() => setShowMyProjects(!showMyProjects)}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
            >
              <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>🚀 DỰ ÁN ĐANG THAM GIA</span>
                <span className="badge badge--info" style={{ fontSize: '10px' }}>{myProjects.length}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span
                  onClick={(e) => { e.stopPropagation(); navigate('/projects'); }}
                  style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 700, padding: '2px 6px', borderRadius: '4px' }}
                >
                  Xem tất cả →
                </span>
                <button
                  type="button"
                  className="btn btn--ghost"
                  style={{ padding: '3px', height: '26px', width: '26px', borderRadius: '50%', color: 'var(--text-muted)' }}
                >
                  {showMyProjects ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
              </div>
            </div>

            {showMyProjects && (
              <div className="animate-fade-in" style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '10px' }}>
                {myProjects.slice(0, 4).map(p => (
                  <div key={p._id || p.id} style={{
                    background: 'var(--bg-raised)', padding: '10px 12px', borderRadius: '10px',
                    border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
                  }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span className="badge badge--info" style={{ fontSize: '10px', fontWeight: 800 }}>{p.code}</span>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                          {p.deadline ? `⏳ ${p.deadline}` : 'Không có deadline'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                        {p.avatar_url ? (
                          <img
                            src={p.avatar_url}
                            alt={p.name}
                            style={{ width: '32px', height: '32px', borderRadius: '6px', objectFit: 'cover', border: '1px solid var(--primary)', flexShrink: 0 }}
                            onError={e => { e.target.style.display = 'none'; }}
                          />
                        ) : null}
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {p.name}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                            🎨 {p.category || 'Kiến trúc'} {p.pm_name ? `· 👷 PM: ${p.pm_name}` : ''}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: 700, marginBottom: '2px' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Tiến độ</span>
                        <span style={{ color: (p.progress || 0) === 100 ? 'var(--green)' : 'var(--primary)' }}>{p.progress || 0}%</span>
                      </div>
                      <div style={{ width: '100%', height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{
                          width: `${p.progress || 0}%`, height: '100%',
                          background: (p.progress || 0) === 100 ? 'var(--green)' : 'var(--primary)',
                          borderRadius: '3px', transition: 'width 0.3s'
                        }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* WIDGET: SỰ KIỆN, SINH NHẬT & KỶ NIỆM GẮN BÓ TRONG THÁNG (Collapsible Accordion Slider) */}
        {(birthdays.length > 0 || anniversaries.length > 0 || holidays.length > 0) && (
          <div className="card animate-fade-in" style={{
            marginBottom: '14px', padding: '14px 16px',
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(217, 119, 6, 0.05) 100%)',
            border: '1px solid rgba(245, 158, 11, 0.35)',
            boxShadow: '0 4px 20px rgba(245, 158, 11, 0.08)',
            borderRadius: '14px'
          }}>
            <div
              onClick={() => setShowEvents(!showEvents)}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
            >
              <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--yellow)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ background: 'rgba(245, 158, 11, 0.2)', padding: '4px 8px', borderRadius: '6px', fontSize: '14px' }}>🎁</span>
                <span>Kỷ Niệm Gắn Bó, Sinh Nhật & Sự Kiện</span>
                <span className="badge badge--warning" style={{ fontSize: '11px', fontWeight: 800 }}>
                  • {birthdays.length + anniversaries.length + holidays.length} sự kiện
                </span>
              </div>
              <button
                type="button"
                className="btn btn--ghost"
                style={{ padding: '3px', height: '26px', width: '26px', borderRadius: '50%', color: 'var(--text-muted)' }}
              >
                {showEvents ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
            </div>

            {showEvents && (
              <div className="animate-fade-in" style={{ marginTop: '12px', display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px' }}>
                {/* Kỷ niệm cống hiến gắn bó */}
                {anniversaries.map((a, aIdx) => (
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

                {/* Sinh nhật */}
                {birthdays.map(b => (
                  <div
                    key={`b-${b._id || b.user_id || b.id}`}
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
                        <span>🎂 Ngày {b.day || (b.dob ? b.dob.split('-')[2] : '')}</span>
                        {b.department_name && <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>· {b.department_name}</span>}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Ngày lễ */}
                {holidays.map((h, idx) => {
                  const isSingleDay = !h.end_date || h.end_date === h.date;
                  const startDay = h.date?.split('-')[2];
                  const endDay = h.end_date?.split('-')[2];
                  const dateLabel = isSingleDay ? `Ngày ${startDay}` : `Từ ${startDay} → ${endDay}`;

                  return (
                    <div
                      key={`h-${h._id || idx}`}
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
                        🏖️
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: '13px' }}>
                          {h.name}
                        </div>
                        <div style={{ fontSize: '11px', color: '#8b5cf6', fontWeight: 600, marginTop: '1px' }}>
                          📅 {dateLabel} ({h.date})
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Announcement Detail Modal — Redesigned Spacious & Premium */}
      {selectedAnnouncement && (
        <div className="modal-overlay" style={{ zIndex: 1100, padding: '16px' }} onClick={() => setSelectedAnnouncement(null)}>
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
        <div className="modal-overlay" style={{ zIndex: 1100, padding: '16px' }} onClick={() => setSelectedBirthday(null)}>
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
              ✨ <strong>ET Architects kính chúc</strong> {selectedBirthday.full_name} một sinh nhật thật nhiều niềm vui, sức khỏe dồi dào, hạnh phúc và gặt hái thêm nhiều thành công rực rỡ cùng đại gia đình công ty! 🎁🥂
            </div>

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
        <div className="modal-overlay" style={{ zIndex: 1100, padding: '16px' }} onClick={() => setSelectedAnniversary(null)}>
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
        <div className="modal-overlay" style={{ zIndex: 1100, padding: '16px' }} onClick={() => setSelectedHoliday(null)}>
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
        <div className="modal-overlay" style={{ zIndex: 1100, padding: '16px' }} onClick={() => setSelectedAnnouncement(null)}>
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
              lineHeight: 1.7, whiteSpace: 'pre-line', marginBottom: '22px',
              maxHeight: '380px', overflowY: 'auto'
            }}>
              {selectedAnnouncement.content}
            </div>

            <button
              onClick={() => setSelectedAnnouncement(null)}
              className="btn btn--primary btn--full btn--lg"
              style={{ padding: '12px', fontSize: '14px', fontWeight: 800, borderRadius: '12px' }}
            >
              Đã hiểu & Đóng ✓
            </button>
          </div>
        </div>
      )}

      {/* Explanation Modal */}
      {showExplanationModal && (
        <div className="modal-overlay">
          <div className="modal-sheet animate-slide-up" style={{ maxWidth: '400px', margin: '0 auto' }}>
            <div className="modal-sheet__handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ fontWeight: 700, fontSize: '16px' }}>Đơn giải trình</div>
              <button onClick={() => setShowExplanationModal(false)} className="btn btn--ghost" style={{ padding: '4px 8px' }}>✕</button>
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
              Loại: <strong>{explanationType === 'late' ? 'Đi muộn' : explanationType === 'overtime' ? 'Tăng ca (OT)' : 'WFH / Công tác'}</strong>
            </div>
            <div className="form-group">
              <label className="form-label">Lý do giải trình *</label>
              <textarea className="form-input" rows={3} placeholder="VD: Kẹt xe, làm thêm dự án A..." value={explanationReason} onChange={e => setExplanationReason(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setShowExplanationModal(false)} className="btn btn--ghost btn--full">Để sau</button>
              <button onClick={handleCreateExplanationRequest} className="btn btn--primary btn--full">Gửi đơn</button>
            </div>
          </div>
        </div>
      )}

      {/* Anti-fraud Step-Up Selfie Modal */}
      {showSelfieModal && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal-sheet animate-slide-up" style={{ maxWidth: '440px', margin: '0 auto', textAlign: 'center', padding: '24px' }}>
            <div className="modal-sheet__handle" />
            <div style={{ fontSize: '36px', marginBottom: '8px' }}>📸</div>
            <div style={{ fontWeight: 800, fontSize: '17px', color: 'var(--text)', marginBottom: '8px' }}>
              Xác thực khuôn mặt chấm công
            </div>
            <div style={{ fontSize: '12px', color: '#dc2626', background: '#fef2f2', padding: '10px 14px', borderRadius: '10px', border: '1px solid #fecaca', marginBottom: '18px', lineHeight: 1.4, textAlign: 'left' }}>
              {selfieReason || 'Phát hiện thiết bị này đã được tài khoản khác dùng để chấm công hôm nay.'}
            </div>

            <input
              type="file"
              accept="image/*"
              capture="user"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={handleSelfieFileSelect}
            />

            {selfieImage ? (
              <div style={{ marginBottom: '18px' }}>
                <img src={selfieImage} alt="Selfie Verification" style={{ width: '130px', height: '130px', objectFit: 'cover', borderRadius: '50%', border: '4px solid #10b981', margin: '0 auto', boxShadow: '0 4px 12px rgba(16,185,129,0.2)' }} />
                <div style={{ fontSize: '12px', color: '#059669', marginTop: '6px', fontWeight: 700 }}>✓ Đã chụp ảnh xác thực thành công</div>
              </div>
            ) : null}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button onClick={() => setShowSelfieModal(false)} className="btn btn--ghost" style={{ flex: 1 }}>Hủy</button>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={submitting}
                className="btn btn--primary"
                style={{ flex: 2, gap: '6px', fontSize: '13px' }}
              >
                {submitting ? <span className="spinner" /> : <>📷 Chụp ảnh & Hoàn tất</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
