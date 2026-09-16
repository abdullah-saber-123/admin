import { useEffect } from "react";

/**
 * Locks the page's background scroll while `active` is true - used for any
 * full-screen overlay (customer detail panel, mobile sidebar drawer, call
 * screen, etc). Without this, a touch-drag meant to scroll inside the
 * overlay can bleed through and scroll the page underneath instead
 * (especially on iOS Safari), which is what causes the "top not fully
 * visible" / layout-glitch feeling when an overlay is opened while the
 * background page was already scrolled down.
 *
 * Restores the exact previous scroll position when `active` goes back to
 * false (or the component unmounts while still active).
 */
export default function useBodyScrollLock(active) {
  useEffect(() => {
    if (!active) return undefined;
    const scrollY = window.scrollY;
    const { style } = document.body;
    const prev = { position: style.position, top: style.top, width: style.width, overflow: style.overflow };
    style.position = "fixed";
    style.top = `-${scrollY}px`;
    style.width = "100%";
    style.overflow = "hidden";
    return () => {
      style.position = prev.position;
      style.top = prev.top;
      style.width = prev.width;
      style.overflow = prev.overflow;
      window.scrollTo(0, scrollY);
    };
  }, [active]);
}
