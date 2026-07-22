'use client';

import { useEffect, useRef } from 'react';

/**
 * A pointer-reactive dashed arrow that curves from the cursor to a target
 * element — nudging the visitor toward the page's primary CTA(s). Internal
 * canvas implementation (no deps), following the site's motion rules:
 * ink-colored stroke, parks itself after 3s of stillness, only draws while a
 * target is near the viewport, disabled under `prefers-reduced-motion` and on
 * coarse pointers. Fades out as the cursor approaches the target so it never
 * sits on top of the button itself.
 *
 * Pass several ids (one canvas per page, not one per button) and the arrow
 * points at whichever near-viewport target is closest to the cursor.
 */
export function PointerArrow({ targetId }: { targetId: string | string[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const idKey = Array.isArray(targetId) ? targetId.join(',') : targetId;

  useEffect(() => {
    const targetIds = idKey.split(',');
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!window.matchMedia('(pointer: fine)').matches) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    let raf = 0;
    let mouse: { x: number; y: number } | null = null;
    let lastActive = 0;
    let ink = { r: 26, g: 25, b: 22 };

    const readInk = () => {
      const m = getComputedStyle(document.body).color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (m) ink = { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) };
    };
    readInk();
    const themeObserver = new MutationObserver(readInk);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    const resize = () => {
      // Size the buffer from the canvas's own CSS box (not innerWidth, which
      // includes the scrollbar the fixed box excludes) so client coordinates
      // map 1:1 onto the drawing surface.
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const draw = () => {
      if (!mouse) return;
      const { x: x0, y: y0 } = mouse;

      // Of the targets near the viewport, aim at the one closest to the cursor.
      let rect: DOMRect | null = null;
      let best = Infinity;
      for (const id of targetIds) {
        const el = document.getElementById(id);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        // Only a local flourish: skip while this CTA is far off-screen.
        if (r.bottom < -160 || r.top > window.innerHeight + 160) continue;
        const d = Math.hypot(r.left + r.width / 2 - x0, r.top + r.height / 2 - y0);
        if (d < best) {
          best = d;
          rect = r;
        }
      }
      if (!rect) return;

      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      // End the arrow just outside the button's edge, along the approach line.
      const a = Math.atan2(cy - y0, cx - x0);
      const x1 = cx - Math.cos(a) * (rect.width / 2 + 12);
      const y1 = cy - Math.sin(a) * (rect.height / 2 + 12);

      const dist = Math.hypot(x1 - x0, y1 - y0);
      const opacity = Math.min(0.9, (dist - Math.max(rect.width, rect.height) / 2) / 500);
      if (opacity <= 0) return;

      // Curve bows vertically, more when approaching from above/below.
      const offset = Math.min(200, dist * 0.5);
      const bend = Math.max(-1, Math.min(1, (y0 - y1) / 200));
      const controlX = (x0 + x1) / 2;
      const controlY = (y0 + y1) / 2 + offset * bend;

      ctx.strokeStyle = `rgba(${ink.r}, ${ink.g}, ${ink.b}, ${opacity})`;
      ctx.lineWidth = 2;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo(controlX, controlY, x1, y1);
      ctx.setLineDash([10, 5]);
      ctx.stroke();
      ctx.restore();

      const angle = Math.atan2(y1 - controlY, x1 - controlX);
      const head = 12;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(
        x1 - head * Math.cos(angle - Math.PI / 6),
        y1 - head * Math.sin(angle - Math.PI / 6),
      );
      ctx.moveTo(x1, y1);
      ctx.lineTo(
        x1 - head * Math.cos(angle + Math.PI / 6),
        y1 - head * Math.sin(angle + Math.PI / 6),
      );
      ctx.stroke();
    };

    const loop = () => {
      ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
      if (performance.now() - lastActive < 3000) {
        draw();
        raf = requestAnimationFrame(loop);
      } else {
        raf = 0; // parked — the next mousemove/scroll wakes it
      }
    };
    const wake = () => {
      lastActive = performance.now();
      if (!raf) raf = requestAnimationFrame(loop);
    };
    const onMove = (e: MouseEvent) => {
      mouse = { x: e.clientX, y: e.clientY };
      wake();
    };
    const onScroll = () => {
      if (mouse) wake(); // target moved under a still cursor — keep tracking
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', resize);
      themeObserver.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [idKey]);

  return (
    // Explicit h/w: a canvas is a replaced element, so `inset-0` alone would
    // NOT stretch it — its intrinsic (devicePixelRatio-scaled) buffer size
    // would win and every drawing would land displaced at 2× scale.
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-10 h-full w-full"
    />
  );
}
