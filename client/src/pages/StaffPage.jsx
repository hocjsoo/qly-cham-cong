// src/pages/StaffPage.jsx
// Quản lý nhân viên — Safe ConfirmDialog, modal chống bấm ngoài đóng, CRUD đầy đủ

import { useState, useEffect } from 'react';
import { Plus, X, Search, Edit2, Trash2, Shield, UserCheck, Building2, Phone, AlertTriangle, UserX } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import useAuthStore from '../stores/authStore';
import HeaderActions from '../components/HeaderActions';

const ROLE_LABELS = {
  admin:    { label: 'Admin',     cls: 'badge--danger' },
  leader:   { label: 'Leader',    cls: 'badge--warning' },
  manager:  { label: 'Leader',    cls: 'badge--warning' },
  employee: { label: 'Nhân viên', cls: 'badge--info' },
  staff:    { label: 'Nhân viên', cls: 'badge--info' },
};

// Safe Confirm Dialog — không bị đóng khi bấm vào overlay
function ConfirmDialog({ title, message, confirmLabel = 'Xác nhận', danger = true, onConfirm, onCancel }) {
  return (
    <div className="modal-overlay" style={{ zIndex: 500 }}>
      <div className="modal-sheet animate-slide-up" style={{ maxWidth: '380px' }}>
        <div className="modal-sheet__handle" />
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
          <AlertTriangle size={22} color={danger ? 'var(--red)' : 'var(--yellow)'} />
          <div style={{ fontSize: '15px', fontWeight: 700 }}>{title}</div>
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '18px' }}>{message}</div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={onCancel} className="btn btn--ghost btn--full">Hủy bỏ</button>
          <button onClick={onConfirm} className="btn btn--full" style={{ background: danger ? 'var(--red)' : 'var(--yellow)', color: '#fff', border: 'none', fontWeight: 700 }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function StaffPage() {
  const { user: currentUser } = useAuthStore();
  const [staff, setStaff] = useState([]);
  const [depts, setDepts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const [form, setForm] = useState({
    full_name: '', email: '', password: '', role: 'employee', department_id: '', department_ids: [], phone: '',
  });
  const [submitting, setSubmitting] = useState(false);

  // Reset Code Modal
  const [resetCodeModal, setResetCodeModal] = useState(null); // { user, code }

  // Attendance Override Modal
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideUser, setOverrideUser] = useState(null);
  const [overrideForm, setOverrideForm] = useState({
    date: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }),
    check_in_time: '08:30',
    check_out_time: '17:30',
    check_in_type: 'office',
    is_late: false,
    notes: '',
  });

  // Confirm dialog state
  const [confirm, setConfirm] = useState(null); // { title, message, onConfirm, confirmLabel, danger }

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [s, d] = await Promise.all([api.get('/users'), api.get('/departments')]);
      setStaff(Array.isArray(s.data) ? s.data : (s.data?.users || []));
      setDepts(Array.isArray(d.data) ? d.data : (d.data?.departments || []));
    } catch { toast.error('Lỗi tải dữ liệu'); }
    finally { setLoading(false); }
  };

  const handleGenerateResetCode = async (user) => {
    try {
      const { data } = await api.post('/auth/forgot-password', { email: user.email });
      setResetCodeModal({ user, code: data.reset_code });
      toast.success(`Đã tạo mã reset cho ${user.full_name}`);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Lỗi tạo mã reset');
    }
  };

  const openOverride = (user) => {
    setOverrideUser(user);
    setOverrideForm({
      date: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }),
      check_in_time: '08:30',
      check_out_time: '17:30',
      check_in_type: 'office',
      is_late: false,
      notes: 'Admin điều chỉnh giờ công',
    });
    setShowOverrideModal(true);
  };

  const handleSaveOverride = async () => {
    if (!overrideForm.date) { toast.error('Vui lòng chọn ngày'); return; }
    setSubmitting(true);
    try {
      const checkInISO = `${overrideForm.date}T${overrideForm.check_in_time}:00`;
      const checkOutISO = overrideForm.check_out_time ? `${overrideForm.date}T${overrideForm.check_out_time}:00` : null;

      const { data } = await api.put('/attendance/override/new', {
        user_id: overrideUser._id || overrideUser.id,
        date: overrideForm.date,
        check_in_time: checkInISO,
        check_out_time: checkOutISO,
        check_in_type: overrideForm.check_in_type,
        is_late: overrideForm.is_late,
        notes: overrideForm.notes,
      });

      toast.success(data.message || 'Đã sửa giờ công thành công!');
      setShowOverrideModal(false);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Lỗi cập nhật chấm công');
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = staff.filter(s => {
    const matchSearch = s.full_name?.toLowerCase().includes(search.toLowerCase()) ||
                        s.email?.toLowerCase().includes(search.toLowerCase());
    const userDeptIds = s.department_ids?.map(d => d._id || d) || [s.department_id?._id || s.department_id];
    const matchDept = !filterDept || userDeptIds.includes(filterDept);
    const matchRole = !filterRole || s.role === filterRole || (filterRole === 'leader' && s.role === 'manager') || (filterRole === 'employee' && s.role === 'staff');
    return matchSearch && matchDept && matchRole;
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ full_name: '', email: '', password: '', role: 'employee', department_id: '', department_ids: [], phone: '' });
    setShowForm(true);
  };

  const openEdit = (user) => {
    setEditing(user);
    const userDeptIds = user.department_ids?.map(d => d._id || d) || (user.department_id?._id || user.department_id ? [user.department_id._id || user.department_id] : []);
    setForm({
      full_name: user.full_name || '',
      email: user.email || '',
      password: '',
      role: user.role || 'employee',
      department_id: userDeptIds[0] || '',
      department_ids: userDeptIds,
      phone: user.phone || '',
    });
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!form.full_name || !form.email) { toast.error('Vui lòng nhập tên và email'); return; }
    if (!editing && !form.password) { toast.error('Vui lòng nhập mật khẩu'); return; }
    if (!editing && form.password.length < 6) { toast.error('Mật khẩu phải ít nhất 6 ký tự'); return; }

    setSubmitting(true);
    try {
      const payload = { ...form };
      if (!payload.password) delete payload.password;
      if (!payload.department_id) delete payload.department_id;

      if (editing) {
        await api.put(`/users/${editing._id || editing.id}`, payload);
        toast.success(`Đã cập nhật nhân viên "${form.full_name}"`);
      } else {
        await api.post('/users', payload);
        toast.success(`Đã thêm "${form.full_name}" vào hệ thống ✅`);
      }
      setShowForm(false);
      loadData();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Lỗi xử lý');
    } finally { setSubmitting(false); }
  };

  // Delete with safe confirm dialog
  const handleDelete = (user) => {
    setConfirm({
      title: 'Xóa nhân viên',
      message: `Bạn sắp xóa tài khoản "${user.full_name}" (${user.email}). Hành động này không thể hoàn tác và sẽ xóa toàn bộ dữ liệu liên quan.`,
      confirmLabel: '🗑️ Xóa vĩnh viễn',
      danger: true,
      onConfirm: async () => {
        setConfirm(null);
        try {
          await api.delete(`/users/${user._id || user.id}`);
          toast.success(`Đã xóa nhân viên "${user.full_name}"`);
          loadData();
        } catch (err) { toast.error(err?.response?.data?.error || 'Lỗi xóa'); }
      },
    });
  };

  // Toggle active with safe confirm dialog
  const handleToggleActive = (user) => {
    const isDeactivating = user.is_active !== false;
    setConfirm({
      title: isDeactivating ? 'Vô hiệu hóa tài khoản' : 'Kích hoạt tài khoản',
      message: isDeactivating
        ? `Vô hiệu hóa tài khoản "${user.full_name}"? Nhân viên này sẽ không thể đăng nhập cho đến khi được kích hoạt lại.`
        : `Kích hoạt lại tài khoản "${user.full_name}"? Nhân viên này sẽ có thể đăng nhập và sử dụng hệ thống.`,
      confirmLabel: isDeactivating ? '⛔ Vô hiệu hóa' : '✅ Kích hoạt',
      danger: isDeactivating,
      onConfirm: async () => {
        setConfirm(null);
        try {
          await api.patch(`/users/${user._id || user.id}/toggle-active`);
          toast.success(isDeactivating ? '⛔ Đã vô hiệu hóa tài khoản' : '✅ Đã kích hoạt tài khoản');
          loadData();
        } catch (err) { toast.error(err?.response?.data?.error || 'Lỗi cập nhật'); }
      },
    });
  };

  const activeCount = staff.filter(s => s.is_active !== false).length;
  const adminCount  = staff.filter(s => s.role === 'admin').length;
  const mgCount     = staff.filter(s => s.role === 'manager').length;

  return (
    <div className="page">
      <div className="header">
        <div className="header__inner">
          <div>
            <div className="header__title">Nhân viên</div>
            <div className="header__subtitle">{staff.length} người · {depts.length} phòng ban</div>
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <button onClick={openCreate} className="btn btn--primary" style={{ padding: '6px 12px', fontSize: '13px' }}>
              <Plus size={14} /> Thêm mới
            </button>
            <HeaderActions />
          </div>
        </div>
      </div>

      <div className="container" style={{ paddingTop: '14px' }}>
        {/* Quick stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '12px' }}>
          {[
            { label: 'Đang hoạt động', value: activeCount, color: 'var(--green)', bg: 'var(--green-soft)' },
            { label: 'Trưởng phòng', value: mgCount, color: 'var(--yellow)', bg: 'var(--yellow-soft)' },
            { label: 'Quản trị viên', value: adminCount, color: 'var(--red)', bg: 'var(--red-soft)' },
          ].map((item, i) => (
            <div key={i} style={{ background: item.bg, borderRadius: '10px', padding: '10px', textAlign: 'center', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '20px', fontWeight: 700, color: item.color }}>{item.value}</div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>{item.label}</div>
            </div>
          ))}
        </div>

        {/* Search + Filter */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '30px', padding: '8px 10px 8px 30px', fontSize: '13px' }}
              placeholder="Tìm tên, email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select className="form-input" style={{ width: 'auto', padding: '8px 10px', fontSize: '12px' }} value={filterRole} onChange={e => setFilterRole(e.target.value)}>
            <option value="">Tất cả vai trò</option>
            <option value="staff">Nhân viên</option>
            <option value="manager">Trưởng phòng</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        {/* Dept filter chips */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', overflowX: 'auto', paddingBottom: '2px' }}>
          <button onClick={() => setFilterDept('')} className={`chip${!filterDept ? ' active' : ''}`}>Tất cả</button>
          {depts.map(d => (
            <button key={d._id} onClick={() => setFilterDept(d._id)} className={`chip${filterDept === d._id ? ' active' : ''}`}>
              {d.name}
            </button>
          ))}
        </div>

        {/* Staff list */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[1,2,3,4].map(i => <div key={i} className="skeleton-card" style={{ height: '72px', borderRadius: '12px' }} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">👤</div>
            <div className="empty-state__title">Không tìm thấy</div>
            <div className="empty-state__desc">Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {filtered.map(u => {
              const roleCfg = ROLE_LABELS[u.role] || ROLE_LABELS.staff;
              const deptName = u.department_id?.name || depts.find(d => d._id === u.department_id)?.name || '—';
              const initials = (u.full_name || '?').split(' ').slice(-2).map(n => n[0]).join('').toUpperCase();
              const isInactive = u.is_active === false;

              return (
                <div key={u._id || u.id} className="card" style={{ padding: '12px 14px', opacity: isInactive ? 0.6 : 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div className="avatar" style={{ background: isInactive ? 'var(--text-muted)' : 'var(--primary)' }}>
                      {initials}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '14px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {u.full_name}
                        </span>
                        <span className={`badge ${roleCfg.cls}`} style={{ fontSize: '10px' }}>{roleCfg.label}</span>
                        {isInactive && <span className="badge badge--neutral" style={{ fontSize: '10px' }}>Đã khóa</span>}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '2px' }}>
                        <span>{u.email}</span>
                        {u.phone && <span>📱 {u.phone}</span>}
                        <span>🏢 {deptName}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                      <button onClick={() => openOverride(u)} title="Sửa giờ chấm công" style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '6px', padding: '5px', cursor: 'pointer', color: 'var(--green)', display: 'flex', alignItems: 'center' }}>
                        📝
                      </button>
                      <button onClick={() => handleGenerateResetCode(u)} title="Tạo mã Reset Password" style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '6px', padding: '5px', cursor: 'pointer', color: 'var(--yellow)', display: 'flex', alignItems: 'center' }}>
                        🔑
                      </button>
                      <button onClick={() => openEdit(u)} title="Sửa thông tin" style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '6px', padding: '5px', cursor: 'pointer', color: 'var(--primary)', display: 'flex', alignItems: 'center' }}>
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleToggleActive(u)}
                        title={isInactive ? 'Kích hoạt' : 'Vô hiệu hóa'}
                        style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '6px', padding: '5px', cursor: 'pointer', color: isInactive ? 'var(--green)' : 'var(--yellow)', display: 'flex', alignItems: 'center' }}
                      >
                        {isInactive ? <UserCheck size={14} /> : <UserX size={14} />}
                      </button>
                      {currentUser?.role === 'admin' && u._id !== currentUser?._id && (
                        <button
                          onClick={() => handleDelete(u)}
                          title="Xóa vĩnh viễn"
                          style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '6px', padding: '5px', cursor: 'pointer', color: 'var(--red)', display: 'flex', alignItems: 'center' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create/Edit Form Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-sheet animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="modal-sheet__handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700 }}>
                {editing ? `Sửa: ${editing.full_name}` : 'Thêm nhân viên mới'}
              </h3>
              <button onClick={() => setShowForm(false)} className="btn btn--ghost" style={{ padding: '4px 8px' }}>
                <X size={18} />
              </button>
            </div>

            <div className="form-group">
              <label className="form-label">Họ và Tên *</label>
              <input type="text" className="form-input" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} placeholder="Nguyễn Văn A" />
            </div>
            <div className="form-group">
              <label className="form-label">Email *</label>
              <input type="email" className="form-input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="nva@company.com" disabled={Boolean(editing)} />
            </div>
            <div className="form-group">
              <label className="form-label">{editing ? 'Mật khẩu mới (bỏ trống nếu không đổi)' : 'Mật khẩu *'}</label>
              <input type="password" className="form-input" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Tối thiểu 6 ký tự" />
            </div>
            <div className="form-group">
              <label className="form-label">Số điện thoại</label>
              <input type="text" className="form-input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="0912345678" />
            </div>
            <div className="form-group">
              <label className="form-label">Vai trò *</label>
              <select className="form-input" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                <option value="employee">Nhân viên</option>
                <option value="leader">Leader (Trưởng nhóm)</option>
                <option value="admin">Admin (Quản trị viên)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Phòng ban * (Có thể chọn nhiều phòng ban)</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '8px', background: 'var(--bg-raised)', padding: '10px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                {depts.map(d => {
                  const checked = (form.department_ids || []).includes(d._id);
                  return (
                    <label key={d._id} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px', color: 'var(--text)' }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={e => {
                          let updated = [...(form.department_ids || [])];
                          if (e.target.checked) {
                            if (!updated.includes(d._id)) updated.push(d._id);
                          } else {
                            updated = updated.filter(id => id !== d._id);
                          }
                          setForm({ ...form, department_ids: updated, department_id: updated[0] || '' });
                        }}
                      />
                      <span>{d.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <button onClick={handleSubmit} disabled={submitting} className="btn btn--primary btn--full btn--lg" style={{ marginTop: '8px' }}>
              {submitting ? <span className="spinner" /> : editing ? 'Lưu thay đổi' : 'Tạo tài khoản'}
            </button>
          </div>
        </div>
      )}

      {/* Reset Code Result Modal */}
      {resetCodeModal && (
        <div className="modal-overlay">
          <div className="modal-sheet animate-slide-up" style={{ maxWidth: '380px' }}>
            <div className="modal-sheet__handle" />
            <div style={{ textAlign: 'center', marginBottom: '14px' }}>
              <div style={{ fontSize: '28px', marginBottom: '4px' }}>🔑</div>
              <div style={{ fontSize: '16px', fontWeight: 700 }}>Mã Reset Mật Khẩu</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Cấp cho: {resetCodeModal.user.full_name}</div>
            </div>
            <div style={{
              background: 'var(--primary-soft)', border: '1px solid var(--primary)',
              borderRadius: '10px', padding: '14px', textAlign: 'center', marginBottom: '16px'
            }}>
              <div style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '4px', color: 'var(--primary)' }}>
                {resetCodeModal.code}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>Mã có hiệu lực trong 30 phút</div>
            </div>
            <button onClick={() => setResetCodeModal(null)} className="btn btn--primary btn--full">Đóng</button>
          </div>
        </div>
      )}

      {/* Attendance Override Modal (Admin Sửa Công) */}
      {showOverrideModal && (
        <div className="modal-overlay" onClick={() => setShowOverrideModal(false)}>
          <div className="modal-sheet animate-slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <div className="modal-sheet__handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700 }}>
                📝 Sửa giờ công: {overrideUser?.full_name}
              </h3>
              <button onClick={() => setShowOverrideModal(false)} className="btn btn--ghost" style={{ padding: '4px 8px' }}>
                <X size={18} />
              </button>
            </div>

            <div className="form-group">
              <label className="form-label">Chọn ngày *</label>
              <input
                type="date"
                className="form-input"
                value={overrideForm.date}
                onChange={e => setOverrideForm({ ...overrideForm, date: e.target.value })}
                onClick={e => e.target.showPicker && e.target.showPicker()}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div className="form-group">
                <label className="form-label">Giờ Check-in</label>
                <input
                  type="time"
                  className="form-input"
                  value={overrideForm.check_in_time}
                  onChange={e => setOverrideForm({ ...overrideForm, check_in_time: e.target.value })}
                  onClick={e => e.target.showPicker && e.target.showPicker()}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Giờ Check-out</label>
                <input
                  type="time"
                  className="form-input"
                  value={overrideForm.check_out_time}
                  onChange={e => setOverrideForm({ ...overrideForm, check_out_time: e.target.value })}
                  onClick={e => e.target.showPicker && e.target.showPicker()}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Loại chấm công</label>
              <select className="form-input" value={overrideForm.check_in_type} onChange={e => setOverrideForm({ ...overrideForm, check_in_type: e.target.value })}>
                <option value="office">🏢 Văn phòng</option>
                <option value="site">🏗️ Công trình</option>
                <option value="client">👔 Khách hàng</option>
                <option value="wfh">🏠 WFH</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Ghi chú / Lý do điều chỉnh</label>
              <input type="text" className="form-input" value={overrideForm.notes} onChange={e => setOverrideForm({ ...overrideForm, notes: e.target.value })} placeholder="VD: Quên check-in do máy hỏng" />
            </div>

            <button onClick={handleSaveOverride} disabled={submitting} className="btn btn--primary btn--full btn--lg" style={{ marginTop: '8px' }}>
              {submitting ? <span className="spinner" /> : 'Lưu điều chỉnh giờ công'}
            </button>
          </div>
        </div>
      )}

      {/* Safe Confirm Dialog */}
      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          confirmLabel={confirm.confirmLabel}
          danger={confirm.danger}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
