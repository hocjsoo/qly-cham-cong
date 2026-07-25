// client/src/pages/ProjectsPage.jsx
// Trang Quản Lý Dự Án / Công Trình Kiến Trúc & Thi Công — Độc Lập & Chuyên Nghiệp

import { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, Building2, MapPin, User, FolderKanban, CheckCircle2, Clock, Sparkles, X, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import useAuthStore from '../stores/authStore';
import HeaderActions from '../components/HeaderActions';

const CATEGORIES = [
  'Kiến trúc',
  'Nội thất',
  'Kiến trúc&Nội thất',
  'Thiết kế&Thi công',
  'Cuộc thi',
  'Quy hoạch',
  'Quy hoạch&Kiến trúc',
  'Truyền thông',
  'Khác'
];

const STATUS_MAP = {
  'Đang tiến hành': { cls: 'badge--success', label: '🚀 Đang tiến hành' },
  'Cần thực hiện': { cls: 'badge--warning', label: '⏳ Cần thực hiện' },
  'Chờ': { cls: 'badge--neutral', label: '⏸️ Chờ' },
  'Đã hoàn thành': { cls: 'badge--info', label: '✅ Hoàn thành' },
  'Chưa bắt đầu': { cls: 'badge--neutral', label: '⚪ Chưa bắt đầu' },
};

export default function ProjectsPage() {
  const { user } = useAuthStore();
  const isAdminOrManager = ['admin', 'manager'].includes(user?.role);

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [form, setForm] = useState({
    code: '',
    name: '',
    sub_project: '',
    category: 'Kiến trúc',
    client_name: '',
    pm_name: '',
    address: '',
    note: '',
    status: 'Đang tiến hành',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/projects');
      setProjects(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error('Lỗi lấy danh sách dự án');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingProject(null);
    setForm({
      code: `DA-${Date.now().toString().slice(-4)}`,
      name: '',
      sub_project: '',
      category: 'Kiến trúc',
      client_name: '',
      pm_name: '',
      address: '',
      note: '',
      status: 'Đang tiến hành',
    });
    setShowModal(true);
  };

  const handleOpenEdit = (proj) => {
    setEditingProject(proj);
    setForm({
      code: proj.code || '',
      name: proj.name || '',
      sub_project: proj.sub_project || '',
      category: proj.category || 'Kiến trúc',
      client_name: proj.client_name || '',
      pm_name: proj.pm_name || '',
      address: proj.address || '',
      note: proj.note || '',
      status: proj.status || 'Đang tiến hành',
    });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error('Vui lòng nhập tên dự án');
      return;
    }

    setSubmitting(true);
    try {
      if (editingProject) {
        await api.put(`/projects/${editingProject._id || editingProject.id}`, form);
        toast.success('Đã cập nhật dự án thành công ✅');
      } else {
        await api.post('/projects', form);
        toast.success('Đã thêm dự án mới thành công 🎉');
      }
      setShowModal(false);
      fetchProjects();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Lỗi lưu thông tin dự án');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (proj) => {
    if (!window.confirm(`Bạn có chắc muốn xóa dự án "${proj.name}"?`)) return;
    try {
      await api.delete(`/projects/${proj._id || proj.id}`);
      toast.success('Đã xóa dự án');
      fetchProjects();
    } catch {
      toast.error('Lỗi xóa dự án');
    }
  };

  const filteredProjects = projects.filter(p => {
    const matchSearch = (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                        (p.code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                        (p.client_name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchCat = selectedCategory === 'all' || p.category === selectedCategory;
    const matchStat = selectedStatus === 'all' || p.status === selectedStatus;
    return matchSearch && matchCat && matchStat;
  });

  const totalCount = projects.length;
  const activeCount = projects.filter(p => p.status === 'Đang tiến hành').length;
  const completedCount = projects.filter(p => p.status === 'Đã hoàn thành').length;

  return (
    <div className="page">
      {/* Header */}
      <div className="header">
        <div className="header__inner">
          <div>
            <div className="header__title">Quản lý Dự án & Công trình</div>
            <div className="header__subtitle">{totalCount} dự án · ET Architects</div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {isAdminOrManager && (
              <button onClick={handleOpenCreate} className="btn btn--primary" style={{ padding: '6px 14px', fontSize: '13px' }}>
                <Plus size={15} /> Tạo dự án mới
              </button>
            )}
            <HeaderActions />
          </div>
        </div>
      </div>

      <div className="container" style={{ paddingTop: '16px' }}>
        {/* Stat KPI Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '14px' }}>
          <div className="card" style={{ padding: '12px 14px', background: 'var(--bg-card)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>TỔNG SỐ DỰ ÁN</div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--primary)', marginTop: '2px' }}>{totalCount}</div>
          </div>
          <div className="card" style={{ padding: '12px 14px', background: 'var(--green-soft)' }}>
            <div style={{ fontSize: '11px', color: 'var(--green)', fontWeight: 600 }}>ĐANG TIẾN HÀNH</div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--green)', marginTop: '2px' }}>{activeCount}</div>
          </div>
          <div className="card" style={{ padding: '12px 14px', background: 'var(--blue-soft)' }}>
            <div style={{ fontSize: '11px', color: 'var(--blue)', fontWeight: 600 }}>ĐÃ HOÀN THÀNH</div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--blue)', marginTop: '2px' }}>{completedCount}</div>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="card" style={{ padding: '10px 14px', marginBottom: '14px' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {/* Search input */}
            <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
              <Search size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: '32px', fontSize: '13px', padding: '7px 10px 7px 32px' }}
                placeholder="Tìm mã dự án, tên dự án, chủ đầu tư..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Category Filter */}
            <select
              className="form-select"
              style={{ width: 'auto', minWidth: '130px', fontSize: '13px', padding: '7px 10px' }}
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
            >
              <option value="all">Tất cả thể loại</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            {/* Status Filter */}
            <select
              className="form-select"
              style={{ width: 'auto', minWidth: '130px', fontSize: '13px', padding: '7px 10px' }}
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value)}
            >
              <option value="all">Tất cả trạng thái</option>
              {Object.keys(STATUS_MAP).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* Projects Cards List */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[1, 2, 3].map(i => <div key={i} className="skeleton-card" style={{ height: '90px', borderRadius: '12px' }} />)}
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="card empty-state" style={{ padding: '36px 16px' }}>
            <div className="empty-state__icon">🏗️</div>
            <div className="empty-state__title">Không tìm thấy dự án nào</div>
            <div className="empty-state__desc">Thử thay đổi từ khóa hoặc bộ lọc tìm kiếm</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
            {filteredProjects.map(p => {
              const statObj = STATUS_MAP[p.status] || { cls: 'badge--neutral', label: p.status || 'Khác' };

              return (
                <div
                  key={p._id || p.id}
                  className="card animate-fade-in"
                  style={{
                    padding: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                    borderLeft: '4px solid var(--primary)', transition: 'all 0.15s ease-in-out'
                  }}
                >
                  <div>
                    {/* Top Row: Code + Status Badge */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span className="badge badge--info" style={{ fontSize: '11px', fontWeight: 800 }}>
                        {p.code}
                      </span>
                      <span className={`badge ${statObj.cls}`} style={{ fontSize: '10px' }}>
                        {statObj.label}
                      </span>
                    </div>

                    {/* Project Title */}
                    <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text)', marginBottom: '4px', lineHeight: 1.3 }}>
                      {p.name}
                    </div>

                    {p.sub_project && (
                      <div style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 600, marginBottom: '6px' }}>
                        🔖 {p.sub_project}
                      </div>
                    )}

                    {/* Metadata Badges */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', margin: '8px 0' }}>
                      <span style={{ fontSize: '11px', background: 'var(--bg-raised)', padding: '2px 8px', borderRadius: '6px', color: 'var(--text-secondary)' }}>
                        🎨 {p.category || 'Kiến trúc'}
                      </span>
                      {p.client_name && (
                        <span style={{ fontSize: '11px', background: 'var(--bg-raised)', padding: '2px 8px', borderRadius: '6px', color: 'var(--text-secondary)' }}>
                          👤 KH: {p.client_name}
                        </span>
                      )}
                    </div>

                    {/* Address & PM */}
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.4, marginTop: '6px' }}>
                      {p.address && <div>📍 {p.address}</div>}
                      {p.pm_name && <div style={{ color: 'var(--text-secondary)', fontWeight: 600, marginTop: '2px' }}>👷 KTS Trưởng: {p.pm_name}</div>}
                    </div>
                  </div>

                  {/* Footer Actions */}
                  {isAdminOrManager && (
                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px', paddingTop: '8px', borderTop: '1px solid var(--border-muted)' }}>
                      <button
                        onClick={() => handleOpenEdit(p)}
                        className="btn btn--ghost"
                        style={{ flex: 1, fontSize: '12px', padding: '5px' }}
                      >
                        <Edit2 size={13} /> Chỉnh sửa
                      </button>
                      <button
                        onClick={() => handleDelete(p)}
                        className="btn btn--ghost"
                        style={{ fontSize: '12px', padding: '5px 10px', color: 'var(--red)' }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Create / Edit Project */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-sheet animate-slide-up" style={{ maxWidth: '460px', margin: '0 auto' }}>
            <div className="modal-sheet__handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FolderKanban size={20} color="var(--primary)" />
                <h3 style={{ fontSize: '16px', fontWeight: 800 }}>
                  {editingProject ? 'Chỉnh sửa Dự án' : 'Tạo Dự án Mới'}
                </h3>
              </div>
              <button onClick={() => setShowModal(false)} className="btn btn--ghost" style={{ padding: '4px 8px' }}><X size={18} /></button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '8px' }}>
              <div className="form-group">
                <label className="form-label">Mã dự án *</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.code}
                  onChange={e => setForm({ ...form, code: e.target.value })}
                  placeholder="VD: DA-PALM"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Tên dự án / Công trình *</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="VD: Biệt thự Palm City"
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div className="form-group">
                <label className="form-label">Thể loại dự án</label>
                <select className="form-select" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Trạng thái</label>
                <select className="form-select" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                  {Object.keys(STATUS_MAP).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div className="form-group">
                <label className="form-label">Chủ đầu tư / Khách hàng</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.client_name}
                  onChange={e => setForm({ ...form, client_name: e.target.value })}
                  placeholder="VD: Anh Minh / Ecopark"
                />
              </div>
              <div className="form-group">
                <label className="form-label">KTS Trưởng / PM</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.pm_name}
                  onChange={e => setForm({ ...form, pm_name: e.target.value })}
                  placeholder="VD: KTS. Nguyễn Hoàng"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Địa chỉ công trình</label>
              <input
                type="text"
                className="form-input"
                value={form.address}
                onChange={e => setForm({ ...form, address: e.target.value })}
                placeholder="VD: Quận 2, TP. Hồ Chí Minh"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Ghi chú dự án</label>
              <textarea
                className="form-input"
                rows={2}
                value={form.note}
                onChange={e => setForm({ ...form, note: e.target.value })}
                placeholder="Nhập ghi chú hoặc thông tin bổ sung..."
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
              <button onClick={() => setShowModal(false)} className="btn btn--ghost btn--full">Hủy</button>
              <button onClick={handleSubmit} disabled={submitting} className="btn btn--primary btn--full">
                {submitting ? <span className="spinner" /> : editingProject ? 'Lưu cập nhật' : 'Tạo dự án'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
