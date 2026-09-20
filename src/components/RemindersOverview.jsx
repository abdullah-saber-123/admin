import { useEffect, useState } from "react";
import { BellRing, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { api } from "../api";
import { useLang } from "../i18n.jsx";
import { fmtDate } from "../dateUtils.js";
import RiyalAmount from "./RiyalAmount.jsx";

export default function RemindersOverview({ onSelectCustomer }) {
  const { t, statusLabel } = useLang();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [collectors, setCollectors] = useState([]);
  const [collectorFilter, setCollectorFilter] = useState("");
  const [statuses, setStatuses] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [overdueFilter, setOverdueFilter] = useState(""); // "" | "overdue" | "today"
  const [sortBy, setSortBy] = useState("next_follow_up_date");
  const [sortDir, setSortDir] = useState("asc");

  const toggleSort = (col) => {
    if (sortBy === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col);
      setSortDir("asc");
    }
  };

  const sortIcon = (col) => {
    if (sortBy !== col) return <ArrowUpDown size={11} style={{ opacity: 0.4 }} />;
    return sortDir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />;
  };

  useEffect(() => {
    api.collectors().then(setCollectors).catch(() => {});
    api.followupStatuses().then(setStatuses).catch(() => {});
  }, []);

  useEffect(() => {
    setError(null);
    api.remindersOverview(collectorFilter).then(setRows).catch((e) => setError(e.message));
  }, [collectorFilter]);

  const overdueCount = rows ? rows.filter((r) => r.is_overdue).length : 0;
  const todayCount = rows ? rows.filter((r) => !r.is_overdue).length : 0;

  const filteredRows = rows
    ? rows.filter((r) => {
        if (statusFilter && r.follow_up_status !== statusFilter) return false;
        if (overdueFilter === "overdue" && !r.is_overdue) return false;
        if (overdueFilter === "today" && r.is_overdue) return false;
        return true;
      })
    : null;

  const sortedRows = filteredRows ? [...filteredRows].sort((a, b) => {
    let cmp = 0;
    if (sortBy === "follow_up_status") {
      cmp = (statusLabel(a.follow_up_status) || "").localeCompare(statusLabel(b.follow_up_status) || "", "ar");
    } else if (sortBy === "next_follow_up_date") {
      cmp = new Date(a.next_follow_up_date || 0) - new Date(b.next_follow_up_date || 0);
    }
    return sortDir === "asc" ? cmp : -cmp;
  }) : null;

  return (
    <div className="content-stack" style={{ maxWidth: "100%" }}>
      <div className="panel">
        <h2><BellRing size={15} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />{t("remindersOverviewTitle")}</h2>
        <p className="panel-sub">{t("remindersOverviewHint")}</p>

        <div className="more-filters-row" style={{ marginBottom: 14 }}>
          <div className="more-filter-field">
            <label>{t("collectorField")}</label>
            <select value={collectorFilter} onChange={(e) => setCollectorFilter(e.target.value)}>
              <option value="">{t("allStatus")}</option>
              {collectors.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="more-filter-field">
            <label>{t("followUp")}</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">{t("allStatus")}</option>
              {statuses.map((s) => (
                <option key={s.id} value={s.name}>{statusLabel(s.name)}</option>
              ))}
            </select>
          </div>
        </div>

        {rows && rows.length > 0 && (
          <div className="table-totals-row" style={{ marginBottom: 14 }}>
            <span
              className={`table-totals-item clickable-row ${overdueFilter === "today" ? "active-filter" : ""}`}
              onClick={() => setOverdueFilter((v) => (v === "today" ? "" : "today"))}
            >
              {t("dueToday")}: <strong>{todayCount}</strong>
            </span>
            <span
              className={`table-totals-item clickable-row ${overdueFilter === "overdue" ? "active-filter" : ""}`}
              onClick={() => setOverdueFilter((v) => (v === "overdue" ? "" : "overdue"))}
            >
              {t("overdueReminders")}: <strong style={{ color: "var(--danger)" }}>{overdueCount}</strong>
            </span>
          </div>
        )}

        {error && <div className="error-state">{error}</div>}
        {!error && !rows && <div className="loading-state">{t("loadingDots")}</div>}
        {sortedRows && sortedRows.length === 0 && <div className="empty-state">{t("noActivity")}</div>}

        {sortedRows && sortedRows.length > 0 && (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t("customer")}</th>
                  <th>{t("collectorField")}</th>
                  <th className="sortable" onClick={() => toggleSort("follow_up_status")}>{t("followUp")} {sortIcon("follow_up_status")}</th>
                  <th className="sortable" onClick={() => toggleSort("next_follow_up_date")}>{t("nextFollowUpDate")} {sortIcon("next_follow_up_date")}</th>
                  <th>{t("balanceDue")}</th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((r) => (
                  <tr key={r.partner_id}>
                    <td data-label={t("customer")} className="clickable-row" onClick={() => onSelectCustomer?.(r.partner_id)}>
                      <span className="cust-name">{r.name}</span>
                    </td>
                    <td data-label={t("collectorField")}>{r.collector || "—"}</td>
                    <td data-label={t("followUp")}>{r.follow_up_status ? statusLabel(r.follow_up_status) : "—"}</td>
                    <td data-label={t("nextFollowUpDate")}>
                      <span className={r.is_overdue ? "overdue-text" : ""}>{fmtDate(r.next_follow_up_date)}</span>
                      {r.is_overdue && <span className="fu-tag sm danger" style={{ marginInlineStart: 6 }}>{t("overdueReminders")}</span>}
                    </td>
                    <td data-label={t("balanceDue")}><RiyalAmount amount={r.current_due} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
