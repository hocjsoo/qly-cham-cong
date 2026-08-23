// client/src/pages/ProjectsPage.jsx
// Quản Lý Dự Án / Công Trình — Khớp 100% Mẫu Bảng Excel THÔNG TIN NS+DA

import { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, FolderKanban, Table2, LayoutList, LayoutGrid, X } from 'lucide-react';
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
  'active': { cls: 'badge--success', label: '🚀 Đang tiến hành' },
  'Cần thực hiện': { cls: 'badge--warning', label: '⏳ Cần thực hiện' },
  'paused': { cls: 'badge--warning', label: '⏸️ Tạm dừng' },
  'Chờ': { cls: 'badge--neutral', label: '⏸️ Chờ' },
  'Chưa bắt đầu': { cls: 'badge--neutral', label: '⚪ Chưa bắt đầu' },
  'Đã hoàn thành': { cls: 'badge--info', label: '✅ Đã hoàn thành' },
  'completed': { cls: 'badge--info', label: '✅ Đã hoàn thành' },
  'Đã lưu trữ': { cls: 'badge--neutral', label: '📦 Đã lưu trữ' },
  'Backlog': { cls: 'badge--warning', label: '📋 Backlog' },
  'Khác': { cls: 'badge--neutral', label: '⚙️ Khác' },
};

const SELECT_STATUSES = [
  'Đang tiến hành',
  'Cần thực hiện',
  'Chờ',
  'Chưa bắt đầu',
  'Đã hoàn thành',
  'Đã lưu trữ',
  'Backlog',
  'Khác'
];

