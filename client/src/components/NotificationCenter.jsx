// client/src/components/NotificationCenter.jsx
// Notification Center Engine — Responsive Drawer (Fixed Mobile Bottom Sheet / Desktop Floating Modal)

import { useState, useEffect, useRef } from 'react';
import { Bell, CheckCheck, X, Megaphone, CheckCircle2, Clock, AlertTriangle, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import useAuthStore from '../stores/authStore';

const TYPE_ICONS = {
  system: <AlertTriangle size={16} color="var(--yellow)" />,
  request: <Clock size={16} color="var(--primary)" />,
  attendance: <CheckCircle2 size={16} color="var(--green)" />,
  announcement: <Megaphone size={16} color="var(--purple, #8b5cf6)" />,
};

export default function NotificationCenter() {
  const { user } = useAuthStore();
  const isAdminOrManager = ['admin', 'manager'].includes(user?.role);

  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filterType, setFilterType] = useState('all'); // 'all' | 'announcement' | 'request'
  const dropdownRef = useRef(null);

  // Admin Broadcast / Holiday Modal State
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastForm, setBroadcastForm] = useState({
    title: '',
    message: '',
    is_holiday: false,
    holiday_date: '',
    holiday_end_date: '',
  });
  const [submittingBroadcast, setSubmittingBroadcast] = useState(false);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 20000); // Polling 20s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchNotifications = async () => {
    try {
      const { data } = await api.get('/notifications');
      setNotifications(data.notifications || []);
      setUnreadCount(data.unread_count || 0);
    } catch (err) {
      // Silent error
    }
  };

  const handleMarkRead = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {
      // Silent
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.post('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
      toast.success('Đã đánh dấu tất cả thông báo là đã đọc');
    } catch {
      toast.error('Lỗi cập nhật thông báo');
    }
  };

  const handleSendBroadcast = async () => {
    if (!broadcastForm.title || !broadcastForm.message) {
      toast.error('Vui lòng nhập tiêu đề và nội dung thông báo');
      return;
    }

    setSubmittingBroadcast(true);
    try {
      if (broadcastForm.is_holiday) {
        await api.post('/holidays', {
          name: broadcastForm.title,
          date: broadcastForm.holiday_date || new Date().toISOString().slice(0, 10),
          end_date: broadcastForm.holiday_end_date || broadcastForm.holiday_date,
          note: broadcastForm.message,
        });
        toast.success('Đã công bố ngày nghỉ lễ & phát thông báo toàn công ty! 🎉');
      } else {
        await api.post('/notifications/broadcast', {
          title: broadcastForm.title,
          message: broadcastForm.message,
        });
        toast.success('Đã phát thông báo toàn công ty! 📢');
      }

      setShowBroadcastModal(false);
      setBroadcastForm({ title: '', message: '', is_holiday: false, holiday_date: '', holiday_end_date: '' });
      fetchNotifications();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Lỗi phát thông báo');
    } finally {
      setSubmittingBroadcast(false);
    }
  };

  const filteredNotifications = notifications.filter(n => {
    if (filterType === 'all') return true;
    return n.type === filterType;
  });

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setOpen(!open)}
        className="theme-toggle-btn"
        style={{ position: 'relative', width: '36px', height: '36px' }}
        title="Thông báo"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: '1px', right: '1px',
            background: 'var(--red)', color: '#fff',
            borderRadius: '10px', fontSize: '10px', fontWeight: 800,
            padding: '1px 5px', lineHeight: 1.2, boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Drawer (Fixed Position for perfect alignment on Desktop & Mobile) */}
      {open && (
        <div className="notification-drawer-container" style={{
          position: 'fixed',
          zIndex: 9999,
        }}>
          {/* Overlay for mobile tap-outside */}
          <div
            onClick={() => setOpen(false)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
              backdropFilter: 'blur(2px)', zIndex: 9998
            }}
          />

          {/* Drawer Sheet */}
          <div className="card animate-slide-up" style={{
            position: 'fixed',
            zIndex: 9999,
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-md)',
            display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg-raised)'
            }}>
              <div style={{ fontWeight: 700, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>🔔 Trung tâm thông báo</span>
                {unreadCount > 0 && (
                  <span className="badge badge--warning" style={{ fontSize: '10px' }}>{unreadCount} mới</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}
                  >
                    <CheckCheck size={14} /> Đọc hết
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Admin Announcement Trigger Button */}
            {isAdminOrManager && (
              <div style={{ padding: '8px 12px', background: 'var(--primary-soft)', borderBottom: '1px solid var(--border)' }}>
                <button
                  onClick={() => { setOpen(false); setShowBroadcastModal(true); }}
                  className="btn btn--primary btn--full"
                  style={{ fontSize: '12px', padding: '7px 10px', gap: '6px', whiteSpace: 'nowrap' }}
                >
                  <Megaphone size={14} /> Đăng Thông Báo / Lịch Nghỉ Lễ
                </button>
              </div>
            )}

            {/* Filter Chips */}
            <div style={{ display: 'flex', gap: '4px', padding: '8px 12px', borderBottom: '1px solid var(--border-muted)', background: 'var(--bg-card)' }}>
              {[
                { key: 'all', label: 'Tất cả' },
                { key: 'announcement', label: '📢 Lễ / Thông báo' },
                { key: 'request', label: '📝 Đơn từ' },
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setFilterType(f.key)}
                  className={`chip${filterType === f.key ? ' active' : ''}`}
                  style={{ fontSize: '11px', padding: '3px 8px' }}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Body Notification Cards List */}
            <div style={{ overflowY: 'auto', flex: 1, padding: '6px', maxHeight: '360px' }}>
              {filteredNotifications.length === 0 ? (
                <div style={{ padding: '32px 12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                  ⚪ Chưa có thông báo trong mục này
                </div>
              ) : (
                filteredNotifications.map(n => (
                  <div
                    key={n._id}
                    onClick={() => handleMarkRead(n._id)}
                    style={{
                      padding: '10px 12px', borderRadius: '8px', marginBottom: '4px',
                      background: n.is_read ? 'transparent' : 'var(--primary-soft)',
                      borderLeft: n.is_read ? '3px solid transparent' : '3px solid var(--primary)',
                      cursor: 'pointer', transition: 'background 0.15s'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'start', gap: '10px' }}>
                      <div style={{ marginTop: '2px', flexShrink: 0 }}>
                        {TYPE_ICONS[n.type] || TYPE_ICONS.system}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '12px', fontWeight: n.is_read ? 600 : 700, color: 'var(--text)', lineHeight: 1.3 }}>
                          {n.title}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '3px', lineHeight: 1.4 }}>
                          {n.message}
                        </div>
                        <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '4px' }}>
                          {new Date(n.created_at).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Admin Broadcast / Holiday Modal */}
      {showBroadcastModal && (
        <div className="modal-overlay">
          <div className="modal-sheet animate-slide-up" style={{ maxWidth: '420px', margin: '0 auto' }}>
            <div className="modal-sheet__handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Megaphone size={20} color="var(--primary)" />
                <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Đăng thông báo toàn công ty</h3>
              </div>
              <button onClick={() => setShowBroadcastModal(false)} className="btn btn--ghost" style={{ padding: '4px 8px' }}><X size={18} /></button>
            </div>

            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={broadcastForm.is_holiday}
                  onChange={e => setBroadcastForm({ ...broadcastForm, is_holiday: e.target.checked })}
                />
                <span style={{ fontWeight: 700, color: 'var(--primary)' }}>🏖️ Đây là thông báo Lịch Nghỉ Lễ công ty</span>
              </label>
            </div>

            <div className="form-group">
              <label className="form-label">Tiêu đề thông báo *</label>
              <input
                type="text"
                className="form-input"
                value={broadcastForm.title}
                onChange={e => setBroadcastForm({ ...broadcastForm, title: e.target.value })}
                placeholder={broadcastForm.is_holiday ? "VD: Nghỉ lễ Quốc Khánh 2/9" : "VD: Thông báo họp toàn công ty"}
              />
            </div>

            {broadcastForm.is_holiday && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Từ ngày nghỉ *</label>
                  <input
                    type="date"
                    className="form-input"
                    value={broadcastForm.holiday_date}
                    onChange={e => setBroadcastForm({ ...broadcastForm, holiday_date: e.target.value })}
                    onClick={e => e.target.showPicker && e.target.showPicker()}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Đến ngày nghỉ</label>
                  <input
                    type="date"
                    className="form-input"
                    value={broadcastForm.holiday_end_date}
                    onChange={e => setBroadcastForm({ ...broadcastForm, holiday_end_date: e.target.value })}
                    onClick={e => e.target.showPicker && e.target.showPicker()}
                  />
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Nội dung thông báo *</label>
              <textarea
                className="form-input"
                rows={3}
                value={broadcastForm.message}
                onChange={e => setBroadcastForm({ ...broadcastForm, message: e.target.value })}
                placeholder="Nhập nội dung chi tiết gửi đến toàn bộ nhân viên..."
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
              <button onClick={() => setShowBroadcastModal(false)} className="btn btn--ghost btn--full">Hủy</button>
              <button onClick={handleSendBroadcast} disabled={submittingBroadcast} className="btn btn--primary btn--full">
                {submittingBroadcast ? <span className="spinner" /> : <><Send size={14} /> Phát thông báo</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
