// client/src/components/staff/StaffDetailModal.jsx
// Modal xem chi tiết hồ sơ nhân sự & Quản lý thiết bị chính chủ (Chống chấm công hộ)

import { X } from 'lucide-react';

export default function StaffDetailModal({
  viewingStaffDetail,
  setViewingStaffDetail,
  setFullAvatarImage,
  depts = [],
  isAdmin = false,
  userDevices,
  loadingDevices,
  handleSetTrustDevice,
  handleDeleteUserDevice,
  openEdit,
}) {
  if (!viewingStaffDetail) return null;

  return (
    <div className="modal-overlay" onClick={() => setViewingStaffDetail(null)}>
      <div className="modal-sheet animate-slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px', margin: '0 auto', padding: '20px 18px' }}>
        <div className="modal-sheet__handle" />

        {/* Title Header Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: 'var(--text)' }}>👤 Hồ Sơ Nhân Viên</h3>
          <button onClick={() => setViewingStaffDetail(null)} className="btn btn--ghost" style={{ padding: '4px 8px' }}><X size={18} /></button>
        </div>

        {/* Avatar Header Section */}
        <div style={{ textAlign: 'center', marginTop: '10px', marginBottom: '20px', clear: 'both' }}>
          <div
            style={{
              width: '96px', height: '96px', margin: '0 auto 12px',
              borderRadius: '50%', border: '4px solid var(--primary)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.25)', overflow: 'hidden',
              display: 'block', background: 'var(--bg-raised)',
              cursor: viewingStaffDetail.avatar_url ? 'zoom-in' : 'default',
            }}
            onClick={() => {
              if (viewingStaffDetail.avatar_url) {
                setFullAvatarImage({ url: viewingStaffDetail.avatar_url, title: viewingStaffDetail.full_name });
              }
            }}
            title={viewingStaffDetail.avatar_url ? 'Click để xem ảnh lớn' : ''}
          >
            <img
              src={viewingStaffDetail.avatar_url || '/logo.png'}
              alt={viewingStaffDetail.full_name}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              onError={e => { e.target.src = '/logo.png'; }}
            />
          </div>

          <h2 style={{ fontSize: '18px', fontWeight: 800, marginTop: '6px', marginBottom: '2px', color: 'var(--text)' }}>{viewingStaffDetail.full_name}</h2>
          <div style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 700 }}>#{viewingStaffDetail.employee_code || 'NS-000'}</div>
        </div>

        {/* Information Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '18px' }}>
          <div style={{ background: 'var(--bg-input)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px' }}>
            <span style={{ color: 'var(--text-muted)' }}>Email: </span>
            <strong>{viewingStaffDetail.email}</strong>
          </div>
          <div style={{ background: 'var(--bg-input)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px' }}>
            <span style={{ color: 'var(--text-muted)' }}>Số điện thoại: </span>
            <strong>{viewingStaffDetail.phone || 'Chưa cập nhật'}</strong>
          </div>
          <div style={{ background: 'var(--bg-input)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px' }}>
            <span style={{ color: 'var(--text-muted)' }}>Phòng ban: </span>
            <strong>{viewingStaffDetail.department_name || depts.find(d => d._id === viewingStaffDetail.department_id)?.name || 'Chưa phân'}</strong>
          </div>
          <div style={{ background: 'var(--bg-input)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px' }}>
            <span style={{ color: 'var(--text-muted)' }}>Chức danh: </span>
            <strong>{viewingStaffDetail.position || 'Nhân viên'}</strong>
          </div>
          <div style={{ background: 'var(--bg-input)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px' }}>
            <span style={{ color: 'var(--text-muted)' }}>📅 Ngày vào công ty: </span>
            <strong style={{ color: 'var(--primary)' }}>
              {viewingStaffDetail.join_date ? viewingStaffDetail.join_date : (viewingStaffDetail.start_year ? `Năm ${viewingStaffDetail.start_year}` : 'Chưa cập nhật')}
            </strong>
          </div>
          <div style={{ background: 'var(--bg-input)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px' }}>
            <span style={{ color: 'var(--text-muted)' }}>Trạng thái làm việc: </span>
            <strong style={{ color: 'var(--green)' }}>{viewingStaffDetail.employment_status || 'Đang làm việc'}</strong>
          </div>
          <div style={{ background: 'var(--bg-input)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px' }}>
            <span style={{ color: 'var(--text-muted)' }}>⏱️ Chế độ chấm công: </span>
            <strong style={{ color: viewingStaffDetail.is_attendance_exempt ? '#8b5cf6' : 'var(--primary)' }}>
              {viewingStaffDetail.is_attendance_exempt ? '🛡️ Miễn chấm công (Không bắt buộc điểm danh)' : 'Bắt buộc chấm công GPS / Selfie'}
            </strong>
          </div>
          <div style={{ background: 'var(--bg-input)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px' }}>
            <span style={{ color: 'var(--text-muted)' }}>🏢 Địa điểm gửi xe: </span>
            <strong style={{ color: 'var(--primary)' }}>{viewingStaffDetail.parking_location || 'Tòa 17T10 Nguyễn Thị Định'}</strong>
          </div>
          <div style={{ background: 'var(--bg-input)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px' }}>
            <span style={{ color: 'var(--text-muted)' }}>🛵 Mô tả xe & Biển số: </span>
            <strong style={{ color: 'var(--text)' }}>{viewingStaffDetail.vehicle_info || viewingStaffDetail.license_plate || 'Chưa cập nhật'}</strong>
          </div>
        </div>

        {(viewingStaffDetail.bank_name || viewingStaffDetail.bank_account || viewingStaffDetail.branch) && (
          <div style={{ marginBottom: '18px', padding: '12px', border: '1px solid var(--border)', borderRadius: '10px', background: 'var(--bg-raised)' }}>
            <div style={{ marginBottom: '8px', color: 'var(--primary)', fontSize: '13px', fontWeight: 800 }}>🏦 Tài khoản ngân hàng</div>
            <div style={{ display: 'grid', gap: '6px', fontSize: '12px' }}>
              <div><span style={{ color: 'var(--text-muted)' }}>Ngân hàng: </span><strong>{viewingStaffDetail.bank_name || 'Chưa cập nhật'}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Số tài khoản: </span><strong style={{ color: 'var(--primary)', fontVariantNumeric: 'tabular-nums' }}>{viewingStaffDetail.bank_account || 'Chưa cập nhật'}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Chi nhánh: </span><strong>{viewingStaffDetail.branch || 'Chưa cập nhật'}</strong></div>
            </div>
          </div>
        )}

        {/* Devices Section — CHỈ ADMIN MỚI XEM ĐƯỢC THIẾT BỊ (Chống chấm hộ & Thiết bị chính) */}
        {isAdmin && (
          <div style={{ marginTop: '14px', marginBottom: '18px', borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
            <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text)', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>📱 Thiết bị đã đăng ký ({userDevices?.sessions?.length || 0})</span>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Chống chấm công hộ (Admin Only)</span>
            </div>

            {loadingDevices ? (
              <div style={{ textAlign: 'center', padding: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
                Đang kiểm tra thiết bị...
              </div>
            ) : !userDevices?.sessions || userDevices.sessions.length === 0 ? (
              <div style={{ background: 'var(--bg-input)', padding: '10px', borderRadius: '8px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
                Chưa đăng ký thiết bị chính chủ nào.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {userDevices.sessions.map((sess) => (
                  <div key={sess._id} style={{
                    background: sess.is_trusted ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg-input)',
                    border: sess.is_trusted ? '1.5px solid var(--green)' : '1px solid var(--border)',
                    borderRadius: '10px', padding: '10px 12px', fontSize: '12px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <strong style={{ color: 'var(--text)', fontSize: '13px' }}>
                        {sess.device_name ? sess.device_name : '💻 Thiết bị phần cứng'}
                      </strong>
                      {sess.is_trusted ? (
                        <span className="badge badge--success" style={{ fontSize: '10px', fontWeight: 800 }}>⭐ MÁY CHÍNH CHỦ</span>
                      ) : (
                        <span className="badge badge--warning" style={{ fontSize: '10px', fontWeight: 700 }}>⚠️ Thiết bị phụ</span>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '11px', color: 'var(--text-secondary)', background: 'var(--bg-card)', padding: '6px 8px', borderRadius: '6px', marginBottom: '8px', border: '1px solid var(--border-muted)' }}>
                      <div><strong>🔑 Mã vân tay (ID):</strong> <code style={{ fontSize: '10px', color: 'var(--primary)' }}>{sess.device_fingerprint ? sess.device_fingerprint.slice(0, 16) + '...' : '—'}</code></div>
                      {sess.screen_info && <div><strong>🖥️ Màn hình:</strong> {sess.screen_info} px</div>}
                      <div><strong>🕒 Check-in lần cuối:</strong> {new Date(sess.last_used_at).toLocaleString('vi-VN')} ({sess.check_in_count || 1} lần điểm danh)</div>
                    </div>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      {!sess.is_trusted && (
                        <button
                          onClick={() => handleSetTrustDevice(viewingStaffDetail._id, sess._id)}
                          className="btn btn--ghost"
                          style={{ padding: '4px 10px', fontSize: '11px', color: 'var(--green)', borderColor: 'var(--green)', fontWeight: 700 }}
                        >
                          ⭐ Đặt làm máy chính
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteUserDevice(viewingStaffDetail._id, sess._id)}
                        className="btn btn--ghost"
                        style={{ padding: '4px 10px', fontSize: '11px', color: 'var(--red)', borderColor: 'var(--red)' }}
                      >
                        🗑️ Xóa thiết bị này
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setViewingStaffDetail(null)} className="btn btn--ghost btn--full">Đóng</button>
          {isAdmin && (
            <button
              onClick={() => {
                const target = viewingStaffDetail;
                setViewingStaffDetail(null);
                openEdit(target);
              }}
              className="btn btn--primary btn--full"
            >
              Chỉnh sửa
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
