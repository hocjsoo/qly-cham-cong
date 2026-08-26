// client/src/pages/TtsSchedulePage.jsx
// Bảng Lịch Hàng Tuần TTS (Thực Tập Sinh) & Phân Công Trực Nhật — Khớp 100% Bảng Excel Thực Tế

import { useState, useEffect, useMemo } from 'react';
import { 
  CalendarDays, ChevronLeft, ChevronRight, Plus, Edit2, 
  Trash2, Save, CheckCircle2, UserCheck, Sparkles, Clock, 
  Phone, CreditCard, AlertCircle, RefreshCw, Printer, Download,
  Check, X
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import useAuthStore from '../stores/authStore';
import HeaderActions from '../components/HeaderActions';

const DAYS = [
  { key: 't2', label: 'Thứ 2', short: 'T2' },
  { key: 't3', label: 'Thứ 3', short: 'T3' },
  { key: 't4', label: 'Thứ 4', short: 'T4' },
  { key: 't5', label: 'Thứ 5', short: 'T5' },
  { key: 't6', label: 'Thứ 6', short: 'T6' },
  { key: 't7', label: 'Thứ 7', short: 'T7' },
];

const SHIFTS = [
  { key: 'morning', label: 'S (Sáng)', time: '9h - 12h30' },
  { key: 'afternoon', label: 'C (Chiều)', time: '14h - 18h30' },
];

export default function TtsSchedulePage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const isAdminOrLeader = ['admin', 'leader', 'manager'].includes(user?.role);

  const [loading, setLoading] = useState(true);
  const [scheduleData, setScheduleData] = useState(null);
  const [allStaff, setAllStaff] = useState([]);
  
  // State chọn tuần
  const [weekNumber, setWeekNumber] = useState(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [currentWeekInfo, setCurrentWeekInfo] = useState({ week: 1, year: 2026 });

  // Modal State Đăng Ký Ca
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [registerForm, setRegisterForm] = useState({
    user_id: '',
    full_name: '',
    phone: '',
    bank_account: '',
    bank_name: 'MB',
    shifts: {},
    note: ''
  });
  const [submittingReg, setSubmittingReg] = useState(false);

  // Modal State Phân Công Trực Nhật (Leader Ninh / Admin)
  const [showDutyModal, setShowDutyModal] = useState(false);
  const [dutyRosterForm, setDutyRosterForm] = useState({});
  const [submittingDuty, setSubmittingDuty] = useState(false);

  // Modal Thêm TTS mới vào bảng
  const [showAddInternModal, setShowAddInternModal] = useState(false);
  const [newInternForm, setNewInternForm] = useState({
    user_id: '',
    full_name: '',
    phone: '',
    bank_account: '',
    bank_name: 'MB'
  });
  const [submittingAddIntern, setSubmittingAddIntern] = useState(false);

  // Tải dữ liệu tuần
  const fetchSchedule = async (targetWeek = weekNumber, targetYear = year) => {
    try {
      setLoading(true);
      const query = targetWeek ? `?week_number=${targetWeek}&year=${targetYear}` : '';
      const { data } = await api.get(`/tts-schedules${query}`);

      if (data?.schedule) {
        setScheduleData(data.schedule);
        setWeekNumber(data.schedule.week_number);
        setYear(data.schedule.year);
      }
      if (data?.all_staff) {
        setAllStaff(data.all_staff);
      }
      if (data?.current_week) {
        setCurrentWeekInfo({ week: data.current_week, year: data.current_year });
      }
    } catch {
      toast.error('Lỗi tải lịch đăng ký tuần của TTS');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedule();
  }, []);

  // Chuyển tuần
  const handlePrevWeek = () => {
    let nextW = (weekNumber || 1) - 1;
    let nextY = year;
    if (nextW < 1) {
      nextW = 52;
      nextY -= 1;
    }
    setWeekNumber(nextW);
    setYear(nextY);
    fetchSchedule(nextW, nextY);
  };

  const handleNextWeek = () => {
    let nextW = (weekNumber || 1) + 1;
    let nextY = year;
    if (nextW > 52) {
      nextW = 1;
      nextY += 1;
    }
    setWeekNumber(nextW);
    setYear(nextY);
    fetchSchedule(nextW, nextY);
  };

  const handleCurrentWeek = () => {
    setWeekNumber(currentWeekInfo.week);
    setYear(currentWeekInfo.year);
    fetchSchedule(currentWeekInfo.week, currentWeekInfo.year);
  };

  // Đăng ký nhanh cho bản thân (hoặc mở modal)
  const handleOpenMyRegistration = () => {
    if (!user) return;
    const existing = scheduleData?.registrations?.find(r => 
      (r.user_id && String(r.user_id?._id || r.user_id) === String(user._id || user.id)) ||
      (r.full_name && r.full_name.trim().toLowerCase() === user.full_name?.trim().toLowerCase())
    );

    setRegisterForm({
      user_id: user._id || user.id,
      full_name: user.full_name || '',
      phone: user.phone || existing?.phone || '',
      bank_account: user.bank_account || existing?.bank_account || '',
      bank_name: user.bank_name || existing?.bank_name || 'MB',
      shifts: existing?.shifts ? { ...existing.shifts } : {},
      note: existing?.note || ''
    });
    setShowRegisterModal(true);
  };

  // Mở modal sửa ca cho bất kỳ TTS nào (Admin/Leader hoặc chính họ)
  const handleEditInternSchedule = (intern) => {
    setRegisterForm({
      user_id: intern.user_id?._id || intern.user_id || '',
      full_name: intern.full_name || '',
      phone: intern.phone || '',
      bank_account: intern.bank_account || '',
      bank_name: intern.bank_name || 'MB',
      shifts: intern.shifts ? { ...intern.shifts } : {},
      note: intern.note || ''
    });
    setShowRegisterModal(true);
  };

  // Lưu đăng ký ca làm
  const handleSaveRegistration = async () => {
    if (!registerForm.full_name.trim()) {
      toast.error('Vui lòng nhập họ tên');
      return;
    }

    setSubmittingReg(true);
    try {
      await api.post('/tts-schedules/register', {
        week_number: weekNumber,
        year: year,
        ...registerForm
      });
      toast.success('Đã lưu lịch đăng ký thành công! ✅');
      setShowRegisterModal(false);
      fetchSchedule(weekNumber, year);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Lỗi lưu lịch đăng ký');
    } finally {
      setSubmittingReg(false);
    }
  };

  // Toggle trực tiếp 1 ô ca làm việc (Quick toggle)
  const handleToggleShiftDirect = async (intern, shiftKey) => {
    const isOwner = user && (
      (intern.user_id && String(intern.user_id?._id || intern.user_id) === String(user._id || user.id)) ||
      (intern.full_name && intern.full_name.trim().toLowerCase() === user.full_name?.trim().toLowerCase())
    );

    if (!isAdminOrLeader && !isOwner) {
      toast.error('Bạn chỉ có thể đăng ký ca cho chính mình');
      return;
    }

    const currentVal = Boolean(intern.shifts?.[shiftKey]);
    const updatedShifts = {
      ...(intern.shifts || {}),
      [shiftKey]: !currentVal
    };

    // Optimistic UI Update
    setScheduleData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        registrations: prev.registrations.map(r => {
          if (r._id === intern._id) {
            return { ...r, shifts: updatedShifts };
          }
          return r;
        })
      };
    });

    try {
      await api.post('/tts-schedules/register', {
        week_number: weekNumber,
        year: year,
        user_id: intern.user_id?._id || intern.user_id,
        full_name: intern.full_name,
        phone: intern.phone,
        bank_account: intern.bank_account,
        bank_name: intern.bank_name,
        shifts: updatedShifts
      });
      toast.success(`Đã cập nhật ca ${!currentVal ? '[x]' : '[trống]'} cho ${intern.full_name}`);
    } catch {
      toast.error('Lỗi cập nhật ca làm');
      fetchSchedule(weekNumber, year);
    }
  };

  // Mở modal phân công trực nhật
  const handleOpenDutyModal = () => {
    const currentRoster = scheduleData?.duty_roster || {};
    setDutyRosterForm({
      t2: { office_cleaning: currentRoster.t2?.office_cleaning || 'My, Ly', toilet_cleaning: currentRoster.t2?.toilet_cleaning || '' },
      t3: { office_cleaning: currentRoster.t3?.office_cleaning || 'Ninh', toilet_cleaning: currentRoster.t3?.toilet_cleaning || '' },
      t4: { office_cleaning: currentRoster.t4?.office_cleaning || 'Ngọc, Tiến', toilet_cleaning: currentRoster.t4?.toilet_cleaning || '' },
      t5: { office_cleaning: currentRoster.t5?.office_cleaning || 'A Minh, Sơn', toilet_cleaning: currentRoster.t5?.toilet_cleaning || '' },
      t6: { office_cleaning: currentRoster.t6?.office_cleaning || 'A Trường, Hoàng', toilet_cleaning: currentRoster.t6?.toilet_cleaning || '' },
      t7: { office_cleaning: currentRoster.t7?.office_cleaning || 'A Long, Mến', toilet_cleaning: currentRoster.t7?.toilet_cleaning || 'A Minh' },
    });
    setShowDutyModal(true);
  };

  // Lưu phân công trực nhật
  const handleSaveDutyRoster = async () => {
    setSubmittingDuty(true);
    try {
      await api.put('/tts-schedules/duty-roster', {
        week_number: weekNumber,
        year: year,
        duty_roster: dutyRosterForm
      });
      toast.success('Đã cập nhật phân công trực nhật thành công! 🧹');
      setShowDutyModal(false);
      fetchSchedule(weekNumber, year);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Lỗi cập nhật phân công trực nhật');
    } finally {
      setSubmittingDuty(false);
    }
  };

  // Thêm TTS vào bảng
  const handleSaveNewIntern = async () => {
    if (!newInternForm.full_name.trim()) {
      toast.error('Vui lòng nhập tên Thực tập sinh');
      return;
    }

    setSubmittingAddIntern(true);
    try {
      await api.post('/tts-schedules/add-intern', {
        week_number: weekNumber,
        year: year,
        ...newInternForm
      });
      toast.success('Đã thêm TTS vào bảng thành công ✅');
      setShowAddInternModal(false);
      setNewInternForm({ user_id: '', full_name: '', phone: '', bank_account: '', bank_name: 'MB' });
      fetchSchedule(weekNumber, year);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Lỗi thêm Thực tập sinh');
    } finally {
      setSubmittingAddIntern(false);
    }
  };

  // Xóa TTS khỏi bảng tuần
  const handleRemoveIntern = async (intern) => {
    if (!window.confirm(`Bạn có chắc muốn xóa "${intern.full_name}" khỏi bảng tuần này?`)) return;
    try {
      await api.delete(`/tts-schedules/registration/${intern._id}?week_number=${weekNumber}&year=${year}`);
      toast.success(`Đã xóa ${intern.full_name} khỏi tuần này`);
      fetchSchedule(weekNumber, year);
    } catch {
      toast.error('Lỗi xóa Thực tập sinh');
    }
  };

  // Tính tổng số lượng TTS theo từng buổi (Sáng / Chiều từ T2 - T7)
  const shiftTotals = useMemo(() => {
    const totals = {};
    const regs = scheduleData?.registrations || [];

    DAYS.forEach(d => {
      SHIFTS.forEach(s => {
        const key = `${d.key}_${s.key}`;
        let count = 0;
        regs.forEach(r => {
          if (r.shifts?.[key]) count += 1;
        });
        totals[key] = count;
      });
    });

    return totals;
  }, [scheduleData]);

  // In lịch tuần
  const handlePrintSchedule = () => {
    window.print();
  };

  const regs = scheduleData?.registrations || [];
  const dutyRoster = scheduleData?.duty_roster || {};

  return (
    <div className="page">
      {/* Header */}
      <div className="header">
        <div className="header__inner">
          <div>
            <div className="header__title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Lịch Hàng Tuần TTS & Trực Nhật</span>
            </div>
            <div className="header__subtitle">
              Đăng ký ca làm việc thực tập sinh & phân công vệ sinh văn phòng ET Architects
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button onClick={handleOpenMyRegistration} className="btn btn--primary" style={{ padding: '6px 14px', fontSize: '13px' }}>
              ✍️ Đăng ký lịch của tôi
            </button>
            {isAdminOrLeader && (
              <button onClick={handleOpenDutyModal} className="btn btn--ghost" style={{ padding: '6px 12px', fontSize: '13px' }}>
                🧹 Phân công trực nhật
              </button>
            )}
            <HeaderActions />
          </div>
        </div>
      </div>

      <div className="container" style={{ paddingTop: '16px' }}>
        {/* Week Stepper & Controls */}
        <div className="card" style={{ padding: '12px 16px', marginBottom: '14px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            
            {/* Week Stepper */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button onClick={handlePrevWeek} className="theme-toggle-btn" title="Tuần trước">
                <ChevronLeft size={16} />
              </button>
              <div style={{ textAlign: 'center', minWidth: '180px' }}>
                <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--primary)' }}>
                  Tuần {weekNumber || currentWeekInfo.week} / Năm {year}
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '1px' }}>
                  {scheduleData?.start_date ? `Từ ${scheduleData.start_date.split('-').reverse().join('/')} ➔ ${scheduleData.end_date.split('-').reverse().join('/')}` : '—'}
                </div>
              </div>
              <button onClick={handleNextWeek} className="theme-toggle-btn" title="Tuần tiếp theo">
                <ChevronRight size={16} />
              </button>
              <button 
                onClick={handleCurrentWeek} 
                className="btn btn--ghost" 
                style={{ padding: '4px 10px', fontSize: '12px', marginLeft: '4px' }}
              >
                Tuần hiện tại
              </button>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              {isAdminOrLeader && (
                <button 
                  onClick={() => setShowAddInternModal(true)} 
                  className="btn btn--ghost" 
                  style={{ padding: '6px 12px', fontSize: '12px', gap: '4px' }}
                >
                  <Plus size={14} /> Thêm TTS
                </button>
              )}
              <button 
                onClick={() => fetchSchedule(weekNumber, year)} 
                disabled={loading} 
                className="theme-toggle-btn" 
                title="Làm mới bảng"
              >
                <RefreshCw size={15} style={{ animation: loading ? 'spin 0.6s linear infinite' : 'none' }} />
              </button>
              <button 
                onClick={handlePrintSchedule} 
                className="btn btn--ghost" 
                style={{ padding: '6px 12px', fontSize: '12px', gap: '4px' }}
              >
                <Printer size={14} /> In Lịch
              </button>
            </div>

          </div>
        </div>

        {/* BẢNG 1: LỊCH HÀNG TUẦN TTS (THỰC TẬP SINH) */}
        <div className="card" style={{ padding: '0', marginBottom: '18px', overflow: 'hidden', border: '1px solid var(--border)' }}>
          <div style={{ padding: '12px 16px', background: 'var(--bg-raised)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>📅 BẢNG ĐĂNG KÝ LỊCH HÀNG TUẦN TTS</span>
              <span className="badge badge--primary" style={{ fontSize: '11px', fontWeight: 800 }}>• {regs.length} TTS</span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              💡 Bấm vào ô của bạn để bật/tắt ca <strong>[x]</strong>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'center' }}>
              <thead>
                {/* Header Row 1: Thông tin TTS & Các cột T2..T7 & Cột SL */}
                <tr style={{ background: 'var(--bg-input)', borderBottom: '1px solid var(--border)', color: 'var(--text)' }}>
                  <th colSpan="2" style={{ padding: '8px 10px', width: '90px', borderRight: '1px solid var(--border)', fontWeight: 800 }}>
                    Lịch hàng tuần TTS
                  </th>
                  {regs.map(intern => (
                    <th 
                      key={intern._id} 
                      style={{ 
                        padding: '8px 10px', minWidth: '100px', 
                        borderRight: '1px solid var(--border)', 
                        background: 'rgba(99, 102, 241, 0.08)',
                        color: 'var(--primary)', fontWeight: 800
                      }}
                    >
                      <div style={{ fontSize: '13px' }}>{intern.full_name}</div>
                      {isAdminOrLeader && (
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '4px', marginTop: '2px' }}>
                          <button 
                            onClick={() => handleEditInternSchedule(intern)} 
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px' }}
                            title="Sửa thông tin"
                          >
                            <Edit2 size={11} />
                          </button>
                          <button 
                            onClick={() => handleRemoveIntern(intern)} 
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', padding: '2px' }}
                            title="Xóa khỏi tuần"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      )}
                    </th>
                  ))}
                  {/* Cột SL tổng số lượng TTS có mặt từng buổi */}
                  <th style={{ padding: '8px 10px', width: '50px', background: 'var(--bg-card)', fontWeight: 800, color: 'var(--text)' }}>
                    SL
                  </th>
                </tr>

                {/* Header Row 2: SĐT */}
                <tr style={{ borderBottom: '1px solid var(--border-muted)', background: 'var(--bg-card)' }}>
                  <th style={{ padding: '4px 6px', fontWeight: 700, color: 'var(--text-muted)', width: '35px', borderRight: '1px solid var(--border-muted)' }}>TT</th>
                  <th style={{ padding: '4px 6px', fontWeight: 700, color: 'var(--text-muted)', width: '55px', borderRight: '1px solid var(--border)' }}>SĐT</th>
                  {regs.map(intern => (
                    <th key={`phone-${intern._id}`} style={{ padding: '4px 6px', fontWeight: 600, color: 'var(--text-secondary)', borderRight: '1px solid var(--border)', fontSize: '11px' }}>
                      {intern.phone || '—'}
                    </th>
                  ))}
                  <th style={{ padding: '4px 6px', background: 'var(--bg-card)' }}></th>
                </tr>

                {/* Header Row 3: STK */}
                <tr style={{ borderBottom: '2px solid var(--primary)', background: 'var(--bg-card)' }}>
                  <th style={{ padding: '4px 6px', fontWeight: 700, color: 'var(--text-muted)', borderRight: '1px solid var(--border-muted)' }}></th>
                  <th style={{ padding: '4px 6px', fontWeight: 700, color: 'var(--text-muted)', borderRight: '1px solid var(--border)' }}>STK</th>
                  {regs.map(intern => (
                    <th key={`bank-${intern._id}`} style={{ padding: '4px 6px', fontWeight: 600, color: 'var(--text-secondary)', borderRight: '1px solid var(--border)', fontSize: '11px' }}>
                      <div>{intern.bank_account || '—'}</div>
                      <div style={{ fontSize: '10px', color: 'var(--primary)' }}>{intern.bank_name || 'MB'}</div>
                    </th>
                  ))}
                  <th style={{ padding: '4px 6px', background: 'var(--bg-card)' }}></th>
                </tr>
              </thead>

              <tbody>
                {/* 6 Ngày (T2 -> T7), mỗi ngày 2 hàng (Sáng & Chiều) */}
                {DAYS.map(day => (
                  SHIFTS.map((shift, sIdx) => {
                    const shiftKey = `${day.key}_${shift.key}`;
                    const rowBg = day.key === 't7' ? 'rgba(239, 68, 68, 0.03)' : (sIdx === 0 ? 'var(--bg-card)' : 'rgba(255,255,255,0.015)');
                    const borderBottom = sIdx === 1 ? '2px solid var(--border)' : '1px solid var(--border-muted)';

                    return (
                      <tr key={shiftKey} style={{ background: rowBg, borderBottom: borderBottom }}>
                        {/* Cột Thứ (Gộp 2 dòng) */}
                        {sIdx === 0 ? (
                          <td 
                            rowSpan="2" 
                            style={{ 
                              padding: '8px 6px', fontWeight: 800, 
                              color: day.key === 't7' ? 'var(--red)' : 'var(--text)', 
                              borderRight: '1px solid var(--border)',
                              background: day.key === 't7' ? 'rgba(239, 68, 68, 0.08)' : 'var(--bg-input)'
                            }}
                          >
                            {day.short}
                          </td>
                        ) : null}

                        {/* Cột Buổi: S hoặc C */}
                        <td 
                          style={{ 
                            padding: '6px 4px', fontWeight: 800, 
                            borderRight: '1px solid var(--border)', 
                            color: shift.key === 'morning' ? '#3b82f6' : '#8b5cf6',
                            background: shift.key === 'morning' ? 'rgba(59, 130, 246, 0.08)' : 'rgba(139, 92, 246, 0.08)'
                          }}
                          title={shift.time}
                        >
                          {shift.key === 'morning' ? 'S' : 'C'}
                        </td>

                        {/* Các ô ca làm việc của từng TTS */}
                        {regs.map(intern => {
                          const isChecked = Boolean(intern.shifts?.[shiftKey]);
                          const isMyCell = user && (
                            (intern.user_id && String(intern.user_id?._id || intern.user_id) === String(user._id || user.id)) ||
                            (intern.full_name && intern.full_name.trim().toLowerCase() === user.full_name?.trim().toLowerCase())
                          );

                          return (
                            <td 
                              key={`${intern._id}-${shiftKey}`}
                              onClick={() => handleToggleShiftDirect(intern, shiftKey)}
                              style={{ 
                                padding: '6px 4px', 
                                borderRight: '1px solid var(--border)',
                                cursor: (isAdminOrLeader || isMyCell) ? 'pointer' : 'default',
                                background: isChecked ? 'rgba(16, 185, 129, 0.14)' : 'transparent',
                                transition: 'all 0.15s ease'
                              }}
                              title={`${day.label} (${shift.label}: ${shift.time}) - ${intern.full_name}: ${isChecked ? 'Có đi làm [x]' : 'Nghỉ / bận học'}${isMyCell || isAdminOrLeader ? ' (Click để đổi)' : ''}`}
                            >
                              {isChecked ? (
                                <span style={{ fontWeight: 900, color: 'var(--green)', fontSize: '14px' }}>x</span>
                              ) : (
                                <span style={{ opacity: 0.15 }}>—</span>
                              )}
                            </td>
                          );
                        })}

                        {/* Cột SL tổng buổi này */}
                        <td style={{ padding: '6px 8px', fontWeight: 800, color: 'var(--primary)', background: 'rgba(99, 102, 241, 0.06)' }}>
                          {shiftTotals[shiftKey] || 0}
                        </td>
                      </tr>
                    );
                  })
                ))}
              </tbody>

              {/* Hàng tổng cộng số buổi đi làm của từng TTS trong tuần */}
              <tfoot>
                <tr style={{ background: 'var(--bg-raised)', borderTop: '2px solid var(--primary)', fontWeight: 800 }}>
                  <td colSpan="2" style={{ padding: '8px 10px', textAlign: 'center', color: 'var(--text)', borderRight: '1px solid var(--border)' }}>
                    SL
                  </td>
                  {regs.map(intern => {
                    let totalShifts = 0;
                    if (intern.shifts) {
                      Object.values(intern.shifts).forEach(v => {
                        if (v) totalShifts += 1;
                      });
                    }
                    return (
                      <td key={`total-${intern._id}`} style={{ padding: '8px 6px', borderRight: '1px solid var(--border)', color: 'var(--primary)', fontSize: '13px' }}>
                        {totalShifts}
                      </td>
                    );
                  })}
                  <td style={{ padding: '8px 6px', color: 'var(--primary)', fontSize: '13px' }}>
                    {Object.values(shiftTotals).reduce((a, b) => a + b, 0)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div style={{ padding: '10px 16px', background: 'var(--bg-card)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', fontSize: '12px' }}>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--green)' }} /> <strong>x</strong>: Có đi làm
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#3b82f6' }} /> <strong>Sáng</strong>: 9h00 - 12h30
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#8b5cf6' }} /> <strong>Chiều</strong>: 14h00 - 18h30
              </span>
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
              * TTS phụ thuộc vào lịch học, chủ nhật hàng tuần đăng ký lịch tuần tiếp theo
            </div>
          </div>
        </div>


        {/* BẢNG 2: LỊCH TRỰC NHẬT & VỆ SINH VĂN PHÒNG */}
        <div className="card" style={{ padding: '0', marginBottom: '18px', overflow: 'hidden', border: '1px solid var(--border)' }}>
          <div style={{ padding: '12px 16px', background: 'var(--bg-raised)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>🧹 LỊCH TRỰC NHẬT & VỆ SINH VĂN PHÒNG</span>
            </div>
            {isAdminOrLeader && (
              <button onClick={handleOpenDutyModal} className="btn btn--primary" style={{ padding: '4px 12px', fontSize: '12px', gap: '4px' }}>
                <Edit2 size={13} /> Sửa phân công (Leader Ninh)
              </button>
            )}
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
              <thead>
                <tr style={{ background: 'var(--bg-input)', borderBottom: '2px solid var(--border)', color: 'var(--text)', textAlign: 'center' }}>
                  <th style={{ padding: '8px 10px', width: '60px', borderRight: '1px solid var(--border)', fontWeight: 800 }}>THỨ</th>
                  <th style={{ padding: '8px 14px', minWidth: '180px', borderRight: '1px solid var(--border)', fontWeight: 800, color: 'var(--primary)' }}>
                    DỌN VĂN PHÒNG
                  </th>
                  <th style={{ padding: '8px 14px', minWidth: '160px', borderRight: '1px solid var(--border)', fontWeight: 800, color: 'var(--red)' }}>
                    DỌN NHÀ VỆ SINH
                  </th>
                  <th style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 800, color: 'var(--text)' }}>
                    NỘI DUNG TRỰC NHẬT & QUY ĐỊNH
                  </th>
                </tr>
              </thead>
              <tbody>
                {DAYS.map((d, idx) => {
                  const duty = dutyRoster[d.key] || {};
                  return (
                    <tr key={d.key} style={{ borderBottom: '1px solid var(--border-muted)', background: d.key === 't7' ? 'rgba(239, 68, 68, 0.03)' : (idx % 2 === 0 ? 'var(--bg-card)' : 'transparent') }}>
                      <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 800, color: d.key === 't7' ? 'var(--red)' : 'var(--text)', borderRight: '1px solid var(--border)' }}>
                        {d.short}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: 'var(--text)', borderRight: '1px solid var(--border)' }}>
                        {duty.office_cleaning || '—'}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: d.key === 't7' ? 'var(--red)' : 'var(--text-secondary)', borderRight: '1px solid var(--border)' }}>
                        {duty.toilet_cleaning || (d.key === 't7' ? 'A Minh' : '—')}
                      </td>

                      {/* Gộp cột nội dung quy định trực nhật ở hàng đầu tiên */}
                      {idx === 0 ? (
                        <td rowSpan="6" style={{ padding: '14px 18px', verticalAlign: 'top', background: 'var(--bg-card)', fontSize: '12px', lineHeight: 1.7 }}>
                          <div style={{ fontWeight: 800, color: 'var(--primary)', marginBottom: '4px' }}>
                            * Trước giờ làm:
                          </div>
                          <div style={{ color: 'var(--text-secondary)', paddingLeft: '10px', marginBottom: '8px' }}>
                            1. Quét nhà<br />
                            2. Dọn bàn chung<br />
                            3. Dọn bàn Máy in
                          </div>

                          <div style={{ fontWeight: 800, color: 'var(--primary)', marginBottom: '4px' }}>
                            * Giữa và cuối ngày:
                          </div>
                          <div style={{ color: 'var(--text-secondary)', paddingLeft: '10px', marginBottom: '8px' }}>
                            1. Đồ dùng chung / đồ dùng cá nhân ➔ dọn, rửa và cất gọn sau khi dùng<br />
                            2. Đổ rác cuối ngày
                          </div>

                          <div style={{ fontWeight: 800, color: 'var(--red)', marginTop: '8px', padding: '6px 10px', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.08)' }}>
                            🧹 Lịch dọn nhà vệ sinh 1 tuần/ lần, vào thứ 7 hàng tuần
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* MODAL 1: ĐĂNG KÝ LỊCH TUẦN TTS */}
      {showRegisterModal && (
        <div className="modal-overlay" onClick={() => setShowRegisterModal(false)}>
          <div className="modal-sheet animate-slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-sheet__handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ fontWeight: 800, fontSize: '16px' }}>✍️ Đăng Ký Lịch Làm Việc Tuần {weekNumber}</div>
              <button onClick={() => setShowRegisterModal(false)} className="btn btn--ghost" style={{ padding: '4px 8px' }}><X size={18} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }}>
              <div>
                <label className="form-label">Họ và tên Thực tập sinh</label>
                <input
                  type="text"
                  className="form-input"
                  value={registerForm.full_name}
                  onChange={e => setRegisterForm(prev => ({ ...prev, full_name: e.target.value }))}
                  placeholder="Nhập họ tên..."
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label className="form-label">Số điện thoại</label>
                  <input
                    type="text"
                    className="form-input"
                    value={registerForm.phone}
                    onChange={e => setRegisterForm(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="0359..."
                  />
                </div>
                <div>
                  <label className="form-label">STK & Ngân hàng</label>
                  <input
                    type="text"
                    className="form-input"
                    value={registerForm.bank_account}
                    onChange={e => setRegisterForm(prev => ({ ...prev, bank_account: e.target.value }))}
                    placeholder="Số tài khoản MB..."
                  />
                </div>
              </div>

              {/* Grid Chọn Ca Làm Việc */}
              <div style={{ marginTop: '6px' }}>
                <label className="form-label" style={{ marginBottom: '6px' }}>Chọn các ca bạn đi làm được:</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {DAYS.map(d => (
                    <div key={d.key} style={{ background: 'var(--bg-input)', padding: '8px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                      <div style={{ fontWeight: 800, fontSize: '12px', marginBottom: '6px', color: d.key === 't7' ? 'var(--red)' : 'var(--text)' }}>
                        {d.label}
                      </div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', marginBottom: '4px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={Boolean(registerForm.shifts?.[`${d.key}_morning`])}
                          onChange={e => setRegisterForm(prev => ({
                            ...prev,
                            shifts: { ...prev.shifts, [`${d.key}_morning`]: e.target.checked }
                          }))}
                        />
                        <span>Sáng (9h-12h30)</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={Boolean(registerForm.shifts?.[`${d.key}_afternoon`])}
                          onChange={e => setRegisterForm(prev => ({
                            ...prev,
                            shifts: { ...prev.shifts, [`${d.key}_afternoon`]: e.target.checked }
                          }))}
                        />
                        <span>Chiều (14h-18h30)</span>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
              <button onClick={() => setShowRegisterModal(false)} className="btn btn--ghost btn--full">Hủy</button>
              <button onClick={handleSaveRegistration} disabled={submittingReg} className="btn btn--primary btn--full">
                {submittingReg ? <span className="spinner" /> : <><Check size={16} /> Lưu Lịch Đăng Ký</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: PHÂN CÔNG TRỰC NHẬT (LEADER NINH / ADMIN) */}
      {showDutyModal && (
        <div className="modal-overlay" onClick={() => setShowDutyModal(false)}>
          <div className="modal-sheet animate-slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="modal-sheet__handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ fontWeight: 800, fontSize: '16px' }}>🧹 Phân Công Trực Nhật & Vệ Sinh Tuần {weekNumber}</div>
              <button onClick={() => setShowDutyModal(false)} className="btn btn--ghost" style={{ padding: '4px 8px' }}><X size={18} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '60vh', overflowY: 'auto', paddingRight: '4px' }}>
              {DAYS.map(d => (
                <div key={d.key} style={{ background: 'var(--bg-input)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 800, fontSize: '13px', marginBottom: '8px', color: d.key === 't7' ? 'var(--red)' : 'var(--primary)' }}>
                    {d.label}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label className="form-label" style={{ fontSize: '11px' }}>Dọn văn phòng</label>
                      <input
                        type="text"
                        className="form-input"
                        style={{ fontSize: '12px', padding: '6px 10px' }}
                        value={dutyRosterForm[d.key]?.office_cleaning || ''}
                        onChange={e => setDutyRosterForm(prev => ({
                          ...prev,
                          [d.key]: { ...(prev[d.key] || {}), office_cleaning: e.target.value }
                        }))}
                        placeholder="Nhập tên (VD: My, Ly)..."
                      />
                    </div>
                    <div>
                      <label className="form-label" style={{ fontSize: '11px' }}>Dọn nhà vệ sinh</label>
                      <input
                        type="text"
                        className="form-input"
                        style={{ fontSize: '12px', padding: '6px 10px' }}
                        value={dutyRosterForm[d.key]?.toilet_cleaning || ''}
                        onChange={e => setDutyRosterForm(prev => ({
                          ...prev,
                          [d.key]: { ...(prev[d.key] || {}), toilet_cleaning: e.target.value }
                        }))}
                        placeholder={d.key === 't7' ? 'VD: A Minh' : 'Để trống nếu không có'}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <button onClick={() => setShowDutyModal(false)} className="btn btn--ghost btn--full">Hủy</button>
              <button onClick={handleSaveDutyRoster} disabled={submittingDuty} className="btn btn--primary btn--full">
                {submittingDuty ? <span className="spinner" /> : <><Save size={16} /> Lưu Phân Công</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: THÊM TTS VÀO BẢNG */}
      {showAddInternModal && (
        <div className="modal-overlay" onClick={() => setShowAddInternModal(false)}>
          <div className="modal-sheet animate-slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <div className="modal-sheet__handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ fontWeight: 800, fontSize: '16px' }}>➕ Thêm TTS Vào Bảng Tuần</div>
              <button onClick={() => setShowAddInternModal(false)} className="btn btn--ghost" style={{ padding: '4px 8px' }}><X size={18} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }}>
              <div>
                <label className="form-label">Chọn nhân sự có sẵn (hoặc nhập tên bên dưới)</label>
                <select
                  className="form-input"
                  onChange={e => {
                    const selected = allStaff.find(s => String(s._id) === String(e.target.value));
                    if (selected) {
                      setNewInternForm({
                        user_id: selected._id,
                        full_name: selected.full_name,
                        phone: selected.phone || '',
                        bank_account: selected.bank_account || '',
                        bank_name: selected.bank_name || 'MB'
                      });
                    }
                  }}
                >
                  <option value="">-- Chọn từ danh sách nhân sự --</option>
                  {allStaff.map(s => (
                    <option key={s._id} value={s._id}>{s.full_name} ({s.position || 'Nhân sự'})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label">Họ và tên TTS *</label>
                <input
                  type="text"
                  className="form-input"
                  value={newInternForm.full_name}
                  onChange={e => setNewInternForm(prev => ({ ...prev, full_name: e.target.value }))}
                  placeholder="Nhập tên..."
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label className="form-label">Số điện thoại</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newInternForm.phone}
                    onChange={e => setNewInternForm(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="SĐT..."
                  />
                </div>
                <div>
                  <label className="form-label">STK</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newInternForm.bank_account}
                    onChange={e => setNewInternForm(prev => ({ ...prev, bank_account: e.target.value }))}
                    placeholder="STK..."
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
              <button onClick={() => setShowAddInternModal(false)} className="btn btn--ghost btn--full">Hủy</button>
              <button onClick={handleSaveNewIntern} disabled={submittingAddIntern} className="btn btn--primary btn--full">
                {submittingAddIntern ? <span className="spinner" /> : <><Plus size={16} /> Thêm Vào Bảng</>}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
