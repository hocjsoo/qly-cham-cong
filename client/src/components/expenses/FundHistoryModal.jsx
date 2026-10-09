// client/src/components/expenses/FundHistoryModal.jsx
// Modal Lịch Sử Các Đợt Sếp Cấp Quỹ Tạm Ứng

import { useState } from 'react';
import { X, Trash2, Wallet, Calendar, UserCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';

export default function FundHistoryModal({ isOpen, onClose, funds = [], isAdmin = false, onSuccess, formatVND, formatDate }) {
  const [deletingId, setDeletingId] = useState(null);

  if (!isOpen) return null;

  const handleDelete = async (id) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa đợt nạp quỹ này?')) return;
    setDeletingId(id);
    try {
      await api.delete(`/funds/${id}`);
      toast.success('Đã xóa đợt nạp quỹ! 🗑️');
      if (onSuccess) onSuccess();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Lỗi xóa đợt nạp quỹ');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 999999, padding: '16px' }}>
      <div
        className="modal-card animate-scale-up"
        style={{ maxWidth: '680px', width: '100%', padding: '22px' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--primary-soft)', display: 'grid', placeItems: 'center', color: 'var(--primary)' }}>
              <Wallet size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: 'var(--text)' }}>
                Lịch Sử Các Đợt Sếp Cấp Quỹ
              </h3>
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Tổng cộng {funds.length} đợt rót ngân sách</div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="btn btn--ghost" style={{ padding: '4px 8px' }}>
            <X size={16} />
          </button>
        </div>

        {funds.length === 0 ? (
          <div style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
            Chưa có đợt nạp tiền quỹ nào được ghi nhận. Bấm "Nạp Quỹ" để ghi nhận đợt đầu tiên.
          </div>
        ) : (
          <div style={{ overflowX: 'auto', maxHeight: '420px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--bg-raised)', borderBottom: '1px solid var(--border)', color: 'var(--text)', fontWeight: 800 }}>
                  <th style={{ padding: '9px 12px', width: '40px', textAlign: 'center' }}>STT</th>
                  <th style={{ padding: '9px 12px', width: '90px' }}>NGÀY</th>
                  <th style={{ padding: '9px 12px', width: '120px' }}>NGƯỜI RÓT</th>
                  <th style={{ padding: '9px 12px', width: '140px' }}>NGƯỜI GIỮ QUỸ</th>
                  <th style={{ padding: '9px 12px', width: '120px', textAlign: 'right' }}>SỐ TIỀN</th>
                  <th style={{ padding: '9px 12px' }}>GHI CHÚ</th>
                  {isAdmin && <th style={{ padding: '9px 12px', width: '50px', textAlign: 'center' }}>XÓA</th>}
                </tr>
              </thead>
              <tbody>
                {funds.map((f, idx) => (
                  <tr key={f._id || idx} style={{ borderBottom: '1px solid var(--border-muted)', background: idx % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-raised)' }}>
                    <td style={{ padding: '9px 12px', textAlign: 'center', color: 'var(--text-muted)' }}>{idx + 1}</td>
                    <td style={{ padding: '9px 12px', fontWeight: 600 }}>{formatDate(f.date)}</td>
                    <td style={{ padding: '9px 12px', color: 'var(--text-secondary)' }}>{f.sender_name || 'Ban Giám Đốc'}</td>
                    <td style={{ padding: '9px 12px' }}>
                      <strong style={{ color: 'var(--text)' }}>{f.holder_id?.full_name || '—'}</strong>
                      {f.holder_id?.employee_code && <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginLeft: '4px' }}>({f.holder_id.employee_code})</span>}
                    </td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 800, color: 'var(--primary)', fontVariantNumeric: 'tabular-nums' }}>
                      {formatVND(f.amount)}
                    </td>
                    <td style={{ padding: '9px 12px', color: 'var(--text-secondary)', fontSize: '11.5px' }}>
                      {f.note || '—'}
                    </td>
                    {isAdmin && (
                      <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleDelete(f._id)}
                          disabled={deletingId === f._id}
                          className="btn btn--ghost"
                          style={{ padding: '3px 6px', color: 'var(--red)', fontSize: '11px' }}
                          title="Xóa đợt nạp quỹ này"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
          <button type="button" onClick={onClose} className="btn btn--primary" style={{ fontSize: '12.5px', padding: '7px 18px' }}>
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
