import { useEffect, useState } from "react";
import {
  ResponsiveContainer, ComposedChart, Line, Area, XAxis, YAxis, Tooltip, Legend, CartesianGrid,
} from "recharts";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { api } from "../api";
import { useLang } from "../i18n.jsx";
import { fmtDate } from "../dateUtils.js";

const FORECAST_DAYS = 14;
const MIN_POINTS_FOR_FORECAST = 7;

// A simple linear-trend projection (least-squares fit over the historical
// points) extended a fixed number of days into the future - not a real
// predictive model, just "if the current trend keeps going in a straight
// line". Deliberately simple and clearly labeled as such in the UI.
function linearForecast(points, days) {
  const n = points.length;
  const sumX = points.reduce((a, _, i) => a + i, 0);
  const sumY = points.reduce((a, p) => a + p, 0);
  const sumXY = points.reduce((a, p, i) => a + i * p, 0);
  const sumX2 = points.reduce((a, _, i) => a + i * i, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return null;
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return Array.from({ length: days }, (_, i) => Math.max(0, intercept + slope * (n + i)));
}

function CustomTooltip({ active, payload, money, t }) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  const isForecastOnly = d.total_balance == null && d.forecast_total_balance != null;
  return (
    <div className="trend-tooltip">
      <div className="trend-tooltip-date">{d.label}</div>
      {isForecastOnly ? (
        <div className="trend-tooltip-row">
          <span className="trend-tooltip-dot" style={{ background: "var(--primary)" }} />
          {t("forecastLabel")}: <strong>{money(d.forecast_total_balance)}</strong>
        </div>
      ) : (
        <>
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
        </>
      )}
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

  let forecastChartData = chartData;
  let forecastAvailable = false;
  if (chartData && chartData.length >= MIN_POINTS_FOR_FORECAST) {
    const forecastValues = linearForecast(chartData.map((d) => d.total_balance), FORECAST_DAYS);
    if (forecastValues) {
      forecastAvailable = true;
      const lastDate = new Date(chartData[chartData.length - 1].date);
      const withMarker = chartData.map((d, i) => (
        i === chartData.length - 1 ? { ...d, forecast_total_balance: d.total_balance } : d
      ));
      const futurePoints = forecastValues.map((v, i) => {
        const d = new Date(lastDate);
        d.setUTCDate(d.getUTCDate() + i + 1);
        return { label: fmtDate(d), forecast_total_balance: Math.round(v) };
      });
      forecastChartData = [...withMarker, ...futurePoints];
    }
  }

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
              <ComposedChart data={forecastChartData} margin={{ top: 20, right: 10, left: 5, bottom: 5 }}>
                <defs>
                  <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                  <filter id="lineGlow" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="0" dy="2" stdDeviation="5" floodColor="#5750f1" floodOpacity="0.45" />
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
                {forecastAvailable && (
                  <Line type="monotone" dataKey="forecast_total_balance" name={t("forecastLabel")} stroke="var(--primary)" strokeWidth={2} strokeDasharray="6 4" dot={false} connectNulls />
                )}
              </ComposedChart>
            </ResponsiveContainer>
            {forecastAvailable && <p className="panel-sub" style={{ marginTop: 8 }}>{t("forecastHint")}</p>}
          </>
        )}
      </div>
    </div>
  );
}
