// client/src/components/expenses/AdvanceFundSummaryCard.jsx
// Widget Thanh Tóm Tắt Sổ Quỹ Tạm Ứng Xoay Vòng (Petty Cash Flow)

import { Wallet, Plus, History, ArrowDownRight, ArrowUpRight, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function AdvanceFundSummaryCard({
  fundStats,
  onOpenDepositModal,
  onOpenHistoryModal,
  formatVND,
  isAdmin = false,
  isFundHolder = false,
}) {
  if (!fundStats) return null;

  const { totalFundIn = 0, totalFundOut = 0, fundBalance = 0, paidFundCount = 0 } = fundStats;
  const isPositive = fundBalance >= 0;

  return (
    <div
      className="card animate-fade-in"
      style={{
        padding: '16px 20px',
        marginBottom: '16px',
        borderRadius: '14px',
        background: 'linear-gradient(135deg, var(--bg-card) 0%, color-mix(in srgb, var(--primary) 4%, var(--bg-card)) 100%)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-xs)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '14px', borderBottom: '1px solid var(--border-muted)', paddingBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--primary-soft)', display: 'grid', placeItems: 'center', color: 'var(--primary)' }}>
            <Wallet size={17} />
          </div>
          <div>
            <div style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Sổ Quỹ Tạm Ứng Xoay Vòng
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Theo dõi tiền Sếp rót & các khoản xuất chi tiền mặt / chuyển khoản
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {(isAdmin || isFundHolder) && (
            <button
              type="button"
              onClick={onOpenDepositModal}
              className="btn btn--primary"
              style={{ padding: '6px 12px', fontSize: '12px', fontWeight: 700, gap: '5px' }}
              title="Ghi nhận đợt Sếp cấp thêm ngân sách vào quỹ"
            >
              <Plus size={14} /> Nạp Quỹ
            </button>
          )}
          <button
            type="button"
            onClick={onOpenHistoryModal}
            className="btn btn--ghost"
            style={{ padding: '6px 12px', fontSize: '12px', gap: '5px' }}
            title="Xem danh sách chi tiết các đợt nạp tiền quỹ"
          >
            <History size={14} /> Lịch Sử Nạp Quỹ
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
        {/* Metric 1: Tiền Sếp Cấp */}
        <div style={{ background: 'var(--bg-input)', padding: '12px 14px', borderRadius: '10px', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            <ArrowDownRight size={14} color="var(--primary)" />
            Tổng Tiền Sếp Đã Cấp
          </div>
          <div style={{ fontSize: '19px', fontWeight: 900, color: 'var(--primary)', marginTop: '4px', fontVariantNumeric: 'tabular-nums' }}>
            {formatVND(totalFundIn)}
          </div>
          <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Toàn bộ ngân sách đã rót vào quỹ
          </div>
        </div>

        {/* Metric 2: Đã Xuất Chi */}
        <div style={{ background: 'var(--bg-input)', padding: '12px 14px', borderRadius: '10px', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            <ArrowUpRight size={14} color="var(--yellow)" />
            Đã Xuất Quỹ Trả
          </div>
          <div style={{ fontSize: '19px', fontWeight: 900, color: 'var(--text)', marginTop: '4px', fontVariantNumeric: 'tabular-nums' }}>
            {formatVND(totalFundOut)}
          </div>
          <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
            {paidFundCount} khoản chi đã hoàn trả
          </div>
        </div>

        {/* Metric 3: Số Dư Quỹ Hiện Còn */}
        <div
          style={{
            background: isPositive ? 'var(--green-soft)' : 'var(--red-soft)',
            padding: '12px 14px',
            borderRadius: '10px',
            border: `1.5px solid ${isPositive ? 'var(--green)' : 'var(--red)'}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 800, color: isPositive ? 'var(--green)' : 'var(--red)', textTransform: 'uppercase' }}>
            {isPositive ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
            {isPositive ? 'Số Dư Quỹ Hiện Còn' : 'Công Ty Cần Cấp Bù'}
          </div>
          <div style={{ fontSize: '20px', fontWeight: 900, color: isPositive ? 'var(--green)' : 'var(--red)', marginTop: '4px', fontVariantNumeric: 'tabular-nums' }}>
            {isPositive ? `+ ${formatVND(fundBalance)}` : `- ${formatVND(Math.abs(fundBalance))}`}
          </div>
          <div style={{ fontSize: '10.5px', color: isPositive ? 'var(--green)' : 'var(--red)', marginTop: '2px', fontWeight: 600 }}>
            {isPositive ? '🟢 Đang dư quỹ, sẵn sàng xuất chi tiếp' : '🔴 Quỹ đang âm (Cty nợ người giữ quỹ)'}
          </div>
        </div>
      </div>
    </div>
  );
}
