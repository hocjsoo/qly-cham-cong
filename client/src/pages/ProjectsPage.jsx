// client/src/pages/ProjectsPage.jsx
// Quản Lý Dự Án / Công Trình — Khớp 100% Mẫu Bảng Excel THÔNG TIN NS+DA

import { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, FolderKanban, Table2, LayoutGrid, X } from 'lucide-react';
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
  'Chưa bắt đầu': { cls: 'badge--neutral', label: '⚪ Chưa bắt đầu' },
  'Chờ': { cls: 'badge--neutral', label: '⏸️ Chờ' },
  'Cần thực hiện': { cls: 'badge--warning', label: '⏳ Cần thực hiện' },
  'Đang tiến hành': { cls: 'badge--success', label: '🚀 Đang tiến hành' },
  'Đã hoàn thành': { cls: 'badge--info', label: '✅ Đã hoàn thành' },
  'Đã lưu trữ': { cls: 'badge--neutral', label: '📦 Đã lưu trữ' },
  'Khác': { cls: 'badge--neutral', label: '⚙️ Khác' },
  'Backlog': { cls: 'badge--warning', label: '📋 Backlog' },
};

export default function ProjectsPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const isAdminOrManager = isAdmin;

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [viewMode, setViewMode] = useState('table'); // 'table' (Bảng Excel) | 'grid' (Thẻ Card)

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
      code: `NS ${String(projects.length + 1).padStart(2, '0')}`,
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
                        (p.pm_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
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
            <div className="header__title">Danh Mục Dự Án (ET Staff)</div>
            <div className="header__subtitle">{totalCount} dự án · Khớp 100% Bảng Mẫu THÔNG TIN NS+DA</div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {isAdmin && (
              <button onClick={handleOpenCreate} className="btn btn--primary" style={{ padding: '6px 14px', fontSize: '13px' }}>
                <Plus size={15} /> Thêm dự án
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
            <div style={{ fontSize: '11px', color: 'var(--green)', fontWeight: 600 }}>🚀 ĐANG TIẾN HÀNH</div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--green)', marginTop: '2px' }}>{activeCount}</div>
          </div>
          <div className="card" style={{ padding: '12px 14px', background: 'var(--blue-soft)' }}>
            <div style={{ fontSize: '11px', color: 'var(--blue)', fontWeight: 600 }}>✅ ĐÃ HOÀN THÀNH</div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--blue)', marginTop: '2px' }}>{completedCount}</div>
          </div>
        </div>

        {/* Controls: Search, Filters & View Mode Switcher */}
        <div className="card" style={{ padding: '10px 14px', marginBottom: '14px' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Search input */}
            <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
              <Search size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: '32px', fontSize: '13px', padding: '7px 10px 7px 32px' }}
                placeholder="Tìm mã dự án, tên dự án, PM, ghi chú..."
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
              <option value="all">Tất cả phân loại</option>
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

            {/* View Mode Toggle Button Group */}
            <div style={{ display: 'flex', background: 'var(--bg-input)', borderRadius: '8px', padding: '2px', border: '1px solid var(--border)' }}>
              <button
                onClick={() => setViewMode('table')}
                title="Bảng Excel Mẫu"
                style={{
                  background: viewMode === 'table' ? 'var(--bg-card)' : 'transparent',
                  border: 'none', color: viewMode === 'table' ? 'var(--primary)' : 'var(--text-muted)',
                  padding: '4px 8px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600
                }}
              >
                <Table2 size={15} /> Bảng Excel
              </button>
              <button
                onClick={() => setViewMode('grid')}
                title="Giao diện Thẻ Card"
                style={{
                  background: viewMode === 'grid' ? 'var(--bg-card)' : 'transparent',
                  border: 'none', color: viewMode === 'grid' ? 'var(--primary)' : 'var(--text-muted)',
                  padding: '4px 8px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600
                }}
              >
                <LayoutGrid size={15} /> Thẻ Card
              </button>
            </div>
          </div>
        </div>

        {/* Loading / Empty States */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[1, 2, 3].map(i => <div key={i} className="skeleton-card" style={{ height: '80px', borderRadius: '12px' }} />)}
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="card empty-state" style={{ padding: '36px 16px' }}>
            <div className="empty-state__icon">🏗️</div>
            <div className="empty-state__title">Không có dự án phù hợp</div>
            <div className="empty-state__desc">Thử thay đổi từ khóa hoặc bộ lọc tìm kiếm</div>
          </div>
        ) : viewMode === 'table' ? (
          /* VIEW MODE 1: EXACT MATCH EXCEL TABLE (Mẫu THÔNG TIN NS+DA) */
          <div className="card animate-fade-in" style={{ padding: '4px', overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse', textAlign: 'left', whiteSpace: 'nowrap' }}>
              <thead>
                <tr style={{ background: 'var(--bg-raised)', borderBottom: '2px solid var(--border)', color: 'var(--text)', fontWeight: 800 }}>
                  <th style={{ padding: '10px 12px', width: '110px' }}>NO. (Mã dự án)</th>
                  <th style={{ padding: '10px 12px' }}>DỰ ÁN</th>
                  <th style={{ padding: '10px 12px' }}>DA THÀNH PHẦN</th>
                  <th style={{ padding: '10px 12px' }}>PHÂN LOẠI</th>
                  <th style={{ padding: '10px 12px' }}>PM (quản lý dự án)</th>
                  <th style={{ padding: '10px 12px' }}>NOTE</th>
                  <th style={{ padding: '10px 12px' }}>TRẠNG THÁI</th>
                  {isAdmin && <th style={{ padding: '10px 12px', textAlign: 'center' }}>THAO TÁC</th>}
                </tr>
              </thead>
              <tbody>
                {filteredProjects.map((p, idx) => {
                  const statObj = STATUS_MAP[p.status] || { cls: 'badge--neutral', label: p.status || 'Khác' };

                  return (
                    <tr
                      key={p._id || p.id}
                      style={{
                        borderBottom: '1px solid var(--border-muted)',
                        background: idx % 2 === 0 ? 'transparent' : 'var(--bg-raised)'
                      }}
                    >
                      {/* NO. (Mã dự án) */}
                      <td style={{ padding: '10px 12px', fontWeight: 800, color: 'var(--primary)' }}>
                        {p.code}
                      </td>

                      {/* DỰ ÁN */}
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--text)' }}>
                        {p.name}
                        {p.client_name && (
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 500 }}>
                            👤 Khách hàng: {p.client_name}
                          </div>
                        )}
                      </td>

                      {/* DA THÀNH PHẦN */}
                      <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>
                        {p.sub_project || '—'}
                      </td>

                      {/* PHÂN LOẠI */}
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          background: 'var(--primary-soft)', color: 'var(--primary)',
                          padding: '3px 8px', borderRadius: '6px', fontWeight: 700, fontSize: '11px'
                        }}>
                          {p.category || 'Kiến trúc'}
                        </span>
                      </td>

                      {/* PM (quản lý dự án) */}
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text)' }}>
                        {p.pm_name ? `👷 ${p.pm_name}` : '—'}
                      </td>

                      {/* NOTE */}
                      <td style={{ padding: '10px 12px', color: 'var(--text-muted)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.note || p.address || '—'}
                      </td>

                      {/* TRẠNG THÁI */}
                      <td style={{ padding: '10px 12px' }}>
                        <span className={`badge ${statObj.cls}`} style={{ fontSize: '11px', padding: '4px 10px' }}>
                          {statObj.label}
                        </span>
                      </td>

                      {/* THAO TÁC */}
                      {isAdmin && (
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                            <button
                              onClick={() => handleOpenEdit(p)}
                              style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: '4px' }}
                              title="Sửa thông tin"
                            >
                              <Edit2 size={15} />
                            </button>
                            <button
                              onClick={() => handleDelete(p)}
                              style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', padding: '4px' }}
                              title="Xóa dự án"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* VIEW MODE 2: CARD GRID VIEW */
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
            {filteredProjects.map(p => {
              const statObj = STATUS_MAP[p.status] || { cls: 'badge--neutral', label: p.status || 'Khác' };

              return (
                <div
                  key={p._id || p.id}
                  className="card card--interactive animate-fade-in"
                  style={{
                    padding: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                    borderLeft: '4px solid var(--primary)', transition: 'all 0.15s ease-in-out'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span className="badge badge--info" style={{ fontSize: '11px', fontWeight: 800 }}>
                        {p.code}
                      </span>
                      <span className={`badge ${statObj.cls}`} style={{ fontSize: '10px' }}>
                        {statObj.label}
                      </span>
                    </div>

                    <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text)', marginBottom: '4px', lineHeight: 1.3 }}>
                      {p.name}
                    </div>

                    {p.sub_project && (
                      <div style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 600, marginBottom: '6px' }}>
                        🔖 DA Thành phần: {p.sub_project}
                      </div>
                    )}

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

                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.4, marginTop: '6px' }}>
                      {p.pm_name && <div style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>👷 PM: {p.pm_name}</div>}
                      {p.note && <div>📝 Ghi chú: {p.note}</div>}
                    </div>
                  </div>

                  {isAdminOrManager && (
                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px', paddingTop: '8px', borderTop: '1px solid var(--border-muted)' }}>
                      <button
                        onClick={() => handleOpenEdit(p)}
                        className="btn btn--ghost"
                        style={{ flex: 1, fontSize: '12px', padding: '5px' }}
                      >
                        <Edit2 size={13} /> Sửa
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
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-sheet animate-slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: '460px', margin: '0 auto' }}>
            <div className="modal-sheet__handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FolderKanban size={20} color="var(--primary)" />
                <h3 style={{ fontSize: '16px', fontWeight: 800 }}>
                  {editingProject ? 'Sửa Dự án' : 'Tạo Dự án Mới'}
                </h3>
              </div>
              <button onClick={() => setShowModal(false)} className="btn btn--ghost" style={{ padding: '4px 8px' }}><X size={18} /></button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '8px' }}>
              <div className="form-group">
                <label className="form-label">NO. (Mã dự án) *</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.code}
                  onChange={e => setForm({ ...form, code: e.target.value })}
                  placeholder="VD: NS 01"
                />
              </div>
              <div className="form-group">
                <label className="form-label">DỰ ÁN *</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="VD: Biệt thự Palm City"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">DA THÀNH PHẦN</label>
              <input
                type="text"
                className="form-input"
                value={form.sub_project}
                onChange={e => setForm({ ...form, sub_project: e.target.value })}
                placeholder="VD: Hạng mục Nội thất / Cảnh quan"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div className="form-group">
                <label className="form-label">PHÂN LOẠI *</label>
                <select className="form-select" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">TRẠNG THÁI *</label>
                <select className="form-select" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                  {Object.keys(STATUS_MAP).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div className="form-group">
                <label className="form-label">PM (quản lý dự án)</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.pm_name}
                  onChange={e => setForm({ ...form, pm_name: e.target.value })}
                  placeholder="VD: KTS. Nguyễn Hoàng"
                />
              </div>
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
            </div>

            <div className="form-group">
              <label className="form-label">NOTE (Ghi chú)</label>
              <textarea
                className="form-input"
                rows={2}
                value={form.note}
                onChange={e => setForm({ ...form, note: e.target.value })}
                placeholder="Nhập ghi chú chi tiết về dự án..."
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
              <button onClick={() => setShowModal(false)} className="btn btn--ghost btn--full">Hủy</button>
              <button onClick={handleSubmit} disabled={submitting} className="btn btn--primary btn--full">
                {submitting ? <span className="spinner" /> : editingProject ? 'Lưu thông tin' : 'Tạo dự án'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
