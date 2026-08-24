// src/components/ErrorBoundary.jsx
// Error Boundary bắt lỗi runtime UI, ngăn chặn trắng trang và cho phép người dùng thử lại an toàn

import { Component } from 'react';
import { AlertTriangle, RefreshCw, Home, ChevronDown, ChevronUp } from 'lucide-react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null, showDetails: false });
    if (this.props.onReset) {
      this.props.onReset();
    } else {
      window.location.reload();
    }
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div style={{
          minHeight: '70vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}>
          <div className="card animate-fade-in" style={{
            maxWidth: '520px',
            width: '100%',
            padding: '32px 24px',
            textAlign: 'center',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            boxShadow: 'var(--shadow-lg)',
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'var(--red-soft, rgba(239, 68, 68, 0.12))',
              color: 'var(--red, #ef4444)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 18px',
            }}>
              <AlertTriangle size={32} strokeWidth={2.2} />
            </div>

            <h2 style={{
              fontSize: '20px',
              fontWeight: 800,
              color: 'var(--text)',
              marginBottom: '8px',
              letterSpacing: '-0.3px',
            }}>
              Trang Gặp Sự Cố Không Mong Muốn
            </h2>

            <p style={{
              fontSize: '13.5px',
              color: 'var(--text-secondary)',
              lineHeight: 1.6,
              marginBottom: '24px',
            }}>
              Hệ thống vừa phát hiện lỗi giao diện tại trang này. Bạn có thể bấm Thử lại hoặc quay về Trang chủ.
            </p>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={this.handleReset}
                className="btn btn--primary"
                style={{
                  padding: '10px 18px',
                  fontSize: '13px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                }}
              >
                <RefreshCw size={16} /> Thử lại / Tải lại
              </button>

              <button
                onClick={this.handleGoHome}
                className="btn btn--ghost"
                style={{
                  padding: '10px 18px',
                  fontSize: '13px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                }}
              >
                <Home size={16} /> Về trang chủ
              </button>
            </div>

            {/* Error Technical Details Accordion */}
            {this.state.error && (
              <div style={{ marginTop: '24px', textAlign: 'left' }}>
                <button
                  onClick={() => this.setState(prev => ({ showDetails: !prev.showDetails }))}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 0',
                    margin: '0 auto',
                  }}
                >
                  {this.state.showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  {this.state.showDetails ? 'Ẩn chi tiết lỗi' : 'Xem thông tin lỗi kỹ thuật'}
                </button>

                {this.state.showDetails && (
                  <div style={{
                    marginTop: '10px',
                    padding: '12px',
                    borderRadius: '8px',
                    background: 'var(--bg-raised, #1e293b)',
                    color: 'var(--text, #f8fafc)',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    overflowX: 'auto',
                    maxHeight: '180px',
                    border: '1px solid var(--border)',
                  }}>
                    <strong style={{ color: 'var(--red, #ef4444)' }}>
                      {this.state.error.toString()}
                    </strong>
                    {this.state.errorInfo?.componentStack && (
                      <pre style={{ margin: '8px 0 0', whiteSpace: 'pre-wrap', opacity: 0.8 }}>
                        {this.state.errorInfo.componentStack}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
