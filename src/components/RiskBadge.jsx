import { useLang } from "../i18n.jsx";

const RISK_STYLES = {
  high: { bg: "var(--danger-soft)", fg: "var(--danger)" },
  medium: { bg: "var(--warn-soft)", fg: "var(--warn)" },
  low: { bg: "var(--ok-soft)", fg: "var(--ok)" },
};

export default function RiskBadge({ level, size = "sm" }) {
  const { t } = useLang();
  if (!level) return null;
  const style = RISK_STYLES[level] || RISK_STYLES.low;
  return (
    <span
      className={`fu-tag ${size}`}
      style={{ background: style.bg, color: style.fg, fontWeight: 700 }}
      title={t("riskScoreHint")}
    >
      {t(`riskLevel_${level}`)}
    </span>
  );
}
