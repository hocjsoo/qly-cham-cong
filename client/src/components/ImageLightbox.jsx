// client/src/components/ImageLightbox.jsx
// Premium Image Lightbox Engine — Zoom, Pan, Rotate, Download, Shortcuts & Mobile Gestures

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ZoomIn, ZoomOut, RotateCcw, RotateCw, Download, X } from "lucide-react";

const getImageExtension = url => {
  const value = String(url || "");
  const dataType = value.match(/^data:image\/([a-zA-Z0-9.+-]+);/i)?.[1]?.toLowerCase();
  if (dataType) {
    if (dataType === "jpeg") return "jpg";
    if (dataType.includes("svg")) return "svg";
    if (["png", "jpg", "webp", "gif", "avif"].includes(dataType)) return dataType;
  }

  const pathExtension = value.split(/[?#]/, 1)[0].match(/\.([a-zA-Z0-9]+)$/)?.[1]?.toLowerCase();
  if (pathExtension === "jpeg") return "jpg";
  return ["png", "jpg", "webp", "gif", "svg", "avif"].includes(pathExtension) ? pathExtension : "jpg";
};

const getDownloadFilename = image => {
  const printableTitle = Array.from(String(image?.title || "image"), character => (
    character.charCodeAt(0) < 32 ? " " : character
  )).join("");
  const safeTitle = printableTitle
    .trim()
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[_\-.]+|[_\-.]+$/g, "")
    .slice(0, 96) || "image";

  return `${safeTitle}.${getImageExtension(image?.url)}`;
};

export default function ImageLightbox({ image, onClose }) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef(null);

  const changeZoom = (nextZoom) => {
    const value = Math.min(4, Math.max(0.5, Number(nextZoom.toFixed(2))));
    setZoom(value);
    if (value === 1) setOffset({ x: 0, y: 0 });
  };

  const rotate = (angle) => {
    setRotation(prev => (prev + angle + 360) % 360);
  };

  const resetView = () => {
    setZoom(1);
    setRotation(0);
    setOffset({ x: 0, y: 0 });
  };

  useEffect(() => {
    resetView();
  }, [image?.url]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
      if (event.key === "+" || event.key === "=") changeZoom(zoom + 0.25);
      if (event.key === "-") changeZoom(zoom - 0.25);
      if (event.key === "0") resetView();
      if (event.key === "r" || event.key === "R") rotate(90);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, zoom]);

  if (!image || !image.url) return null;

  const handleDownload = (e) => {
    e.stopPropagation();
    const a = document.createElement("a");
    a.href = image.url;
    a.download = getDownloadFilename(image);
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return createPortal(
    <div
      className="image-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={image.title || "Xem ảnh lớn"}
      onClick={event => event.currentTarget === event.target && onClose()}
      onWheel={event => {
        event.preventDefault();
        changeZoom(zoom + (event.deltaY < 0 ? 0.2 : -0.2));
      }}
      style={{
        position: "fixed", inset: 0, zIndex: 1000002, overflow: "hidden",
        display: "grid", gridTemplateRows: "auto 1fr auto", padding: "14px",
        color: "#ffffff", background: "rgba(4, 7, 12, 0.94)", backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)"
      }}
    >
      {/* Top Floating Toolbar */}
      <div className="image-lightbox__header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 2, padding: "4px 8px" }}>
        <div className="image-lightbox__title" style={{ fontSize: "13px", fontWeight: 700, color: "#ffffff", textShadow: "0 1px 4px rgba(0,0,0,0.8)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "50vw" }}>
          {image.title || "Hình ảnh"}
        </div>

        <div className="image-lightbox__controls" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <button className="image-lightbox__button" type="button" onClick={() => changeZoom(zoom - 0.25)} aria-label="Thu nhỏ" title="Thu nhỏ (-)" style={viewerButtonStyle}><ZoomOut size={18} /></button>
          <span className="image-lightbox__zoom" style={{ minWidth: "50px", textAlign: "center", fontSize: "12px", fontWeight: 800, color: "#ffffff", fontVariantNumeric: "tabular-nums" }}>{Math.round(zoom * 100)}%</span>
          <button className="image-lightbox__button" type="button" onClick={() => changeZoom(zoom + 0.25)} aria-label="Phóng to" title="Phóng to (+)" style={viewerButtonStyle}><ZoomIn size={18} /></button>
          <button className="image-lightbox__button" type="button" onClick={() => rotate(90)} aria-label="Xoay ảnh 90°" title="Xoay ảnh 90° (R)" style={viewerButtonStyle}><RotateCw size={17} /></button>
          <button className="image-lightbox__button" type="button" onClick={resetView} aria-label="Đặt lại kích thước" title="Đặt lại (0)" style={viewerButtonStyle}><RotateCcw size={17} /></button>
          <button className="image-lightbox__button" type="button" onClick={handleDownload} aria-label="Tải ảnh về" title="Tải ảnh về máy" style={viewerButtonStyle}><Download size={17} /></button>
          <button className="image-lightbox__button" type="button" onClick={onClose} aria-label="Đóng" title="Đóng (Esc)" style={{ ...viewerButtonStyle, background: "rgba(239, 68, 68, 0.4)", borderColor: "rgba(239, 68, 68, 0.6)" }}><X size={20} /></button>
        </div>
      </div>

      {/* Main Interactive Stage */}
      <div
        className="image-lightbox__stage"
        style={{ minHeight: 0, display: "grid", placeItems: "center", overflow: "hidden", touchAction: "none", userSelect: "none" }}
        onDoubleClick={() => zoom === 1 ? changeZoom(2) : resetView()}
        onPointerDown={event => {
          if (zoom <= 1) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          dragRef.current = { startX: event.clientX, startY: event.clientY, originX: offset.x, originY: offset.y };
        }}
        onPointerMove={event => {
          if (!dragRef.current) return;
          setOffset({
            x: dragRef.current.originX + event.clientX - dragRef.current.startX,
            y: dragRef.current.originY + event.clientY - dragRef.current.startY,
          });
        }}
        onPointerUp={() => { dragRef.current = null; }}
        onPointerCancel={() => { dragRef.current = null; }}
      >
        <img
          className="image-lightbox__image"
          src={image.url || "/logo.png"}
          alt={image.title || "Ảnh lớn"}
          draggable="false"
          onError={event => {
            if (event.currentTarget.dataset.fallbackApplied) return;
            event.currentTarget.dataset.fallbackApplied = "true";
            event.currentTarget.src = "/logo.png";
          }}
          style={{
            maxWidth: "94vw", maxHeight: "78vh", objectFit: "contain",
            borderRadius: "12px", boxShadow: "0 24px 80px rgba(0,0,0,0.85)",
            cursor: zoom > 1 ? "grab" : "zoom-in",
            transform: "translate3d(" + offset.x + "px, " + offset.y + "px, 0) scale(" + zoom + ") rotate(" + rotation + "deg)",
            transition: dragRef.current ? "none" : "transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)"
          }}
        />
      </div>

      {/* Footer Navigation & Shortcut Guide */}
      <div className="image-lightbox__footer" style={{ minHeight: "28px", paddingTop: "6px", textAlign: "center", color: "rgba(255,255,255,0.7)", fontSize: "11px" }}>
        <span>💡 Cuộn chuột hoặc bấm nút để thu phóng · Nhấp đúp để phóng 200% · Kéo rê ảnh khi đã phóng · Phím tắt: <strong>Esc</strong> (Đóng), <strong>R</strong> (Xoay)</span>
      </div>
    </div>,
    document.body
  );
}

const viewerButtonStyle = {
  width: "38px", height: "38px", display: "grid", placeItems: "center", padding: 0,
  color: "#ffffff", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "10px",
  background: "rgba(255,255,255,0.1)", backdropFilter: "blur(8px)", cursor: "pointer",
  transition: "all 0.15s ease"
};
