// src/pages/LeaderboardPage.jsx
// Bảng Xếp Hạng Chuyên Cần & Thành Tích Tinh Gọn — Danh Sách Xếp Hạng Trực Quan, Bộ Lọc Đa Chiều

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Trophy, Flame, Clock, Zap, Calendar,
  ChevronRight, Search, X, Phone, Mail, MapPin, Bike
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import HeaderActions from '../components/HeaderActions';
import ImageLightbox from '../components/ImageLightbox';

const TIMEFRAMES = [
  { id: 'today', label: '☀️ Hôm nay', desc: 'Đua top trực tiếp sáng nay' },
  { id: 'day', label: '📅 Theo ngày', desc: 'Chọn ngày cụ thể bất kỳ' },
  { id: 'week', label: '📆 Theo tuần', desc: 'Xếp hạng tuần này / tuần chọn' },
  { id: 'month', label: '🗓️ Theo tháng', desc: 'Nhân viên chăm chỉ của tháng' },
  { id: 'year', label: '📊 Năm nay', desc: 'Bảng tổng kết năm' },
  { id: 'all', label: '👑 Toàn thời gian', desc: 'Kỷ lục tích lũy hệ thống' },
];

const CATEGORIES = [
  { id: 'early_bird', label: '🌅 Chim Sớm (Đến sớm)', icon: SunriseIcon, color: '#f59e0b', desc: 'Xếp hạng giờ check-in sớm nhất' },
  { id: 'work_hours', label: '⏱️ Tổng Giờ Làm', icon: Clock, color: '#3b82f6', desc: 'Xếp hạng tổng giờ làm việc tích lũy' },
  { id: 'ot_hours', label: '🔥 Chiến Thần OT', icon: Flame, color: '#ef4444', desc: 'Xếp hạng giờ tăng ca cống hiến' },
  { id: 'streak', label: '🎯 Chuỗi Đúng Giờ', icon: Zap, color: '#10b981', desc: 'Chuỗi ngày đi làm đúng giờ liên tiếp' },
];

function SunriseIcon({ size = 18, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v6" />
      <path d="m4.93 10.93 1.41 1.41" />
      <path d="M2 18h2" />
      <path d="M20 18h2" />
      <path d="m19.07 10.93-1.41 1.41" />
      <path d="M22 22H2" />
      <path d="m8 6 4-4 4 4" />
      <path d="M16 18a4 4 0 0 0-8 0" />
    </svg>
  );
}

// Helper tính khoảng thời gian Thứ 2 - CN của một tuần
const getWeekRange = (baseDateStr) => {
  const [y, m, d] = (baseDateStr || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })).split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const dayOfWeek = date.getDay();
  const diffToMonday = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;
  const monday = new Date(date);
  monday.setDate(date.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const fmt = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  const fmtDisplay = (dt) => `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}`;
  return {
    startDate: fmt(monday),
    endDate: fmt(sunday),
    displayLabel: `Tuần ${fmtDisplay(monday)} - ${fmtDisplay(sunday)}/${monday.getFullYear()}`,
  };
};

