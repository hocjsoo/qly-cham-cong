// src/pages/RequestsPage.jsx
// Đơn từ — Form tạo đơn với loại đơn "Khác", dự án & validation

import { useState, useEffect } from 'react';
import { Plus, X, Check, FileText, AlertCircle, Clock, CheckCircle2, XCircle, Building } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import useAuthStore from '../stores/authStore';
import ThemeToggle from '../components/ThemeToggle';

const TYPE_LABELS = {
  annual_leave:  { label: '🏖️ Nghỉ phép', color: 'var(--blue)' },
  sick_leave:    { label: '🤒 Nghỉ ốm', color: 'var(--red)' },
  late:          { label: '⏰ Đi muộn', color: 'var(--yellow)' },
  early_leave:   { label: '🏃 Về sớm', color: 'var(--yellow)' },
  overtime:      { label: '⏱️ Tăng ca', color: 'var(--primary)' },
  business_trip: { label: '💼 Công tác', color: 'var(--green)' },
  other:         { label: '📌 Lý do khác', color: 'var(--primary)' },
};

const STATUS_CONFIG = {
  pending:  { label: 'Chờ duyệt', cls: 'badge--warning', icon: <Clock size={11} /> },
  approved: { label: 'Đã duyệt',  cls: 'badge--success', icon: <CheckCircle2 size={11} /> },
  rejected: { label: 'Từ chối',   cls: 'badge--danger',  icon: <XCircle size={11} /> },
};

