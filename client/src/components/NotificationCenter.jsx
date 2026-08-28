import { createPortal } from "react-dom";
// client/src/components/NotificationCenter.jsx
// Facebook-Style Notification Center Engine — Floating Dropdown & Bottom Sheet

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, X, Megaphone, AlertTriangle, Send, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import useAuthStore from '../stores/authStore';

const TYPE_ICONS = {
  system: { icon: '⚡', bg: '#eab308' },
  request: { icon: '📝', bg: '#2563eb' },
  attendance: { icon: '✅', bg: '#16a34a' },
  announcement: { icon: '📢', bg: '#8b5cf6' },
};

function formatTimeAgo(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  const diffSec = Math.floor((new Date() - date) / 1000);
  if (diffSec < 60) return 'Vừa xong';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} phút`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} giờ`;
  if (diffSec < 172800) return 'Hôm qua';
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
}

export default function NotificationCenter() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const isAdminOrManager = ['admin', 'leader', 'manager'].includes(user?.role);

  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filterType, setFilterType] = useState('all'); // 'all' | 'unread' | 'announcement' | 'request'
  const [selectedNotifForDetail, setSelectedNotifForDetail] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const dropdownRef = useRef(null);
  const popoverRef = useRef(null);

  // Admin Broadcast / Holiday Modal State
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastForm, setBroadcastForm] = useState({
    title: '',
    message: '',
    is_holiday: false,
    holiday_date: '',
    holiday_end_date: '',
    duration_days: '7',
  });
  const [submittingBroadcast, setSubmittingBroadcast] = useState(false);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 20000); // Polling 20s
    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = async () => {
    try {
      const { data } = await api.get('/notifications');
      setNotifications(data.notifications || []);
      setUnreadCount(data.unread_count || 0);
    } catch {
      // Silent error
    }
  };

  const handleItemClick = async (notif) => {
    try {
      if (!notif.is_read) {
        await api.put(`/notifications/${notif._id}/read`);
        setNotifications(prev => prev.map(n => n._id === notif._id ? { ...n, is_read: true } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch {
      // Silent
    }

    let detailNotif = { ...notif };

    // Auto-enrich holiday notification with detailed letter note if not already full
    if (notif.type === 'announcement' && notif.title && (notif.title.includes('NGHỈ LỄ') || notif.title.includes('THÔNG BÁO'))) {
      try {
        const { data: holidays } = await api.get('/holidays');
        if (Array.isArray(holidays)) {
          const cleanTitle = notif.title.replace(/^📢\s*(THÔNG BÁO|CẬP NHẬT LỊCH)?\s*(NGHỈ LỄ:?)?\s*/i, '').trim().toUpperCase();
          const matched = holidays.find(h => 
            h.name.toUpperCase().includes(cleanTitle) ||
            cleanTitle.includes(h.name.toUpperCase()) ||
            (notif.message && notif.message.includes(h.name))
          );
          if (matched && matched.note && matched.note.trim()) {
            detailNotif.message = matched.note.trim();
          }
        }
      } catch {
        // Fallback to original message
      }
    }

    setOpen(false);
    setSelectedNotifForDetail(detailNotif);
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

  const handleDeleteNotification = async (notifId) => {
    try {
      await api.delete(`/notifications/${notifId}`);
      setNotifications(prev => prev.filter(n => n._id !== notifId));
      toast.success('Đã xóa thông báo!');
    } catch {
      toast.error('Lỗi xóa thông báo');
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
          duration_days: Number(broadcastForm.duration_days || 7),
        });
        toast.success('Đã phát thông báo toàn công ty! 📢');
      }

      setShowBroadcastModal(false);
      setBroadcastForm({ title: '', message: '', is_holiday: false, holiday_date: '', holiday_end_date: '', duration_days: '7' });
      fetchNotifications();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Lỗi phát thông báo');
    } finally {
      setSubmittingBroadcast(false);
    }
  };

  const filteredNotifications = notifications.filter(n => {
    if (filterType === 'all') return true;
    if (filterType === 'unread') return !n.is_read;
    return n.type === filterType;
  });

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        onClick={() => setOpen(!open)}
        className="theme-toggle-btn"
        style={{
          position: 'relative', width: '40px', height: '40px',
          borderRadius: '50%', background: open ? 'var(--primary-soft)' : 'var(--bg-raised)',
          transition: 'all 0.15s ease-in-out'
        }}
        title="Thông báo"
      >
        <Bell size={20} color={open ? 'var(--primary)' : 'var(--text)'} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: '0px', right: '0px',
            background: 'var(--red)', color: '#fff',
            borderRadius: '10px', fontSize: '10px', fontWeight: 800,
            padding: '1px 5px', lineHeight: 1.2, boxShadow: '0 2px 6px rgba(224,36,36,0.4)',
            border: '2px solid var(--bg-card)'
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Facebook-Style Notification Popover & Bottom Sheet */}
      {open && typeof document !== "undefined" && createPortal(
        <div className="notification-popover-overlay" onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 999990, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "flex-start", justifyContent: "flex-end", padding: "64px 16px 16px", boxSizing: "border-box" }}>
          {/* Facebook-Style Floating Box */}
          <div
            ref={popoverRef}
            className="card fb-popover-card animate-slide-up"
            onClick={e => e.stopPropagation()}
            style={{
              display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden',
            }}
          >
            {/* Mobile Sheet Drag Handle */}
            <div className="modal-sheet__handle" style={{ margin: '8px auto 2px' }} />

            {/* Header: Title + Options (Like Facebook) */}
            <div style={{
              padding: '14px 16px 8px 16px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.3px' }}>
                Thông báo
              </div>

              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="btn btn--ghost"
                    style={{ padding: '6px 10px', fontSize: '12px', fontWeight: 600, color: 'var(--primary)' }}
                    title="Đánh dấu tất cả là đã đọc"
                  >
                    <CheckCheck size={16} /> Đọc hết
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="btn btn--ghost"
                  style={{ width: '32px', height: '32px', borderRadius: '50%', padding: 0 }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Admin Announcement Trigger Button */}
            {isAdminOrManager && (
              <div style={{ padding: '4px 16px 8px 16px' }}>
                <button
                  onClick={() => { setOpen(false); setShowBroadcastModal(true); }}
                  className="btn btn--primary btn--full"
                  style={{ fontSize: '12px', padding: '7px 12px', gap: '6px', borderRadius: '10px' }}
                >
                  <Megaphone size={15} /> Đăng Thông Báo / Lịch Nghỉ Lễ
                </button>
              </div>
            )}

            {/* Facebook-Style Filter Chips */}
            <div style={{
              display: 'flex', gap: '6px', padding: '4px 16px 10px 16px',
              borderBottom: '1px solid var(--border-muted)', background: 'var(--bg-card)'
            }}>
              {[
                { key: 'all', label: 'Tất cả' },
                { key: 'unread', label: `Chưa đọc${unreadCount > 0 ? ` (${unreadCount})` : ''}` },
                { key: 'announcement', label: '📢 Lễ & Sự kiện' },
                { key: 'request', label: '📝 Đơn từ' },
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setFilterType(f.key)}
                  className={`chip${filterType === f.key ? ' active' : ''}`}
                  style={{
                    fontSize: '12px', padding: '5px 12px', borderRadius: '16px',
                    fontWeight: filterType === f.key ? 700 : 600
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Notification Item List (Facebook Avatar + Blue Dot Style) */}
            <div className="fb-notif-scroll" style={{ overflowY: 'auto', flex: 1, padding: '4px 8px', maxHeight: '380px' }}>
              {filteredNotifications.length === 0 ? (
                <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                  ⚪ Không có thông báo trong mục này
                </div>
              ) : (
                filteredNotifications.map(n => {
                  const typeMeta = TYPE_ICONS[n.type] || TYPE_ICONS.system;

                  return (
                    <div
                      key={n._id}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleItemClick(n);
                      }}
                      className={`fb-notif-item${!n.is_read ? ' unread' : ''}`}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '12px',
                        padding: '10px 12px', marginBottom: '2px',
                        cursor: 'pointer', position: 'relative'
                      }}
                    >
                      {/* Avatar Circle with Badge Overlay */}
                      <div style={{ position: 'relative', width: '44px', height: '44px', flexShrink: 0 }}>
                        <div style={{
                          width: '44px', height: '44px', borderRadius: '50%',
                          background: 'var(--bg-raised)', border: '1px solid var(--border)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '20px'
                        }}>
                          {typeMeta.icon}
                        </div>
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: '13px', fontWeight: n.is_read ? 700 : 800,
                          color: 'var(--text)', lineHeight: 1.35
                        }}>
                          {n.title}
                        </div>
                        <div style={{
                          fontSize: '12px', color: 'var(--text-secondary)',
                          marginTop: '2px', lineHeight: 1.35, display: '-webkit-box',
                          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
                        }}>
                          {n.message}
                        </div>
                        <div style={{
                          fontSize: '11px', fontWeight: 600,
                          color: 'var(--primary)', marginTop: '3px'
                        }}>
                          {formatTimeAgo(n.created_at)}
                        </div>
                      </div>

                      {/* Blue Unread Dot (Like Facebook) */}
                      {!n.is_read && (
                        <div style={{
                          width: '12px', height: '12px', borderRadius: '50%',
                          background: 'var(--primary, #2e89ff)', flexShrink: 0,
                          boxShadow: '0 0 6px rgba(46,137,255,0.6)'
                        }} />
                      )}

                      {/* Admin Delete Notification Button */}
                      {isAdminOrManager && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteId(n._id);
                          }}
                          style={{
                            background: 'none', border: 'none', color: 'var(--red)',
                            cursor: 'pointer', padding: '4px', opacity: 0.7,
                            borderRadius: '6px', flexShrink: 0, display: 'flex', alignItems: 'center'
                          }}
                          title="Xóa thông báo này"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border-muted)', background: 'var(--bg-raised)' }}>
                <button
                  onClick={handleMarkAllRead}
                  className="btn btn--ghost btn--full"
                  style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', padding: '6px' }}
                >
                  Xem tất cả & Đánh dấu đã đọc
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Admin Broadcast / Holiday Modal (Facebook Style Modal Sheet) */}
      {showBroadcastModal && typeof document !== "undefined" && createPortal(
        <div className="modal-overlay">
          <div className="modal-sheet animate-slide-up" style={{ maxWidth: '440px', margin: '0 auto', borderRadius: '16px' }}>
            <div className="modal-sheet__handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Megaphone size={20} color="var(--primary)" />
                <h3 style={{ fontSize: '17px', fontWeight: 800 }}>Tạo Thông Báo / Lịch Nghỉ Lễ</h3>
              </div>
              <button onClick={() => setShowBroadcastModal(false)} className="btn btn--ghost" style={{ padding: '4px 8px' }}><X size={18} /></button>
            </div>

            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={broadcastForm.is_holiday}
                  onChange={e => setBroadcastForm({ ...broadcastForm, is_holiday: e.target.checked })}
                />
                <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '13px' }}>🏖️ Thông báo Lịch Nghỉ Lễ công ty</span>
              </label>
            </div>

            <div className="form-group">
              <label className="form-label">Tiêu đề *</label>
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
              <label className="form-label">Nội dung chi tiết *</label>
              <textarea
                className="form-input"
                rows={3}
                value={broadcastForm.message}
                onChange={e => setBroadcastForm({ ...broadcastForm, message: e.target.value })}
                placeholder="Nhập nội dung gửi đến toàn bộ cán bộ nhân viên..."
              />
            </div>

            {!broadcastForm.is_holiday && (
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label">⏳ Thời gian gỡ thông báo tự động</label>
                <select
                  className="form-select"
                  value={broadcastForm.duration_days}
                  onChange={e => setBroadcastForm({ ...broadcastForm, duration_days: e.target.value })}
                >
                  <option value="3">3 ngày (Tự động gỡ sau 3 ngày)</option>
                  <option value="7">7 ngày (Tự động gỡ sau 1 tuần - Mặc định)</option>
                  <option value="14">14 ngày (Tự động gỡ sau 2 tuần)</option>
                  <option value="30">30 ngày (Tự động gỡ sau 1 tháng)</option>
                  <option value="0">Vô thời hạn (Hiển thị đến khi Admin gỡ thủ công)</option>
                </select>
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <button onClick={() => setShowBroadcastModal(false)} className="btn btn--ghost btn--full">Hủy</button>
              <button onClick={handleSendBroadcast} disabled={submittingBroadcast} className="btn btn--primary btn--full">
                {submittingBroadcast ? <span className="spinner" /> : <><Send size={14} /> Phát thông báo</>}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Notification Detail Modal Sheet — Redesigned Spacious & Premium */}
      {selectedNotifForDetail && typeof document !== "undefined" && createPortal(
        <div className="modal-overlay" style={{ zIndex: 999999, padding: '16px' }} onClick={() => setSelectedNotifForDetail(null)}>
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

            {/* Modal Header */}
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
                    {selectedNotifForDetail.type === 'announcement' ? '📢 Thông Báo Công Ty' : '🔔 Chi Tiết Thông Báo'}
                  </div>
                  <h3 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text)', margin: 0, lineHeight: 1.2 }}>
                    Nội dung thông báo
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setSelectedNotifForDetail(null)}
                className="btn btn--ghost"
                style={{ width: '36px', height: '36px', borderRadius: '50%', padding: 0 }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Title & Metadata */}
            <div style={{
              background: 'var(--primary-soft)', padding: '12px 16px', borderRadius: '12px',
              border: '1px solid rgba(99, 102, 241, 0.2)', marginBottom: '16px'
            }}>
              <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)', lineHeight: 1.4, marginBottom: '6px' }}>
                {selectedNotifForDetail.title}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                <span>📅 {selectedNotifForDetail.created_at ? new Date(selectedNotifForDetail.created_at).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Hôm nay'}</span>
                <span>•</span>
                <span>👤 Ban Giám Đốc</span>
                <span className="badge badge--info" style={{ fontSize: '10px', padding: '2px 8px' }}>Chính thức</span>
              </div>
            </div>

            {/* Message Body Content */}
            <div style={{
              background: 'var(--bg-raised)', padding: '18px 20px', borderRadius: '14px',
              border: '1px solid var(--border)', fontSize: '14px', color: 'var(--text)',
              lineHeight: 1.75, whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginBottom: '22px',
              maxHeight: '440px', overflowY: 'auto'
            }}>
              {selectedNotifForDetail.message}
            </div>

            {/* Footer Buttons */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setSelectedNotifForDetail(null)}
                className="btn btn--ghost"
                style={{ flex: 1, padding: '10px', fontSize: '13px', fontWeight: 700 }}
              >
                Đóng
              </button>
              {selectedNotifForDetail.link ? (
                <button
                  onClick={() => {
                    const link = selectedNotifForDetail.link;
                    setSelectedNotifForDetail(null);
                    navigate(link);
                  }}
                  className="btn btn--primary"
                  style={{ flex: 1.5, padding: '10px', fontSize: '13px', fontWeight: 700 }}
                >
                  Mở trang liên quan →
                </button>
              ) : (
                <button
                  onClick={() => setSelectedNotifForDetail(null)}
                  className="btn btn--primary"
                  style={{ flex: 1.5, padding: '10px', fontSize: '13px', fontWeight: 700 }}
                >
                  Đã ghi nhận ✓
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Confirmation Modal for Delete Notification */}
      {confirmDeleteId && typeof document !== "undefined" && createPortal(
        <div className="modal-overlay" style={{ zIndex: 999999 }} onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }}>
          <div className="modal-sheet animate-slide-up" style={{ maxWidth: '340px', margin: '0 auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <AlertTriangle size={22} color="var(--red)" />
              <strong style={{ fontSize: '15px' }}>Xác nhận xóa thông báo</strong>
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.4 }}>
              Bạn có chắc chắn muốn xóa thông báo này không? Thao tác này không thể hoàn tác.
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setConfirmDeleteId(null)} className="btn btn--ghost btn--full" style={{ fontSize: '12px' }}>Hủy</button>
              <button
                onClick={() => {
                  const id = confirmDeleteId;
                  setConfirmDeleteId(null);
                  handleDeleteNotification(id);
                }}
                className="btn btn--full"
                style={{ background: 'var(--red)', color: '#fff', border: 'none', fontSize: '12px' }}
              >
                Xóa ngay
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
