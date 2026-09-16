import { useEffect, useState } from "react";
import {
  ResponsiveContainer, ComposedChart, Line, Area, XAxis, YAxis, Tooltip, Legend, CartesianGrid,
} from "recharts";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { api } from "../api";
import { useLang } from "../i18n.jsx";
import { fmtDate } from "../dateUtils.js";

function CustomTooltip({ active, payload, money, t }) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  return (
    <div className="trend-tooltip">
      <div className="trend-tooltip-date">{d.label}</div>
      <div className="trend-tooltip-row">
        <span className="trend-tooltip-dot" style={{ background: "var(--primary)" }} />
        {t("totalBalance")}: <strong>{money(d.total_balance)}</strong>
      </div>
      <div className="trend-tooltip-row">
        <span className="trend-tooltip-dot" style={{ background: "#F06050" }} />
        {t("overdue")}: <strong>{money(d.total_overdue)}</strong>
      </div>
      <div className="trend-tooltip-row">
        <span className="trend-tooltip-dot" style={{ background: "#30C381" }} />
        {t("collectedThatDay")}: <strong>{money(d.collected_today)}</strong>
      </div>
    </div>
  );
}

export default function Trends() {
  const { t, money } = useLang();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.trends(90).then(setData).catch((e) => setError(e.message));
  }, []);

  const chartData = data?.map((d) => ({
    ...d,
    label: fmtDate(d.date),
  }));

  let stats = null;
  if (chartData && chartData.length > 0) {
    const latest = chartData[chartData.length - 1];
    const previous = chartData.length > 1 ? chartData[chartData.length - 2] : latest;
    const changeAmt = latest.total_balance - previous.total_balance;
    const changePct = previous.total_balance ? (changeAmt / previous.total_balance) * 100 : 0;
    const highBalance = Math.max(...chartData.map((d) => d.total_balance));
    const lowBalance = Math.min(...chartData.map((d) => d.total_balance));
    stats = { latest, changeAmt, changePct, highBalance, lowBalance };
  }

  // Only draws a visible dot at the start, end, and the high/low extremes of
  // the Total Balance line - matching the reference design's "callout" dots
  // instead of a dot on every single day (which would look cluttered over 90
  // points).
  const renderBalanceDot = (props) => {
    const { cx, cy, payload, index } = props;
    const isEdge = index === 0 || index === chartData.length - 1;
    const isExtreme = stats && (payload.total_balance === stats.highBalance || payload.total_balance === stats.lowBalance);
    if (!isEdge && !isExtreme) return <g key={`dot-${payload.label}`} />;
    return (
      <circle
        key={`dot-${payload.label}`}
        cx={cx}
        cy={cy}
        r={5}
        fill="var(--primary)"
        stroke="#fff"
        strokeWidth={2}
      />
    );
  };

  return (
    <div className="content-stack" style={{ maxWidth: "100%" }}>
      <div className="panel">
        <h2>{t("trendsTitle")}</h2>
        <p className="panel-sub">{t("trendsHint")}</p>

        {error && <div className="error-state">{error}</div>}
        {!error && !data && <div className="loading-state">{t("loadingDots")}</div>}
        {data && data.length === 0 && (
          <div className="empty-state">{t("noTrendData")}</div>
        )}

        {chartData && chartData.length > 0 && stats && (
          <>
            <div className="trend-stat-header">
              <div className="trend-stat-label">{t("totalBalance")}</div>
              <div className="trend-stat-value-row">
                <span className="trend-stat-value">{money(stats.latest.total_balance)}</span>
                <span className={`trend-stat-badge ${stats.changePct > 0 ? "up" : stats.changePct < 0 ? "down" : "flat"}`}>
                  {stats.changePct > 0 && <TrendingUp size={13} />}
                  {stats.changePct < 0 && <TrendingDown size={13} />}
                  {stats.changePct === 0 && <Minus size={13} />}
                  {stats.changePct > 0 ? "+" : ""}{stats.changePct.toFixed(1)}%
                </span>
              </div>
            </div>

            <div className="trend-stats-row">
              <span>{t("high")}: <strong className="trend-stat-high">{money(stats.highBalance)}</strong></span>
              <span>{t("low")}: <strong className="trend-stat-low">{money(stats.lowBalance)}</strong></span>
              <span>{t("changeLabel")}: <strong className={stats.changeAmt >= 0 ? "trend-stat-high" : "trend-stat-low"}>
                {stats.changeAmt >= 0 ? "+" : ""}{money(stats.changeAmt)}
              </strong></span>
            </div>

            <ResponsiveContainer width="100%" height={340}>
              <ComposedChart data={chartData} margin={{ top: 20, right: 10, left: 5, bottom: 5 }}>
                <defs>
                  <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                  <filter id="lineGlow" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="0" dy="2" stdDeviation="5" floodColor="#714b67" floodOpacity="0.45" />
                  </filter>
                </defs>
                <XAxis dataKey="label" stroke="#6b7280" fontSize={11} tickLine={false} axisLine={false} tickMargin={10} />
                <YAxis stroke="#6b7280" fontSize={11} tickLine={false} axisLine={false}
                       tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} />
                <CartesianGrid strokeDasharray="4 6" stroke="var(--border)" vertical={false} />
                <Tooltip content={<CustomTooltip money={money} t={t} />} cursor={{ stroke: "var(--border)", strokeDasharray: "3 3" }} />
                <Legend wrapperStyle={{ fontSize: 12, color: "#6b7280" }} />
                <Area type="monotone" dataKey="total_balance" fill="url(#balanceGradient)" stroke="none" legendType="none" />
                <Line type="monotone" dataKey="total_balance" name={t("totalBalance")} stroke="var(--primary)" strokeWidth={2.5} dot={renderBalanceDot} filter="url(#lineGlow)" />
                <Line type="monotone" dataKey="total_overdue" name={t("overdue")} stroke="#F06050" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="collected_today" name={t("collectedThatDay")} stroke="#30C381" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </>
        )}
      </div>
    </div>
  );
}
