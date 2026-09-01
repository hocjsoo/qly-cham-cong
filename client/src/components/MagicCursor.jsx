// Hiệu ứng con trỏ nhẹ: một lớp GPU duy nhất, không tạo/xóa DOM theo từng mousemove.

import { useEffect, useRef } from 'react';

export default function MagicCursor() {
  const cursorRef = useRef(null);

  useEffect(() => {
    if (window.matchMedia('(pointer: coarse)').matches) return undefined;

    const cursor = cursorRef.current;
    if (!cursor) return undefined;

    let frameId = 0;
    let visible = false;
    let x = -100;
    let y = -100;

    const render = () => {
      frameId = 0;
      cursor.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      if (!visible) {
        visible = true;
        cursor.dataset.visible = 'true';
      }
    };

    const handleMove = event => {
      x = event.clientX;
      y = event.clientY;
      if (!frameId) frameId = window.requestAnimationFrame(render);
    };
    const handleLeave = () => {
      visible = false;
      cursor.dataset.visible = 'false';
    };

    window.addEventListener('mousemove', handleMove, { passive: true });
    document.documentElement.addEventListener('mouseleave', handleLeave);
    return () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      window.removeEventListener('mousemove', handleMove);
      document.documentElement.removeEventListener('mouseleave', handleLeave);
    };
  }, []);

  return (
    <div ref={cursorRef} className="magic-cursor-lite" data-visible="false" aria-hidden="true">
      <span>✦</span>
    </div>
  );
}
