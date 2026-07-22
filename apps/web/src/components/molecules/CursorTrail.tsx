'use client';

import { useEffect, useRef } from 'react';

/**
 * Ion cursor trail — spring-chained ribbons that chase the pointer, drawn in
 * the Ion band only (cyan 187° → deep blue 239°; never a full rainbow, per
 * DESIGN.md's Ion Rule). Fills its nearest positioned ancestor; strokes
 * outside the canvas clip away naturally. Disabled under
 * prefers-reduced-motion; the loop parks itself after 3s of pointer stillness.
 */

const TRAILS = 28;
const NODES = 32;
const FRICTION = 0.5;
const DAMPENING = 0.025;
const TENSION = 0.99;
const BASE_SPRING = 0.45;
const HUE_OFFSET = 213;
const HUE_AMPLITUDE = 26;
const HUE_FREQUENCY = 0.0015;
const IDLE_STOP_MS = 3000;

interface TrailNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface TrailLine {
  spring: number;
  friction: number;
  nodes: TrailNode[];
}

function createLine(spring: number, x: number, y: number): TrailLine {
  return {
    spring: spring + Math.random() * 0.1 - 0.05,
    friction: FRICTION + Math.random() * 0.01 - 0.005,
    nodes: Array.from({ length: NODES }, () => ({ x, y, vx: 0, vy: 0 })),
  };
}

function updateLine(line: TrailLine, tx: number, ty: number) {
  let spring = line.spring;
  const head = line.nodes[0];
  if (!head) return;
  head.vx += (tx - head.x) * spring;
  head.vy += (ty - head.y) * spring;
  for (let i = 0; i < line.nodes.length; i++) {
    const node = line.nodes[i]!;
    if (i > 0) {
      const prev = line.nodes[i - 1]!;
      node.vx += (prev.x - node.x) * spring;
      node.vy += (prev.y - node.y) * spring;
      node.vx += prev.vx * DAMPENING;
      node.vy += prev.vy * DAMPENING;
    }
    node.vx *= line.friction;
    node.vy *= line.friction;
    node.x += node.vx;
    node.y += node.vy;
    spring *= TENSION;
  }
}

function drawLine(ctx: CanvasRenderingContext2D, line: TrailLine) {
  const first = line.nodes[0];
  if (!first) return;
  let x = first.x;
  let y = first.y;
  ctx.beginPath();
  ctx.moveTo(x, y);
  let i = 1;
  for (; i < line.nodes.length - 2; i++) {
    const node = line.nodes[i]!;
    const next = line.nodes[i + 1]!;
    x = (node.x + next.x) * 0.5;
    y = (node.y + next.y) * 0.5;
    ctx.quadraticCurveTo(node.x, node.y, x, y);
  }
  const node = line.nodes[i]!;
  const next = line.nodes[i + 1]!;
  ctx.quadraticCurveTo(node.x, node.y, next.x, next.y);
  ctx.stroke();
  ctx.closePath();
}

export function CursorTrail({ className = '' }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let lines: TrailLine[] = [];
    let raf = 0;
    let running = false;
    let dark = document.documentElement.getAttribute('data-theme') === 'dark';
    let huePhase = Math.random() * 2 * Math.PI;
    let lastMove = 0;
    const pos = { x: 0, y: 0 };
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(r.width * dpr));
      canvas.height = Math.max(1, Math.round(r.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const frame = () => {
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);
      // Additive glow on dark; plain alpha strokes on light (additive would blow out).
      ctx.globalCompositeOperation = dark ? 'lighter' : 'source-over';
      huePhase += HUE_FREQUENCY;
      const hue = Math.round(HUE_OFFSET + Math.sin(huePhase) * HUE_AMPLITUDE);
      ctx.strokeStyle = `hsla(${hue}, 95%, ${dark ? 55 : 45}%, ${dark ? 0.03 : 0.045})`;
      ctx.lineWidth = 9;
      for (const line of lines) {
        updateLine(line, pos.x, pos.y);
        drawLine(ctx, line);
      }
      if (performance.now() - lastMove > IDLE_STOP_MS) {
        running = false;
        ctx.clearRect(0, 0, width, height);
        return;
      }
      raf = requestAnimationFrame(frame);
    };

    const onMove = (event: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      pos.x = event.clientX - r.left;
      pos.y = event.clientY - r.top;
      lastMove = performance.now();
      if (!running) {
        running = true;
        if (lines.length === 0) {
          lines = Array.from({ length: TRAILS }, (_, i) =>
            createLine(BASE_SPRING + (i / TRAILS) * 0.025, pos.x, pos.y),
          );
        }
        raf = requestAnimationFrame(frame);
      }
    };

    resize();
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('resize', resize);
    const themeObserver = new MutationObserver(() => {
      dark = document.documentElement.getAttribute('data-theme') === 'dark';
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('resize', resize);
      themeObserver.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
      aria-hidden
    />
  );
}
