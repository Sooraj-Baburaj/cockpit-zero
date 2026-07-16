import { describe, it, expect } from 'vitest';
import { isWaylandSession } from '../src/main/app/wayland.js';

describe('isWaylandSession', () => {
  it('is false off Linux regardless of env', () => {
    expect(isWaylandSession('darwin', { XDG_SESSION_TYPE: 'wayland' })).toBe(false);
    expect(isWaylandSession('win32', { WAYLAND_DISPLAY: 'wayland-0' })).toBe(false);
  });

  it('detects Wayland via XDG_SESSION_TYPE or WAYLAND_DISPLAY', () => {
    expect(isWaylandSession('linux', { XDG_SESSION_TYPE: 'wayland' })).toBe(true);
    expect(isWaylandSession('linux', { WAYLAND_DISPLAY: 'wayland-0' })).toBe(true);
  });

  it('is false for X11 sessions', () => {
    expect(isWaylandSession('linux', { XDG_SESSION_TYPE: 'x11' })).toBe(false);
    expect(isWaylandSession('linux', {})).toBe(false);
  });
});