export default function ProjectsPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const isLeader = user?.role === 'leader' || user?.role === 'manager';
  const isAdminOrManager = ['admin', 'leader', 'manager'].includes(user?.role);
  const isStaff = !isAdminOrManager;

  const [projects, setProjects] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState(isStaff ? 'my' : 'all'); // 'my' | 'all'
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedYear, setSelectedYear] = useState('all');
  const [selectedPm, setSelectedPm] = useState('all');
  const [selectedCodePrefix, setSelectedCodePrefix] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [sortBy, setSortBy] = useState('date_desc'); // 'date_desc' | 'date_asc' | 'name_asc' | 'name_desc' | 'progress_desc'
  const [viewMode, setViewMode] = useState('table'); // 'table' (Bảng Excel) | 'grid' (Thẻ Card)
  const [selectedProjectDetail, setSelectedProjectDetail] = useState(null);

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
    members: [],
    deadline: '',
    progress: 0,
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchProjects();
    fetchStaff();
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

  const fetchStaff = async () => {
    try {
      const { data } = await api.get('/users').catch(() => ({ data: [] }));
      const users = Array.isArray(data) ? data : (data?.users || []);
      setStaffList(users.filter(u => u.is_active !== false));
    } catch {
      setStaffList([]);
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
      pm_name: user?.full_name || '',
      address: '',
      note: '',
      status: 'Đang tiến hành',
      members: [user?._id || user?.id].filter(Boolean),
      deadline: '',
      progress: 0,
    });
    setShowModal(true);
  };

  const handleOpenEdit = (proj) => {
    setEditingProject(proj);
    let st = proj.status || 'Đang tiến hành';
    if (st === 'active') st = 'Đang tiến hành';
    if (st === 'paused') st = 'Chờ';
    if (st === 'completed') st = 'Đã hoàn thành';

    const memberIds = Array.isArray(proj.members)
      ? proj.members.map(m => m?._id || m?.id || m)
      : [];

    setForm({
      code: proj.code || '',
      name: proj.name || '',
      sub_project: proj.sub_project || '',
      category: proj.category || 'Kiến trúc',
      client_name: proj.client_name || '',
      pm_name: proj.pm_name || '',
      address: proj.address || '',
      note: proj.note || '',
      status: st,
      members: memberIds,
      deadline: proj.deadline || '',
      progress: proj.progress || 0,
    });
    setShowModal(true);
  };

  const toggleMemberSelection = (userId) => {
    setForm(prev => {
      const exists = prev.members.includes(userId);
      return {
        ...prev,
        members: exists
          ? prev.members.filter(id => id !== userId)
          : [...prev.members, userId]
      };
    });
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error('Vui lòng nhập tên dự án');
      return;
    }

    setSubmitting(true);
    try {
      if (editingProject) {
        const { data } = await api.put(`/projects/${editingProject._id || editingProject.id}`, form);
        const updatedProj = data.project || { ...editingProject, ...form };
        setProjects(prev => prev.map(p => (p._id || p.id) === (editingProject._id || editingProject.id) ? updatedProj : p));
        toast.success('Đã cập nhật dự án thành công ✅');
      } else {
        const { data } = await api.post('/projects', form);
        if (data.project) setProjects(prev => [data.project, ...prev]);
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

  const myProjectsList = projects.filter(p => {
    const uid = user?._id || user?.id;
    const isMember = Array.isArray(p.members) && p.members.some(m => (m?._id || m?.id || m) === uid);
    const isPm = p.pm_name && user?.full_name && p.pm_name.toLowerCase().includes(user.full_name.toLowerCase());
    return isMember || isPm;
  });

  // Extract Dynamic Filter Lists (Years, PMs, Project Codes)
  const getProjectYear = (p) => {
    const codeMatch = p.code && String(p.code).match(/^(\d{2})\./);
    if (codeMatch) return `20${codeMatch[1]}`;
    if (p.deadline && String(p.deadline).length >= 4) return String(p.deadline).slice(0, 4);
    if (p.created_at) return new Date(p.created_at).getFullYear().toString();
    return null;
  };

  const availableYears = Array.from(new Set(
    projects.map(p => getProjectYear(p)).filter(Boolean)
  )).sort().reverse();

  const availablePms = Array.from(new Set(
    projects.map(p => p.pm_name && p.pm_name.trim()).filter(Boolean)
  )).sort((a, b) => a.localeCompare(b, 'vi'));

  const availableCodes = Array.from(new Set(
    projects.map(p => p.code && p.code.trim()).filter(Boolean)
  )).sort((a, b) => a.localeCompare(b, 'vi'));

  const hasActiveFilters = Boolean(
    searchTerm.trim() ||
    selectedYear !== 'all' ||
    selectedPm !== 'all' ||
    selectedCodePrefix !== 'all' ||
    selectedCategory !== 'all' ||
    selectedStatus !== 'all'
  );

  const resetAllFilters = () => {
    setSearchTerm('');
    setSelectedYear('all');
    setSelectedPm('all');
    setSelectedCodePrefix('all');
    setSelectedCategory('all');
    setSelectedStatus('all');
  };

  const filteredProjects = projects.filter(p => {
    const uid = user?._id || user?.id;
    const isMember = Array.isArray(p.members) && p.members.some(m => (m?._id || m?.id || m) === uid);
    const isPm = p.pm_name && user?.full_name && p.pm_name.toLowerCase().includes(user.full_name.toLowerCase());
    const matchScope = scope === 'all' ? true : (isMember || isPm);

    const q = searchTerm.trim().toLowerCase();
    const matchSearch = !q ||
                        (p.name || '').toLowerCase().includes(q) ||
                        (p.code || '').toLowerCase().includes(q) ||
                        (p.pm_name || '').toLowerCase().includes(q) ||
                        (p.client_name || '').toLowerCase().includes(q) ||
                        (p.address || '').toLowerCase().includes(q) ||
                        (p.note || '').toLowerCase().includes(q);

    const projYear = getProjectYear(p);
    const matchYear = selectedYear === 'all' || projYear === selectedYear;
    const matchPm = selectedPm === 'all' || (p.pm_name && p.pm_name.trim().toLowerCase() === selectedPm.toLowerCase());
    const matchCode = selectedCodePrefix === 'all' || (p.code && p.code.toLowerCase().includes(selectedCodePrefix.toLowerCase()));
    const matchCat = selectedCategory === 'all' || p.category === selectedCategory;
    const matchStat = selectedStatus === 'all' || p.status === selectedStatus;

    return matchScope && matchSearch && matchYear && matchPm && matchCode && matchCat && matchStat;
  }).sort((a, b) => {
    if (sortBy === 'name_asc') {
      return (a.name || '').localeCompare(b.name || '', 'vi');
    } else if (sortBy === 'name_desc') {
      return (b.name || '').localeCompare(a.name || '', 'vi');
    } else if (sortBy === 'date_desc') {
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    } else if (sortBy === 'date_asc') {
      return new Date(a.created_at || 0) - new Date(b.created_at || 0);
    } else if (sortBy === 'progress_desc') {
      return (b.progress || 0) - (a.progress || 0);
    }
    return 0;
  });

  const currentScopeList = scope === 'my' ? myProjectsList : projects;
  const displayTotalCount = currentScopeList.length;
  const displayActiveCount = currentScopeList.filter(p => p.status === 'Đang tiến hành').length;
  const displayCompletedCount = currentScopeList.filter(p => p.status === 'Đã hoàn thành').length;

  return (
    <div className="page">
      {/* Header */}
      <div className="header">
        <div className="header__inner">
          <div>
            <div className="header__title">Danh Mục Dự Án (ET Staff)</div>
            <div className="header__subtitle">
              {scope === 'my' ? `${myProjectsList.length} dự án bạn đang tham gia` : `${projects.length} dự án toàn công ty`} · Khớp 100% Bảng Mẫu THÔNG TIN NS+DA
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {isAdminOrManager && (
              <button onClick={handleOpenCreate} className="btn btn--primary" style={{ padding: '6px 14px', fontSize: '13px' }}>
                <Plus size={15} /> Thêm dự án
              </button>
            )}
            <HeaderActions />
          </div>
        </div>
      </div>

      <div className="container" style={{ paddingTop: '16px' }}>
        {/* Role Scope Switcher Tabs */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', background: 'var(--bg-input)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border)' }}>
          <button
            onClick={() => setScope('my')}
            style={{
              flex: 1, padding: '8px 12px', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
              background: scope === 'my' ? 'var(--bg-card)' : 'transparent',
              color: scope === 'my' ? 'var(--primary)' : 'var(--text-secondary)',
              boxShadow: scope === 'my' ? 'var(--shadow-xs)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            🚀 Dự án của tôi ({myProjectsList.length})
          </button>
          <button
            onClick={() => setScope('all')}
            style={{
              flex: 1, padding: '8px 12px', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
              background: scope === 'all' ? 'var(--bg-card)' : 'transparent',
              color: scope === 'all' ? 'var(--primary)' : 'var(--text-secondary)',
              boxShadow: scope === 'all' ? 'var(--shadow-xs)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            🏢 Tất cả dự án công ty ({projects.length})
          </button>
        </div>

        {/* Stat KPI Cards (Dynamically calculated based on active Scope) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '14px' }}>
          <div className="card" style={{ padding: '12px 14px', background: 'var(--bg-card)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
              {scope === 'my' ? 'DỰ ÁN THAM GIA' : 'TỔNG SỐ DỰ ÁN'}
            </div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--primary)', marginTop: '2px' }}>{displayTotalCount}</div>
          </div>
          <div className="card" style={{ padding: '12px 14px', background: 'var(--green-soft)' }}>
            <div style={{ fontSize: '11px', color: 'var(--green)', fontWeight: 600 }}>🚀 ĐANG TIẾN HÀNH</div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--green)', marginTop: '2px' }}>{displayActiveCount}</div>
          </div>
          <div className="card" style={{ padding: '12px 14px', background: 'var(--blue-soft)' }}>
            <div style={{ fontSize: '11px', color: 'var(--blue)', fontWeight: 600 }}>✅ ĐÃ HOÀN THÀNH</div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--blue)', marginTop: '2px' }}>{displayCompletedCount}</div>
          </div>
        </div>

        {/* Controls: Search, Filters & View Mode Switcher */}
        <div className="card" style={{ padding: '12px 14px', marginBottom: '14px' }}>
          {/* Row 1: Search & Controls */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '10px' }}>
            {/* Search input */}
            <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
              <Search size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: '32px', fontSize: '13px', padding: '7px 10px 7px 32px' }}
                placeholder="🔍 Tìm theo Mã, Tên dự án, PM, Địa chỉ, Thành viên..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Sort Dropdown */}
            <select
              className="form-select"
              style={{ width: 'auto', minWidth: '130px', fontSize: '13px', padding: '7px 10px', fontWeight: 600, color: 'var(--primary)' }}
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
            >
              <option value="date_desc">📅 Mới nhất</option>
              <option value="date_asc">📅 Cũ nhất</option>
              <option value="name_asc">🔤 Tên A → Z</option>
              <option value="name_desc">🔤 Tên Z → A</option>
              <option value="progress_desc">📊 Tiến độ cao</option>
            </select>

            {/* View Mode Toggle Button Group */}
            <div style={{ display: 'flex', background: 'var(--bg-input)', borderRadius: '8px', padding: '2px', border: '1px solid var(--border)' }}>
              <button
                onClick={() => setViewMode('table')}
                title="Bảng Excel Mẫu"
                style={{
                  padding: '6px 10px', border: 'none', borderRadius: '6px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 600,
                  background: viewMode === 'table' ? 'var(--bg-card)' : 'transparent',
                  color: viewMode === 'table' ? 'var(--primary)' : 'var(--text-muted)',
                  boxShadow: viewMode === 'table' ? 'var(--shadow-xs)' : 'none',
                }}
              >
                <LayoutList size={14} /> Bảng Excel
              </button>
              <button
                onClick={() => setViewMode('grid')}
                title="Thẻ Card Hiện Đại"
                style={{
                  padding: '6px 10px', border: 'none', borderRadius: '6px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 600,
                  background: viewMode === 'grid' ? 'var(--bg-card)' : 'transparent',
                  color: viewMode === 'grid' ? 'var(--primary)' : 'var(--text-muted)',
                  boxShadow: viewMode === 'grid' ? 'var(--shadow-xs)' : 'none',
                }}
              >
                <LayoutGrid size={14} /> Thẻ Card
              </button>
            </div>
          </div>

          {/* Row 2: Deep Filters (Năm, PM, Mã dự án, Phân loại, Trạng thái, Reset) */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Lọc theo NĂM */}
            <select
              className="form-select"
              style={{
                width: 'auto', minWidth: '125px', fontSize: '12px', padding: '6px 10px',
                fontWeight: selectedYear !== 'all' ? 700 : 500,
                color: selectedYear !== 'all' ? 'var(--primary)' : 'var(--text)'
              }}
              value={selectedYear}
              onChange={e => setSelectedYear(e.target.value)}
            >
              <option value="all">📅 Năm: Tất cả</option>
              {availableYears.map(y => <option key={y} value={y}>Năm {y}</option>)}
            </select>

            {/* Lọc theo PM */}
            <select
              className="form-select"
              style={{
                width: 'auto', minWidth: '135px', fontSize: '12px', padding: '6px 10px',
                fontWeight: selectedPm !== 'all' ? 700 : 500,
                color: selectedPm !== 'all' ? 'var(--primary)' : 'var(--text)'
              }}
              value={selectedPm}
              onChange={e => setSelectedPm(e.target.value)}
            >
              <option value="all">👔 PM: Tất cả</option>
              {availablePms.map(pm => <option key={pm} value={pm}>{pm}</option>)}
            </select>

            {/* Lọc theo MÃ DỰ ÁN */}
            <select
              className="form-select"
              style={{
                width: 'auto', minWidth: '130px', fontSize: '12px', padding: '6px 10px',
                fontWeight: selectedCodePrefix !== 'all' ? 700 : 500,
                color: selectedCodePrefix !== 'all' ? 'var(--primary)' : 'var(--text)'
              }}
              value={selectedCodePrefix}
              onChange={e => setSelectedCodePrefix(e.target.value)}
            >
              <option value="all">🏷️ Mã DA: Tất cả</option>
              {availableCodes.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            {/* Category Filter */}
            <select
              className="form-select"
              style={{
                width: 'auto', minWidth: '130px', fontSize: '12px', padding: '6px 10px',
                fontWeight: selectedCategory !== 'all' ? 700 : 500,
                color: selectedCategory !== 'all' ? 'var(--primary)' : 'var(--text)'
              }}
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
            >
              <option value="all">🏢 Phân loại: Tất cả</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            {/* Status Filter */}
            <select
              className="form-select"
              style={{
                width: 'auto', minWidth: '130px', fontSize: '12px', padding: '6px 10px',
                fontWeight: selectedStatus !== 'all' ? 700 : 500,
                color: selectedStatus !== 'all' ? 'var(--primary)' : 'var(--text)'
              }}
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value)}
            >
              <option value="all">📌 Trạng thái: Tất cả</option>
              {Object.keys(STATUS_MAP).map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            {/* Quick Reset Filters Button */}
            {hasActiveFilters && (
              <button
                onClick={resetAllFilters}
                className="btn btn--ghost"
                style={{
                  padding: '5px 10px', fontSize: '12px', color: 'var(--red)',
                  borderColor: 'var(--red)', fontWeight: 700, borderRadius: '6px'
                }}
                title="Xóa tất cả các bộ lọc đang chọn"
              >
                <X size={13} style={{ marginRight: '3px' }} /> Xóa bộ lọc
              </button>
            )}
          </div>
        </div>

        {/* Loading / Empty States */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[1, 2, 3].map(i => <div key={i} className="skeleton-card" style={{ height: '70px', borderRadius: '10px' }} />)}
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">🏗️</div>
            <div className="empty-state__title">Không có dự án phù hợp</div>
            <div className="empty-state__desc">Thử thay đổi từ khóa hoặc bộ lọc tìm kiếm</div>
          </div>
        ) : viewMode === 'table' ? (
          /* VIEW MODE 1: EXACT MATCH EXCEL TABLE (Mẫu THÔNG TIN NS+DA) */
          <div className="card animate-fade-in" style={{ padding: '0', overflowX: 'auto', borderRadius: '12px', border: '1px solid var(--border)' }}>
            <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse', textAlign: 'left', whiteSpace: 'nowrap' }}>
              <thead>
                <tr style={{ background: 'var(--bg-raised)', borderBottom: '1px solid var(--border)', color: 'var(--text)', fontWeight: 800 }}>
                  <th style={{ padding: '11px 14px', width: '100px' }}>NO. (Mã dự án)</th>
                  <th style={{ padding: '11px 14px', minWidth: '160px' }}>DỰ ÁN</th>
                  <th style={{ padding: '11px 14px', width: '110px' }}>THÀNH VIÊN</th>
                  <th style={{ padding: '11px 14px', width: '150px' }}>TIẾN ĐỘ</th>
                  <th style={{ padding: '11px 14px', width: '110px' }}>PHÂN LOẠI</th>
                  <th style={{ padding: '11px 14px', width: '120px' }}>PM</th>
                  <th style={{ padding: '11px 14px', width: '130px' }}>TRẠNG THÁI</th>
                  {isAdminOrManager && <th style={{ padding: '11px 14px', width: '90px', textAlign: 'center' }}>THAO TÁC</th>}
                </tr>
              </thead>
              <tbody>
                {filteredProjects.map((p, idx) => {
                  const statObj = STATUS_MAP[p.status] || { cls: 'badge--neutral', label: p.status || 'Khác' };
                  const members = Array.isArray(p.members) ? p.members : [];

                  return (
                    <tr
                      key={p._id || p.id}
                      onClick={() => setSelectedProjectDetail(p)}
                      style={{
                        borderBottom: '1px solid var(--border-muted)',
                        background: idx % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-raised)',
                        cursor: 'pointer',
                        transition: 'background 0.1s'
                      }}
                      title="Click để xem chi tiết dự án"
                    >
                      {/* NO. (Mã dự án) */}
                      <td style={{ padding: '11px 14px', fontWeight: 800, color: 'var(--primary)' }}>
                        {p.code}
                      </td>

                      {/* DỰ ÁN */}
                      <td style={{ padding: '11px 14px', fontWeight: 700, color: 'var(--text)' }}>
                        <div style={{ fontSize: '13px' }}>{p.name}</div>
                        {p.deadline && (
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 500, marginTop: '2px' }}>
                            ⏱️ Hạn chót: {p.deadline}
                          </div>
                        )}
                      </td>

                      {/* THÀNH VIÊN (Stacked Avatars) */}
                      <td style={{ padding: '11px 14px' }}>
                        {members.length > 0 ? (
                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            {members.slice(0, 3).map((m, mIdx) => (
                              <div
                                key={m._id || mIdx}
                                title={m.full_name || 'Thành viên'}
                                style={{
                                  width: '26px', height: '26px', borderRadius: '50%',
                                  background: 'var(--primary)', color: '#fff',
                                  fontSize: '10px', fontWeight: 700,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  marginLeft: mIdx > 0 ? '-8px' : '0',
                                  border: '2px solid var(--bg-card)',
                                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                                }}
                              >
                                {m.avatar_url ? (
                                  <img src={m.avatar_url} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                                ) : (
                                  (m.full_name || 'U').charAt(0).toUpperCase()
                                )}
                              </div>
                            ))}
                            {members.length > 3 && (
                              <div style={{
                                width: '26px', height: '26px', borderRadius: '50%',
                                background: 'var(--bg-raised)', color: 'var(--text-secondary)',
                                fontSize: '10px', fontWeight: 700,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                marginLeft: '-8px', border: '2px solid var(--bg-card)'
                              }}>
                                +{members.length - 3}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>—</span>
                        )}
                      </td>

                      {/* TIẾN ĐỘ */}
                      <td style={{ padding: '11px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '120px' }}>
                          <div style={{ flex: 1, height: '7px', background: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{
                              height: '100%',
                              width: `${Math.min(100, Math.max(0, p.progress || 0))}%`,
                              background: (p.progress || 0) >= 100 ? 'var(--blue)' : 'var(--green)',
                              borderRadius: '4px'
                            }} />
                          </div>
                          <span style={{ fontSize: '11px', fontWeight: 700, minWidth: '32px', color: 'var(--text-secondary)' }}>{p.progress || 0}%</span>
                        </div>
                      </td>

                      {/* PHÂN LOẠI */}
                      <td style={{ padding: '11px 14px' }}>
                        <span style={{
                          background: 'var(--primary-soft)', color: 'var(--primary)',
                          padding: '3px 8px', borderRadius: '6px', fontWeight: 700, fontSize: '11px'
                        }}>
                          {p.category || 'Kiến trúc'}
                        </span>
                      </td>

                      {/* PM */}
                      <td style={{ padding: '11px 14px', color: 'var(--text)', fontWeight: 600 }}>
                        {p.pm_name || '—'}
                      </td>

                      {/* TRẠNG THÁI */}
                      <td style={{ padding: '11px 14px' }}>
                        <span className={`badge ${statObj.cls}`} style={{ fontSize: '11px', padding: '4px 10px' }}>
                          {statObj.label}
                        </span>
                      </td>

                      {/* THAO TÁC */}
                      {isAdminOrManager && (
                        <td style={{ padding: '10px 12px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
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
                  onClick={() => setSelectedProjectDetail(p)}
                  className="card card--interactive animate-fade-in"
                  style={{
                    padding: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                    borderLeft: '4px solid var(--primary)', transition: 'all 0.15s ease-in-out', cursor: 'pointer'
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
                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px', paddingTop: '8px', borderTop: '1px solid var(--border-muted)' }} onClick={e => e.stopPropagation()}>
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
                  {SELECT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div className="form-group">
                <label className="form-label">Tiến độ ({form.progress}%)</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  className="form-input"
                  style={{ padding: '4px 0' }}
                  value={form.progress}
                  onChange={e => setForm({ ...form, progress: Number(e.target.value) })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Hạn chót (Deadline)</label>
                <input
                  type="date"
                  className="form-input"
                  value={form.deadline}
                  onChange={e => setForm({ ...form, deadline: e.target.value })}
                />
              </div>
            </div>

            {/* Multi-member selection list */}
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 700, color: 'var(--primary)' }}>
                👥 Thành viên dự án ({form.members.length} người đã chọn)
              </label>
              <div style={{
                maxHeight: '140px', overflowY: 'auto',
                border: '1px solid var(--border)', borderRadius: '8px',
                padding: '6px', background: 'var(--bg-raised)',
                display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '4px'
              }}>
                {staffList.map(u => {
                  const uid = u._id || u.id;
                  const isSelected = form.members.includes(uid);
                  return (
                    <div
                      key={uid}
                      onClick={() => toggleMemberSelection(uid)}
                      style={{
                        padding: '6px 8px', borderRadius: '6px', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '6px',
                        background: isSelected ? 'var(--primary-soft)' : 'var(--bg-card)',
                        border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border-muted)',
                        transition: 'all 0.1s'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        style={{ cursor: 'pointer' }}
                      />
                      <div style={{
                        width: '20px', height: '20px', borderRadius: '50%',
                        background: 'var(--primary)', color: '#fff',
                        fontSize: '9px', fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                      }}>
                        {u.avatar_url ? (
                          <img src={u.avatar_url} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                          (u.full_name || 'U').charAt(0).toUpperCase()
                        )}
                      </div>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '11px', fontWeight: isSelected ? 700 : 500 }}>
                        {u.full_name}
                      </div>
                    </div>
                  );
                })}
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

      {/* Read-Only Project Detail Modal Sheet (for all staff & managers) */}
      {selectedProjectDetail && (
        <div className="modal-overlay" onClick={() => setSelectedProjectDetail(null)}>
          <div
            className="modal-sheet animate-slide-up"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: '520px', margin: '0 auto', padding: '24px 22px' }}
          >
            <div className="modal-sheet__handle" />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="badge badge--info" style={{ fontSize: '12px', fontWeight: 800 }}>
                  {selectedProjectDetail.code}
                </span>
                <span className={`badge ${STATUS_MAP[selectedProjectDetail.status]?.cls || 'badge--neutral'}`} style={{ fontSize: '11px' }}>
                  {STATUS_MAP[selectedProjectDetail.status]?.label || selectedProjectDetail.status}
                </span>
              </div>
              <button
                onClick={() => setSelectedProjectDetail(null)}
                className="btn btn--ghost"
                style={{ width: '32px', height: '32px', borderRadius: '50%', padding: 0 }}
              >
                <X size={18} />
              </button>
            </div>

            <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text)', marginBottom: '4px', lineHeight: 1.3 }}>
              {selectedProjectDetail.name}
            </h2>

            {selectedProjectDetail.sub_project && (
              <div style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 700, marginBottom: '12px' }}>
                🔖 Dự án thành phần: {selectedProjectDetail.sub_project}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', margin: '14px 0' }}>
              <div style={{ background: 'var(--bg-raised)', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Phân loại</div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>
                  🎨 {selectedProjectDetail.category || 'Kiến trúc'}
                </div>
              </div>
              <div style={{ background: 'var(--bg-raised)', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Trưởng dự án (PM)</div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary)' }}>
                  👷 {selectedProjectDetail.pm_name || 'Chưa phân công'}
                </div>
              </div>
              <div style={{ background: 'var(--bg-raised)', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Hạn chót (Deadline)</div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: selectedProjectDetail.deadline ? 'var(--yellow)' : 'var(--text-muted)' }}>
                  ⏱️ {selectedProjectDetail.deadline || 'Không có'}
                </div>
              </div>
              <div style={{ background: 'var(--bg-raised)', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Khách hàng</div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>
                  👤 {selectedProjectDetail.client_name || 'Nội bộ'}
                </div>
              </div>
            </div>

            {/* Progress */}
            <div style={{ background: 'var(--bg-raised)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border)', marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 700, marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Tiến độ hoàn thành</span>
                <span style={{ color: (selectedProjectDetail.progress || 0) >= 100 ? 'var(--blue)' : 'var(--green)' }}>
                  {selectedProjectDetail.progress || 0}%
                </span>
              </div>
              <div style={{ width: '100%', height: '8px', background: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{
                  width: `${Math.min(100, Math.max(0, selectedProjectDetail.progress || 0))}%`, height: '100%',
                  background: (selectedProjectDetail.progress || 0) >= 100 ? 'var(--blue)' : 'var(--green)',
                  borderRadius: '4px', transition: 'width 0.3s'
                }} />
              </div>
            </div>

            {/* Members List */}
            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                👥 Thành viên tham gia ({Array.isArray(selectedProjectDetail.members) ? selectedProjectDetail.members.length : 0} nhân sự)
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '120px', overflowY: 'auto' }}>
                {Array.isArray(selectedProjectDetail.members) && selectedProjectDetail.members.length > 0 ? (
                  selectedProjectDetail.members.map((m, idx) => (
                    <div
                      key={m._id || idx}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                        background: 'var(--bg-raised)', padding: '4px 10px', borderRadius: '20px',
                        border: '1px solid var(--border)', fontSize: '12px'
                      }}
                    >
                      <div style={{
                        width: '20px', height: '20px', borderRadius: '50%', background: 'var(--primary)',
                        color: '#fff', fontSize: '9px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                        {m.avatar_url ? (
                          <img src={m.avatar_url} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                          (m.full_name || 'U').charAt(0).toUpperCase()
                        )}
                      </div>
                      <span style={{ fontWeight: 600 }}>{m.full_name || 'Thành viên'}</span>
                    </div>
                  ))
                ) : (
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Chưa có thành viên cụ thể.</div>
                )}
              </div>
            </div>

            {/* Address & Note */}
            {selectedProjectDetail.address && (
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                📍 <strong>Địa điểm:</strong> {selectedProjectDetail.address}
              </div>
            )}

            {selectedProjectDetail.note && (
              <div style={{
                background: 'var(--bg-input)', padding: '10px 12px', borderRadius: '8px',
                border: '1px solid var(--border)', fontSize: '12px', color: 'var(--text)',
                lineHeight: 1.5, marginBottom: '18px'
              }}>
                📝 <strong>Ghi chú:</strong> {selectedProjectDetail.note}
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setSelectedProjectDetail(null)}
                className="btn btn--primary btn--full"
                style={{ padding: '10px', fontWeight: 700 }}
              >
                Đóng
              </button>
              {isAdminOrManager && (
                <button
                  onClick={() => {
                    const target = selectedProjectDetail;
                    setSelectedProjectDetail(null);
                    handleOpenEdit(target);
                  }}
                  className="btn btn--ghost"
                  style={{ padding: '10px 16px', fontWeight: 700 }}
                >
                  <Edit2 size={14} /> Chỉnh sửa
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
