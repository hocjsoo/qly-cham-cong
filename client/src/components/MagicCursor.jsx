// src/components/MagicCursor.jsx
// Hiệu ứng sparkle cursor — Chỉ bật khi ở chế độ tối (Dark Mode) & trên thiết bị desktop

import { useEffect, useRef } from 'react';

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function selectRandom(items) {
  return items[rand(0, items.length - 1)];
}

function calcDistance(a, b) {
  return Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2));
}

const THEME_COLORS = [
  '124 110 246',  // #7c6ef6 — primary purple
  '129 140 248',  // #818cf8 — indigo
  '167 139 250',  // #a78bfa — violet
  '196 181 253',  // #c4b5fd — light purple
];

const SIZES = ['1.1rem', '0.85rem', '0.55rem'];
const ANIMATIONS = ['fall-1', 'fall-2', 'fall-3'];

export default function MagicCursor() {
  const count = useRef(0);
  const last = useRef({
    starTimestamp: Date.now(),
    starPosition: { x: 0, y: 0 },
    mousePosition: { x: 0, y: 0 },
  });

  useEffect(() => {
    // Only enable on devices with a fine pointer (mouse/trackpad, not touchscreen)
    if (window.matchMedia('(pointer: coarse)').matches) return;

    const isDarkMode = () => {
      const theme = document.documentElement.getAttribute('data-theme');
      return theme === 'dark' || !theme; // Default is dark
    };

    const createStar = (position) => {
      if (!isDarkMode()) return;

      const wrapper = document.createElement('div');
      const color = selectRandom(THEME_COLORS);
      const size = selectRandom(SIZES);
      const anim = ANIMATIONS[count.current++ % 3];

      wrapper.style.cssText = `
        position: fixed;
        pointer-events: none;
        z-index: 99999;
        left: ${position.x}px;
        top: ${position.y}px;
        font-size: ${size};
        color: rgb(${color});
        text-shadow: 0 0 0.8rem rgb(${color} / 0.7);
        animation-name: ${anim};
        animation-duration: 1200ms;
        animation-timing-function: ease-out;
        animation-fill-mode: forwards;
        will-change: transform, opacity;
        line-height: 1;
      `;
      wrapper.textContent = '✦';
      document.body.appendChild(wrapper);

      setTimeout(() => {
        if (document.body.contains(wrapper)) {
          document.body.removeChild(wrapper);
        }
      }, 1300);
    };

    const createGlowPoint = (position) => {
      if (!isDarkMode()) return;

      const glow = document.createElement('div');
      glow.style.cssText = `
        position: fixed;
        pointer-events: none;
        z-index: 99998;
        left: ${position.x}px;
        top: ${position.y}px;
        width: 5px;
        height: 5px;
        border-radius: 50%;
        transform: translate(-50%, -50%);
        background: radial-gradient(circle, rgb(124 110 246 / 0.45), transparent 70%);
        will-change: opacity;
      `;
      document.body.appendChild(glow);
      setTimeout(() => {
        if (document.body.contains(glow)) document.body.removeChild(glow);
      }, 80);
    };

    const createGlow = (lastPos, current) => {
      if (!isDarkMode()) return;
      const distance = calcDistance(lastPos, current);
      const quantity = Math.max(Math.floor(distance / 8), 1);
      const dx = (current.x - lastPos.x) / quantity;
      const dy = (current.y - lastPos.y) / quantity;
      for (let i = 0; i < quantity; i++) {
        createGlowPoint({ x: lastPos.x + dx * i, y: lastPos.y + dy * i });
      }
    };

    const handleMove = (e) => {
      if (!isDarkMode()) return;
      const pos = { x: e.clientX, y: e.clientY };
      if (last.current.mousePosition.x === 0 && last.current.mousePosition.y === 0) {
        last.current.mousePosition = pos;
      }

      const now = Date.now();
      const farEnough = calcDistance(last.current.starPosition, pos) >= 65;
      const longEnough = now - last.current.starTimestamp > 200;

      if (farEnough || longEnough) {
        createStar(pos);
        last.current.starTimestamp = now;
        last.current.starPosition = pos;
      }

      createGlow(last.current.mousePosition, pos);
      last.current.mousePosition = pos;
    };

    const handleLeave = () => {
      last.current.mousePosition = { x: 0, y: 0 };
    };

    window.addEventListener('mousemove', handleMove, { passive: true });
    document.body.addEventListener('mouseleave', handleLeave);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      document.body.removeEventListener('mouseleave', handleLeave);
    };
  }, []);

  return null;
}