const formatDate = (iso) => {
  if (!iso) return '';
  return new Date(iso + 'T00:00:00').toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export default function RequestsPage() {
  const { user } = useAuthStore();
  const isManager = user?.role === 'admin' || user?.role === 'manager';
  const [tab, setTab] = useState('mine');
  const [mine, setMine] = useState([]);
  const [pending, setPending] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Reject modal state
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectNote, setRejectNote] = useState('');
  const [rejecting, setRejecting] = useState(false);

  // Form state
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
      toast.error('Vui lòng chọn từ ngày');
      return;
    }
    if (!reason.trim()) {
      toast.error('Vui lòng nhập lý do tạo đơn');
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
      toast.success('Đã duyệt đơn! ✅');
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

  const list = tab === 'mine' ? mine : pending;

  return (
    <div className="page">
      <div className="header">
        <div className="header__inner">
          <div className="header__title">Đơn từ</div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button onClick={() => setShowForm(true)} className="btn btn--primary" style={{ padding: '6px 12px', fontSize: '13px' }}>
              <Plus size={14} /> Tạo đơn
            </button>
            <ThemeToggle />
          </div>
        </div>
      </div>

      <div className="container" style={{ paddingTop: '14px' }}>
        {/* Tabs */}
        {isManager && (
          <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
            <button onClick={() => setTab('mine')} className={`chip${tab === 'mine' ? ' active' : ''}`}>
              Đơn của tôi ({mine.length})
            </button>
            <button onClick={() => setTab('pending')} className={`chip${tab === 'pending' ? ' active' : ''}`}>
              Cần duyệt ({pending.length})
            </button>
          </div>
        )}

        {/* Requests List */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[1, 2, 3].map(i => <div key={i} className="skeleton-card" style={{ height: '72px', borderRadius: '12px' }} />)}
          </div>
        ) : list.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">📄</div>
            <div className="empty-state__title">Không có đơn từ</div>
            <div className="empty-state__desc">Bấm "Tạo đơn" để xin nghỉ phép, giải trình đi muộn hoặc công tác</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {list.map(r => {
              const typeCfg = TYPE_LABELS[r.type] || TYPE_LABELS.other;
              const statusCfg = STATUS_CONFIG[r.status] || STATUS_CONFIG.pending;

              return (
                <div key={r._id} className="card animate-fade-in" style={{ padding: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
                    <div>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: typeCfg.color, background: 'var(--bg)', padding: '2px 8px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                        {typeCfg.label}
                      </span>
                      {r.user_name && <div style={{ fontSize: '13px', fontWeight: 600, marginTop: '4px' }}>{r.user_name}</div>}
                    </div>
                    <span className={`badge ${statusCfg.cls}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      {statusCfg.icon} {statusCfg.label}
                    </span>
                  </div>

                  <div style={{ fontSize: '13px', color: 'var(--text)', marginBottom: '6px' }}>
                    {r.reason}
                  </div>

                  <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                    <span>📅 {formatDate(r.start_date)} {r.end_date && r.end_date !== r.start_date ? `→ ${formatDate(r.end_date)}` : ''}</span>
                    {r.start_time && <span>⏰ {r.start_time} - {r.end_time || '...'}</span>}
                    {r.project_name && <span>🏗️ {r.project_name}</span>}
                  </div>

                  {r.reviewer_note && (
                    <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text-secondary)', background: 'var(--bg-raised)', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                      <strong>Ghi chú người duyệt:</strong> {r.reviewer_note}
                    </div>
                  )}

                  {/* Actions for Managers */}
                  {tab === 'pending' && isManager && r.status === 'pending' && (
                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px', borderTop: '1px solid var(--border-muted)', paddingTop: '10px' }}>
                      <button onClick={() => handleApprove(r._id)} className="btn btn--primary" style={{ flex: 1, fontSize: '12px', padding: '6px' }}>
                        <Check size={14} /> Duyệt đơn
                      </button>
                      <button onClick={() => { setRejectTarget(r); setRejectNote(''); }} className="btn btn--ghost" style={{ flex: 1, fontSize: '12px', padding: '6px', color: 'var(--red)' }}>
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

      {/* Create Request Modal */}
      {showForm && (
        <div className="modal-overlay">
          <div className="modal-sheet animate-slide-up" style={{ maxWidth: '440px', margin: '0 auto' }}>
            <div className="modal-sheet__handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Tạo đơn mới</h3>
              <button onClick={() => setShowForm(false)} className="btn btn--ghost" style={{ padding: '4px 8px' }}><X size={18} /></button>
            </div>

            <div className="form-group">
              <label className="form-label">Loại đơn *</label>
              <select className="form-input" value={type} onChange={e => setType(e.target.value)}>
                <option value="annual_leave">🏖️ Nghỉ phép năm</option>
                <option value="sick_leave">🤒 Nghỉ ốm</option>
                <option value="late">⏰ Giải trình đi muộn</option>
                <option value="early_leave">🏃 Xin về sớm</option>
                <option value="overtime">⏱️ Đăng ký Tăng ca (OT)</option>
                <option value="business_trip">💼 Đăng ký Đi công tác / WFH</option>
                <option value="other">📌 Lý do khác</option>
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div className="form-group">
                <label className="form-label">Từ ngày *</label>
                <input type="date" className="form-input" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Đến ngày</label>
                <input type="date" className="form-input" value={endDate} onChange={e => setEndDate(e.target.value)} />
              </div>
            </div>

            {['late', 'early_leave', 'overtime'].includes(type) && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div className="form-group">
                  <label className="form-label">Từ giờ</label>
                  <input type="time" className="form-input" value={startTime} onChange={e => setStartTime(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Đến giờ</label>
                  <input type="time" className="form-input" value={endTime} onChange={e => setEndTime(e.target.value)} />
                </div>
              </div>
            )}

            {type === 'business_trip' && (
              <div className="form-group">
                <label className="form-label">Dự án công tác (Nếu có)</label>
                <select className="form-input" value={selectedProject} onChange={e => setSelectedProject(e.target.value)}>
                  <option value="">-- Chọn dự án --</option>
                  {projects.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                </select>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Lý do cụ thể *</label>
              <textarea className="form-input" rows={3} value={reason} onChange={e => setReason(e.target.value)} placeholder="Nhập lý do chi tiết..." />
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
              <button onClick={() => setShowForm(false)} className="btn btn--ghost btn--full">Hủy</button>
              <button onClick={handleCreateRequest} disabled={submitting} className="btn btn--primary btn--full">
                {submitting ? <span className="spinner" /> : 'Gửi đơn'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Reason Modal */}
      {rejectTarget && (
        <div className="modal-overlay">
          <div className="modal-sheet animate-slide-up" style={{ maxWidth: '380px', margin: '0 auto' }}>
            <div className="modal-sheet__handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--red)' }}>Từ chối đơn</h3>
              <button onClick={() => setRejectTarget(null)} className="btn btn--ghost" style={{ padding: '4px 8px' }}><X size={18} /></button>
            </div>

            <div className="form-group">
              <label className="form-label">Lý do từ chối *</label>
              <textarea className="form-input" rows={3} value={rejectNote} onChange={e => setRejectNote(e.target.value)} placeholder="Nhập lý do từ chối để nhân viên biết..." />
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setRejectTarget(null)} className="btn btn--ghost btn--full">Hủy</button>
              <button onClick={handleConfirmReject} disabled={rejecting} className="btn btn--full" style={{ background: 'var(--red)', color: '#fff', border: 'none' }}>
                {rejecting ? <span className="spinner" /> : 'Xác nhận từ chối'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
