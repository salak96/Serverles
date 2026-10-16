import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSecurityDetector, type SecurityDetector } from './security';

/**
 * Mounts the security detector for the lifetime of the component and
 * routes to /security/breach the first time a breach latches.
 *
 * The breach latch is sticky until the page is reloaded, so navigating
 * away from the breach page will not silently return the user to the
 * dashboard — the detector only resets on full reload.
 */
export function useSecurityBreachRouter(): { detector: SecurityDetector | null } {
  const navigate = useNavigate();
  const firedRef = useRef(false);

  useEffect(() => {
    const detector = getSecurityDetector();
    if (!detector) return;
    detector.start();

    const unsubscribe = detector.subscribe((state) => {
      if (state.breach && !firedRef.current) {
        firedRef.current = true;
        navigate('/security/breach', { replace: true, state: { reason: 'devtools-detected' } });
      }
    });

    return () => {
      unsubscribe();
      // We intentionally do NOT dispose the singleton: it must survive
      // page-level unmounts (e.g. logout-driven navigations) so the
      // detector is still active when the user logs back in.
    };
  }, [navigate]);

  return { detector: getSecurityDetector() };
}
