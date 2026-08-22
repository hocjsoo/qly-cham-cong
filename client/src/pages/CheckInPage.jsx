// src/pages/CheckInPage.jsx
// GPS bắt buộc — Auto-acquire GPS khi mở trang, Hiển thị khoảng cách văn phòng, Block check-in nếu thiếu GPS

import { useState, useEffect, useRef, useMemo } from 'react';
import { MapPin, CheckCircle, LogOut, Flame, Clock, Navigation, AlertTriangle, ChevronRight, Crosshair, Wifi, WifiOff, Building2 } from 'lucide-react';
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
  on_time:     { label: 'Đúng giờ (≤ 09:00)',          cls: 'badge--success', icon: '✅' },
  late_minor:  { label: 'Muộn nhẹ 1–30p (1.0 công)',   cls: 'badge--warning', icon: '⏰' },
  late_medium: { label: 'Muộn trừ công (>09:30 - 0.75c)', cls: 'badge--danger',  icon: '⚠️' },
  late_severe: { label: 'Muộn nhiều (0.75 công)',       cls: 'badge--danger',  icon: '🚨' },
};

const fmt = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });
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
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState('office');
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
  const [isPhotoFallbackMode, setIsPhotoFallbackMode] = useState(false);
  const fileInputRef = useRef(null);

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

      const [todayRes, settingsRes, projRes, locRes, annRes, bdayRes, annivRes, holRes] = await Promise.all([
        api.get('/attendance/today'),
        api.get('/settings'),
        api.get('/projects?active_only=true'),
        api.get('/locations'),
        api.get('/announcements/pinned').catch(() => ({ data: [] })),
        api.get(`/announcements/birthdays?month=${monthVal}`).catch(() => ({ data: { birthdays: [] } })),
        api.get(`/announcements/anniversaries?month=${monthVal}`).catch(() => ({ data: { anniversaries: [] } })),
        api.get(`/holidays?year=${yearVal}&month=${monthVal}`).catch(() => ({ data: [] })),
      ]);
      setToday(todayRes.data.attendance || null);
      setAnnouncements(Array.isArray(annRes?.data) ? annRes.data : []);
      setBirthdays(bdayRes.data?.birthdays || []);
      setAnniversaries(annivRes.data?.anniversaries || []);
      
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
      const myProjs = rawProjects.filter(p => {
        const uid = user?._id || user?.id;
        const isMember = Array.isArray(p.members) && p.members.some(m => (m?._id || m?.id || m) === uid);
        const isPm = p.pm_name && user?.full_name && p.pm_name.toLowerCase().includes(user.full_name.toLowerCase());
        return isMember || isPm;
      });
      setMyProjects(myProjs.length > 0 ? myProjs : activeProjects.slice(0, 3));
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

  const handleCheckIn = async (overrideSelfie = null, overrideType = null, photoFallback = false) => {
    const checkInType = overrideType || selected;
    if (['site', 'client'].includes(checkInType) && !selectedProject) {
      toast.error('Vui lòng chọn Dự án đang hoạt động!');
      return;
    }

    if (!gpsPosition && !photoFallback && !overrideSelfie && !selfieImage) {
      toast.error('Chưa có GPS. Vui lòng bật định vị hoặc bấm "Chụp ảnh xác thực dự phòng"!');
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
        lat: gpsPosition?.lat || null,
        lng: gpsPosition?.lng || null,
        type: checkInType,
        project_id: selectedProject || null,
        note: note.trim() || null,
        device_fingerprint: deviceInfo.fingerprint,
        hardware_uuid: deviceInfo.hardware_uuid || deviceInfo.fingerprint,
        device_name: deviceInfo.device_name,
        screen_info: deviceInfo.screen_info,
        photo_fallback: Boolean(photoFallback || overrideSelfie || selfieImage),
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
      } else if (errorData?.suggest_business_trip || errorData?.suggest_photo_fallback) {
        toast.error(errorMsg, { duration: 8000 });
        setTimeout(() => {
          toast((t) => (
            <div>
              <div style={{ fontWeight: 600, marginBottom: '6px' }}>Vị trí ngoài bán kính! Chọn phương án tiếp tục:</div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button className="btn btn--primary" style={{ flex: 1, fontSize: '11px', padding: '6px' }}
                  onClick={() => {
                    toast.dismiss(t.id);
                    setSelfieReason('Chấm công ảnh xác thực dự phòng ngoài bán kính GPS');
                    setIsPhotoFallbackMode(true);
                    setShowSelfieModal(true);
                  }}>
                  📸 Chụp ảnh xác thực
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
        {/* Pinned Company Announcement Banner (Nổi bật & Xem chi tiết) */}
        {announcements.length > 0 && (
          <div className="card animate-fade-in" style={{
            marginBottom: '14px', padding: '12px 14px',
            background: 'linear-gradient(135deg, rgba(59,130,246,0.08), rgba(99,102,241,0.12))',
            border: '1px solid rgba(59,130,246,0.3)',
            borderRadius: '12px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '20px' }}>📢</span>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--primary)' }}>
                    {announcements[0].title}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {announcements[0].content}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedAnnouncement(announcements[0])}
                className="btn btn--primary"
                style={{ padding: '5px 10px', fontSize: '11px', flexShrink: 0 }}
              >
                Xem chi tiết
              </button>
            </div>
          </div>
        )}

        {/* Work Shift Info Badge */}
        <div style={{
          marginBottom: '12px', padding: '8px 12px', borderRadius: '10px',
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '14px' }}>⏰</span>
            <span><strong>Ca làm việc:</strong> 09:00 – 18:30</span>
          </div>
          <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
            Đi muộn &gt; 09:30 tính 0.75 công (trừ 0.25c)
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
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Chưa có GPS</div>
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
              Chưa chấm công hôm nay (Ca 09:00 – 18:30)
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
                  {isOtNow ? 'Đang làm quá 18:30 (Tăng ca OT)' : att.is_late ? `Đi muộn ${att.late_minutes} phút` : 'Làm việc tại nhà (WFH)'}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Tạo đơn để Admin duyệt và hoàn đủ 1.0 công</div>
              </div>
            </div>
            <button onClick={() => { setExplanationType(isOtNow ? 'overtime' : att.is_late ? 'late' : 'business_trip'); setShowExplanationModal(true); }} className="btn btn--primary" style={{ fontSize: '12px', padding: '6px 12px', whiteSpace: 'nowrap' }}>
              Giải trình <ChevronRight size={14} />
            </button>
          </div>
        )}

        {/* Distance warning khi chọn office nhưng ngoài range */}
        {!isCheckedIn && selected === 'office' && isInOfficeRange === false && (
          <div className="card animate-fade-in" style={{ marginBottom: '12px', padding: '12px 14px', background: 'var(--yellow-soft)', border: '1px solid var(--yellow)' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <AlertTriangle size={20} color="var(--yellow)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: 'var(--yellow)', marginBottom: '4px' }}>
                  Ngoài bán kính văn phòng ({distanceFromOffice}m/{targetOffice?.radius_m || 250}m)
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '10px', lineHeight: 1.5 }}>
                  Bạn đang cách {targetOffice?.name || 'văn phòng'} {distanceFromOffice}m. Bạn có thể <strong>Chụp ảnh xác thực dự phòng</strong> hoặc chuyển sang WFH / Công tác.
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => {
                      setSelfieReason('Chấm công ảnh xác thực dự phòng ngoài bán kính GPS');
                      setIsPhotoFallbackMode(true);
                      setShowSelfieModal(true);
                    }}
                    className="btn btn--primary"
                    style={{ fontSize: '11px', padding: '6px 10px' }}
                  >
                    📸 Chụp ảnh xác thực dự phòng
                  </button>
                  <button onClick={() => setSelected('wfh')} className="btn btn--ghost" style={{ fontSize: '11px', padding: '6px 10px' }}>
                    🏠 Chuyển WFH
                  </button>
                  <button onClick={() => navigate('/requests')} className="btn btn--ghost" style={{ fontSize: '11px', padding: '6px 10px' }}>
                    Tạo đơn
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Check-In Form */}
        {!isCheckedIn ? (
          <div className="card animate-fade-in" style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '12px' }}>
              CHỌN LOẠI CHẤM CÔNG
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginBottom: '14px' }}>
              {LOCATION_TYPES.map(t => {
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setSelected(t.value)}
                    style={{
                      padding: '12px 10px', borderRadius: '10px', border: '1px solid',
                      textAlign: 'left', cursor: 'pointer',
                      transition: 'all 0.15s',
                      background: selected === t.value ? 'var(--primary-soft)' : 'var(--bg)',
                      borderColor: selected === t.value ? 'var(--primary)' : 'var(--border)',
                    }}
                  >
                    <div style={{ fontSize: '13px', fontWeight: 700, color: selected === t.value ? 'var(--primary)' : 'var(--text)' }}>
                      {t.label}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{t.desc}</div>
                  </button>
                );
              })}
            </div>

            {/* Project selector */}
            {['site', 'client'].includes(selected) && (
              <div className="form-group animate-fade-in" style={{ marginBottom: '14px' }}>
                <label className="form-label" style={{ fontWeight: 700, color: 'var(--primary)' }}>
                  🏗️ Chọn dự án / công trình đang hoạt động * ({projects.length} dự án)
                </label>
                <select className="form-input" value={selectedProject} onChange={e => setSelectedProject(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px' }}>
                  <option value="">-- Chọn dự án đang hoạt động --</option>
                  {projects.map(p => (
                    <option key={p._id || p.id} value={p._id || p.id}>
                      {p.name} ({p.code || 'DA'}) — {p.category || 'Công trình'}
                    </option>
                  ))}
                </select>
                {projects.length === 0 && (
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Chưa có dự án nào đang hoạt động. Vui lòng nhờ Admin thêm dự án mới.
                  </div>
                )}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Ghi chú (Không bắt buộc)</label>
              <input type="text" className="form-input" placeholder="VD: Gặp khách hàng công ty A..." value={note} onChange={e => setNote(e.target.value)} />
            </div>

            <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
              <button
                onClick={() => handleCheckIn()}
                disabled={submitting || gpsLoading || !gpsPosition}
                className="btn btn--primary btn--full btn--lg"
                style={{ opacity: (!gpsPosition || gpsLoading) ? 0.6 : 1 }}
              >
                {gpsLoading ? '⏳ Đang lấy GPS...' : !gpsPosition ? '📍 Cần GPS để chấm công' : submitting ? <span className="spinner" /> : 'BẮT ĐẦU CA (CHECK-IN 09:00 - 18:30)'}
              </button>

              {(!gpsPosition || isInOfficeRange === false) && (
                <button
                  onClick={() => {
                    setSelfieReason('Chấm công ảnh xác thực dự phòng');
                    setIsPhotoFallbackMode(true);
                    setShowSelfieModal(true);
                  }}
                  className="btn btn--ghost btn--full"
                  style={{ fontSize: '13px', border: '1px dashed var(--primary)', color: 'var(--primary)' }}
                >
                  📸 Chụp ảnh xác thực dự phòng (Không cần GPS)
                </button>
              )}
            </div>

            {!gpsPosition && !gpsLoading && (
              <div style={{ textAlign: 'center', marginTop: '8px' }}>
                <button onClick={acquireGPS} className="btn btn--ghost" style={{ fontSize: '12px' }}>
                  <Crosshair size={13} /> Lấy vị trí GPS ngay
                </button>
              </div>
            )}
          </div>
        ) : !isCheckedOut ? (
          <div className="card animate-fade-in" style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '12px' }}>
              KẾT THÚC CA LÀM (CHECK-OUT)
            </div>
            <div className="form-group">
              <label className="form-label">Kết quả công việc hôm nay</label>
              <input type="text" className="form-input" placeholder="VD: Hoàn thành thiết kế bản vẽ..." value={checkoutNote} onChange={e => setCheckoutNote(e.target.value)} />
            </div>
            <button
              onClick={handleCheckOut}
              disabled={submitting || !gpsPosition}
              className="btn btn--full btn--lg"
              style={{ background: 'var(--red)', color: '#fff', border: 'none', opacity: !gpsPosition ? 0.6 : 1 }}
            >
              {submitting ? <span className="spinner" /> : <><LogOut size={16} /> CHECK-OUT</>}
            </button>
          </div>
        ) : null}

        {/* WIDGET: DỰ ÁN CỦA TÔI */}
        <div className="card animate-fade-in" style={{ marginBottom: '14px', padding: '14px 16px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>🚀 DỰ ÁN ĐANG THAM GIA</span>
              <span className="badge badge--info" style={{ fontSize: '10px' }}>{myProjects.length}</span>
            </div>
            <button onClick={() => navigate('/projects')} className="btn btn--ghost" style={{ fontSize: '11px', padding: '4px 8px', color: 'var(--primary)' }}>
              Xem tất cả →
            </button>
          </div>

          {myProjects.length === 0 ? (
            <div style={{ padding: '14px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', background: 'var(--bg-raised)', borderRadius: '8px' }}>
              Chưa có dự án nào được phân công.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '10px' }}>
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
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.name}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      🎨 {p.category || 'Kiến trúc'} {p.pm_name ? `· 👷 PM: ${p.pm_name}` : ''}
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

        {/* WIDGET: SỰ KIỆN, SINH NHẬT & KỶ NIỆM GẮN BÓ TRONG THÁNG */}
        {(birthdays.length > 0 || anniversaries.length > 0 || holidays.length > 0) && (
          <div className="card animate-fade-in" style={{
            marginBottom: '16px', padding: '14px 16px',
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(236, 72, 153, 0.08) 100%)',
            border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: '14px'
          }}>
            <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>🎉 SỰ KIỆN & CHÚC MỪNG TRONG THÁNG</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '8px' }}>
              {/* Sinh nhật */}
              {birthdays.slice(0, 3).map(b => (
                <div key={b.user_id || b.id} style={{
                  background: 'var(--bg-card)', padding: '8px 10px', borderRadius: '8px',
                  border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px'
                }}>
                  <span style={{ fontSize: '18px' }}>🎂</span>
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                      {b.full_name}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      Sinh nhật {b.dob ? `ngày ${b.dob.split('-')[2] || b.dob}` : 'tháng này'}
                    </div>
                  </div>
                </div>
              ))}

              {/* Kỷ niệm gắn bó */}
              {anniversaries.slice(0, 3).map(a => (
                <div key={a.user_id || a.id} style={{
                  background: 'var(--bg-card)', padding: '8px 10px', borderRadius: '8px',
                  border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px'
                }}>
                  <span style={{ fontSize: '18px' }}>🏅</span>
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                      {a.full_name}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--primary)', fontWeight: 600 }}>
                      {a.badge || `Tròn ${a.years_count} năm gắn bó`}
                    </div>
                  </div>
                </div>
              ))}

              {/* Ngày lễ */}
              {holidays.slice(0, 2).map((h, idx) => (
                <div key={idx} style={{
                  background: 'var(--bg-card)', padding: '8px 10px', borderRadius: '8px',
                  border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px'
                }}>
                  <span style={{ fontSize: '18px' }}>🎌</span>
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                      {h.name}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      Nghỉ lễ: {h.date}
                    </div>
                  </div>
                </div>
              ))}
            </div>
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
