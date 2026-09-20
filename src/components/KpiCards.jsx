import { useState } from "react";
import { Users, Wallet, AlertTriangle, Clock, CalendarClock, TimerReset, HeartCrack, ShieldAlert, Gift, Zap, ClipboardCheck, HandCoins, SlidersHorizontal, Gauge, TrendingUp } from "lucide-react";
import { useLang } from "../i18n.jsx";
import { useCountUp } from "../hooks/useCountUp";
import RiyalAmount from "./RiyalAmount.jsx";
import KpiIcon from "./KpiIcon.jsx";
import moneyIconSvg from "../assets/icons/money.svg";
import clockTimerLottie from "../assets/icons/clock-timer.json";
import warningLottie from "../assets/icons/warning.json";
import bellLottie from "../assets/icons/bell.json";

function fmt(n) {
  if (n === null || n === undefined) return "0";
  return Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 });
}

/** Plain integer count (not money) that counts up on load and re-counts whenever
 * the value changes (e.g. after a background sync brings in a fresh number). */
function AnimatedCount({ value }) {
  const { value: display, isAnimating } = useCountUp(value, 800);
  return <span className={isAnimating ? "kpi-value-animating" : ""}>{fmt(Math.round(display))}</span>;
}

// Cards NOT in this list are "core" - always shown, no toggle. Cards in this
// list are optional/extra - hidden by default unless the person turns them on
// (except promised_5days, which is useful enough to default ON). Persisted so
// the choice sticks across visits.
const OPTIONAL_CARD_IDS = [
  "over_credit_limit", "nominated", "nominated_collection", "followups_today_log",
  "late", "due_today", "due_5days",
];
const DEFAULT_VISIBLE_OPTIONAL = { promised_5days: true, late: true, due_today: true, due_5days: true };

