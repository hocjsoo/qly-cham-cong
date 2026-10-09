// client/src/components/expenses/AdvanceFundSummaryCard.jsx
// Widget Hợp Nhất: Sổ Quỹ Tạm Ứng & Tiến Độ Hoàn Ứng Chi Tiêu (Unified Cashflow Overview)

import { Wallet, Plus, History, ArrowDownRight, CheckCircle2, Clock, AlertCircle, CreditCard } from 'lucide-react';

export default function AdvanceFundSummaryCard({
  fundStats,
  summary = {},
  onOpenDepositModal,
  onOpenHistoryModal,
  onFilterPending,
  onFilterPaid,
  onFilterUnpaid,
  currentPaymentFilter,
  currentApprovalFilter,
  formatVND,
  isAdmin = false,
  isFundHolder = false,
}) {
  const totalFundIn = fundStats?.totalFundIn || 0;
  // Tổng tiền đã thanh toán hoàn ứng thực tế cho nhân sự
  const totalPaid = summary.totalPaidAmount || fundStats?.totalFundOut || 0;
  // Tổng tiền đang nợ chưa thanh toán cho nhân sự
  const totalUnpaid = summary.totalUnpaidAmount || 0;
  // Số dư quỹ = Tiền sếp nạp - Tiền đã chi trả
  const fundBalance = totalFundIn - totalPaid;
  const isPositive = fundBalance >= 0;

  const pendingCount = summary.totalPendingCount || 0;
  const pendingAmount = summary.totalPendingAmount || 0;

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
      {/* Top Header Toolbar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '14px',
          borderBottom: '1px solid var(--border-muted)',
          paddingBottom: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'var(--primary-soft)',
              display: 'grid',
              placeItems: 'center',
              color: 'var(--primary)',
            }}
          >
            <Wallet size={17} />
          </div>
          <div>
            <div style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Sổ Quỹ & Quyết Toán Chi Tiêu
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Theo dõi ngân sách Sếp cấp, đối soát hoàn ứng & cân đối số dư
            </div>
          </div>

          {/* Badge Chờ Duyệt Chi (Nút lọc nhanh nếu có khoản pending) */}
          {pendingCount > 0 && (
            <button
              type="button"
              onClick={onFilterPending}
              className="badge card--interactive"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 10px',
                fontSize: '11.5px',
                fontWeight: 700,
                background: currentApprovalFilter === 'pending' ? 'var(--yellow)' : 'var(--yellow-soft)',
                color: currentApprovalFilter === 'pending' ? '#000' : 'var(--yellow)',
                border: '1px solid var(--yellow)',
                cursor: 'pointer',
                borderRadius: '20px',
              }}
              title="Bấm để lọc các khoản đang chờ phê duyệt"
            >
              <Clock size={12} /> {pendingCount} khoản chờ duyệt ({formatVND(pendingAmount)})
            </button>
          )}
        </div>

        {/* Nút thao tác Quỹ */}
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

      {/* Grid 4 Chỉ Số Dòng Tiền Duy Nhất */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '12px' }}>
        {/* Ô 1: Sếp Rót Quỹ */}
        <div style={{ background: 'var(--bg-input)', padding: '12px 14px', borderRadius: '10px', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            <ArrowDownRight size={14} color="var(--primary)" />
            1. Tiền Sếp Cấp Quỹ
          </div>
          <div style={{ fontSize: '19px', fontWeight: 900, color: 'var(--primary)', marginTop: '4px', fontVariantNumeric: 'tabular-nums' }}>
            {formatVND(totalFundIn)}
          </div>
          <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Tổng ngân sách đã rót vào quỹ
          </div>
        </div>

        {/* Ô 2: Đã Chi Trả Hoàn Ứng (Click để lọc) */}
        <div
          onClick={onFilterPaid}
          className="card--interactive"
          style={{
            background: currentPaymentFilter === 'paid' ? 'var(--green-soft)' : 'var(--bg-input)',
            padding: '12px 14px',
            borderRadius: '10px',
            border: currentPaymentFilter === 'paid' ? '1.5px solid var(--green)' : '1px solid var(--border)',
            cursor: 'pointer',
          }}
          title="Bấm để lọc danh sách các khoản đã thanh toán xong"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            <CreditCard size={14} color="var(--green)" />
            2. Đã Hoàn Trả Xong
          </div>
          <div style={{ fontSize: '19px', fontWeight: 900, color: 'var(--text)', marginTop: '4px', fontVariantNumeric: 'tabular-nums' }}>
            {formatVND(totalPaid)}
          </div>
          <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Đã chuyển khoản / xuất tiền trả NV
          </div>
        </div>

        {/* Ô 3: Chưa Hoàn Tiền / Còn Nợ (Click để lọc) */}
        <div
          onClick={onFilterUnpaid}
          className="card--interactive"
          style={{
            background: currentPaymentFilter === 'unpaid' ? 'var(--red-soft)' : 'var(--bg-input)',
            padding: '12px 14px',
            borderRadius: '10px',
            border: currentPaymentFilter === 'unpaid' ? '1.5px solid var(--red)' : '1px solid var(--border)',
            cursor: 'pointer',
          }}
          title="Bấm để lọc danh sách các khoản còn nợ cần trả"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            <AlertCircle size={14} color="var(--red)" />
            3. Còn Nợ Chưa Hoàn
          </div>
          <div style={{ fontSize: '19px', fontWeight: 900, color: 'var(--red)', marginTop: '4px', fontVariantNumeric: 'tabular-nums' }}>
            {formatVND(totalUnpaid)}
          </div>
          <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Cần xuất quỹ thanh toán
          </div>
        </div>

        {/* Ô 4: Số Dư Quỹ Thực Tế */}
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
            {isPositive ? '4. Số Dư Quỹ Còn Lại' : '4. Công Ty Cần Cấp Bù'}
          </div>
          <div style={{ fontSize: '20px', fontWeight: 900, color: isPositive ? 'var(--green)' : 'var(--red)', marginTop: '4px', fontVariantNumeric: 'tabular-nums' }}>
            {isPositive ? `+ ${formatVND(fundBalance)}` : `- ${formatVND(Math.abs(fundBalance))}`}
          </div>
          <div style={{ fontSize: '10.5px', color: isPositive ? 'var(--green)' : 'var(--red)', marginTop: '2px', fontWeight: 600 }}>
            {isPositive ? '🟢 Quỹ đang dư tiền' : '🔴 Quỹ âm (Cty nợ người giữ quỹ)'}
          </div>
        </div>
      </div>
    </div>
  );
}
