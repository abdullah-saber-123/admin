import { useEffect, useState, useRef } from "react";
import { Percent, Search, X, Download, Plus, Trash2 } from "lucide-react";
import { api } from "../api";
import { useLang } from "../i18n.jsx";
import { useToast } from "../toast.jsx";
import RiyalAmount from "./RiyalAmount.jsx";

function computeRowAmounts(row, vatRate) {
  const vat = (Number(vatRate) || 0) / 100;
  const net = (Number(row.sales) || 0) - (Number(row.returns) || 0);
  const pretax = vat ? net / (1 + vat) : net;
  const discountAmount = (pretax * (Number(row.discount_percent) || 0)) / 100;
  return { net, pretax, discountAmount };
}

function computeSummary(rows, vatRate, currentBalance, currentBalanceDiscount, carriedDiscountAmount) {
  const vat = (Number(vatRate) || 0) / 100;
  let totalDiscount = 0;
  let totalExtra = 0;
  rows.forEach((r) => {
    const { discountAmount } = computeRowAmounts(r, vatRate);
    totalDiscount += discountAmount;
    totalExtra += Number(r.extra_discount) || 0;
  });
  const carried = Number(carriedDiscountAmount) || 0;
  const combinedDiscount = totalDiscount + totalExtra + carried;
  const tax = combinedDiscount * vat;
  const total = combinedDiscount + tax;
  const diff = total - (Number(currentBalanceDiscount) || 0);
  const netPayment = (Number(currentBalance) || 0) - total;
  return { totalDiscount, totalExtra, combinedDiscount, tax, total, diff, netPayment };
}

const emptyRow = () => ({ branch: "", year: new Date().getFullYear(), sales: 0, returns: 0, discount_percent: 0, extra_discount: 0, note: "" });

