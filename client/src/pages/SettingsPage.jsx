// src/pages/SettingsPage.jsx
// Cai dat he thong — Admin/Leader

import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, X, Edit2, Check, AlertTriangle, Clock, Globe } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import useAuthStore from '../stores/authStore';
import HeaderActions from '../components/HeaderActions';
import MapGpsPicker from '../components/MapGpsPicker';

const WORKING_DAYS_OPTIONS = [
  { key: 'Mon', label: 'T2' }, { key: 'Tue', label: 'T3' }, { key: 'Wed', label: 'T4' },
  { key: 'Thu', label: 'T5' }, { key: 'Fri', label: 'T6' }, { key: 'Sat', label: 'T7' }, { key: 'Sun', label: 'CN' },
];

function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <div className="modal-overlay">
      <div className="modal-sheet animate-slide-up" style={{ maxWidth: '360px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
          <AlertTriangle size={24} color="var(--red)" />
          <div style={{ fontSize: '15px', fontWeight: 700 }}>Xac nhan thao tac</div>
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '18px', lineHeight: 1.5 }}>{message}</div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={onCancel} className="btn btn--ghost btn--full">Huy</button>
          <button onClick={onConfirm} className="btn btn--full" style={{ background: 'var(--red)', color: '#fff', border: 'none' }}>Xac nhan</button>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  const [tab, setTab] = useState('depts');
  const [depts, setDepts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [projects, setProjects] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [shiftForm, setShiftForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [showDeptModal, setShowDeptModal] = useState(false);
  const [deptName, setDeptName] = useState('');
  const [deptDesc, setDeptDesc] = useState('');
  const [editingDept, setEditingDept] = useState(null);
  const [editDeptForm, setEditDeptForm] = useState({ name: '', description: '' });

  const [showLocModal, setShowLocModal] = useState(false);
  const [locForm, setLocForm] = useState({ name: '', address: '', lat: '', lng: '', radius_m: 100 });

  const [showProjModal, setShowProjModal] = useState(false);
  const [projForm, setProjForm] = useState({ id: null, name: '', code: '', address: '', client_name: '', status: 'active' });

  const [holidayForm, setHolidayForm] = useState({ name: '', date: '', end_date: '' });
  const [showHolidayForm, setShowHolidayForm] = useState(false);
  const [seedingHolidays, setSeedingHolidays] = useState(false);

  const askConfirm = (message, onConfirm) => setConfirm({ message, onConfirm });

  const loadData = useCallback(async () => {
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
      } else if (tab === 'shift') {
        const { data } = await api.get('/settings');
        setShiftForm({
          work_start_time: data.work_start_time || '08:30',
          work_end_time: data.work_end_time || '17:30',
          lunch_break_start: data.lunch_break_start || '12:00',
          lunch_break_end: data.lunch_break_end || '13:00',
          minor_late_mins: data.minor_late_mins ?? 10,
          medium_late_mins: data.medium_late_mins ?? 30,
          ot_start_time: data.ot_start_time || '18:00',
          ot_mode: data.ot_mode || 'manual',
          working_days: data.working_days || ['Mon','Tue','Wed','Thu','Fri','Sat'],
          company_name: data.company_name || 'ET Architects',
          company_logo_url: data.company_logo_url || '',
        });
      } else if (tab === 'holidays') {
        const year = new Date().getFullYear();
        const { data } = await api.get(`/holidays?year=${year}`);
        setHolidays(Array.isArray(data) ? data : []);
      }
    } catch { toast.error('Loi tai du lieu cai dat'); }
    finally { setLoading(false); }
  }, [tab]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAddDept = async () => {
    if (!deptName.trim()) { toast.error('Ten phong ban khong duoc de trong'); return; }
    setSubmitting(true);
    try {
      await api.post('/departments', { name: deptName.trim(), description: deptDesc.trim() });
      toast.success('Da them phong ban'); setShowDeptModal(false); setDeptName(''); setDeptDesc(''); loadData();
    } catch (err) { toast.error(err?.response?.data?.error || 'Loi them phong ban'); }
    finally { setSubmitting(false); }
  };

  const handleEditDept = async () => {
    if (!editDeptForm.name.trim()) { toast.error('Ten phong ban khong duoc de trong'); return; }
    setSubmitting(true);
    try {
      await api.put(`/departments/${editingDept}`, { name: editDeptForm.name.trim(), description: editDeptForm.description.trim() });
      toast.success('Da cap nhat phong ban'); setEditingDept(null); loadData();
    } catch (err) { toast.error(err?.response?.data?.error || 'Loi sua phong ban'); }
    finally { setSubmitting(false); }
  };

  const handleDeleteDept = (id, name) => {
    askConfirm(`Xoa phong ban "${name}"? Hanh dong nay khong the khoi phuc.`, async () => {
      setConfirm(null);
      try { await api.delete(`/departments/${id}`); toast.success('Da xoa phong ban'); loadData(); }
      catch { toast.error('Loi xoa phong ban'); }
    });
  };

  const handleAddLocation = async () => {
    if (!locForm.name.trim()) { toast.error('Ten vi tri la bat buoc'); return; }
    if (!locForm.lat || !locForm.lng) { toast.error('Vui long chon vi tri GPS truoc'); return; }
    setSubmitting(true);
    try {
      await api.post('/locations', locForm);
      toast.success('Da them vi tri van phong!'); setShowLocModal(false);
      setLocForm({ name: '', address: '', lat: '', lng: '', radius_m: 100 }); loadData();
    } catch (err) { toast.error(err?.response?.data?.error || 'Loi them vi tri'); }
    finally { setSubmitting(false); }
  };

  const handleDeleteLocation = (id, name) => {
    askConfirm(`Xoa vi tri "${name}"?`, async () => {
      setConfirm(null);
      try { await api.delete(`/locations/${id}`); toast.success('Da xoa vi tri'); loadData(); }
      catch { toast.error('Loi xoa vi tri'); }
    });
  };

  const handleSaveProject = async () => {
    if (!projForm.name.trim()) { toast.error('Ten du an la bat buoc'); return; }
    setSubmitting(true);
    try {
      if (projForm.id) { await api.put(`/projects/${projForm.id}`, projForm); toast.success('Da cap nhat du an'); }
      else { await api.post('/projects', projForm); toast.success('Da tao du an moi'); }
      setShowProjModal(false); setProjForm({ id: null, name: '', code: '', address: '', client_name: '', status: 'active' }); loadData();
    } catch (err) { toast.error(err?.response?.data?.error || 'Loi luu du an'); }
    finally { setSubmitting(false); }
  };

  const handleDeleteProject = (id, name) => {
    askConfirm(`Xoa du an "${name}"?`, async () => {
      setConfirm(null);
      try { await api.delete(`/projects/${id}`); toast.success('Da xoa du an'); loadData(); }
      catch { toast.error('Loi xoa du an'); }
    });
  };

  const handleSaveShiftSettings = async () => {
    if (!shiftForm) return;
    setSubmitting(true);
    try {
      const { data } = await api.put('/settings', shiftForm);
      if (data.settings) setShiftForm(prev => ({ ...prev, ...data.settings }));
      toast.success('Da luu cau hinh ca lam!');
    } catch { toast.error('Loi luu cau hinh'); }
    finally { setSubmitting(false); }
  };

  const toggleWorkingDay = (day) => {
    setShiftForm(prev => {
      const days = prev.working_days || [];
      return { ...prev, working_days: days.includes(day) ? days.filter(d => d !== day) : [...days, day] };
    });
  };

  const handleAddHoliday = async () => {
    if (!holidayForm.name.trim() || !holidayForm.date) { toast.error('Ten va ngay la bat buoc'); return; }
    setSubmitting(true);
    try {
      await api.post('/holidays', { ...holidayForm, end_date: holidayForm.end_date || holidayForm.date });
      toast.success('Da them ngay le!');
      setHolidayForm({ name: '', date: '', end_date: '' }); setShowHolidayForm(false); loadData();
    } catch (err) { toast.error(err?.response?.data?.error || 'Loi them ngay le'); }
    finally { setSubmitting(false); }
  };

  const handleDeleteHoliday = (id, name) => {
    askConfirm(`Xoa ngay le "${name}"?`, async () => {
      setConfirm(null);
      try { await api.delete(`/holidays/${id}`); toast.success('Da xoa ngay le'); loadData(); }
      catch { toast.error('Loi xoa ngay le'); }
    });
  };

  const handleSeedVietnamHolidays = async () => {
    setSeedingHolidays(true);
    try {
      const year = new Date().getFullYear();
      const { data } = await api.post(`/holidays/seed-vietnam?year=${year}`);
      toast.success(data.message || 'Da nap ngay le Viet Nam!'); loadData();
    } catch (err) { toast.error(err?.response?.data?.error || 'Loi nap ngay le'); }
    finally { setSeedingHolidays(false); }
  };

  const tabs = [
    { key: 'depts', label: '🏢 Phong ban', count: depts.length },
    { key: 'locations', label: '📍 Vi tri GPS', count: locations.length },
    { key: 'projects', label: '🏗️ Du an', count: projects.length },
    { key: 'shift', label: '⚙️ Ca lam & Quy tac' },
    { key: 'holidays', label: '🎌 Ngay le', count: holidays.length },
  ];

  const rowStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-raised)', borderRadius: '10px', border: '1px solid var(--border)', marginBottom: '6px' };
  const iconBtn = (color = 'var(--red)') => ({ background: 'none', border: '1px solid var(--border)', borderRadius: '6px', color, cursor: 'pointer', padding: '5px', display: 'flex', alignItems: 'center' });

  return (
    <div className="page">
      <div className="header">
        <div className="header__inner">
          <div>
            <div className="header__title">Cai dat he thong</div>
            <div className="header__subtitle">Quan ly phong ban, vi tri GPS, ca lam va ngay le</div>
          </div>
          <HeaderActions />
        </div>
      </div>

      <div className="container" style={{ paddingTop: '14px' }}>
        <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', overflowX: 'auto', paddingBottom: '4px' }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} className={`chip${tab === t.key ? ' active' : ''}`}>
              {t.label} {t.count !== undefined ? `(${t.count})` : ''}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[1,2,3].map(i => <div key={i} className="skeleton-card" style={{ height: '68px', borderRadius: '12px' }} />)}
          </div>

        ) : tab === 'depts' ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Danh sach phong ban ({depts.length})</span>
              {isAdmin && <button onClick={() => setShowDeptModal(true)} className="btn btn--primary" style={{ padding: '6px 12px', fontSize: '12px' }}><Plus size={14} /> Them</button>}
            </div>
            {depts.length === 0
              ? <div className="empty-state"><div className="empty-state__icon">🏢</div><div className="empty-state__title">Chua co phong ban</div></div>
              : depts.map(d => (
                <div key={d._id} style={rowStyle}>
                  {editingDept === d._id ? (
                    <div style={{ width: '100%' }}>
                      <input className="form-input" style={{ marginBottom: '6px', fontSize: '13px' }} value={editDeptForm.name} onChange={e => setEditDeptForm(p => ({...p, name: e.target.value}))} />
                      <input className="form-input" style={{ marginBottom: '8px', fontSize: '13px' }} value={editDeptForm.description} onChange={e => setEditDeptForm(p => ({...p, description: e.target.value}))} placeholder="Mo ta..." />
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={handleEditDept} disabled={submitting} className="btn btn--primary" style={{ flex: 1, fontSize: '12px', padding: '6px' }}><Check size={14} /> Luu</button>
                        <button onClick={() => setEditingDept(null)} className="btn btn--ghost" style={{ fontSize: '12px', padding: '6px' }}>Huy</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 600 }}>{d.name}</div>
                        {d.description && <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>📍 {d.description}</div>}
                      </div>
                      {isAdmin && <div style={{ display: 'flex', gap: '4px' }}>
                        <button onClick={() => { setEditingDept(d._id); setEditDeptForm({ name: d.name, description: d.description || '' }); }} style={iconBtn('var(--primary)')}><Edit2 size={14} /></button>
                        <button onClick={() => handleDeleteDept(d._id, d.name)} style={iconBtn()}><Trash2 size={14} /></button>
                      </div>}
                    </>
                  )}
                </div>
              ))
            }
          </div>

        ) : tab === 'locations' ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Vi tri van phong (Geofencing GPS)</span>
              {isAdmin && <button onClick={() => setShowLocModal(true)} className="btn btn--primary" style={{ padding: '6px 12px', fontSize: '12px' }}><Plus size={14} /> Them</button>}
            </div>
            {locations.length === 0
              ? <div className="empty-state"><div className="empty-state__icon">📍</div><div className="empty-state__title">Chua co vi tri van phong</div></div>
              : locations.map(l => (
                <div key={l._id} className="card" style={{ padding: '12px', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 600 }}>{l.name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{l.address || 'Chua ghi dia chi'}</div>
                    </div>
                    {isAdmin && <button onClick={() => handleDeleteLocation(l._id, l.name)} style={iconBtn()}><Trash2 size={14} /></button>}
                  </div>
                  <div style={{ display: 'flex', gap: '6px', fontSize: '11px', flexWrap: 'wrap' }}>
                    <span className="badge badge--info">Ban kinh: {l.radius_m}m</span>
                    {l.lat && <span className="badge badge--neutral">GPS: {parseFloat(l.lat).toFixed(4)}, {parseFloat(l.lng).toFixed(4)}</span>}
                  </div>
                  {l.lat && l.lng && (
                    <div style={{ marginTop: '8px', borderRadius: '8px', overflow: 'hidden', height: '100px', border: '1px solid var(--border)' }}>
                      <iframe title={l.name} width="100%" height="100%" frameBorder="0" src={`https://maps.google.com/maps?q=${l.lat},${l.lng}&z=16&output=embed`} />
                    </div>
                  )}
                </div>
              ))
            }
          </div>

        ) : tab === 'projects' ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Quan ly du an & Cong trinh ({projects.length})</span>
              {isAdmin && <button onClick={() => { setProjForm({ id: null, name: '', code: '', address: '', client_name: '', status: 'active' }); setShowProjModal(true); }} className="btn btn--primary" style={{ padding: '6px 12px', fontSize: '12px' }}><Plus size={14} /> Tao du an</button>}
            </div>
            {projects.length === 0
              ? <div className="empty-state"><div className="empty-state__icon">🏗️</div><div className="empty-state__title">Chua co du an</div></div>
              : projects.map(p => (
                <div key={p._id} style={rowStyle}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 700 }}>{p.name} <span style={{ fontSize: '11px', color: 'var(--primary)' }}>({p.code || 'DA'})</span></div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{p.address || 'Chua ghi dia chi'}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <span className={`badge ${p.status === 'active' ? 'badge--success' : p.status === 'paused' ? 'badge--warning' : 'badge--neutral'}`}>
                      {p.status === 'active' ? 'Dang chay' : p.status === 'paused' ? 'Tam dung' : 'Hoan thanh'}
                    </span>
                    {isAdmin && <>
                      <button onClick={() => { setProjForm({ id: p._id, name: p.name, code: p.code||'', address: p.address||'', client_name: p.client_name||'', status: p.status||'active' }); setShowProjModal(true); }} style={iconBtn('var(--primary)')}><Edit2 size={14} /></button>
                      <button onClick={() => handleDeleteProject(p._id, p.name)} style={iconBtn()}><Trash2 size={14} /></button>
                    </>}
                  </div>
                </div>
              ))
            }
          </div>

        ) : tab === 'shift' ? (
          <div>
            <div className="card" style={{ padding: '16px', marginBottom: '12px' }}>
              <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Globe size={16} color="var(--primary)" /> Thong tin cong ty
              </div>
              {shiftForm ? (
                <>
                  <div className="form-group">
                    <label className="form-label">Ten cong ty</label>
                    <input type="text" className="form-input" value={shiftForm.company_name} onChange={e => setShiftForm(p => ({...p, company_name: e.target.value}))} placeholder="ET Architects" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Logo công ty</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                      {shiftForm.company_logo_url ? (
                        <div style={{ padding: '6px 12px', background: 'var(--bg-raised)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                          <img src={shiftForm.company_logo_url} alt="Logo preview" style={{ height: '40px', maxWidth: '160px', objectFit: 'contain', display: 'block' }} />
                        </div>
                      ) : null}
                      <label className="btn btn--ghost" style={{ cursor: 'pointer', padding: '8px 14px', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        📷 Tải ảnh logo lên...
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            if (file.size > 3 * 1024 * 1024) {
                              toast.error('File ảnh logo tối đa 3MB');
                              return;
                            }
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setShiftForm(p => ({ ...p, company_logo_url: reader.result }));
                              toast.success('Đã tải ảnh logo!');
                            };
                            reader.readAsDataURL(file);
                          }}
                        />
                      </label>
                      {shiftForm.company_logo_url && (
                        <button onClick={() => setShiftForm(p => ({ ...p, company_logo_url: '' }))} className="btn btn--ghost" style={{ color: 'var(--red)', fontSize: '12px' }}>
                          Xóa logo
                        </button>
                      )}
                    </div>
                  </div>
                </>
              ) : <div className="skeleton-card" style={{ height: '80px' }} />}
            </div>

            <div className="card" style={{ padding: '16px', marginBottom: '12px' }}>
              <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={16} color="var(--primary)" /> Giờ làm & Ca làm việc
              </div>
              {shiftForm ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: '14px' }}>
                    <div className="form-group">
                      <label className="form-label">Giờ vào chuẩn</label>
                      <input type="time" className="form-input" value={shiftForm.work_start_time} onChange={e => setShiftForm(p => ({...p, work_start_time: e.target.value}))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Giờ về chuẩn</label>
                      <input type="time" className="form-input" value={shiftForm.work_end_time} onChange={e => setShiftForm(p => ({...p, work_end_time: e.target.value}))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Muộn nhẹ (phút)</label>
                      <input type="number" className="form-input" value={shiftForm.minor_late_mins} onChange={e => setShiftForm(p => ({...p, minor_late_mins: Number(e.target.value)}))} min="1" max="60" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Muộn vừa (phút)</label>
                      <input type="number" className="form-input" value={shiftForm.medium_late_mins} onChange={e => setShiftForm(p => ({...p, medium_late_mins: Number(e.target.value)}))} min="1" max="120" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">OT tính từ</label>
                      <input type="time" className="form-input" value={shiftForm.ot_start_time} onChange={e => setShiftForm(p => ({...p, ot_start_time: e.target.value}))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Chế độ OT</label>
                      <select className="form-input" value="manual" disabled style={{ background: 'var(--bg-raised)', opacity: 0.8, cursor: 'not-allowed' }}>
                        <option value="manual">Thủ công (Giám đốc xem xét & phê duyệt)</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ marginBottom: '14px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>Ngay lam viec trong tuan:</div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '6px' }}>
                      {WORKING_DAYS_OPTIONS.map(d => {
                        const active = (shiftForm.working_days || []).includes(d.key);
                        return (
                          <button key={d.key} onClick={() => toggleWorkingDay(d.key)}
                            style={{ padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', border: '1.5px solid', transition: 'all 0.15s',
                              borderColor: active ? 'var(--primary)' : 'var(--border)',
                              background: active ? 'var(--primary-soft)' : 'transparent',
                              color: active ? 'var(--primary)' : 'var(--text-muted)',
                            }}>
                            {d.label}
                          </button>
                        );
                      })}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Hien tai: {(shiftForm.working_days||[]).map(k => WORKING_DAYS_OPTIONS.find(o=>o.key===k)?.label).filter(Boolean).join(', ')}
                    </div>
                  </div>

                  <div style={{ background: 'var(--bg-raised)', borderRadius: '8px', padding: '10px', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--primary)', marginBottom: '4px' }}>Quy tac dang ap dung:</div>
                    <ul style={{ fontSize: '11px', color: 'var(--text-secondary)', paddingLeft: '14px', margin: 0, lineHeight: 1.8 }}>
                      <li>Dung gio: vao truoc {shiftForm.work_start_time}</li>
                      <li>Muon nhe: {shiftForm.work_start_time} + {shiftForm.minor_late_mins} phut dau</li>
                      <li>Muon vua: {shiftForm.work_start_time} + {shiftForm.medium_late_mins} phut</li>
                      <li>Muon nhieu: qua nguong muon vua</li>
                      <li>OT: Giám đốc xem xét khen thưởng & phê duyệt cuối tháng</li>
                    </ul>
                  </div>
                </>
              ) : <div className="skeleton-card" style={{ height: '200px' }} />}
            </div>

            {isAdmin && (
              <button onClick={handleSaveShiftSettings} disabled={submitting || !shiftForm} className="btn btn--primary btn--full" style={{ marginBottom: '12px' }}>
                {submitting ? <span className="spinner" /> : 'Luu cai dat ca lam'}
              </button>
            )}
          </div>

        ) : tab === 'holidays' ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Ngay nghi le nam {new Date().getFullYear()} ({holidays.length})</span>
              {isAdmin && (
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={handleSeedVietnamHolidays} disabled={seedingHolidays} className="btn btn--ghost" style={{ padding: '6px 10px', fontSize: '11px' }}>
                    {seedingHolidays ? <span className="spinner" /> : '🇻🇳 Nap le VN'}
                  </button>
                  <button onClick={() => setShowHolidayForm(p => !p)} className="btn btn--primary" style={{ padding: '6px 12px', fontSize: '12px' }}>
                    <Plus size={14} /> Them
                  </button>
                </div>
              )}
            </div>

            {showHolidayForm && (
              <div className="card" style={{ padding: '14px', marginBottom: '10px', border: '1px solid var(--primary)' }}>
                <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '10px' }}>Them ngay le moi</div>
                <div className="form-group">
                  <label className="form-label">Ten ngay le *</label>
                  <input className="form-input" style={{ fontSize: '13px' }} value={holidayForm.name} onChange={e => setHolidayForm(p => ({...p, name: e.target.value}))} placeholder="VD: Tet Nguyen Dan" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                  <div className="form-group">
                    <label className="form-label">Tu ngay *</label>
                    <input type="date" className="form-input" style={{ fontSize: '13px' }} value={holidayForm.date} onChange={e => setHolidayForm(p => ({...p, date: e.target.value, end_date: p.end_date || e.target.value}))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Den ngay</label>
                    <input type="date" className="form-input" style={{ fontSize: '13px' }} value={holidayForm.end_date} onChange={e => setHolidayForm(p => ({...p, end_date: e.target.value}))} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={handleAddHoliday} disabled={submitting} className="btn btn--primary" style={{ flex: 1, fontSize: '12px', padding: '7px' }}>
                    {submitting ? <span className="spinner" /> : 'Luu ngay le'}
                  </button>
                  <button onClick={() => setShowHolidayForm(false)} className="btn btn--ghost" style={{ fontSize: '12px', padding: '7px' }}>Huy</button>
                </div>
              </div>
            )}

            {holidays.length === 0
              ? (
                <div className="empty-state">
                  <div className="empty-state__icon">🎌</div>
                  <div className="empty-state__title">Chua co ngay le nao</div>
                  <div className="empty-state__desc">Nhan "Nap le VN" de tu dong them ngay le Viet Nam cho nam hien tai</div>
                </div>
              )
              : holidays.map(h => (
                <div key={h._id} style={rowStyle}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600 }}>{h.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {h.date}{h.end_date && h.end_date !== h.date ? ` - ${h.end_date}` : ''}
                      <span className="badge badge--neutral" style={{ marginLeft: '8px', fontSize: '10px', padding: '1px 5px' }}>Nghỉ lễ (Không hưởng lương)</span>
                    </div>
                  </div>
                  {isAdmin && <button onClick={() => handleDeleteHoliday(h._id, h.name)} style={iconBtn()}><Trash2 size={14} /></button>}
                </div>
              ))
            }
          </div>

        ) : null}
      </div>

      {confirm && <ConfirmDialog message={confirm.message} onConfirm={confirm.onConfirm} onCancel={() => setConfirm(null)} />}

      {showDeptModal && (
        <div className="modal-overlay">
          <div className="modal-sheet animate-slide-up">
            <div className="modal-sheet__handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Them phong ban</h3>
              <button onClick={() => setShowDeptModal(false)} className="btn btn--ghost" style={{ padding: '4px 8px' }}><X size={18} /></button>
            </div>
            <div className="form-group">
              <label className="form-label">Ten phong ban *</label>
              <input type="text" className="form-input" value={deptName} onChange={e => setDeptName(e.target.value)} placeholder="VD: Phong Kien Truc" autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">Mo ta / Vi tri</label>
              <input type="text" className="form-input" value={deptDesc} onChange={e => setDeptDesc(e.target.value)} placeholder="Tang 5, 123 Nguyen Hue..." />
            </div>
            <button onClick={handleAddDept} disabled={submitting} className="btn btn--primary btn--full btn--lg" style={{ marginTop: '8px' }}>
              {submitting ? <span className="spinner" /> : 'Tao phong ban'}
            </button>
          </div>
        </div>
      )}

      {showLocModal && (
        <div className="modal-overlay">
          <div className="modal-sheet animate-slide-up" style={{ maxWidth: '500px', margin: '0 auto' }}>
            <div className="modal-sheet__handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Them vi tri van phong (Geofencing)</h3>
              <button onClick={() => setShowLocModal(false)} className="btn btn--ghost" style={{ padding: '4px 8px' }}><X size={18} /></button>
            </div>
            <div className="form-group">
              <label className="form-label">Ten vi tri *</label>
              <input type="text" className="form-input" value={locForm.name} onChange={e => setLocForm({...locForm, name: e.target.value})} placeholder="VD: Tru so chinh TP.HCM" />
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label className="form-label" style={{ marginBottom: '6px' }}>Chon vi tri tren ban do</label>
              <MapGpsPicker lat={locForm.lat} lng={locForm.lng} radius={locForm.radius_m} onSelectLocation={(nLat, nLng) => setLocForm(prev => ({...prev, lat: nLat, lng: nLng}))} />
            </div>
            <div className="form-group">
              <label className="form-label">Dia chi (hien thi cho nhan vien)</label>
              <input type="text" className="form-input" value={locForm.address} onChange={e => setLocForm({...locForm, address: e.target.value})} placeholder="Tang 5, 123 Nguyen Hue, Q1" />
            </div>
            <div className="form-group">
              <label className="form-label">Ban kinh Geofence: {locForm.radius_m}m</label>
              <input type="range" min="30" max="500" step="10" value={locForm.radius_m} onChange={e => setLocForm({...locForm, radius_m: parseInt(e.target.value)})} style={{ width: '100%' }} />
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>30m = rat chat | 100m = binh thuong | 200m+ = thoang</div>
            </div>
            <button onClick={handleAddLocation} disabled={submitting || !locForm.lat} className="btn btn--primary btn--full btn--lg">
              {submitting ? <span className="spinner" /> : !locForm.lat ? 'Can chon vi tri GPS truoc' : 'Luu vi tri van phong'}
            </button>
          </div>
        </div>
      )}

      {showProjModal && (
        <div className="modal-overlay">
          <div className="modal-sheet animate-slide-up" style={{ maxWidth: '420px', margin: '0 auto' }}>
            <div className="modal-sheet__handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700 }}>{projForm.id ? 'Sua du an' : 'Tao du an moi'}</h3>
              <button onClick={() => setShowProjModal(false)} className="btn btn--ghost" style={{ padding: '4px 8px' }}><X size={18} /></button>
            </div>
            <div className="form-group">
              <label className="form-label">Ten du an / cong trinh *</label>
              <input type="text" className="form-input" value={projForm.name} onChange={e => setProjForm({...projForm, name: e.target.value})} placeholder="VD: Biet thu Palm City" />
            </div>
            <div className="form-group">
              <label className="form-label">Ma du an</label>
              <input type="text" className="form-input" value={projForm.code} onChange={e => setProjForm({...projForm, code: e.target.value})} placeholder="CT-PALM" />
            </div>
            <div className="form-group">
              <label className="form-label">Dia chi cong trinh</label>
              <input type="text" className="form-input" value={projForm.address} onChange={e => setProjForm({...projForm, address: e.target.value})} placeholder="Dia chi..." />
            </div>
            <div className="form-group">
              <label className="form-label">Trang thai</label>
              <select className="form-input" value={projForm.status} onChange={e => setProjForm({...projForm, status: e.target.value})}>
                <option value="active">Dang hoat dong (Cho phep cham cong)</option>
                <option value="paused">Tam dung</option>
                <option value="completed">Hoan thanh</option>
              </select>
            </div>
            <button onClick={handleSaveProject} disabled={submitting} className="btn btn--primary btn--full btn--lg">
              {submitting ? <span className="spinner" /> : 'Luu du an'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

