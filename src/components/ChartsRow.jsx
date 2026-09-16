import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  Cell, Legend,
} from "recharts";
import { AnimatePresence, motion } from "framer-motion";
import { useLang } from "../i18n.jsx";
import DonutChart from "./DonutChart.jsx";
import { ODOO_COLORS } from "../chartColors.js";
import { useState } from "react";

function fmt(n) {
  return Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 0 });
}

const TOOLTIP_STYLE = {
  background: "#ffffff",
  border: "1px solid #e6e9f2",
  borderRadius: 8,
  fontSize: 12,
  color: "#1c2233",
  boxShadow: "0 4px 14px rgba(16,24,40,0.10)",
};

export default function ChartsRow({
  kpis, statusCounts, followupStatusCounts, activeCity, onCityClick, activeAgeBucket, onAgeBucketClick,
  activeFollowupStatus, onFollowupStatusClick,
}) {
  const { t, money, statusLabel } = useLang();
  const [hoveredFollowup, setHoveredFollowup] = useState(null);
  if (!kpis) {
    return (
      <div className="charts-row">
        {[1, 2, 3, 4].map((i) => (
          <div className="chart-card" key={i}>
            <div className="skeleton-block skeleton-chart" />
          </div>
        ))}
      </div>
    );
  }
  const { balances, city_breakdown } = kpis;

  const monthlyData = [
    { name: t("lastMonth"), [t("due")]: balances.amount_due_last_month, [t("collected")]: balances.collected_last_month },
    { name: t("thisMonth"), [t("due")]: balances.amount_due_this_month, [t("collected")]: balances.collected_this_month },
  ];

  const followupEntries = Object.entries(followupStatusCounts || {}).sort((a, b) => b[1] - a[1]);
  const followupTotal = followupEntries.reduce((s, [, v]) => s + v, 0);
  const followupData = followupEntries.map(([rawStatus, value], i) => ({
    label: statusLabel(rawStatus), rawStatus, value, color: ODOO_COLORS[i % ODOO_COLORS.length],
  }));
  const followupCenterLabel = hoveredFollowup ? hoveredFollowup.label : t("totalCustomersLabel");
  const followupCenterValue = hoveredFollowup ? hoveredFollowup.value : followupTotal;
  const handleFollowupClick = (seg) => onFollowupStatusClick?.(seg.rawStatus === activeFollowupStatus ? null : seg.rawStatus);

  const ageKeys = ["1-30 Days", "31-60 Days", "61-90 Days", "90+ Days"];
  const ageCodes = { "1-30 Days": "1-30", "31-60 Days": "31-60", "61-90 Days": "61-90", "90+ Days": "90+" };
  const ageData = ageKeys.map((key) => ({
    name: key,
    code: ageCodes[key],
    amount: kpis.age_breakdown?.[key] || 0,
  }));
  const ageTotal = ageData.reduce((s, d) => s + d.amount, 0);

  return (
    <div className="charts-row" dir="ltr">
      <div className="chart-card">
        <h3 dir="auto">{t("dueVsCollected")} — {t("currency")}</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={monthlyData} barGap={6}>
            <XAxis dataKey="name" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="#6b7280" fontSize={11} tickLine={false} axisLine={false}
                   tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => money(v)} />
            <Legend wrapperStyle={{ fontSize: 12, color: "#6b7280" }} />
            <Bar dataKey={t("due")} fill="#814968" radius={[4, 4, 0, 0]} />
            <Bar dataKey={t("collected")} fill="#30C381" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-card">
        <h3 dir="auto">{t("followupStatusBreakdown")} <span style={{ fontWeight: 400, textTransform: "none", fontSize: 11 }}>({t("clickToFilter")})</span></h3>
        {followupTotal === 0 ? (
          <div className="empty-state" dir="auto">{t("noDataSync")}</div>
        ) : (
          <div className="donut-demo-wrap">
            <DonutChart
              data={followupData}
              size={165}
              strokeWidth={19}
              animationDuration={1}
              animationDelayPerSegment={0.05}
              highlightOnHover
              onSegmentHover={setHoveredFollowup}
              onSegmentClick={handleFollowupClick}
              centerContent={
                <AnimatePresence mode="wait">
                  <motion.div
                    key={followupCenterLabel}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.2, ease: "circOut" }}
                    className="donut-center-inner"
                  >
                    <div className="donut-center-label">{followupCenterLabel}</div>
                    <div className="donut-center-value">{followupCenterValue.toLocaleString()}</div>
                  </motion.div>
                </AnimatePresence>
              }
            />
            <div className="donut-legend-list">
              {followupData.map((seg) => (
                <div
                  key={seg.label}
                  className={`donut-legend-item ${hoveredFollowup?.label === seg.label || activeFollowupStatus === seg.rawStatus ? "active" : ""}`}
                  onMouseEnter={() => setHoveredFollowup(seg)}
                  onMouseLeave={() => setHoveredFollowup(null)}
                  onClick={() => handleFollowupClick(seg)}
                  style={{ cursor: "pointer" }}
                >
                  <span className="donut-legend-dot" style={{ backgroundColor: seg.color }} />
                  <span className="donut-legend-label">{seg.label}</span>
                  <span className="donut-legend-value">
                    {seg.value.toLocaleString()} · {followupTotal > 0 ? Math.round((seg.value / followupTotal) * 100) : 0}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="chart-card">
        <h3 dir="auto">{t("overdueAging")} — {t("currency")} <span style={{ fontWeight: 400, textTransform: "none", fontSize: 11 }}>({t("clickToFilter")})</span></h3>
        {ageTotal === 0 ? (
          <div className="empty-state" dir="auto">{t("noOverdue")}</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={ageData} layout="vertical" margin={{ left: 10 }}>
              <XAxis type="number" stroke="#6b7280" fontSize={11} tickLine={false} axisLine={false}
                     tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} />
              <YAxis type="category" dataKey="name" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} width={80} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => money(v)} />
              <Bar
                dataKey="amount"
                radius={[0, 4, 4, 0]}
                onClick={(data) => onAgeBucketClick?.(data.code)}
                cursor="pointer"
              >
                {ageData.map((d, i) => (
                  <Cell
                    key={d.name}
                    fill={["#F7CD1F", "#F4A460", "#F06050", "#814968"][i]}
                    opacity={activeAgeBucket && activeAgeBucket !== d.code ? 0.35 : 1}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {city_breakdown && city_breakdown.length > 0 && (
        <div className="chart-card">
          <h3 dir="auto">{t("cityBreakdown")} — {t("currency")} <span style={{ fontWeight: 400, textTransform: "none", fontSize: 11 }}>({t("clickToFilter")})</span></h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={city_breakdown} layout="vertical" margin={{ left: 10 }}>
              <XAxis type="number" stroke="#6b7280" fontSize={11} tickLine={false} axisLine={false}
                     tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} />
              <YAxis type="category" dataKey="city" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} width={90} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, n, p) => [`${money(v)} (${p.payload.customers} ${t("customersSuffix")})`, t("balanceDueLabel")]} />
              <Bar
                dataKey="balance"
                radius={[0, 4, 4, 0]}
                onClick={(data) => onCityClick?.(data.city)}
                cursor="pointer"
              >
                {city_breakdown.map((d) => (
                  <Cell
                    key={d.city}
                    fill={activeCity === d.city ? "#814968" : "#2C8397"}
                    opacity={activeCity && activeCity !== d.city ? 0.35 : 1}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
