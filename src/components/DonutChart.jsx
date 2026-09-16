import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Hand-drawn SVG donut chart with an animated draw-in, a soft glow + scale-up
 * on hover (the segment itself is highlighted, nothing else is dimmed), and
 * center content that can swap to show whatever segment is hovered.
 *
 * data: [{ value, color, label }]
 */
export default function DonutChart({
  data,
  totalValue: propTotalValue,
  size = 220,
  strokeWidth = 26,
  animationDuration = 1,
  animationDelayPerSegment = 0.05,
  highlightOnHover = true,
  centerContent,
  onSegmentHover,
  onSegmentClick,
}) {
  const [hoveredSegment, setHoveredSegment] = useState(null);

  const totalValue = useMemo(
    () => propTotalValue || data.reduce((sum, seg) => sum + seg.value, 0),
    [data, propTotalValue]
  );

  const radius = size / 2 - strokeWidth / 2;
  const circumference = 2 * Math.PI * radius;
  let cumulativePercentage = 0;

  useEffect(() => {
    onSegmentHover?.(hoveredSegment);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoveredSegment]);

  return (
    <div
      className="donut-chart-svg-wrap"
      style={{ width: size, height: size }}
      onMouseLeave={() => setHoveredSegment(null)}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ overflow: "visible", transform: "rotate(-90deg)" }}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="var(--border)"
          strokeWidth={strokeWidth}
        />
        <AnimatePresence>
          {data.map((segment, index) => {
            if (segment.value === 0) return null;
            const percentage = totalValue === 0 ? 0 : (segment.value / totalValue) * 100;
            const strokeDasharray = `${(percentage / 100) * circumference} ${circumference}`;
            const strokeDashoffset = (cumulativePercentage / 100) * circumference;
            const isActive = hoveredSegment?.label === segment.label;
            cumulativePercentage += percentage;

            return (
              <motion.circle
                key={segment.label || index}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="transparent"
                stroke={segment.color}
                strokeWidth={strokeWidth}
                strokeDasharray={strokeDasharray}
                strokeDashoffset={-strokeDashoffset}
                strokeLinecap="round"
                initial={{ opacity: 0, strokeDashoffset: circumference }}
                animate={{ opacity: 1, strokeDashoffset: -strokeDashoffset }}
                transition={{
                  opacity: { duration: 0.3, delay: index * animationDelayPerSegment },
                  strokeDashoffset: {
                    duration: animationDuration,
                    delay: index * animationDelayPerSegment,
                    ease: "easeOut",
                  },
                }}
                style={{
                  transformOrigin: "center",
                  cursor: highlightOnHover ? "pointer" : "default",
                  filter: isActive ? `drop-shadow(0px 0px 6px ${segment.color}) brightness(1.1)` : "none",
                  transform: isActive ? "scale(1.03)" : "scale(1)",
                  transition: "filter 0.2s ease-out, transform 0.2s ease-out",
                }}
                onMouseEnter={() => setHoveredSegment(segment)}
                onClick={() => onSegmentClick?.(segment)}
              />
            );
          })}
        </AnimatePresence>
      </svg>

      {centerContent && (
        <div
          className="donut-svg-center-content"
          style={{ width: size - strokeWidth * 2.5, height: size - strokeWidth * 2.5 }}
        >
          {centerContent}
        </div>
      )}
    </div>
  );
}
