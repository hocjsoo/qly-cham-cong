// client/src/components/expenses/AdvanceFundSummaryCard.jsx
// Widget Hợp Nhất: Sổ Quỹ Tạm Ứng & Tiến Độ Hoàn Ứng Chi Tiêu (Đồng Bộ Chính Xác Theo Mốc Thời Gian & Bộ Lọc)

import { Wallet, Plus, History, ArrowDownRight, CheckCircle2, Clock, AlertCircle, CreditCard, Filter } from 'lucide-react';

export default function AdvanceFundSummaryCard({
  fundStats,
  summary = {},
  filterMonth = 'all',
  filterYear = 'all',
  filterUser = 'all',
  staffList = [],
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
  const isMonthFiltered = filterMonth && filterMonth !== 'all';
  const isUserFiltered = filterUser && filterUser !== 'all';

  const selectedStaff = isUserFiltered ? staffList.find(s => String(s._id || s.id) === String(filterUser)) : null;

  // Nhãn thời gian đang lọc
  let timeLabel = 'Toàn bộ';
  if (isMonthFiltered) {
    timeLabel = `Tháng ${filterMonth}/${filterYear && filterYear !== 'all' ? filterYear : new Date().getFullYear()}`;
  } else if (filterYear && filterYear !== 'all') {
    timeLabel = `Năm ${filterYear}`;
  }

  // 1. Tiền Sếp cấp: nếu đang lọc theo tháng cụ thể thì hiển thị số tiền cấp trong tháng đó, kèm chú thích lũy kế
  const totalFundInGlobal = fundStats?.totalFundIn || 0;
  const fundInDisplay = isMonthFiltered ? (fundStats?.periodFundIn || 0) : totalFundInGlobal;

  // 2. Đã hoàn trả: lấy trực tiếp từ summary theo kỳ lọc
  const totalPaid = summary.totalPaidAmount || 0;

  // 3. Còn nợ chưa hoàn: lấy trực tiếp từ summary theo kỳ lọc
  const totalUnpaid = summary.totalUnpaidAmount || 0;

  // 4. Số dư quỹ thực tế toàn hệ thống
  const globalBalance = fundStats?.fundBalance || 0;
  // Chênh lệch thu - chi trong kỳ đang chọn
  const periodBalance = (fundStats?.periodFundIn || 0) - totalPaid;
  const isGlobalPositive = globalBalance >= 0;

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
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Sổ Quỹ & Quyết Toán Chi Tiêu
              </span>
              <span
                className="badge badge--neutral"
                style={{ fontSize: '11px', padding: '2px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 700 }}
              >
                <Filter size={10} /> {timeLabel}{selectedStaff ? ` · ${selectedStaff.full_name}` : ''}
              </span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Số liệu tự động đồng bộ theo mốc thời gian và bộ lọc đang chọn
            </div>
          </div>

          {/* Badge Chờ Duyệt Chi (Chỉ hiện khi có khoản pending trong kỳ đang lọc) */}
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
              title="Bấm để lọc các khoản đang chờ phê duyệt trong kỳ này"
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

      {/* Grid 4 Chỉ Số Dòng Tiền Đồng Bộ Theo Kỳ Lọc */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '12px' }}>
        {/* Ô 1: Sếp Rót Quỹ */}
        <div style={{ background: 'var(--bg-input)', padding: '12px 14px', borderRadius: '10px', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            <ArrowDownRight size={14} color="var(--primary)" />
            1. Sếp Cấp {isMonthFiltered ? `(${timeLabel})` : 'Quỹ'}
          </div>
          <div style={{ fontSize: '19px', fontWeight: 900, color: 'var(--primary)', marginTop: '4px', fontVariantNumeric: 'tabular-nums' }}>
            {formatVND(fundInDisplay)}
          </div>
          <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
            {isMonthFiltered ? `Lũy kế toàn bộ: ${formatVND(totalFundInGlobal)}` : 'Tổng ngân sách đã nạp vào quỹ'}
          </div>
        </div>

        {/* Ô 2: Đã Hoàn Trả Xong (Click để lọc) */}
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
          title="Bấm để lọc danh sách các khoản đã thanh toán xong trong kỳ này"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            <CreditCard size={14} color="var(--green)" />
            2. Đã Hoàn Trả {isMonthFiltered ? `(${timeLabel})` : ''}
          </div>
          <div style={{ fontSize: '19px', fontWeight: 900, color: 'var(--text)', marginTop: '4px', fontVariantNumeric: 'tabular-nums' }}>
            {formatVND(totalPaid)}
          </div>
          <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Đã chuyển khoản xong trong kỳ
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
          title="Bấm để lọc danh sách các khoản còn nợ cần trả trong kỳ này"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            <AlertCircle size={14} color="var(--red)" />
            3. Còn Nợ {isMonthFiltered ? `(${timeLabel})` : ''}
          </div>
          <div style={{ fontSize: '19px', fontWeight: 900, color: 'var(--red)', marginTop: '4px', fontVariantNumeric: 'tabular-nums' }}>
            {formatVND(totalUnpaid)}
          </div>
          <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
            {totalUnpaid > 0 ? 'Cần xuất quỹ thanh toán' : 'Không có nợ tồn đọng trong kỳ'}
          </div>
        </div>

        {/* Ô 4: Số Dư Quỹ Thực Tế */}
        <div
          style={{
            background: isGlobalPositive ? 'var(--green-soft)' : 'var(--red-soft)',
            padding: '12px 14px',
            borderRadius: '10px',
            border: `1.5px solid ${isGlobalPositive ? 'var(--green)' : 'var(--red)'}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 800, color: isGlobalPositive ? 'var(--green)' : 'var(--red)', textTransform: 'uppercase' }}>
            {isGlobalPositive ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
            {isGlobalPositive ? '4. Số Dư Quỹ Hiện Còn' : '4. Công Ty Cần Cấp Bù'}
          </div>
          <div style={{ fontSize: '20px', fontWeight: 900, color: isGlobalPositive ? 'var(--green)' : 'var(--red)', marginTop: '4px', fontVariantNumeric: 'tabular-nums' }}>
            {isGlobalPositive ? `+ ${formatVND(globalBalance)}` : `- ${formatVND(Math.abs(globalBalance))}`}
          </div>
          <div style={{ fontSize: '10.5px', color: isGlobalPositive ? 'var(--green)' : 'var(--red)', marginTop: '2px', fontWeight: 600 }}>
            {isMonthFiltered
              ? `Chênh lệch ${timeLabel}: ${periodBalance >= 0 ? '+' : ''}${formatVND(periodBalance)}`
              : (isGlobalPositive ? '🟢 Quỹ đang dư tiền' : '🔴 Quỹ âm (Cty nợ người giữ quỹ)')}
          </div>
        </div>
      </div>
    </div>
  );
}
