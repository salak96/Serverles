/**
 * Browser-side security telemetry.
 *
 * SCOPE AND LIMITATIONS (read before changing):
 *
 * 1. This module is a BEST-EFFORT, FRONTEND-ONLY detection. It cannot prove
 *    that a user is "malicious" — a determined attacker can disable, modify,
 *    or bypass any browser-side check. Treat signals as INDICATORS, not
 *    evidence. The server remains the source of truth for authentication,
 *    authorization, and session validity.
 *
 * 2. Three classes of state are tracked independently:
 *
 *      a. BROWSER ZOOM  — read-only telemetry. Never triggers a breach.
 *         Computed from `visualViewport.scale` and the ratio
 *         `outerWidth / innerWidth`. We DO NOT act on zoom; the value is
 *         surfaced only for diagnostics.
 *
 *      b. VIEWPORT / RESIZE — read-only telemetry. Never triggers a breach.
 *         Tracked so we can suppress false positives during orientation
 *         changes, devtools-open/close animations, and screen reader
 *         reflows.
 *
 *      c. DEVTOOLS — the only signal that may trigger a breach. We use the
 *         standard best-effort heuristic: compare `window.outerWidth` to
 *         `window.innerWidth` (or `outerHeight` to `innerHeight`). When
 *         devtools are docked, the gap exceeds an empirically observed
 *         threshold. We also use a `debugger` timing probe as a
 *         secondary signal. Neither is 100% reliable.
 *
 * 3. To reduce false positives the breach condition requires the
 *    devtools heuristic to hold for N consecutive polls (default 3) and
 *    to be sustained for a minimum duration (default 1500 ms). Resize
 *    and orientation events reset the counter.
 *
 * 4. The detector is feature-flagged. Set
 *    `VITE_SECURITY_BREACH_DETECTION=true` to enable. By default it is
 *    disabled so development, accessibility tooling, and CI are
 *    unaffected.
 *
 * 5. The detector is a singleton — it registers listeners exactly once
 *    and cleans up on `dispose()`. It does not run in a tight loop; the
 *    poll interval is 1000 ms.
 *
 * 6. When the breach condition is met, the hook invokes `onBreach` ONCE
 *    and then disables itself until the page is reloaded. It never calls
 *    itself in a loop.
 */

export type SecuritySignal = {
  zoom: number; // estimated browser zoom factor, 1.0 = 100%
  zoomSource: 'visualViewport' | 'outerInnerRatio' | 'unknown';
  viewportWidth: number;
  viewportHeight: number;
  devtoolsOpenLikely: boolean;
  devtoolsConfidence: number; // 0..1
};

export type SecurityState = {
  signal: SecuritySignal;
  breach: boolean;
};

export type SecurityListener = (state: SecurityState) => void;

interface DetectorConfig {
  pollIntervalMs: number; // how often to sample
  consecutiveHitsRequired: number; // devtools must hold for N samples
  minBreachDurationMs: number; // breach must persist for at least this long
  devtoolsGapThreshold: number; // minimum outer-inner gap in px to count
}

const DEFAULT_CONFIG: DetectorConfig = {
  pollIntervalMs: 1000,
  consecutiveHitsRequired: 3,
  minBreachDurationMs: 1500,
  // Threshold in CSS pixels for the gap between window.outer* and
  // window.inner* dimensions. 300px is empirically conservative enough to
  // avoid false positives on common browser chrome (scrollbars, OS menu
  // bars) while still catching devtools docked at default widths.
  devtoolsGapThreshold: 300,
};

function isEnabled(): boolean {
  try {
    // import.meta.env is replaced at build time by Vite.
    const flag = (import.meta as unknown as { env?: Record<string, string> }).env?.['VITE_SECURITY_BREACH_DETECTION'];
    return flag === 'true' || flag === '1';
  } catch {
    return false;
  }
}

function estimateZoom(): { zoom: number; source: SecuritySignal['zoomSource'] } {
  if (typeof window === 'undefined') return { zoom: 1, source: 'unknown' };

  // visualViewport.scale is the most accurate when available (Chrome, Firefox 91+).
  const vv = (window as Window & { visualViewport?: VisualViewport | null }).visualViewport;
  if (vv && typeof vv.scale === 'number' && vv.scale > 0) {
    return { zoom: vv.scale, source: 'visualViewport' };
  }

  // Fallback: ratio of outer to inner dimensions. Less accurate (varies by
  // OS chrome, scrollbars, etc.) but does not require visualViewport. Note
  // that this also drifts when devtools is docked, so it is NOT used as a
  // devtools signal.
  const ratioW = window.outerWidth && window.innerWidth ? window.outerWidth / window.innerWidth : 1;
  const ratioH = window.outerHeight && window.innerHeight ? window.outerHeight / window.innerHeight : 1;
  // Take the larger of the two as a conservative estimate.
  const ratio = Math.max(ratioW, ratioH);
  return { zoom: ratio, source: 'outerInnerRatio' };
}

