// src/pages/RequestsPage.jsx
// Trang Đơn Từ — Premium Request Portal (Form, KPI Cards, Status Filters & Manager Workflow)

import { useState, useEffect } from 'react';
import { Plus, X, Check, FileText, Clock, CheckCircle2, XCircle, Building2, Calendar, Shield, Sparkles, MessageSquare, AlertCircle, ArrowUpRight } from 'lucide-react';
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

export default function RequestsPage() {
  const { user } = useAuthStore();
  const isManager = user?.role === 'admin' || user?.role === 'manager' || user?.role === 'leader';

  const [tab, setTab] = useState('mine'); // 'mine' | 'pending'
  const [mine, setMine] = useState([]);
  const [pending, setPending] = useState([]);
  const [projects, setProjects] = useState([]);
  const [leaveBalance, setLeaveBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Status Filter
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'pending' | 'approved' | 'rejected'

  // Reject Modal State
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectNote, setRejectNote] = useState('');
  const [rejecting, setRejecting] = useState(false);

  // Form State
  const [type, setType] = useState('annual_leave');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [selectedProject, setSelectedProject] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
    api.get('/projects?active_only=true').then(r => setProjects(Array.isArray(r.data) ? r.data : [])).catch(() => {});
    api.get('/leave-balance/me').then(r => setLeaveBalance(r.data?.annual_leave)).catch(() => {});
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
      });

      toast.success('Gửi đơn thành công! 📝');
      setShowForm(false);
      setStartDate(''); setEndDate(''); setStartTime(''); setEndTime(''); setReason(''); setSelectedProject('');
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

  const rawList = tab === 'mine' ? mine : pending;
  const list = rawList.filter(r => statusFilter === 'all' || r.status === statusFilter);

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
      default:
        return '⚡ Tác động tự động: Lưu nhật ký giải trình & gửi thông báo đến quản lý.';
    }
  };

  return (
    <div className="page">
      {/* Top Header */}
      <div className="header">
        <div className="header__inner">
          <div className="header__title">Portal Đơn Từ</div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button onClick={() => setShowForm(true)} className="btn btn--primary" style={{ padding: '6px 14px', fontSize: '13px' }}>
              <Plus size={15} /> Tạo đơn mới
            </button>
            <HeaderActions />
          </div>
        </div>
      </div>

      <div className="container" style={{ paddingTop: '14px' }}>
        {/* KPI Stat Cards Header - 2 Cards Only (No Phép Còn Lại) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: '14px' }}>
          <div className="card" style={{ padding: '12px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>⏳ ĐƠN CHỜ DUYỆT</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--yellow)' }}>{pendingCount}</div>
          </div>
          <div className="card" style={{ padding: '12px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>✅ ĐÃ DUYỆT</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--green)' }}>{approvedCount}</div>
          </div>
        </div>

        {/* Manager/Leader Segmented Navigation */}
        {isManager ? (
          <div style={{ background: 'var(--bg-raised)', padding: '4px', borderRadius: '12px', border: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginBottom: '14px' }}>
            <button
              onClick={() => { setTab('mine'); setStatusFilter('all'); }}
              className="btn"
              style={{
                background: tab === 'mine' ? 'var(--bg-card)' : 'transparent',
                color: tab === 'mine' ? 'var(--text)' : 'var(--text-secondary)',
                boxShadow: tab === 'mine' ? 'var(--shadow-xs)' : 'none',
                borderRadius: '8px',
                padding: '8px',
                fontSize: '13px',
                fontWeight: tab === 'mine' ? 700 : 500,
                border: 'none',
              }}
            >
              📝 Đơn của tôi ({mine.length})
            </button>
            <button
              onClick={() => { setTab('pending'); setStatusFilter('all'); }}
              className="btn"
              style={{
                background: tab === 'pending' ? 'var(--bg-card)' : 'transparent',
                color: tab === 'pending' ? 'var(--primary)' : 'var(--text-secondary)',
                boxShadow: tab === 'pending' ? 'var(--shadow-xs)' : 'none',
                borderRadius: '8px',
                padding: '8px',
                fontSize: '13px',
                fontWeight: tab === 'pending' ? 700 : 500,
                border: 'none',
              }}
            >
              🛡️ Đơn cần duyệt ({pending.length})
            </button>
          </div>
        ) : null}

        {/* Clean Status Filter Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)' }}>
            {tab === 'mine' ? 'Danh sách đơn của tôi' : 'Danh sách đơn chờ phê duyệt'} ({list.length})
          </div>
          <select
            className="form-input"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{ width: 'auto', padding: '4px 10px', fontSize: '12px', borderRadius: '8px' }}
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="pending">⏳ Chờ duyệt</option>
            <option value="approved">✅ Đã duyệt</option>
            <option value="rejected">❌ Từ chối</option>
          </select>
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
              const initials = (r.user_name || user?.full_name || '?').split(' ').slice(-2).map(n => n[0]).join('').toUpperCase();

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
                  {/* Top Row: Type Tag + Status Badge */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {tab === 'pending' && (
                        <div className="avatar" style={{ width: '28px', height: '28px', fontSize: '11px', background: 'var(--primary)' }}>
                          {initials}
                        </div>
                      )}
                      <div>
                        <span style={{
                          fontSize: '12px', fontWeight: 700, color: typeCfg.color, background: typeCfg.bg,
                          padding: '3px 8px', borderRadius: '6px', border: `1px solid ${typeCfg.color}22`
                        }}>
                          {typeCfg.label}
                        </span>
                        {r.user_name && tab === 'pending' && (
                          <span style={{ fontSize: '12px', fontWeight: 600, marginLeft: '8px' }}>{r.user_name}</span>
                        )}
                      </div>
                    </div>

                    <span className={`badge ${statusCfg.cls}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      {statusCfg.icon} {statusCfg.label}
                    </span>
                  </div>

                  {/* Reason Details */}
                  <div style={{ fontSize: '13px', color: 'var(--text)', fontWeight: 500, margin: '6px 0 8px 0', lineHeight: 1.5 }}>
                    "{r.reason}"
                  </div>

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
                  {tab === 'pending' && isManager && r.status === 'pending' && (
                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border-muted)' }}>
                      <button
                        onClick={() => handleApprove(r._id)}
                        className="btn btn--primary"
                        style={{ flex: 1, fontSize: '12px', padding: '7px 12px', fontWeight: 700 }}
                      >
                        <Check size={14} /> Duyệt đơn
                      </button>
                      <button
                        onClick={() => { setRejectTarget(r); setRejectNote(''); }}
                        className="btn btn--ghost"
                        style={{ flex: 1, fontSize: '12px', padding: '7px 12px', color: 'var(--red)', fontWeight: 600 }}
                      >
                        <X size={14} /> Từ chối
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modern Create Request Sheet Modal */}
      {/* Create Request Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-sheet animate-slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px', margin: '0 auto' }}>
            <div className="modal-sheet__handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={20} color="var(--primary)" />
                <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Tạo đơn từ mới</h3>
              </div>
              <button onClick={() => setShowForm(false)} className="btn btn--ghost" style={{ padding: '4px 8px' }}>
                <X size={18} />
              </button>
            </div>

            <div className="form-group">
              <label className="form-label">Loại đơn *</label>
              <select className="form-input" value={type} onChange={e => setType(e.target.value)}>
                {Object.entries(TYPE_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>

            {/* Dynamic Impact Preview Banner */}
            <div style={{
              fontSize: '11px', color: 'var(--primary)', background: 'var(--primary-soft)',
              padding: '8px 12px', borderRadius: '8px', marginBottom: '12px', lineHeight: 1.4,
              border: '1px solid var(--primary-soft)'
            }}>
              {getWorkflowImpactText(type)}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div className="form-group">
                <label className="form-label">Từ ngày *</label>
                <input
                  type="date"
                  className="form-input"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  onClick={e => e.target.showPicker && e.target.showPicker()}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Đến ngày</label>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div className="form-group">
                  <label className="form-label">Từ giờ</label>
                  <input
                    type="time"
                    className="form-input"
                    value={startTime}
                    onChange={e => setStartTime(e.target.value)}
                    onClick={e => e.target.showPicker && e.target.showPicker()}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Đến giờ</label>
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
              <div className="form-group">
                <label className="form-label">Chọn dự án / công trình (Nếu có)</label>
                <select className="form-input" value={selectedProject} onChange={e => setSelectedProject(e.target.value)}>
                  <option value="">-- Không chọn dự án --</option>
                  {projects.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                </select>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Lý do cụ thể *</label>
              <textarea
                className="form-input"
                rows={3}
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Nhập lý do xin phép hoặc giải trình..."
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
              <button onClick={() => setShowForm(false)} className="btn btn--ghost btn--full">Hủy</button>
              <button onClick={handleCreateRequest} disabled={submitting} className="btn btn--primary btn--full">
                {submitting ? <span className="spinner" /> : 'Gửi đơn xác nhận'}
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
    </div>
  );
}
