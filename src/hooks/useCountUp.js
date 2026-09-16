import { useEffect, useRef, useState } from "react";

/**
 * Animates a number from its previous value to a new target whenever the target
 * changes - used for KPI cards so numbers count up smoothly on first load AND
 * visibly animate again whenever a background sync brings in a new value,
 * instead of just silently snapping to the new number.
 *
 * Pass duration=0 for an instant, non-animated value (still goes through the
 * same hook so call sites can toggle animation on/off without breaking the
 * rules of hooks).
 */
export function useCountUp(target, duration = 800) {
  const numericTarget = typeof target === "number" && !isNaN(target) ? target : 0;
  const [display, setDisplay] = useState(numericTarget);
  const [isAnimating, setIsAnimating] = useState(false);
  const prevTarget = useRef(numericTarget);
  const rafRef = useRef(null);

  useEffect(() => {
    const start = prevTarget.current;
    const end = numericTarget;

    if (duration <= 0 || start === end) {
      setDisplay(end);
      prevTarget.current = end;
      return;
    }

    const startTime = performance.now();
    setIsAnimating(true);

    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setDisplay(start + (end - start) * eased);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        prevTarget.current = end;
        setIsAnimating(false);
      }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numericTarget, duration]);

  return { value: display, isAnimating };
}
