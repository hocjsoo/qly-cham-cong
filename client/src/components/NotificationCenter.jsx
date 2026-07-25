// client/src/components/NotificationCenter.jsx
// Notification Center Component — Bell Icon with Unread Badge & Dropdown Drawer

import { useState, useEffect, useRef } from 'react';
import { Bell, CheckCheck, X, Megaphone, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

const TYPE_ICONS = {
  system: <AlertTriangle size={16} color="var(--yellow)" />,
  request: <Clock size={16} color="var(--primary)" />,
  attendance: <CheckCircle2 size={16} color="var(--green)" />,
  announcement: <Megaphone size={16} color="var(--purple, #8b5cf6)" />,
};

export default function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // Polling 30s
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
            position: 'absolute', top: '2px', right: '2px',
            background: 'var(--red)', color: '#fff',
            borderRadius: '10px', fontSize: '10px', fontWeight: 800,
            padding: '1px 5px', lineHeight: 1.2,
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Drawer */}
      {open && (
        <div className="card animate-slide-up" style={{
          position: 'absolute', right: 0, top: '44px', width: '340px',
          maxHeight: '440px', zIndex: 1000, boxShadow: 'var(--shadow-lg)',
          display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden'
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg-raised)'
          }}>
            <div style={{ fontWeight: 700, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>🔔 Thông báo</span>
              {unreadCount > 0 && (
                <span className="badge badge--warning" style={{ fontSize: '10px' }}>{unreadCount} mới</span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <CheckCheck size={14} /> Đọc tất cả
              </button>
            )}
          </div>

          {/* Body List */}
          <div style={{ overflowY: 'auto', flex: 1, padding: '6px' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                Không có thông báo mới
              </div>
            ) : (
              notifications.map(n => (
                <div
                  key={n._id}
                  onClick={() => handleMarkRead(n._id)}
                  style={{
                    padding: '10px', borderRadius: '8px', marginBottom: '4px',
                    background: n.is_read ? 'transparent' : 'var(--primary-soft)',
                    borderLeft: n.is_read ? '3px solid transparent' : '3px solid var(--primary)',
                    cursor: 'pointer', transition: 'background 0.15s'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'start', gap: '8px' }}>
                    <div style={{ marginTop: '2px' }}>
                      {TYPE_ICONS[n.type] || TYPE_ICONS.system}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '12px', fontWeight: n.is_read ? 600 : 700, color: 'var(--text)' }}>
                        {n.title}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.4 }}>
                        {n.message}
                      </div>
                      <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '4px' }}>
                        {new Date(n.created_at).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
