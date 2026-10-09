// client/src/components/expenses/FundDepositModal.jsx
// Modal Ghi Nhận Đợt Sếp Rót Tiền Vào Sổ Quỹ Tạm Ứng

import { useState } from 'react';
import { X, Plus, Wallet } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';

export default function FundDepositModal({ isOpen, onClose, staffList = [], onSuccess, formatVND }) {
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
  const [date, setDate] = useState(todayStr);
  const [amountStr, setAmountStr] = useState('');
  const [senderName, setSenderName] = useState('Ban Giám Đốc / Sếp');
  const [holderId, setHolderId] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    const cleanAmount = Number(String(amountStr).replace(/\D/g, ''));
    if (!cleanAmount || cleanAmount <= 0) {
      toast.error('Vui lòng nhập số tiền hợp lệ (> 0 VNĐ)');
      return;
    }
    if (!holderId) {
      toast.error('Vui lòng chọn người giữ quỹ');
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await api.post('/funds', {
        date,
        amount: cleanAmount,
        sender_name: senderName.trim() || 'Ban Giám Đốc / Sếp',
        holder_id: holderId,
        note: note.trim() || null,
      });

      toast.success(data.message || 'Đã ghi nhận nạp quỹ thành công! 💵');
      setAmountStr('');
      setNote('');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Lỗi ghi nhận nạp quỹ');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 999999, padding: '16px' }}>
      <div
        className="modal-card animate-scale-up"
        style={{ maxWidth: '440px', width: '100%', padding: '22px' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--primary-soft)', display: 'grid', placeItems: 'center', color: 'var(--primary)' }}>
              <Wallet size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '15.5px', fontWeight: 800, margin: 0, color: 'var(--text)' }}>
                Ghi Nhận Sếp Cấp Quỹ Tạm Ứng
              </h3>
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Cộng tiền vào sổ quỹ xoay vòng công ty</div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="btn btn--ghost" style={{ padding: '4px 8px' }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text)', marginBottom: '5px' }}>
              Ngày nhận tiền *
            </label>
            <input
              type="date"
              className="form-input"
              value={date}
              onChange={e => setDate(e.target.value)}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text)', marginBottom: '5px' }}>
              Số tiền Sếp rót (VNĐ) *
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="VD: 10,000,000"
              value={amountStr}
              onChange={e => {
                const val = e.target.value.replace(/\D/g, '');
                setAmountStr(val ? Number(val).toLocaleString('vi-VN') : '');
              }}
              autoFocus
              required
            />
            {amountStr && (
              <div style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 700, marginTop: '4px' }}>
                💰 Bằng chữ: {formatVND(Number(String(amountStr).replace(/\D/g, '')))}
              </div>
            )}
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text)', marginBottom: '5px' }}>
              Người giữ quỹ (Thụ hưởng / Cầm tiền) *
            </label>
            <select
              className="form-input"
              value={holderId}
              onChange={e => setHolderId(e.target.value)}
              required
            >
              <option value="">-- Chọn nhân sự giữ quỹ --</option>
              {staffList
                .filter(s => s.employment_status !== 'resigned' && s.employment_status !== 'Đã nghỉ việc')
                .map(s => (
                  <option key={s._id || s.id} value={String(s._id || s.id)}>
                    {s.full_name} ({s.position || s.role || 'NV'})
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text)', marginBottom: '5px' }}>
              Nguồn tiền / Người cấp
            </label>
            <input
              type="text"
              className="form-input"
              value={senderName}
              onChange={e => setSenderName(e.target.value)}
              placeholder="VD: Ban Giám Đốc / Sếp / Kế toán"
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text)', marginBottom: '5px' }}>
              Ghi chú đợt cấp
            </label>
            <textarea
              className="form-input"
              rows={2}
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="VD: Tạm ứng đợt 1 T10 chi tiêu văn phòng, liên hoan..."
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '6px' }}>
            <button type="button" onClick={onClose} className="btn btn--ghost" style={{ fontSize: '12.5px', padding: '7px 14px' }}>
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn btn--primary"
              style={{ fontSize: '12.5px', padding: '7px 18px', fontWeight: 700 }}
            >
              {submitting ? 'Đang lưu...' : 'Ghi Nhận Nạp Quỹ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