export default function KpiCards({ kpis, onCardClick, activeBucket }) {
  const { t, money } = useLang();
  const [visibleOptional, setVisibleOptional] = useState(() => {
    try {
      const saved = localStorage.getItem("collect_kpi_visible");
      return saved ? { ...DEFAULT_VISIBLE_OPTIONAL, ...JSON.parse(saved) } : DEFAULT_VISIBLE_OPTIONAL;
    } catch {
      return DEFAULT_VISIBLE_OPTIONAL;
    }
  });
  const [showMenu, setShowMenu] = useState(false);

  const toggleCard = (id) => {
    setVisibleOptional((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      localStorage.setItem("collect_kpi_visible", JSON.stringify(next));
      return next;
    });
  };

  if (!kpis) {
    return (
      <div className="kpi-grid">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="kpi-card skeleton" />
        ))}
      </div>
    );
  }

  const { appointments, balances, broken_promise_count, my_target, dso_days, collection_rate_ttm } = kpis;

  const allCards = [
    {
      id: "total_customers",
      icon: Users, iconAnim: "anim-bounce", label: t("totalCustomers"), value: <AnimatedCount value={balances.total_customers} />, tone: "indigo",
    },
    {
      id: "total_balance",
      icon: Wallet, iconSvg: moneyIconSvg, label: t("totalCurrentBalance"), value: <RiyalAmount amount={balances.total_balance} animate />, tone: "blue",
    },
    {
      id: "total_overdue",
      icon: Wallet, label: t("totalOverdueBalance"), value: <RiyalAmount amount={balances.total_overdue} animate />, tone: "red",
    },
    {
      id: "dso_days",
      icon: Gauge, label: t("dsoKpiLabel"), value: dso_days !== null && dso_days !== undefined ? `${dso_days} ${t("daysUnit")}` : "—", tone: "amber",
    },
    {
      id: "collection_rate_ttm",
      icon: TrendingUp, label: t("collectionRateKpiLabel"), value: collection_rate_ttm !== null && collection_rate_ttm !== undefined ? `${collection_rate_ttm}%` : "—", tone: "teal",
    },
    {
      id: "overdue_45",
      icon: AlertTriangle, iconLottie: warningLottie, label: t("overdue45"), value: <><bdi><AnimatedCount value={balances.customers_45_plus_days} /></bdi> {t("customersSuffix")}</>,
      sub: <RiyalAmount amount={balances.balance_45_plus_days} animate />, tone: "red", bucket: "overdue_45",
    },
    {
      id: "late", icon: Clock, iconAnim: "anim-tick", label: t("lateFollowUps"), value: <AnimatedCount value={appointments.late} />, tone: "orange", bucket: "late",
    },
    {
      id: "due_today", icon: CalendarClock, iconLottie: clockTimerLottie, label: t("dueToday"), value: <AnimatedCount value={appointments.due_today} />, tone: "amber", bucket: "due_today",
    },
    {
      id: "due_5days", icon: TimerReset, iconAnim: "anim-spin-slow", label: t("dueIn5Days"), value: <AnimatedCount value={appointments.due_within_5_days} />, tone: "teal", bucket: "due_5days",
    },
    {
      id: "broken_promise", icon: HeartCrack, iconAnim: "anim-heartbreak", label: t("brokenPromises"), value: <AnimatedCount value={broken_promise_count || 0} />, tone: "red", bucket: "broken_promise",
    },
    {
      id: "promised_5days", icon: HandCoins, iconAnim: "anim-coin-flip", label: t("promisedWithin5Days"), value: <AnimatedCount value={balances.promised_5days_count || 0} />, tone: "teal", bucket: "promised_5days",
    },
    {
      id: "promised_soon", icon: HandCoins, iconAnim: "anim-coin-flip", label: t("promisedNext5Days"), value: <AnimatedCount value={balances.promised_soon_count || 0} />, tone: "teal", bucket: "promised_soon",
    },
    {
      id: "over_credit_limit", icon: ShieldAlert, iconAnim: "anim-shake", label: t("overCreditLimit"), value: <AnimatedCount value={balances.over_credit_limit_count || 0} />, tone: "red", bucket: "over_credit_limit",
    },
    {
      id: "nominated", icon: Gift, iconAnim: "anim-wiggle", label: t("nominatedForOffer"), value: <AnimatedCount value={balances.nominated_count || 0} />, tone: "teal", bucket: "nominated",
    },
    {
      id: "nominated_collection", icon: Zap, iconAnim: "anim-flash", label: t("nominatedForCollectionCard"), value: <AnimatedCount value={balances.nominated_collection_count || 0} />, tone: "orange", bucket: "nominated_collection",
    },
    {
      id: "followups_today_log", icon: ClipboardCheck, iconLottie: bellLottie, label: t("followupsToday"), value: <AnimatedCount value={balances.followups_today_count || 0} />, tone: "violet", bucket: "followups_today_log",
    },
  ];

  const cards = allCards.filter((c) => !OPTIONAL_CARD_IDS.includes(c.id) || visibleOptional[c.id]);

  return (
    <>
      <div className="kpi-toolbar">
        <div className="kpi-menu-wrap">
          <button className="btn-secondary sm" onClick={() => setShowMenu((v) => !v)}>
            <SlidersHorizontal size={13} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />
            {t("customizeCards")}
          </button>
          {showMenu && (
            <>
              <div className="columns-menu-backdrop" onClick={() => setShowMenu(false)} />
              <div className="columns-menu">
                {OPTIONAL_CARD_IDS.map((id) => {
                  const card = allCards.find((c) => c.id === id);
                  return (
                    <label key={id} className="multiselect-item">
                      <input type="checkbox" checked={!!visibleOptional[id]} onChange={() => toggleCard(id)} />
                      {card?.label}
                    </label>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="kpi-grid">
        {cards.map((c) => (
          <div
            key={c.id}
            className={`kpi-card ${c.bucket ? "clickable" : ""} ${activeBucket === c.bucket ? "kpi-active" : ""}`}
            onClick={c.bucket ? () => onCardClick(c.bucket) : undefined}
          >
            <div className={`kpi-icon ${c.tone}`}>
              <span className={c.iconAnim || ""}>
                <KpiIcon Icon={c.icon} svg={c.iconSvg} lottie={c.iconLottie} size={c.iconSvg || c.iconLottie ? 26 : 18} />
              </span>
            </div>
            <div className="kpi-text">
              <div className="kpi-label">{c.label}</div>
              <div className="kpi-value">{c.value}</div>
              {c.sub && <div className="kpi-sub">{c.sub}</div>}
            </div>
          </div>
        ))}
      </div>

      {my_target && (
        <div className="target-card">
          <div className="target-head">
            <span>{t("monthlyTarget")}</span>
            <span><RiyalAmount amount={my_target.collected_this_month} animate /> / <RiyalAmount amount={my_target.target} /></span>
          </div>
          <div className="target-track">
            <div className="target-fill" style={{ width: `${my_target.progress_pct}%` }} />
            {my_target.days_in_month > 0 && (
              <div
                className="target-timeline-marker"
                title={t("monthTimelineLabel").replace("{elapsed}", my_target.days_elapsed).replace("{total}", my_target.days_in_month)}
                style={{ insetInlineStart: `${Math.min(100, (my_target.days_elapsed / my_target.days_in_month) * 100)}%` }}
              />
            )}
          </div>
          {my_target.days_in_month > 0 && (
            <div className="target-timeline-label">
              {t("monthTimelineLabel").replace("{elapsed}", my_target.days_elapsed).replace("{total}", my_target.days_in_month)}
            </div>
          )}
        </div>
      )}
    </>
  );
}
