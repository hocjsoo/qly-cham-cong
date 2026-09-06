import './PageLoader.css';

// Fallback loader hiển thị nhẹ nhàng khi chuyển trang
export default function PageLoader() {
  return (
    <section className="page-loader" role="status" aria-live="polite" aria-label="Đang tải trang">
      <div className="page-loader__heading">
        <span className="page-loader__pulse" aria-hidden="true" />
        <span>Đang mở trang…</span>
      </div>
      <div className="page-loader__preview" aria-hidden="true">
        <div className="page-loader__bar page-loader__bar--title" />
        <div className="page-loader__bar page-loader__bar--subtitle" />
        <div className="page-loader__cards">
          {[0, 1, 2, 3].map(item => <div className="page-loader__card" key={item} />)}
        </div>
        <div className="page-loader__table">
          {[0, 1, 2, 3].map(item => <div className="page-loader__bar" key={item} />)}
        </div>
      </div>
    </section>
  );
}
