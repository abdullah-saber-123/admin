import { useEffect, useState } from "react";
import { Target, Users2, Wallet, Trophy, TrendingUp, Search, Download, ArrowUp, ArrowDown, Minus, ArrowUpDown, X, ChevronRight, ShieldCheck, Users } from "lucide-react";
import { api } from "../api";
import Avatar from "./Avatar.jsx";
import { useLang } from "../i18n.jsx";
import { useToast } from "../toast.jsx";
import { parseServerDate, fmtDate, fmtDateTime } from "../dateUtils.js";
import RiyalAmount from "./RiyalAmount.jsx";
import PromptModal from "./PromptModal.jsx";
import DonutChart from "./DonutChart.jsx";
import { ODOO_COLORS } from "../chartColors.js";
import { motion, AnimatePresence } from "framer-motion";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from "recharts";

const STATUS_CHIP_COLORS = {
  not_paid: { bg: "#F4A46022", fg: "#a06a2a" },
  paid: { bg: "#30C38122", fg: "#1f9d68" },
  in_payment: { bg: "#5750f122", fg: "#5750f1" },
  partial: { bg: "#D6145F22", fg: "#D6145F" },
  reversed: { bg: "#8a8f9822", fg: "#6b7078" },
};
const STATUS_CHIP_LABELS = { not_paid: "statusPosted", paid: "statusPaid", in_payment: "statusInPayment", partial: "statusPartial", reversed: "statusReversed" };

const CHART_TOOLTIP_STYLE = {
  background: "#ffffff",
  border: "1px solid #e6e9f2",
  borderRadius: 8,
  fontSize: 12,
  color: "#1c2233",
  boxShadow: "0 4px 14px rgba(16,24,40,0.10)",
};

function timeAgo(iso, t) {
  if (!iso) return t("noActivity");
  const diffMin = Math.round((Date.now() - parseServerDate(iso).getTime()) / 60000);
  if (diffMin < 1) return "0m";
  if (diffMin < 60) return `${diffMin}m`;
  if (diffMin < 1440) return `${Math.round(diffMin / 60)}h`;
  return `${Math.round(diffMin / 1440)}d`;
}

