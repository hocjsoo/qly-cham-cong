// src/pages/StaffPage.jsx
// Quản lý nhân viên — Safe ConfirmDialog, modal chống bấm ngoài đóng, CRUD đầy đủ

import { useState, useEffect } from 'react';
import { Plus, X, Search, Edit2, Trash2, Shield, UserCheck, Building2, Phone, AlertTriangle, UserX, Download, UserPlus, Clock, Bike, Mail, Calendar, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import useAuthStore from '../stores/authStore';
import HeaderActions from '../components/HeaderActions';

const adjustTimeString = (timeStr, deltaMinutes) => {
  if (!timeStr) timeStr = '08:30';
  const parts = timeStr.split(':').map(Number);
  let totalMins = (parts[0] || 0) * 60 + (parts[1] || 0) + deltaMinutes;
  if (totalMins < 0) totalMins = 0;
  if (totalMins > 23 * 60 + 59) totalMins = 23 * 60 + 59;
  const hh = String(Math.floor(totalMins / 60)).padStart(2, '0');
  const mm = String(totalMins % 60).padStart(2, '0');
  return `${hh}:${mm}`;
};

const computeLiveSummary = (inTime, outTime, workEndTime = '18:30') => {
  if (!inTime || !outTime) return null;
  const [inH, inM] = inTime.split(':').map(Number);
  const [outH, outM] = outTime.split(':').map(Number);
  const inMins = (inH || 0) * 60 + (inM || 0);
  const outMins = (outH || 0) * 60 + (outM || 0);
  if (outMins <= inMins) return { totalHours: 0, otHours: 0 };
  const diffMins = outMins - inMins;
  const totalHours = parseFloat((diffMins / 60).toFixed(1));

  const [endH, endM] = (workEndTime || '18:30').split(':').map(Number);
  const endMins = (endH || 0) * 60 + (endM || 0);
  let otHours = 0;
  if (outMins > endMins) {
    otHours = parseFloat(((outMins - endMins) / 60).toFixed(1));
  }
  return { totalHours, otHours };
};

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
  const isAdmin = currentUser?.role === 'admin';
  const [staff, setStaff] = useState([]);
  const [depts, setDepts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterEmpType, setFilterEmpType] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const [form, setForm] = useState({
    full_name: '', email: '', password: '', role: 'employee', department_id: '', department_ids: [], phone: '',
    position: '', dob: '', join_date: '', employee_type: 'NS', employee_code: '', employment_status: 'Dang lam viec', avatar_url: '',
    parking_location: 'Tòa 17T10 Nguyễn Thị Định', vehicle_info: '',
  });
  const [submitting, setSubmitting] = useState(false);

  // Reset Code & Detail Modal States
  const [resetCodeModal, setResetCodeModal] = useState(null); // { user, code }
  const [viewingStaffDetail, setViewingStaffDetail] = useState(null);
  const [fullAvatarImage, setFullAvatarImage] = useState(null);
  const [userDevices, setUserDevices] = useState(null);
  const [loadingDevices, setLoadingDevices] = useState(false);

  const loadUserDevices = async (userId) => {
    if (!isAdmin) return;
    try {
      setLoadingDevices(true);
      const { data } = await api.get(`/users/${userId}/devices`);
      setUserDevices(data);
    } catch { setUserDevices(null); }
    finally { setLoadingDevices(false); }
  };

  const handleSetTrustDevice = async (userId, sessionId) => {
    try {
      const { data } = await api.put(`/users/${userId}/devices/${sessionId}/trust`);
      toast.success(data.message || 'Đã thiết lập máy chính!');
      loadUserDevices(userId);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Lỗi thiết lập máy chính');
    }
  };

  const handleDeleteUserDevice = async (userId, sessionId) => {
    try {
      const { data } = await api.delete(`/users/${userId}/devices/${sessionId}`);
      toast.success(data.message || 'Đã xóa thiết bị!');
      loadUserDevices(userId);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Lỗi xóa thiết bị');
    }
  };

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

  useEffect(() => {
    if (viewingStaffDetail?._id) {
      loadUserDevices(viewingStaffDetail._id);
    } else {
      setUserDevices(null);
    }
  }, [viewingStaffDetail]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [resUsers, resDepts] = await Promise.all([
        api.get('/users'),
        api.get('/departments'),
      ]);
      setStaff(resUsers.data || []);
      setDepts(resDepts.data || []);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Lỗi tải danh sách nhân viên');
    } finally { setLoading(false); }
  };

  const handleGenerateResetCode = async (user) => {
    try {
      const { data } = await api.post('/auth/forgot-password', { email: user.email });
      setResetCodeModal({ user, code: data.reset_code });
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Lỗi tạo mã reset mật khẩu');
    }
  };

  const adjustTimeString = (timeStr, deltaMinutes) => {
    if (!timeStr) timeStr = '08:30';
    const parts = timeStr.split(':').map(Number);
    let totalMins = (parts[0] || 0) * 60 + (parts[1] || 0) + deltaMinutes;
    if (totalMins < 0) totalMins = 0;
    if (totalMins > 23 * 60 + 59) totalMins = 23 * 60 + 59;
    const hh = String(Math.floor(totalMins / 60)).padStart(2, '0');
    const mm = String(totalMins % 60).padStart(2, '0');
    return `${hh}:${mm}`;
  };

  const computeLiveSummary = (inTime, outTime, workEndTime = '18:30') => {
    if (!inTime || !outTime) return null;
    const [inH, inM] = inTime.split(':').map(Number);
    const [outH, outM] = outTime.split(':').map(Number);
    const inMins = inH * 60 + inM;
    const outMins = outH * 60 + outM;
    if (outMins <= inMins) return { totalHours: 0, otHours: 0 };
    const diffMins = outMins - inMins;
    const totalHours = parseFloat((diffMins / 60).toFixed(1));

    const [endH, endM] = (workEndTime || '18:30').split(':').map(Number);
    const endMins = endH * 60 + endM;
    let otHours = 0;
    if (outMins > endMins) {
      otHours = parseFloat(((outMins - endMins) / 60).toFixed(1));
    }
    return { totalHours, otHours };
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

  const [sortBy, setSortBy] = useState('name_asc'); // 'name_asc' | 'name_desc' | 'date_desc' | 'date_asc' | 'code_asc'

  const normalizeStr = (str) => {
    if (!str) return '';
    return String(str).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  };

  const normalizeStatus = (st) => {
    if (!st) return 'dang_lam_viec';
    const norm = normalizeStr(st);
    if (norm.includes('da nghi') || norm.includes('nghi viec') || norm.includes('resigned') || norm.includes('inactive')) return 'da_nghi_viec';
    if (norm.includes('nghi om')) return 'nghi_om';
    if (norm.includes('thai san')) return 'nghi_thai_san';
    if (norm.includes('khac')) return 'khac';
    return 'dang_lam_viec';
  };

  const filtered = staff.filter(s => {
    // 1. Tìm kiếm (có dấu hoặc không dấu)
    const qRaw = search.trim().toLowerCase();
    const qNorm = normalizeStr(qRaw);

    let matchSearch = true;
    if (qRaw) {
      const searchPool = [
        s.full_name,
        s.email,
        s.employee_code,
        s.phone,
        s.position,
        s.department_name,
        s.hometown,
        s.parking_location,
        s.vehicle_info,
        s.license_plate,
        s.cccd
      ].filter(Boolean);

      matchSearch = searchPool.some(field => {
        const fieldStr = String(field).toLowerCase();
        const fieldNorm = normalizeStr(fieldStr);
        return fieldStr.includes(qRaw) || fieldNorm.includes(qNorm);
      });
    }

    // 2. Lọc theo Phòng Ban (Hỗ trợ cả multi-dept và single dept, ép kiểu String)
    let matchDept = true;
    if (filterDept) {
      const targetDeptId = String(filterDept);
      const userDeptIds = (s.department_ids && s.department_ids.length > 0)
        ? s.department_ids.map(d => String(d?._id || d))
        : (s.department_id ? [String(s.department_id?._id || s.department_id)] : []);

      matchDept = userDeptIds.includes(targetDeptId);
    }

    // 3. Lọc theo Vai Trò (Admin / Leader / Nhân viên + legacy mapping)
    let matchRole = true;
    if (filterRole) {
      if (filterRole === 'admin') {
        matchRole = s.role === 'admin';
      } else if (filterRole === 'leader' || filterRole === 'manager') {
        matchRole = s.role === 'leader' || s.role === 'manager';
      } else if (filterRole === 'employee' || filterRole === 'staff') {
        matchRole = s.role === 'employee' || s.role === 'staff' || !s.role;
      } else {
        matchRole = s.role === filterRole;
      }
    }

    // 4. Lọc theo Trạng Thái (Chuẩn hóa không dấu: Đang làm việc / Đã nghỉ việc / Nghỉ ốm / Nghỉ thai sản)
    let matchStatus = true;
    if (filterStatus) {
      const userNormStatus = normalizeStatus(s.employment_status);
      if (filterStatus === 'Dang lam viec') {
        matchStatus = userNormStatus === 'dang_lam_viec' && s.is_active !== false;
      } else if (filterStatus === 'Da nghi viec') {
        matchStatus = userNormStatus === 'da_nghi_viec' || s.is_active === false;
      } else if (filterStatus === 'Nghi om') {
        matchStatus = userNormStatus === 'nghi_om';
      } else if (filterStatus === 'Nghi thai san') {
        matchStatus = userNormStatus === 'nghi_thai_san';
      } else {
        matchStatus = normalizeStr(s.employment_status) === normalizeStr(filterStatus);
      }
    }

    // 5. Lọc theo Loại Nhân Sự (NS / TV / TTS)
    const matchEmpType = !filterEmpType || (s.employee_type || 'NS') === filterEmpType;

    return matchSearch && matchDept && matchRole && matchStatus && matchEmpType;
  }).sort((a, b) => {
    if (sortBy === 'name_asc') {
      return (a.full_name || '').localeCompare(b.full_name || '', 'vi');
    } else if (sortBy === 'name_desc') {
      return (b.full_name || '').localeCompare(a.full_name || '', 'vi');
    } else if (sortBy === 'date_desc') {
      const dateB = b.join_date ? new Date(b.join_date) : new Date(b.created_at || 0);
      const dateA = a.join_date ? new Date(a.join_date) : new Date(a.created_at || 0);
      return dateB - dateA;
    } else if (sortBy === 'date_asc') {
      const dateB = b.join_date ? new Date(b.join_date) : new Date(b.created_at || 0);
      const dateA = a.join_date ? new Date(a.join_date) : new Date(a.created_at || 0);
      return dateA - dateB;
    } else if (sortBy === 'code_asc') {
      return (a.employee_code || '').localeCompare(b.employee_code || '', 'vi');
    }
    return 0;
  });

  const openCreate = () => {
    setEditing(null);
    setForm({
      full_name: '', email: '', password: '', role: 'employee', department_id: '', department_ids: [], phone: '',
      position: '', dob: '', join_date: '', employee_type: 'NS', employee_code: '', employment_status: 'Dang lam viec', avatar_url: '',
      parking_location: 'Tòa 17T10 Nguyễn Thị Định', vehicle_info: '', is_attendance_exempt: false,
    });
    setShowForm(true);
  };

  const openEdit = (user) => {
    if (user.role === 'admin' && currentUser?.role !== 'admin') {
      toast.error('Leader không có quyền sửa thông tin của tài khoản Admin.');
      return;
    }
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
      position: user.position || '',
      dob: user.dob || '',
      join_date: user.join_date || (user.start_year ? `${user.start_year}-01-01` : ''),
      employee_type: user.employee_type || 'NS',
      employee_code: user.employee_code || '',
      employment_status: user.employment_status || 'Dang lam viec',
      avatar_url: user.avatar_url || '',
      parking_location: user.parking_location || 'Tòa 17T10 Nguyễn Thị Định',
      vehicle_info: user.vehicle_info || user.license_plate || '',
      is_attendance_exempt: Boolean(user.is_attendance_exempt),
    });
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!form.full_name || !form.email) { toast.error('Vui lòng nhập tên và email'); return; }
    if (!editing && !form.password) { toast.error('Vui lòng nhập mật khẩu'); return; }
    if (!editing && form.password.length < 6) { toast.error('Mật khẩu phải ít nhất 6 ký tự'); return; }

    if ((form.role === 'leader' || form.role === 'manager') && (!form.department_ids || form.department_ids.length === 0)) {
      toast.error('Khi chọn vai trò Leader, bắt buộc phải chọn ít nhất 1 phòng ban quản lý!');
      return;
    }

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
    if (user.role === 'admin' && currentUser?.role !== 'admin') {
      toast.error('Leader không có quyền xóa tài khoản Admin.');
      return;
    }
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
    if (user.role === 'admin' && currentUser?.role !== 'admin') {
      toast.error('Leader không có quyền vô hiệu hóa tài khoản Admin.');
      return;
    }
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

  const handleExportVehicleList = () => {
    if (staff.length === 0) {
      toast.error('Không có dữ liệu nhân viên để xuất');
      return;
    }

    const headers = ['STT', 'Mã Nhân Sự', 'Họ Và Tên', 'Email', 'Số Điện Thoại', 'Phòng Ban', 'Chức Danh', 'Địa Điểm Gửi Xe', 'Mô Tả Xe - Biển Số', 'Ngày Vào Cty'];
    const rows = staff.map((s, idx) => [
      idx + 1,
      s.employee_code || `NS-${idx + 1}`,
      `"${(s.full_name || '').replace(/"/g, '""')}"`,
      s.email || '',
      `"${s.phone || ''}"`,
      `"${(s.department_name || '').replace(/"/g, '""')}"`,
      `"${(s.position || '').replace(/"/g, '""')}"`,
      `"${(s.parking_location || 'Tòa 17T10 Nguyễn Thị Định').replace(/"/g, '""')}"`,
      `"${(s.vehicle_info || s.license_plate || 'Chưa cập nhật').replace(/"/g, '""')}"`,
      s.join_date || (s.start_year ? `Năm ${s.start_year}` : '')
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Danh_Sach_Xe_Gui_Toa_Nha_17T10_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Đã tải xuống danh sách gửi xe tòa 17T10 thành công! 📄');
  };

  const activeCount = staff.filter(s => normalizeStatus(s.employment_status) === 'dang_lam_viec' && s.is_active !== false).length;
  const resignedCount = staff.filter(s => normalizeStatus(s.employment_status) === 'da_nghi_viec' || s.is_active === false).length;
  const sickCount = staff.filter(s => normalizeStatus(s.employment_status) === 'nghi_om').length;
  const matCount = staff.filter(s => normalizeStatus(s.employment_status) === 'nghi_thai_san').length;

  const adminCount = staff.filter(s => s.role === 'admin').length;
  const mgCount = staff.filter(s => s.role === 'manager' || s.role === 'leader').length;
  const empCount = staff.filter(s => s.role === 'employee' || s.role === 'staff' || !s.role).length;

  const nsCount = staff.filter(s => (s.employee_type || 'NS') === 'NS').length;
  const tvCount = staff.filter(s => s.employee_type === 'TV').length;
  const ttsCount = staff.filter(s => s.employee_type === 'TTS').length;

  const isFiltered = Boolean(search || filterRole || filterStatus || filterEmpType || filterDept);

  const handleResetFilters = () => {
    setSearch('');
    setFilterRole('');
    setFilterStatus('');
    setFilterEmpType('');
    setFilterDept('');
    setSortBy('name_asc');
  };

  return (
    <div className="page">
      <div className="header">
        <div className="header__inner">
          <div>
            <div className="header__title">Nhân viên</div>
            <div className="header__subtitle">
              {activeCount} đang làm việc · {resignedCount > 0 ? `${resignedCount} đã nghỉ · ` : ''}{depts.length} phòng ban
            </div>
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <button
              onClick={handleExportVehicleList}
              className="btn btn--ghost"
              style={{ padding: '6px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--primary)' }}
              title="Xuất danh sách gửi xe tòa 17T10 (CSV / Excel)"
            >
              <Download size={14} /> DS Gửi Xe (17T10)
            </button>
            {isAdmin && (
              <button onClick={openCreate} className="btn btn--primary" style={{ padding: '6px 12px', fontSize: '13px' }}>
                <Plus size={14} /> Thêm mới
              </button>
            )}
            <HeaderActions />
          </div>
        </div>
      </div>

      <div className="container" style={{ paddingTop: '14px' }}>
        {/* Interactive KPI Summary Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '12px' }}>
          <div
            onClick={() => setFilterStatus(filterStatus === 'Dang lam viec' ? '' : 'Dang lam viec')}
            className="card card--interactive"
            style={{
              background: filterStatus === 'Dang lam viec' ? 'var(--green-soft)' : 'var(--bg-card)',
              borderRadius: '10px', padding: '10px', textAlign: 'center',
              border: filterStatus === 'Dang lam viec' ? '2px solid var(--green)' : '1px solid var(--border)',
              cursor: 'pointer'
            }}
          >
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--green)' }}>{activeCount}</div>
            <div style={{ fontSize: '11px', color: 'var(--text)', fontWeight: 700, marginTop: '2px' }}>🟢 Đang làm việc</div>
          </div>

          <div
            onClick={() => setFilterStatus(filterStatus === 'Da nghi viec' ? '' : 'Da nghi viec')}
            className="card card--interactive"
            style={{
              background: filterStatus === 'Da nghi viec' ? 'rgba(150, 150, 150, 0.15)' : 'var(--bg-card)',
              borderRadius: '10px', padding: '10px', textAlign: 'center',
              border: filterStatus === 'Da nghi viec' ? '2px solid var(--text-muted)' : '1px solid var(--border)',
              cursor: 'pointer'
            }}
          >
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-secondary)' }}>{resignedCount}</div>
            <div style={{ fontSize: '11px', color: 'var(--text)', fontWeight: 700, marginTop: '2px' }}>⚪ Đã nghỉ việc</div>
          </div>

          <div
            onClick={() => setFilterRole(filterRole === 'leader' ? '' : 'leader')}
            className="card card--interactive"
            style={{
              background: filterRole === 'leader' ? 'var(--yellow-soft)' : 'var(--bg-card)',
              borderRadius: '10px', padding: '10px', textAlign: 'center',
              border: filterRole === 'leader' ? '2px solid var(--yellow)' : '1px solid var(--border)',
              cursor: 'pointer'
            }}
          >
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--yellow)' }}>{mgCount + adminCount}</div>
            <div style={{ fontSize: '11px', color: 'var(--text)', fontWeight: 700, marginTop: '2px' }}>👑 Leader & QTV</div>
          </div>
        </div>

        {/* Search + Multi-type Filters */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
          <div style={{ position: 'relative', width: '100%' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '30px', padding: '8px 10px 8px 30px', fontSize: '13px' }}
              placeholder="🔍 Tìm kiếm theo Tên, Mã NS, Email, SĐT, Biển số xe, Nơi gửi..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
            <select className="form-input" style={{ width: 'auto', padding: '6px 8px', fontSize: '12px', flexShrink: 0, fontWeight: 600, color: 'var(--primary)' }} value={sortBy} onChange={e => setSortBy(e.target.value)}>
              <option value="name_asc">🔤 Tên A → Z</option>
              <option value="name_desc">🔤 Tên Z → A</option>
              <option value="date_desc">📅 Ngày vào (Mới nhất)</option>
              <option value="date_asc">📅 Ngày vào (Cũ nhất)</option>
              <option value="code_asc">🏷️ Mã nhân viên</option>
            </select>

            {/* Role Filter with Dynamic Counts */}
            <select className="form-input" style={{ width: 'auto', padding: '6px 8px', fontSize: '12px', flexShrink: 0, fontWeight: filterRole ? 700 : 500 }} value={filterRole} onChange={e => setFilterRole(e.target.value)}>
              <option value="">👤 Vai trò: Tất cả ({staff.length})</option>
              <option value="employee">Nhân viên ({empCount})</option>
              <option value="leader">Leader ({mgCount})</option>
              <option value="admin">Admin ({adminCount})</option>
            </select>

            {/* Status Filter with Dynamic Counts */}
            <select className="form-input" style={{ width: 'auto', padding: '6px 8px', fontSize: '12px', flexShrink: 0, fontWeight: filterStatus ? 700 : 500 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">📌 Trạng thái: Tất cả ({staff.length})</option>
              <option value="Dang lam viec">🟢 Đang làm việc ({activeCount})</option>
              <option value="Da nghi viec">⚪ Đã nghỉ việc ({resignedCount})</option>
              {sickCount > 0 && <option value="Nghi om">🟡 Nghỉ ốm ({sickCount})</option>}
              {matCount > 0 && <option value="Nghi thai san">🔵 Nghỉ thai sản ({matCount})</option>}
            </select>

            {/* Employee Type Filter with Dynamic Counts */}
            <select className="form-input" style={{ width: 'auto', padding: '6px 8px', fontSize: '12px', flexShrink: 0, fontWeight: filterEmpType ? 700 : 500 }} value={filterEmpType} onChange={e => setFilterEmpType(e.target.value)}>
              <option value="">🏷️ Loại NS: Tất cả ({staff.length})</option>
              <option value="NS">NS - Chính thức ({nsCount})</option>
              <option value="TV">TV - Thử việc ({tvCount})</option>
              <option value="TTS">TTS - Thực tập sinh ({ttsCount})</option>
            </select>
          </div>
        </div>

        {/* Dept filter chips with Dynamic Counts */}
        {depts.length > 1 ? (
          <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', overflowX: 'auto', paddingBottom: '2px' }}>
            <button onClick={() => setFilterDept('')} className={`chip${!filterDept ? ' active' : ''}`}>
              Tất cả phòng ban ({staff.length})
            </button>
            {depts.map(d => {
              const dIdStr = String(d._id);
              const countInDept = staff.filter(s => {
                const userDeptIds = (s.department_ids && s.department_ids.length > 0)
                  ? s.department_ids.map(item => String(item?._id || item))
                  : (s.department_id ? [String(s.department_id?._id || s.department_id)] : []);
                return userDeptIds.includes(dIdStr);
              }).length;

              return (
                <button key={d._id} onClick={() => setFilterDept(d._id)} className={`chip${filterDept === d._id ? ' active' : ''}`}>
                  {d.name} ({countInDept})
                </button>
              );
            })}
          </div>
        ) : depts.length === 1 ? (
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span>🏢 Phòng ban:</span> <span className="chip active" style={{ fontSize: '11px', padding: '3px 10px' }}>{depts[0].name} ({staff.length})</span>
          </div>
        ) : null}

        {/* Filter Result Counter & Reset Button */}
        {isFiltered && (
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: 'var(--bg-raised)', padding: '6px 12px', borderRadius: '8px',
            border: '1px solid var(--border)', fontSize: '12px', marginBottom: '12px'
          }}>
            <span style={{ color: 'var(--text-secondary)' }}>
              Đang lọc: <strong style={{ color: 'var(--primary)' }}>{filtered.length}</strong> / {staff.length} nhân sự
            </span>
            <button
              onClick={handleResetFilters}
              style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: '11.5px', fontWeight: 700 }}
            >
              ✕ Xóa bộ lọc
            </button>
          </div>
        )}

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
              const empStatusColor = { 'Dang lam viec': 'badge--success', 'Da nghi viec': 'badge--neutral', 'Nghi om': 'badge--warning', 'Nghi thai san': 'badge--info', 'Khac': 'badge--neutral' }[u.employment_status] || 'badge--neutral';

              return (
                <div
                  key={u._id}
                  onClick={() => setViewingStaffDetail(u)}
                  className="card card--interactive animate-fade-in"
                  style={{ padding: '12px 14px', borderLeft: u.is_active === false ? '3px solid var(--border)' : '3px solid var(--primary)', cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {u.avatar_url ? (
                      <img
                        src={u.avatar_url}
                        alt={u.full_name}
                        style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '2px solid var(--primary)' }}
                        onError={e => { e.target.onerror=null; e.target.src=''; }}
                      />
                    ) : (
                      <div className="avatar" style={{ width: 44, height: 44, background: isInactive ? 'var(--text-muted)' : 'var(--primary)', flexShrink: 0, fontSize: '15px' }}>{initials}</div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '14px', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {u.full_name}
                        </span>
                        <span className={`badge ${roleCfg.cls}`} style={{ fontSize: '10px' }}>{roleCfg.label}</span>
                        {u.is_attendance_exempt && (
                          <span className="badge" style={{ fontSize: '10px', background: 'rgba(99, 102, 241, 0.15)', color: 'var(--primary)', fontWeight: 800 }}>
                            🛡️ Miễn chấm công
                          </span>
                        )}
                        {u.employee_type && <span className="badge badge--neutral" style={{ fontSize: '10px' }}>{u.employee_type}</span>}
                        {u.employment_status && u.employment_status !== 'Dang lam viec' && <span className={`badge ${empStatusColor}`} style={{ fontSize: '10px' }}>{u.employment_status}</span>}
                        {isInactive && <span className="badge badge--neutral" style={{ fontSize: '10px' }}>Đã khóa</span>}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '2px' }}>
                        {u.employee_code && <span style={{ fontWeight: 600, color: 'var(--primary)' }}>#{u.employee_code}</span>}
                        <span>{u.email}</span>
                        {u.phone && <span>📱 {u.phone}</span>}
                        <span>🏢 {deptName}</span>
                        {u.position && <span>💼 {u.position}</span>}
                        {u.join_date && <span>📅 Vào: {u.join_date}</span>}
                        {(u.vehicle_info || u.license_plate) && (
                          <span style={{ color: 'var(--primary)', fontWeight: 500 }}>
                            🛵 {u.vehicle_info || u.license_plate}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions (Admin Only) */}
                    <div style={{ display: 'flex', gap: '4px', flexShrink: 0, alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                      {isAdmin ? (
                        <>
                          <button onClick={() => openOverride(u)} title="Sửa giờ chấm công (Admin)" style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '6px', padding: '5px', cursor: 'pointer', color: 'var(--green)', display: 'flex', alignItems: 'center' }}>
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
                          {u._id !== currentUser?._id && (
                            <button
                              onClick={() => handleDelete(u)}
                              title="Xóa vĩnh viễn"
                              style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '6px', padding: '5px', cursor: 'pointer', color: 'var(--red)', display: 'flex', alignItems: 'center' }}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </>
                      ) : (
                        <button
                          onClick={() => { setViewingStaffDetail(u); }}
                          className="btn btn--ghost"
                          style={{ fontSize: '11px', padding: '4px 8px' }}
                        >
                          👁️ Chi tiết
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
          <div
            className="modal-sheet animate-slide-up"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '720px',
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
                  <UserPlus size={22} color="var(--primary)" />
                </div>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text)', margin: 0 }}>
                    {editing ? `Chỉnh Sửa Nhân Viên: ${editing.full_name}` : 'Thêm Nhân Viên Mới'}
                  </h3>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {editing ? `Mã định danh: #${editing.employee_code || 'NS'}` : 'Điền đầy đủ thông tin để tạo hồ sơ và cấp tài khoản nhân sự'}
                  </div>
                </div>
              </div>
              <button onClick={() => setShowForm(false)} className="btn btn--ghost" style={{ padding: '6px 10px', borderRadius: '8px' }}>
                <X size={20} />
              </button>
            </div>

            {/* Row 1: Full name & Email */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontWeight: 700 }}>Họ và Tên *</label>
                <input type="text" className="form-input" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} placeholder="VD: Nguyễn Văn A" />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontWeight: 700 }}>Email đăng nhập *</label>
                <input type="email" className="form-input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="nva@company.com" disabled={Boolean(editing)} />
              </div>
            </div>

            {/* Row 2: Password & Phone */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontWeight: 700 }}>{editing ? 'Mật khẩu mới (bỏ trống nếu giữ nguyên)' : 'Mật khẩu đăng nhập *'}</label>
                <input type="password" className="form-input" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Tối thiểu 6 ký tự" />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontWeight: 700 }}>Số điện thoại liên hệ</label>
                <input type="text" className="form-input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="VD: 0912345678" />
              </div>
            </div>

            {/* Row 3: DOB & Join Date */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontWeight: 700 }}>🎂 Ngày sinh</label>
                <input type="date" className="form-input" value={form.dob} onChange={e => setForm({ ...form, dob: e.target.value })} onClick={e => e.target.showPicker && e.target.showPicker()} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontWeight: 700, color: 'var(--primary)' }}>
                  📅 Ngày vào công ty
                </label>
                <input
                  type="date"
                  className="form-input"
                  value={form.join_date}
                  onChange={e => setForm({ ...form, join_date: e.target.value })}
                  onClick={e => e.target.showPicker && e.target.showPicker()}
                />
              </div>
            </div>

            {/* Row 4: Employee code & Position */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontWeight: 700 }}>🏷️ Mã nhân sự / ID (Tùy chọn)</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.employee_code}
                  onChange={e => setForm({ ...form, employee_code: e.target.value })}
                  placeholder="VD: NS-001, TV-002 (để trống tự sinh)"
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontWeight: 700 }}>👔 Chức vụ / Vị trí</label>
                <input type="text" className="form-input" value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} placeholder="VD: Kiến trúc sư, Kỹ sư MEP..." />
              </div>
            </div>

            {/* Row 5: Employee Type, Employment Status & Role */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontWeight: 700 }}>Loại nhân sự</label>
                <select className="form-select" value={form.employee_type} onChange={e => setForm({ ...form, employee_type: e.target.value })}>
                  <option value="NS">NS - Nhân sự chính thức</option>
                  <option value="TV">TV - Thử việc</option>
                  <option value="TTS">TTS - Thực tập sinh</option>
                </select>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontWeight: 700 }}>Trạng thái làm việc</label>
                <select className="form-select" value={form.employment_status} onChange={e => setForm({ ...form, employment_status: e.target.value })}>
                  <option value="Dang lam viec">Đang làm việc</option>
                  <option value="Da nghi viec">Đã nghỉ việc</option>
                  <option value="Nghi om">Nghỉ ốm</option>
                  <option value="Nghi thai san">Nghỉ thai sản</option>
                  <option value="Khac">Khác</option>
                </select>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontWeight: 700 }}>Vai trò hệ thống *</label>
                <select className="form-select" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                  <option value="employee">Nhân viên (Employee)</option>
                  <option value="leader">Leader (Trưởng nhóm)</option>
                  {currentUser?.role === 'admin' && <option value="admin">Admin (Quản trị viên)</option>}
                </select>
              </div>
            </div>

            {/* Row 5b: Cài đặt miễn chấm công */}
            <div style={{ marginBottom: '14px', padding: '12px 14px', background: form.is_attendance_exempt ? 'rgba(99, 102, 241, 0.08)' : 'var(--bg-raised)', borderRadius: '10px', border: form.is_attendance_exempt ? '1px solid var(--primary)' : '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>🛡️ Miễn chấm công hàng ngày</span>
                  {form.is_attendance_exempt && <span className="badge badge--primary" style={{ fontSize: '10px' }}>ĐANG BẬT</span>}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Dành cho Ban giám đốc, Admin, nhân sự quản lý đặc thù (không bắt buộc điểm danh GPS / Selfie)
                </div>
              </div>
              <label style={{ position: 'relative', display: 'inline-block', width: '42px', height: '24px', flexShrink: 0, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.is_attendance_exempt || false}
                  onChange={e => setForm(f => ({ ...f, is_attendance_exempt: e.target.checked }))}
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span style={{
                  position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                  background: form.is_attendance_exempt ? 'var(--primary)' : 'var(--border)',
                  borderRadius: '24px', transition: '0.2s'
                }}>
                  <span style={{
                    position: 'absolute', content: '""', height: '18px', width: '18px', left: form.is_attendance_exempt ? '21px' : '3px', bottom: '3px',
                    background: '#ffffff', borderRadius: '50%', transition: '0.2s'
                  }} />
                </span>
              </label>
            </div>

            {/* Row 6: Avatar upload */}
            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label className="form-label" style={{ fontWeight: 700 }}>Ảnh đại diện (Avatar)</label>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', background: 'var(--bg-raised)', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                <label className="btn btn--primary" style={{ cursor: 'pointer', padding: '8px 14px', fontSize: '12.5px', whiteSpace: 'nowrap' }}>
                  📸 Chọn ảnh từ thiết bị
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const base64 = await new Promise((resolve, reject) => {
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            const img = new Image();
                            img.onload = () => {
                              const canvas = document.createElement('canvas');
                              const maxDim = 400;
                              let w = img.width, h = img.height;
                              if (w > h) { if (w > maxDim) { h = Math.round((h * maxDim) / w); w = maxDim; } }
                              else { if (h > maxDim) { w = Math.round((w * maxDim) / h); h = maxDim; } }
                              canvas.width = w; canvas.height = h;
                              const ctx = canvas.getContext('2d');
                              ctx.drawImage(img, 0, 0, w, h);
                              resolve(canvas.toDataURL('image/jpeg', 0.8));
                            };
                            img.onerror = reject;
                            img.src = ev.target.result;
                          };
                          reader.onerror = reject;
                          reader.readAsDataURL(file);
                        });
                        setForm(p => ({ ...p, avatar_url: base64 }));
                        toast.success('Đã tải ảnh lên thành công!');
                      } catch {
                        toast.error('Lỗi xử lý file ảnh');
                      }
                    }}
                  />
                </label>
                {form.avatar_url ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <img
                      src={form.avatar_url}
                      alt="avatar"
                      onClick={() => setFullAvatarImage({ url: form.avatar_url, title: form.full_name || 'Ảnh đại diện' })}
                      title="Click để phóng to ảnh"
                      style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--primary)', cursor: 'zoom-in' }}
                    />
                    <button type="button" onClick={() => setForm({ ...form, avatar_url: '' })} className="btn btn--ghost" style={{ padding: '4px 8px', fontSize: '11px', color: 'var(--red)' }}>Xóa ảnh</button>
                  </div>
                ) : (
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Chưa có ảnh (sẽ dùng avatar chữ cái mặc định)</span>
                )}
              </div>
            </div>

            {/* Row 7: Multi-Department Selection */}
            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label className="form-label" style={{ fontWeight: 700 }}>🏢 Phòng ban phụ trách * (Có thể chọn nhiều phòng ban)</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '8px', background: 'var(--bg-raised)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                {depts.map(d => {
                  const checked = (form.department_ids || []).includes(d._id);
                  return (
                    <label key={d._id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: 'var(--text)', padding: '4px 6px', borderRadius: '6px', background: checked ? 'var(--primary-soft)' : 'transparent' }}>
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
                      <span style={{ fontWeight: checked ? 700 : 500 }}>{d.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Row 8: Phương Tiện & Gửi Xe */}
            <div style={{ background: 'var(--bg-raised)', padding: '14px', borderRadius: '12px', border: '1px solid var(--border)', marginBottom: '18px' }}>
              <div style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--primary)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>🛵 Phương Tiện & Địa Điểm Gửi Xe</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontWeight: 700 }}>🏢 Địa điểm gửi xe</label>
                  <input
                    type="text"
                    className="form-input"
                    value={form.parking_location}
                    onChange={e => setForm({ ...form, parking_location: e.target.value })}
                    placeholder="VD: Tòa 17T10 Nguyễn Thị Định"
                  />
                  <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                    {['Tòa 17T10 Nguyễn Thị Định', 'Gửi ngoài', 'Không gửi xe'].map(loc => (
                      <button
                        key={loc}
                        type="button"
                        onClick={() => setForm({ ...form, parking_location: loc })}
                        className="btn btn--ghost"
                        style={{
                          fontSize: '11px',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          background: form.parking_location === loc ? 'var(--primary-soft)' : 'transparent',
                          color: form.parking_location === loc ? 'var(--primary)' : 'var(--text-muted)',
                          borderColor: form.parking_location === loc ? 'var(--primary)' : 'var(--border)'
                        }}
                      >
                        {loc.split(' ')[0]} {loc.split(' ')[1] || ''}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontWeight: 700 }}>🛵 Mô tả xe & Biển số</label>
                  <input
                    type="text"
                    className="form-input"
                    value={form.vehicle_info}
                    onChange={e => setForm({ ...form, vehicle_info: e.target.value })}
                    placeholder="VD: Honda Lead Đỏ - 29E1-456.78"
                  />
                </div>
              </div>
            </div>

            {/* Modal Actions */}
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
                onClick={handleSubmit}
                disabled={submitting}
                className="btn btn--primary"
                style={{ flex: 2, padding: '10px', fontSize: '13px', fontWeight: 800 }}
              >
                {submitting ? <span className="spinner" /> : editing ? '💾 Lưu thay đổi nhân viên' : '🚀 Tạo tài khoản nhân viên'}
              </button>
            </div>
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
      {showOverrideModal && (() => {
        const liveStats = computeLiveSummary(overrideForm.check_in_time, overrideForm.check_out_time, '18:30');

        const shiftStaffFormDate = (offsetDays) => {
          const base = overrideForm.date || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
          const [y, m, d] = base.split('-').map(Number);
          const dt = new Date(y, m - 1, d);
          dt.setDate(dt.getDate() + offsetDays);
          const newDateStr = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
          setOverrideForm({ ...overrideForm, date: newDateStr });
        };

        const applyStaffPreset = (inT, outT, isLateVal = false) => {
          setOverrideForm({
            ...overrideForm,
            check_in_time: inT,
            check_out_time: outT,
            is_late: isLateVal
          });
        };

        return (
          <div className="modal-overlay" onClick={() => setShowOverrideModal(false)}>
            <div
              className="modal-sheet animate-slide-up"
              onClick={e => e.stopPropagation()}
              style={{
                maxWidth: '600px',
                width: '95vw',
                maxHeight: '92vh',
                overflowY: 'auto',
                margin: '0 auto',
                borderRadius: '16px',
                padding: '22px 26px',
                boxShadow: '0 20px 50px rgba(0,0,0,0.35)'
              }}
            >
              <div className="modal-sheet__handle" />
              
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid var(--border-muted)', paddingBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--primary-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Clock size={22} color="var(--primary)" />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'var(--text)' }}>
                      Sửa Giờ Chấm Công
                    </h3>
                    <div style={{ fontSize: '12px', color: 'var(--primary)', marginTop: '2px', fontWeight: 700 }}>
                      {overrideUser?.full_name} (#{overrideUser?.employee_code || 'NS'})
                    </div>
                  </div>
                </div>
                <button onClick={() => setShowOverrideModal(false)} className="btn btn--ghost" style={{ padding: '6px 10px', borderRadius: '8px' }}>
                  <X size={20} />
                </button>
              </div>

              {/* 📅 Date Selector with Quick Switchers */}
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label" style={{ fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>📅 Chọn Ngày Chấm Công</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>Bấm để đổi ngày cần sửa</span>
                </label>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => shiftStaffFormDate(-1)}
                    className="btn btn--ghost"
                    style={{ padding: '6px 10px', fontSize: '12px', height: '36px' }}
                    title="Ngày hôm trước"
                  >
                    ◀ Hôm trước
                  </button>
                  <input
                    type="date"
                    className="form-input"
                    style={{ flex: 1, fontSize: '13px', fontWeight: 800, padding: '7px 10px', height: '36px' }}
                    value={overrideForm.date}
                    onChange={e => setOverrideForm({ ...overrideForm, date: e.target.value })}
                    onClick={e => e.target.showPicker && e.target.showPicker()}
                  />
                  <button
                    type="button"
                    onClick={() => shiftStaffFormDate(1)}
                    className="btn btn--ghost"
                    style={{ padding: '6px 10px', fontSize: '12px', height: '36px' }}
                    title="Ngày hôm sau"
                  >
                    Hôm sau ▶
                  </button>
                  <button
                    type="button"
                    onClick={() => setOverrideForm({ ...overrideForm, date: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }) })}
                    className="btn btn--ghost"
                    style={{ padding: '6px 10px', fontSize: '11.5px', height: '36px', color: 'var(--primary)', fontWeight: 700 }}
                  >
                    Hôm nay
                  </button>
                </div>
              </div>

              {/* ⚡ Quick Shift Presets (1-Click Fill) */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  ⚡ Chọn nhanh mẫu ca làm việc phổ biến:
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {[
                    { label: '🏢 Chuẩn 08:30 - 17:30 (8h)', in: '08:30', out: '17:30', late: false },
                    { label: '🏢 Chuẩn 09:00 - 18:30 (ET)', in: '09:00', out: '18:30', late: false },
                    { label: '🔥 Tăng ca 08:30 - 20:00', in: '08:30', out: '20:00', late: false },
                    { label: '🌓 Sáng 08:30 - 12:00', in: '08:30', out: '12:00', late: false },
                    { label: '🌔 Chiều 13:30 - 17:30', in: '13:30', out: '17:30', late: false },
                  ].map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => applyStaffPreset(p.in, p.out, p.late)}
                      className="btn btn--ghost"
                      style={{
                        fontSize: '11.5px',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        background: (overrideForm.check_in_time === p.in && overrideForm.check_out_time === p.out) ? 'var(--primary-soft)' : 'var(--bg-input)',
                        color: (overrideForm.check_in_time === p.in && overrideForm.check_out_time === p.out) ? 'var(--primary)' : 'var(--text-secondary)',
                        borderColor: (overrideForm.check_in_time === p.in && overrideForm.check_out_time === p.out) ? 'var(--primary)' : 'var(--border)',
                        fontWeight: 600
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Time Pickers (In & Out) with Steppers & Quick Chips */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                {/* 🟢 Giờ vào (Check-in) */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontWeight: 700, display: 'flex', justifyContent: 'space-between' }}>
                    <span>🟢 Giờ vào (Check-in)</span>
                    <span style={{ fontSize: '11px', color: 'var(--green)', fontWeight: 700 }}>{overrideForm.check_in_time || '—'}</span>
                  </label>
                  
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={() => setOverrideForm({ ...overrideForm, check_in_time: adjustTimeString(overrideForm.check_in_time, -15) })}
                      className="btn btn--ghost"
                      style={{ padding: '6px 8px', fontSize: '11.5px', height: '38px' }}
                      title="Giảm 15 phút"
                    >
                      -15p
                    </button>
                    <input
                      type="time"
                      className="form-input"
                      style={{ fontSize: '15px', fontWeight: 800, padding: '6px 8px', height: '38px', textAlign: 'center', flex: 1 }}
                      value={overrideForm.check_in_time}
                      onChange={e => setOverrideForm({ ...overrideForm, check_in_time: e.target.value })}
                      onClick={e => e.target.showPicker && e.target.showPicker()}
                    />
                    <button
                      type="button"
                      onClick={() => setOverrideForm({ ...overrideForm, check_in_time: adjustTimeString(overrideForm.check_in_time, 15) })}
                      className="btn btn--ghost"
                      style={{ padding: '6px 8px', fontSize: '11.5px', height: '38px' }}
                      title="Tăng 15 phút"
                    >
                      +15p
                    </button>
                  </div>

                  {/* Check-in Quick Chips */}
                  <div style={{ display: 'flex', gap: '4px', marginTop: '6px', flexWrap: 'wrap' }}>
                    {['08:00', '08:30', '08:45', '09:00', '09:15'].map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setOverrideForm({ ...overrideForm, check_in_time: t })}
                        className="btn btn--ghost"
                        style={{
                          fontSize: '11px',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: overrideForm.check_in_time === t ? 'var(--primary-soft)' : 'transparent',
                          color: overrideForm.check_in_time === t ? 'var(--primary)' : 'var(--text-muted)',
                          borderColor: overrideForm.check_in_time === t ? 'var(--primary)' : 'var(--border)',
                          fontWeight: overrideForm.check_in_time === t ? 700 : 500
                        }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 🔴 Giờ ra (Check-out) */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontWeight: 700, display: 'flex', justifyContent: 'space-between' }}>
                    <span>🔴 Giờ ra (Check-out)</span>
                    <span style={{ fontSize: '11px', color: 'var(--red)', fontWeight: 700 }}>{overrideForm.check_out_time || '—'}</span>
                  </label>

                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={() => setOverrideForm({ ...overrideForm, check_out_time: adjustTimeString(overrideForm.check_out_time, -15) })}
                      className="btn btn--ghost"
                      style={{ padding: '6px 8px', fontSize: '11.5px', height: '38px' }}
                      title="Giảm 15 phút"
                    >
                      -15p
                    </button>
                    <input
                      type="time"
                      className="form-input"
                      style={{ fontSize: '15px', fontWeight: 800, padding: '6px 8px', height: '38px', textAlign: 'center', flex: 1 }}
                      value={overrideForm.check_out_time}
                      onChange={e => setOverrideForm({ ...overrideForm, check_out_time: e.target.value })}
                      onClick={e => e.target.showPicker && e.target.showPicker()}
                    />
                    <button
                      type="button"
                      onClick={() => setOverrideForm({ ...overrideForm, check_out_time: adjustTimeString(overrideForm.check_out_time, 15) })}
                      className="btn btn--ghost"
                      style={{ padding: '6px 8px', fontSize: '11.5px', height: '38px' }}
                      title="Tăng 15 phút"
                    >
                      +15p
                    </button>
                  </div>

                  {/* Check-out Quick Chips */}
                  <div style={{ display: 'flex', gap: '4px', marginTop: '6px', flexWrap: 'wrap' }}>
                    {['12:00', '17:30', '18:00', '18:30', '19:00', '20:00'].map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setOverrideForm({ ...overrideForm, check_out_time: t })}
                        className="btn btn--ghost"
                        style={{
                          fontSize: '11px',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: overrideForm.check_out_time === t ? 'var(--primary-soft)' : 'transparent',
                          color: overrideForm.check_out_time === t ? 'var(--primary)' : 'var(--text-muted)',
                          borderColor: overrideForm.check_out_time === t ? 'var(--primary)' : 'var(--border)',
                          fontWeight: overrideForm.check_out_time === t ? 700 : 500
                        }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 📊 Live Calculated Summary Badge */}
              {liveStats && (
                <div style={{
                  display: 'flex', justifyContent: 'space-around', alignItems: 'center',
                  background: 'var(--bg-raised)', border: '1px solid var(--border)',
                  borderRadius: '10px', padding: '10px 14px', marginBottom: '14px'
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>⏱️ Tổng Giờ Làm</div>
                    <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--primary)', marginTop: '2px' }}>
                      {liveStats.totalHours} giờ
                    </div>
                  </div>
                  <div style={{ width: '1px', height: '24px', background: 'var(--border)' }} />
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>🔥 Giờ Tăng Ca OT</div>
                    <div style={{ fontSize: '15px', fontWeight: 800, color: liveStats.otHours > 0 ? '#ef4444' : 'var(--text-secondary)', marginTop: '2px' }}>
                      {liveStats.otHours}h OT
                    </div>
                  </div>
                  <div style={{ width: '1px', height: '24px', background: 'var(--border)' }} />
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>🌟 Kỷ Luật</div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: overrideForm.is_late ? 'var(--red)' : 'var(--green)', marginTop: '2px' }}>
                      {overrideForm.is_late ? '🔴 Đi muộn' : '🟢 Đúng giờ'}
                    </div>
                  </div>
                </div>
              )}

              {/* Hình thức & Toggle Đi muộn */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                {/* Hình thức chấm công */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontWeight: 700 }}>🏢 Hình thức làm việc</label>
                  <select
                    className="form-select"
                    value={overrideForm.check_in_type}
                    onChange={e => setOverrideForm({ ...overrideForm, check_in_type: e.target.value })}
                    style={{ padding: '8px 12px', fontSize: '13px' }}
                  >
                    <option value="office">🏢 Văn phòng</option>
                    <option value="site">🏗️ Công trình (CT1)</option>
                    <option value="client">👔 Khách hàng (CT2)</option>
                    <option value="wfh">🏠 Làm từ xa (WFH)</option>
                  </select>
                </div>

                {/* Toggle Đi muộn */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontWeight: 700 }}>⚠️ Ghi nhận đi muộn</label>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      background: overrideForm.is_late ? 'rgba(239, 68, 68, 0.12)' : 'var(--bg-input)',
                      border: overrideForm.is_late ? '1px solid var(--red)' : '1px solid var(--border)',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      height: '38px',
                      transition: 'all 0.2s'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={overrideForm.is_late}
                      onChange={e => setOverrideForm({ ...overrideForm, is_late: e.target.checked })}
                      style={{ width: '16px', height: '16px', accentColor: 'var(--red)' }}
                    />
                    <span style={{ fontSize: '12.5px', fontWeight: overrideForm.is_late ? 700 : 500, color: overrideForm.is_late ? 'var(--red)' : 'var(--text)' }}>
                      {overrideForm.is_late ? '🔴 Đánh dấu Đi muộn' : '🟢 Đi đúng giờ'}
                    </span>
                  </label>
                </div>
              </div>

              {/* Lý do điều chỉnh */}
              <div className="form-group" style={{ marginBottom: '18px' }}>
                <label className="form-label" style={{ fontWeight: 700 }}>📝 Lý do điều chỉnh (Audit Note)</label>
                <input
                  type="text"
                  className="form-input"
                  value={overrideForm.notes}
                  onChange={e => setOverrideForm({ ...overrideForm, notes: e.target.value })}
                  placeholder="VD: Sửa theo giải trình duyệt đơn, lỗi mạng, công tác..."
                  style={{ padding: '8px 12px', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowOverrideModal(false)}
                  className="btn btn--ghost"
                  style={{ flex: 1, padding: '10px', fontSize: '13px', fontWeight: 700 }}
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={handleSaveOverride}
                  disabled={submitting}
                  className="btn btn--primary"
                  style={{ flex: 2, padding: '10px', fontSize: '13px', fontWeight: 800 }}
                >
                  {submitting ? <span className="spinner" /> : '💾 Lưu điều chỉnh'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

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

      {/* Staff Account & Detail Profile Modal */}
      {viewingStaffDetail && (
        <div className="modal-overlay" onClick={() => setViewingStaffDetail(null)}>
          <div className="modal-sheet animate-slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px', margin: '0 auto', padding: '20px 18px' }}>
            <div className="modal-sheet__handle" />

            {/* Title Header Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: 'var(--text)' }}>👤 Hồ Sơ Nhân Viên</h3>
              <button onClick={() => setViewingStaffDetail(null)} className="btn btn--ghost" style={{ padding: '4px 8px' }}><X size={18} /></button>
            </div>

            {/* Avatar Header Section — Clean Block with no title overlap */}
            <div style={{ textAlign: 'center', marginTop: '10px', marginBottom: '20px', clear: 'both' }}>
              <div
                style={{
                  width: '96px', height: '96px', margin: '0 auto 12px',
                  borderRadius: '50%', border: '4px solid var(--primary)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.25)', overflow: 'hidden',
                  display: 'block', background: 'var(--bg-raised)',
                  cursor: viewingStaffDetail.avatar_url ? 'zoom-in' : 'default'
                }}
                onClick={() => {
                  if (viewingStaffDetail.avatar_url) {
                    setFullAvatarImage({ url: viewingStaffDetail.avatar_url, title: viewingStaffDetail.full_name });
                  }
                }}
                title={viewingStaffDetail.avatar_url ? 'Click để xem ảnh lớn' : ''}
              >
                {viewingStaffDetail.avatar_url ? (
                  <img
                    src={viewingStaffDetail.avatar_url}
                    alt={viewingStaffDetail.full_name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                ) : (
                  <div className="avatar" style={{ width: '100%', height: '100%', fontSize: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {viewingStaffDetail.full_name?.split(' ').map(w => w[0]).slice(-2).join('').toUpperCase()}
                  </div>
                )}
              </div>

              <h2 style={{ fontSize: '18px', fontWeight: 800, marginTop: '6px', marginBottom: '2px', color: 'var(--text)' }}>{viewingStaffDetail.full_name}</h2>
              <div style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 700 }}>#{viewingStaffDetail.employee_code || 'NS-000'}</div>
            </div>

            {/* Information Grid */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '18px' }}>
              <div style={{ background: 'var(--bg-input)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Email: </span>
                <strong>{viewingStaffDetail.email}</strong>
              </div>
              <div style={{ background: 'var(--bg-input)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Số điện thoại: </span>
                <strong>{viewingStaffDetail.phone || 'Chưa cập nhật'}</strong>
              </div>
              <div style={{ background: 'var(--bg-input)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Phòng ban: </span>
                <strong>{viewingStaffDetail.department_name || depts.find(d => d._id === viewingStaffDetail.department_id)?.name || 'Chưa phân'}</strong>
              </div>
              <div style={{ background: 'var(--bg-input)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Chức danh: </span>
                <strong>{viewingStaffDetail.position || 'Nhân viên'}</strong>
              </div>
              <div style={{ background: 'var(--bg-input)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-muted)' }}>📅 Ngày vào công ty: </span>
                <strong style={{ color: 'var(--primary)' }}>
                  {viewingStaffDetail.join_date ? viewingStaffDetail.join_date : (viewingStaffDetail.start_year ? `Năm ${viewingStaffDetail.start_year}` : 'Chưa cập nhật')}
                </strong>
              </div>
              <div style={{ background: 'var(--bg-input)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Trạng thái làm việc: </span>
                <strong style={{ color: 'var(--green)' }}>{viewingStaffDetail.employment_status || 'Đang làm việc'}</strong>
              </div>
              <div style={{ background: 'var(--bg-input)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-muted)' }}>⏱️ Chế độ chấm công: </span>
                <strong style={{ color: viewingStaffDetail.is_attendance_exempt ? '#8b5cf6' : 'var(--primary)' }}>
                  {viewingStaffDetail.is_attendance_exempt ? '🛡️ Miễn chấm công (Không bắt buộc điểm danh)' : 'Bắt buộc chấm công GPS / Selfie'}
                </strong>
              </div>
              <div style={{ background: 'var(--bg-input)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-muted)' }}>🏢 Địa điểm gửi xe: </span>
                <strong style={{ color: 'var(--primary)' }}>{viewingStaffDetail.parking_location || 'Tòa 17T10 Nguyễn Thị Định'}</strong>
              </div>
              <div style={{ background: 'var(--bg-input)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-muted)' }}>🛵 Mô tả xe & Biển số: </span>
                <strong style={{ color: 'var(--text)' }}>{viewingStaffDetail.vehicle_info || viewingStaffDetail.license_plate || 'Chưa cập nhật'}</strong>
              </div>
            </div>

            {/* Devices Section — CHỈ ADMIN MỚI XEM ĐƯỢC THIẾT BỊ (Chống chấm hộ & Thiết bị chính) */}
            {isAdmin && (
              <div style={{ marginTop: '14px', marginBottom: '18px', borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
                <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text)', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>📱 Thiết bị đã đăng ký ({userDevices?.sessions?.length || 0})</span>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Chống chấm công hộ (Admin Only)</span>
                </div>

                {loadingDevices ? (
                  <div style={{ textAlign: 'center', padding: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
                    Đang kiểm tra thiết bị...
                  </div>
                ) : !userDevices?.sessions || userDevices.sessions.length === 0 ? (
                  <div style={{ background: 'var(--bg-input)', padding: '10px', borderRadius: '8px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
                    Chưa đăng ký thiết bị chính chủ nào.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {userDevices.sessions.map((sess) => (
                      <div key={sess._id} style={{
                        background: sess.is_trusted ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg-input)',
                        border: sess.is_trusted ? '1.5px solid var(--green)' : '1px solid var(--border)',
                        borderRadius: '10px', padding: '10px 12px', fontSize: '12px'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <strong style={{ color: 'var(--text)', fontSize: '13px' }}>
                            {sess.device_name ? sess.device_name : '💻 Thiết bị phần cứng'}
                          </strong>
                          {sess.is_trusted ? (
                            <span className="badge badge--success" style={{ fontSize: '10px', fontWeight: 800 }}>⭐ MÁY CHÍNH CHỦ</span>
                          ) : (
                            <span className="badge badge--warning" style={{ fontSize: '10px', fontWeight: 700 }}>⚠️ Thiết bị phụ</span>
                          )}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '11px', color: 'var(--text-secondary)', background: 'var(--bg-card)', padding: '6px 8px', borderRadius: '6px', marginBottom: '8px', border: '1px solid var(--border-muted)' }}>
                          <div><strong>🔑 Mã vân tay (ID):</strong> <code style={{ fontSize: '10px', color: 'var(--primary)' }}>{sess.device_fingerprint ? sess.device_fingerprint.slice(0, 16) + '...' : '—'}</code></div>
                          {sess.screen_info && <div><strong>🖥️ Màn hình:</strong> {sess.screen_info} px</div>}
                          <div><strong>🕒 Check-in lần cuối:</strong> {new Date(sess.last_used_at).toLocaleString('vi-VN')} ({sess.check_in_count || 1} lần điểm danh)</div>
                        </div>

                        <div style={{ display: 'flex', gap: '6px' }}>
                          {!sess.is_trusted && (
                            <button
                              onClick={() => handleSetTrustDevice(viewingStaffDetail._id, sess._id)}
                              className="btn btn--ghost"
                              style={{ padding: '4px 10px', fontSize: '11px', color: 'var(--green)', borderColor: 'var(--green)', fontWeight: 700 }}
                            >
                              ⭐ Đặt làm máy chính
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteUserDevice(viewingStaffDetail._id, sess._id)}
                            className="btn btn--ghost"
                            style={{ padding: '4px 10px', fontSize: '11px', color: 'var(--red)', borderColor: 'var(--red)' }}
                          >
                            🗑️ Xóa thiết bị này
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setViewingStaffDetail(null)} className="btn btn--ghost btn--full">Đóng</button>
              <button
                onClick={() => {
                  const target = viewingStaffDetail;
                  setViewingStaffDetail(null);
                  openEdit(target);
                }}
                className="btn btn--primary btn--full"
              >
                ✏️ Chỉnh sửa tài khoản
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
            <div style={{ color: '#fff', marginTop: '12px', fontSize: '14px', fontWeight: 700 }}>
              📸 {fullAvatarImage.title}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
