// src/pages/ForgotPasswordPage.jsx
// Trang Đặt lại mật khẩu — Dành cho nhân viên sử dụng Mã Reset do Admin/Manager cấp

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { KeyRound, ArrowLeft, CheckCircle, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import ThemeToggle from '../components/ThemeToggle';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [success, setSuccess] = useState(false);

  
  const handleRequestOtp = async () => {
    if (!email) {
      toast.error("Vui lòng nhập địa chỉ email trước");
      return;
    }
    setSendingOtp(true);
    try {
      const { data } = await api.post("/auth/forgot-password", { email: email.trim() });
      toast.success(data.message || "Đã gửi mã xác thực tới email của bạn!");
      setOtpSent(true);
    } catch (err) {
      toast.error(err?.response?.data?.error || "Không thể gửi mã. Vui lòng kiểm tra lại email.");
    } finally {
      setSendingOtp(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !resetCode || !newPassword) {
      toast.error('Vui lòng điền đầy đủ các thông tin.');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Xác nhận mật khẩu mới không khớp.');
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await api.post('/auth/reset-password', {
        email: email.trim(),
        reset_code: resetCode.trim(),
        new_password: newPassword,
      });

      toast.success(data.message || 'Đặt lại mật khẩu thành công!');
      setSuccess(true);
      setTimeout(() => {
        navigate('/login');
      }, 2500);

    } catch (err) {
      toast.error(err?.response?.data?.error || 'Lỗi đặt lại mật khẩu.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
      padding: '24px',
    }}>
      <div style={{ position: 'fixed', top: '16px', right: '16px' }}>
        <ThemeToggle />
      </div>

      <div className="animate-slide-up" style={{ width: '100%', maxWidth: '400px' }}>
        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <Link to="/login" style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            fontSize: '13px', color: 'var(--primary)', fontWeight: 600,
            textDecoration: 'none', marginBottom: '16px',
          }}>
            <ArrowLeft size={16} /> Quay lại Đăng nhập
          </Link>

          <div style={{
            width: '48px', height: '48px',
            background: 'var(--primary-soft)',
            color: 'var(--primary)',
            borderRadius: '12px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: '16px',
          }}>
            <KeyRound size={24} />
          </div>

          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text)', marginBottom: '6px' }}>
            Đặt lại mật khẩu
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: 1.5 }}>
            Nhập email của bạn và bấm <strong>"Gửi mã OTP"</strong> để nhận mã xác thực qua Gmail hoặc lấy mã từ Quản trị viên.
          </p>
        </div>

        {success ? (
          <div className="card" style={{ textAlign: 'center', padding: '24px' }}>
            <CheckCircle size={48} color="var(--green)" style={{ margin: '0 auto 12px' }} />
            <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>Đổi mật khẩu thành công!</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Đang chuyển hướng về trang Đăng nhập...</div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="card" style={{ padding: '20px' }}>
            <div className="form-group">
              <label className="form-label">Email tài khoản *</label>
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  type="email"
                  className="form-input"
                  placeholder="nguyen-van-a@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  onClick={handleRequestOtp}
                  disabled={sendingOtp || !email}
                  className="btn btn--primary"
                  style={{ fontSize: "12px", padding: "8px 14px", whiteSpace: "nowrap", flexShrink: 0 }}
                >
                  {sendingOtp ? <span className="spinner" /> : otpSent ? "Gửi lại mã" : "Gửi mã OTP"}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Mã Reset (6 chữ số từ Admin) *</label>
              <input
                type="text"
                className="form-input"
                placeholder="VD: 482910"
                maxLength={6}
                value={resetCode}
                onChange={(e) => setResetCode(e.target.value)}
                style={{ letterSpacing: '2px', fontWeight: 700, fontSize: '16px' }}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Mật khẩu mới *</label>
              <input
                type="password"
                className="form-input"
                placeholder="Tối thiểu 6 ký tự"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Xác nhận mật khẩu mới *</label>
              <input
                type="password"
                className="form-input"
                placeholder="Nhập lại mật khẩu mới"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn btn--primary btn--full btn--lg"
              style={{ marginTop: '8px' }}
            >
              {submitting ? <span className="spinner" /> : <><Lock size={16} /> Đặt lại mật khẩu</>}
            </button>
          </form>
        )}

        <div style={{
          marginTop: '16px', padding: '12px',
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: '8px', fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5
        }}>
          💡 <strong>Chưa có mã Reset?</strong> Vui lòng liên hệ Trưởng phòng hoặc Quản trị viên để được cấp mã reset 6 chữ số trực tiếp.
        </div>
      </div>
    </div>
  );
}
