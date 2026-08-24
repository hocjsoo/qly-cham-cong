import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, X, Check, FileText, Clock, CheckCircle2, XCircle, Building2, Calendar, Shield, Sparkles, MessageSquare, AlertCircle, ArrowUpRight, Search, Camera, AlertTriangle, Phone, Mail, MapPin, Bike } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import useAuthStore from '../stores/authStore';
import HeaderActions from '../components/HeaderActions';

const TYPE_CONFIG = {
  annual_leave:  { label: '🏖️ Nghỉ phép năm (P)',      color: 'var(--green)', bg: 'var(--green-soft)' },
  sick_leave:    { label: '🏥 Nghỉ ốm (O)',             color: 'var(--yellow)', bg: 'var(--yellow-soft)' },
  unpaid_leave:  { label: '⚪ Nghỉ không lương (KL)',    color: 'var(--text-muted)', bg: 'var(--bg-raised)' },
  business_trip: { label: '💼 CT Trong nước (CT1)',     color: 'var(--primary)', bg: 'var(--primary-soft)' },
  foreign_trip:  { label: '✈️ CT Nước ngoài (CT2)',    color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.12)' },
  wfh:           { label: '🏠 Work from home (WFH)',    color: 'var(--blue)', bg: 'var(--blue-soft)' },
  late:          { label: '⏰ Giải trình đi muộn',      color: 'var(--yellow)', bg: 'var(--yellow-soft)' },
  early_leave:   { label: '🏃 Giải trình về sớm',      color: 'var(--yellow)', bg: 'var(--yellow-soft)' },
  overtime:      { label: '⏱️ Tăng ca (OT)',            color: 'var(--primary)', bg: 'var(--primary-soft)' },
  vehicle_update:{ label: '🛵 Đổi thông tin gửi xe',   color: 'var(--primary)', bg: 'var(--primary-soft)' },
  other:         { label: '📌 Khác (K)',                color: 'var(--text-secondary)', bg: 'var(--bg-raised)' },
};

const STATUS_CONFIG = {
  pending:  { label: 'Chờ duyệt', cls: 'badge--warning', icon: <Clock size={11} />, border: 'var(--yellow)' },
  approved: { label: 'Đã duyệt',  cls: 'badge--success', icon: <CheckCircle2 size={11} />, border: 'var(--green)' },
  rejected: { label: 'Từ chối',   cls: 'badge--danger',  icon: <XCircle size={11} />, border: 'var(--red)' },
};

const formatDate = (iso) => {
  if (!iso) return '';
  return new Date(iso + 'T00:00:00').toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const fmtTime = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
};

