import ImageLightbox from "../components/ImageLightbox";
// src/pages/ProfilePage.jsx
// Trang cá nhân — Xem thông tin, Quản lý ngày phép tồn, Đổi mật khẩu, Gửi yêu cầu đổi thông tin xe duyệt bởi Admin

import { useState, useEffect, useRef, useCallback } from 'react';
import { LogOut, Lock, User, Mail, Phone, Building2, Shield, ChevronRight, Edit3, X, Camera, Bike, Clock, CreditCard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';
import useAuthStore from '../stores/authStore';
import HeaderActions from '../components/HeaderActions';

const ROLE_VI = { admin: 'Quản trị viên', leader: 'Leader', manager: 'Leader', employee: 'Nhân viên', staff: 'Nhân viên' };

export default function ProfilePage() {
  const { user, setUser, fetchMe, logout } = useAuthStore();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const isStaff = user?.role === 'staff' || user?.role === 'employee';
  const isAdminOrManager = ['admin', 'leader', 'manager'].includes(user?.role);

  const [showChangePass, setShowChangePass] = useState(false);
  const [showEditInfo, setShowEditInfo] = useState(false);
  const [showEditBankModal, setShowEditBankModal] = useState(false);
  const [showVehicleRequestModal, setShowVehicleRequestModal] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [fullAvatarImage, setFullAvatarImage] = useState(null);

  // Direct edit state (for Admin/Leader)
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [parkingLocation, setParkingLocation] = useState(user?.parking_location || 'Tòa 17T10 Nguyễn Thị Định');
  const [vehicleInfo, setVehicleInfo] = useState(user?.vehicle_info || user?.license_plate || '');
  const [updatingInfo, setUpdatingInfo] = useState(false);

  // Employee Phone Update State
  const [employeePhone, setEmployeePhone] = useState(user?.phone || '');
  // Self-service bank information (all roles edit only their own account)
  const [bankName, setBankName] = useState(user?.bank_name || '');
  const [bankAccount, setBankAccount] = useState(user?.bank_account || '');
  const [bankBranch, setBankBranch] = useState(user?.branch || '');
  const [updatingBank, setUpdatingBank] = useState(false);

  // Vehicle update request state (for Employee -> Admin approval)
  const [reqParkingLocation, setReqParkingLocation] = useState(user?.parking_location || 'Tòa 17T10 Nguyễn Thị Định');
  const [reqVehicleInfo, setReqVehicleInfo] = useState(user?.vehicle_info || user?.license_plate || '');
  const [reqReason, setReqReason] = useState('');
  const [submittingVehicleReq, setSubmittingVehicleReq] = useState(false);
  const [pendingVehicleReq, setPendingVehicleReq] = useState(null);

  // Change password state
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [submittingPass, setSubmittingPass] = useState(false);

  const checkPendingVehicleRequest = useCallback(async () => {
    try {
      const { data } = await api.get('/requests?type=vehicle_update&status=pending');
      if (Array.isArray(data) && data.length > 0) {
        setPendingVehicleReq(data[0]);
      } else {
        setPendingVehicleReq(null);
      }
    } catch {}
  }, []);

  // Fetch freshest profile from DB on mount
  useEffect(() => {
    if (fetchMe) fetchMe();
    checkPendingVehicleRequest();
  }, [fetchMe, checkPendingVehicleRequest]);

  // Sync state with user data
  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
      setPhone(user.phone || '');
      setEmployeePhone(user.phone || '');
      setBankName(user.bank_name || '');
      setBankAccount(user.bank_account || '');
      setBankBranch(user.branch || '');
      setParkingLocation(user.parking_location || 'Tòa 17T10 Nguyễn Thị Định');
      setVehicleInfo(user.vehicle_info || user.license_plate || '');
      setReqParkingLocation(user.parking_location || 'Tòa 17T10 Nguyễn Thị Định');
      setReqVehicleInfo(user.vehicle_info || user.license_plate || '');
    }
  }, [user]);

  const handleLogout = () => {
    logout();
    navigate('/login');
    toast.success('Đã đăng xuất');
  };

  const departmentLabel = (() => {
    const names = Array.isArray(user?.department_names) && user.department_names.length > 0
      ? user.department_names
      : Array.isArray(user?.department_ids)
        ? user.department_ids.map(department => department?.name).filter(Boolean)
        : [];
    if (names.length > 0) return names.join(', ');
    return user?.department_name || user?.department_id?.name || 'Chưa phân';
  })();

  const handleAvatarSelect = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Vui lòng chọn tệp hình ảnh hợp lệ');
      return;
    }

    setUploadingAvatar(true);
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

      const { data } = await api.patch('/auth/profile', { avatar_url: base64 });
      toast.success('Đã cập nhật ảnh đại diện thành công! 📸');
      setUser(data.user);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Lỗi tải ảnh đại diện');
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Direct Update Profile (Admin / Leader)
  const handleUpdateProfile = async () => {
    if (!fullName.trim()) {
      toast.error('Họ tên không được để trống');
      return;
    }
    setUpdatingInfo(true);
    try {
      const payload = {
        full_name: fullName.trim(),
        phone: phone.trim()
      };
      if (user?.role === 'admin') {
        payload.parking_location = parkingLocation.trim();
        payload.vehicle_info = vehicleInfo.trim();
      }
      const { data } = await api.patch('/auth/profile', payload);
      toast.success(data.message);
      setUser(data.user);
      setShowEditInfo(false);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Lỗi cập nhật thông tin');
    } finally { setUpdatingInfo(false); }
  };

  const openBankEditor = () => {
    setEmployeePhone(user?.phone || '');
    setBankName(user?.bank_name || '');
    setBankAccount(user?.bank_account || '');
    setBankBranch(user?.branch || '');
    setShowEditBankModal(true);
  };

  const handleUpdateBankInfo = async () => {
    const normalizedAccount = bankAccount.replace(/\s+/g, '').trim();
    if (normalizedAccount && !/^[0-9-]{4,30}$/.test(normalizedAccount)) {
      toast.error('Số tài khoản chỉ gồm chữ số hoặc dấu gạch ngang');
      return;
    }
    if (normalizedAccount && !bankName.trim()) {
      toast.error('Vui lòng nhập tên ngân hàng');
      return;
    }

    setUpdatingBank(true);
    try {
      const { data } = await api.patch('/auth/profile', {
        ...(isStaff ? { phone: employeePhone.trim() || null } : {}),
        bank_name: bankName.trim() || null,
        bank_account: normalizedAccount || null,
        branch: bankBranch.trim() || null,
      });
      toast.success(isStaff ? 'Đã cập nhật thông tin cá nhân' : 'Đã cập nhật thông tin ngân hàng');
      setUser(data.user);
      setShowEditBankModal(false);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Lỗi cập nhật thông tin ngân hàng');
    } finally {
      setUpdatingBank(false);
    }
  };

  // Submit Vehicle Update Request (Staff/Employee -> Admin Approval)
  const handleSubmitVehicleRequest = async () => {
    const hasExistingVehicle = Boolean(user?.vehicle_info || user?.license_plate);
    const finalReason = reqReason.trim() || (hasExistingVehicle ? 'Cập nhật đổi thông tin xe' : 'Đăng ký gửi xe lần đầu');

    setSubmittingVehicleReq(true);
    try {
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
      await api.post('/requests', {
        type: 'vehicle_update',
        start_date: today,
        reason: finalReason,
        proposed_parking_location: reqParkingLocation.trim() || 'Tòa 17T10 Nguyễn Thị Định',
        proposed_vehicle_info: reqVehicleInfo.trim() || null,
      });

      toast.success(hasExistingVehicle 
        ? 'Đã gửi yêu cầu đổi thông tin xe tới Quản trị viên phê duyệt! 🛵'
        : 'Đã gửi thông tin đăng ký gửi xe tới Quản trị viên! 🛵');
      setShowVehicleRequestModal(false);
      setReqReason('');
      checkPendingVehicleRequest();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Lỗi gửi yêu cầu');
    } finally {
      setSubmittingVehicleReq(false);
    }
  };

  const handleChangePass = async () => {
    if (!oldPass || !newPass) {
      toast.error('Vui lòng nhập đầy đủ');
      return;
    }
    if (newPass.length < 6) {
      toast.error('Mật khẩu mới ít nhất 6 ký tự');
      return;
    }
    if (newPass !== confirmPass) {
      toast.error('Mật khẩu xác nhận không khớp');
      return;
    }
    setSubmittingPass(true);
    try {
      await api.post('/auth/change-password', { old_password: oldPass, new_password: newPass });
      toast.success('Đổi mật khẩu thành công');
      setShowChangePass(false);
      setOldPass(''); setNewPass(''); setConfirmPass('');
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Lỗi đổi mật khẩu');
    } finally { setSubmittingPass(false); }
  };

  const infoItems = [
    { icon: <Mail size={16} />, label: 'Email', value: user?.email },
    { icon: <Phone size={16} />, label: 'Điện thoại', value: user?.phone || 'Chưa cập nhật' },
    { icon: <Building2 size={16} />, label: 'Phòng ban', value: departmentLabel },
    { icon: <User size={16} />, label: 'Chức vụ', value: user?.position || 'Nhân viên' },
    { icon: <span style={{ fontSize: '14px' }}>📅</span>, label: 'Ngày vào công ty', value: user?.join_date || (user?.start_year ? `Năm ${user.start_year}` : 'Chưa cập nhật') },
    { icon: <span style={{ fontSize: '14px' }}>🏢</span>, label: 'Địa điểm gửi xe', value: user?.parking_location || 'Tòa 17T10 Nguyễn Thị Định' },
    { icon: <span style={{ fontSize: '14px' }}>🛵</span>, label: 'Mô tả xe & Biển số', value: user?.vehicle_info || user?.license_plate || 'Chưa cập nhật' },
    { icon: <span style={{ fontSize: '14px' }}>🏦</span>, label: 'Ngân hàng', value: user?.bank_name || 'Chưa cập nhật' },
    { icon: <span style={{ fontSize: '14px' }}>💳</span>, label: 'Số tài khoản', value: user?.bank_account || 'Chưa cập nhật' },
    { icon: <span style={{ fontSize: '14px' }}>🏛️</span>, label: 'Chi nhánh ngân hàng', value: user?.branch || 'Chưa cập nhật' },
    { icon: <Shield size={16} />, label: 'Vai trò', value: ROLE_VI[user?.role] || user?.role },
  ];

  return (
    <div className="page">
      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" style={{ display: 'none' }} />

      <div className="header">
        <div className="header__inner">
          <div className="header__title">Cá nhân</div>
          <HeaderActions />
        </div>
      </div>

      <div className="container" style={{ paddingTop: '20px' }}>
        {/* Pending Vehicle Request Banner if any */}
        {pendingVehicleReq && (
          <div className="card animate-fade-in" style={{
            background: 'var(--yellow-soft)', border: '1px solid var(--yellow)',
            padding: '12px 14px', borderRadius: '12px', marginBottom: '14px',
            display: 'flex', alignItems: 'flex-start', gap: '10px'
          }}>
            <Clock size={20} color="var(--yellow)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ flex: 1, fontSize: '12.5px' }}>
              <div style={{ fontWeight: 800, color: 'var(--yellow)', marginBottom: '2px' }}>
                Đang chờ duyệt đổi thông tin xe
              </div>
              <div style={{ color: 'var(--text-secondary)' }}>
                Đề xuất mới: <strong>{pendingVehicleReq.proposed_vehicle_info || 'Không gửi xe'}</strong> ({pendingVehicleReq.proposed_parking_location || '17T10'}). Admin sẽ xem xét và cập nhật sớm.
              </div>
            </div>
          </div>
        )}

        {/* Profile header */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }} className="animate-fade-in">
          <div
            style={{ position: 'relative', width: '80px', height: '80px', margin: '0 auto 10px', cursor: 'pointer' }}
            onClick={() => {
              if (user?.avatar_url) {
                setFullAvatarImage({ url: user.avatar_url, title: user.full_name });
              } else {
                handleAvatarSelect();
              }
            }}
            title={user?.avatar_url ? 'Click để xem ảnh phóng to' : 'Click để tải ảnh'}
          >
            <img
              src={user?.avatar_url || '/logo.png'}
              alt={user?.full_name || 'User'}
              style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--primary)' }}
              onError={e => { e.target.src = '/logo.png'; }}
            />
            <div
              onClick={(e) => { e.stopPropagation(); handleAvatarSelect(); }}
              style={{
                position: 'absolute', bottom: '0', right: '0', background: 'var(--primary)', color: '#fff',
                borderRadius: '50%', width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '2px solid var(--bg)', fontSize: '12px', cursor: 'pointer',
              }}
              title="Đổi ảnh đại diện"
            >
              {uploadingAvatar ? <span className="spinner" style={{ width: '12px', height: '12px' }} /> : <Camera size={13} />}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
            <button
              type="button"
              onClick={handleAvatarSelect}
              className="btn btn--ghost"
              style={{ fontSize: '11px', padding: '3px 8px', color: 'var(--text-secondary)', fontWeight: 600 }}
            >
              📸 Đổi ảnh đại diện
            </button>
          </div>

          <h2 style={{ fontSize: '18px', fontWeight: 800 }}>{user?.full_name}</h2>
          <span className={`badge ${user?.role === 'admin' ? 'badge--danger' : (user?.role === 'leader' || user?.role === 'manager') ? 'badge--warning' : 'badge--info'}`}>
            {ROLE_VI[user?.role]}
          </span>
        </div>

        {/* Info card */}
        <div className="card animate-fade-in" style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)' }}>
              Thông tin hồ sơ
            </span>
            {isAdminOrManager ? (
              <button
                onClick={() => {
                  setFullName(user?.full_name || '');
                  setPhone(user?.phone || '');
                  setParkingLocation(user?.parking_location || 'Tòa 17T10 Nguyễn Thị Định');
                  setVehicleInfo(user?.vehicle_info || user?.license_plate || '');
                  setShowEditInfo(true);
                }}
                style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}
              >
                <Edit3 size={14} /> Sửa hồ sơ
              </button>
            ) : (
              <button
                onClick={() => {
                  setReqParkingLocation(user?.parking_location || 'Tòa 17T10 Nguyễn Thị Định');
                  setReqVehicleInfo(user?.vehicle_info || user?.license_plate || '');
                  setReqReason('');
                  setShowVehicleRequestModal(true);
                }}
                className="btn btn--ghost"
                style={{ fontSize: '12px', padding: '4px 8px', color: 'var(--primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Bike size={14} /> Đổi thông tin xe
              </button>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {infoItems.map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{item.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{item.label}</div>
                  <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text)' }}>{item.value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {isStaff && (
            <>
              <button
                onClick={openBankEditor}
                className="card animate-fade-in"
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  cursor: 'pointer', width: '100%', textAlign: 'left',
                  fontFamily: 'inherit', fontSize: '14px', color: 'var(--text)',
                  border: '1px solid var(--border)', background: 'var(--bg-card)'
                }}
              >
                <User size={18} color="var(--primary)" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>Cập nhật thông tin cá nhân</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Số điện thoại và thông tin tài khoản ngân hàng</div>
                </div>
                <ChevronRight size={16} color="var(--text-muted)" />
              </button>

              <button
                onClick={() => {
                  setReqParkingLocation(user?.parking_location || 'Tòa 17T10 Nguyễn Thị Định');
                  setReqVehicleInfo(user?.vehicle_info || user?.license_plate || '');
                  setReqReason('');
                  setShowVehicleRequestModal(true);
                }}
                className="card animate-fade-in"
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  cursor: 'pointer', width: '100%', textAlign: 'left',
                  fontFamily: 'inherit', fontSize: '14px', color: 'var(--text)',
                  border: '1px solid var(--primary-soft)', background: 'var(--bg-card)'
                }}
              >
                <Bike size={18} color="var(--primary)" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>
                    {user?.vehicle_info || user?.license_plate ? 'Gửi yêu cầu đổi thông tin gửi xe' : 'Khai báo thông tin gửi xe'}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {user?.vehicle_info || user?.license_plate ? 'Đề xuất đổi biển số / nơi gửi nộp Admin duyệt' : 'Đăng ký vé xe tòa 17T10 hoặc báo gửi ngoài'}
                  </div>
                </div>
                <ChevronRight size={16} color="var(--text-muted)" />
              </button>
            </>
          )}

          {!isStaff && (
            <button
              onClick={openBankEditor}
              className="card animate-fade-in"
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                cursor: 'pointer', width: '100%', textAlign: 'left',
                fontFamily: 'inherit', fontSize: '14px', color: 'var(--text)',
                border: '1px solid var(--border)', background: 'var(--bg-card)'
              }}
            >
              <CreditCard size={18} color="var(--primary)" />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>Cập nhật thông tin ngân hàng</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Tên ngân hàng, số tài khoản và chi nhánh nhận thanh toán</div>
              </div>
              <ChevronRight size={16} color="var(--text-muted)" />
            </button>
          )}

          <button
            onClick={() => setShowChangePass(!showChangePass)}
            className="card animate-fade-in"
            style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              cursor: 'pointer', width: '100%', textAlign: 'left',
              fontFamily: 'inherit', fontSize: '14px', color: 'var(--text)',
            }}
          >
            <Lock size={18} color="var(--primary)" />
            <span style={{ flex: 1, fontWeight: 500 }}>Đổi mật khẩu</span>
            <ChevronRight size={16} color="var(--text-muted)" />
          </button>

          <button
            onClick={handleLogout}
            className="card"
            style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              cursor: 'pointer', width: '100%', textAlign: 'left',
              fontFamily: 'inherit', fontSize: '14px', color: 'var(--red)',
              borderColor: 'var(--red-soft)',
            }}
          >
            <LogOut size={18} />
            <span style={{ flex: 1, fontWeight: 500 }}>Đăng xuất</span>
          </button>
        </div>
      </div>

      {/* Self-service Bank Information Modal */}
      {showEditBankModal && (
        <div className="modal-overlay" onClick={() => setShowEditBankModal(false)}>
          <div className="modal-sheet animate-slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="modal-sheet__handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: 'var(--text)' }}>
                  {isStaff ? '👤 Cập nhật thông tin cá nhân' : '💳 Thông tin ngân hàng'}
                </h3>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px' }}>
                  Bạn chỉ đang cập nhật thông tin của chính mình
                </div>
              </div>
              <button onClick={() => setShowEditBankModal(false)} className="btn btn--ghost" style={{ padding: '4px 8px' }} aria-label="Đóng">
                <X size={18} />
              </button>
            </div>

            {isStaff && (
              <div className="form-group">
                <label className="form-label">Số điện thoại liên hệ</label>
                <input
                  type="tel"
                  inputMode="tel"
                  className="form-input"
                  value={employeePhone}
                  onChange={e => setEmployeePhone(e.target.value)}
                  placeholder="VD: 0912345678"
                  maxLength={20}
                  autoFocus
                />
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Tên ngân hàng</label>
              <input
                type="text"
                className="form-input"
                value={bankName}
                onChange={e => setBankName(e.target.value)}
                placeholder="VD: MB Bank, Vietcombank..."
                maxLength={100}
                autoFocus={!isStaff}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Số tài khoản</label>
              <input
                type="text"
                inputMode="numeric"
                className="form-input"
                value={bankAccount}
                onChange={e => setBankAccount(e.target.value)}
                placeholder="Nhập số tài khoản ngân hàng"
                maxLength={30}
                autoComplete="off"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Chi nhánh <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>(không bắt buộc)</span></label>
              <input
                type="text"
                className="form-input"
                value={bankBranch}
                onChange={e => setBankBranch(e.target.value)}
                placeholder="VD: Chi nhánh Thanh Xuân"
                maxLength={120}
              />
            </div>

            <div style={{ padding: '10px 12px', borderRadius: '10px', background: 'var(--bg-raised)', color: 'var(--text-muted)', fontSize: '11px', lineHeight: 1.5 }}>
              🔒 Thông tin ngân hàng chỉ hiển thị trong hồ sơ của bạn và khu vực quản trị được phân quyền.
            </div>

            <button onClick={handleUpdateBankInfo} disabled={updatingBank} className="btn btn--primary btn--full btn--lg" style={{ marginTop: '14px' }}>
              {updatingBank ? <span className="spinner" /> : (isStaff ? 'Lưu thông tin cá nhân' : 'Lưu thông tin ngân hàng')}
            </button>
          </div>
        </div>
      )}

      {/* Staff Vehicle Update Request Modal (Employee -> Admin Approval) */}
      {showVehicleRequestModal && (
        <div className="modal-overlay" onClick={() => setShowVehicleRequestModal(false)}>
          <div className="modal-sheet animate-slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="modal-sheet__handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: 'var(--text)' }}>
                  {user?.vehicle_info || user?.license_plate ? '🛵 Đề Xuất Đổi Thông Tin Gửi Xe' : '🛵 Khai Báo Thông Tin Gửi Xe'}
                </h3>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {user?.vehicle_info || user?.license_plate ? 'Thông tin sẽ được cập nhật sau khi Admin duyệt' : 'Đăng ký vé xe tòa nhà 17T10 hoặc báo gửi ngoài'}
                </div>
              </div>
              <button onClick={() => setShowVehicleRequestModal(false)} className="btn btn--ghost" style={{ padding: '4px 8px' }}>
                <X size={18} />
              </button>
            </div>

            {/* Quick Location Chips */}
            <div className="form-group">
              <label className="form-label">🏢 Địa điểm gửi xe</label>
              <input
                type="text"
                className="form-input"
                value={reqParkingLocation}
                onChange={e => setReqParkingLocation(e.target.value)}
                placeholder="VD: Tòa 17T10 Nguyễn Thị Định"
              />
              <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                {['Tòa 17T10 Nguyễn Thị Định', 'Gửi ngoài', 'Không gửi xe'].map(loc => (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => setReqParkingLocation(loc)}
                    className="btn btn--ghost"
                    style={{
                      fontSize: '11px',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      background: reqParkingLocation === loc ? 'var(--primary-subtle, rgba(59, 130, 246, 0.15))' : 'var(--bg-input)',
                      color: reqParkingLocation === loc ? 'var(--primary)' : 'var(--text-secondary)',
                      borderColor: reqParkingLocation === loc ? 'var(--primary)' : 'var(--border)',
                      fontWeight: reqParkingLocation === loc ? 700 : 500
                    }}
                  >
                    {loc === 'Tòa 17T10 Nguyễn Thị Định' ? '🏢 ' : loc === 'Gửi ngoài' ? '🅿️ ' : '🚫 '}{loc}
                  </button>
                ))}
              </div>
            </div>

            {/* Vehicle Info */}
            <div className="form-group">
              <label className="form-label">🛵 Mô tả xe & Biển số xe</label>
              <input
                type="text"
                className="form-input"
                value={reqVehicleInfo}
                onChange={e => setReqVehicleInfo(e.target.value)}
                placeholder="VD: Honda Vision Trắng - 29G1-123.45"
              />
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                💡 Ghi rõ Hãng xe, Màu sắc và Biển số chính xác để nộp BQL tòa nhà 17T10.
              </div>
            </div>

            {/* Reason */}
            <div className="form-group">
              <label className="form-label">
                {user?.vehicle_info || user?.license_plate ? 'Lý do thay đổi (Tùy chọn)' : 'Lý do / Ghi chú (Không bắt buộc)'}
              </label>
              <textarea
                className="form-input"
                rows={2}
                value={reqReason}
                onChange={e => setReqReason(e.target.value)}
                placeholder={user?.vehicle_info || user?.license_plate ? "VD: Em mới mua xe mới..." : "VD: Đăng ký xe mới vào công ty..."}
              />
            </div>

            <button
              onClick={handleSubmitVehicleRequest}
              disabled={submittingVehicleReq}
              className="btn btn--primary btn--full btn--lg"
              style={{ marginTop: '8px' }}
            >
              {submittingVehicleReq ? <span className="spinner" /> : (user?.vehicle_info || user?.license_plate ? 'Gửi Yêu Cầu Cho Admin Duyệt' : 'Gửi Thông Tin Đăng Ký')}
            </button>
          </div>
        </div>
      )}

      {/* Admin/Leader Direct Edit Profile Sheet */}
      {showEditInfo && isAdminOrManager && (
        <div className="modal-overlay" onClick={() => setShowEditInfo(false)}>
          <div className="modal-sheet animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="modal-sheet__handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Chỉnh sửa thông tin</h3>
              <button onClick={() => setShowEditInfo(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div className="form-group">
              <label className="form-label">Họ và tên</label>
              <input type="text" className="form-input" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Nguyễn Văn A" />
            </div>

            <div className="form-group">
              <label className="form-label">Số điện thoại</label>
              <input type="text" className="form-input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="0912345678" />
            </div>

            {/* Thông tin gửi xe — Chỉ Admin mới sửa trực tiếp, các vai trò khác nộp đơn đổi xe */}
            {user?.role === 'admin' && (
              <>
                <div className="form-group">
                  <label className="form-label">🏢 Địa điểm gửi xe</label>
                  <input
                    type="text"
                    className="form-input"
                    value={parkingLocation}
                    onChange={e => setParkingLocation(e.target.value)}
                    placeholder="VD: Tòa 17T10 Nguyễn Thị Định"
                  />
                  <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                    {['Tòa 17T10 Nguyễn Thị Định', 'Gửi ngoài', 'Không gửi xe'].map(loc => (
                      <button
                        key={loc}
                        type="button"
                        onClick={() => setParkingLocation(loc)}
                        className="btn btn--ghost"
                        style={{
                          fontSize: '11px',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          background: parkingLocation === loc ? 'var(--primary-subtle, rgba(59, 130, 246, 0.15))' : 'var(--bg-input)',
                          color: parkingLocation === loc ? 'var(--primary)' : 'var(--text-secondary)',
                          borderColor: parkingLocation === loc ? 'var(--primary)' : 'var(--border)',
                          fontWeight: parkingLocation === loc ? 700 : 500
                        }}
                      >
                        {loc === 'Tòa 17T10 Nguyễn Thị Định' ? '🏢 ' : loc === 'Gửi ngoài' ? '🅿️ ' : '🚫 '}{loc}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">🛵 Mô tả xe & Biển số xe</label>
                  <input
                    type="text"
                    className="form-input"
                    value={vehicleInfo}
                    onChange={e => setVehicleInfo(e.target.value)}
                    placeholder="VD: Honda Lead Vàng - 29E1-456.78"
                  />
                </div>
              </>
            )}

            <button onClick={handleUpdateProfile} disabled={updatingInfo} className="btn btn--primary btn--full btn--lg" style={{ marginTop: '8px' }}>
              {updatingInfo ? <span className="spinner" /> : 'Lưu thay đổi'}
            </button>
          </div>
        </div>
      )}

      {/* Change Password Sheet */}
      {showChangePass && (
        <div className="modal-overlay" onClick={() => setShowChangePass(false)}>
          <div className="modal-sheet animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="modal-sheet__handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Đổi mật khẩu</h3>
              <button onClick={() => setShowChangePass(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div className="form-group">
              <label className="form-label">Mật khẩu hiện tại</label>
              <input type="password" className="form-input" value={oldPass} onChange={e => setOldPass(e.target.value)} placeholder="••••••" />
            </div>
            <div className="form-group">
              <label className="form-label">Mật khẩu mới</label>
              <input type="password" className="form-input" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="Ít nhất 6 ký tự" />
            </div>
            <div className="form-group">
              <label className="form-label">Xác nhận mật khẩu mới</label>
              <input type="password" className="form-input" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} placeholder="Nhập lại mật khẩu mới" />
            </div>

            <button onClick={handleChangePass} disabled={submittingPass} className="btn btn--primary btn--full btn--lg" style={{ marginTop: '8px' }}>
              {submittingPass ? <span className="spinner" /> : 'Xác nhận đổi'}
            </button>
          </div>
        </div>
      )}

      {/* Fullsize Avatar Lightbox Modal */}
      <ImageLightbox image={fullAvatarImage} onClose={() => setFullAvatarImage(null)} />
    </div>
  );
}
