import { useEffect, useState, useCallback, useRef } from "react";
import { CreditCard, ShieldAlert, Gift, Zap, Search, ClipboardList, Download, Upload, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { api } from "../api";
import { useLang } from "../i18n.jsx";
import { useToast } from "../toast.jsx";
import RiyalAmount from "./RiyalAmount.jsx";

export default function CreditNominationReport({ onSelectCustomer, role }) {
  const { t } = useLang();
  const { showToast } = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [cities, setCities] = useState([]);
  const [cityFilter, setCityFilter] = useState("");
  const [collectors, setCollectors] = useState([]);
  const [collectorFilter, setCollectorFilter] = useState("");
  const [overLimitOnly, setOverLimitOnly] = useState(false);
  const [offerOnly, setOfferOnly] = useState(false);
  const [collectionOnly, setCollectionOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("current_due");
  const [sortDir, setSortDir] = useState("desc");
  const [editingLimitId, setEditingLimitId] = useState(null);
  const [limitDraft, setLimitDraft] = useState("");
  const [savingId, setSavingId] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importingPaymentTypes, setImportingPaymentTypes] = useState(false);
  const [savingPaymentTypeId, setSavingPaymentTypeId] = useState(null);
  const [importingRegions, setImportingRegions] = useState(false);
  const [savingRegionId, setSavingRegionId] = useState(null);
  const [paymentTypeOptions, setPaymentTypeOptions] = useState([]);
  const [regionOptions, setRegionOptions] = useState([]);
  const fileInputRef = useRef(null);
  const paymentTypeFileInputRef = useRef(null);
  const regionFileInputRef = useRef(null);
  const ADD_NEW = "__add_new__";

  const loadFieldOptions = useCallback(() => {
    api.fieldOptions("payment_type").then(setPaymentTypeOptions).catch(() => {});
    api.fieldOptions("region").then(setRegionOptions).catch(() => {});
  }, []);

  useEffect(() => {
    api.cities().then(setCities).catch(() => {});
    api.collectors().then(setCollectors).catch(() => {});
    loadFieldOptions();
  }, [loadFieldOptions]);

  const load = useCallback(() => {
    setError(null);
    api.customers({
      search, city: cityFilter, collector: collectorFilter, page, page_size: 25,
      over_limit_only: overLimitOnly, nominated_offer_only: offerOnly, nominated_collection_only: collectionOnly,
      sort_by: sortBy, sort_dir: sortDir,
    }).then(setData).catch((e) => setError(e.message));
  }, [search, cityFilter, collectorFilter, page, overLimitOnly, offerOnly, collectionOnly, sortBy, sortDir]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => { setPage(1); }, [search, cityFilter, collectorFilter, overLimitOnly, offerOnly, collectionOnly]);

  const toggleSort = (field) => {
    if (sortBy === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortBy(field); setSortDir("desc"); }
  };
  const sortIcon = (field) => {
    if (sortBy !== field) return <ArrowUpDown size={11} style={{ opacity: 0.4 }} />;
    return sortDir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />;
  };

  const saveLimit = async (partnerId) => {
    setSavingId(partnerId);
    try {
      await api.updateCreditLimit(partnerId, limitDraft === "" ? null : Number(limitDraft));
      setEditingLimitId(null);
      load();
      showToast(t("exportReady"), "success");
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setSavingId(null);
    }
  };

  const toggleNomination = async (c, field) => {
    setSavingId(c.partner_id);
    try {
      const next = !c[field];
      await api.toggleNomination(c.partner_id, field === "nominated_for_offer" ? { for_offer: next } : { for_collection: next });
      load();
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setSavingId(null);
    }
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / (data.page_size || 25))) : 1;

  const handleExport = async () => {
    setExporting(true);
    try {
      await api.exportCustomers({
        search, city: cityFilter, collector: collectorFilter, over_limit_only: overLimitOnly,
        nominated_offer_only: offerOnly, nominated_collection_only: collectionOnly,
      });
      showToast(t("exportReady"), "success");
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setExporting(false);
    }
  };

  const savePaymentType = async (partnerId, value) => {
    if (value === ADD_NEW) return addOptionThenSave("payment_type", setPaymentTypeOptions, savePaymentType, partnerId);
    setSavingPaymentTypeId(partnerId);
    try {
      await api.updatePaymentType(partnerId, value || null);
      load();
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setSavingPaymentTypeId(null);
    }
  };

  const saveRegion = async (partnerId, value) => {
    if (value === ADD_NEW) return addOptionThenSave("region", setRegionOptions, saveRegion, partnerId);
    setSavingRegionId(partnerId);
    try {
      await api.updateRegion(partnerId, value || null);
      load();
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setSavingRegionId(null);
    }
  };

  const addOptionThenSave = async (field, setOptions, saveFn, partnerId) => {
    const value = window.prompt(t("newOptionPrompt"));
    if (!value || !value.trim()) return;
    try {
      const opt = await api.addFieldOption(field, value.trim());
      setOptions((prev) => (prev.some((o) => o.value === opt.value) ? prev : [...prev, opt].sort((a, b) => a.value.localeCompare(b.value))));
      saveFn(partnerId, opt.value);
    } catch (e) {
      showToast(e.message, "error");
    }
  };

  const handleImportClick = () => fileInputRef.current?.click();
  const handleImportPaymentTypesClick = () => paymentTypeFileInputRef.current?.click();
  const handleImportRegionsClick = () => regionFileInputRef.current?.click();

  const handleImportRegionsFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImportingRegions(true);
    try {
      const result = await api.importRegions(file);
      showToast(t("regionsImported").replace("{n}", result.updated), "success");
      if (result.not_found_count > 0) showToast(t("creditLimitsImportSkipped").replace("{n}", result.not_found_count), "error");
      loadFieldOptions();
      load();
    } catch (e2) {
      showToast(e2.message, "error");
    } finally {
      setImportingRegions(false);
    }
  };

  const handleImportPaymentTypesFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImportingPaymentTypes(true);
    try {
      const result = await api.importPaymentTypes(file);
      showToast(t("paymentTypesImported").replace("{n}", result.updated), "success");
      if (result.not_found_count > 0) showToast(t("creditLimitsImportSkipped").replace("{n}", result.not_found_count), "error");
      loadFieldOptions();
      load();
    } catch (e2) {
      showToast(e2.message, "error");
    } finally {
      setImportingPaymentTypes(false);
    }
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImporting(true);
    try {
      const result = await api.importCreditLimits(file);
      showToast(t("creditLimitsImported").replace("{n}", result.updated), "success");
      if (result.not_found_count > 0) {
        showToast(t("creditLimitsImportSkipped").replace("{n}", result.not_found_count), "error");
      }
      load();
    } catch (e2) {
      showToast(e2.message, "error");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="content-stack" style={{ maxWidth: "100%" }}>
      <div className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
          <div>
            <h2><CreditCard size={15} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />{t("creditNominationTitle")}</h2>
            <p className="panel-sub">{t("creditNominationHint")}</p>
          </div>
          {role === "admin" && (
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn-secondary sm" onClick={handleExport} disabled={exporting}>
                <Download size={13} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />
                {exporting ? t("exporting") : t("export")}
              </button>
              <button className="btn-secondary sm" onClick={handleImportClick} disabled={importing}>
                <Upload size={13} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />
                {importing ? t("importing") : t("importCreditLimits")}
              </button>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={handleImportFile} />
              <button className="btn-secondary sm" onClick={handleImportPaymentTypesClick} disabled={importingPaymentTypes}>
                <Upload size={13} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />
                {importingPaymentTypes ? t("importing") : t("importPaymentTypes")}
              </button>
              <input ref={paymentTypeFileInputRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={handleImportPaymentTypesFile} />
              <button className="btn-secondary sm" onClick={handleImportRegionsClick} disabled={importingRegions}>
                <Upload size={13} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />
                {importingRegions ? t("importing") : t("importRegions")}
              </button>
              <input ref={regionFileInputRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={handleImportRegionsFile} />
            </div>
          )}
        </div>

        <div className="more-filters-row" style={{ marginBottom: 14 }}>
          <div className="more-filter-field">
            <div className="input-icon compact">
              <Search size={13} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("searchPlaceholder")} />
            </div>
          </div>
          <div className="more-filter-field">
            <label>{t("cityLabel")}</label>
            <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)}>
              <option value="">{t("allStatus")}</option>
              {cities.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="more-filter-field">
            <label>{t("collectorField")}</label>
            <select value={collectorFilter} onChange={(e) => setCollectorFilter(e.target.value)}>
              <option value="">{t("allStatus")}</option>
              {collectors.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="quick-toggle-row">
          <button className={`quick-toggle-chip ${overLimitOnly ? "active" : ""}`} onClick={() => setOverLimitOnly((v) => !v)}>
            <ShieldAlert size={13} /> {t("overCreditLimit")}
          </button>
          <button className={`quick-toggle-chip ${offerOnly ? "active" : ""}`} onClick={() => setOfferOnly((v) => !v)}>
            <Gift size={13} /> {t("nominatedForOffer")}
          </button>
          <button className={`quick-toggle-chip ${collectionOnly ? "active" : ""}`} onClick={() => setCollectionOnly((v) => !v)}>
            <Zap size={13} /> {t("nominatedForCollectionCard")}
          </button>
        </div>

        {error && <div className="error-state">{error}</div>}
        {!error && !data && <div className="loading-state">{t("loadingDots")}</div>}
        {data && data.results.length === 0 && <div className="empty-state">{t("noActivity")}</div>}

        {data && data.results.length > 0 && (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="sortable" onClick={() => toggleSort("name")}>{t("customer")} {sortIcon("name")}</th>
                    <th>{t("supplierIdLabel")}</th>
                    <th>{t("collectorField")}</th>
                    <th>{t("cityLabel")}</th>
                    <th className="sortable" onClick={() => toggleSort("current_due")}>{t("balanceDue")} {sortIcon("current_due")}</th>
                    <th>{t("creditLimitLabel")}</th>
                    <th>{t("paymentTypeLabel")}</th>
                    <th>{t("regionLabel")}</th>
                    <th>{t("nominateForOffer")}</th>
                    <th>{t("nominateForCollection")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.results.map((c) => {
                    const isOver = c.credit_limit && c.current_due > c.credit_limit;
                    return (
                      <tr key={c.partner_id}>
                        <td data-label={t("customer")} className="clickable-row" onClick={() => onSelectCustomer?.(c.partner_id)}>
                          <span className="cust-name">{c.name}</span>
                        </td>
                        <td data-label={t("supplierIdLabel")}><bdi dir="ltr">{c.supplier_id || "—"}</bdi></td>
                        <td data-label={t("collectorField")}>{c.salesperson_name || "—"}</td>
                        <td data-label={t("cityLabel")}>{c.city || "—"}</td>
                        <td data-label={t("balanceDue")}>
                          <span className={`due-amount ${c.current_due > 0 ? "has-balance" : "zero"}`}>
                            <RiyalAmount amount={c.current_due} />
                          </span>
                        </td>
                        <td data-label={t("creditLimitLabel")}>
                          {editingLimitId === c.partner_id ? (
                            <div className="credit-limit-edit">
                              <input
                                type="number" min="0" autoFocus
                                value={limitDraft}
                                onChange={(e) => setLimitDraft(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && saveLimit(c.partner_id)}
                              />
                              <button className="icon-btn" disabled={savingId === c.partner_id} onClick={() => saveLimit(c.partner_id)}>
                                <ClipboardList size={13} />
                              </button>
                            </div>
                          ) : (
                            <span
                              className={isOver ? "overdue-text" : ""}
                              style={{ cursor: role === "admin" ? "pointer" : "default", fontWeight: isOver ? 700 : 400 }}
                              onClick={() => {
                                if (role !== "admin") return;
                                setEditingLimitId(c.partner_id);
                                setLimitDraft(c.credit_limit ?? "");
                              }}
                            >
                              {c.credit_limit ? <RiyalAmount amount={c.credit_limit} /> : t("noCreditLimit")}
                              {isOver && <span className="mini-stat-days overdue" style={{ marginInlineStart: 6 }}>{t("overLimitWarning")}</span>}
                            </span>
                          )}
                        </td>
                        <td data-label={t("paymentTypeLabel")}>
                          <select
                            value={c.payment_type || ""}
                            disabled={role !== "admin" || savingPaymentTypeId === c.partner_id}
                            onChange={(e) => savePaymentType(c.partner_id, e.target.value)}
                          >
                            <option value="">—</option>
                            {paymentTypeOptions.map((o) => <option key={o.id} value={o.value}>{o.value}</option>)}
                            {role === "admin" && <option value={ADD_NEW}>{t("addNewOption")}</option>}
                          </select>
                        </td>
                        <td data-label={t("regionLabel")}>
                          <select
                            value={c.region || ""}
                            disabled={role !== "admin" || savingRegionId === c.partner_id}
                            onChange={(e) => saveRegion(c.partner_id, e.target.value)}
                          >
                            <option value="">—</option>
                            {regionOptions.map((o) => <option key={o.id} value={o.value}>{o.value}</option>)}
                            {role === "admin" && <option value={ADD_NEW}>{t("addNewOption")}</option>}
                          </select>
                        </td>
                        <td data-label={t("nominateForOffer")}>
                          <button
                            className={`nomination-btn sm ${c.nominated_for_offer ? "active" : ""}`}
                            disabled={savingId === c.partner_id}
                            onClick={() => toggleNomination(c, "nominated_for_offer")}
                          >
                            <Gift size={13} />
                          </button>
                        </td>
                        <td data-label={t("nominateForCollection")}>
                          <button
                            className={`nomination-btn sm collection ${c.nominated_for_collection ? "active" : ""}`}
                            disabled={savingId === c.partner_id}
                            onClick={() => toggleNomination(c, "nominated_for_collection")}
                          >
                            <Zap size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="pagination">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{t("prev")}</button>
              <span className="page-info">{page} / {totalPages} · {data.total}</span>
              <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>{t("next")}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
