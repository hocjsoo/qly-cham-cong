// src/pages/UsersPage.jsx
// Trang quản lý nhân viên (Dành riêng cho Admin) — Đầy đủ Department & Manager assignment

import { useState, useEffect, useCallback } from 'react';
import { UserPlus, Search, Edit2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

const ROLE_LABELS = {
  admin:   { label: '👑 Admin',    class: 'badge--danger' },
  manager: { label: '⭐ Manager',  class: 'badge--warning' },
  staff:   { label: '👤 Staff',    class: 'badge--info' },
};

const DEPARTMENTS = [
  'Kiến trúc',
  'Kết cấu',
  'MEP',
  'Dự toán',
  'Thi công',
  'Hành chính - Nhân sự',
  'Kế toán',
  'Ban Giám đốc',
];

export default function UsersPage() {
  const [users,       setUsers]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [searchTerm,  setSearchTerm]  = useState('');
  const [roleFilter,  setRoleFilter]  = useState('all');
  const [showModal,   setShowModal]   = useState(false);
  const [editUser,    setEditUser]    = useState(null);
  const [submitting,  setSubmitting]  = useState(false);

  // Form state
  const [form, setForm] = useState({
    email: '', full_name: '', password: '', role: 'staff',
    phone: '', is_active: true, department_name: 'Kiến trúc',
  });

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/users');
      setUsers(data.users);
    } catch {
      toast.error('Lỗi tải danh sách nhân viên');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleOpenAdd = () => {
    setEditUser(null);
    setForm({
      email: '', full_name: '', password: '', role: 'staff',
      phone: '', is_active: true, department_name: 'Kiến trúc',
    });
    setShowModal(true);
  };

  const handleOpenEdit = (user) => {
    setEditUser(user);
    setForm({
      email: user.email,
      full_name: user.full_name,
      password: '',
      role: user.role,
      phone: user.phone || '',
      is_active: user.is_active,
      department_name: user.department_name || 'Kiến trúc',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (editUser) {
        const updatePayload = {
          full_name: form.full_name,
          phone: form.phone,
          role: form.role,
          is_active: form.is_active,
        };
        const { data } = await api.patch(`/users/${editUser._id || editUser.id}`, updatePayload);
        toast.success(data.message);
      } else {
        if (!form.password) {
          toast.error('Mật khẩu là bắt buộc khi tạo tài khoản mới');
          setSubmitting(false);
          return;
        }
        const { data } = await api.post('/users', form);
        toast.success(data.message);
      }

      setShowModal(false);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Lỗi xử lý');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredUsers = users.filter(u => {
    const matchSearch = u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        u.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchRole = roleFilter === 'all' || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  return (
    <div className="page">
      {/* Header */}
      <div className="header">
        <div className="header__inner">
          <div>
            <div className="header__title">Quản lý Nhân sự</div>
            <div className="header__subtitle">Tổng số: {users.length} nhân sự</div>
          </div>
          <button
            id="btn-add-user"
            onClick={handleOpenAdd}
            className="btn btn--primary"
            style={{ padding: '8px 14px', fontSize: '13px' }}
          >
            <UserPlus size={16} /> Thêm NV
          </button>
        </div>
      </div>

      <div className="container" style={{ paddingTop: '16px' }}>

        {/* Tìm kiếm & Lọc role */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              type="text"
              className="form-input"
              placeholder="Tìm tên hoặc email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingLeft: '36px' }}
            />
            <Search
              size={16}
              style={{
                position: 'absolute', left: '12px', top: '50%',
                transform: 'translateY(-50%)', color: 'var(--text-muted)'
              }}
            />
          </div>

          <select
            className="form-select"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            style={{ width: '130px', fontSize: '13px' }}
          >
            <option value="all">Tất cả role</option>
            <option value="staff">👤 Staff</option>
            <option value="manager">⭐ Manager</option>
            <option value="admin">👑 Admin</option>
          </select>
        </div>

        {/* Danh sách nhân viên */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <span className="spinner" style={{ width: '32px', height: '32px', borderWidth: '3px', color: 'var(--primary)' }} />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            Không tìm thấy nhân viên nào
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filteredUsers.map((u) => {
              const roleCfg = ROLE_LABELS[u.role] || ROLE_LABELS.staff;
              const initials = u.full_name?.split(' ').map(w => w[0]).slice(-2).join('').toUpperCase();

              return (
                <div key={u._id || u.id} className="card animate-fade-in" style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className="avatar" style={{ width: '42px', height: '42px', fontSize: '14px', flexShrink: 0 }}>
                      {initials}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: 600, fontSize: '15px' }}>{u.full_name}</span>
                        {!u.is_active && (
                          <span className="badge badge--danger" style={{ fontSize: '10px' }}>Khóa</span>
                        )}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {u.email} {u.phone ? `· ${u.phone}` : ''}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <span className={`badge ${roleCfg.class}`} style={{ marginBottom: '6px', display: 'inline-block' }}>
                        {roleCfg.label}
                      </span>
                      <div>
                        <button
                          onClick={() => handleOpenEdit(u)}
                          className="btn btn--ghost"
                          style={{ padding: '4px 8px', fontSize: '12px' }}
                        >
                          <Edit2 size={13} /> Sửa
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* Modal Thêm / Sửa Nhân viên */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'flex-end',
          zIndex: 200, padding: '0',
        }} onClick={() => setShowModal(false)}>
          <div className="card animate-slide-up" style={{
            width: '100%', maxWidth: '480px', margin: '0 auto',
            borderBottomLeftRadius: 0, borderBottomRightRadius: 0,
            borderBottom: 'none', maxHeight: '90vh', overflowY: 'auto',
            paddingBottom: '32px',
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontWeight: 700, marginBottom: '16px' }}>
              {editUser ? 'Sửa thông tin nhân viên' : 'Thêm nhân viên mới'}
            </h3>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Họ và tên *</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  placeholder="Nguyễn Văn A"
                  value={form.full_name}
                  onChange={e => setForm({ ...form, full_name: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Email *</label>
                <input
                  type="email"
                  className="form-input"
                  required
                  disabled={!!editUser}
                  placeholder="nhanvien@etoffice.vn"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                />
              </div>

              {!editUser && (
                <div className="form-group">
                  <label className="form-label">Mật khẩu ban đầu *</label>
                  <input
                    type="password"
                    className="form-input"
                    required
                    placeholder="Mật khẩu ít nhất 6 ký tự"
                    value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })}
                  />
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Số điện thoại</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="0912345678"
                    value={form.phone}
                    onChange={e => setForm({ ...form, phone: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Phòng ban</label>
                  <select
                    className="form-select"
                    value={form.department_name}
                    onChange={e => setForm({ ...form, department_name: e.target.value })}
                  >
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Phân quyền (Role)</label>
                <select
                  className="form-select"
                  value={form.role}
                  onChange={e => setForm({ ...form, role: e.target.value })}
                >
                  <option value="staff">👤 Staff (Nhân viên)</option>
                  <option value="manager">⭐ Manager (Trưởng phòng team)</option>
                  <option value="admin">👑 Admin (Quản trị viên)</option>
                </select>
              </div>

              {editUser && (
                <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={form.is_active}
                    onChange={e => setForm({ ...form, is_active: e.target.checked })}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <label htmlFor="is_active" style={{ cursor: 'pointer', fontSize: '14px' }}>
                    Tài khoản đang hoạt động (Hoạt động / Khóa)
                  </label>
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
                <button type="button" className="btn btn--ghost" style={{ flex: 1 }} onClick={() => setShowModal(false)}>
                  Huỷ
                </button>
                <button type="submit" className="btn btn--primary" style={{ flex: 2 }} disabled={submitting}>
                  {submitting ? <span className="spinner" /> : (editUser ? 'Lưu thay đổi' : 'Tạo tài khoản')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
