import { lazy, Suspense, useEffect, useRef } from "react";
import toggleAnim from "../assets/icons/animated-toggle.json";

// Same lazy-load approach as KpiIcon.jsx - lottie-web is heavy, so it only
// downloads once a toggle actually renders, not on every page load.
const Lottie = lazy(() => import("lottie-react"));

// Frame ranges inside animated-toggle.json: 0-20 is the "switching on" liquid
// morph (grey pill -> green pill, knob slides right), 33-53 is "switching
// off" (the mirrored reverse). Holding on frame 20 or frame 0 gives a crisp
// static on/off state with no animation, for the initial render.
const ON_SEGMENT = [0, 20];
const OFF_SEGMENT = [33, 53];
const ON_FRAME = 20;
const OFF_FRAME = 0;

function ToggleInner({ checked, onChange, disabled, size }) {
  const lottieRef = useRef(null);
  const mounted = useRef(false);

  useEffect(() => {
    if (!lottieRef.current) return;
    if (!mounted.current) {
      // First render: snap straight to the right static frame, don't animate.
      lottieRef.current.goToAndStop(checked ? ON_FRAME : OFF_FRAME, true);
      mounted.current = true;
      return;
    }
    lottieRef.current.playSegments(checked ? ON_SEGMENT : OFF_SEGMENT, true);
  }, [checked]);

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className="animated-toggle-btn"
      onClick={() => !disabled && onChange?.(!checked)}
      style={{ width: size, height: size }}
    >
      <Lottie
        lottieRef={lottieRef}
        animationData={toggleAnim}
        loop={false}
        autoplay={false}
        style={{ width: size, height: size }}
      />
    </button>
  );
}

/**
 * Drop-in animated replacement for a boolean <input type="checkbox">/toggle -
 * same checked/onChange contract, but renders the liquid morph switch instead
 * of a plain box. size controls the rendered pixel width+height (square).
 */
export default function AnimatedToggle({ checked, onChange, disabled, size = 34 }) {
  return (
    <Suspense fallback={<span style={{ width: size, height: size, display: "inline-block" }} />}>
      <ToggleInner checked={checked} onChange={onChange} disabled={disabled} size={size} />
    </Suspense>
  );
}
