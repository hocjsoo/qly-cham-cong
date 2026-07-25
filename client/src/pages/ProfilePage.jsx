// src/pages/ProfilePage.jsx
// Trang cá nhân — Xem thông tin, Quản lý ngày phép tồn, Chỉnh sửa họ tên/SĐT, Đổi mật khẩu

import { useState, useEffect } from 'react';
import { LogOut, Lock, User, Mail, Phone, Building2, Shield, ChevronRight, Edit3, X, Calendar, Briefcase, HeartHandshake } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';
import useAuthStore from '../stores/authStore';
import HeaderActions from '../components/HeaderActions';

const ROLE_VI = { admin: 'Quản trị viên', leader: 'Leader', manager: 'Leader', employee: 'Nhân viên', staff: 'Nhân viên' };

export default function ProfilePage() {
  const { user, setUser, logout } = useAuthStore();
  const navigate = useNavigate();
  const [showChangePass, setShowChangePass] = useState(false);
  const [showEditInfo, setShowEditInfo] = useState(false);
  const [leaveBal, setLeaveBal] = useState(null);

  // Edit info state
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [updatingInfo, setUpdatingInfo] = useState(false);

  // Change password state
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [submittingPass, setSubmittingPass] = useState(false);

  const initials = user?.full_name?.split(' ').map(w => w[0]).slice(-2).join('').toUpperCase() || '?';

  useEffect(() => {
    fetchLeaveBalance();
  }, []);

  const fetchLeaveBalance = async () => {
    try {
      const { data } = await api.get('/leave-balance/me');
      setLeaveBal(data);
    } catch (err) {
      console.log('Chưa có dữ liệu ngày phép:', err);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
    toast.success('Đã đăng xuất');
  };

  const handleUpdateProfile = async () => {
    if (!fullName.trim()) {
      toast.error('Họ tên không được để trống');
      return;
    }
    setUpdatingInfo(true);
    try {
      const { data } = await api.patch('/auth/profile', { full_name: fullName.trim(), phone: phone.trim() });
      toast.success(data.message);
      setUser(data.user);
      setShowEditInfo(false);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Lỗi cập nhật thông tin');
    } finally { setUpdatingInfo(false); }
  };

  const handleChangePass = async () => {
    if (!oldPass || !newPass) {
      toast.error('Vui lòng nhập đầy đủ');
      return;
    }
    if (newPass.length < 6) {
      toast.error('Mật khẩu mới ít nhất 6 ký tự');
      return;
    }
    if (newPass !== confirmPass) {
      toast.error('Mật khẩu xác nhận không khớp');
      return;
    }
    setSubmittingPass(true);
    try {
      await api.post('/auth/change-password', { old_password: oldPass, new_password: newPass });
      toast.success('Đổi mật khẩu thành công');
      setShowChangePass(false);
      setOldPass(''); setNewPass(''); setConfirmPass('');
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Lỗi đổi mật khẩu');
    } finally { setSubmittingPass(false); }
  };

  const infoItems = [
    { icon: <Mail size={16} />, label: 'Email', value: user?.email },
    { icon: <Phone size={16} />, label: 'Điện thoại', value: user?.phone || 'Chưa cập nhật' },
    { icon: <Building2 size={16} />, label: 'Phòng ban', value: user?.department_name || 'Chưa phân' },
    { icon: <Shield size={16} />, label: 'Vai trò', value: ROLE_VI[user?.role] || user?.role },
  ];

  return (
    <div className="page">
      <div className="header">
        <div className="header__inner">
          <div className="header__title">Cá nhân</div>
          <HeaderActions />
        </div>
      </div>

      <div className="container" style={{ paddingTop: '20px' }}>
        {/* Profile header */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }} className="animate-fade-in">
          <div className="avatar" style={{
            width: '64px', height: '64px', fontSize: '22px',
            margin: '0 auto 10px',
          }}>
            {initials}
          </div>
          <h2 style={{ fontSize: '18px', fontWeight: 700 }}>{user?.full_name}</h2>
          <span className={`badge ${user?.role === 'admin' ? 'badge--danger' : (user?.role === 'leader' || user?.role === 'manager') ? 'badge--warning' : 'badge--info'}`}>
            {ROLE_VI[user?.role]}
          </span>
        </div>

        {/* Leave Balances Card */}
        {leaveBal && (
          <div className="card animate-fade-in" style={{ marginBottom: '12px', background: 'var(--bg-raised)', borderColor: 'var(--primary-soft)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Calendar size={18} color="var(--primary)" />
              <span style={{ fontSize: '13px', fontWeight: 700 }}>Quỹ nghỉ phép năm {leaveBal.year}</span>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
              {/* Phép năm */}
              <div style={{ background: 'var(--bg)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Briefcase size={12} /> Phép năm
                </div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--primary)', marginTop: '4px' }}>
                  {leaveBal.annual_leave.remaining} <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--text-muted)' }}>/ {leaveBal.annual_leave.total} ngày</span>
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Đã dùng: {leaveBal.annual_leave.used} ngày
                </div>
              </div>

              {/* Nghỉ ốm */}
              <div style={{ background: 'var(--bg)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <HeartHandshake size={12} /> Nghỉ ốm
                </div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--green)', marginTop: '4px' }}>
                  {leaveBal.sick_leave.remaining} <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--text-muted)' }}>/ {leaveBal.sick_leave.total} ngày</span>
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Đã dùng: {leaveBal.sick_leave.used} ngày
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Info card */}
        <div className="card animate-fade-in" style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Thông tin cá nhân
            </span>
            <button
              onClick={() => { setFullName(user?.full_name || ''); setPhone(user?.phone || ''); setShowEditInfo(true); }}
              style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <Edit3 size={14} /> Sửa
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {infoItems.map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{item.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{item.label}</div>
                  <div style={{ fontSize: '14px', fontWeight: 500 }}>{item.value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <button
            onClick={() => setShowChangePass(!showChangePass)}
            className="card animate-fade-in"
            style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              cursor: 'pointer', width: '100%', textAlign: 'left',
              fontFamily: 'inherit', fontSize: '14px', color: 'var(--text)',
            }}
          >
            <Lock size={18} color="var(--primary)" />
            <span style={{ flex: 1, fontWeight: 500 }}>Đổi mật khẩu</span>
            <ChevronRight size={16} color="var(--text-muted)" />
          </button>

          <button
            onClick={handleLogout}
            className="card"
            style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              cursor: 'pointer', width: '100%', textAlign: 'left',
              fontFamily: 'inherit', fontSize: '14px', color: 'var(--red)',
              borderColor: 'var(--red-soft)',
            }}
          >
            <LogOut size={18} />
            <span style={{ flex: 1, fontWeight: 500 }}>Đăng xuất</span>
          </button>
        </div>
      </div>

      {/* Edit Profile Sheet */}
      {showEditInfo && (
        <div className="modal-overlay" onClick={() => setShowEditInfo(false)}>
          <div className="modal-sheet animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="modal-sheet__handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Chỉnh sửa thông tin</h3>
              <button onClick={() => setShowEditInfo(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div className="form-group">
              <label className="form-label">Họ và tên</label>
              <input type="text" className="form-input" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Nguyễn Văn A" />
            </div>

            <div className="form-group">
              <label className="form-label">Số điện thoại</label>
              <input type="text" className="form-input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="0912345678" />
            </div>

            <button onClick={handleUpdateProfile} disabled={updatingInfo} className="btn btn--primary btn--full btn--lg" style={{ marginTop: '8px' }}>
              {updatingInfo ? <span className="spinner" /> : 'Lưu thay đổi'}
            </button>
          </div>
        </div>
      )}

      {/* Change Password Sheet */}
      {showChangePass && (
        <div className="modal-overlay" onClick={() => setShowChangePass(false)}>
          <div className="modal-sheet animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="modal-sheet__handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Đổi mật khẩu</h3>
              <button onClick={() => setShowChangePass(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div className="form-group">
              <label className="form-label">Mật khẩu hiện tại</label>
              <input type="password" className="form-input" value={oldPass} onChange={e => setOldPass(e.target.value)} placeholder="••••••" />
            </div>
            <div className="form-group">
              <label className="form-label">Mật khẩu mới</label>
              <input type="password" className="form-input" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="Ít nhất 6 ký tự" />
            </div>
            <div className="form-group">
              <label className="form-label">Xác nhận mật khẩu mới</label>
              <input type="password" className="form-input" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} placeholder="Nhập lại mật khẩu mới" />
            </div>

            <button onClick={handleChangePass} disabled={submittingPass} className="btn btn--primary btn--full btn--lg" style={{ marginTop: '8px' }}>
              {submittingPass ? <span className="spinner" /> : 'Xác nhận đổi'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