export default function RequestsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'mine';

  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'admin' || user?.role === 'manager' || user?.role === 'leader';

  const [tab, setTab] = useState(isManager && initialTab === 'flagged' ? 'flagged' : isManager && initialTab === 'pending' ? 'pending' : 'mine'); // 'mine' | 'pending' | 'flagged'
  const [mine, setMine] = useState([]);
  const [pending, setPending] = useState([]);
  const [projects, setProjects] = useState([]);
  const [leaveBalance, setLeaveBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Flagged Attendance & Photo Verification State
  const [flaggedList, setFlaggedList] = useState([]);
  const [flaggedCounts, setFlaggedCounts] = useState({ pending: 0, approved: 0, rejected: 0, with_photo: 0, total: 0 });
  const [flaggedTab, setFlaggedTab] = useState('pending');
  const [flaggedLoading, setFlaggedLoading] = useState(false);
  const [verifyingId, setVerifyingId] = useState(null);
  const [rejectFlaggedTarget, setRejectFlaggedTarget] = useState(null);
  const [rejectFlaggedReason, setRejectFlaggedReason] = useState('');
  const [allowRecheckin, setAllowRecheckin] = useState(false);

  // Status & Search Filters
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'pending' | 'approved' | 'rejected'
  const [typeFilter, setTypeFilter] = useState('all');
  const [search, setSearch] = useState('');

  // Reject Modal State
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectNote, setRejectNote] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [fullAvatarImage, setFullAvatarImage] = useState(null);
  const [viewingStaffDetail, setViewingStaffDetail] = useState(null);

  // Form State
  const [type, setType] = useState('annual_leave');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [selectedProject, setSelectedProject] = useState('');
  const [reason, setReason] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
    api.get('/projects?active_only=true').then(r => setProjects(Array.isArray(r.data) ? r.data : [])).catch(() => {});
    api.get('/leave-balance/me').then(r => setLeaveBalance(r.data?.annual_leave)).catch(() => {});
    if (isManager) {
      fetchFlagged();
    }
  }, [tab]);

  const loadData = async () => {
    try {
      setLoading(true);
      if (tab === 'mine') {
        const { data } = await api.get('/requests/my-requests');
        setMine(Array.isArray(data) ? data : []);
      } else {
        const { data } = await api.get('/requests/pending');
        setPending(Array.isArray(data) ? data : []);
      }
    } catch {
      toast.error('Lỗi tải danh sách đơn');
    } finally {
      setLoading(false);
    }
  };

  const handleImagePick = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error('Kích thước ảnh tối đa là 8MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setAttachmentUrl(ev.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleCreateRequest = async () => {
    if (!startDate) {
      toast.error('Vui lòng chọn ngày áp dụng');
      return;
    }
    if (!reason.trim()) {
      toast.error('Vui lòng nhập lý do cụ thể');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/requests', {
        type,
        start_date: startDate,
        end_date: endDate || startDate,
        start_time: startTime || null,
        end_time: endTime || null,
        project_id: selectedProject || null,
        reason: reason.trim(),
        attachment_url: attachmentUrl || null,
      });

      toast.success('Gửi đơn thành công! 📝');
      setShowForm(false);
      setStartDate(''); setEndDate(''); setStartTime(''); setEndTime(''); setReason(''); setSelectedProject(''); setAttachmentUrl('');
      loadData();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Lỗi gửi đơn');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (id) => {
    try {
      await api.put(`/requests/${id}/approve`);
      toast.success('Đã duyệt đơn thành công! ✅');
      loadData();
    } catch {
      toast.error('Lỗi duyệt đơn');
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectNote.trim()) {
      toast.error('Vui lòng nhập lý do từ chối');
      return;
    }

    setRejecting(true);
    try {
      await api.put(`/requests/${rejectTarget._id}/reject`, { reviewer_note: rejectNote.trim() });
      toast.success('Đã từ chối đơn! ❌');
      setRejectTarget(null);
      setRejectNote('');
      loadData();
    } catch {
      toast.error('Lỗi từ chối đơn');
    } finally {
      setRejecting(false);
    }
  };

  const fetchFlagged = async (targetStatus) => {
    try {
      setFlaggedLoading(true);
      const st = targetStatus || flaggedTab;
      const res = await api.get(`/attendance/flagged?status=${st}`);
      if (res.data) {
        setFlaggedList(res.data.flagged || []);
        if (res.data.counts) {
          setFlaggedCounts(res.data.counts);
        }
      }
    } catch {
      toast.error('Lỗi tải danh sách cảnh báo chấm công');
    } finally {
      setFlaggedLoading(false);
    }
  };

  const handleVerifyFlagged = async (recordId, action) => {
    try {
      setVerifyingId(recordId);
      await api.put(`/attendance/flagged/verify/${recordId}`, {
        action,
        reviewer_note: action === 'approve' ? 'Đã duyệt qua Portal Phê Duyệt' : 'Bị từ chối'
      });
      toast.success(action === 'approve' ? 'Đã duyệt ca chấm công thành công! ✅' : 'Đã từ chối ca chấm công! ❌');
      fetchFlagged();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Lỗi xử lý xác minh ca');
    } finally {
      setVerifyingId(null);
    }
  };

  const handleConfirmRejectFlagged = async () => {
    if (!rejectFlaggedTarget) return;
    try {
      setVerifyingId(rejectFlaggedTarget._id);
      await api.put(`/attendance/flagged/verify/${rejectFlaggedTarget._id}`, {
        action: 'reject',
        reviewer_note: rejectFlaggedReason.trim() || 'Từ chối ca chấm công',
        reset_today: allowRecheckin
      });
      toast.success(allowRecheckin ? 'Đã từ chối & Xóa ca để nhân viên chấm lại! 🗑️' : 'Đã từ chối ca chấm công! ❌');
      setRejectFlaggedTarget(null);
      setRejectFlaggedReason('');
      setAllowRecheckin(false);
      fetchFlagged();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Lỗi xử lý từ chối ca');
    } finally {
      setVerifyingId(null);
    }
  };

  const rawList = tab === 'mine' ? mine : pending;
  const list = rawList.filter(r => {
    const matchStatus = statusFilter === 'all' || r.status === statusFilter;
    const matchType = typeFilter === 'all' || r.type === typeFilter;
    const q = search.trim().toLowerCase();
    const matchSearch = !q ||
                        r.user_name?.toLowerCase().includes(q) ||
                        r.user_code?.toLowerCase().includes(q) ||
                        r.reason?.toLowerCase().includes(q) ||
                        r.project_name?.toLowerCase().includes(q) ||
                        TYPE_CONFIG[r.type]?.label?.toLowerCase().includes(q);

    return matchStatus && matchType && matchSearch;
  });

  // Summary counts
  const pendingCount = rawList.filter(r => r.status === 'pending').length;
  const approvedCount = rawList.filter(r => r.status === 'approved').length;

  const getWorkflowImpactText = (reqType) => {
    switch (reqType) {
      case 'late':
        return '⚡ Tác động tự động: Gỡ bỏ phạt đi muộn & khôi phục công đủ 1.0 cho ngày đã chọn.';
      case 'overtime':
        return '⚡ Tác động tự động: Ghi nhận giờ OT vào Bảng tính lương & Báo cáo tổng hợp.';
      case 'wfh':
      case 'business_trip':
        return '⚡ Tác động tự động: Xác nhận vị trí làm việc hợp lệ ngoài văn phòng & tính đủ công.';
      case 'annual_leave':
      case 'sick_leave':
        return '⚡ Tác động tự động: Trừ vào quỹ phép năm & tính nghỉ phép được hưởng lương.';
      case 'vehicle_update':
        return '⚡ Tác động tự động: Tự động cập nhật biển số & nơi gửi xe mới vào hồ sơ nhân sự ngay sau khi duyệt.';
      default:
        return '⚡ Tác động tự động: Lưu nhật ký giải trình & gửi thông báo đến quản lý.';
    }
  };

  return (
    <div className="page">
      {/* Top Header */}
      <div className="header">
        <div className="header__inner">
          <div className="header__title">Portal Phê Duyệt & Đơn Từ</div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button onClick={() => setShowForm(true)} className="btn btn--primary" style={{ padding: '6px 14px', fontSize: '13px' }}>
              <Plus size={15} /> Tạo đơn mới
            </button>
            <HeaderActions />
          </div>
        </div>
      </div>

      <div className="container" style={{ paddingTop: '14px' }}>
        {/* KPI Stat Cards Header */}
        <div style={{ display: 'grid', gridTemplateColumns: isManager ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)', gap: '8px', marginBottom: '14px' }}>
          <div className="card" style={{ padding: '10px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>⏳ ĐƠN CHỜ DUYỆT</div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--yellow)' }}>{pendingCount}</div>
          </div>
          <div className="card" style={{ padding: '10px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>✅ ĐƠN ĐÃ DUYỆT</div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--green)' }}>{approvedCount}</div>
          </div>
          {isManager && (
            <div className="card" style={{ padding: '10px 12px', textAlign: 'center', background: flaggedCounts.pending > 0 ? 'var(--yellow-soft)' : 'var(--bg-card)', border: flaggedCounts.pending > 0 ? '1px solid var(--yellow)' : '1px solid var(--border)' }}>
              <div style={{ fontSize: '11px', color: flaggedCounts.pending > 0 ? 'var(--yellow)' : 'var(--text-muted)', marginBottom: '2px', fontWeight: 700 }}>
                🛡️ CẢNH BÁO / ẢNH
              </div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: flaggedCounts.pending > 0 ? 'var(--yellow)' : 'var(--primary)' }}>
                {flaggedCounts.pending}
              </div>
            </div>
          )}
        </div>

        {/* Primary Role Tabs */}
        {isManager && (
          <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', background: 'var(--bg-input)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border)' }}>
            <button
              onClick={() => { setTab('mine'); setStatusFilter('all'); }}
              style={{
                flex: 1, padding: '8px 8px', border: 'none', borderRadius: '8px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer',
                background: tab === 'mine' ? 'var(--bg-card)' : 'transparent',
                color: tab === 'mine' ? 'var(--primary)' : 'var(--text-secondary)',
                boxShadow: tab === 'mine' ? 'var(--shadow-xs)' : 'none',
              }}
            >
              📝 Đơn của tôi ({mine.length})
            </button>
            <button
              onClick={() => { setTab('pending'); setStatusFilter('all'); }}
              style={{
                flex: 1, padding: '8px 8px', border: 'none', borderRadius: '8px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer',
                background: tab === 'pending' ? 'var(--bg-card)' : 'transparent',
                color: tab === 'pending' ? 'var(--primary)' : 'var(--text-secondary)',
                boxShadow: tab === 'pending' ? 'var(--shadow-xs)' : 'none',
              }}
            >
              📋 Đơn nhân viên ({pending.length})
            </button>
            <button
              onClick={() => { setTab('flagged'); fetchFlagged(); }}
              style={{
                flex: 1, padding: '8px 8px', border: 'none', borderRadius: '8px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer',
                background: tab === 'flagged' ? 'var(--bg-card)' : 'transparent',
                color: tab === 'flagged' ? 'var(--yellow)' : 'var(--text-secondary)',
                boxShadow: tab === 'flagged' ? 'var(--shadow-xs)' : 'none',
                position: 'relative'
              }}
            >
              🛡️ Cảnh báo & Ảnh {flaggedCounts.pending > 0 && <span className="badge badge--warning" style={{ fontSize: '9px', padding: '1px 5px', marginLeft: '4px' }}>{flaggedCounts.pending}</span>}
            </button>
          </div>
        )}

        {tab === 'flagged' ? (
          /* =========================================================================
             FLAGGED ATTENDANCE & SELFIE PHOTO VERIFICATION TAB
             ========================================================================= */
          <div>
            {/* Filter Tabs for Flagged Attendance */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', overflowX: 'auto', paddingBottom: '2px' }}>
              {[
                { key: 'pending', label: `⏳ Chờ duyệt (${flaggedCounts.pending})` },
                { key: 'approved', label: `✅ Đã duyệt (${flaggedCounts.approved})` },
                { key: 'rejected', label: `❌ Đã từ chối (${flaggedCounts.rejected})` },
                { key: 'photo', label: `📸 Kèm ảnh Selfie (${flaggedCounts.with_photo})` },
                { key: 'all', label: `Tất cả (${flaggedCounts.total})` },
              ].map(ft => (
                <button
                  key={ft.key}
                  onClick={() => {
                    setFlaggedTab(ft.key);
                    fetchFlagged(ft.key);
                  }}
                  className={`chip${flaggedTab === ft.key ? ' active' : ''}`}
                  style={{ fontSize: '11.5px', padding: '6px 12px', whiteSpace: 'nowrap' }}
                >
                  {ft.label}
                </button>
              ))}
            </div>

            {flaggedLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[1, 2, 3].map(i => <div key={i} className="skeleton-card" style={{ height: '110px', borderRadius: '12px' }} />)}
              </div>
            ) : flaggedList.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state__icon">🛡️</div>
                <div className="empty-state__title">Không có ca cảnh báo nào</div>
                <div className="empty-state__desc">Tất cả các ca chấm công đã được xác thực an toàn</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {flaggedList.map(item => {
                  const isPending = item.verification_status === 'pending_review' || item.is_flagged;
                  const isApproved = item.verification_status === 'approved';
                  const isRejected = item.verification_status === 'rejected';

                  return (
                    <div key={item._id} className="card animate-fade-in" style={{
                      padding: '14px', borderRadius: '14px',
                      borderLeft: `4px solid ${isApproved ? 'var(--green)' : isRejected ? 'var(--red)' : 'var(--yellow)'}`,
                      background: 'var(--bg-card)'
                    }}>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                        {/* Selfie Photo Thumbnail with Zoom Click */}
                        {item.selfie_url ? (
                          <div style={{ position: 'relative', flexShrink: 0 }}>
                            <img
                              src={item.selfie_url}
                              alt="Selfie"
                              onClick={() => setFullAvatarImage({ url: item.selfie_url, title: `Ảnh Selfie: ${item.user_id?.full_name || 'Nhân viên'}` })}
                              style={{
                                width: 68, height: 68, borderRadius: '12px', objectFit: 'cover',
                                border: `2px solid ${isApproved ? 'var(--green)' : isRejected ? 'var(--red)' : 'var(--yellow)'}`,
                                cursor: 'pointer', display: 'block'
                              }}
                              title="Click để phóng to ảnh Selfie"
                            />
                            <span style={{
                              position: 'absolute', bottom: '-4px', right: '-4px',
                              background: 'var(--primary)', color: '#fff', fontSize: '9px',
                              borderRadius: '6px', padding: '1px 4px', fontWeight: 800
                            }}>
                              📸 Zoom
                            </span>
                          </div>
                        ) : (
                          <div style={{
                            width: 68, height: 68, borderRadius: '12px', background: 'var(--bg-raised)',
                            color: 'var(--text-muted)', fontSize: '10px', display: 'flex', alignItems: 'center',
                            justifyContent: 'center', fontWeight: 700, textAlign: 'center', padding: '4px', flexShrink: 0,
                            border: '1px dashed var(--border)'
                          }}>
                            Không có ảnh
                          </div>
                        )}

                        {/* Details */}
                        <div style={{ flex: 1, minWidth: '220px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <div
                              onClick={() => {
                                if (item.user_id) setViewingStaffDetail(item.user_id);
                              }}
                              style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', cursor: 'pointer' }}
                              title="Click để xem hồ sơ nhân sự"
                            >
                              <span style={{ fontWeight: 800, fontSize: '14px', color: 'var(--primary)' }}>
                                👤 {item.user_id?.full_name || 'Nhân viên'}
                              </span>
                              <span style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 700 }}>
                                #{item.user_id?.employee_code || item.user_id?.code || 'NS'}
                              </span>
                            </div>
                            <span className={`badge ${isApproved ? 'badge--success' : isRejected ? 'badge--danger' : 'badge--warning'}`} style={{ fontSize: '10px' }}>
                              {isApproved ? '✅ Đã duyệt' : isRejected ? '❌ Bị từ chối' : '⏳ Chờ duyệt'}
                            </span>
                          </div>

                          <div style={{ fontSize: '12px', color: isApproved ? 'var(--green)' : isPending ? 'var(--yellow)' : 'var(--red)', fontWeight: 700, margin: '2px 0 6px 0' }}>
                            {item.flag_reasons?.includes('GPS_OUTSIDE_PHOTO_FALLBACK')
                              ? '📸 Chấm công ảnh xác thực dự phòng (Ngoài bán kính GPS)'
                              : item.is_flagged
                                ? '🚨 Cảnh báo thiết bị / Nghi vấn chấm hộ'
                                : '📋 Bản ghi xác thực hình ảnh'}
                          </div>

                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', background: 'var(--bg-raised)', padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border)', lineHeight: 1.4 }}>
                            <strong>📱 Thiết bị:</strong> {item.hardware_uuid ? `ID phần cứng [${item.hardware_uuid.slice(0, 10)}]` : 'Chưa định danh'} {item.check_in_note ? `· Ghi chú: ${item.check_in_note}` : ''}
                          </div>

                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                            <span>🕒 Lúc: <strong>{fmtTime(item.check_in_time)}</strong></span>
                            <span>📅 Ngày: <strong>{formatDate(item.date)}</strong></span>
                            {item.reviewed_at && (
                              <span style={{ color: 'var(--green)', fontWeight: 600 }}>
                                ✍️ Duyệt bởi: {item.reviewed_by?.full_name || 'Admin'} ({new Date(item.reviewed_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })})
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Admin Quick Action Panel */}
                      {isAdmin && isPending && (
                        <div style={{ display: 'flex', gap: '8px', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border-muted)' }}>
                          <button
                            onClick={() => handleVerifyFlagged(item._id, 'approve')}
                            disabled={verifyingId === item._id}
                            className="btn btn--primary"
                            style={{ flex: 1, fontSize: '12px', padding: '7px 12px', fontWeight: 700 }}
                          >
                            <Check size={14} /> Duyệt ca hợp lệ
                          </button>
                          <button
                            onClick={() => {
                              setRejectFlaggedTarget(item);
                              setRejectFlaggedReason('');
                              setAllowRecheckin(false);
                            }}
                            disabled={verifyingId === item._id}
                            className="btn btn--ghost"
                            style={{ flex: 1, fontSize: '12px', padding: '7px 12px', color: 'var(--red)', fontWeight: 600 }}
                          >
                            <X size={14} /> Từ chối ca
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* =========================================================================
             STANDARD REQUESTS TAB (MINE / PENDING)
             ========================================================================= */
          <div>
            {/* Search Bar + Type Select */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                <input
                  type="text"
                  className="form-input"
                  style={{ paddingLeft: '30px', padding: '8px 10px 8px 30px', fontSize: '13px' }}
                  placeholder="🔍 Tìm theo Tên, Mã NS, Lý do, Dự án..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <select className="form-input" style={{ width: 'auto', padding: '6px 8px', fontSize: '12px' }} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
                <option value="all">📂 Loại đơn: Tất cả</option>
                <option value="annual_leave">🌴 Nghỉ phép năm</option>
                <option value="business_trip">🏗️ Đi công tác</option>
                <option value="wfh">🏠 Làm WFH</option>
                <option value="late">⏰ Giải trình muộn/về sớm</option>
                <option value="overtime">💪 Đơn tăng ca (OT)</option>
                <option value="vehicle_update">🛵 Đổi thông tin gửi xe</option>
                <option value="unpaid_leave">📄 Nghỉ không lương</option>
                <option value="sick_leave">🤒 Nghỉ ốm</option>
              </select>
            </div>

            {/* Status Filter Pills */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', overflowX: 'auto', paddingBottom: '2px' }}>
              {[
                { key: 'all', label: 'Tất cả' },
                { key: 'pending', label: '⏳ Chờ duyệt' },
                { key: 'approved', label: '✅ Đã duyệt' },
                { key: 'rejected', label: '❌ Từ chối' },
              ].map(sf => (
                <button
                  key={sf.key}
                  onClick={() => setStatusFilter(sf.key)}
                  className={`chip${statusFilter === sf.key ? ' active' : ''}`}
                  style={{ fontSize: '12px', padding: '6px 14px' }}
                >
                  {sf.label}
                </button>
              ))}
            </div>

            {/* Request List */}
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[1, 2, 3].map(i => <div key={i} className="skeleton-card" style={{ height: '96px', borderRadius: '12px' }} />)}
              </div>
            ) : list.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state__icon">📄</div>
                <div className="empty-state__title">Không tìm thấy đơn từ</div>
                <div className="empty-state__desc">Bấm "Tạo đơn mới" để gửi yêu cầu xin nghỉ phép, giải trình đi muộn hoặc tăng ca</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {list.map(r => {
                  const typeCfg = TYPE_CONFIG[r.type] || TYPE_CONFIG.other;
                  const statusCfg = STATUS_CONFIG[r.status] || STATUS_CONFIG.pending;
                  const displayName = r.user_name || (tab === 'mine' ? user?.full_name : 'Nhân viên');
                  const avatarUrl = r.user_avatar || r.user_id?.avatar_url || (tab === 'mine' ? user?.avatar_url : null);
                  const initials = displayName.split(' ').slice(-2).map(n => n[0]).join('').toUpperCase();

                  return (
                    <div
                      key={r._id}
                      className="card animate-fade-in"
                      style={{
                        padding: '14px',
                        borderLeft: `4px solid ${statusCfg.border}`,
                        background: 'var(--bg-card)',
                      }}
                    >
                      {/* Top Row: Type Tag + Avatar + Status Badge */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div
                            className="avatar"
                            style={{
                              width: '32px', height: '32px', fontSize: '11px', flexShrink: 0,
                              borderRadius: '50%', overflow: 'hidden', cursor: 'pointer',
                              border: '1.5px solid var(--border)', background: 'var(--bg-raised)', display: 'flex',
                              alignItems: 'center', justifyContent: 'center'
                            }}
                            onClick={() => {
                              if (r.user_id) setViewingStaffDetail(r.user_id);
                              else if (avatarUrl) setFullAvatarImage({ url: avatarUrl, title: displayName });
                            }}
                            title="Click để xem hồ sơ nhân sự"
                          >
                            {avatarUrl ? (
                              <img src={avatarUrl} alt={displayName} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                            ) : (
                              initials
                            )}
                          </div>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{
                                fontSize: '12px', fontWeight: 700, color: typeCfg.color, background: typeCfg.bg,
                                padding: '3px 8px', borderRadius: '6px', border: `1px solid ${typeCfg.color}22`
                              }}>
                                {typeCfg.label}
                              </span>
                              <span
                                onClick={() => {
                                  if (r.user_id) setViewingStaffDetail(r.user_id);
                                }}
                                style={{
                                  fontSize: '12px', fontWeight: 700,
                                  color: r.user_id ? 'var(--primary)' : 'var(--text)',
                                  cursor: r.user_id ? 'pointer' : 'default'
                                }}
                                title={r.user_id ? 'Click để xem hồ sơ nhân sự' : ''}
                              >
                                {displayName} {r.user_code ? `(#${r.user_code})` : ''}
                              </span>
                            </div>
                          </div>
                        </div>

                        <span className={`badge ${statusCfg.cls}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          {statusCfg.icon} {statusCfg.label}
                        </span>
                      </div>

                  {/* Proposed Vehicle Info Box for vehicle_update */}
                  {r.type === 'vehicle_update' && (
                    <div style={{
                      background: 'var(--primary-subtle, rgba(59, 130, 246, 0.12))',
                      border: '1px solid var(--primary)',
                      borderRadius: '8px', padding: '8px 12px', margin: '6px 0 8px 0'
                    }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--primary)', marginBottom: '3px' }}>
                        🛵 THÔNG TIN XE ĐỀ XUẤT CẬP NHẬT:
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text)' }}>
                        {r.proposed_vehicle_info || 'Không sử dụng xe'}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        🏢 Địa điểm gửi: <strong>{r.proposed_parking_location || 'Tòa 17T10 Nguyễn Thị Định'}</strong>
                      </div>
                    </div>
                  )}

                  {/* Reason Details */}
                  <div style={{ fontSize: '13px', color: 'var(--text)', fontWeight: 500, margin: '6px 0 8px 0', lineHeight: 1.5 }}>
                    "{r.reason}"
                  </div>

                  {/* Attachment Photo Thumbnail if present */}
                  {r.attachment_url && (
                    <div style={{ margin: '8px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <img
                        src={r.attachment_url}
                        alt="Minh chứng"
                        onClick={() => setFullAvatarImage({ url: r.attachment_url, title: `Minh chứng đính kèm: ${displayName}` })}
                        style={{
                          width: '64px', height: '64px', borderRadius: '10px', objectFit: 'cover',
                          border: '2px solid var(--primary)', cursor: 'pointer'
                        }}
                        title="Click để phóng to ảnh minh chứng"
                      />
                      <div style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 600 }}>
                        📸 Ảnh minh chứng đính kèm (Click để phóng to)
                      </div>
                    </div>
                  )}

                  {/* Time & Location Details */}
                  <div style={{ display: 'flex', gap: '10px', fontSize: '11px', color: 'var(--text-muted)', flexWrap: 'wrap', marginBottom: '6px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      📅 {formatDate(r.start_date)} {r.end_date && r.end_date !== r.start_date ? `→ ${formatDate(r.end_date)}` : ''}
                    </span>
                    {r.start_time && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                        ⏰ {r.start_time} {r.end_time && `- ${r.end_time}`}
                      </span>
                    )}
                    {r.project_name && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                        🏗️ {r.project_name}
                      </span>
                    )}
                  </div>

                  {/* Reviewer Note if processed */}
                  {r.reviewer_note && (
                    <div style={{
                      fontSize: '11px', color: 'var(--text-secondary)', background: 'var(--bg-raised)',
                      padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)', marginTop: '8px'
                    }}>
                      💬 <strong>Phản hồi của quản lý:</strong> {r.reviewer_note}
                    </div>
                  )}

                  {/* Manager Quick Action Panel */}
                  {tab === 'pending' && r.status === 'pending' && (
                    <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border-muted)' }}>
                      {isAdmin ? (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => handleApprove(r._id)}
                            className="btn btn--primary"
                            style={{ flex: 1, fontSize: '12px', padding: '7px 12px', fontWeight: 700 }}
                          >
                            <Check size={14} /> Phê duyệt
                          </button>
                          <button
                            onClick={() => { setRejectTarget(r); setRejectNote(''); }}
                            className="btn btn--ghost"
                            style={{ flex: 1, fontSize: '12px', padding: '7px 12px', color: 'var(--red)', fontWeight: 600 }}
                          >
                            <X size={14} /> Từ chối
                          </button>
                        </div>
                      ) : (
                        <div style={{
                          fontSize: '11px', color: 'var(--text-secondary)', background: 'var(--bg-raised)',
                          padding: '6px 10px', borderRadius: '6px', textAlign: 'center', fontWeight: 600,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                        }}>
                          <Clock size={13} color="var(--yellow)" /> Chờ Ban Giám Đốc (Admin) phê duyệt
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
          </div>
        )}
      </div>

      {/* Modern Create Request Sheet Modal */}
      {/* Create Request Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div
            className="modal-sheet animate-slide-up"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '640px',
              width: '95vw',
              maxHeight: '90vh',
              overflowY: 'auto',
              margin: 'auto',
              borderRadius: '16px',
              padding: '22px 26px',
              boxShadow: '0 16px 40px rgba(0,0,0,0.3)'
            }}
          >
            <div className="modal-sheet__handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', borderBottom: '1px solid var(--border-muted)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--primary-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Sparkles size={22} color="var(--primary)" />
                </div>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text)', margin: 0 }}>Tạo Đơn Từ Mới</h3>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Gửi đơn xin nghỉ phép, giải trình đi muộn, làm ngoài giờ (OT)...</div>
                </div>
              </div>
              <button onClick={() => setShowForm(false)} className="btn btn--ghost" style={{ padding: '6px 10px', borderRadius: '8px' }}>
                <X size={20} />
              </button>
            </div>

            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label className="form-label" style={{ fontWeight: 700 }}>Loại đơn xin phép *</label>
              <select className="form-select" value={type} onChange={e => setType(e.target.value)}>
                {Object.entries(TYPE_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>

            {/* Dynamic Impact Preview Banner */}
            <div style={{
              fontSize: '12px', color: 'var(--primary)', background: 'var(--primary-soft)',
              padding: '10px 14px', borderRadius: '10px', marginBottom: '14px', lineHeight: 1.4,
              border: '1px solid var(--primary-soft)', fontWeight: 500
            }}>
              {getWorkflowImpactText(type)}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontWeight: 700 }}>📅 Từ ngày *</label>
                <input
                  type="date"
                  className="form-input"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  onClick={e => e.target.showPicker && e.target.showPicker()}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontWeight: 700 }}>📅 Đến ngày</label>
                <input
                  type="date"
                  className="form-input"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  onClick={e => e.target.showPicker && e.target.showPicker()}
                />
              </div>
            </div>

            {['late', 'early_leave', 'overtime'].includes(type) && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontWeight: 700 }}>⏱️ Từ giờ</label>
                  <input
                    type="time"
                    className="form-input"
                    value={startTime}
                    onChange={e => setStartTime(e.target.value)}
                    onClick={e => e.target.showPicker && e.target.showPicker()}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontWeight: 700 }}>⏱️ Đến giờ</label>
                  <input
                    type="time"
                    className="form-input"
                    value={endTime}
                    onChange={e => setEndTime(e.target.value)}
                    onClick={e => e.target.showPicker && e.target.showPicker()}
                  />
                </div>
              </div>
            )}

            {['business_trip', 'overtime'].includes(type) && (
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label" style={{ fontWeight: 700 }}>🏗️ Dự án / Công trình liên quan (Nếu có)</label>
                <select className="form-select" value={selectedProject} onChange={e => setSelectedProject(e.target.value)}>
                  <option value="">-- Không gắn dự án --</option>
                  {projects.map(p => <option key={p._id} value={p._id}>{p.name} ({p.code || 'DA'})</option>)}
                </select>
              </div>
            )}

            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label className="form-label" style={{ fontWeight: 700 }}>📝 Lý do cụ thể *</label>
              <textarea
                className="form-input"
                rows={3}
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Nhập lý do xin nghỉ, giải trình đi muộn, nội dung công việc..."
              />
            </div>

            {/* Ảnh minh chứng đính kèm (Ảnh selfie, vé xe, đơn thuốc, ảnh công trình) */}
            <div className="form-group" style={{ marginBottom: '18px' }}>
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 700 }}>
                <span>📸 Ảnh minh chứng đính kèm (Không bắt buộc)</span>
                {attachmentUrl && (
                  <button type="button" onClick={() => setAttachmentUrl('')} style={{ background: 'none', border: 'none', color: 'var(--red)', fontSize: '11.5px', cursor: 'pointer', fontWeight: 700 }}>
                    Xóa ảnh
                  </button>
                )}
              </label>

              {attachmentUrl ? (
                <div style={{ position: 'relative', display: 'inline-block', marginTop: '4px' }}>
                  <img
                    src={attachmentUrl}
                    alt="Preview"
                    style={{ width: '84px', height: '84px', borderRadius: '10px', objectFit: 'cover', border: '2px solid var(--primary)' }}
                  />
                </div>
              ) : (
                <label style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  padding: '14px', borderRadius: '10px', border: '1.5px dashed var(--border)',
                  background: 'var(--bg-raised)', cursor: 'pointer', fontSize: '12.5px', color: 'var(--text-secondary)',
                  transition: 'all 0.15s'
                }}>
                  <Camera size={20} color="var(--primary)" />
                  <span>Chạm để chọn ảnh / chụp từ camera điện thoại</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImagePick}
                    style={{ display: 'none' }}
                  />
                </label>
              )}
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="btn btn--ghost"
                style={{ flex: 1, padding: '10px', fontSize: '13px', fontWeight: 700 }}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleCreateRequest}
                disabled={submitting}
                className="btn btn--primary"
                style={{ flex: 2, padding: '10px', fontSize: '13px', fontWeight: 800 }}
              >
                {submitting ? <span className="spinner" /> : '🚀 Gửi đơn xác nhận'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Reason Modal */}
      {rejectTarget && (
        <div className="modal-overlay" onClick={() => setRejectTarget(null)}>
          <div className="modal-sheet animate-slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: '380px', margin: '0 auto' }}>
            <div className="modal-sheet__handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--red)' }}>Từ chối đơn từ</h3>
              <button onClick={() => setRejectTarget(null)} className="btn btn--ghost" style={{ padding: '4px 8px' }}><X size={18} /></button>
            </div>

            <div className="form-group">
              <label className="form-label">Lý do từ chối *</label>
              <textarea
                className="form-input"
                rows={3}
                value={rejectNote}
                onChange={e => setRejectNote(e.target.value)}
                placeholder="Nhập ghi chú phản hồi lý do không duyệt đơn..."
              />
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setRejectTarget(null)} className="btn btn--ghost btn--full">Hủy</button>
              <button onClick={handleConfirmReject} disabled={rejecting} className="btn btn--full" style={{ background: 'var(--red)', color: '#fff', border: 'none', fontWeight: 700 }}>
                {rejecting ? <span className="spinner" /> : 'Xác nhận từ chối'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Flagged Attendance Modal */}
      {rejectFlaggedTarget && (
        <div className="modal-overlay" onClick={() => setRejectFlaggedTarget(null)}>
          <div className="modal-sheet animate-slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', margin: '0 auto' }}>
            <div className="modal-sheet__handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={18} color="var(--red)" />
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--red)' }}>Từ chối ca chấm công</h3>
              </div>
              <button onClick={() => setRejectFlaggedTarget(null)} className="btn btn--ghost" style={{ padding: '4px 8px' }}><X size={18} /></button>
            </div>

            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px', lineHeight: 1.4 }}>
              Xác nhận từ chối ca chấm công của nhân sự <strong>{rejectFlaggedTarget.user_id?.full_name || 'Nhân viên'}</strong> vào ngày <strong>{formatDate(rejectFlaggedTarget.date)}</strong>.
            </div>

            <div className="form-group">
              <label className="form-label">Lý do từ chối *</label>
              <textarea
                className="form-input"
                rows={3}
                value={rejectFlaggedReason}
                onChange={e => setRejectFlaggedReason(e.target.value)}
                placeholder="Nhập lý do (ví dụ: Ảnh không rõ mặt, vị trí ngoài văn phòng không báo trước...)"
              />
            </div>

            <div className="form-group" style={{ background: 'var(--bg-raised)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, color: 'var(--text)' }}>
                <input
                  type="checkbox"
                  checked={allowRecheckin}
                  onChange={e => setAllowRecheckin(e.target.checked)}
                  style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                />
                <span>Xóa ca hôm nay để nhân viên được phép chấm công lại</span>
              </label>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
              <button onClick={() => setRejectFlaggedTarget(null)} className="btn btn--ghost btn--full">Hủy</button>
              <button onClick={handleConfirmRejectFlagged} disabled={verifyingId === rejectFlaggedTarget._id} className="btn btn--full" style={{ background: 'var(--red)', color: '#fff', border: 'none', fontWeight: 700 }}>
                {verifyingId === rejectFlaggedTarget._id ? <span className="spinner" /> : 'Xác nhận từ chối'}
              </button>
            </div>
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
            {fullAvatarImage.title && (
              <div style={{ color: '#fff', marginTop: '12px', fontSize: '14px', fontWeight: 700 }}>
                📸 {fullAvatarImage.title}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Staff Profile Detail Modal */}
      {viewingStaffDetail && (
        <div className="modal-overlay" style={{ zIndex: 1100, padding: '16px' }} onClick={() => setViewingStaffDetail(null)}>
          <div
            className="modal-sheet animate-slide-up"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '520px', width: '100%', margin: '0 auto',
              padding: '24px', borderRadius: '20px',
              boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
              border: '1px solid var(--border)'
            }}
          >
            <div className="modal-sheet__handle" />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>👤</span>
                <h3 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text)', margin: 0 }}>
                  Hồ Sơ Nhân Sự
                </h3>
              </div>
              <button
                onClick={() => setViewingStaffDetail(null)}
                className="btn btn--ghost"
                style={{ width: '36px', height: '36px', borderRadius: '50%', padding: 0 }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Profile Highlight Card */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.12) 0%, rgba(99, 102, 241, 0.05) 100%)',
              padding: '18px', borderRadius: '16px',
              border: '1px solid var(--primary-soft)', marginBottom: '16px',
              display: 'flex', alignItems: 'center', gap: '14px'
            }}>
              <div
                onClick={() => {
                  const av = viewingStaffDetail.avatar_url || viewingStaffDetail.user_avatar;
                  if (av) {
                    setFullAvatarImage({ url: av, title: viewingStaffDetail.full_name || viewingStaffDetail.user_name });
                  }
                }}
                style={{ cursor: (viewingStaffDetail.avatar_url || viewingStaffDetail.user_avatar) ? 'zoom-in' : 'default', position: 'relative' }}
                title={(viewingStaffDetail.avatar_url || viewingStaffDetail.user_avatar) ? 'Click để xem ảnh lớn' : ''}
              >
                {(viewingStaffDetail.avatar_url || viewingStaffDetail.user_avatar) ? (
                  <img
                    src={viewingStaffDetail.avatar_url || viewingStaffDetail.user_avatar}
                    alt=""
                    style={{ width: 62, height: 62, borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--primary)', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.25)' }}
                  />
                ) : (
                  <div style={{ width: 62, height: 62, borderRadius: '50%', background: 'var(--primary)', color: '#fff', fontSize: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                    {(viewingStaffDetail.full_name || viewingStaffDetail.user_name || 'U').split(' ').map(w => w[0]).slice(-2).join('').toUpperCase()}
                  </div>
                )}
              </div>
              <div>
                <div style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text)' }}>
                  {viewingStaffDetail.full_name || viewingStaffDetail.user_name || 'Nhân viên'}
                </div>
                <div style={{ fontSize: '12.5px', color: 'var(--primary)', fontWeight: 700, marginTop: '2px' }}>
                  #{viewingStaffDetail.employee_code || viewingStaffDetail.user_code || 'NS'} · {viewingStaffDetail.position || 'Nhân sự'}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  🏢 {viewingStaffDetail.department_name || viewingStaffDetail.department_id?.name || 'Văn Phòng'}
                </div>
              </div>
            </div>

            {/* Detailed Info List */}
            <div style={{
              background: 'var(--bg-card)', padding: '14px 16px', borderRadius: '12px',
              border: '1px solid var(--border)', fontSize: '13px',
              display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Mail size={14} /> Email:
                </span>
                <span style={{ fontWeight: 600, color: 'var(--text)' }}>
                  {viewingStaffDetail.email || 'Chưa cập nhật'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Phone size={14} /> Điện thoại:
                </span>
                {viewingStaffDetail.phone ? (
                  <a href={`tel:${viewingStaffDetail.phone}`} style={{ fontWeight: 700, color: 'var(--primary)', textDecoration: 'none' }}>
                    {viewingStaffDetail.phone}
                  </a>
                ) : (
                  <span style={{ color: 'var(--text-muted)' }}>Chưa cập nhật</span>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Calendar size={14} /> Ngày gia nhập:
                </span>
                <span style={{ fontWeight: 600, color: 'var(--text)' }}>
                  {viewingStaffDetail.join_date || (viewingStaffDetail.start_year ? `Năm ${viewingStaffDetail.start_year}` : 'Chưa cập nhật')}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MapPin size={14} /> Điểm gửi xe:
                </span>
                <span style={{ fontWeight: 600, color: 'var(--text)' }}>
                  {viewingStaffDetail.parking_location || 'Tòa 17T10 Nguyễn Thị Định'}
                </span>
              </div>

              {viewingStaffDetail.vehicle_info && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Bike size={14} /> Phương tiện:
                  </span>
                  <span style={{ fontWeight: 600, color: 'var(--text)' }}>
                    {viewingStaffDetail.vehicle_info}
                  </span>
                </div>
              )}
            </div>

            <button
              onClick={() => setViewingStaffDetail(null)}
              className="btn btn--primary btn--full btn--lg"
              style={{ padding: '12px', fontSize: '14px', fontWeight: 800, borderRadius: '12px' }}
            >
              Đóng hồ sơ ✓
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
