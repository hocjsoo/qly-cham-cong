// client/src/components/staff/StaffFormModal.jsx
// Modal tạo mới hoặc chỉnh sửa hồ sơ nhân sự (đa phòng ban, tài khoản ngân hàng, miễn chấm công)

import { UserPlus, X } from 'lucide-react';
import toast from 'react-hot-toast';

export default function StaffFormModal({
  editing,
  form,
  setForm,
  setShowForm,
  handleSubmit,
  submitting,
  currentUser,
  depts = [],
  setFullAvatarImage,
}) {
  return (
    <div className="modal-overlay" onClick={() => setShowForm(false)}>
      <div
        className="modal-sheet animate-slide-up"
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: '720px',
          width: '95vw',
          maxHeight: '90vh',
          overflowY: 'auto',
          margin: 'auto',
          borderRadius: '16px',
          padding: '22px 26px',
          boxShadow: '0 16px 40px rgba(0,0,0,0.3)',
        }}
      >
        <div className="modal-sheet__handle" />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', borderBottom: '1px solid var(--border-muted)', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--primary-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <UserPlus size={22} color="var(--primary)" />
            </div>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text)', margin: 0 }}>
                {editing ? `Chỉnh Sửa Nhân Viên: ${editing.full_name}` : 'Thêm Nhân Viên Mới'}
              </h3>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {editing ? `Mã định danh: #${editing.employee_code || 'NS'}` : 'Điền đầy đủ thông tin để tạo hồ sơ và cấp tài khoản nhân sự'}
              </div>
            </div>
          </div>
          <button onClick={() => setShowForm(false)} className="btn btn--ghost" style={{ padding: '6px 10px', borderRadius: '8px' }}>
            <X size={20} />
          </button>
        </div>

        {/* Row 1: Full name & Email */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontWeight: 700 }}>Họ và Tên *</label>
            <input type="text" className="form-input" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} placeholder="VD: Nguyễn Văn A" />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontWeight: 700 }}>Email đăng nhập *</label>
            <input type="email" className="form-input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="nva@company.com" disabled={Boolean(editing)} />
          </div>
        </div>

        {/* Row 2: Password & Phone */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontWeight: 700 }}>{editing ? 'Mật khẩu mới (bỏ trống nếu giữ nguyên)' : 'Mật khẩu đăng nhập *'}</label>
            <input type="password" className="form-input" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Tối thiểu 6 ký tự" />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontWeight: 700 }}>Số điện thoại liên hệ</label>
            <input type="text" className="form-input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="VD: 0912345678" />
          </div>
        </div>

        {/* Row 3: DOB & Join Date */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontWeight: 700 }}>🎂 Ngày sinh</label>
            <input type="date" className="form-input" value={form.dob} onChange={e => setForm({ ...form, dob: e.target.value })} onClick={e => e.target.showPicker && e.target.showPicker()} />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontWeight: 700, color: 'var(--primary)' }}>
              📅 Ngày vào công ty
            </label>
            <input
              type="date"
              className="form-input"
              value={form.join_date}
              onChange={e => setForm({ ...form, join_date: e.target.value })}
              onClick={e => e.target.showPicker && e.target.showPicker()}
            />
          </div>
        </div>

        {/* Row 4: Employee code & Position */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontWeight: 700 }}>🏷️ Mã nhân sự / ID (Tùy chọn)</label>
            <input
              type="text"
              className="form-input"
              value={form.employee_code}
              onChange={e => setForm({ ...form, employee_code: e.target.value })}
              placeholder="VD: NS-001, TV-002 (để trống tự sinh)"
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontWeight: 700 }}>👔 Chức vụ / Vị trí</label>
            <input type="text" className="form-input" value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} placeholder="VD: Kiến trúc sư, Kỹ sư MEP..." />
          </div>
        </div>

        {/* Row 5: Employee Type, Employment Status & Role */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontWeight: 700 }}>Loại nhân sự</label>
            <select className="form-select" value={form.employee_type} onChange={e => setForm({ ...form, employee_type: e.target.value })}>
              <option value="NS">NS - Nhân sự chính thức</option>
              <option value="TV">TV - Thử việc</option>
              <option value="TTS">TTS - Thực tập sinh</option>
            </select>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontWeight: 700 }}>Trạng thái làm việc</label>
            <select className="form-select" value={form.employment_status} onChange={e => setForm({ ...form, employment_status: e.target.value })}>
              <option value="Dang lam viec">Đang làm việc</option>
              <option value="Da nghi viec">Đã nghỉ việc</option>
              <option value="Nghi om">Nghỉ ốm</option>
              <option value="Nghi thai san">Nghỉ thai sản</option>
              <option value="Khac">Khác</option>
            </select>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontWeight: 700 }}>Vai trò hệ thống *</label>
            <select className="form-select" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
              <option value="employee">Nhân viên (Employee)</option>
              <option value="leader">Leader (Trưởng nhóm)</option>
              {currentUser?.role === 'admin' && <option value="admin">Admin (Quản trị viên)</option>}
            </select>
          </div>
        </div>

        {/* Row 5b: Cài đặt miễn chấm công */}
        <div style={{ marginBottom: '14px', padding: '12px 14px', background: form.is_attendance_exempt ? 'rgba(99, 102, 241, 0.08)' : 'var(--bg-raised)', borderRadius: '10px', border: form.is_attendance_exempt ? '1px solid var(--primary)' : '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>🛡️ Miễn chấm công hàng ngày</span>
              {form.is_attendance_exempt && <span className="badge badge--primary" style={{ fontSize: '10px' }}>ĐANG BẬT</span>}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Dành cho Ban giám đốc, Admin, nhân sự quản lý đặc thù (không bắt buộc điểm danh GPS / Selfie)
            </div>
          </div>
          <label style={{ position: 'relative', display: 'inline-block', width: '42px', height: '24px', flexShrink: 0, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.is_attendance_exempt || false}
              onChange={e => setForm(f => ({ ...f, is_attendance_exempt: e.target.checked }))}
              style={{ opacity: 0, width: 0, height: 0 }}
            />
            <span style={{
              position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
              background: form.is_attendance_exempt ? 'var(--primary)' : 'var(--border)',
              borderRadius: '24px', transition: '0.2s',
            }}>
              <span style={{
                position: 'absolute', content: '""', height: '18px', width: '18px', left: form.is_attendance_exempt ? '21px' : '3px', bottom: '3px',
                background: '#ffffff', borderRadius: '50%', transition: '0.2s',
              }} />
            </span>
          </label>
        </div>

        {/* Cấu hình tham gia lịch trực nhật */}
        {currentUser?.role === 'admin' && (
          <div className="form-group" style={{ marginBottom: '14px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', border: form.is_duty_exempt ? '1px solid var(--yellow)' : '1px solid var(--border)', borderRadius: '10px', background: form.is_duty_exempt ? 'var(--yellow-soft)' : 'var(--bg-raised)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={Boolean(form.is_duty_exempt)}
                onChange={e => setForm(f => ({ ...f, is_duty_exempt: e.target.checked }))}
              />
              <span>
                <strong style={{ display: 'block', fontSize: '13px' }}>Miễn trực nhật</strong>
                <span style={{ display: 'block', marginTop: '2px', color: 'var(--text-muted)', fontSize: '11px' }}>Người này sẽ được ẩn mặc định khỏi danh sách phân công dọn văn phòng và nhà vệ sinh.</span>
              </span>
            </label>
          </div>
        )}

        {/* Phân quyền lịch trực nhật */}
        {currentUser?.role === 'admin' && (
          <div className="form-group" style={{ marginBottom: '14px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', border: form.can_manage_tts_schedule ? '1px solid var(--primary)' : '1px solid var(--border)', borderRadius: '10px', background: form.can_manage_tts_schedule ? 'var(--primary-soft)' : 'var(--bg-raised)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={Boolean(form.can_manage_tts_schedule)}
                onChange={e => setForm(f => ({ ...f, can_manage_tts_schedule: e.target.checked }))}
              />
              <span>
                <strong style={{ display: 'block', fontSize: '13px' }}>Quyền phân công trực nhật</strong>
                <span style={{ display: 'block', marginTop: '2px', color: 'var(--text-muted)', fontSize: '11px' }}>Chỉ được xếp người dọn văn phòng và nhà vệ sinh, không được sửa lịch đăng ký TTS hoặc các quyền Admin khác.</span>
              </span>
            </label>
          </div>
        )}

        {/* Row 6: Avatar upload */}
        <div className="form-group" style={{ marginBottom: '14px' }}>
          <label className="form-label" style={{ fontWeight: 700 }}>Ảnh đại diện (Avatar)</label>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', background: 'var(--bg-raised)', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border)' }}>
            <label className="btn btn--primary" style={{ cursor: 'pointer', padding: '8px 14px', fontSize: '12.5px', whiteSpace: 'nowrap' }}>
              📸 Chọn ảnh từ thiết bị
              <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
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
                    setForm(p => ({ ...p, avatar_url: base64 }));
                    toast.success('Đã tải ảnh lên thành công!');
                  } catch {
                    toast.error('Lỗi xử lý file ảnh');
                  }
                }}
              />
            </label>
            {form.avatar_url ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <img
                  src={form.avatar_url}
                  alt="avatar"
                  onClick={() => setFullAvatarImage({ url: form.avatar_url, title: form.full_name || 'Ảnh đại diện' })}
                  title="Click để phóng to ảnh"
                  style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--primary)', cursor: 'zoom-in' }}
                />
                <button type="button" onClick={() => setForm({ ...form, avatar_url: '' })} className="btn btn--ghost" style={{ padding: '4px 8px', fontSize: '11px', color: 'var(--red)' }}>Xóa ảnh</button>
              </div>
            ) : (
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Chưa có ảnh (sẽ dùng avatar chữ cái mặc định)</span>
            )}
          </div>
        </div>

        {/* Row 7: Multi-Department Selection */}
        <div className="form-group" style={{ marginBottom: '14px' }}>
          <label className="form-label" style={{ fontWeight: 700 }}>🏢 Phòng ban phụ trách * (Có thể chọn nhiều phòng ban)</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '8px', background: 'var(--bg-raised)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border)' }}>
            {depts.map(d => {
              const checked = (form.department_ids || []).includes(d._id);
              return (
                <label key={d._id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: 'var(--text)', padding: '4px 6px', borderRadius: '6px', background: checked ? 'var(--primary-soft)' : 'transparent' }}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={e => {
                      let updated = [...(form.department_ids || [])];
                      if (e.target.checked) {
                        if (!updated.includes(d._id)) updated.push(d._id);
                      } else {
                        updated = updated.filter(id => id !== d._id);
                      }
                      setForm({ ...form, department_ids: updated, department_id: updated[0] || '' });
                    }}
                  />
                  <span style={{ fontWeight: checked ? 700 : 500 }}>{d.name}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Thông tin tài khoản ngân hàng — dữ liệu bảo mật, chỉ Admin quản lý */}
        {currentUser?.role === 'admin' && (
          <div style={{ background: 'var(--bg-raised)', padding: '14px', borderRadius: '12px', border: '1px solid var(--border)', marginBottom: '18px' }}>
            <div style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--primary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>🏦 Thông tin tài khoản ngân hàng</span>
            </div>
            <div style={{ marginBottom: '10px', color: 'var(--text-muted)', fontSize: '10px' }}>Thông tin bảo mật, chỉ Admin được xem và chỉnh sửa. Chủ tài khoản theo họ tên nhân sự.</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '12px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontWeight: 700 }}>Ngân hàng</label>
                <input
                  type="text"
                  className="form-input"
                  list="staff-bank-options"
                  value={form.bank_name || ''}
                  onChange={e => setForm({ ...form, bank_name: e.target.value })}
                  placeholder="VD: Vietcombank"
                  autoComplete="off"
                />
                <datalist id="staff-bank-options">
                  {['Vietcombank', 'BIDV', 'VietinBank', 'Agribank', 'Techcombank', 'MB Bank', 'ACB', 'VPBank', 'TPBank', 'Sacombank'].map(bank => <option value={bank} key={bank} />)}
                </datalist>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontWeight: 700 }}>Số tài khoản</label>
                <input
                  type="text"
                  inputMode="numeric"
                  className="form-input"
                  value={form.bank_account || ''}
                  onChange={e => setForm({ ...form, bank_account: e.target.value.replace(/\s/g, '') })}
                  placeholder="Nhập số tài khoản"
                  autoComplete="off"
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontWeight: 700 }}>Chi nhánh</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.branch || ''}
                  onChange={e => setForm({ ...form, branch: e.target.value })}
                  placeholder="VD: Hà Nội"
                  autoComplete="off"
                />
              </div>
            </div>
          </div>
        )}

        {/* Row 8: Phương Tiện & Gửi Xe */}
        <div style={{ background: 'var(--bg-raised)', padding: '14px', borderRadius: '12px', border: '1px solid var(--border)', marginBottom: '18px' }}>
          <div style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--primary)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>🛵 Phương Tiện & Địa Điểm Gửi Xe</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontWeight: 700 }}>🏢 Địa điểm gửi xe</label>
              <input
                type="text"
                className="form-input"
                value={form.parking_location}
                onChange={e => setForm({ ...form, parking_location: e.target.value })}
                placeholder="VD: Tòa 17T10 Nguyễn Thị Định"
              />
              <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                {['Tòa 17T10 Nguyễn Thị Định', 'Gửi ngoài', 'Không gửi xe'].map(loc => (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => setForm({ ...form, parking_location: loc })}
                    className="btn btn--ghost"
                    style={{
                      fontSize: '11px',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      background: form.parking_location === loc ? 'var(--primary-soft)' : 'transparent',
                      color: form.parking_location === loc ? 'var(--primary)' : 'var(--text-muted)',
                      borderColor: form.parking_location === loc ? 'var(--primary)' : 'var(--border)',
                    }}
                  >
                    {loc.split(' ')[0]} {loc.split(' ')[1] || ''}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontWeight: 700 }}>🛵 Mô tả xe & Biển số</label>
              <input
                type="text"
                className="form-input"
                value={form.vehicle_info}
                onChange={e => setForm({ ...form, vehicle_info: e.target.value })}
                placeholder="VD: Honda Lead Đỏ - 29E1-456.78"
              />
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            type="button"
            onClick={() => setShowForm(false)}
            className="btn btn--ghost"
            style={{ flex: 1, padding: '10px', fontSize: '13px', fontWeight: 700 }}
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="btn btn--primary"
            style={{ flex: 2, padding: '10px', fontSize: '13px', fontWeight: 800 }}
          >
            {submitting ? <span className="spinner" /> : editing ? '💾 Lưu thay đổi nhân viên' : '🚀 Tạo tài khoản nhân viên'}
          </button>
        </div>
      </div>
    </div>
  );
}
