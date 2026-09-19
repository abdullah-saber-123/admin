import { useEffect, useState, useCallback, useRef } from "react";
import { Search, Phone, CalendarCheck, Download, X, MessageCircle, Send, AlertTriangle, Check, ArrowUp, ArrowDown, ArrowUpDown, SlidersHorizontal, MapPin, Settings2, Trash2, StickyNote, ShieldAlert, Target } from "lucide-react";
import { api, BASE } from "../api";
import Avatar from "./Avatar.jsx";
import RiskBadge from "./RiskBadge.jsx";
import AnimatedToggle from "./AnimatedToggle.jsx";
import { useLang } from "../i18n.jsx";
import { useToast } from "../toast.jsx";
import { fmtDate } from "../dateUtils.js";
import RiyalAmount from "./RiyalAmount.jsx";

function fmtMoney(n) {
  if (n === null || n === undefined) return "0.00";
  return Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function initials(name) {
  if (!name) return "?";
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}
function waLink(phone) {
  if (!phone) return null;
  const digits = phone.replace(/[^\d]/g, "");
  return `https://wa.me/${digits}`;
}

const DEFAULT_COLUMNS = { city: true, collector: true, lastPayment: true, lastInvoice: false, overdueAmount: true, upcomingDue: true, status: false };

export default function CustomerTable({ onSelect, bucket, onClearBucket, city, onClearCity, onCityChange, ageBucket, onClearAgeBucket, followupStatus, onClearFollowupStatus, collector, onClearCollector, onCollectorChange, hideZeroBalance, onToggleHideZeroBalance, hideNegativeBalance, onToggleHideNegativeBalance, refreshSignal, role, permissions, onOpenCollectorProfile }) {
  const { t, money, statusLabel } = useLang();
  const { showToast } = useToast();
  const canRetarget = role === "admin" || (permissions || "").split(",").map((p) => p.trim()).includes("customerRetargeting");
  const [retargetModalFor, setRetargetModalFor] = useState(null);
  const [retargetReason, setRetargetReason] = useState("");
  const [submittingRetarget, setSubmittingRetarget] = useState(false);

  const handleRetarget = async (e) => {
    e.preventDefault();
    if (!retargetReason.trim() || !retargetModalFor) return;
    setSubmittingRetarget(true);
    try {
      await api.createRetargetCase(retargetModalFor.partner_id, retargetReason.trim());
      showToast(t("retargetCaseCreated"), "success");
      setRetargetModalFor(null);
      setRetargetReason("");
    } catch (e2) {
      showToast(e2.message, "error");
    } finally {
      setSubmittingRetarget(false);
    }
  };

  const BUCKET_LABELS = {
    late: t("lateFollowUps"),
    due_today: t("dueToday"),
    due_5days: t("dueIn5Days"),
    overdue_45: t("overdue45"),
    broken_promise: t("brokenPromises"),
    followup_today: t("followupsTodayBanner"),
  };

  const [data, setData] = useState(null);
  const [allRows, setAllRows] = useState([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const tableWrapRef = useRef(null);
  const scrollLoadLockRef = useRef(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pageJumpValue, setPageJumpValue] = useState("");
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [sortBy, setSortBy] = useState("overdue_amount");
  const [sortDir, setSortDir] = useState("desc");
  const [followupFilter, setFollowupFilter] = useState("");
  const [minBalance, setMinBalance] = useState("");
  const [maxBalance, setMaxBalance] = useState("");
  const [lastInvoiceDateFrom, setLastInvoiceDateFrom] = useState("");
  const [lastInvoiceDateTo, setLastInvoiceDateTo] = useState("");
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [cities, setCities] = useState([]);
  const [followupStatuses, setFollowupStatuses] = useState([]);
  const [collectors, setCollectorsList] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectingAll, setSelectingAll] = useState(false);
  const [showBulkStatusModal, setShowBulkStatusModal] = useState(false);
  const [collectorFilter, setCollectorFilter] = useState("");
  const [ageBucketFilter, setAgeBucketFilter] = useState("");
  const [citySelectOpen, setCitySelectOpen] = useState(false);
  const [collectorSelectOpen, setCollectorSelectOpen] = useState(false);
  const [citySearch, setCitySearch] = useState("");
  const [collectorSearch, setCollectorSearch] = useState("");
  const [visibleColumns, setVisibleColumns] = useState(() => {
    try {
      const saved = localStorage.getItem("collect_visible_columns");
      return saved ? { ...DEFAULT_COLUMNS, ...JSON.parse(saved) } : DEFAULT_COLUMNS;
    } catch {
      return DEFAULT_COLUMNS;
    }
  });
  const [showColumnsMenu, setShowColumnsMenu] = useState(false);
  const [notesEditorId, setNotesEditorId] = useState(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [adminNotesDraft, setAdminNotesDraft] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [savingAdminNotes, setSavingAdminNotes] = useState(false);

  useEffect(() => {
    localStorage.setItem("collect_visible_columns", JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  const toggleColumn = (key) => setVisibleColumns((v) => ({ ...v, [key]: !v[key] }));

  useEffect(() => {
    api.cities().then(setCities).catch(() => {});
    api.followupStatuses().then(setFollowupStatuses).catch(() => {});
    api.collectors().then(setCollectorsList).catch(() => {});
  }, []);

  const [reminderOpen, setReminderOpen] = useState(false);
  const [reminderTargets, setReminderTargets] = useState([]);
  const [reminderIndex, setReminderIndex] = useState(0);
  const [reminderSent, setReminderSent] = useState([]);
  const [loadingTargets, setLoadingTargets] = useState(false);
  const [includeStatementLink, setIncludeStatementLink] = useState(false);
  const [statementLinksMap, setStatementLinksMap] = useState({});

  // Saved WhatsApp message templates - more than one can be kept ready (e.g. "Polite
  // reminder", "Urgent", "Final notice") and picked from at send time, instead of
  // there only ever being one fixed message.
  const [templates, setTemplates] = useState(() => {
    try {
      const saved = localStorage.getItem("collect_wa_templates");
      if (saved) return JSON.parse(saved);
    } catch { /* fall through to default */ }
    return [{ id: "default", name: t("defaultTemplateName"), text: t("reminderTemplate") }];
  });
  const [activeTemplateId, setActiveTemplateId] = useState(templates[0]?.id || "default");
  const [reminderTemplate, setReminderTemplate] = useState(templates[0]?.text || t("reminderTemplate"));
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");

  useEffect(() => {
    localStorage.setItem("collect_wa_templates", JSON.stringify(templates));
  }, [templates]);

  const selectTemplate = (id) => {
    const tpl = templates.find((x) => x.id === id);
    if (tpl) {
      setActiveTemplateId(id);
      setReminderTemplate(tpl.text);
    }
  };

  const saveCurrentAsTemplate = () => {
    const name = newTemplateName.trim();
    if (!name) return;
    const id = `tpl_${Date.now()}`;
    setTemplates((prev) => [...prev, { id, name, text: reminderTemplate }]);
    setActiveTemplateId(id);
    setNewTemplateName("");
  };

  const updateActiveTemplateText = (text) => {
    setReminderTemplate(text);
    // Keep edits in sync with the saved template so switching away and back doesn't
    // lose changes, unless it's the built-in default (left untouched as a fallback).
    if (activeTemplateId !== "default") {
      setTemplates((prev) => prev.map((tpl) => (tpl.id === activeTemplateId ? { ...tpl, text } : tpl)));
    }
  };

  const deleteTemplate = (id) => {
    if (id === "default" || templates.length <= 1) return;
    const remaining = templates.filter((x) => x.id !== id);
    setTemplates(remaining);
    if (activeTemplateId === id) {
      setActiveTemplateId(remaining[0].id);
      setReminderTemplate(remaining[0].text);
    }
  };

  const filterParams = () => ({
    search, status, bucket: bucket || "", city: city || "",
    hide_zero_balance: hideZeroBalance,
    hide_negative_balance: hideNegativeBalance,
    followup_status: followupFilter || "",
    min_balance: minBalance !== "" ? minBalance : "",
    max_balance: maxBalance !== "" ? maxBalance : "",
    collector: collectorFilter || "",
    age_bucket: ageBucketFilter || "",
    last_invoice_date_from: lastInvoiceDateFrom || "",
    last_invoice_date_to: lastInvoiceDateTo || "",
  });

  const load = useCallback(() => {
    setError(null);
    if (page > 1) setLoadingMore(true);
    api.customers({ ...filterParams(), sort_by: sortBy, sort_dir: sortDir, page, page_size: 25 })
      .then((res) => {
        setData(res);
        // Whichever action cleared allRows first (a filter change, or an
        // explicit "go to page") means this fetch should replace rather than
        // append - checking the accumulated list itself instead of the page
        // number keeps this correct for both "next page" and "jump to page".
        setAllRows((prev) => (prev.length === 0 ? res.results : [...prev, ...res.results]));
      })
      .catch((e) => setError(e.message))
      .finally(() => {
        setLoadingMore(false);
        scrollLoadLockRef.current = false;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status, bucket, city, hideZeroBalance, hideNegativeBalance, followupFilter, minBalance, maxBalance, collectorFilter, ageBucketFilter, lastInvoiceDateFrom, lastInvoiceDateTo, sortBy, sortDir, page]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => { setPage(1); setAllRows([]); scrollLoadLockRef.current = false; }, [search, status, bucket, city, hideZeroBalance, hideNegativeBalance, followupFilter, minBalance, maxBalance, collectorFilter, ageBucketFilter, lastInvoiceDateFrom, lastInvoiceDateTo, sortBy, sortDir]);

  // "Next" does the same thing scrolling to the bottom does - loads the next
  // page and appends it. "Go to page" is a deliberate jump instead: clear
  // what's loaded so the target page replaces it rather than piling on.
  const loadNextPage = () => setPage((p) => p + 1);
  const scrollToTop = () => tableWrapRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  const jumpToPage = (n) => {
    setAllRows([]);
    setPage(n);
    scrollToTop();
  };

  // Infinite scroll: the table has its own scrollable area (.table-wrap,
  // capped height with its own scrollbar - see the sticky-header CSS) rather
  // than the whole page scrolling, so we listen on that element directly and
  // load the next page once the person nears its bottom.
  // Locks via a ref (not just the `loadingMore` state) the instant a load is
  // triggered - `load()` only actually fires ~250ms later (its debounce), so
  // relying on state alone left a window where repeated scroll events could
  // queue up several page increments before the first fetch even started,
  // which looked like the table endlessly auto-scrolling/loading on its own.
  useEffect(() => {
    const el = tableWrapRef.current;
    if (!el || !data) return undefined;
    const hasMore = allRows.length < data.total;
    if (!hasMore) return undefined;
    const onScroll = () => {
      if (scrollLoadLockRef.current) return;
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 300) {
        scrollLoadLockRef.current = true;
        setPage((p) => p + 1);
      }
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, [data, allRows.length, loadingMore]);

  // Clicking a bar on the "Overdue Aging" dashboard chart sets this from the
  // parent (App.jsx) - mirror it into the local dropdown filter so the two
  // stay in sync no matter which one triggered the change.
  useEffect(() => {
    if (ageBucket !== undefined && ageBucket !== ageBucketFilter) {
      setAgeBucketFilter(ageBucket || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ageBucket]);

  // Same idea for the "Follow-up Status Breakdown" donut on the dashboard -
  // clicking (or hovering off) a segment drives this filter too.
  useEffect(() => {
    if (followupStatus !== undefined && followupStatus !== followupFilter) {
      setFollowupFilter(followupStatus || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [followupStatus]);

  // Dashboard-level collector dropdown drives this too, so the table (and
  // everything computed from it) narrows down along with the KPI cards/charts
  // when a specific collector is picked up top.
  useEffect(() => {
    if (collector !== undefined && collector !== collectorFilter) {
      setCollectorFilter(collector || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collector]);

  const openNotesEditor = (c) => {
    setNotesEditorId(c.partner_id);
    setNotesDraft(c.notes || "");
    setAdminNotesDraft(c.admin_notes || "");
  };
  const closeNotesEditor = () => setNotesEditorId(null);

  useEffect(() => {
    if (notesEditorId === null) return;
    const handler = () => setNotesEditorId(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [notesEditorId]);

  const saveNotesFor = async (partnerId) => {
    setSavingNotes(true);
    try {
      await api.updateNotes(partnerId, notesDraft);
      refreshLoadedPages();
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setSavingNotes(false);
    }
  };

  const saveAdminNotesFor = async (partnerId) => {
    setSavingAdminNotes(true);
    try {
      await api.updateAdminNotes(partnerId, adminNotesDraft);
      refreshLoadedPages();
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setSavingAdminNotes(false);
    }
  };

  // Silent background refresh (from the periodic auto-poll, after a manual sync,
  // or after editing a row in place - notes, bulk status, etc.) - re-fetches every
  // page currently loaded (not just page 1) and replaces the whole accumulated
  // list in one go, so numbers stay fresh without duplicating rows or losing how
  // far the person has scrolled.
  const refreshLoadedPages = () => {
    const loadedPages = Math.max(1, Math.ceil(allRows.length / 25));
    return Promise.all(
      Array.from({ length: loadedPages }, (_, i) =>
        api.customers({ ...filterParams(), sort_by: sortBy, sort_dir: sortDir, page: i + 1, page_size: 25 })
      )
    )
      .then((results) => {
        setData(results[results.length - 1]);
        setAllRows(results.flatMap((r) => r.results));
      })
      .catch((e) => setError(e.message));
  };

  useEffect(() => {
    if (refreshSignal) refreshLoadedPages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshSignal]);

  const activeFilterCount = [
    bucket, city, status, search, hideZeroBalance || null, hideNegativeBalance || null, followupFilter,
    minBalance !== "" ? minBalance : null, maxBalance !== "" ? maxBalance : null, collectorFilter, ageBucketFilter,
    lastInvoiceDateFrom || null, lastInvoiceDateTo || null,
  ].filter((v) => v !== null && v !== undefined && v !== "").length;

  const handleSort = (col) => {
    if (sortBy === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col);
      setSortDir(col === "name" ? "asc" : "desc");
    }
  };

  const SortIcon = ({ col }) => {
    if (sortBy !== col) return <ArrowUpDown size={11} className="sort-icon idle" />;
    return sortDir === "asc" ? <ArrowUp size={11} className="sort-icon active" /> : <ArrowDown size={11} className="sort-icon active" />;
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await api.exportCustomers(filterParams());
      showToast(`${t("exportReady")} — ${data?.total ?? ""} ${t("customersSuffix")}`, "success");
    } catch (e) {
      setError(e.message);
      showToast(e.message, "error");
    } finally {
      setExporting(false);
    }
  };

  const openReminders = async () => {
    setLoadingTargets(true);
    setError(null);
    try {
      let targets;
      if (selectedIds.length > 0) {
        // A specific hand-picked set of customers (checkboxes) beats the
        // current filters - "send this exact template to these 5 people"
        // rather than "everyone matching what's on screen right now".
        targets = (data?.results || []).filter((c) => selectedIds.includes(c.partner_id) && c.phone);
      } else {
        const res = await api.customers({ ...filterParams(), sort_by: sortBy, sort_dir: sortDir, page: 1, page_size: 200 });
        targets = res.results.filter((c) => c.phone);
      }
      setReminderTargets(targets);
      setReminderIndex(0);
      setReminderSent([]);
      setReminderOpen(true);
      // Fetched once up front for the whole batch rather than per-customer,
      // so flipping "include statement link" on doesn't need a round trip
      // per person as they click through the queue.
      api.statementLinks(targets.map((c) => c.partner_id)).then(setStatementLinksMap).catch(() => {});
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingTargets(false);
    }
  };

  const clearAllFilters = () => {
    setSearch("");
    setStatus("");
    setFollowupFilter("");
    setMinBalance("");
    setMaxBalance("");
    setCollectorFilter("");
    setAgeBucketFilter("");
    setLastInvoiceDateFrom("");
    setLastInvoiceDateTo("");
    onToggleHideNegativeBalance?.(false);
    onToggleHideZeroBalance?.(false);
    onClearBucket?.();
    onClearCity?.();
    onClearAgeBucket?.();
    onClearFollowupStatus?.();
    onClearCollector?.();
  };

  const currentTarget = reminderTargets[reminderIndex];
  const buildMessage = (c) => {
    let msg = reminderTemplate
      .replace("{name}", c.name)
      .replace("{balance}", fmtMoney(c.current_due));
    if (includeStatementLink) {
      const token = statementLinksMap[c.partner_id];
      const link = token ? `${BASE}/api/public/statement/${token}` : "";
      msg = msg.includes("{statement_link}")
        ? msg.replace("{statement_link}", link)
        : `${msg}${link ? `\n\n${t("statementLinkLabel")}: ${link}` : ""}`;
    }
    return msg;
  };

  const sendCurrentReminder = () => {
    if (!currentTarget) return;
    const link = `${waLink(currentTarget.phone)}?text=${encodeURIComponent(buildMessage(currentTarget))}`;
    window.open(link, "_blank");
    setReminderSent((prev) => [...prev, currentTarget.partner_id]);
  };

  const nextReminder = () => {
    if (reminderIndex < reminderTargets.length - 1) setReminderIndex((i) => i + 1);
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;

  return (
    <div className="panel table-panel">
      {selectedIds.length > 0 && (
        <div className="bulk-action-bar">
          <span>
            {selectedIds.length} {t("customersSuffix")} {t("selected")}
            {data && data.total > allRows.length && selectedIds.length === allRows.length && (
              <button
                type="button"
                className="link-btn"
                disabled={selectingAll}
                onClick={async () => {
                  setSelectingAll(true);
                  try {
                    const res = await api.customerIds(filterParams());
                    setSelectedIds(res.ids);
                  } catch {
                    // selection just stays as-is on failure
                  } finally {
                    setSelectingAll(false);
                  }
                }}
              >
                {selectingAll ? t("loadingDots") : `${t("selectAllMatching")} (${data.total})`}
              </button>
            )}
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn-primary sm" onClick={() => setShowBulkStatusModal(true)}>
              {t("bulkUpdateStatus")}
            </button>
            <button className="btn-secondary sm" onClick={() => setSelectedIds([])}>
              {t("clearSelection")}
            </button>
          </div>
        </div>
      )}
      <div className="panel-head">
        <h2>{t("customers")}</h2>
        <div className="search-bar">
          <div className="input-icon compact">
            <Search size={15} />
            <input
              placeholder={t("searchPlaceholder")}
              value={search}
              onChange={(e) => { setPage(1); setSearch(e.target.value); }}
            />
          </div>
          <select value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }}>
            <option value="">{t("allStatus")}</option>
            <option value="Overdue">{t("statusOverdue")}</option>
            <option value="Pending">{t("statusPending")}</option>
            <option value="Paid">{t("statusPaid")}</option>
          </select>
          <label className="checkbox-inline" onClick={(e) => { e.preventDefault(); onToggleHideZeroBalance?.(!hideZeroBalance); }}>
            <AnimatedToggle checked={hideZeroBalance} size={30} />
            {t("hideZeroBalance")}
          </label>
          <label className="checkbox-inline" onClick={(e) => { e.preventDefault(); onToggleHideNegativeBalance?.(!hideNegativeBalance); }}>
            <AnimatedToggle checked={hideNegativeBalance} size={30} />
            {t("hideNegativeBalance")}
          </label>
          <button className={`btn-secondary sm ${showMoreFilters ? "active-toggle" : ""}`} onClick={() => setShowMoreFilters((v) => !v)}>
            <SlidersHorizontal size={14} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />
            {t("moreFilters")}
          </button>
          <div className="columns-menu-wrap">
            <button className={`btn-secondary sm ${showColumnsMenu ? "active-toggle" : ""}`} onClick={() => setShowColumnsMenu((v) => !v)}>
              <Settings2 size={14} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />
              {t("columns")}
            </button>
            {showColumnsMenu && (
              <>
                <div className="columns-menu-backdrop" onClick={() => setShowColumnsMenu(false)} />
                <div className="columns-menu">
                  {Object.entries({
                    city: t("cityLabel"), collector: t("collectorField"), lastPayment: t("lastPayment"),
                    lastInvoice: t("lastInvoiceDate"),
                    overdueAmount: t("overdueAmount"), upcomingDue: t("upcomingDue"), status: t("status"),
                  }).map(([key, label]) => (
                    <label key={key} className="multiselect-item">
                      <input type="checkbox" checked={visibleColumns[key]} onChange={() => toggleColumn(key)} />
                      {label}
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>
          <button className="btn-secondary sm" onClick={openReminders} disabled={loadingTargets}>
            <MessageCircle size={14} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />
            {loadingTargets ? t("loadingDots") : t("whatsappReminders")}
          </button>
          <button className="btn-secondary sm" onClick={handleExport} disabled={exporting}>
            <Download size={14} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />
            {exporting ? t("exporting") : t("export")}
          </button>
        </div>
      </div>

      {showMoreFilters && (
        <div className="more-filters-row">
          <div className="more-filter-field" style={{ position: "relative" }}>
            <label>{t("cityLabel")}</label>
            <button type="button" className="multi-select-trigger" onClick={() => setCitySelectOpen((v) => !v)}>
              {city ? `${city.split(",").filter(Boolean).length} ${t("selected")}` : t("allStatus")}
            </button>
            {citySelectOpen && (
              <>
                <div className="columns-menu-backdrop" onClick={() => { setCitySelectOpen(false); setCitySearch(""); }} />
                <div className="columns-menu">
                  <div className="multiselect-search">
                    <Search size={12} />
                    <input
                      autoFocus
                      value={citySearch}
                      onChange={(e) => setCitySearch(e.target.value)}
                      placeholder={t("searchPlaceholder")}
                    />
                  </div>
                  <div className="multiselect-scroll">
                    {cities.filter((c) => c.toLowerCase().includes(citySearch.toLowerCase())).map((c) => {
                      const selected = (city || "").split(",").filter(Boolean);
                      return (
                        <label key={c} className="multiselect-item">
                          <input
                            type="checkbox"
                            checked={selected.includes(c)}
                            onChange={() => {
                              const next = selected.includes(c) ? selected.filter((x) => x !== c) : [...selected, c];
                              onCityChange?.(next.join(",") || null);
                            }}
                          />
                          {c}
                        </label>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
          {collectors.length > 1 && (
            <div className="more-filter-field" style={{ position: "relative" }}>
              <label>{t("collectorField")}</label>
              <button type="button" className="multi-select-trigger" onClick={() => setCollectorSelectOpen((v) => !v)}>
                {collectorFilter ? `${collectorFilter.split(",").filter(Boolean).length} ${t("selected")}` : t("allStatus")}
              </button>
              {collectorSelectOpen && (
                <>
                  <div className="columns-menu-backdrop" onClick={() => { setCollectorSelectOpen(false); setCollectorSearch(""); }} />
                  <div className="columns-menu">
                    <div className="multiselect-search">
                      <Search size={12} />
                      <input
                        autoFocus
                        value={collectorSearch}
                        onChange={(e) => setCollectorSearch(e.target.value)}
                        placeholder={t("searchPlaceholder")}
                      />
                    </div>
                    <div className="multiselect-scroll">
                      {collectors.filter((c) => c.toLowerCase().includes(collectorSearch.toLowerCase())).map((c) => {
                        const selected = (collectorFilter || "").split(",").filter(Boolean);
                        return (
                          <label key={c} className="multiselect-item">
                            <input
                              type="checkbox"
                              checked={selected.includes(c)}
                              onChange={() => {
                                const next = selected.includes(c) ? selected.filter((x) => x !== c) : [...selected, c];
                                setCollectorFilter(next.join(","));
                                onCollectorChange?.(next.join(",") || null);
                              }}
                            />
                            {c}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
          <div className="more-filter-field">
            <label>{t("agingBucketLabel")}</label>
            <select value={ageBucketFilter} onChange={(e) => setAgeBucketFilter(e.target.value)}>
              <option value="">{t("allStatus")}</option>
              <option value="1-30">1-30 {t("daysLabel")}</option>
              <option value="31-60">31-60 {t("daysLabel")}</option>
              <option value="61-90">61-90 {t("daysLabel")}</option>
              <option value="90+">90+ {t("daysLabel")}</option>
            </select>
          </div>
          <div className="more-filter-field">
            <label>{t("followUp")}</label>
            <select value={followupFilter} onChange={(e) => setFollowupFilter(e.target.value)}>
              <option value="">{t("allStatus")}</option>
              {followupStatuses.map((s) => (
                <option key={s.id} value={s.name}>{statusLabel(s.name)}</option>
              ))}
            </select>
          </div>
          <div className="more-filter-field">
            <label>{t("minBalance")}</label>
            <input type="number" min="0" value={minBalance} onChange={(e) => setMinBalance(e.target.value)} placeholder="0" />
          </div>
          <div className="more-filter-field">
            <label>{t("maxBalance")}</label>
            <input type="number" min="0" value={maxBalance} onChange={(e) => setMaxBalance(e.target.value)} placeholder="—" />
          </div>
          <div className="more-filter-field">
            <label>{t("lastInvoiceDateFrom")}</label>
            <input type="date" value={lastInvoiceDateFrom} onChange={(e) => setLastInvoiceDateFrom(e.target.value)} />
          </div>
          <div className="more-filter-field">
            <label>{t("lastInvoiceDateTo")}</label>
            <input type="date" value={lastInvoiceDateTo} onChange={(e) => setLastInvoiceDateTo(e.target.value)} />
          </div>
        </div>
      )}

      {activeFilterCount > 0 && (
        <div className="filter-chips-row">
          <span className="filter-chips-label">{t("filtered")}:</span>
          {bucket && (
            <span className="filter-chip">
              {BUCKET_LABELS[bucket] || bucket}
              <button onClick={onClearBucket}><X size={11} /></button>
            </span>
          )}
          {city && (
            <span className="filter-chip">
              {city.split(",").filter(Boolean).join(", ")}
              <button onClick={onClearCity}><X size={11} /></button>
            </span>
          )}
          {ageBucketFilter && (
            <span className="filter-chip">
              {ageBucketFilter} {t("daysLabel")}
              <button onClick={() => { setAgeBucketFilter(""); onClearAgeBucket?.(); }}><X size={11} /></button>
            </span>
          )}
          {status && (
            <span className="filter-chip">
              {status === "Overdue" ? t("statusOverdue") : status === "Pending" ? t("statusPending") : t("statusPaid")}
              <button onClick={() => setStatus("")}><X size={11} /></button>
            </span>
          )}
          {search && (
            <span className="filter-chip">
              "{search}"
              <button onClick={() => setSearch("")}><X size={11} /></button>
            </span>
          )}
          {hideZeroBalance && (
            <span className="filter-chip">
              {t("hideZeroBalance")}
              <button onClick={() => onToggleHideZeroBalance?.(false)}><X size={11} /></button>
            </span>
          )}
          {hideNegativeBalance && (
            <span className="filter-chip">
              {t("hideNegativeBalance")}
              <button onClick={() => onToggleHideNegativeBalance?.(false)}><X size={11} /></button>
            </span>
          )}
          {followupFilter && (
            <span className="filter-chip">
              {statusLabel(followupFilter)}
              <button onClick={() => { setFollowupFilter(""); onClearFollowupStatus?.(); }}><X size={11} /></button>
            </span>
          )}
          {(minBalance !== "" || maxBalance !== "") && (
            <span className="filter-chip">
              {t("balanceDue")}: {minBalance || "0"} – {maxBalance || "∞"}
              <button onClick={() => { setMinBalance(""); setMaxBalance(""); }}><X size={11} /></button>
            </span>
          )}
          {(lastInvoiceDateFrom || lastInvoiceDateTo) && (
            <span className="filter-chip">
              {t("lastInvoiceDate")}: {lastInvoiceDateFrom || "…"} – {lastInvoiceDateTo || "…"}
              <button onClick={() => { setLastInvoiceDateFrom(""); setLastInvoiceDateTo(""); }}><X size={11} /></button>
            </span>
          )}
          {activeFilterCount > 1 && (
            <button className="filter-chips-clear-all" onClick={clearAllFilters}>{t("clearAll")}</button>
          )}
        </div>
      )}

      {error && <div className="error-state">{error}</div>}
      {!error && !data && (
        <div className="table-wrap">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div className="skeleton-row" key={i}>
              <div className="skeleton-block" style={{ width: 32, height: 32, borderRadius: "50%" }} />
              <div className="skeleton-block" style={{ width: "18%", height: 12 }} />
              <div className="skeleton-block" style={{ width: "14%", height: 12 }} />
              <div className="skeleton-block" style={{ width: "12%", height: 12 }} />
              <div className="skeleton-block" style={{ width: "10%", height: 12, marginInlineStart: "auto" }} />
            </div>
          ))}
        </div>
      )}
      {!error && data && allRows.length === 0 && (
        <div className="empty-state">{t("noMatch")}</div>
      )}

      {data && allRows.length > 0 && (
        <>
          <div className="table-wrap" ref={tableWrapRef}>
            <table className="data-table">
              <thead>
                <tr>
                  {role === "admin" && (
                    <th style={{ width: 34 }}>
                      <input
                        type="checkbox"
                        checked={allRows.length > 0 && allRows.every((c) => selectedIds.includes(c.partner_id))}
                        onChange={(e) => {
                          const pageIds = allRows.map((c) => c.partner_id);
                          setSelectedIds((prev) => e.target.checked
                            ? [...new Set([...prev, ...pageIds])]
                            : prev.filter((id) => !pageIds.includes(id)));
                        }}
                      />
                    </th>
                  )}
                  <th className="sortable" onClick={() => handleSort("name")}>
                    {t("customer")} <SortIcon col="name" />
                  </th>
                  <th>{t("phone")}</th>
                  <th>{t("notesColumn")}</th>
                  {visibleColumns.city && <th>{t("cityLabel")}</th>}
                  {visibleColumns.collector && <th>{t("collectorField")}</th>}
                  {visibleColumns.lastPayment && (
                    <th className="sortable" onClick={() => handleSort("last_payment_date")}>
                      {t("lastPayment")} <SortIcon col="last_payment_date" />
                    </th>
                  )}
                  {visibleColumns.lastInvoice && (
                    <th className="sortable" onClick={() => handleSort("last_invoice_date")}>
                      {t("lastInvoiceDate")} <SortIcon col="last_invoice_date" />
                    </th>
                  )}
                  <th className="sortable" onClick={() => handleSort("current_due")}>
                    {t("balanceDue")} <SortIcon col="current_due" />
                  </th>
                  {visibleColumns.overdueAmount && (
                    <th className="sortable" onClick={() => handleSort("overdue_amount")}>
                      {t("overdueAmount")} <SortIcon col="overdue_amount" />
                    </th>
                  )}
                  {visibleColumns.upcomingDue && <th>{t("upcomingDue")}</th>}
                  {visibleColumns.status && <th>{t("status")}</th>}
                  <th>{t("followUp")}</th>
                </tr>
              </thead>
              <tbody>
                {allRows.map((c) => (
                  <tr key={c.partner_id} className="clickable-row" onClick={() => onSelect(c.partner_id)}>
                    {role === "admin" && (
                      <td onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(c.partner_id)}
                          onChange={() => setSelectedIds((prev) => prev.includes(c.partner_id) ? prev.filter((id) => id !== c.partner_id) : [...prev, c.partner_id])}
                        />
                      </td>
                    )}
                    <td data-label={t("customer")}>
                      <div className="cust-cell">
                        <Avatar name={c.name} size="sm" />
                        <span className="cust-name">{c.name}</span>
                        <RiskBadge level={c.risk_level} />
                        {canRetarget && (
                          <button
                            className="icon-btn"
                            title={t("retargetButton")}
                            onClick={(e) => { e.stopPropagation(); setRetargetModalFor(c); setRetargetReason(""); }}
                          >
                            <Target size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                    <td data-label={t("phone")}>
                      <span className="cell-icon">
                        <bdi dir="ltr">{c.phone || "—"}</bdi>
                        {c.phone && (
                          <>
                            <a href={`tel:${c.phone}`} className="quick-action" title={t("call")} onClick={(e) => e.stopPropagation()}>
                              <Phone size={12} />
                            </a>
                            <a href={waLink(c.phone)} target="_blank" rel="noreferrer" className="quick-action wa" title={t("whatsappChat")} onClick={(e) => e.stopPropagation()}>
                              <MessageCircle size={12} />
                            </a>
                            <a
                              href={`${waLink(c.phone)}?text=${encodeURIComponent(buildMessage(c))}`}
                              target="_blank"
                              rel="noreferrer"
                              className="quick-action reminder"
                              title={t("sendReminderQuick")}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Send size={12} />
                            </a>
                          </>
                        )}
                      </span>
                    </td>
                    <td data-label={t("notesColumn")} onClick={(e) => e.stopPropagation()}>
                      <NotesCell
                        c={c}
                        role={role}
                        isOpen={notesEditorId === c.partner_id}
                        onOpen={() => openNotesEditor(c)}
                        onClose={closeNotesEditor}
                        notesDraft={notesDraft}
                        setNotesDraft={setNotesDraft}
                        adminNotesDraft={adminNotesDraft}
                        setAdminNotesDraft={setAdminNotesDraft}
                        savingNotes={savingNotes}
                        savingAdminNotes={savingAdminNotes}
                        onSaveNotes={() => saveNotesFor(c.partner_id)}
                        onSaveAdminNotes={() => saveAdminNotesFor(c.partner_id)}
                        t={t}
                      />
                    </td>
                    {visibleColumns.city && (
                      <td data-label={t("cityLabel")}>
                        <span className="cell-icon">
                          {c.city ? (<><MapPin size={12} />{c.city}</>) : "—"}
                        </span>
                      </td>
                    )}
                    {visibleColumns.collector && (
                      <td data-label={t("collectorField")} onClick={(e) => { if (c.salesperson_name) { e.stopPropagation(); onOpenCollectorProfile?.(c.salesperson_name); } }}>
                        <span className={`cell-icon ${c.salesperson_name ? "collector-link" : ""}`}>{c.salesperson_name || "—"}</span>
                      </td>
                    )}
                    {visibleColumns.lastPayment && (
                      <td data-label={t("lastPayment")}>
                        <span className="cell-icon">
                          <CalendarCheck size={13} />
                          {fmtDate(c.last_payment_date)}
                          {c.last_payment_amount ? <> · <RiyalAmount amount={c.last_payment_amount} /></> : ""}
                        </span>
                      </td>
                    )}
                    {visibleColumns.lastInvoice && (
                      <td data-label={t("lastInvoiceDate")}>
                        <span className="cell-icon">
                          <CalendarCheck size={13} />
                          {fmtDate(c.last_invoice_date)}
                        </span>
                      </td>
                    )}
                    <td data-label={t("balanceDue")}>
                      <span className={`due-amount ${c.current_due > 0 ? "has-balance" : "zero"}`}>
                        <RiyalAmount amount={c.current_due} />
                      </span>
                    </td>
                    {visibleColumns.overdueAmount && (
                      <td data-label={t("overdueAmount")}>
                        <span className={`due-amount ${c.overdue_amount > 0 ? "has-balance" : "zero"}`}>
                          <RiyalAmount amount={c.overdue_amount} />
                        </span>
                      </td>
                    )}
                    {visibleColumns.upcomingDue && (
                    <td data-label={t("upcomingDue")}>
                      {c.upcoming_installment_amount ? (
                        <span className="upcoming-due-cell">
                          <RiyalAmount amount={c.upcoming_installment_amount} />
                          <span className="upcoming-due-date">{fmtDate(c.upcoming_installment_date)}</span>
                        </span>
                      ) : (
                        <span className="cell-icon">—</span>
                      )}
                    </td>
                    )}
                    {visibleColumns.status && (
                    <td data-label={t("status")}>
                      <span className={`status-tag ${c.status}`}>
                        {c.status === "Overdue" ? t("statusOverdue") : c.status === "Pending" ? t("statusPending") : t("statusPaid")}
                      </span>
                    </td>
                    )}
                    <td data-label={t("followUp")}>
                      {c.is_broken_promise ? (
                        <span className="fu-tag sm danger">
                          <AlertTriangle size={10} style={{ verticalAlign: -1, marginInlineEnd: 3 }} />
                          {t("brokenPromiseBadge")}
                        </span>
                      ) : (
                        <span className={`fu-tag sm ${(followupStatuses.find((s) => s.name === c.follow_up_status)?.tone) || "faint"}`}>
                          {statusLabel(c.follow_up_status || "Not Contacted")}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="table-totals-row">
            <span>{t("totalsFor")} <bdi>{data.total}</bdi> {t("customersSuffix")}:</span>
            <span className="table-totals-item">
              {t("balanceDue")}: <strong><RiyalAmount amount={data.total_balance_due} /></strong>
            </span>
            <span className="table-totals-item">
              {t("overdueAmount")}: <strong><RiyalAmount amount={data.total_overdue_amount} /></strong>
            </span>
          </div>

          <div className="infinite-scroll-status">
            {loadingMore ? (
              <span className="loading-state" style={{ padding: 0 }}>{t("loadingDots")}</span>
            ) : (
              <span>
                <bdi>{allRows.length}</bdi> / <bdi>{data.total}</bdi> {t("customersSuffix")}
                {allRows.length < data.total ? ` \u2013 ${t("scrollForMore")}` : ""}
              </span>
            )}
          </div>

          <div className="pagination">
            <button onClick={scrollToTop} disabled={allRows.length <= 25}>{t("prev")}</button>
            <span className="page-info"><bdi>{page} / {totalPages} · {data.total}</bdi> {t("customersSuffix")}</span>
            <button disabled={page >= totalPages || loadingMore} onClick={loadNextPage}>{t("next")}</button>
            <form
              className="page-jump-form"
              onSubmit={(e) => {
                e.preventDefault();
                const n = parseInt(pageJumpValue, 10);
                if (n >= 1 && n <= totalPages) jumpToPage(n);
                setPageJumpValue("");
              }}
            >
              <span>{t("goToPage")}</span>
              <input
                type="number"
                min={1}
                max={totalPages}
                value={pageJumpValue}
                onChange={(e) => setPageJumpValue(e.target.value)}
                placeholder={String(page)}
              />
              <button type="submit" className="btn-secondary sm">{t("go")}</button>
            </form>
          </div>
        </>
      )}

      {reminderOpen && (
        <div className="overlay" onClick={() => setReminderOpen(false)}>
          <div className="detail-panel" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setReminderOpen(false)}><X size={20} /></button>
            <h2 style={{ fontSize: 18, margin: "0 0 4px" }}>{t("whatsappReminders")}</h2>
            <p style={{ fontSize: 12.5, color: "var(--text-dim)", margin: "0 0 16px" }}>
              <bdi>{reminderTargets.length}</bdi> {t("customersSuffix")}
            </p>

            <div className="admin-form" style={{ maxWidth: "none" }}>
              <label>{t("messageTemplate")}</label>
              <div className="template-picker-row">
                <select
                  className="template-select"
                  value={activeTemplateId}
                  onChange={(e) => selectTemplate(e.target.value)}
                >
                  {templates.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>{tpl.name}</option>
                  ))}
                </select>
                {activeTemplateId !== "default" && (
                  <button type="button" className="icon-btn danger sm" title={t("deleteTemplate")} onClick={() => deleteTemplate(activeTemplateId)}>
                    <Trash2 size={14} />
                  </button>
                )}
                <button type="button" className="btn-secondary sm" onClick={() => setShowTemplateManager((v) => !v)}>
                  {t("newTemplate")}
                </button>
              </div>
              {showTemplateManager && (
                <div className="new-template-row">
                  <input
                    value={newTemplateName}
                    onChange={(e) => setNewTemplateName(e.target.value)}
                    placeholder={t("templateNamePlaceholder")}
                  />
                  <button
                    type="button"
                    className="btn-primary sm"
                    onClick={() => { saveCurrentAsTemplate(); setShowTemplateManager(false); }}
                    disabled={!newTemplateName.trim()}
                  >
                    {t("save")}
                  </button>
                </div>
              )}
              <textarea
                value={reminderTemplate}
                onChange={(e) => updateActiveTemplateText(e.target.value)}
                style={{
                  width: "100%", minHeight: 70, background: "var(--card)", border: "1px solid var(--border)",
                  borderRadius: 9, color: "var(--text)", padding: 10, fontSize: 13, fontFamily: "inherit",
                  marginTop: 8,
                }}
              />
              <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 4 }}>
                {"{name}"} / {"{balance}"} / {"{statement_link}"}
              </div>
              <label className="multiselect-item" style={{ padding: "10px 0 0", fontSize: 12.5 }}>
                <input
                  type="checkbox"
                  checked={includeStatementLink}
                  onChange={(e) => setIncludeStatementLink(e.target.checked)}
                />
                {t("includeStatementLinkOption")}
              </label>
            </div>

            {reminderTargets.length === 0 ? (
              <div className="empty-state">{t("noMatch")}</div>
            ) : currentTarget ? (
              <div className="followup-box" style={{ marginTop: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <strong>{currentTarget.name}</strong>
                  <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
                    {reminderIndex + 1} / {reminderTargets.length}
                  </span>
                </div>
                <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginBottom: 4 }}>
                  <bdi dir="ltr">{currentTarget.phone}</bdi> · <RiyalAmount amount={currentTarget.current_due} />
                </div>
                <div style={{
                  fontSize: 12.5, background: "var(--panel)", border: "1px solid var(--border)",
                  borderRadius: 8, padding: 10, marginTop: 8, whiteSpace: "pre-wrap",
                }}>
                  {buildMessage(currentTarget)}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <button className="btn-primary" onClick={sendCurrentReminder}>
                    <Send size={14} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />
                    {t("openWhatsApp")}
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={nextReminder}
                    disabled={reminderIndex >= reminderTargets.length - 1}
                  >
                    {t("skipNext")}
                  </button>
                </div>
                {reminderSent.includes(currentTarget.partner_id) && (
                  <div style={{ fontSize: 11.5, color: "var(--ok)", marginTop: 8, display: "flex", alignItems: "center", gap: 4 }}>
                    <Check size={12} /> {t("opened")}
                  </div>
                )}
              </div>
            ) : (
              <div className="empty-state">{t("noMatch")}</div>
            )}
          </div>
        </div>
      )}

      {showBulkStatusModal && (
        <BulkStatusModal
          count={selectedIds.length}
          onClose={() => setShowBulkStatusModal(false)}
          onDone={() => {
            setShowBulkStatusModal(false);
            setSelectedIds([]);
            refreshLoadedPages();
          }}
          partnerIds={selectedIds}
          statuses={followupStatuses}
        />
      )}

      {retargetModalFor && (
        <div className="overlay modal-overlay" onClick={() => setRetargetModalFor(null)}>
          <div className="prompt-modal" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setRetargetModalFor(null)}><X size={16} /></button>
            <h3><Target size={15} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />{t("retargetButton")}</h3>
            <p className="prompt-message">{retargetModalFor.name}</p>
            <form onSubmit={handleRetarget}>
              <label>{t("retargetReasonLabel")}</label>
              <textarea rows={3} value={retargetReason} onChange={(e) => setRetargetReason(e.target.value)} placeholder={t("retargetReasonPlaceholder")} autoFocus />
              <div className="prompt-actions">
                <button type="button" className="btn-secondary" onClick={() => setRetargetModalFor(null)}>{t("cancel")}</button>
                <button type="submit" className="btn-primary" disabled={!retargetReason.trim() || submittingRetarget}>
                  {submittingRetarget ? t("saving") : t("save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function NotesCell({
  c, role, isOpen, onOpen, onClose,
  notesDraft, setNotesDraft, adminNotesDraft, setAdminNotesDraft,
  savingNotes, savingAdminNotes, onSaveNotes, onSaveAdminNotes, t,
}) {
  const hasNote = !!(c.notes || c.admin_notes);
  return (
    <div className="notes-cell-wrap">
      <button
        type="button"
        className={`notes-cell-toggle${hasNote ? " has-note" : ""}`}
        title={t("editNotes")}
        onClick={() => (isOpen ? onClose() : onOpen())}
      >
        <StickyNote size={13} />
        <span className="notes-cell-preview">{c.notes ? c.notes : hasNote ? t("adminNote") : "—"}</span>
      </button>
      {isOpen && (
        <div className="notes-cell-popover" onClick={(e) => e.stopPropagation()}>
          <div className="k" style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 4 }}>
            {t("pinnedNote")}
          </div>
          <textarea
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            placeholder={t("pinnedNotePlaceholder")}
            autoFocus
          />
          <button className="btn-primary sm" style={{ marginTop: 6 }} onClick={onSaveNotes} disabled={savingNotes}>
            {savingNotes ? t("saving") : t("saveNote")}
          </button>

          {(role === "admin" || c.admin_notes) && (
            <>
              <div className="k" style={{ fontSize: 11, color: "var(--danger)", margin: "10px 0 4px" }}>
                <ShieldAlert size={11} style={{ verticalAlign: -2, marginInlineEnd: 4 }} />
                {t("adminNote")}
              </div>
              {role === "admin" ? (
                <>
                  <textarea
                    value={adminNotesDraft}
                    onChange={(e) => setAdminNotesDraft(e.target.value)}
                    placeholder={t("adminNotePlaceholder")}
                  />
                  <button className="btn-primary sm" style={{ marginTop: 6 }} onClick={onSaveAdminNotes} disabled={savingAdminNotes}>
                    {savingAdminNotes ? t("saving") : t("saveNote")}
                  </button>
                </>
              ) : (
                <p className="admin-notes-readonly">{c.admin_notes}</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function BulkStatusModal({ count, onClose, onDone, partnerIds, statuses }) {
  const { t, statusLabel } = useLang();
  const { showToast } = useToast();
  const [status, setStatus] = useState(statuses[0]?.name || "");
  const [note, setNote] = useState("");
  const [nextDate, setNextDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const selectedCfg = statuses.find((s) => s.name === status);

  const submit = async (e) => {
    e.preventDefault();
    if (!note.trim()) {
      setError(t("noteRequiredHint"));
      return;
    }
    if (selectedCfg?.requires_next_date && !nextDate) {
      setError(t("requiresNextDateHint"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await api.bulkLogFollowup({
        partner_ids: partnerIds, status, note: note.trim(), next_follow_up_date: nextDate || null,
      });
      showToast(`${t("updated")}: ${res.updated_count}${res.skipped_count ? `, ${t("skipped")}: ${res.skipped_count}` : ""}`, "success");
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="overlay modal-overlay" onClick={onClose}>
      <div className="prompt-modal" onClick={(e) => e.stopPropagation()}>
        <h3>{t("bulkUpdateStatus")}</h3>
        <p className="prompt-message">{count} {t("customersSuffix")} {t("selected")}</p>
        <form onSubmit={submit} className="admin-form" style={{ maxWidth: "none" }}>
          <label>{t("status")}</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {statuses.filter((s) => s.name !== "Not Contacted").map((s) => (
              <option key={s.id} value={s.name}>{statusLabel(s.name)}</option>
            ))}
          </select>
          {selectedCfg?.requires_next_date && (
            <div className="mention-hint" style={{ color: "var(--danger)" }}>{t("requiresNextDateHint")}</div>
          )}
          <label>{t("noteRequired")}</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} required autoFocus />
          <label>{t("nextFollowupDate")}</label>
          <input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} />
          {error && <div className="error-state">{error}</div>}
          <div className="prompt-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>{t("cancel")}</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? t("saving") : t("save")}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
