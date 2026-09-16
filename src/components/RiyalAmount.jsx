import riyalIcon from "../assets/riyal.svg";
import { useCountUp } from "../hooks/useCountUp";

function fmtNum(n) {
  if (n === null || n === undefined) return "0.00";
  return Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Displays a monetary amount with the official Saudi Riyal symbol (SAMA, Feb 2025).
 * Per SAMA's usage guidelines the symbol is always placed to the LEFT of the number,
 * in both English and Arabic - so this component doesn't need to flip order per language.
 *
 * Pass `animate` for prominent single values (KPI cards) where a count-up on load
 * and on value change adds a nice touch - left off everywhere else (table rows, etc.)
 * since animating dozens of numbers at once would be distracting, not delightful.
 */
export default function RiyalAmount({ amount, bold, className = "", animate = false }) {
  const { value, isAnimating } = useCountUp(amount, animate ? 800 : 0);
  return (
    <span
      className={`riyal-amount ${className} ${animate && isAnimating ? "riyal-amount-animating" : ""}`}
      style={bold ? { fontWeight: 700 } : undefined}
    >
      <img src={riyalIcon} alt="SAR" className="riyal-icon" />
      {fmtNum(value)}
    </span>
  );
}
