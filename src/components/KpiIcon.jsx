import { lazy, Suspense } from "react";

// lottie-react pulls in the full lottie-web animation engine, which is fairly
// heavy - loading it eagerly would bloat the MAIN bundle for every page, even
// ones with no animated icons. Lazy-loading it means that extra weight only
// ever downloads once a KPI card that actually needs an animation renders.
const Lottie = lazy(() => import("lottie-react"));

/**
 * Renders one of three icon kinds into a KPI card's icon slot:
 *   - lottie={jsonData}  -> small looping animation (loaded on demand)
 *   - svg={pathToSvg}    -> static SVG image
 *   - Icon={LucideIcon}  -> a plain Lucide icon (the original default)
 */
export default function KpiIcon({ lottie, svg, Icon, size = 20 }) {
  if (lottie) {
    return (
      <Suspense fallback={<span style={{ width: size, height: size, display: "inline-block" }} />}>
        <Lottie
          animationData={lottie}
          loop
          style={{ width: size + 6, height: size + 6 }}
        />
      </Suspense>
    );
  }
  if (svg) {
    return <img src={svg} alt="" style={{ width: size, height: size, objectFit: "contain" }} />;
  }
  if (Icon) return <Icon size={size} />;
  return null;
}