function readDevtoolsSignal(): { likely: boolean; confidence: number } {
  if (typeof window === 'undefined') return { likely: false, confidence: 0 };

  // Heuristic 1: outer-inner dimension gap. When devtools is docked, the
  // browser shrinks the viewport; the gap between outer and inner widens
  // beyond what toolbars normally produce. NOTE: this heuristic is known
  // to false-positive on high-zoom users and on multi-monitor setups.
  // We therefore use it ONLY as a confirmation signal, never alone.
  const widthGap = Math.max(0, window.outerWidth - window.innerWidth);
  const heightGap = Math.max(0, window.outerHeight - window.innerHeight);
  const maxGap = Math.max(widthGap, heightGap);
  const dimConfirmed = maxGap >= DEFAULT_CONFIG.devtoolsGapThreshold;

  // Heuristic 2: debugger timing. When devtools is open and not just
  // docked but actually inspecting, a `debugger` statement takes noticeably
  // longer to execute. Browsers throttle this when the user is NOT
  // actively in a debugging context, so the signal is reliable when
  // present and silent when not. We sample once per poll — the cost is
  // negligible because the runtime only pauses if devtools is "armed".
  let debuggerConfirmed = false;
  try {
    const start = performance.now();
    // eslint-disable-next-line no-debugger
    debugger;
    const elapsed = performance.now() - start;
    // >100ms almost certainly means devtools is paused on the breakpoint.
    if (elapsed > 100) debuggerConfirmed = true;
  } catch {
    // Some hardened environments disable `debugger`; treat as no signal.
  }

  // Require BOTH signals to agree before reporting "likely". This
  // dramatically reduces false positives from zoom-only or multi-monitor
  // scenarios, at the cost of missing very edge cases (e.g. devtools open
  // but in a state where the debugger trap does not fire). The detector
  // is a deterrent, not a guarantee — the server remains the source of
  // truth for session validity.
  const likely = dimConfirmed && debuggerConfirmed;
  const confidence = likely ? 1 : (dimConfirmed || debuggerConfirmed ? 0.5 : 0);
  return { likely, confidence };
}

export class SecurityDetector {
  private listeners = new Set<SecurityListener>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private resizeRaf = 0;
  private consecutiveHits = 0;
  private firstHitAt: number | null = null;
  private breachLatched = false;
  private config: DetectorConfig;
  private lastSignal: SecuritySignal;

  constructor(config: Partial<DetectorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    const { zoom, source } = estimateZoom();
    this.lastSignal = {
      zoom,
      zoomSource: source,
      viewportWidth: typeof window !== 'undefined' ? window.innerWidth : 0,
      viewportHeight: typeof window !== 'undefined' ? window.innerHeight : 0,
      devtoolsOpenLikely: false,
      devtoolsConfidence: 0,
    };
  }

  start(): void {
    if (this.timer || typeof window === 'undefined') return;
    this.sample(); // initial reading
    this.timer = setInterval(() => this.sample(), this.config.pollIntervalMs);
    window.addEventListener('resize', this.onResize, { passive: true });
    window.addEventListener('orientationchange', this.onResize);
    if ((window as Window & { visualViewport?: VisualViewport | null }).visualViewport) {
      (window as Window & { visualViewport: VisualViewport }).visualViewport.addEventListener('resize', this.onResize);
    }
  }

  dispose(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.resizeRaf) cancelAnimationFrame(this.resizeRaf);
    this.resizeRaf = 0;
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this.onResize);
      window.removeEventListener('orientationchange', this.onResize);
      const vv = (window as Window & { visualViewport?: VisualViewport | null }).visualViewport;
      if (vv) vv.removeEventListener('resize', this.onResize);
    }
    this.listeners.clear();
  }

  subscribe(fn: SecurityListener): () => void {
    this.listeners.add(fn);
    fn({ signal: this.lastSignal, breach: this.breachLatched });
    return () => { this.listeners.delete(fn); };
  }

  /** Force-clear the latched breach. Used after the user re-authenticates. */
  reset(): void {
    this.breachLatched = false;
    this.consecutiveHits = 0;
    this.firstHitAt = null;
  }

  private onResize = (): void => {
    // Suppress: any resize/zoom event resets the devtools-hit counter so
    // an orientation change or window drag does not look like an attack.
    this.consecutiveHits = 0;
    this.firstHitAt = null;
    if (this.resizeRaf) return;
    this.resizeRaf = requestAnimationFrame(() => {
      this.resizeRaf = 0;
      this.sample();
    });
  };

  private sample(): void {
    const { zoom, source } = estimateZoom();
    const dt = readDevtoolsSignal();
    const signal: SecuritySignal = {
      zoom,
      zoomSource: source,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      devtoolsOpenLikely: dt.likely,
      devtoolsConfidence: dt.confidence,
    };
    this.lastSignal = signal;

    let breach = this.breachLatched;
    if (!breach && dt.likely) {
      this.consecutiveHits += 1;
      if (this.firstHitAt === null) this.firstHitAt = performance.now();
      const sustainedMs = performance.now() - this.firstHitAt;
      if (this.consecutiveHits >= this.config.consecutiveHitsRequired && sustainedMs >= this.config.minBreachDurationMs) {
        this.breachLatched = true;
        breach = true;
      }
    } else if (!dt.likely) {
      this.consecutiveHits = 0;
      this.firstHitAt = null;
    }

    for (const fn of this.listeners) {
      try { fn({ signal, breach }); } catch { /* listener errors must not break the detector */ }
    }
  }
}

let singleton: SecurityDetector | null = null;

export function getSecurityDetector(): SecurityDetector | null {
  if (!isEnabled()) return null;
  if (!singleton) singleton = new SecurityDetector();
  return singleton;
}
