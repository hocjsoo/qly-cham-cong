// src/pages/VehiclesPage.jsx
// Trang Quản Lý Phương Tiện & Gửi Xe (Tòa 17T10) — Chuyên Biệt Cho Admin & Leader

import { useState, useEffect } from 'react';
import { Search, Edit2, Download, Bike, Car, Building2, Phone, X, LayoutList, LayoutGrid, CheckCircle2, AlertCircle, Mail, Calendar, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import useAuthStore from '../stores/authStore';
import HeaderActions from '../components/HeaderActions';

const isCurrentlyWorking = (s) => {
  if (!s) return false;
  if (s.is_active === false) return false;

  const rawStatus = String(s.employment_status || '').trim();
  if (!rawStatus) return true;

  // Bỏ dấu tiếng Việt để so sánh chính xác: "Đã nghỉ việc" -> "da nghi viec", "Da nghi viec" -> "da nghi viec"
  const normalized = rawStatus.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  // Kiểm tra từ khóa nghỉ việc / nghỉ hẳn / không hoạt động
  if (
    normalized.includes('da nghi') ||
    normalized.includes('nghi viec') ||
    normalized.includes('resigned') ||
    normalized.includes('inactive') ||
    normalized.includes('quit') ||
    normalized.includes('thoi viec') ||
    normalized.includes('nghi han')
  ) {
    return false;
  }

  return true;
};

export default function VehiclesPage() {
  const { user: currentUser } = useAuthStore();
  const isAdmin = currentUser?.role === 'admin';
  const isAdminOrManager = ['admin', 'leader', 'manager'].includes(currentUser?.role);
  const [staff, setStaff] = useState([]);
  const [depts, setDepts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterLocation, setFilterLocation] = useState('all');
  const [filterDept, setFilterDept] = useState('all');
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'grid'

  // Staff Profile Modal & Lightbox State
  const [viewingStaffDetail, setViewingStaffDetail] = useState(null);
  const [fullAvatarImage, setFullAvatarImage] = useState(null);

  // Quick Edit Modal State
  const [editingStaff, setEditingStaff] = useState(null);
  const [editForm, setEditForm] = useState({ parking_location: '', vehicle_info: '' });
  const [submittingEdit, setSubmittingEdit] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [resUsers, resDepts] = await Promise.all([
        api.get('/users?active_only=true'),
        api.get('/departments'),
      ]);
      const allUsers = Array.isArray(resUsers.data) ? resUsers.data : (Array.isArray(resUsers.data?.users) ? resUsers.data.users : []);
      // Lọc đa tầng để đảm bảo 100% không còn nhân sự đã nghỉ việc
      const activeStaff = allUsers.filter(isCurrentlyWorking);
      setStaff(activeStaff);
      setDepts(Array.isArray(resDepts.data) ? resDepts.data : []);
    } catch {
      toast.error('Lỗi tải danh sách phương tiện');
    } finally {
      setLoading(false);
    }
  };

  const openQuickEdit = (staffMember) => {
    setEditingStaff(staffMember);
    setEditForm({
      parking_location: staffMember.parking_location || 'Tòa 17T10 Nguyễn Thị Định',
      vehicle_info: staffMember.vehicle_info || staffMember.license_plate || '',
    });
  };

  const handleSaveQuickEdit = async () => {
    if (!editingStaff) return;
    setSubmittingEdit(true);
    try {
      const targetId = editingStaff._id || editingStaff.id;
      await api.put(`/users/${targetId}`, {
        parking_location: editForm.parking_location ? editForm.parking_location.trim() : 'Tòa 17T10 Nguyễn Thị Định',
        vehicle_info: editForm.vehicle_info ? editForm.vehicle_info.trim() : null,
      });

      toast.success(`Đã cập nhật xe cho ${editingStaff.full_name}! 🛵`);
      setEditingStaff(null);
      loadData();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Lỗi cập nhật thông tin');
    } finally {
      setSubmittingEdit(false);
    }
  };

  const handleExportCSV = () => {
    if (staff.length === 0) {
      toast.error('Không có dữ liệu để xuất');
      return;
    }

    const headers = ['STT', 'Mã Nhân Sự', 'Họ Và Tên', 'Email', 'Số Điện Thoại', 'Phòng Ban', 'Chức Danh', 'Địa Điểm Gửi Xe', 'Mô Tả Xe - Biển Số', 'Ngày Vào Cty'];
    const rows = filteredStaff.map((s, idx) => [
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
    link.download = `DS_Gui_Xe_Toa_Nha_17T10_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Đã xuất file nộp BQL Tòa 17T10 thành công! 📄');
  };

  // KPI Statistics
  const count17T10 = staff.filter(s => (s.parking_location || '').includes('17T10') && (s.vehicle_info || s.license_plate)).length;
  const countOutside = staff.filter(s => (s.parking_location || '').includes('Gửi ngoài') || (s.parking_location || '').includes('ngoài')).length;
  const countNoVehicle = staff.filter(s => (s.parking_location || '').includes('Không') || (s.parking_location || '').includes('không')).length;
  const countMissing = staff.filter(s => !s.vehicle_info && !s.license_plate && !(s.parking_location || '').includes('Không')).length;

  // Filtered List
  const filteredStaff = staff.filter(s => {
    const q = search.trim().toLowerCase();
    const matchSearch = !q ||
      s.full_name?.toLowerCase().includes(q) ||
      s.employee_code?.toLowerCase().includes(q) ||
      s.email?.toLowerCase().includes(q) ||
      s.phone?.includes(q) ||
      s.parking_location?.toLowerCase().includes(q) ||
      s.vehicle_info?.toLowerCase().includes(q) ||
      s.license_plate?.toLowerCase().includes(q);

    let matchLocation = true;
    if (filterLocation === '17T10') {
      matchLocation = (s.parking_location || '').includes('17T10') && (s.vehicle_info || s.license_plate);
    } else if (filterLocation === 'outside') {
      matchLocation = (s.parking_location || '').toLowerCase().includes('ngoài');
    } else if (filterLocation === 'none') {
      matchLocation = (s.parking_location || '').toLowerCase().includes('không');
    } else if (filterLocation === 'missing') {
      matchLocation = !s.vehicle_info && !s.license_plate && !(s.parking_location || '').toLowerCase().includes('không');
    }

    const userDeptIds = s.department_ids?.map(d => d._id || d) || [s.department_id?._id || s.department_id];
    const matchDept = filterDept === 'all' || userDeptIds.includes(filterDept);

    return matchSearch && matchLocation && matchDept;
  });

  return (
    <div className="page">
      {/* Header */}
      <div className="header">
        <div className="header__inner header__inner--wide">
          <div>
            <div className="header__title">Quản Lý Gửi Xe & Phương Tiện</div>
            <div className="header__subtitle">Tòa 17T10 Nguyễn Thị Định · {staff.length} nhân sự</div>
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <button
              onClick={handleExportCSV}
              className="btn btn--primary"
              style={{ padding: '7px 12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '5px' }}
              title="Xuất file nộp BQL Tòa 17T10"
            >
              <Download size={15} /> Xuất BQL 17T10
            </button>
            <HeaderActions />
          </div>
        </div>
      </div>

      <div className="container container--wide" style={{ paddingTop: '16px' }}>
        {/* Top KPI Summary Cards */}
        <div className="kpi-grid-4" style={{ marginBottom: '14px' }}>
          <div
            onClick={() => setFilterLocation(filterLocation === '17T10' ? 'all' : '17T10')}
            className="card card--interactive"
            style={{
              padding: '12px', textAlign: 'center', cursor: 'pointer',
              border: filterLocation === '17T10' ? '2px solid var(--primary)' : '1px solid var(--border)',
              background: filterLocation === '17T10' ? 'var(--primary-subtle, rgba(59, 130, 246, 0.15))' : 'var(--bg-card)'
            }}
          >
            <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--primary)' }}>{count17T10}</div>
            <div style={{ fontSize: '11px', color: 'var(--text)', fontWeight: 700, marginTop: '2px' }}>🏢 Gửi Tòa 17T10</div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Cần đóng vé tháng</div>
          </div>

          <div
            onClick={() => setFilterLocation(filterLocation === 'outside' ? 'all' : 'outside')}
            className="card card--interactive"
            style={{
              padding: '12px', textAlign: 'center', cursor: 'pointer',
              border: filterLocation === 'outside' ? '2px solid var(--yellow)' : '1px solid var(--border)',
              background: filterLocation === 'outside' ? 'rgba(234, 179, 8, 0.15)' : 'var(--bg-card)'
            }}
          >
            <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--yellow)' }}>{countOutside}</div>
            <div style={{ fontSize: '11px', color: 'var(--text)', fontWeight: 700, marginTop: '2px' }}>🅿️ Gửi Ngoài</div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Tự túc bãi ngoài</div>
          </div>

          <div
            onClick={() => setFilterLocation(filterLocation === 'none' ? 'all' : 'none')}
            className="card card--interactive"
            style={{
              padding: '12px', textAlign: 'center', cursor: 'pointer',
              border: filterLocation === 'none' ? '2px solid var(--text-muted)' : '1px solid var(--border)',
              background: filterLocation === 'none' ? 'rgba(150, 150, 150, 0.15)' : 'var(--bg-card)'
            }}
          >
            <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-secondary)' }}>{countNoVehicle}</div>
            <div style={{ fontSize: '11px', color: 'var(--text)', fontWeight: 700, marginTop: '2px' }}>🚫 Không Gửi Xe</div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Đi bộ / Bus / Grab</div>
          </div>

          <div
            onClick={() => setFilterLocation(filterLocation === 'missing' ? 'all' : 'missing')}
            className="card card--interactive"
            style={{
              padding: '12px', textAlign: 'center', cursor: 'pointer',
              border: filterLocation === 'missing' ? '2px solid var(--red)' : '1px solid var(--border)',
              background: filterLocation === 'missing' ? 'rgba(239, 68, 68, 0.15)' : 'var(--bg-card)'
            }}
          >
            <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--red)' }}>{countMissing}</div>
            <div style={{ fontSize: '11px', color: 'var(--text)', fontWeight: 700, marginTop: '2px' }}>⚠️ Chưa Cập Nhật</div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Cần điền biển số</div>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="card" style={{ padding: '12px', marginBottom: '14px' }}>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Search Input */}
            <div style={{ position: 'relative', flex: '1 1 240px' }}>
              <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: '32px', fontSize: '13px' }}
                placeholder="🔍 Gõ Biển số xe (29G1...), Loại xe (Lead, SH...), Tên nhân viên..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            {/* Filter Location Select */}
            <select
              className="form-select"
              style={{ width: 'auto', minWidth: '150px', fontSize: '13px', padding: '7px 10px', fontWeight: 600, color: 'var(--primary)' }}
              value={filterLocation}
              onChange={e => setFilterLocation(e.target.value)}
            >
              <option value="all">🏢 Nơi gửi: Tất cả ({staff.length})</option>
              <option value="17T10">🏢 Gửi Tòa 17T10 ({count17T10})</option>
              <option value="outside">🅿️ Gửi ngoài ({countOutside})</option>
              <option value="none">🚫 Không gửi xe ({countNoVehicle})</option>
              <option value="missing">⚠️ Chưa cập nhật ({countMissing})</option>
            </select>

            {/* Filter Dept Select */}
            <select
              className="form-select"
              style={{ width: 'auto', minWidth: '140px', fontSize: '13px', padding: '7px 10px' }}
              value={filterDept}
              onChange={e => setFilterDept(e.target.value)}
            >
              <option value="all">👥 Phòng ban: Tất cả</option>
              {depts.map(d => (
                <option key={d._id} value={d._id}>{d.name}</option>
              ))}
            </select>

            {/* View Mode Toggle */}
            <div style={{ display: 'flex', background: 'var(--bg-input)', borderRadius: '8px', padding: '2px', border: '1px solid var(--border)', marginLeft: 'auto' }}>
              <button
                onClick={() => setViewMode('table')}
                style={{
                  padding: '6px 10px', border: 'none', borderRadius: '6px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 600,
                  background: viewMode === 'table' ? 'var(--bg-card)' : 'transparent',
                  color: viewMode === 'table' ? 'var(--primary)' : 'var(--text-muted)',
                }}
              >
                <LayoutList size={14} /> Bảng Excel
              </button>
              <button
                onClick={() => setViewMode('grid')}
                style={{
                  padding: '6px 10px', border: 'none', borderRadius: '6px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 600,
                  background: viewMode === 'grid' ? 'var(--bg-card)' : 'transparent',
                  color: viewMode === 'grid' ? 'var(--primary)' : 'var(--text-muted)',
                }}
              >
                <LayoutGrid size={14} /> Thẻ Xe
              </button>
            </div>
          </div>
        </div>

        {/* Content View */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[1, 2, 3].map(i => <div key={i} className="skeleton-card" style={{ height: '65px', borderRadius: '10px' }} />)}
          </div>
        ) : filteredStaff.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">🛵</div>
            <div className="empty-state__title">Không tìm thấy phương tiện phù hợp</div>
            <div className="empty-state__desc">Thử tìm bằng từ khóa hoặc điều chỉnh bộ lọc nơi gửi</div>
          </div>
        ) : viewMode === 'table' ? (
          /* TABLE VIEW MODE */
          <div className="card animate-fade-in" style={{ padding: 0, overflowX: 'auto', borderRadius: '12px', border: '1px solid var(--border)', maxWidth: '100%' }}>
            <table style={{ width: '100%', minWidth: '780px', fontSize: '12.5px', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--bg-raised)', borderBottom: '1px solid var(--border)', color: 'var(--text)', fontWeight: 800 }}>
                  <th style={{ padding: '12px 14px', width: '50px', textAlign: 'center', whiteSpace: 'nowrap' }}>STT</th>
                  <th style={{ padding: '12px 14px', minWidth: '180px', whiteSpace: 'nowrap' }}>CHỦ XE / NHÂN VIÊN</th>
                  <th style={{ padding: '12px 14px', width: '120px', whiteSpace: 'nowrap' }}>SĐT</th>
                  <th style={{ padding: '12px 14px', minWidth: '170px', whiteSpace: 'nowrap' }}>ĐỊA ĐIỂM GỬI XE</th>
                  <th style={{ padding: '12px 14px', minWidth: '200px', whiteSpace: 'nowrap' }}>MÔ TẢ XE & BIỂN SỐ</th>
                  <th style={{ padding: '12px 14px', width: '85px', textAlign: 'center', whiteSpace: 'nowrap' }}>THAO TÁC</th>
                </tr>
              </thead>
              <tbody>
                {filteredStaff.map((s, idx) => {
                  const hasVehicle = Boolean(s.vehicle_info || s.license_plate);
                  const is17T10 = (s.parking_location || '').includes('17T10');
                  const isNoVehicle = (s.parking_location || '').toLowerCase().includes('không');

                  return (
                    <tr
                      key={s._id || s.id}
                      style={{
                        borderBottom: '1px solid var(--border-muted)',
                        background: idx % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-raised)',
                      }}
                    >
                      <td style={{ padding: '10px 14px', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'center' }}>
                        {idx + 1}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <div
                          onClick={() => setViewingStaffDetail(s)}
                          style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                          title="Click để xem hồ sơ nhân sự"
                        >
                          {s.avatar_url ? (
                            <img src={s.avatar_url} alt="" style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover' }} />
                          ) : (
                            <div className="avatar" style={{ width: 30, height: 30, fontSize: '11px' }}>
                              {s.full_name?.split(' ').map(w => w[0]).slice(-2).join('').toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '13px', whiteSpace: 'nowrap' }}>{s.full_name}</div>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>#{s.employee_code || 'NS'}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                        {s.phone ? (
                          <a href={`tel:${s.phone}`} style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>
                            📱 {s.phone}
                          </a>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                        <span
                          className={`badge ${is17T10 ? 'badge--info' : isNoVehicle ? 'badge--neutral' : 'badge--warning'}`}
                          style={{ fontSize: '11.5px', padding: '4px 10px' }}
                        >
                          {s.parking_location || 'Tòa 17T10 Nguyễn Thị Định'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        {hasVehicle ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                            <span style={{ fontSize: '15px' }}>🛵</span>
                            <strong style={{ color: 'var(--text)', fontSize: '13px' }}>
                              {s.vehicle_info || s.license_plate}
                            </strong>
                          </div>
                        ) : isNoVehicle ? (
                          <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', whiteSpace: 'nowrap' }}>Không sử dụng xe</span>
                        ) : (
                          <span className="badge badge--danger" style={{ fontSize: '11px', padding: '3px 8px', whiteSpace: 'nowrap' }}>⚠️ Chưa điền biển số</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        {isAdmin ? (
                          <button
                            onClick={() => openQuickEdit(s)}
                            className="btn btn--ghost"
                            style={{ padding: '5px 10px', fontSize: '12px', color: 'var(--primary)', fontWeight: 600 }}
                            title="Sửa thông tin xe"
                          >
                            <Edit2 size={13} style={{ marginRight: '4px' }} /> Sửa
                          </button>
                        ) : String(s._id || s.id) === String(currentUser?._id) ? (
                          <span style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 700 }}>Xe của tôi 🛵</span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* CARD GRID VIEW MODE */
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
            {filteredStaff.map(s => {
              const hasVehicle = Boolean(s.vehicle_info || s.license_plate);
              const is17T10 = (s.parking_location || '').includes('17T10');
              const isNoVehicle = (s.parking_location || '').toLowerCase().includes('không');
              const isMine = String(s._id || s.id) === String(currentUser?._id);

              return (
                <div key={s._id || s.id} className="card card--interactive animate-fade-in" style={{ padding: '14px', position: 'relative' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <div
                      onClick={() => setViewingStaffDetail(s)}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                      title="Click để xem hồ sơ nhân sự"
                    >
                      {s.avatar_url ? (
                        <img src={s.avatar_url} alt="" style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover' }} />
                      ) : (
                        <div className="avatar" style={{ width: 38, height: 38, fontSize: '13px' }}>
                          {s.full_name?.split(' ').map(w => w[0]).slice(-2).join('').toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--primary)' }}>
                          {s.full_name} {isMine && <span style={{ fontSize: '11px', color: 'var(--primary)' }}>(Tôi)</span>}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{s.department_name || 'Phòng ban'}</div>
                      </div>
                    </div>
                    {isAdmin && (
                      <button
                        onClick={() => openQuickEdit(s)}
                        className="btn btn--ghost"
                        style={{ padding: '4px', borderRadius: '6px', color: 'var(--primary)' }}
                        title="Sửa thông tin xe"
                      >
                        <Edit2 size={14} />
                      </button>
                    )}
                  </div>

                  {/* Vehicle License Plate Box */}
                  <div style={{
                    background: hasVehicle ? 'var(--primary-subtle, rgba(59, 130, 246, 0.12))' : isNoVehicle ? 'var(--bg-raised)' : 'rgba(239, 68, 68, 0.1)',
                    border: hasVehicle ? '1px solid var(--primary)' : isNoVehicle ? '1px solid var(--border)' : '1px dashed var(--red)',
                    borderRadius: '8px', padding: '10px 12px', marginBottom: '10px'
                  }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '2px' }}>
                      Mô Tả & Biển Số Xe:
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: hasVehicle ? 'var(--primary)' : isNoVehicle ? 'var(--text-muted)' : 'var(--red)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <span>{hasVehicle ? '🛵' : isNoVehicle ? '🚫' : '⚠️'}</span>
                      <span>{hasVehicle ? (s.vehicle_info || s.license_plate) : isNoVehicle ? 'Không gửi xe' : 'Chưa cập nhật biển số'}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--text-secondary)' }}>
                    <span>🏢 {s.parking_location || 'Tòa 17T10'}</span>
                    {s.phone && (
                      <a href={`tel:${s.phone}`} style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>
                        📱 {s.phone}
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Edit Modal */}
      {editingStaff && (
        <div className="modal-overlay" onClick={() => setEditingStaff(null)}>
          <div
            className="modal-sheet animate-slide-up"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '560px',
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
                  <Bike size={22} color="var(--primary)" />
                </div>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'var(--text)' }}>
                    Cập Nhật Phương Tiện
                  </h3>
                  <div style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 700, marginTop: '2px' }}>
                    {editingStaff.full_name} (#{editingStaff.employee_code || 'NS'})
                  </div>
                </div>
              </div>
              <button onClick={() => setEditingStaff(null)} className="btn btn--ghost" style={{ padding: '6px 10px', borderRadius: '8px' }}>
                <X size={20} />
              </button>
            </div>

            {/* Quick Location Chips */}
            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label className="form-label" style={{ fontWeight: 700 }}>🏢 Địa điểm gửi xe</label>
              <input
                type="text"
                className="form-input"
                value={editForm.parking_location}
                onChange={e => setEditForm({ ...editForm, parking_location: e.target.value })}
                placeholder="VD: Tòa 17T10 Nguyễn Thị Định"
              />
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                {['Tòa 17T10 Nguyễn Thị Định', 'Gửi ngoài', 'Không gửi xe'].map(loc => (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => setEditForm({ ...editForm, parking_location: loc })}
                    className="btn btn--ghost"
                    style={{
                      fontSize: '12px',
                      padding: '5px 10px',
                      borderRadius: '6px',
                      background: editForm.parking_location === loc ? 'var(--primary-soft)' : 'var(--bg-input)',
                      color: editForm.parking_location === loc ? 'var(--primary)' : 'var(--text-secondary)',
                      borderColor: editForm.parking_location === loc ? 'var(--primary)' : 'var(--border)',
                      fontWeight: editForm.parking_location === loc ? 700 : 500
                    }}
                  >
                    {loc === 'Tòa 17T10 Nguyễn Thị Định' ? '🏢 ' : loc === 'Gửi ngoài' ? '🅿️ ' : '🚫 '}{loc}
                  </button>
                ))}
              </div>
            </div>

            {/* Vehicle Info & License Plate */}
            <div className="form-group" style={{ marginBottom: '18px' }}>
              <label className="form-label" style={{ fontWeight: 700 }}>🛵 Mô tả xe & Biển số xe</label>
              <input
                type="text"
                className="form-input"
                value={editForm.vehicle_info}
                onChange={e => setEditForm({ ...editForm, vehicle_info: e.target.value })}
                placeholder="VD: Honda Vision Trắng - 29G1-123.45"
              />
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '6px' }}>
                💡 Ghi rõ Hãng xe, Màu sắc và Biển số xe để nộp BQL Tòa 17T10 cấp vé tháng.
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setEditingStaff(null)}
                className="btn btn--ghost"
                style={{ flex: 1, padding: '10px', fontSize: '13px', fontWeight: 700 }}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleSaveQuickEdit}
                disabled={submittingEdit}
                className="btn btn--primary"
                style={{ flex: 2, padding: '10px', fontSize: '13px', fontWeight: 800 }}
              >
                {submittingEdit ? <span className="spinner" /> : '💾 Lưu thay đổi'}
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
                  if (viewingStaffDetail.avatar_url) {
                    setFullAvatarImage({ url: viewingStaffDetail.avatar_url, title: viewingStaffDetail.full_name });
                  }
                }}
                style={{ cursor: viewingStaffDetail.avatar_url ? 'zoom-in' : 'default', position: 'relative' }}
                title={viewingStaffDetail.avatar_url ? 'Click để xem ảnh lớn' : ''}
              >
                {viewingStaffDetail.avatar_url ? (
                  <img
                    src={viewingStaffDetail.avatar_url}
                    alt=""
                    style={{ width: 62, height: 62, borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--primary)', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.25)' }}
                  />
                ) : (
                  <div style={{ width: 62, height: 62, borderRadius: '50%', background: 'var(--primary)', color: '#fff', fontSize: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                    {(viewingStaffDetail.full_name || 'U').split(' ').map(w => w[0]).slice(-2).join('').toUpperCase()}
                  </div>
                )}
              </div>
              <div>
                <div style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text)' }}>
                  {viewingStaffDetail.full_name}
                </div>
                <div style={{ fontSize: '12.5px', color: 'var(--primary)', fontWeight: 700, marginTop: '2px' }}>
                  #{viewingStaffDetail.employee_code || 'NS'} · {viewingStaffDetail.position || 'Nhân sự'}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  🏢 {viewingStaffDetail.department_name || 'Văn Phòng'}
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
                <span style={{ fontWeight: 700, color: 'var(--primary)' }}>
                  {viewingStaffDetail.parking_location || 'Tòa 17T10 Nguyễn Thị Định'}
                </span>
              </div>

              {viewingStaffDetail.vehicle_info && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Bike size={14} /> Mô tả & Biển số:
                  </span>
                  <span style={{ fontWeight: 700, color: 'var(--text)' }}>
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
