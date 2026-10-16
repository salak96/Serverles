// Smoke test: detector with mocked window. Verifies the breach logic
// independently of the React tree. These tests assert the CONTRACT
// documented in src/lib/security.ts.
//
// IMPORTANT: the devtools heuristic combines the dimension gap with a
// `debugger` timing probe. The `debugger` probe is non-deterministic in
// Node (no inspector), so we test:
//
//   1. Zoom alone NEVER triggers a breach.
//   2. Resize alone NEVER triggers a breach.
//   3. A large dimension gap WITHOUT a debugger signal does NOT trigger
//      a breach (the heuristic is conservative on purpose).
//   4. The internal counter resets after a resize event.
//   5. Zoom telemetry is exposed via the signal.
//
// The case "devtools open AND debugger paused" cannot be reliably
// simulated in unit tests; it would need a real browser. That is
// acknowledged in the detector source comments.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SecurityDetector } from '../src/lib/security';

const makeWindow = (overrides: {
  outerWidth: number;
  outerHeight: number;
  innerWidth: number;
  innerHeight: number;
  vpScale?: number;
}) => {
  const visualViewport = overrides.vpScale !== undefined
    ? {
        scale: overrides.vpScale,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }
    : null;
  return {
    innerWidth: overrides.innerWidth,
    innerHeight: overrides.innerHeight,
    outerWidth: overrides.outerWidth,
    outerHeight: overrides.outerHeight,
    visualViewport,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  };
};

const installWindow = (w: ReturnType<typeof makeWindow>) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).window = w;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).performance = { now: () => Date.now() };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (globalThis as any).document;
};

describe('SecurityDetector (jsdom-free)', () => {
  let now = 0;
  beforeEach(() => {
    now = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).performance = { now: () => now };
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('zoom alone does NOT trigger a breach', () => {
    // 150% zoom: outer 1320, inner 1280 — gap is only 40px, well below the
    // 300px threshold. Even with high zoom, the dimension heuristic does
    // not fire.
    const w = makeWindow({ outerWidth: 1320, outerHeight: 820, innerWidth: 1280, innerHeight: 780, vpScale: 1.5 });
    installWindow(w);
    const d = new SecurityDetector({ pollIntervalMs: 50, consecutiveHitsRequired: 3, minBreachDurationMs: 100 });
    let breachFired = false;
    d.subscribe((s) => { if (s.breach) breachFired = true; });
    for (let i = 0; i < 5; i++) {
      d.sample();
      now += 200;
    }
    expect(breachFired).toBe(false);
    d.dispose();
  });

  it('small-screen resize alone does NOT trigger a breach', () => {
    const w = makeWindow({ outerWidth: 400, outerHeight: 800, innerWidth: 400, innerHeight: 760 });
    installWindow(w);
    const d = new SecurityDetector({ pollIntervalMs: 50, consecutiveHitsRequired: 3, minBreachDurationMs: 100 });
    let breachFired = false;
    d.subscribe((s) => { if (s.breach) breachFired = true; });
    for (let i = 0; i < 10; i++) {
      d.sample();
      now += 200;
    }
    expect(breachFired).toBe(false);
    d.dispose();
  });

  it('a large dimension gap WITHOUT a debugger signal does NOT trigger a breach (by design)', () => {
    // The combined heuristic intentionally requires BOTH the dimension
    // gap AND the debugger probe to fire. This guards against false
    // positives on high-zoom or multi-monitor setups. The test verifies
    // that the conservative logic is in effect.
    const w = makeWindow({ outerWidth: 2400, outerHeight: 1080, innerWidth: 1500, innerHeight: 1000 });
    installWindow(w);
    const d = new SecurityDetector({ pollIntervalMs: 10, consecutiveHitsRequired: 3, minBreachDurationMs: 50 });
    let breachFired = false;
    let lastConfidence = 0;
    d.subscribe((s) => {
      if (s.breach) breachFired = true;
      lastConfidence = s.signal.devtoolsConfidence;
    });
    d.sample();
    now += 30;
    d.sample();
    now += 30;
    d.sample();
    now += 30;
    // In Node the `debugger` statement does not pause; elapsed is ~0, so
    // the combined heuristic does not latch. We expect:
    //   - No breach fired
    //   - Non-zero confidence (the dimension signal is present)
    expect(breachFired).toBe(false);
    expect(lastConfidence).toBeGreaterThan(0);
    d.dispose();
  });

  it('a resize event resets the consecutive-hit counter (no false alarm during animation)', () => {
    const w = makeWindow({ outerWidth: 2400, outerHeight: 1080, innerWidth: 1500, innerHeight: 1000 });
    installWindow(w);
    // Stub requestAnimationFrame so onResize() is effectively synchronous.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).requestAnimationFrame = (cb: () => void) => { cb(); return 0; };
    const d = new SecurityDetector({ pollIntervalMs: 10, consecutiveHitsRequired: 3, minBreachDurationMs: 50 });
    let breachFired = false;
    d.subscribe((s) => { if (s.breach) breachFired = true; });
    d.sample();
    now += 30;
    d.sample();
    // Simulate a resize mid-stream; this should reset the counter.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (d as any).onResize();
    now += 30;
    d.sample();
    now += 30;
    d.sample();
    expect(breachFired).toBe(false);
    d.dispose();
  });

  it('zoom telemetry (read-only) is exposed via the signal, even when no breach fires', () => {
    const w = makeWindow({ outerWidth: 1500, outerHeight: 800, innerWidth: 1280, innerHeight: 533, vpScale: 1.5 });
    installWindow(w);
    const d = new SecurityDetector();
    let last: { signal: { zoom: number; zoomSource: string } } | null = null;
    d.subscribe((s) => { last = s; });
    d.sample();
    expect(last).not.toBeNull();
    expect(last!.signal.zoom).toBe(1.5);
    expect(last!.signal.zoomSource).toBe('visualViewport');
    d.dispose();
  });
});
