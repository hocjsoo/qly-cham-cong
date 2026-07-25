// src/pages/SettingsPage.jsx
// Trang cài đặt hệ thống — Admin Only (Phòng ban, Geofencing Map Picker, Dự án, Cấu hình Ca làm)

import { useState, useEffect } from 'react';
import { Building2, MapPin, Plus, Trash2, X, Calendar, Edit2, Check, AlertTriangle, Clock, Briefcase, Settings2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import HeaderActions from '../components/HeaderActions';

// Confirm Dialog an toàn
function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <div className="modal-overlay">
      <div className="modal-sheet animate-slide-up" style={{ maxWidth: '360px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
          <AlertTriangle size={24} color="var(--red)" />
          <div style={{ fontSize: '15px', fontWeight: 700 }}>Xác nhận thao tác</div>
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '18px', lineHeight: 1.5 }}>{message}</div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={onCancel} className="btn btn--ghost btn--full">Hủy</button>
          <button onClick={onConfirm} className="btn btn--full" style={{ background: 'var(--red)', color: '#fff', border: 'none' }}>Xác nhận</button>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [tab, setTab] = useState('depts'); // 'depts' | 'locations' | 'projects' | 'shift' | 'leave'
  const [depts, setDepts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [projects, setProjects] = useState([]);
  const [leaveBalances, setLeaveBalances] = useState([]);
  const [systemSetting, setSystemSetting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState(null);

  // Department Form
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [deptName, setDeptName] = useState('');
  const [deptDesc, setDeptDesc] = useState('');
  const [editingDept, setEditingDept] = useState(null); // { id, name, description }
  const [editDeptForm, setEditDeptForm] = useState({ name: '', description: '' });

  // Location Form — No lat/lng inputs; use GPS button
  const [showLocModal, setShowLocModal] = useState(false);
  const [locForm, setLocForm] = useState({ name: '', address: '', lat: '', lng: '', radius_m: 100 });
  const [locGpsLoading, setLocGpsLoading] = useState(false);

  // Project Form
  const [showProjModal, setShowProjModal] = useState(false);
  const [projForm, setProjForm] = useState({ id: null, name: '', code: '', address: '', client_name: '', status: 'active' });

  // Leave balance edit
  const [editingBal, setEditingBal] = useState(null);
  const [balForm, setBalForm] = useState({});

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { loadData(); }, [tab]);

  const loadData = async () => {
    try {
      setLoading(true);
      if (tab === 'depts') {
        const { data } = await api.get('/departments');
        setDepts(Array.isArray(data) ? data : []);
      } else if (tab === 'locations') {
        const { data } = await api.get('/locations');
        setLocations(Array.isArray(data) ? data : []);
      } else if (tab === 'projects') {
        const { data } = await api.get('/projects');
        setProjects(Array.isArray(data) ? data : []);
      } else if (tab === 'leave') {
        const { data } = await api.get('/leave-balance');
        setLeaveBalances(Array.isArray(data) ? data : []);
      } else if (tab === 'shift') {
        const { data } = await api.get('/settings');
        setSystemSetting(data);
      }
    } catch { toast.error('Lỗi tải dữ liệu cài đặt'); }
    finally { setLoading(false); }
  };

  const askConfirm = (message, onConfirm) => setConfirm({ message, onConfirm });

  // Department Actions
  const handleAddDept = async () => {
    if (!deptName.trim()) { toast.error('Tên phòng ban không được để trống'); return; }
    setSubmitting(true);
    try {
      await api.post('/departments', { name: deptName.trim(), description: deptDesc.trim() });
      toast.success('Đã thêm phòng ban');
      setShowDeptModal(false);
      setDeptName(''); setDeptDesc('');
      loadData();
    } catch (err) { toast.error(err?.response?.data?.error || 'Lỗi thêm phòng ban'); }
    finally { setSubmitting(false); }
  };

  const handleEditDept = async () => {
    if (!editDeptForm.name.trim()) { toast.error('Tên phòng ban không được để trống'); return; }
    setSubmitting(true);
    try {
      await api.put(`/departments/${editingDept}`, { name: editDeptForm.name.trim(), description: editDeptForm.description.trim() });
      toast.success('Đã cập nhật phòng ban');
      setEditingDept(null);
      loadData();
    } catch (err) { toast.error(err?.response?.data?.error || 'Lỗi sửa phòng ban'); }
    finally { setSubmitting(false); }
  };

  const handleDeleteDept = (id, name) => {
    askConfirm(`Bạn có chắc muốn xóa phòng ban "${name}"? Hành động này không thể khôi phục.`, async () => {
      setConfirm(null);
      try {
        await api.delete(`/departments/${id}`);
        toast.success('Đã xóa phòng ban');
        loadData();
      } catch { toast.error('Lỗi xóa phòng ban'); }
    });
  };

  const handleLocGPS = () => {
    if (!navigator.geolocation) { toast.error('Thiết bị không hỗ trợ GPS'); return; }
    setLocGpsLoading(true);
    toast.loading('Đang lấy vị trí GPS...', { id: 'loc-gps' });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocForm(prev => ({ ...prev, lat: pos.coords.latitude.toFixed(6), lng: pos.coords.longitude.toFixed(6) }));
        toast.success(`GPS: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`, { id: 'loc-gps' });
        setLocGpsLoading(false);
      },
      () => { toast.error('Không lấy được GPS. Vui lòng bật định vị.', { id: 'loc-gps' }); setLocGpsLoading(false); },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  // Location Actions
  const handleAddLocation = async () => {
    if (!locForm.name.trim()) { toast.error('Tên vị trí là bắt buộc'); return; }
    if (!locForm.lat || !locForm.lng) { toast.error('Vui lòng lấy vị trí GPS trước khi lưu'); return; }
    setSubmitting(true);
    try {
      await api.post('/locations', locForm);
      toast.success('Đã thêm vị trí văn phòng ✅');
      setShowLocModal(false);
      setLocForm({ name: '', address: '', lat: '', lng: '', radius_m: 100 });
      loadData();
    } catch (err) { toast.error(err?.response?.data?.error || 'Lỗi thêm vị trí'); }
    finally { setSubmitting(false); }
  };

  const handleDeleteLocation = (id, name) => {
    askConfirm(`Bạn có chắc muốn xóa vị trí "${name}"?`, async () => {
      setConfirm(null);
      try {
        await api.delete(`/locations/${id}`);
        toast.success('Đã xóa vị trí');
        loadData();
      } catch { toast.error('Lỗi xóa vị trí'); }
    });
  };

  // Project Actions
  const handleSaveProject = async () => {
    if (!projForm.name.trim()) { toast.error('Tên dự án là bắt buộc'); return; }
    setSubmitting(true);
    try {
      if (projForm.id) {
        await api.put(`/projects/${projForm.id}`, projForm);
        toast.success('Đã cập nhật dự án');
      } else {
        await api.post('/projects', projForm);
        toast.success('Đã tạo dự án mới');
      }
      setShowProjModal(false);
      setProjForm({ id: null, name: '', code: '', address: '', client_name: '', status: 'active' });
      loadData();
    } catch (err) { toast.error(err?.response?.data?.error || 'Lỗi lưu dự án'); }
    finally { setSubmitting(false); }
  };

  const handleDeleteProject = (id, name) => {
    askConfirm(`Bạn có chắc muốn xóa dự án "${name}"?`, async () => {
      setConfirm(null);
      try {
        await api.delete(`/projects/${id}`);
        toast.success('Đã xóa dự án');
        loadData();
      } catch { toast.error('Lỗi xóa dự án'); }
    });
  };

  // Shift Settings Actions
  const handleSaveShiftSettings = async () => {
    if (!systemSetting) return;
    setSubmitting(true);
    try {
      await api.put('/settings', systemSetting);
      toast.success('Đã lưu cấu hình ca làm & quy định muộn! ⚙️');
      loadData();
    } catch { toast.error('Lỗi lưu cấu hình'); }
    finally { setSubmitting(false); }
  };

  // Leave Balance Actions
  const startEditBalance = (bal) => {
    setEditingBal(bal.user.id);
    setBalForm({
      annual_leave_total: bal.annual_leave.total,
      annual_leave_used: bal.annual_leave.used,
      sick_leave_total: bal.sick_leave.total,
      sick_leave_used: bal.sick_leave.used,
    });
  };

  const saveBalance = async (userId) => {
    try {
      await api.put(`/leave-balance/${userId}`, balForm);
      toast.success('Đã cập nhật ngày phép');
      setEditingBal(null);
      loadData();
    } catch { toast.error('Lỗi cập nhật ngày phép'); }
  };

  const tabs = [
    { key: 'depts', label: '🏢 Phòng ban', count: depts.length },
    { key: 'locations', label: '📍 Vị trí GPS', count: locations.length },
    { key: 'projects', label: '🏗️ Dự án', count: projects.length },
    { key: 'shift', label: '⚙️ Quy định ca làm' },
    { key: 'leave', label: '📅 Quản lý ngày phép', count: leaveBalances.length },
  ];

  return (
    <div className="page">
      <div className="header">
        <div className="header__inner">
          <div className="header__title">Cài đặt hệ thống</div>
          <HeaderActions />
        </div>
      </div>

      <div className="container" style={{ paddingTop: '14px' }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', overflowX: 'auto', paddingBottom: '2px' }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} className={`chip${tab === t.key ? ' active' : ''}`}>
              {t.label} {t.count !== undefined ? `(${t.count})` : ''}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[1, 2, 3].map(i => <div key={i} className="skeleton-card" style={{ height: '68px', borderRadius: '12px' }} />)}
          </div>
        ) : tab === 'depts' ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Danh sách phòng ban</span>
              <button onClick={() => setShowDeptModal(true)} className="btn btn--primary" style={{ padding: '6px 12px', fontSize: '12px' }}>
                <Plus size={14} /> Thêm phòng ban
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {depts.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state__icon">🏢</div>
                  <div className="empty-state__title">Chưa có phòng ban</div>
                  <div className="empty-state__desc">Thêm phòng ban đầu tiên để phân nhóm nhân viên</div>
                </div>
              ) : depts.map(d => (
                <div key={d._id} className="card" style={{ padding: '10px 14px' }}>
                  {editingDept === d._id ? (
                    <div>
                      <div className="form-group" style={{ marginBottom: '8px' }}>
                        <label className="form-label">Tên phòng ban</label>
                        <input type="text" className="form-input" style={{ fontSize: '13px', padding: '7px 10px' }} value={editDeptForm.name} onChange={e => setEditDeptForm(p => ({ ...p, name: e.target.value }))} />
                      </div>
                      <div className="form-group" style={{ marginBottom: '10px' }}>
                        <label className="form-label">Địa điểm / Mô tả</label>
                        <input type="text" className="form-input" style={{ fontSize: '13px', padding: '7px 10px' }} placeholder="VD: Tầng 5, 123 Nguyễn Huệ" value={editDeptForm.description} onChange={e => setEditDeptForm(p => ({ ...p, description: e.target.value }))} />
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={handleEditDept} disabled={submitting} className="btn btn--primary" style={{ flex: 1, fontSize: '12px', padding: '6px' }}><Check size={14} /> Lưu</button>
                        <button onClick={() => setEditingDept(null)} className="btn btn--ghost" style={{ fontSize: '12px', padding: '6px' }}>Hủy</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 600 }}>{d.name}</div>
                        {d.description && <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>📍 {d.description}</div>}
                      </div>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button onClick={() => { setEditingDept(d._id); setEditDeptForm({ name: d.name, description: d.description || '' }); }} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--primary)', cursor: 'pointer', padding: '5px', display: 'flex', alignItems: 'center' }}>
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => handleDeleteDept(d._id, d.name)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--red)', cursor: 'pointer', padding: '5px', display: 'flex', alignItems: 'center' }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

        ) : tab === 'locations' ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Vị trí văn phòng (Geofencing GPS)</span>
              <button onClick={() => setShowLocModal(true)} className="btn btn--primary" style={{ padding: '6px 12px', fontSize: '12px' }}>
                <Plus size={14} /> Thêm vị trí
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {locations.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state__icon">📍</div>
                  <div className="empty-state__title">Chưa có vị trí văn phòng</div>
                  <div className="empty-state__desc">Thêm vị trí để bật tính năng chấm công theo GPS</div>
                </div>
              ) : locations.map(l => (
                <div key={l._id} className="card" style={{ padding: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '14px', fontWeight: 600 }}>{l.name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{l.address || 'Chưa ghi địa chỉ'}</div>
                    </div>
                    <button onClick={() => handleDeleteLocation(l._id, l.name)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--red)', cursor: 'pointer', padding: '5px', display: 'flex', alignItems: 'center', flexShrink: 0, marginLeft: '8px' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', fontSize: '11px', flexWrap: 'wrap' }}>
                    <span className="badge badge--info">⭕ Bán kính: {l.radius_m}m</span>
                    {l.lat && <span className="badge badge--neutral">📍 Có GPS</span>}
                  </div>
                  {l.lat && l.lng && (
                    <div style={{ marginTop: '8px', borderRadius: '8px', overflow: 'hidden', height: '100px', border: '1px solid var(--border)' }}>
                      <iframe title={l.name} width="100%" height="100%" frameBorder="0"
                        src={`https://maps.google.com/maps?q=${l.lat},${l.lng}&z=16&output=embed`} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

        ) : tab === 'projects' ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Quản lý dự án & Công trình</span>
              <button onClick={() => {
                setProjForm({ id: null, name: '', code: '', address: '', client_name: '', status: 'active' });
                setShowProjModal(true);
              }} className="btn btn--primary" style={{ padding: '6px 12px', fontSize: '12px' }}>
                <Plus size={14} /> Tạo dự án mới
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {projects.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state__icon">🏗️</div>
                  <div className="empty-state__title">Chưa có dự án</div>
                  <div className="empty-state__desc">Tạo dự án để nhân viên chọn khi chấm công công trình</div>
                </div>
              ) : projects.map(p => (
                <div key={p._id} className="card" style={{ padding: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '4px' }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 700 }}>{p.name} <span style={{ fontSize: '11px', color: 'var(--primary)' }}>({p.code || 'DA'})</span></div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{p.address || 'Chưa ghi địa chỉ'}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <span className={`badge ${p.status === 'active' ? 'badge--success' : p.status === 'paused' ? 'badge--warning' : 'badge--neutral'}`}>
                        {p.status === 'active' ? 'Đang chạy' : p.status === 'paused' ? 'Tạm dừng' : 'Hoàn thành'}
                      </span>
                      <button onClick={() => {
                        setProjForm({ id: p._id, name: p.name, code: p.code || '', address: p.address || '', client_name: p.client_name || '', status: p.status || 'active' });
                        setShowProjModal(true);
                      }} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: '4px' }}>
                        <Edit2 size={15} />
                      </button>
                      <button onClick={() => handleDeleteProject(p._id, p.name)} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', padding: '4px' }}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        ) : tab === 'shift' ? (
          /* Shift & Penalty Rules Tab */
          <div className="card animate-fade-in" style={{ padding: '16px' }}>
            <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={18} color="var(--primary)" /> Cấu hình Giờ làm & Quy tắc Phạt muộn
            </div>

            {systemSetting && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: '14px' }}>
                  <div className="form-group">
                    <label className="form-label">Giờ vào chuẩn * (Đúng giờ ≤ 09:00)</label>
                    <input type="text" className="form-input" value={systemSetting.work_start_time} onChange={e => setSystemSetting({ ...systemSetting, work_start_time: e.target.value })} placeholder="09:00" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Giờ về chuẩn * (18:00)</label>
                    <input type="text" className="form-input" value={systemSetting.work_end_time} onChange={e => setSystemSetting({ ...systemSetting, work_end_time: e.target.value })} placeholder="18:00" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Ngưỡng Muộn Nhẹ (phút)</label>
                    <input type="number" className="form-input" value={systemSetting.minor_late_mins} onChange={e => setSystemSetting({ ...systemSetting, minor_late_mins: e.target.value })} placeholder="10" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Ngưỡng Muộn Vừa (phút)</label>
                    <input type="number" className="form-input" value={systemSetting.medium_late_mins} onChange={e => setSystemSetting({ ...systemSetting, medium_late_mins: e.target.value })} placeholder="30" />
                  </div>
                </div>

                <div style={{ background: 'var(--bg-raised)', borderRadius: '8px', padding: '12px', marginBottom: '14px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '6px', color: 'var(--primary)' }}>Quy tắc đi muộn hiện tại:</div>
                  <ul style={{ fontSize: '12px', color: 'var(--text-secondary)', paddingLeft: '16px', margin: 0, lineHeight: 1.6 }}>
                    <li><strong>≤ {systemSetting.work_start_time}</strong>: Đúng giờ (Green)</li>
                    <li><strong>09:01 – 09:10</strong>: Muộn nhẹ (Yellow)</li>
                    <li><strong>09:11 – 09:30</strong>: Muộn (Yellow-Orange)</li>
                    <li><strong>&gt; 09:30</strong>: Muộn nhiều (Red)</li>
                    <li><strong>OT</strong>: Tự động tính sau {systemSetting.ot_start_time || '18:00'}</li>
                  </ul>
                </div>

                <button onClick={handleSaveShiftSettings} disabled={submitting} className="btn btn--primary btn--full">
                  {submitting ? <span className="spinner" /> : 'Lưu cài đặt giờ làm'}
                </button>
              </div>
            )}
          </div>

        ) : (
          /* Leave Balances Tab */
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px' }}>
              Quỹ ngày phép nhân viên năm {new Date().getFullYear()}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {leaveBalances.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state__icon">📅</div>
                  <div className="empty-state__title">Chưa có dữ liệu</div>
                  <div className="empty-state__desc">Dữ liệu ngày phép sẽ tự động tạo khi nhân viên đăng ký đơn</div>
                </div>
              ) : leaveBalances.map(bal => (
                <div key={bal.user.id} className="card" style={{ padding: '12px' }}>
                  {editingBal === bal.user.id ? (
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '10px' }}>{bal.user.full_name}</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginBottom: '10px' }}>
                        {[
                          { key: 'annual_leave_total', label: 'Tổng phép năm' },
                          { key: 'annual_leave_used', label: 'Đã dùng (phép năm)' },
                          { key: 'sick_leave_total', label: 'Tổng nghỉ ốm' },
                          { key: 'sick_leave_used', label: 'Đã dùng (nghỉ ốm)' },
                        ].map(f => (
                          <div key={f.key} className="form-group" style={{ margin: 0 }}>
                            <label className="form-label" style={{ fontSize: '10px' }}>{f.label}</label>
                            <input
                              type="number"
                              className="form-input"
                              style={{ padding: '6px 8px', fontSize: '13px' }}
                              value={balForm[f.key]}
                              onChange={e => setBalForm(p => ({ ...p, [f.key]: Number(e.target.value) }))}
                            />
                          </div>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => saveBalance(bal.user.id)} className="btn btn--primary" style={{ flex: 1, fontSize: '12px', padding: '6px' }}>
                          <Check size={14} /> Lưu
                        </button>
                        <button onClick={() => setEditingBal(null)} className="btn btn--ghost" style={{ fontSize: '12px', padding: '6px' }}>
                          <X size={14} /> Hủy
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '14px' }}>{bal.user.full_name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{bal.user.email}</div>
                        </div>
                        <button onClick={() => startEditBalance(bal)} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: '4px' }}>
                          <Edit2 size={15} />
                        </button>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <div style={{ background: 'var(--green-soft)', color: 'var(--green)', borderRadius: '6px', padding: '4px 8px', fontSize: '11px' }}>
                          📆 Phép năm: <strong>{bal.annual_leave.remaining}/{bal.annual_leave.total}</strong>
                        </div>
                        <div style={{ background: 'var(--blue-soft)', color: 'var(--blue)', borderRadius: '6px', padding: '4px 8px', fontSize: '11px' }}>
                          🏥 Nghỉ ốm: <strong>{bal.sick_leave.remaining}/{bal.sick_leave.total}</strong>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Confirm Dialog */}
      {confirm && (
        <ConfirmDialog
          message={confirm.message}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}

      {/* Dept Modal */}
      {showDeptModal && (
        <div className="modal-overlay">
          <div className="modal-sheet animate-slide-up">
            <div className="modal-sheet__handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Thêm phòng ban</h3>
              <button onClick={() => setShowDeptModal(false)} className="btn btn--ghost" style={{ padding: '4px 8px' }}><X size={18} /></button>
            </div>

            <div className="form-group">
              <label className="form-label">Tên phòng ban *</label>
              <input type="text" className="form-input" value={deptName} onChange={e => setDeptName(e.target.value)} placeholder="VD: Phòng Kỹ Thuật" />
            </div>
            <div className="form-group">
              <label className="form-label">Mô tả</label>
              <input type="text" className="form-input" value={deptDesc} onChange={e => setDeptDesc(e.target.value)} placeholder="Ghi chú thêm..." />
            </div>

            <button onClick={handleAddDept} disabled={submitting} className="btn btn--primary btn--full btn--lg" style={{ marginTop: '8px' }}>
              {submitting ? <span className="spinner" /> : 'Tạo phòng ban'}
            </button>
          </div>
        </div>
      )}

      {/* Location Modal with Map Picker Embed */}
      {showLocModal && (
        <div className="modal-overlay">
          <div className="modal-sheet animate-slide-up" style={{ maxWidth: '500px', margin: '0 auto' }}>
            <div className="modal-sheet__handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Thêm vị trí văn phòng (Geofencing)</h3>
              <button onClick={() => setShowLocModal(false)} className="btn btn--ghost" style={{ padding: '4px 8px' }}><X size={18} /></button>
            </div>

            <div className="form-group">
              <label className="form-label">Tên vị trí *</label>
              <input type="text" className="form-input" value={locForm.name} onChange={e => setLocForm({ ...locForm, name: e.target.value })} placeholder="VD: Trụ sở chính TP.HCM" />
            </div>

            {/* GPS Acquire Button */}
            <div style={{ marginBottom: '10px' }}>
              <button
                type="button"
                onClick={handleLocGPS}
                disabled={locGpsLoading}
                className={`btn btn--full ${locForm.lat ? 'btn--ghost' : 'btn--primary'}`}
                style={{ justifyContent: 'center', gap: '6px' }}
              >
                {locGpsLoading ? '⏳ Đang lấy GPS...' : locForm.lat ? `✅ GPS đã lấy — Bấm để cập nhật lại` : '📍 Bấm để lấy vị trí GPS của văn phòng'}
              </button>
              {locForm.lat && (
                <div style={{ fontSize: '11px', color: 'var(--green)', textAlign: 'center', marginTop: '4px' }}>
                  Tọa độ GPS đã lấy thành công. Bản đồ hiển thị bên dưới.
                </div>
              )}
            </div>

            {/* Map preview — chỉ hiện sau khi có GPS */}
            {locForm.lat && locForm.lng && (
              <div style={{ marginBottom: '12px', border: '1px solid var(--green)', borderRadius: '8px', overflow: 'hidden', height: '180px' }}>
                <iframe
                  title="Office Location Map Picker"
                  width="100%"
                  height="100%"
                  frameBorder="0"
                  src={`https://maps.google.com/maps?q=${locForm.lat},${locForm.lng}&z=17&output=embed`}
                />
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Địa chỉ văn phòng (hiển thị cho nhân viên)</label>
              <input type="text" className="form-input" value={locForm.address} onChange={e => setLocForm({ ...locForm, address: e.target.value })} placeholder="Tầng 5, 123 Nguyễn Huệ, Quận 1, TP.HCM" />
            </div>

            <div className="form-group">
              <label className="form-label">Bán kính Geofence cho phép (mét)</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input type="range" min="30" max="500" step="10"
                  value={locForm.radius_m}
                  onChange={e => setLocForm({ ...locForm, radius_m: parseInt(e.target.value) })}
                  style={{ flex: 1 }}
                />
                <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--primary)', minWidth: '45px', textAlign: 'right' }}>{locForm.radius_m}m</span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>30m = rất chặt (tầng cố định) · 100m = bình thường · 200m+ = thoáng</div>
            </div>

            <button onClick={handleAddLocation} disabled={submitting || !locForm.lat} className="btn btn--primary btn--full btn--lg" style={{ marginTop: '8px' }}>
              {submitting ? <span className="spinner" /> : !locForm.lat ? '📍 Cần lấy GPS trước' : 'Lưu vị trí văn phòng'}
            </button>
          </div>
        </div>
      )}

      {/* Project Modal */}
      {showProjModal && (
        <div className="modal-overlay">
          <div className="modal-sheet animate-slide-up" style={{ maxWidth: '420px', margin: '0 auto' }}>
            <div className="modal-sheet__handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700 }}>{projForm.id ? 'Sửa dự án' : 'Tạo dự án mới'}</h3>
              <button onClick={() => setShowProjModal(false)} className="btn btn--ghost" style={{ padding: '4px 8px' }}><X size={18} /></button>
            </div>

            <div className="form-group">
              <label className="form-label">Tên dự án / công trình *</label>
              <input type="text" className="form-input" value={projForm.name} onChange={e => setProjForm({ ...projForm, name: e.target.value })} placeholder="VD: Biệt thự Palm City" />
            </div>
            <div className="form-group">
              <label className="form-label">Mã dự án</label>
              <input type="text" className="form-input" value={projForm.code} onChange={e => setProjForm({ ...projForm, code: e.target.value })} placeholder="VD: CT-PALM" />
            </div>
            <div className="form-group">
              <label className="form-label">Trạng thái dự án</label>
              <select className="form-input" value={projForm.status} onChange={e => setProjForm({ ...projForm, status: e.target.value })}>
                <option value="active">🟢 Đang hoạt động (Cho phép chọn khi chấm công)</option>
                <option value="paused">🟡 Tạm dừng</option>
                <option value="completed">🔵 Hoàn thành</option>
              </select>
            </div>

            <button onClick={handleSaveProject} disabled={submitting} className="btn btn--primary btn--full btn--lg" style={{ marginTop: '8px' }}>
              {submitting ? <span className="spinner" /> : 'Lưu dự án'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
