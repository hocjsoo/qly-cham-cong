// src/pages/LoginPage.jsx
// Trang đăng nhập — Clean, professional, hỗ trợ Quên mật khẩu

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import useAuthStore from '../stores/authStore';
import ThemeToggle from '../components/ThemeToggle';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, isLoading } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Vui lòng nhập email và mật khẩu');
      return;
    }

    const result = await login(email, password);
    if (result.success) {
      toast.success(`Chào ${result.user.full_name || 'bạn'}!`);
      if (result.must_change_password) {
        toast('Lần đầu đăng nhập: Vui lòng đổi mật khẩu mới để bảo mật tài khoản.', { icon: '🔐', duration: 6000 });
      }
      navigate((result.user.role === 'staff' || result.user.role === 'employee') ? '/checkin' : '/dashboard');
    } else {
      toast.error(result.error);
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
      {/* Theme toggle */}
      <div style={{ position: 'fixed', top: '16px', right: '16px' }}>
        <ThemeToggle />
      </div>

      <div className="animate-slide-up" style={{ width: '100%', maxWidth: '380px' }}>
        {/* Branding */}
        <div style={{ marginBottom: '28px', textAlign: 'center' }}>
          <div style={{
            width: '56px', height: '56px',
            background: 'var(--primary)',
            color: '#fff',
            borderRadius: '16px',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '26px', marginBottom: '16px',
            boxShadow: '0 8px 16px rgba(0,0,0,0.1)'
          }}>
            🏗️
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text)', marginBottom: '6px', letterSpacing: '-0.02em' }}>
            ET Office Portal
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
            Hệ thống Quản lý Chấm công & Nhân sự ET Architects
          </p>
        </div>

        {/* Form Card */}
        <div className="card" style={{ padding: '24px' }}>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Email làm việc</label>
              <input
                id="login-email"
                type="email"
                className="form-input"
                placeholder="admin@etoffice.vn"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                autoFocus
              />
            </div>

            <div className="form-group" style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label className="form-label" style={{ margin: 0 }}>Mật khẩu</label>
                <Link to="/forgot-password" style={{ fontSize: '12px', color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>
                  Quên mật khẩu?
                </Link>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  id="login-password"
                  type={showPass ? 'text' : 'password'}
                  className="form-input"
                  placeholder="Nhập mật khẩu"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  style={{ paddingRight: '40px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  style={{
                    position: 'absolute', right: '10px', top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none', border: 'none',
                    color: 'var(--text-muted)', cursor: 'pointer',
                    display: 'flex',
                  }}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              id="login-submit"
              type="submit"
              className="btn btn--primary btn--full btn--lg"
              disabled={isLoading}
              style={{ marginTop: '8px' }}
            >
              {isLoading ? <span className="spinner" /> : 'Đăng nhập'}
              {!isLoading && <ArrowRight size={16} />}
            </button>
          </form>
        </div>

        {/* Demo Helper text */}
        <div style={{
          marginTop: '20px', padding: '12px 14px',
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: '10px', fontSize: '12px', color: 'var(--text-muted)',
          textAlign: 'center'
        }}>
          <strong style={{ color: 'var(--text-secondary)' }}>Tài khoản Admin mặc định:</strong>{' '}
          admin@etoffice.vn / Admin@123
        </div>
      </div>
    </div>
  );
}
