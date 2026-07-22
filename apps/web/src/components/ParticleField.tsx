'use client';

import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  a: number;
  accent: boolean;
}

/**
 * Ambient drifting-dot canvas, sized to its parent. Colors follow the
 * --particle / --accent tokens and re-read on theme change; disabled entirely
 * under prefers-reduced-motion.
 */
export function ParticleField({
  count = 60,
  dir,
  className = '',
}: {
  count?: number;
  dir?: 'up';
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rnd = (a: number, b: number) => a + Math.random() * (b - a);
    let ps: Particle[] = [];
    let raf = 0;
    const col = { t: '#b8b3a8', ac: '#d97757' };

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(r.width * dpr));
      canvas.height = Math.max(1, Math.round(r.height * dpr));
    };
    const rebuild = () => {
      const { width: w, height: h } = canvas;
      ps = [];
      for (let i = 0; i < count; i++) {
        const accent = Math.random() < 0.18;
        ps.push({
          x: rnd(0, w),
          y: rnd(0, h),
          vx: rnd(-0.1, 0.1) * dpr,
          vy: (dir === 'up' ? rnd(-0.55, -0.12) : rnd(-0.12, 0.12)) * dpr,
          r: rnd(0.6, accent ? 2.1 : 1.4) * dpr,
          a: rnd(0.1, accent ? 0.6 : 0.38),
          accent,
        });
      }
    };
    const recolor = () => {
      const cs = getComputedStyle(document.documentElement);
      const t = cs.getPropertyValue('--particle').trim();
      const ac = cs.getPropertyValue('--accent').trim();
      if (t) col.t = t;
      if (ac) col.ac = ac;
    };

    const draw = () => {
      const { width: w, height: h } = canvas;
      ctx.clearRect(0, 0, w, h);
      for (const p of ps) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -6) p.x = w + 6;
        if (p.x > w + 6) p.x = -6;
        if (p.y < -6) p.y = h + 6;
        if (p.y > h + 6) p.y = -6;
        ctx.globalAlpha = p.a;
        ctx.fillStyle = p.accent ? col.ac : col.t;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, 6.2832);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };

    resize();
    rebuild();
    recolor();
    draw();

    const onResize = () => {
      resize();
      rebuild();
    };
    window.addEventListener('resize', onResize);
    const observer = new MutationObserver(recolor);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      observer.disconnect();
    };
  }, [count, dir]);

  return (
    <canvas ref={canvasRef} className={`pointer-events-none absolute inset-0 h-full w-full ${className}`} />
  );
}