export default function LeaderboardPage() {
  const [timeframe, setTimeframe] = useState('today');
  const [category, setCategory] = useState('early_bird');
  const [selectedDate, setSelectedDate] = useState(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }));
  const [selectedWeekDate, setSelectedWeekDate] = useState(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }));
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [departmentId, setDepartmentId] = useState('all');
  const [departments, setDepartments] = useState([]);
  const [data, setData] = useState({ rankings: [], myRank: null });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [viewingStaffDetail, setViewingStaffDetail] = useState(null);
  const [fullAvatarImage, setFullAvatarImage] = useState(null);

  const myRowRef = useRef(null);

  const loadDepartments = useCallback(async () => {
    try {
      const { data: deptList } = await api.get('/departments');
      if (Array.isArray(deptList)) setDepartments(deptList);
    } catch {}
  }, []);

  const loadLeaderboard = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('timeframe', timeframe);
      params.append('category', category);
      
      if (timeframe === 'day') {
        params.append('date', selectedDate);
      } else if (timeframe === 'week') {
        const wr = getWeekRange(selectedWeekDate);
        params.append('week_start', wr.startDate);
        params.append('week_end', wr.endDate);
      } else if (timeframe === 'month') {
        params.append('month', month);
        params.append('year', year);
      } else if (timeframe === 'year') {
        params.append('year', year);
      }
      
      if (departmentId !== 'all') params.append('department_id', departmentId);

      const res = await api.get(`/reports/leaderboard?${params.toString()}`);
      setData(res.data);
    } catch {
      toast.error('Lỗi tải bảng xếp hạng');
    } finally {
      setLoading(false);
    }
  }, [category, departmentId, month, selectedDate, selectedWeekDate, timeframe, year]);

  useEffect(() => {
    loadDepartments();
  }, [loadDepartments]);

  useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard]);

  const scrollToMyRank = () => {
    if (myRowRef.current) {
      myRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      myRowRef.current.style.transition = 'background 0.3s';
      myRowRef.current.style.background = 'var(--primary-subtle, rgba(59, 130, 246, 0.25))';
      setTimeout(() => {
        if (myRowRef.current) myRowRef.current.style.background = '';
      }, 2000);
    } else {
      toast('Bạn chưa có dữ liệu trong khoảng thời gian này', { icon: 'ℹ️' });
    }
  };

  const filteredRankings = (data.rankings || []).filter(r => {
    if (r.is_attendance_exempt) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase().trim();
    return (
      r.full_name.toLowerCase().includes(q) ||
      (r.employee_code || '').toLowerCase().includes(q) ||
      (r.department_name || '').toLowerCase().includes(q)
    );
  });

  // Shift day helper
  const shiftSelectedDay = (offsetDays) => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + offsetDays);
    const newStr = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    setSelectedDate(newStr);
  };

  // Shift week helper
  const shiftSelectedWeek = (offsetWeeks) => {
    const [y, m, d] = selectedWeekDate.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + (offsetWeeks * 7));
    const newStr = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    setSelectedWeekDate(newStr);
  };

  const activeWeekInfo = getWeekRange(selectedWeekDate);
  const activeCategory = CATEGORIES.find(c => c.id === category);

  return (
    <div className="page" style={{ paddingBottom: '90px' }}>
      {/* Header */}
      <div className="header">
        <div className="header__inner header__inner--wide">
          <div>
            <div className="header__title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Trophy size={22} color="#f59e0b" /> Bảng xếp hạng
            </div>
          </div>
          <HeaderActions />
        </div>
      </div>

      <div className="container container--wide" style={{ paddingTop: '16px' }}>
        {/* Timeframe Selector Pills */}
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '6px', marginBottom: '12px' }}>
          {TIMEFRAMES.map(tf => {
            const isActive = timeframe === tf.id;
            return (
              <button
                key={tf.id}
                onClick={() => setTimeframe(tf.id)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '10px',
                  border: isActive ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                  background: isActive ? 'var(--primary-soft)' : 'var(--bg-card)',
                  color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                  fontWeight: isActive ? 800 : 500,
                  fontSize: '13px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  transition: 'all 0.2s',
                }}
              >
                {tf.label}
              </button>
            );
          })}
        </div>

        {/* Category Tabs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px', marginBottom: '14px' }}>
          {CATEGORIES.map(cat => {
            const Icon = cat.icon;
            const isActive = category === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                className="card card--interactive"
                style={{
                  padding: '10px 12px',
                  textAlign: 'left',
                  border: isActive ? `2px solid ${cat.color}` : '1px solid var(--border)',
                  background: isActive ? 'var(--bg-raised)' : 'var(--bg-card)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <div style={{ padding: '6px', borderRadius: '8px', background: `${cat.color}20`, color: cat.color }}>
                  <Icon size={16} />
                </div>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: isActive ? 'var(--text)' : 'var(--text-secondary)' }}>
                    {cat.label}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{cat.desc}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Filters Toolbar */}
        <div className="card" style={{ padding: '12px 14px', marginBottom: '16px', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: '32px', fontSize: '12.5px', height: '34px' }}
                placeholder="Tìm nhân sự, phòng ban..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            {/* Department Filter */}
            <select
              className="form-select"
              style={{ width: 'auto', minWidth: '140px', fontSize: '12.5px', padding: '5px 10px', height: '34px' }}
              value={departmentId}
              onChange={e => setDepartmentId(e.target.value)}
            >
              <option value="all">🏢 Phòng ban: Tất cả</option>
              {departments.map(d => (
                <option key={d._id} value={d._id}>{d.name}</option>
              ))}
            </select>

            {/* 📅 Day Specific Switcher */}
            {timeframe === 'day' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => shiftSelectedDay(-1)}
                  className="btn btn--ghost"
                  style={{ padding: '4px 8px', fontSize: '12px', height: '34px' }}
                  title="Ngày trước"
                >
                  ◀
                </button>
                <input
                  type="date"
                  className="form-input"
                  style={{ width: 'auto', fontSize: '12.5px', padding: '5px 8px', height: '34px', fontWeight: 700 }}
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  onClick={e => e.target.showPicker && e.target.showPicker()}
                />
                <button
                  type="button"
                  onClick={() => shiftSelectedDay(1)}
                  className="btn btn--ghost"
                  style={{ padding: '4px 8px', fontSize: '12px', height: '34px' }}
                  title="Ngày sau"
                >
                  ▶
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDate(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }))}
                  className="btn btn--ghost"
                  style={{ padding: '4px 8px', fontSize: '11px', height: '34px', color: 'var(--primary)' }}
                >
                  Hôm nay
                </button>
              </div>
            )}

            {/* 📆 Week Specific Switcher */}
            {timeframe === 'week' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => shiftSelectedWeek(-1)}
                  className="btn btn--ghost"
                  style={{ padding: '4px 8px', fontSize: '12px', height: '34px' }}
                  title="Tuần trước"
                >
                  ◀ Tuần trước
                </button>
                <div style={{
                  padding: '6px 10px', background: 'var(--primary-soft)', border: '1px solid var(--primary)',
                  borderRadius: '8px', fontSize: '12.5px', fontWeight: 800, color: 'var(--primary)', height: '34px',
                  display: 'flex', alignItems: 'center'
                }}>
                  {activeWeekInfo.displayLabel}
                </div>
                <button
                  type="button"
                  onClick={() => shiftSelectedWeek(1)}
                  className="btn btn--ghost"
                  style={{ padding: '4px 8px', fontSize: '12px', height: '34px' }}
                  title="Tuần sau"
                >
                  Tuần sau ▶
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedWeekDate(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }))}
                  className="btn btn--ghost"
                  style={{ padding: '4px 8px', fontSize: '11px', height: '34px', color: 'var(--primary)' }}
                >
                  Tuần này
                </button>
              </div>
            )}

            {/* Month & Year Selectors */}
            {timeframe === 'month' && (
              <select
                className="form-select"
                style={{ width: 'auto', fontSize: '12.5px', padding: '5px 10px', height: '34px', fontWeight: 700 }}
                value={month}
                onChange={e => setMonth(e.target.value)}
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                  <option key={m} value={String(m)}>Tháng {m}</option>
                ))}
              </select>
            )}

            {(timeframe === 'month' || timeframe === 'year') && (
              <select
                className="form-select"
                style={{ width: 'auto', fontSize: '12.5px', padding: '5px 10px', height: '34px', fontWeight: 700 }}
                value={year}
                onChange={e => setYear(e.target.value)}
              >
                {[2024, 2025, 2026, 2027].map(y => (
                  <option key={y} value={String(y)}>Năm {y}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Full Rankings Table (Top 1 to 100%) */}
        <div className="card animate-fade-in" style={{ padding: 0, borderRadius: '12px', border: '1px solid var(--border)', overflowX: 'auto' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>
                📋 Danh sách xếp hạng ({filteredRankings.length} nhân sự)
              </span>
              <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '12px', background: `${activeCategory?.color || '#f59e0b'}20`, color: activeCategory?.color || '#f59e0b', fontWeight: 700 }}>
                {activeCategory?.label}
              </span>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              💡 Bấm vào nhân sự để xem hồ sơ chi tiết
            </span>
          </div>

          {loading ? (
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="skeleton-card" style={{ height: '48px', borderRadius: '8px' }} />)}
            </div>
          ) : filteredRankings.length === 0 ? (
            <div className="empty-state" style={{ padding: '32px 24px' }}>
              <div className="empty-state__icon">🏆</div>
              <div className="empty-state__title">Chưa có dữ liệu xếp hạng</div>
              <div className="empty-state__desc">Hãy thử chọn mốc thời gian hoặc phòng ban khác</div>
            </div>
          ) : (
            <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--bg-raised)', borderBottom: '1px solid var(--border)', color: 'var(--text)', fontWeight: 800, fontSize: '12px' }}>
                  <th style={{ padding: '10px 14px', width: '70px', textAlign: 'center' }}>HẠNG</th>
                  <th style={{ padding: '10px 14px', minWidth: '200px' }}>NHÂN SỰ & PHÒNG BAN</th>
                  <th style={{ padding: '10px 14px', width: '180px', textAlign: 'right' }}>THÀNH TÍCH</th>
                </tr>
              </thead>
              <tbody>
                {filteredRankings.map(r => {
                  const isCurrent = r.isCurrentUser;
                  const rankNumber = r.rank;

                  return (
                    <tr
                      key={r.user_id}
                      ref={isCurrent ? myRowRef : null}
                      onClick={() => setViewingStaffDetail(r)}
                      className="table-row--interactive"
                      style={{
                        borderBottom: '1px solid var(--border-muted)',
                        background: isCurrent
                          ? 'var(--primary-subtle, rgba(59, 130, 246, 0.12))'
                          : rankNumber % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-raised)',
                        fontWeight: isCurrent ? 700 : 500,
                        cursor: 'pointer',
                      }}
                      title="Click để xem hồ sơ nhân sự"
                    >
                      {/* Rank Column */}
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        {rankNumber === 1 ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', fontWeight: 900, color: '#eab308', fontSize: '13px' }}>
                            🥇 1
                          </span>
                        ) : rankNumber === 2 ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', fontWeight: 800, color: '#94a3b8', fontSize: '13px' }}>
                            🥈 2
                          </span>
                        ) : rankNumber === 3 ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', fontWeight: 800, color: '#d97706', fontSize: '13px' }}>
                            🥉 3
                          </span>
                        ) : (
                          <span
                            style={{
                              display: 'inline-block',
                              minWidth: '24px',
                              height: '24px',
                              lineHeight: '24px',
                              padding: '0 6px',
                              borderRadius: '12px',
                              background: rankNumber <= 10 ? 'var(--primary-subtle, rgba(59, 130, 246, 0.15))' : 'var(--bg-input)',
                              color: rankNumber <= 10 ? 'var(--primary)' : 'var(--text-muted)',
                              fontWeight: 800,
                              fontSize: '11px',
                            }}
                          >
                            #{rankNumber}
                          </span>
                        )}
                      </td>

                      {/* Staff & Department Column */}
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <img
                            src={r.avatar_url || '/logo.png'}
                            alt=""
                            style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: rankNumber <= 3 ? `2px solid ${rankNumber === 1 ? '#eab308' : rankNumber === 2 ? '#94a3b8' : '#d97706'}` : '1px solid var(--border)' }}
                            onError={e => { e.target.src = '/logo.png'; }}
                          />
                          <div>
                            <div style={{ fontWeight: isCurrent ? 800 : 700, color: isCurrent ? 'var(--primary)' : 'var(--text)', fontSize: '13.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>{r.full_name}</span>
                              {isCurrent && (
                                <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '8px', background: 'var(--primary)', color: '#fff', fontWeight: 800 }}>
                                  Tôi
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>🏢 {r.department_name || 'Văn Phòng'}</span>
                              {r.position && <span>· {r.position}</span>}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Score / Achievement Column */}
                      <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                        <div style={{ fontWeight: 800, fontSize: '13.5px', color: rankNumber <= 3 ? (rankNumber === 1 ? '#eab308' : rankNumber === 2 ? '#94a3b8' : '#d97706') : 'var(--primary)' }}>
                          {r.displayValue}
                        </div>
                        {r.subText && (
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {r.subText}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Floating Sticky "My Rank" Bar at Bottom */}
      {data.myRank && (
        <div
          onClick={() => {
            scrollToMyRank();
            if (data.myRank) setViewingStaffDetail(data.myRank);
          }}
          className="sticky-my-rank"
          style={{ cursor: 'pointer' }}
          title="Click để xem hồ sơ và thành tích của bạn"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'var(--primary)',
                color: '#fff',
                fontWeight: 900,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '13px',
              }}
            >
              #{data.myRank.rank}
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text)' }}>
                Vị trí của bạn: Hạng #{data.myRank.rank}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Thành tích: {data.myRank.displayValue} · {data.myRank.subText}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '3px', color: 'var(--primary)', fontSize: '12px', fontWeight: 700 }}>
            <span>Xem hồ sơ</span> <ChevronRight size={14} />
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
                <img
                  src={viewingStaffDetail.avatar_url || '/logo.png'}
                  alt={viewingStaffDetail.full_name}
                  style={{ width: 62, height: 62, borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--primary)', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.25)' }}
                  onError={e => { e.target.src = '/logo.png'; }}
                />
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

            {/* Achievement Badge Banner */}
            <div style={{
              background: 'var(--bg-raised)', padding: '12px 16px', borderRadius: '12px',
              border: '1px solid var(--border)', marginBottom: '16px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Vị trí xếp hạng hiện tại:</div>
                <div style={{ fontSize: '15px', fontWeight: 800, color: viewingStaffDetail.rank <= 3 ? '#eab308' : 'var(--primary)', marginTop: '2px' }}>
                  {viewingStaffDetail.rank === 1 ? '🥇 Hạng 1' : viewingStaffDetail.rank === 2 ? '🥈 Hạng 2' : viewingStaffDetail.rank === 3 ? '🥉 Hạng 3' : `Hạng #${viewingStaffDetail.rank}`}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Thành tích:</div>
                <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text)', marginTop: '2px' }}>
                  {viewingStaffDetail.displayValue}
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
                <span style={{ fontWeight: 600, color: 'var(--text)' }}>
                  {viewingStaffDetail.parking_location || 'Tòa 17T10 Nguyễn Thị Định'}
                </span>
              </div>

              {viewingStaffDetail.vehicle_info && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Bike size={14} /> Phương tiện:
                  </span>
                  <span style={{ fontWeight: 600, color: 'var(--text)' }}>
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

      {/* Full Avatar Zoom Modal */}
      <ImageLightbox image={fullAvatarImage} onClose={() => setFullAvatarImage(null)} />
    </div>
  );
}