export default function CollectorReport({ onOpenProfile }) {
  const { t, money } = useLang();
  const { showToast } = useToast();
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [targetModal, setTargetModal] = useState(null); // holds the collector row being edited
  const [hoveredContact, setHoveredContact] = useState(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("collected_this_month");
  const [sortDir, setSortDir] = useState("desc");
  const [statusModal, setStatusModal] = useState(null); // { collector, state, label }
  const [profileTarget, setProfileTarget] = useState(null); // user_id of collector whose profile page is open
  const [supervisionModal, setSupervisionModal] = useState(null); // holds the collector row being edited
  const [staffList, setStaffList] = useState([]);

  const load = () => {
    api.collectorReport().then(setReport).catch((e) => setError(e.message));
  };

  useEffect(load, []);
  useEffect(() => { api.staffList().then(setStaffList).catch(() => {}); }, []);

  const handleSetTarget = async (value) => {
    const num = parseFloat(value);
    if (isNaN(num) || num < 0) {
      showToast("Enter a valid number.", "error");
      return;
    }
    try {
      await api.setUserTarget(targetModal.id, num);
      setTargetModal(null);
      load();
      showToast("Target updated.", "success");
    } catch (e) {
      showToast(e.message, "error");
    }
  };

  const toggleSort = (col) => {
    if (sortBy === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col);
      setSortDir("desc");
    }
  };

  const sortIcon = (col) => {
    if (sortBy !== col) return <ArrowUpDown size={11} style={{ opacity: 0.4 }} />;
    return sortDir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />;
  };

  const visibleRows = (report || [])
    .filter((r) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (r.full_name || "").toLowerCase().includes(q)
        || r.username.toLowerCase().includes(q)
        || (r.collector || "").toLowerCase().includes(q);
    })
    .sort((a, b) => {
      const av = a[sortBy] ?? 0;
      const bv = b[sortBy] ?? 0;
      if (typeof av === "string") return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === "asc" ? av - bv : bv - av;
    });

  const exportCsv = () => {
    const headers = [t("collector"), t("assignedTo"), t("customersCol"), t("totalDue"), t("overdue"), t("collectedThisMonth"), t("collectedLastMonth"), t("target"), t("worked"), t("paidByLabel")];
    const rows = visibleRows.map((r) => [
      r.full_name || r.username, r.collector || "", r.customers_count, r.total_due, r.overdue_amount,
      r.collected_this_month, r.collected_last_month, r.monthly_target, `${r.contacted_count}/${r.customers_count}`,
      `${r.paid_count || 0}/${r.customers_count}`,
    ]);
    const csv = [headers, ...rows].map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "collector-performance.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="content-stack" style={{ maxWidth: "100%" }}>
      <div className="panel">
        <h2>{t("collectorPerformance")}</h2>
        <p className="panel-sub">{t("collectorPerformanceHint")}</p>

        <CollectorInsights report={report} t={t} money={money} hoveredContact={hoveredContact} setHoveredContact={setHoveredContact} />

        {report && report.length > 0 && (
          <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
            <div className="search-bar" style={{ maxWidth: 260 }}>
              <Search size={14} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("searchCollectorPlaceholder")} />
            </div>
            <button className="btn-secondary sm" onClick={exportCsv} style={{ marginInlineStart: "auto" }}>
              <Download size={13} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />
              {t("export")}
            </button>
          </div>
        )}

        {error && <div className="error-state">{error}</div>}
        {!error && !report && <div className="loading-state">{t("loadingDots")}</div>}
        {report && report.length === 0 && (
          <div className="empty-state">{t("noCollectors")}</div>
        )}
        {report && report.length > 0 && visibleRows.length === 0 && (
          <div className="empty-state">{t("noMatch")}</div>
        )}

        {report && visibleRows.length > 0 && (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="sortable" onClick={() => toggleSort("full_name")}>{t("collector")} {sortIcon("full_name")}</th>
                  <th>{t("assignedTo")}</th>
                  <th className="sortable" onClick={() => toggleSort("customers_count")}>{t("customersCol")} {sortIcon("customers_count")}</th>
                  <th className="sortable" onClick={() => toggleSort("total_due")}>{t("totalDue")} {sortIcon("total_due")}</th>
                  <th className="sortable" onClick={() => toggleSort("overdue_amount")}>{t("overdue")} {sortIcon("overdue_amount")}</th>
                  <th className="sortable" onClick={() => toggleSort("collected_this_month")}>{t("collectedThisMonth")} {sortIcon("collected_this_month")}</th>
                  <th>{t("trend")}</th>
                  <th>{t("collectedLastMonth")}</th>
                  <th>{t("target")}</th>
                  <th>{t("dailyTargetLabel")}</th>
                  <th>{t("supervisionLabel")}</th>
                  <th>{t("worked")}</th>
                  <th>{t("paidByLabel")}</th>
                  <th>{t("invoiceStatusLabel")}</th>
                  <th className="sortable" onClick={() => toggleSort("last_activity")}>{t("lastActivity")} {sortIcon("last_activity")}</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((r) => {
                  const trendPct = r.collected_last_month > 0
                    ? Math.round(((r.collected_this_month - r.collected_last_month) / r.collected_last_month) * 100)
                    : (r.collected_this_month > 0 ? 100 : 0);
                  return (
                    <tr key={r.username} className="clickable-row" onClick={() => setProfileTarget(r)}>
                      <td>
                        <div className="cust-cell">
                          <Avatar name={r.username} size="sm" />
                          <span className="cust-name">{r.full_name || r.username}</span>
                        </div>
                      </td>
                      <td>
                        {r.collector || <span style={{ color: "var(--danger)" }}>{t("unassigned")}</span>}
                        {r.duplicate_accounts && r.duplicate_accounts.length > 0 && (
                          <div
                            className="fu-tag sm warn"
                            style={{ marginTop: 4, width: "fit-content", cursor: "default" }}
                            title={t("duplicateAccountHint").replace("{usernames}", r.duplicate_accounts.join(", "))}
                          >
                            <Users size={11} style={{ verticalAlign: -1, marginInlineEnd: 3 }} />
                            {t("duplicateAccountBadge")}
                          </div>
                        )}
                      </td>
                      <td>{r.customers_count}</td>
                      <td className={r.total_due > 0 ? "due-amount has-balance" : "due-amount zero"}>
                        <RiyalAmount amount={r.total_due} />
                      </td>
                      <td className={r.overdue_amount > 0 ? "due-amount has-balance" : "due-amount zero"}>
                        <RiyalAmount amount={r.overdue_amount} />
                      </td>
                      <td style={{ color: "var(--ok)", fontWeight: 700 }}><RiyalAmount amount={r.collected_this_month} /></td>
                      <td>
                        {trendPct > 0 && (
                          <span className="trend-pill up"><ArrowUp size={11} />{trendPct}%</span>
                        )}
                        {trendPct < 0 && (
                          <span className="trend-pill down"><ArrowDown size={11} />{Math.abs(trendPct)}%</span>
                        )}
                        {trendPct === 0 && (
                          <span className="trend-pill flat"><Minus size={11} />0%</span>
                        )}
                      </td>
                      <td><RiyalAmount amount={r.collected_last_month} /></td>
                      <td>
                        {r.monthly_target > 0 ? (
                          <span className="work-bar" style={{ cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); setTargetModal(r); }}>
                            <span className="work-bar-track">
                              <span className="work-bar-fill" style={{ width: `${r.progress_pct}%` }} />
                            </span>
                            <span className="work-bar-label">{r.progress_pct}%</span>
                          </span>
                        ) : (
                          <button className="icon-btn" title={t("target")} onClick={(e) => { e.stopPropagation(); setTargetModal(r); }}>
                            <Target size={13} />
                          </button>
                        )}
                      </td>
                      <td>
                        {r.daily_collection_target > 0 || r.daily_contact_target > 0 ? (
                          <div
                            style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 11.5, cursor: "pointer" }}
                            onClick={(e) => { e.stopPropagation(); setSupervisionModal(r); }}
                          >
                            {r.daily_collection_target > 0 && (
                              <span>{t("collectedLabel")}: {r.collection_pct ?? 0}% <span style={{ color: "var(--text-dim)" }}>({money(r.daily_collection_target)})</span></span>
                            )}
                            {r.daily_contact_target > 0 && (
                              <span>{t("contactsLabel")}: {r.contacts_today}/{r.daily_contact_target} ({r.contact_pct ?? 0}%)</span>
                            )}
                            {r.daily_flag && r.daily_flag !== "ok" && (
                              <span className={`fu-tag sm ${r.daily_flag === "critical" ? "danger" : "warn"}`}>
                                {r.daily_flag === "critical" ? t("flagCritical") : t("flagWarning")}
                              </span>
                            )}
                          </div>
                        ) : (
                          <button className="icon-btn" title={t("supervisionLabel")} onClick={(e) => { e.stopPropagation(); setSupervisionModal(r); }}>
                            <Target size={13} />
                          </button>
                        )}
                      </td>
                      <td>
                        <button
                          className="icon-btn" title={t("supervisionLabel")}
                          onClick={(e) => { e.stopPropagation(); setSupervisionModal(r); }}
                        >
                          <ShieldCheck size={13} />
                        </button>
                        {r.supervisor_username && (
                          <div style={{ fontSize: 10.5, color: "var(--text-dim)", marginTop: 2 }}>{r.supervisor_username}</div>
                        )}
                      </td>
                      <td>
                        {r.customers_count > 0 ? (
                          <span className="work-bar">
                            <span className="work-bar-track">
                              <span
                                className="work-bar-fill"
                                style={{ width: `${Math.round((r.contacted_count / r.customers_count) * 100)}%` }}
                              />
                            </span>
                            <span className="work-bar-label">{r.contacted_count}/{r.customers_count}</span>
                          </span>
                        ) : "—"}
                      </td>
                      <td>
                        {r.customers_count > 0 ? (
                          <span className="work-bar">
                            <span className="work-bar-track">
                              <span
                                className="work-bar-fill paid"
                                style={{ width: `${Math.round(((r.paid_count || 0) / r.customers_count) * 100)}%` }}
                              />
                            </span>
                            <span className="work-bar-label">{r.paid_count || 0}/{r.customers_count}</span>
                          </span>
                        ) : "—"}
                      </td>
                      <td>
                        {Object.keys(r.status_breakdown || {}).length === 0 ? "—" : (
                          <div className="collector-status-chips">
                            {Object.entries(r.status_breakdown).map(([state, info]) => (
                              <span
                                key={state}
                                className="collector-status-chip clickable-row"
                                style={{ background: STATUS_CHIP_COLORS[state]?.bg, color: STATUS_CHIP_COLORS[state]?.fg }}
                                title={`${money(info.amount)}`}
                                onClick={(e) => { e.stopPropagation(); setStatusModal({ collector: r.collector, state, label: STATUS_CHIP_LABELS[state] ? t(STATUS_CHIP_LABELS[state]) : state }); }}
                              >
                                {STATUS_CHIP_LABELS[state] ? t(STATUS_CHIP_LABELS[state]) : state}: {info.count}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td style={{ color: "var(--text-dim)", fontSize: 12 }}>{timeAgo(r.last_activity, t)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PromptModal
        open={!!targetModal}
        title={t("target")}
        type="number"
        label={targetModal ? `${targetModal.full_name || targetModal.username} (${t("currency")})` : ""}
        initialValue={targetModal?.monthly_target || ""}
        onSubmit={handleSetTarget}
        onCancel={() => setTargetModal(null)}
      />

      {statusModal && (
        <StatusInvoicesModal
          collector={statusModal.collector} state={statusModal.state} label={statusModal.label}
          onClose={() => setStatusModal(null)} t={t} money={money}
        />
      )}

      {profileTarget && (
        <CollectorProfileModal
          collector={profileTarget} onClose={() => setProfileTarget(null)}
          onOpenStatus={(state, label) => setStatusModal({ collector: profileTarget.collector, state, label })}
          t={t} money={money}
        />
      )}

      {supervisionModal && (
        <SupervisionModal
          collector={supervisionModal} staffList={staffList}
          onClose={() => setSupervisionModal(null)}
          onSaved={() => { setSupervisionModal(null); load(); }}
          t={t} showToast={showToast}
        />
      )}
    </div>
  );
}

function SupervisionModal({ collector, staffList, onClose, onSaved, t, showToast }) {
  const [collectionTarget, setCollectionTarget] = useState(collector.daily_collection_target || "");
  const [contactTarget, setContactTarget] = useState(collector.daily_contact_target || "");
  const [supervisor, setSupervisor] = useState(collector.supervisor_username || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await Promise.all([
        api.setUserDailyTarget(collector.id, Number(collectionTarget) || 0, Number(contactTarget) || 0),
        api.setUserSupervisor(collector.id, supervisor || null),
      ]);
      showToast(t("saved"), "success");
      onSaved();
    } catch (e2) {
      showToast(e2.message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="overlay modal-overlay" onClick={onClose}>
      <div className="prompt-modal" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}><X size={16} /></button>
        <h3>{t("supervisionLabel")} — {collector.full_name || collector.username}</h3>
        <form onSubmit={handleSave}>
          <label>{t("dailyCollectionTargetLabel")}</label>
          <input type="number" min="0" value={collectionTarget} onChange={(e) => setCollectionTarget(e.target.value)} />
          <label style={{ marginTop: 10, display: "block" }}>{t("dailyContactTargetLabel")}</label>
          <input type="number" min="0" value={contactTarget} onChange={(e) => setContactTarget(e.target.value)} />
          <label style={{ marginTop: 10, display: "block" }}>{t("assignSupervisor")}</label>
          <select value={supervisor} onChange={(e) => setSupervisor(e.target.value)}>
            <option value="">{t("noSupervisor")}</option>
            {staffList.filter((s) => s.username !== collector.username).map((s) => (
              <option key={s.username} value={s.username}>{s.full_name || s.username}</option>
            ))}
          </select>
          <div className="prompt-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>{t("cancel")}</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? t("saving") : t("save")}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function StatusInvoicesModal({ collector, state, label, onClose, t, money }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.invoicesReport({ collector: collector || "", status: state, page: 1, page_size: 100 })
      .then(setData).catch((e) => setError(e.message));
  }, [collector, state]);

  return (
    <div className="overlay modal-overlay" onClick={onClose}>
      <div className="prompt-modal" style={{ maxWidth: 640, maxHeight: "80vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}><X size={16} /></button>
        <h3>{label} · {data ? data.total : "…"}</h3>
        {error && <div className="error-state">{error}</div>}
        {!error && !data && <div className="loading-state">{t("loadingDots")}</div>}
        {data && data.results.length === 0 && <div className="empty-state">{t("noActivity")}</div>}
        {data && data.results.length > 0 && (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t("invoiceNumber")}</th>
                  <th>{t("customer")}</th>
                  <th>{t("dueDate")}</th>
                  <th>{t("amount")}</th>
                  <th>{t("balanceDue")}</th>
                </tr>
              </thead>
              <tbody>
                {data.results.map((inv) => (
                  <tr key={inv.invoice_id}>
                    <td data-label={t("invoiceNumber")}>{inv.number}</td>
                    <td data-label={t("customer")}><span className="cust-name">{inv.customer_name}</span></td>
                    <td data-label={t("dueDate")}>{fmtDate(inv.due_date)}</td>
                    <td data-label={t("amount")}><RiyalAmount amount={inv.amount_total} /></td>
                    <td data-label={t("balanceDue")}><RiyalAmount amount={inv.amount_residual} /></td>
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

function CollectorProfileModal({ collector, onClose, onOpenStatus, t, money }) {
  const { lang } = useLang();
  const { showToast } = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  useEffect(() => {
    api.collectorProfile(collector.id).then(setData).catch((e) => setError(e.message));
  }, [collector.id]);

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      await api.collectorProfilePdf(collector.id, lang);
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <div className="overlay modal-overlay" onClick={onClose}>
      <div className="prompt-modal" style={{ maxWidth: 760, maxHeight: "85vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}><X size={16} /></button>
        <div className="cust-cell" style={{ marginBottom: 10, justifyContent: "space-between" }}>
          <div className="cust-cell">
            <Avatar name={collector.username} size="md" />
            <div>
              <h3 style={{ margin: 0 }}>{collector.full_name || collector.username}</h3>
              <p className="panel-sub" style={{ margin: 0 }}>{collector.collector || t("unassigned")}</p>
            </div>
          </div>
          <button className="btn-secondary sm" onClick={handleDownloadPdf} disabled={downloadingPdf} style={{ marginInlineEnd: 28 }}>
            <Download size={13} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />
            {downloadingPdf ? t("exporting") : t("downloadPdfReport")}
          </button>
        </div>

        {error && <div className="error-state">{error}</div>}
        {!error && !data && <div className="loading-state">{t("loadingDots")}</div>}

        {data && (
          <>
            <div className="insights-kpi-grid" style={{ marginBottom: 16 }}>
              <div className="insights-kpi-card accent-violet">
                <div className="insights-kpi-top"><div className="insights-kpi-label">{t("customersCol")}</div></div>
                <div className="insights-kpi-value">{data.customers_count}</div>
              </div>
              <div className="insights-kpi-card accent-teal">
                <div className="insights-kpi-top"><div className="insights-kpi-label">{t("collectedThisMonth")}</div></div>
                <div className="insights-kpi-value">{money(data.collected_this_month)}</div>
              </div>
              <div className="insights-kpi-card accent-danger">
                <div className="insights-kpi-top"><div className="insights-kpi-label">{t("overdue")}</div></div>
                <div className="insights-kpi-value">{money(data.overdue_amount)}</div>
              </div>
              <div className="insights-kpi-card accent-amber">
                <div className="insights-kpi-top"><div className="insights-kpi-label">{t("worked")}</div></div>
                <div className="insights-kpi-value">{data.contacted_count}/{data.customers_count}</div>
              </div>
            </div>

            {Object.keys(data.status_breakdown || {}).length > 0 && (
              <>
                <h3 className="insights-chart-title" style={{ marginBottom: 8 }}>{t("invoiceStatusLabel")}</h3>
                <div className="collector-status-chips" style={{ marginBottom: 18 }}>
                  {Object.entries(data.status_breakdown).map(([state, info]) => (
                    <span
                      key={state}
                      className="collector-status-chip clickable-row"
                      style={{ background: STATUS_CHIP_COLORS[state]?.bg, color: STATUS_CHIP_COLORS[state]?.fg, fontSize: 12, padding: "4px 10px" }}
                      title={money(info.amount)}
                      onClick={() => onOpenStatus(state, STATUS_CHIP_LABELS[state] ? t(STATUS_CHIP_LABELS[state]) : state)}
                    >
                      {STATUS_CHIP_LABELS[state] ? t(STATUS_CHIP_LABELS[state]) : state}: {info.count} · {money(info.amount)}
                    </span>
                  ))}
                </div>
              </>
            )}

            <h3 className="insights-chart-title" style={{ marginBottom: 8 }}>{t("recentActivityLabel")}</h3>
            {data.recent_activity.length === 0 ? (
              <div className="empty-state">{t("noActivity")}</div>
            ) : (
              <div className="fu-history">
                {data.recent_activity.map((a) => (
                  <div key={a.id} className="fu-entry">
                    <div className="fu-entry-top">
                      <span className="fu-tag sm">{a.status}</span>
                      <span className="fu-entry-meta">{a.customer_name} · {fmtDateTime(a.created_at)}</span>
                    </div>
                    {a.note && <div className="fu-entry-note">{a.note}</div>}
                    {a.amount != null && (
                      <div className="fu-entry-note fu-entry-payment"><RiyalAmount amount={a.amount} />{a.payment_mode ? ` · ${a.payment_mode}` : ""}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function CollectorInsights({ report, t, money, hoveredContact, setHoveredContact }) {
  if (!report || report.length === 0) return null;

  const active = report.filter((r) => r.customers_count > 0);
  const totalCollectedThisMonth = report.reduce((s, r) => s + (r.collected_this_month || 0), 0);
  const totalOutstanding = report.reduce((s, r) => s + (r.total_due || 0), 0);
  const topPerformer = [...report].sort((a, b) => b.collected_this_month - a.collected_this_month)[0];

  const totalContacted = report.reduce((s, r) => s + (r.contacted_count || 0), 0);
  const totalNotContacted = report.reduce((s, r) => s + (r.not_contacted_count || 0), 0);
  const contactTotal = totalContacted + totalNotContacted;
  const contactData = [
    { label: t("contacted"), value: totalContacted, color: ODOO_COLORS[3] },
    { label: t("notContactedLabel"), value: totalNotContacted, color: ODOO_COLORS[2] },
  ];
  const contactCenterLabel = hoveredContact ? hoveredContact.label : t("customersCol");
  const contactCenterValue = hoveredContact ? hoveredContact.value : contactTotal;

  const barData = [...report]
    .sort((a, b) => b.collected_this_month - a.collected_this_month)
    .slice(0, 8)
    .map((r) => ({ name: r.full_name || r.username, amount: r.collected_this_month }));

  return (
    <div className="insights-panel">
      <h3 className="insights-panel-title">{t("collectorInsightsTitle")}</h3>
      <div className="insights-kpi-grid">
        <div className="insights-kpi-card accent-violet">
          <span className="kpi-pulse kpi-pulse-lg" />
          <span className="kpi-pulse kpi-pulse-sm" />
          <div className="insights-kpi-top">
            <div className="insights-kpi-label">{t("activeCollectors")}</div>
            <div className="insights-kpi-icon"><Users2 size={15} /></div>
          </div>
          <div className="insights-kpi-value">{active.length}</div>
          <div className="insights-kpi-bar" />
        </div>
        <div className="insights-kpi-card accent-teal">
          <span className="kpi-pulse kpi-pulse-lg" />
          <span className="kpi-pulse kpi-pulse-sm" />
          <div className="insights-kpi-top">
            <div className="insights-kpi-label">{t("collectedThisMonth")}</div>
            <div className="insights-kpi-icon"><TrendingUp size={15} /></div>
          </div>
          <div className="insights-kpi-value">{money(totalCollectedThisMonth)}</div>
          <div className="insights-kpi-bar" />
        </div>
        <div className="insights-kpi-card accent-danger">
          <span className="kpi-pulse kpi-pulse-lg" />
          <span className="kpi-pulse kpi-pulse-sm" />
          <div className="insights-kpi-top">
            <div className="insights-kpi-label">{t("totalDue")}</div>
            <div className="insights-kpi-icon"><Wallet size={15} /></div>
          </div>
          <div className="insights-kpi-value">{money(totalOutstanding)}</div>
          <div className="insights-kpi-bar" />
        </div>
        <div className="insights-kpi-card accent-amber">
          <span className="kpi-pulse kpi-pulse-lg" />
          <span className="kpi-pulse kpi-pulse-sm" />
          <div className="insights-kpi-top">
            <div className="insights-kpi-label">{t("topPerformer")}</div>
            <div className="insights-kpi-icon"><Trophy size={15} /></div>
          </div>
          <div className="insights-kpi-value insights-kpi-value-sm">{topPerformer?.full_name || topPerformer?.username || "—"}</div>
          <div className="insights-kpi-bar" />
        </div>
      </div>

      <div className="insights-charts-row">
        <div className="insights-chart-card">
          <h3 className="insights-chart-title">{t("collectedThisMonthByCollector")}</h3>
          <ResponsiveContainer width="100%" height={Math.max(180, barData.length * 34)}>
            <BarChart data={barData} layout="vertical" margin={{ left: 10 }}>
              <XAxis type="number" stroke="#6b7280" fontSize={11} tickLine={false} axisLine={false}
                     tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} />
              <YAxis type="category" dataKey="name" stroke="#6b7280" fontSize={11} tickLine={false} axisLine={false} width={110} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v) => money(v)} />
              <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                {barData.map((d, i) => (
                  <Cell key={d.name} fill={ODOO_COLORS[i % ODOO_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="insights-chart-card">
          <h3 className="insights-chart-title">{t("contactedVsNot")}</h3>
          <div className="donut-demo-wrap">
            <DonutChart
              data={contactData}
              size={165}
              strokeWidth={19}
              animationDuration={1}
              animationDelayPerSegment={0.05}
              highlightOnHover
              onSegmentHover={setHoveredContact}
              centerContent={
                <AnimatePresence mode="wait">
                  <motion.div
                    key={contactCenterLabel}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.2, ease: "circOut" }}
                    className="donut-center-inner"
                  >
                    <div className="donut-center-label">{contactCenterLabel}</div>
                    <div className="donut-center-value">{contactCenterValue.toLocaleString()}</div>
                  </motion.div>
                </AnimatePresence>
              }
            />
            <div className="donut-legend-list">
              {contactData.map((seg) => (
                <div key={seg.label} className={`donut-legend-item ${hoveredContact?.label === seg.label ? "active" : ""}`}>
                  <span className="donut-legend-dot" style={{ backgroundColor: seg.color }} />
                  <span className="donut-legend-label">{seg.label}</span>
                  <span className="donut-legend-value">
                    {seg.value.toLocaleString()} · {contactTotal > 0 ? Math.round((seg.value / contactTotal) * 100) : 0}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
