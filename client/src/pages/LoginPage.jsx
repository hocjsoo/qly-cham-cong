// src/pages/LoginPage.jsx
// Trang đăng nhập — Clean, professional, không flashy

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight } from 'lucide-react';
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
      navigate(result.user.role === 'staff' ? '/checkin' : '/dashboard');
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

      <div className="animate-slide-up" style={{ width: '100%', maxWidth: '360px' }}>
        {/* Branding */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{
            width: '48px', height: '48px',
            background: 'var(--primary)',
            borderRadius: '12px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '22px', marginBottom: '20px',
          }}>
            🏗️
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text)', marginBottom: '6px' }}>
            Đăng nhập
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            ET Office Portal — Chấm công thông minh
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email</label>
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

          <div className="form-group" style={{ marginBottom: '24px' }}>
            <label className="form-label">Mật khẩu</label>
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
          >
            {isLoading ? <span className="spinner" /> : 'Đăng nhập'}
            {!isLoading && <ArrowRight size={16} />}
          </button>
        </form>

        {/* Helper text */}
        <div style={{
          marginTop: '24px', padding: '12px',
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: '8px', fontSize: '12px', color: 'var(--text-muted)',
        }}>
          <strong style={{ color: 'var(--text-secondary)' }}>Tài khoản thử:</strong>{' '}
          admin@etoffice.vn / Admin@123
        </div>
      </div>
    </div>
  );
}
