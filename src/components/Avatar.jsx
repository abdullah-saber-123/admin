import { useState } from "react";
import { ODOO_COLORS } from "../chartColors.js";

// Generic business-entity words that appear at the start of almost every
// Saudi company name ("Company X Trading", "Est. Y") - stripping these first
// means the initials actually distinguish one customer from another instead
// of every single row collapsing to the same "شر" / "Co" glyph.
const FILLER_WORDS = [
  "شركة", "مؤسسة", "مجموعة", "مصنع", "معرض", "محل", "مكتب",
  "company", "co", "corp", "corporation", "est", "establishment", "group", "trading", "llc", "ltd",
];

const ARABIC_RE = /[\u0600-\u06FF]/;

function deriveInitials(rawName) {
  const name = (rawName || "").trim();
  if (!name) return "?";

  const words = name.split(/\s+/).filter(Boolean);
  const meaningful = words.filter((w) => !FILLER_WORDS.includes(w.toLowerCase().replace(/[.,]/g, "")));
  const source = (meaningful.length > 0 ? meaningful : words).join(" ");
  const firstChar = source.charAt(0);

  // Arabic letters connect into a single glyph-like shape when two are put
  // side by side at this size, which just looks like a blob - one bold
  // letter reads far more clearly than two.
  if (ARABIC_RE.test(firstChar)) {
    return firstChar.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

// Deterministic pick from the Odoo palette so the same customer always gets
// the same color across the app, but different customers are visually
// distinct instead of every avatar being the exact same flat gradient.
function colorForName(name) {
  const str = name || "?";
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return ODOO_COLORS[Math.abs(hash) % ODOO_COLORS.length];
}

/**
 * Avatar - shows a profile photo if one is given and loads successfully,
 * otherwise falls back to a colored circle with initials (same look the app
 * already used everywhere). This replaces every hand-written
 * `<span className="avatar">{initials}</span>` with one shared component, so
 * adding real profile photos later (staff/customers) only needs a `src` prop
 * wherever this is used - no other markup changes.
 *
 * Props:
 *   name   - used to derive the fallback initials (required)
 *   src    - optional photo URL; if it fails to load, falls back to initials
 *   size   - "sm" | "md" (default "md") - matches the existing .avatar/.avatar.sm CSS
 */
export default function Avatar({ name, src, size = "md", className = "" }) {
  const [imgFailed, setImgFailed] = useState(false);
  const initials = deriveInitials(name);
  const color = colorForName(name);
  const sizeClass = size === "sm" ? "sm" : size === "lg" ? "lg" : "";

  if (src && !imgFailed) {
    return (
      <img
        src={src}
        alt={name || "avatar"}
        className={`avatar avatar-photo ${sizeClass} ${className}`.trim()}
        onError={() => setImgFailed(true)}
      />
    );
  }

  return (
    <span
      className={`avatar ${sizeClass} ${className}`.trim()}
      style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)` }}
    >
      {initials}
    </span>
  );
}
