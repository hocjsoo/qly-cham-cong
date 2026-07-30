// src/pages/CheckInPage.jsx
// GPS bắt buộc — Auto-acquire GPS khi mở trang, Hiển thị khoảng cách văn phòng, Block check-in nếu thiếu GPS

import { useState, useEffect, useRef } from 'react';
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
  on_time:     { label: 'Đúng giờ',          cls: 'badge--success', icon: '✅' },
  late_minor:  { label: 'Muộn nhẹ (1–10p)',  cls: 'badge--warning', icon: '⏰' },
  late_medium: { label: 'Muộn (11–30p)',      cls: 'badge--warning', icon: '⚠️' },
  late_severe: { label: 'Muộn nhiều (>30p)', cls: 'badge--danger',  icon: '🚨' },
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
  const [projects, setProjects] = useState([]);
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

  // Anti-fraud Step-Up Selfie state
  const [showSelfieModal, setShowSelfieModal] = useState(false);
  const [selfieReason, setSelfieReason] = useState('');
  const [selfieImage, setSelfieImage] = useState(null);
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
      const [todayRes, settingsRes, projRes, locRes] = await Promise.all([
        api.get('/attendance/today'),
        api.get('/settings'),
        api.get('/projects'),
        api.get('/locations'),
      ]);
      setToday(todayRes.data.attendance || null);

      const activeOffice = todayRes.data.office || locRes?.data?.locations?.find(l => l.is_active) || locRes?.data?.locations?.[0] || settingsRes.data?.setting?.office;
      if (activeOffice) setOffice(activeOffice);

      if (projRes.data.projects) setProjects(projRes.data.projects.filter(p => p.status === 'active'));
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

  const handleCheckIn = async (overrideSelfie = null) => {
    if (!gpsPosition) {
      toast.error('BẮT BUỘC có vị trí GPS để chấm công. Vui lòng bật GPS thiết bị.');
      acquireGPS();
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
        type: selected,
        project_id: selectedProject || null,
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

      toast.success(data.message);
      setToday(data.attendance);
      setShowSelfieModal(false);
      setSelfieImage(null);

      if (data.is_flagged) {
        toast('Ghi nhận chấm công trên thiết bị dùng chung! Đã gửi thông báo cho Sếp xác nhận.', { icon: '🛡️', duration: 8000 });
      }

      if (data.device_warning) {
        toast(data.device_warning, { icon: '🛡️', duration: 8000 });
      }

      if (data.attendance?.is_late || selected === 'wfh') {
        setExplanationType(data.attendance?.is_late ? 'late' : 'business_trip');
        setShowExplanationModal(true);
      }
    } catch (err) {
      const errorData = err?.response?.data;
      if (errorData?.step_up_required) {
        setSelfieReason(errorData.error);
        setShowSelfieModal(true);
        toast.error(errorData.error, { duration: 6000 });
      } else if (errorData?.suggest_business_trip) {
        toast.error(errorData.error, { duration: 8000 });
        setTimeout(() => {
          toast((t) => (
            <div>
              <div style={{ fontWeight: 600, marginBottom: '6px' }}>Chuyển sang WFH hoặc Công tác?</div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button className="btn btn--primary" style={{ flex: 1, fontSize: '12px', padding: '6px' }}
                  onClick={() => { toast.dismiss(t.id); setSelected('wfh'); }}>
                  WFH
                </button>
                <button className="btn btn--ghost" style={{ flex: 1, fontSize: '12px', padding: '6px' }}
                  onClick={() => { toast.dismiss(t.id); navigate('/requests'); }}>
                  Tạo đơn
                </button>
              </div>
            </div>
          ), { duration: 8000 });
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

  // Real-time distance from office
  const distanceFromOffice = gpsPosition && office?.lat && office?.lng
    ? Math.round(getDistanceMeters(gpsPosition.lat, gpsPosition.lng, office.lat, office.lng))
    : null;
  const isInOfficeRange = distanceFromOffice !== null && office?.radius_m
    ? distanceFromOffice <= office.radius_m
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
        {/* GPS Status Banner — luôn hiện */}
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
                      ? `✅ Trong văn phòng (${distanceFromOffice}m cách ${office?.name || 'VP'})`
                      : isInOfficeRange === false
                        ? `⚠️ Cách văn phòng ${distanceFromOffice}m (bán kính: ${office?.radius_m}m)`
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
              <CheckCircle size={16} /> Đã hoàn thành ca làm ({att.total_hours}h)
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
              Chưa chấm công hôm nay
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
                  {isOtNow ? 'Đang làm quá 18:00 (Tăng ca)' : att.is_late ? `Đi muộn ${att.late_minutes} phút` : 'Làm việc tại nhà (WFH)'}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Tạo đơn để được tính công đầy đủ</div>
              </div>
            </div>
            <button onClick={() => { setExplanationType(isOtNow ? 'overtime' : att.is_late ? 'late' : 'business_trip'); setShowExplanationModal(true); }} className="btn btn--primary" style={{ fontSize: '12px', padding: '6px 12px', whiteSpace: 'nowrap' }}>
              Giải trình <ChevronRight size={14} />
            </button>
          </div>
        )}

        {/* Distance warning khi chọn office nhưng ngoài range */}
        {!isCheckedIn && selected === 'office' && isInOfficeRange === false && (
          <div className="card animate-fade-in" style={{ marginBottom: '12px', padding: '12px 14px', background: 'var(--red-soft)', border: '1px solid var(--red)' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <AlertTriangle size={20} color="var(--red)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <div style={{ fontWeight: 700, color: 'var(--red)', marginBottom: '4px' }}>
                  Ngoài bán kính văn phòng ({distanceFromOffice}m/{office?.radius_m}m)
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '10px', lineHeight: 1.5 }}>
                  Bạn đang cách {office?.name || 'văn phòng'} {distanceFromOffice}m. Không thể chấm công kiểu <strong>Văn phòng</strong>. Hãy chọn loại WFH hoặc Công tác.
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => setSelected('wfh')} className="btn btn--primary" style={{ fontSize: '12px', padding: '6px 12px' }}>
                    🏠 Chuyển WFH
                  </button>
                  <button onClick={() => navigate('/requests')} className="btn btn--ghost" style={{ fontSize: '12px', padding: '6px 12px' }}>
                    Tạo đơn công tác
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
                const isDisabled = t.value === 'office' && isInOfficeRange === false;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => !isDisabled && setSelected(t.value)}
                    style={{
                      padding: '12px 10px', borderRadius: '10px', border: '1px solid',
                      textAlign: 'left', cursor: isDisabled ? 'not-allowed' : 'pointer',
                      opacity: isDisabled ? 0.5 : 1,
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
              <div className="form-group">
                <label className="form-label">Chọn dự án *</label>
                <select className="form-input" value={selectedProject} onChange={e => setSelectedProject(e.target.value)}>
                  <option value="">-- Chọn dự án đang hoạt động --</option>
                  {projects.map(p => <option key={p._id} value={p._id}>{p.name} ({p.code || 'DA'})</option>)}
                </select>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Ghi chú (Không bắt buộc)</label>
              <input type="text" className="form-input" placeholder="VD: Gặp khách hàng công ty A..." value={note} onChange={e => setNote(e.target.value)} />
            </div>

            <button
              onClick={handleCheckIn}
              disabled={submitting || gpsLoading || !gpsPosition || (selected === 'office' && isInOfficeRange === false)}
              className="btn btn--primary btn--full btn--lg"
              style={{ opacity: (!gpsPosition || gpsLoading) ? 0.6 : 1 }}
            >
              {gpsLoading ? '⏳ Đang lấy GPS...' : !gpsPosition ? '📍 Cần GPS để chấm công' : submitting ? <span className="spinner" /> : 'BẮT ĐẦU CA (CHECK-IN)'}
            </button>

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
      </div>

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
