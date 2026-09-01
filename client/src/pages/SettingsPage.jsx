// src/pages/SettingsPage.jsx
// Cai dat he thong — Admin/Leader

import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, X, Edit2, Check, AlertTriangle, Clock, Globe } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import useAuthStore from '../stores/authStore';
import HeaderActions from '../components/HeaderActions';
import MapGpsPicker from '../components/MapGpsPicker';
import useSettingsStore from '../stores/settingsStore';
import {
  DEFAULT_COMPANY_ADDRESS,
  DEFAULT_COMPANY_LOGO_URL,
  DEFAULT_COMPANY_NAME,
  DEFAULT_EMAIL_FOOTER_NOTE,
  normalizeCompanyName,
} from '../utils/dynamicBranding';

const WORKING_DAYS_OPTIONS = [
  { key: 'Mon', label: 'T2' }, { key: 'Tue', label: 'T3' }, { key: 'Wed', label: 'T4' },
  { key: 'Thu', label: 'T5' }, { key: 'Fri', label: 'T6' }, { key: 'Sat', label: 'T7' }, { key: 'Sun', label: 'CN' },
];

const HOLIDAY_WORK_MULTIPLIERS = [1.5, 2, 3];
const normalizeHolidayMultiplier = value => (
  HOLIDAY_WORK_MULTIPLIERS.includes(Number(value)) ? Number(value) : 1.5
);
const formatHolidayMultiplier = value => `${normalizeHolidayMultiplier(value).toLocaleString('vi-VN')}x`;
const createEmptyHolidayForm = () => ({ id: null, name: '', date: '', end_date: '', work_multiplier: 1.5, send_notification: true });

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

  const [holidayForm, setHolidayForm] = useState(createEmptyHolidayForm);
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
      } else if (tab === 'shift') {
        const { data } = await api.get('/settings');
        setShiftForm({
          work_start_time: data.work_start_time || '09:00',
          work_end_time: data.work_end_time || '18:30',
          lunch_break_start: data.lunch_break_start || '12:00',
          lunch_break_end: data.lunch_break_end || '13:00',
          minor_late_mins: data.minor_late_mins ?? 30,
          medium_late_mins: data.medium_late_mins ?? 60,
          ot_start_time: data.ot_start_time || '18:30',
          ot_mode: data.ot_mode || 'manual',
          working_days: data.working_days || ['Mon','Tue','Wed','Thu','Fri','Sat'],
          company_name: normalizeCompanyName(data.company_name),
          company_logo_url: data.company_logo_url || DEFAULT_COMPANY_LOGO_URL,
          announcement_display_days: data.announcement_display_days ?? 7,
          anniversary_display_mode: data.anniversary_display_mode || 'month',
          anniversary_display_days: data.anniversary_display_days ?? 7,
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

  const handleEditDept = async (id) => {
    if (!editDeptForm.name.trim()) { toast.error('Ten phong ban khong duoc de trong'); return; }
    setSubmitting(true);
    try {
      await api.put(`/departments/${id}`, editDeptForm);
      toast.success('Da cap nhat phong ban'); setEditingDept(null); loadData();
    } catch (err) { toast.error(err?.response?.data?.error || 'Loi cap nhat phong ban'); }
    finally { setSubmitting(false); }
  };

  const handleDeleteDept = (id, name) => {
    askConfirm(`Xoa phong ban "${name}"?`, async () => {
      setConfirm(null);
      try { await api.delete(`/departments/${id}`); toast.success('Da xoa phong ban'); loadData(); }
      catch (err) { toast.error(err?.response?.data?.error || 'Loi xoa phong ban'); }
    });
  };

  const handleSaveLocation = async () => {
    if (!locForm.name.trim() || !locForm.address.trim()) { toast.error('Ten va dia chi la bat buoc'); return; }
    setSubmitting(true);
    try {
      if (locForm.id) {
        await api.put(`/locations/${locForm.id}`, locForm);
        toast.success('Đã cập nhật vị trí văn phòng!');
      } else {
        await api.post('/locations', locForm);
        toast.success('Đã thêm vị trí văn phòng!');
      }
      setShowLocModal(false);
      setLocForm({ id: null, name: '', address: '', lat: '', lng: '', radius_m: 100 });
      loadData();
    } catch (err) { toast.error(err?.response?.data?.error || 'Lỗi lưu vị trí'); }
    finally { setSubmitting(false); }
  };

  const handleDeleteLocation = (id, name) => {
    askConfirm(`Xoa vi tri "${name}"?`, async () => {
      setConfirm(null);
      try { await api.delete(`/locations/${id}`); toast.success('Da xoa vi tri'); loadData(); }
      catch { toast.error('Loi xoa vi tri'); }
    });
  };

  const handleSaveShiftSettings = async () => {
    if (!shiftForm) return;
    setSubmitting(true);
    try {
      const { data } = await api.put('/settings', shiftForm);
      if (data.settings) {
        setShiftForm(prev => ({ ...prev, ...data.settings }));
        useSettingsStore.getState().updateSettingsState(data.settings);
      }
      toast.success('Đã lưu cấu hình công ty và ca làm!');
    } catch { toast.error('Lỗi lưu cấu hình'); }
    finally { setSubmitting(false); }
  };

  const toggleWorkingDay = (day) => {
    setShiftForm(prev => {
      const days = prev.working_days || [];
      return { ...prev, working_days: days.includes(day) ? days.filter(d => d !== day) : [...days, day] };
    });
  };

  const handleSaveHoliday = async () => {
    if (!holidayForm.name.trim() || !holidayForm.date) { toast.error('Tên và ngày là bắt buộc'); return; }
    const workMultiplier = Number(holidayForm.work_multiplier);
    if (!HOLIDAY_WORK_MULTIPLIERS.includes(workMultiplier)) { toast.error('Hệ số công ngày lễ không hợp lệ'); return; }
    setSubmitting(true);
    try {
      const payload = { ...holidayForm, work_multiplier: workMultiplier, end_date: holidayForm.end_date || holidayForm.date };
      if (holidayForm.id) {
        await api.put(`/holidays/${holidayForm.id}`, payload);
        toast.success('Đã cập nhật ngày lễ!');
      } else {
        await api.post('/holidays', payload);
        toast.success('Đã thêm ngày lễ!');
      }
      setHolidayForm(createEmptyHolidayForm());
      setShowHolidayForm(false);
      loadData();
    } catch (err) { toast.error(err?.response?.data?.error || 'Lỗi lưu ngày lễ'); }
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
      toast.success(data.message || 'Đã tự động nạp các ngày nghỉ lễ Việt Nam!');
      loadData();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Lỗi nạp ngày nghỉ lễ');
    } finally {
      setSeedingHolidays(false);
    }
  };

  const tabs = [
    { key: 'depts', label: '🏢 Phòng ban', count: depts.length },
    { key: 'locations', label: '📍 Vị trí GPS', count: locations.length },
    { key: 'shift', label: '⚙️ Ca làm & Quy tắc' },
    { key: 'holidays', label: '🎌 Ngày lễ', count: holidays.length },
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
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Vị trí văn phòng (Geofencing GPS)</span>
              {isAdmin && <button onClick={() => setShowLocModal(true)} className="btn btn--primary" style={{ padding: '6px 12px', fontSize: '12px' }}><Plus size={14} /> Them</button>}
            </div>
            {locations.length === 0
              ? <div className="empty-state"><div className="empty-state__icon">📍</div><div className="empty-state__title">Chua co vi tri van phong</div></div>
              : locations.map(l => (
                <div key={l._id} className="card" style={{ padding: '12px', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 600 }}>{l.name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{l.address || 'Chưa ghi địa chỉ'}</div>
                    </div>
                    {isAdmin && (
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          onClick={() => {
                            setLocForm({ id: l._id, name: l.name, address: l.address || '', lat: l.lat || '', lng: l.lng || '', radius_m: l.radius_m || 100 });
                            setShowLocModal(true);
                          }}
                          style={iconBtn('var(--primary)')}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => handleDeleteLocation(l._id, l.name)} style={iconBtn()}><Trash2 size={14} /></button>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '6px', fontSize: '11px', flexWrap: 'wrap' }}>
                    <span className="badge badge--info">Bán kính: {l.radius_m}m</span>
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

        ) : tab === 'shift' ? (
          <div>
            <div className="card" style={{ padding: '16px', marginBottom: '12px' }}>
              <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Globe size={16} color="var(--primary)" /> Thông tin công ty
              </div>
              {shiftForm ? (
                <>
                  <div className="form-group">
                    <label className="form-label">Tên công ty</label>
                    <input type="text" className="form-input" value={shiftForm.company_name} onChange={e => setShiftForm(p => ({...p, company_name: e.target.value}))} placeholder={DEFAULT_COMPANY_NAME} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Địa chỉ trụ sở công ty (Chân trang email & hệ thống)</label>
                    <input
                      type="text"
                      className="form-input"
                      value={shiftForm.company_address ?? ''}
                      onChange={e => setShiftForm(p => ({...p, company_address: e.target.value}))}
                      placeholder={DEFAULT_COMPANY_ADDRESS}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Ghi chú chân trang email mặc định</label>
                    <input
                      type="text"
                      className="form-input"
                      value={shiftForm.email_footer_note ?? ''}
                      onChange={e => setShiftForm(p => ({...p, email_footer_note: e.target.value}))}
                      placeholder={DEFAULT_EMAIL_FOOTER_NOTE}
                    />
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
                            reader.onloadend = async () => {
                              const logoUrl = reader.result;
                              setShiftForm(p => ({ ...p, company_logo_url: logoUrl }));
                              useSettingsStore.getState().setCompanyLogo(logoUrl);

                              try {
                                const payload = { ...shiftForm, company_logo_url: logoUrl };
                                const { data } = await api.put('/settings', payload);
                                if (data.settings) {
                                  useSettingsStore.getState().updateSettingsState(data.settings);
                                }
                                toast.success('Đã tải và lưu logo công ty!');
                              } catch {
                                toast.error('Lỗi lưu logo lên hệ thống');
                              }
                            };
                            reader.readAsDataURL(file);
                          }}
                        />
                      </label>
                      {shiftForm.company_logo_url && (
                        <button
                          onClick={async () => {
                            setShiftForm(p => ({ ...p, company_logo_url: '' }));
                            useSettingsStore.getState().setCompanyLogo('');
                            try {
                              const payload = { ...shiftForm, company_logo_url: '' };
                              const { data } = await api.put('/settings', payload);
                              if (data.settings) {
                                useSettingsStore.getState().updateSettingsState(data.settings);
                              }
                              toast.success('Đã xóa logo công ty!');
                            } catch {
                              toast.error('Lỗi xóa logo');
                            }
                          }}
                          className="btn btn--ghost"
                          style={{ color: 'var(--red)', fontSize: '12px' }}
                        >
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
                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--primary)', marginBottom: '4px' }}>Quy tắc đang áp dụng:</div>
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

            {/* Display Duration & Expiry Settings Card */}
            <div className="card" style={{ padding: '16px', marginBottom: '12px' }}>
              <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={16} color="var(--primary)" /> 📢 Cài đặt Thời gian hiển thị (Thông báo & Kỷ niệm)
              </div>
              {shiftForm ? (
                <>
                  <div className="form-group" style={{ marginBottom: '14px' }}>
                    <label className="form-label">Thời gian hiển thị Thông báo mặc định</label>
                    <select
                      className="form-input"
                      value={shiftForm.announcement_display_days}
                      onChange={e => setShiftForm(p => ({ ...p, announcement_display_days: Number(e.target.value) }))}
                    >
                      <option value="3">3 ngày (Tự động gỡ sau 3 ngày)</option>
                      <option value="7">7 ngày (Tự động gỡ sau 1 tuần - Mặc định)</option>
                      <option value="14">14 ngày (Tự động gỡ sau 2 tuần)</option>
                      <option value="30">30 ngày (Tự động gỡ sau 1 tháng)</option>
                      <option value="0">Vô thời hạn (Chỉ gỡ khi Admin xóa thủ công)</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ marginBottom: '14px' }}>
                    <label className="form-label">Chu kỳ hiển thị Kỷ niệm gắn bó & Sinh nhật</label>
                    <select
                      className="form-input"
                      value={shiftForm.anniversary_display_mode}
                      onChange={e => setShiftForm(p => ({ ...p, anniversary_display_mode: e.target.value }))}
                    >
                      <option value="month">🗓️ Trọn vẹn trong tháng (Toàn bộ nhân sự có sự kiện trong tháng)</option>
                      <option value="week">📅 Trong tuần diễn ra sự kiện (±3 ngày quanh ngày kỷ niệm)</option>
                      <option value="days_around">⏳ Theo khoảng số ngày (Trước & sau ngày kỷ niệm)</option>
                      <option value="exact_day">🎯 Đúng ngày diễn ra (Chỉ hiện trong ngày sinh nhật / kỷ niệm)</option>
                    </select>
                  </div>

                  {shiftForm.anniversary_display_mode === 'days_around' && (
                    <div className="form-group" style={{ marginBottom: '14px' }}>
                      <label className="form-label">Số ngày hiển thị quanh ngày sự kiện (ngày)</label>
                      <input
                        type="number"
                        className="form-input"
                        min="1"
                        max="30"
                        value={shiftForm.anniversary_display_days}
                        onChange={e => setShiftForm(p => ({ ...p, anniversary_display_days: Number(e.target.value) }))}
                      />
                    </div>
                  )}

                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', lineHeight: 1.6, background: 'var(--bg-raised)', padding: '10px 12px', borderRadius: '8px' }}>
                    💡 <em>Khi hết thời gian cấu hình, bài đăng thông báo hoặc thẻ vinh danh kỷ niệm sẽ tự động ẩn khỏi Trang chủ mà Admin không cần thao tác gỡ thủ công.</em>
                  </div>
                </>
              ) : <div className="skeleton-card" style={{ height: '140px' }} />}
            </div>

            {isAdmin && (
              <button onClick={handleSaveShiftSettings} disabled={submitting || !shiftForm} className="btn btn--primary btn--full" style={{ marginBottom: '12px' }}>
                {submitting ? <span className="spinner" /> : 'Lưu cài đặt hệ thống'}
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
                  <button onClick={() => {
                    if (showHolidayForm) setShowHolidayForm(false);
                    else {
                      setHolidayForm(createEmptyHolidayForm());
                      setShowHolidayForm(true);
                    }
                  }} className="btn btn--primary" style={{ padding: '6px 12px', fontSize: '12px' }}>
                    <Plus size={14} /> Them
                  </button>
                </div>
              )}
            </div>

            {showHolidayForm && (
              <div className="card" style={{ padding: '14px', marginBottom: '10px', border: '1px solid var(--primary)' }}>
                <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '10px' }}>{holidayForm.id ? 'Sửa ngày lễ' : 'Thêm ngày lễ mới'}</div>
                <div className="form-group">
                  <label className="form-label">Tên ngày lễ *</label>
                  <input className="form-input" style={{ fontSize: '13px' }} value={holidayForm.name} onChange={e => setHolidayForm(p => ({...p, name: e.target.value}))} placeholder="VD: Tết Nguyên Đán" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                  <div className="form-group">
                    <label className="form-label">Từ ngày *</label>
                    <input type="date" className="form-input" style={{ fontSize: '13px' }} value={holidayForm.date} onChange={e => setHolidayForm(p => ({...p, date: e.target.value, end_date: p.end_date || e.target.value}))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Đến ngày</label>
                    <input type="date" className="form-input" style={{ fontSize: '13px' }} value={holidayForm.end_date} onChange={e => setHolidayForm(p => ({...p, end_date: e.target.value}))} />
                  </div>
                </div>
                <div className="form-group" style={{ marginBottom: '10px' }}>
                  <label className="form-label" htmlFor="holiday-work-multiplier">Hệ số công khi đi làm ngày lễ</label>
                  <select
                    id="holiday-work-multiplier"
                    className="form-select"
                    value={normalizeHolidayMultiplier(holidayForm.work_multiplier)}
                    onChange={e => setHolidayForm(p => ({ ...p, work_multiplier: Number(e.target.value) }))}
                    style={{ fontSize: '13px' }}
                  >
                    {HOLIDAY_WORK_MULTIPLIERS.map(multiplier => (
                      <option key={multiplier} value={multiplier}>{formatHolidayMultiplier(multiplier)} công</option>
                    ))}
                  </select>
                  <div style={{ marginTop: '4px', color: 'var(--text-muted)', fontSize: '11px' }}>
                    Chỉ áp dụng khi nhân viên thực sự chấm công trong ngày lễ.
                  </div>
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: 'var(--text)' }}>
                    <input
                      type="checkbox"
                      checked={holidayForm.send_notification ?? true}
                      onChange={e => setHolidayForm(p => ({ ...p, send_notification: e.target.checked }))}
                    />
                    <span>📢 Gửi thông báo đến toàn bộ nhân viên</span>
                  </label>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={handleSaveHoliday} disabled={submitting} className="btn btn--primary" style={{ flex: 1, fontSize: '12px', padding: '7px' }}>
                    {submitting ? <span className="spinner" /> : 'Lưu ngày lễ'}
                  </button>
                  <button onClick={() => setShowHolidayForm(false)} className="btn btn--ghost" style={{ fontSize: '12px', padding: '7px' }}>Hủy</button>
                </div>
              </div>
            )}

            {holidays.length === 0
              ? (
                <div className="empty-state">
                  <div className="empty-state__icon">🎌</div>
                  <div className="empty-state__title">Chưa có ngày lễ nào</div>
                  <div className="empty-state__desc">Nhấn "Nạp lễ VN" để tự động thêm ngày lễ Việt Nam cho năm hiện tại</div>
                </div>
              )
              : holidays.map(h => (
                <div key={h._id} style={rowStyle}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600 }}>{h.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {h.date}{h.end_date && h.end_date !== h.date ? ` - ${h.end_date}` : ''}
                      <span className="badge badge--neutral" style={{ marginLeft: '8px', fontSize: '10px', padding: '1px 5px' }}>Nghỉ lễ</span>
                      <span className="badge badge--success" style={{ marginLeft: '6px', fontSize: '10px', padding: '1px 5px' }}>
                        Đi làm: {formatHolidayMultiplier(h.work_multiplier)}
                      </span>
                    </div>
                  </div>
                  {isAdmin && (
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        onClick={() => {
                          setHolidayForm({
                            id: h._id,
                            name: h.name,
                            date: h.date,
                            end_date: h.end_date || h.date,
                            work_multiplier: normalizeHolidayMultiplier(h.work_multiplier),
                            send_notification: h.send_notification ?? true,
                            is_paid: h.is_paid || false,
                            note: h.note || '',
                          });
                          setShowHolidayForm(true);
                        }}
                        style={iconBtn('var(--primary)')}
                      >
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => handleDeleteHoliday(h._id, h.name)} style={iconBtn()}><Trash2 size={14} /></button>
                    </div>
                  )}
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
              <label className="form-label">Mô tả / Vị trí</label>
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
              <h3 style={{ fontSize: '16px', fontWeight: 700 }}>{locForm.id ? 'Sửa vị trí văn phòng (Geofencing)' : 'Thêm vị trí văn phòng (Geofencing)'}</h3>
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
              <label className="form-label">Bán kính Geofence: {locForm.radius_m}m</label>
              <input type="range" min="30" max="1500" step="10" value={locForm.radius_m} onChange={e => setLocForm({...locForm, radius_m: parseInt(e.target.value)})} style={{ width: '100%' }} />
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', justifyContent: 'space-between' }}>
                <span>30m (Chặt)</span>
                <span>250m (Chuẩn)</span>
                <span>500m</span>
                <span>1500m (Rộng)</span>
              </div>
            </div>
            <button onClick={handleSaveLocation} disabled={submitting || !locForm.lat} className="btn btn--primary btn--full btn--lg">
              {submitting ? <span className="spinner" /> : !locForm.lat ? 'Can chon vi tri GPS truoc' : (locForm.id ? 'Luu cap nhat vi tri' : 'Luu vi tri van phong')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