export default function DiscountsReport() {
  const { t, money, lang } = useLang();
  const { showToast } = useToast();

  const [clientSearch, setClientSearch] = useState("");
  const [clientOptions, setClientOptions] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [exportingPdf, setExportingPdf] = useState(false);

  const [rows, setRows] = useState([]);
  const [vatRate, setVatRate] = useState(15);
  const [currentBalance, setCurrentBalance] = useState(0);
  const [currentBalanceDiscount, setCurrentBalanceDiscount] = useState(0);
  const [carriedDiscountAmount, setCarriedDiscountAmount] = useState(0);
  const [carriedDiscountNote, setCarriedDiscountNote] = useState("");
  const [finalNote, setFinalNote] = useState("");
  const [preparedBy, setPreparedBy] = useState("");
  const [preparedDate, setPreparedDate] = useState("");
  const [approverName, setApproverName] = useState("");
  const [approvalDate, setApprovalDate] = useState("");
  const [approved, setApproved] = useState(false);

  const saveTimer = useRef(null);
  const loadedPartnerId = useRef(null);

  useEffect(() => {
    if (!clientSearch.trim()) { setClientOptions([]); return; }
    const timer = setTimeout(() => {
      api.customers({ search: clientSearch, page_size: 8 }).then((res) => setClientOptions(res.results || [])).catch(() => {});
    }, 250);
    return () => clearTimeout(timer);
  }, [clientSearch]);

  useEffect(() => {
    if (!selectedClient) return;
    setLoading(true);
    setError(null);
    api.getDiscountCase(selectedClient.partner_id).then((res) => {
      loadedPartnerId.current = selectedClient.partner_id;
      setRows(res.rows.length ? res.rows : [emptyRow()]);
      setVatRate(res.vat_rate ?? 15);
      setCurrentBalance(res.current_balance ?? 0);
      setCurrentBalanceDiscount(res.current_balance_discount ?? 0);
      setCarriedDiscountAmount(res.carried_discount_amount ?? 0);
      setCarriedDiscountNote(res.carried_discount_note || "");
      setFinalNote(res.final_note || "");
      setPreparedBy(res.prepared_by || "");
      setPreparedDate(res.prepared_date || "");
      setApproverName(res.approver_name || "");
      setApprovalDate(res.approval_date || "");
      setApproved(!!res.approved);
    }).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [selectedClient]);

  useEffect(() => () => clearTimeout(saveTimer.current), []);

  const scheduleSave = (overrides = {}) => {
    if (!selectedClient) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await api.saveDiscountCase(selectedClient.partner_id, {
          rows: (overrides.rows ?? rows).map((r) => ({
            branch: r.branch || "", year: Number(r.year) || new Date().getFullYear(),
            sales: Number(r.sales) || 0, returns: Number(r.returns) || 0,
            discount_percent: Number(r.discount_percent) || 0, extra_discount: Number(r.extra_discount) || 0,
            note: r.note || "",
          })),
          vat_rate: Number(overrides.vatRate ?? vatRate) || 0,
          current_balance: Number(overrides.currentBalance ?? currentBalance) || 0,
          current_balance_discount: Number(overrides.currentBalanceDiscount ?? currentBalanceDiscount) || 0,
          carried_discount_amount: Number(overrides.carriedDiscountAmount ?? carriedDiscountAmount) || 0,
          carried_discount_note: overrides.carriedDiscountNote ?? carriedDiscountNote,
          final_note: overrides.finalNote ?? finalNote,
          prepared_by: overrides.preparedBy ?? preparedBy,
          prepared_date: (overrides.preparedDate ?? preparedDate) || null,
          approver_name: overrides.approverName ?? approverName,
          approval_date: (overrides.approvalDate ?? approvalDate) || null,
          approved: overrides.approved ?? approved,
        });
      } catch (e) {
        showToast(e.message, "error");
      }
    }, 700);
  };

  const updateRow = (idx, field, value) => {
    const next = rows.map((r, i) => (i === idx ? { ...r, [field]: value } : r));
    setRows(next);
    scheduleSave({ rows: next });
  };

  const addRow = () => {
    const next = [...rows, emptyRow()];
    setRows(next);
    scheduleSave({ rows: next });
  };

  const removeRow = (idx) => {
    const next = rows.filter((_, i) => i !== idx);
    setRows(next);
    scheduleSave({ rows: next });
  };

  const pickClient = (c) => {
    setSelectedClient(c);
    setClientSearch(c.name);
    setClientOptions([]);
  };

  const clearClient = () => {
    setSelectedClient(null);
    setClientSearch("");
    setRows([]);
  };

  const handleExportPdf = async () => {
    if (!selectedClient) return;
    setExportingPdf(true);
    try {
      await api.exportDiscountCasePdf(selectedClient.partner_id, lang);
      showToast(t("exportReady"), "success");
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setExportingPdf(false);
    }
  };

  const summary = computeSummary(rows, vatRate, currentBalance, currentBalanceDiscount, carriedDiscountAmount);
  const totals = rows.reduce((acc, r) => {
    const { net, pretax, discountAmount } = computeRowAmounts(r, vatRate);
    acc.sales += Number(r.sales) || 0;
    acc.returns += Number(r.returns) || 0;
    acc.net += net;
    acc.pretax += pretax;
    acc.discount += discountAmount;
    acc.extra += Number(r.extra_discount) || 0;
    return acc;
  }, { sales: 0, returns: 0, net: 0, pretax: 0, discount: 0, extra: 0 });

  return (
    <div className="content-stack" style={{ maxWidth: "100%" }}>
      <div className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
          <div>
            <h2><Percent size={15} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />{t("discountsTitle")}</h2>
            <p className="panel-sub">{t("discountsHint")}</p>
          </div>
          {selectedClient && (
            <button className="btn-secondary sm" onClick={handleExportPdf} disabled={exportingPdf}>
              <Download size={13} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />
              {exportingPdf ? t("exporting") : t("print")}
            </button>
          )}
        </div>

        <div className="more-filters-row" style={{ marginBottom: 16 }}>
          <div className="more-filter-field" style={{ position: "relative", minWidth: 280 }}>
            <label>{t("customer")}</label>
            <div className="input-icon compact">
              <Search size={13} />
              <input
                value={clientSearch}
                onChange={(e) => { setClientSearch(e.target.value); if (selectedClient) setSelectedClient(null); }}
                placeholder={t("searchPlaceholder")}
              />
              {selectedClient && (
                <button className="icon-btn" onClick={clearClient}><X size={13} /></button>
              )}
            </div>
            {clientOptions.length > 0 && !selectedClient && (
              <div className="client-search-dropdown">
                {clientOptions.map((c) => (
                  <button key={c.partner_id} type="button" onClick={() => pickClient(c)}>
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {!selectedClient && <div className="empty-state">{t("selectCustomerToStart")}</div>}
        {error && <div className="error-state">{error}</div>}
        {loading && <div className="loading-state">{t("loadingDots")}</div>}

        {selectedClient && !loading && (
          <>
            <div className="table-wrap" style={{ marginBottom: 14 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t("discountBranch")}</th>
                    <th>{t("discountYear")}</th>
                    <th>{t("discountSales")}</th>
                    <th>{t("discountReturns")}</th>
                    <th>{t("discountNet")}</th>
                    <th>{t("discountPretax")}</th>
                    <th>{t("discountPercent")}</th>
                    <th>{t("discountAmount")}</th>
                    <th>{t("discountExtra")}</th>
                    <th>{t("discountNotes")}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const { net, pretax, discountAmount } = computeRowAmounts(r, vatRate);
                    return (
                      <tr key={i}>
                        <td><input className="cost-of-debt-input" value={r.branch} onChange={(e) => updateRow(i, "branch", e.target.value)} style={{ width: 90 }} /></td>
                        <td><input className="cost-of-debt-input" type="number" value={r.year} onChange={(e) => updateRow(i, "year", e.target.value)} style={{ width: 60 }} /></td>
                        <td><input className="cost-of-debt-input" type="number" step="0.01" value={r.sales} onChange={(e) => updateRow(i, "sales", e.target.value)} style={{ width: 100 }} /></td>
                        <td><input className="cost-of-debt-input" type="number" step="0.01" value={r.returns} onChange={(e) => updateRow(i, "returns", e.target.value)} style={{ width: 100 }} /></td>
                        <td><RiyalAmount amount={net} /></td>
                        <td><RiyalAmount amount={pretax} /></td>
                        <td><input className="cost-of-debt-input" type="number" step="0.01" value={r.discount_percent} onChange={(e) => updateRow(i, "discount_percent", e.target.value)} style={{ width: 55 }} />%</td>
                        <td><RiyalAmount amount={discountAmount} /></td>
                        <td><input className="cost-of-debt-input" type="number" step="0.01" value={r.extra_discount} onChange={(e) => updateRow(i, "extra_discount", e.target.value)} style={{ width: 90 }} /></td>
                        <td><input className="cost-of-debt-input" value={r.note || ""} onChange={(e) => updateRow(i, "note", e.target.value)} placeholder={t("discountNotePlaceholder")} style={{ width: 130 }} /></td>
                        <td><button className="icon-btn danger" onClick={() => removeRow(i)}><Trash2 size={13} /></button></td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="totals-row">
                    <td colSpan={2}>{t("total")}</td>
                    <td><RiyalAmount amount={totals.sales} /></td>
                    <td><RiyalAmount amount={totals.returns} /></td>
                    <td><RiyalAmount amount={totals.net} /></td>
                    <td><RiyalAmount amount={totals.pretax} /></td>
                    <td></td>
                    <td><RiyalAmount amount={totals.discount} /></td>
                    <td><RiyalAmount amount={totals.extra} /></td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <button className="btn-secondary sm" onClick={addRow} style={{ marginBottom: 18 }}>
              <Plus size={13} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />
              {t("discountAddRow")}
            </button>

            <div className="panel" style={{ marginBottom: 14 }}>
              <h3 className="insights-chart-title" style={{ marginBottom: 10 }}>{t("discountSettingsTitle")}</h3>
              <div className="more-filters-row">
                <div className="more-filter-field">
                  <label>{t("discountVatRate")}</label>
                  <input className="cost-of-debt-input" type="number" step="0.01" value={vatRate}
                    onChange={(e) => { setVatRate(e.target.value); scheduleSave({ vatRate: e.target.value }); }} style={{ width: 90 }} />
                </div>
                <div className="more-filter-field">
                  <label>{t("discountCarriedAmount")}</label>
                  <input className="cost-of-debt-input" type="number" step="0.01" value={carriedDiscountAmount}
                    onChange={(e) => { setCarriedDiscountAmount(e.target.value); scheduleSave({ carriedDiscountAmount: e.target.value }); }} style={{ width: 120 }} />
                </div>
                <div className="more-filter-field" style={{ minWidth: 220 }}>
                  <label>{t("discountCarriedNote")}</label>
                  <input className="cost-of-debt-input" value={carriedDiscountNote}
                    onChange={(e) => { setCarriedDiscountNote(e.target.value); scheduleSave({ carriedDiscountNote: e.target.value }); }} />
                </div>
              </div>
            </div>

            <div className="insights-kpi-grid" style={{ marginBottom: 18 }}>
              <div className="insights-kpi-card accent-teal">
                <div className="insights-kpi-label">{t("discountTotalCombined")}</div>
                <div className="insights-kpi-value">{money(summary.combinedDiscount)}</div>
              </div>
              <div className="insights-kpi-card accent-violet">
                <div className="insights-kpi-label">{t("discountTax")}</div>
                <div className="insights-kpi-value">{money(summary.tax)}</div>
              </div>
              <div className="insights-kpi-card accent-amber">
                <div className="insights-kpi-label">{t("discountTotalInclTax")}</div>
                <div className="insights-kpi-value">{money(summary.total)}</div>
              </div>
              <div className="insights-kpi-card accent-danger">
                <div className="insights-kpi-label">{t("discountCurrentBalance")}</div>
                <input className="cost-of-debt-input" type="number" step="0.01" value={currentBalance}
                  onChange={(e) => { setCurrentBalance(e.target.value); scheduleSave({ currentBalance: e.target.value }); }}
                  style={{ fontSize: 18, fontWeight: 700, width: "100%" }} />
              </div>
              <div className="insights-kpi-card accent-teal">
                <div className="insights-kpi-label">{t("discountBalanceDiscount")}</div>
                <input className="cost-of-debt-input" type="number" step="0.01" value={currentBalanceDiscount}
                  onChange={(e) => { setCurrentBalanceDiscount(e.target.value); scheduleSave({ currentBalanceDiscount: e.target.value }); }}
                  style={{ fontSize: 18, fontWeight: 700, width: "100%" }} />
              </div>
              <div className="insights-kpi-card accent-violet">
                <div className="insights-kpi-label">{t("discountDiff")}</div>
                <div className="insights-kpi-value" style={{ color: summary.diff >= 0 ? "var(--ok)" : "var(--danger)" }}>{money(summary.diff)}</div>
              </div>
              <div className="insights-kpi-card accent-amber">
                <div className="insights-kpi-label">{t("discountNetPayment")}</div>
                <div className="insights-kpi-value" style={{ color: summary.netPayment >= 0 ? "var(--ok)" : "var(--danger)" }}>{money(summary.netPayment)}</div>
              </div>
            </div>

            <div className="panel" style={{ marginBottom: 14 }}>
              <h3 className="insights-chart-title" style={{ marginBottom: 10 }}>{t("discountFinalNote")}</h3>
              <textarea
                className="cost-of-debt-input" rows={2} style={{ width: "100%" }}
                value={finalNote}
                onChange={(e) => { setFinalNote(e.target.value); scheduleSave({ finalNote: e.target.value }); }}
                placeholder={t("discountFinalNotePlaceholder")}
              />
            </div>

            <div className="panel">
              <h3 className="insights-chart-title" style={{ marginBottom: 10 }}>{t("discountApprovalTitle")}</h3>
              <div className="more-filters-row">
                <div className="more-filter-field">
                  <label>{t("discountPreparedBy")}</label>
                  <input className="cost-of-debt-input" value={preparedBy}
                    onChange={(e) => { setPreparedBy(e.target.value); scheduleSave({ preparedBy: e.target.value }); }} />
                </div>
                <div className="more-filter-field">
                  <label>{t("date")}</label>
                  <input className="cost-of-debt-input" type="date" value={preparedDate || ""}
                    onChange={(e) => { setPreparedDate(e.target.value); scheduleSave({ preparedDate: e.target.value }); }} />
                </div>
                <div className="more-filter-field">
                  <label>{t("discountApprovedBy")}</label>
                  <input className="cost-of-debt-input" value={approverName}
                    onChange={(e) => { setApproverName(e.target.value); scheduleSave({ approverName: e.target.value }); }} />
                </div>
                <div className="more-filter-field">
                  <label>{t("date")}</label>
                  <input className="cost-of-debt-input" type="date" value={approvalDate || ""}
                    onChange={(e) => { setApprovalDate(e.target.value); scheduleSave({ approvalDate: e.target.value }); }} />
                </div>
                <label className="checkbox-inline" onClick={() => { const v = !approved; setApproved(v); scheduleSave({ approved: v }); }}>
                  <input type="checkbox" checked={approved} readOnly />
                  {t("discountApproved")}
                </label>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
