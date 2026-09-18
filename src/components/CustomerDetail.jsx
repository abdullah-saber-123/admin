import { useEffect, useState } from "react";
import { X, Phone, MapPin, Receipt, Wallet, ChevronLeft, ChevronRight, ClipboardList, Download, Search, AlertTriangle, Mail, UserCheck, Flame, MessageCircle, CalendarClock, Banknote, TrendingUp, CalendarCheck, CircleDollarSign, Gift, Zap, CreditCard, Send, Share2, Megaphone } from "lucide-react";
import { api } from "../api";
import { useLang } from "../i18n.jsx";
import { useToast } from "../toast.jsx";
import { fmtDate, fmtDateTime, daysUntil } from "../dateUtils.js";
import RiyalAmount from "./RiyalAmount.jsx";
import useBodyScrollLock from "../hooks/useBodyScrollLock.js";
import ShareCustomerModal from "./ShareCustomerModal.jsx";
import RiskBadge from "./RiskBadge.jsx";
import AnnouncementComposeModal from "./AnnouncementComposeModal.jsx";
function waLink(phone) {
  if (!phone) return null;
  const digits = phone.replace(/[^\d]/g, "");
  return `https://wa.me/${digits}`;
}

const PRIORITY_TONE = {
  "Critical - 90+ Days": "danger",
  "High - 60+ Days": "warn",
  "Medium - 30+ Days": "warn",
  "Low - Overdue": "faint",
  "No Follow-up": "faint",
};

function MiniPager({ page, pageSize, total, onPage }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;
  return (
    <div className="mini-pager">
      <button disabled={page <= 1} onClick={() => onPage(page - 1)}><ChevronLeft size={14} /></button>
      <span>{page} / {totalPages}</span>
      <button disabled={page >= totalPages} onClick={() => onPage(page + 1)}><ChevronRight size={14} /></button>
    </div>
  );
}

export default function CustomerDetail({ partnerId, role, onClose, onSaved }) {
  const { t, money, lang, statusLabel } = useLang();
  const { showToast } = useToast();
  useBodyScrollLock(true);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showUrgentModal, setShowUrgentModal] = useState(false);
  const [showVisitModal, setShowVisitModal] = useState(false);
  const [visitReason, setVisitReason] = useState("");
  const [requestingVisit, setRequestingVisit] = useState(false);
  const [staffList, setStaffList] = useState(null);

  const [invoicePage, setInvoicePage] = useState(1);
  const [paymentPage, setPaymentPage] = useState(1);
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [paymentSearch, setPaymentSearch] = useState("");

  const [statuses, setStatuses] = useState([]);
  const [fuStatus, setFuStatus] = useState("");
  const [fuNote, setFuNote] = useState("");
  const [fuDate, setFuDate] = useState("");
  const [fuAmount, setFuAmount] = useState("");
  const [fuPaymentMode, setFuPaymentMode] = useState("");
  const [loggingFu, setLoggingFu] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const [activity, setActivity] = useState(null);
  const [showCostOfDebt, setShowCostOfDebt] = useState(false);
  const [costOfDebt, setCostOfDebt] = useState(null);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState(null);
  const [chatText, setChatText] = useState("");
  const [sendingChat, setSendingChat] = useState(false);

  const [showPaymentPlans, setShowPaymentPlans] = useState(false);
  const [paymentPlans, setPaymentPlans] = useState(null);
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [planTotal, setPlanTotal] = useState("");
  const [planCount, setPlanCount] = useState("4");
  const [planFrequency, setPlanFrequency] = useState("monthly");
  const [planStartDate, setPlanStartDate] = useState("");
  const [planNotes, setPlanNotes] = useState("");
  const [creatingPlan, setCreatingPlan] = useState(false);
  const [installmentEdit, setInstallmentEdit] = useState(null); // { planId, installmentId }
  const [installmentPaidAmount, setInstallmentPaidAmount] = useState("");
  const [installmentPaymentMode, setInstallmentPaymentMode] = useState("");

  const load = (invPage = invoicePage, payPage = paymentPage) => {
    api.customerDetail(partnerId, {
      invoice_page: invPage, payment_page: payPage, page_size: 20,
      invoice_search: invoiceSearch, payment_search: paymentSearch,
    })
      .then((d) => {
        setDetail(d);
        setFuStatus(d.summary.follow_up_status || "Not Contacted");
      })
      .catch((e) => setError(e.message));
  };

  useEffect(() => {
    setDetail(null);
    setError(null);
    setInvoicePage(1);
    setPaymentPage(1);
    setInvoiceSearch("");
    setPaymentSearch("");
    setShowActivity(false);
    setActivity(null);
    setShowCostOfDebt(false);
    setCostOfDebt(null);
    setShowChat(false);
    setChatMessages(null);
    load(1, 1);
    api.followupStatuses().then(setStatuses).catch(() => {});
  }, [partnerId]);

  const loadActivity = () => {
    api.customerActivity(partnerId, { page_size: 40 }).then(setActivity).catch((e) => setError(e.message));
  };

  const loadCostOfDebt = () => {
    api.costOfDebt(partnerId).then(setCostOfDebt).catch((e) => setError(e.message));
  };

  const loadChat = () => {
    api.getChat(partnerId).then(setChatMessages).catch(() => {});
  };

  const openUrgentModal = () => {
    api.staffList().then(setStaffList).catch(() => setStaffList([]));
    setShowUrgentModal(true);
  };

  const handleRequestVisit = async (e) => {
    e.preventDefault();
    if (!visitReason.trim()) return;
    setRequestingVisit(true);
    try {
      await api.createVisitRequest(partnerId, visitReason.trim());
      showToast(t("visitRequested"), "success");
      setShowVisitModal(false);
      setVisitReason("");
    } catch (e2) {
      showToast(e2.message, "error");
    } finally {
      setRequestingVisit(false);
    }
  };

  const loadPaymentPlans = () => {
    api.listCustomerPaymentPlans(partnerId).then(setPaymentPlans).catch((e) => setError(e.message));
  };

  const handleCreatePlan = async (e) => {
    e.preventDefault();
    if (!planTotal || !planCount || !planStartDate) return;
    setCreatingPlan(true);
    try {
      await api.createPaymentPlan(partnerId, {
        total_amount: parseFloat(planTotal), installment_count: parseInt(planCount, 10),
        frequency: planFrequency, start_date: planStartDate, notes: planNotes.trim() || null,
      });
      setPlanTotal(""); setPlanCount("4"); setPlanFrequency("monthly"); setPlanStartDate(""); setPlanNotes("");
      setShowPlanForm(false);
      loadPaymentPlans();
      showToast(t("planCreated"), "success");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setCreatingPlan(false);
    }
  };

  const handleMarkPaid = async (planId, installment) => {
    try {
      await api.updateInstallment(planId, installment.id, {
        status: "paid", paid_amount: installment.amount, paid_date: new Date().toISOString().slice(0, 10),
      });
      setInstallmentEdit(null);
      loadPaymentPlans();
      showToast(t("installmentMarkedPaid"), "success");
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  const handlePartialPay = async (planId, installmentId) => {
    if (!installmentPaidAmount) return;
    try {
      await api.updateInstallment(planId, installmentId, {
        status: "partial", paid_amount: parseFloat(installmentPaidAmount),
        paid_date: new Date().toISOString().slice(0, 10), payment_mode: installmentPaymentMode || null,
      });
      setInstallmentEdit(null);
      setInstallmentPaidAmount("");
      setInstallmentPaymentMode("");
      loadPaymentPlans();
      showToast(t("installmentUpdated"), "success");
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  const handleCancelPlan = async (planId) => {
    try {
      await api.cancelPaymentPlan(planId);
      loadPaymentPlans();
      showToast(t("planCancelled"), "success");
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  useEffect(() => {
    if (!showChat) return;
    loadChat();
    const interval = setInterval(loadChat, 6000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showChat, partnerId]);

  const sendChatMessage = async (e) => {
    e.preventDefault();
    if (!chatText.trim()) return;
    setSendingChat(true);
    try {
      await api.sendChat(partnerId, chatText.trim());
      setChatText("");
      loadChat();
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setSendingChat(false);
    }
  };

  useEffect(() => {
    if (detail) load(invoicePage, paymentPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoicePage, paymentPage]);

  useEffect(() => {
    if (!detail) return;
    const timer = setTimeout(() => { setInvoicePage(1); load(1, paymentPage); }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceSearch]);

  useEffect(() => {
    if (!detail) return;
    const timer = setTimeout(() => { setPaymentPage(1); load(invoicePage, 1); }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentSearch]);

  const submitFollowup = async (e) => {
    e.preventDefault();
    if (!fuNote.trim()) {
      setError(t("noteRequiredHint"));
      return;
    }
    if (selectedStatusCfg?.requires_next_date && !fuDate) {
      setError(t("requiresNextDateHint"));
      return;
    }
    if (selectedStatusCfg?.requires_payment_details && !fuAmount) {
      setError(t("requiresPaymentDetailsHint"));
      return;
    }
    const allowedFrom = (selectedStatusCfg?.allowed_from_statuses || "").split(",").map((x) => x.trim()).filter(Boolean);
    if (allowedFrom.length > 0 && !allowedFrom.includes(detail.summary.follow_up_status || "")) {
      setError(`"${statusLabel(fuStatus)}" ${t("ruleOnlyAfterShort")}: ${allowedFrom.map(statusLabel).join(", ")}`);
      return;
    }
    setLoggingFu(true);
    setError(null);
    try {
      await api.logFollowup(partnerId, {
        status: fuStatus,
        note: fuNote.trim(),
        next_follow_up_date: fuDate || null,
        amount: fuAmount ? parseFloat(fuAmount) : null,
        payment_mode: fuPaymentMode || null,
      });
      setFuNote("");
      setFuDate("");
      setFuAmount("");
      setFuPaymentMode("");
      load(invoicePage, paymentPage);
      onSaved?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoggingFu(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await api.exportCustomerDetail(partnerId);
      showToast(t("exportReady"), "success");
    } catch (e) {
      setError(e.message);
      showToast(e.message, "error");
    } finally {
      setExporting(false);
    }
  };

  const handlePdfExport = async () => {
    setExportingPdf(true);
    try {
      await api.exportStatementPdf(partnerId, lang);
      showToast(t("exportReady"), "success");
    } catch (e) {
      setError(e.message);
      showToast(e.message, "error");
    } finally {
      setExportingPdf(false);
    }
  };

  const custStatusLabel = (s) => {
    if (s === "Overdue") return t("statusOverdue");
    if (s === "Pending") return t("statusPending");
    if (s === "Paid") return t("statusPaid");
    return s;
  };

  const paymentModeLabel = (mode, tr) => {
    const map = {
      Cash: tr("paymentModeCash"), "Bank Transfer": tr("paymentModeBankTransfer"),
      Cheque: tr("paymentModeCheque"), Online: tr("paymentModeOnline"), Other: tr("paymentModeOther"),
    };
    return map[mode] || mode;
  };

  const selectedStatusCfg = statuses.find((s) => s.name === fuStatus);

  // Merges follow-up log entries and actual received payments into one
  // chronological feed - "everything that happened with this customer",
  // rather than two separate lists you have to cross-reference by date.
  const activityTimeline = detail ? [
    ...detail.followup_history.map((f) => ({ kind: "followup", date: f.created_at, ...f })),
    ...detail.payments.results.map((p) => ({ kind: "payment", date: p.date, ...p })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date)) : [];

  const priorityLabel = (p) => {
    if (p === "Critical - 90+ Days") return `${t("priorityCritical")} (90+)`;
    if (p === "High - 60+ Days") return `${t("priorityHigh")} (60+)`;
    if (p === "Medium - 30+ Days") return `${t("priorityMedium")} (30+)`;
    if (p === "Low - Overdue") return t("priorityLow");
    return t("priorityNone");
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="detail-panel" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}><X size={20} /></button>

        {error && <div className="error-state">{error}</div>}
        {!error && !detail && <div className="loading-state">{t("loadingDots")}</div>}

        {detail && (
          <>
            <div className="detail-header">
              <h2>{detail.profile.name} <RiskBadge level={detail.summary.risk_level} /></h2>
              <div className="phone-line">
                <Phone size={13} style={{ verticalAlign: -2, marginInlineEnd: 4 }} />
                <bdi dir="ltr">{detail.profile.phone || "—"}</bdi>
                {detail.profile.phone && (
                  <>
                    <a href={`tel:${detail.profile.phone}`} className="quick-action" title={t("callAction")} style={{ marginInlineStart: 6 }}>
                      <Phone size={12} />
                    </a>
                    <a href={waLink(detail.profile.phone)} target="_blank" rel="noreferrer" className="quick-action wa" title={t("whatsappAction")}>
                      <MessageCircle size={12} />
                    </a>
                  </>
                )}
                {detail.profile.city ? (
                  <> · <MapPin size={13} style={{ verticalAlign: -2, marginInlineEnd: 2 }} />{detail.profile.city}</>
                ) : ""}
              </div>
              {detail.profile.email && (
                <div className="phone-line" style={{ marginTop: 3 }}>
                  <Mail size={13} style={{ verticalAlign: -2, marginInlineEnd: 4 }} />
                  {detail.profile.email}
                </div>
              )}
              {detail.profile.salesperson_name && (
                <div className="phone-line" style={{ marginTop: 3 }}>
                  <UserCheck size={13} style={{ verticalAlign: -2, marginInlineEnd: 4 }} />
                  {t("collectorLabel")}: {detail.profile.salesperson_name}
                </div>
              )}

              <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <span className={`status-tag ${detail.summary.status}`}>{custStatusLabel(detail.summary.status)}</span>

                {detail.summary.follow_up_status === "Called - Promised Payment"
                  && detail.summary.next_follow_up_date
                  && new Date(detail.summary.next_follow_up_date) < new Date()
                  && detail.summary.current_due > 0 ? (
                  <span className="fu-tag danger">
                    <AlertTriangle size={11} style={{ verticalAlign: -1, marginInlineEnd: 3 }} />
                    {t("brokenPromiseBadge")}
                  </span>
                ) : (
                  <span className={`fu-tag ${(statuses.find((s) => s.name === detail.summary.follow_up_status)?.tone) || "faint"}`}>
                    {statusLabel(detail.summary.follow_up_status || "Not Contacted")}
                  </span>
                )}

                {detail.summary.follow_up_priority && detail.summary.follow_up_priority !== "No Follow-up" && (
                  <span className={`fu-tag ${PRIORITY_TONE[detail.summary.follow_up_priority] || "faint"}`}>
                    <Flame size={11} style={{ verticalAlign: -1, marginInlineEnd: 3 }} />
                    {priorityLabel(detail.summary.follow_up_priority)}
                  </span>
                )}

                {detail.summary.credit_limit ? (
                  <span className={`fu-tag ${detail.summary.current_due > detail.summary.credit_limit ? "danger" : "faint"}`}>
                    <CreditCard size={11} style={{ verticalAlign: -1, marginInlineEnd: 3 }} />
                    {t("creditLimitLabel")}: <RiyalAmount amount={detail.summary.credit_limit} />
                  </span>
                ) : null}
                {detail.summary.nominated_for_offer && (
                  <span className="fu-tag ok">
                    <Gift size={11} style={{ verticalAlign: -1, marginInlineEnd: 3 }} />
                    {t("nominatedActive")}
                  </span>
                )}
                {detail.summary.nominated_for_collection && (
                  <span className="fu-tag warn">
                    <Zap size={11} style={{ verticalAlign: -1, marginInlineEnd: 3 }} />
                    {t("nominatedCollectionActive")}
                  </span>
                )}

                <button className="btn-secondary sm detail-export-btn" onClick={handleExport} disabled={exporting}>
                  <Download size={13} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />
                  {exporting ? t("exporting") : t("export")}
                </button>
                <button className="btn-secondary sm" onClick={handlePdfExport} disabled={exportingPdf}>
                  <Receipt size={13} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />
                  {exportingPdf ? t("exporting") : t("pdfStatement")}
                </button>
                <button className="btn-secondary sm" onClick={() => setShowShareModal(true)}>
                  <Share2 size={13} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />
                  {t("shareCustomerButton")}
                </button>
                <button className="btn-secondary sm" onClick={() => setShowVisitModal(true)}>
                  <MapPin size={13} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />
                  {t("requestVisitButton")}
                </button>
                {role === "admin" && (
                  <button className="btn-secondary sm danger" onClick={openUrgentModal}>
                    <Megaphone size={13} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />
                    {t("markUrgent")}
                  </button>
                )}
              </div>

              {detail.summary.last_payment_date && (() => {
                const daysSincePayment = -daysUntil(detail.summary.last_payment_date);
                return daysSincePayment > 0 ? (
                  <div className="overdue-banner">
                    <CalendarClock size={13} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />
                    <bdi>{daysSincePayment}</bdi> {t("daysSinceLastPayment")}
                  </div>
                ) : null;
              })()}
            </div>

            <div className="detail-summary">
              <div className="mini-stat">
                <div className="k"><Wallet size={11} style={{ verticalAlign: -1, marginInlineEnd: 3 }} />{t("balanceDueLabel")}</div>
                <div className="v"><RiyalAmount amount={detail.summary.current_due} /></div>
              </div>
              <div className="mini-stat">
                <div className="k"><AlertTriangle size={11} style={{ verticalAlign: -1, marginInlineEnd: 3 }} />{t("overdueAmount")}</div>
                <div className="v"><RiyalAmount amount={detail.summary.overdue_amount} /></div>
              </div>
              <div className="mini-stat">
                <div className="k"><TrendingUp size={11} style={{ verticalAlign: -1, marginInlineEnd: 3 }} />{t("totalInvoiced")}</div>
                <div className="v"><RiyalAmount amount={detail.summary.total_invoiced} /></div>
              </div>
              <div className="mini-stat">
                <div className="k"><CircleDollarSign size={11} style={{ verticalAlign: -1, marginInlineEnd: 3 }} />{t("totalPaid")}</div>
                <div className="v"><RiyalAmount amount={detail.summary.total_paid} /></div>
              </div>
              <div className="mini-stat">
                <div className="k"><CalendarCheck size={11} style={{ verticalAlign: -1, marginInlineEnd: 3 }} />{t("lastPaymentDate")}</div>
                <div className="v">{fmtDate(detail.summary.last_payment_date)}</div>
              </div>
              <div className="mini-stat">
                <div className="k"><Banknote size={11} style={{ verticalAlign: -1, marginInlineEnd: 3 }} />{t("lastPaymentAmount")}</div>
                <div className="v"><RiyalAmount amount={detail.summary.last_payment_amount} /></div>
              </div>
              <div className="mini-stat next-due-stat">
                <div className="k"><CalendarClock size={11} style={{ verticalAlign: -1, marginInlineEnd: 3 }} />{t("oldestUnpaidDue")}</div>
                <div className={`v ${detail.summary.next_due_date && new Date(detail.summary.next_due_date) < new Date() ? "overdue-text" : ""}`}>
                  {detail.summary.next_due_date ? (
                    <>
                      {fmtDate(detail.summary.next_due_date)}
                      {detail.summary.next_due_amount ? <span className="mini-stat-sub"><RiyalAmount amount={detail.summary.next_due_amount} /></span> : null}
                      {detail.summary.next_due_invoice && <span className="mini-stat-invoice">{detail.summary.next_due_invoice}</span>}
                      {detail.summary.max_days_overdue > 0 && (
                        <span className="mini-stat-days overdue"><bdi>{detail.summary.max_days_overdue}</bdi> {t("daysOverdueLabel")}</span>
                      )}
                    </>
                  ) : t("noOpenInvoices")}
                </div>
              </div>
              <div className="mini-stat upcoming-stat">
                <div className="k"><CalendarClock size={11} style={{ verticalAlign: -1, marginInlineEnd: 3 }} />{t("upcomingInstallment")}</div>
                <div className="v">
                  {detail.summary.upcoming_installment_date ? (
                    <>
                      {fmtDate(detail.summary.upcoming_installment_date)}
                      {detail.summary.upcoming_installment_amount ? <span className="mini-stat-sub"><RiyalAmount amount={detail.summary.upcoming_installment_amount} /></span> : null}
                      {detail.summary.upcoming_installment_invoice && <span className="mini-stat-invoice">{detail.summary.upcoming_installment_invoice}</span>}
                      <span className="mini-stat-days upcoming">
                        {t("dueIn")} <bdi>{Math.max(0, daysUntil(detail.summary.upcoming_installment_date))}</bdi> {t("daysLabel")}
                      </span>
                    </>
                  ) : t("noUpcomingInstallment")}
                </div>
              </div>
            </div>

            <div className="followup-box">
              <h3><ClipboardList size={13} style={{ verticalAlign: -2, marginInlineEnd: 4 }} />{t("logFollowup")}</h3>
              <form onSubmit={submitFollowup} className="admin-form">
                <label>{t("status")}</label>
                <select value={fuStatus} onChange={(e) => setFuStatus(e.target.value)}>
                  {(statuses.length ? statuses : [{ id: fuStatus, name: fuStatus }]).map((s) => {
                    const allowedFrom = (s.allowed_from_statuses || "").split(",").map((x) => x.trim()).filter(Boolean);
                    const isNotContactedBlocked = s.name === "Not Contacted" && role !== "admin";
                    const isBlocked = (allowedFrom.length > 0 && !allowedFrom.includes(detail.summary.follow_up_status || "")) || isNotContactedBlocked;
                    return (
                      <option key={s.id} value={s.name} disabled={isBlocked}>
                        {statusLabel(s.name)}{isBlocked && !isNotContactedBlocked ? ` (${t("ruleOnlyAfterShort")})` : ""}
                      </option>
                    );
                  })}
                </select>
                {selectedStatusCfg?.requires_next_date && (
                  <div className="mention-hint" style={{ color: "var(--danger)" }}>{t("requiresNextDateHint")}</div>
                )}
                {selectedStatusCfg?.requires_payment_details && (
                  <>
                    <label>{t("amountReceived")}</label>
                    <input
                      type="number" min="0" step="0.01" value={fuAmount}
                      onChange={(e) => setFuAmount(e.target.value)}
                      placeholder="0.00"
                    />
                    <label>{t("paymentMode")}</label>
                    <select value={fuPaymentMode} onChange={(e) => setFuPaymentMode(e.target.value)}>
                      <option value="">{t("selectOption")}</option>
                      <option value="Cash">{t("paymentModeCash")}</option>
                      <option value="Bank Transfer">{t("paymentModeBankTransfer")}</option>
                      <option value="Cheque">{t("paymentModeCheque")}</option>
                      <option value="Online">{t("paymentModeOnline")}</option>
                      <option value="Other">{t("paymentModeOther")}</option>
                    </select>
                    <div className="mention-hint" style={{ color: "var(--danger)" }}>{t("requiresPaymentDetailsHint")}</div>
                  </>
                )}
                <label>{t("noteRequired")}</label>
                <input value={fuNote} onChange={(e) => setFuNote(e.target.value)} placeholder={t("followupHint")} required />
                <div className="mention-hint">{t("mentionHint")}</div>
                <label>{t("nextFollowupDate")}</label>
                <input type="date" value={fuDate} onChange={(e) => setFuDate(e.target.value)} />
                <button className="btn-primary" type="submit" disabled={loggingFu} style={{ marginTop: 10, alignSelf: "flex-start" }}>
                  {loggingFu ? t("logging") : t("logFollowup")}
                </button>
              </form>

              {activityTimeline.length > 0 && (
                <div className="fu-history">
                  <div className="user-form-section-title" style={{ marginBottom: 8 }}>{t("activityTimelineTitle")}</div>
                  {activityTimeline.map((item) => (
                    item.kind === "payment" ? (
                      <div key={`pay-${item.payment_id}`} className="fu-entry fu-entry-payment-row">
                        <div className="fu-entry-top">
                          <span className="fu-tag sm ok">
                            <Wallet size={11} style={{ verticalAlign: -1, marginInlineEnd: 3 }} />
                            {t("paymentReceivedLabel")}
                          </span>
                          <span className="fu-entry-meta">{fmtDateTime(item.date)}</span>
                        </div>
                        <div className="fu-entry-note fu-entry-payment">
                          <RiyalAmount amount={item.amount} />{item.journal_name ? ` · ${item.journal_name}` : ""}{item.reference ? ` · ${item.reference}` : ""}
                        </div>
                      </div>
                    ) : (
                      <div key={`fu-${item.id}`} className="fu-entry">
                        <div className="fu-entry-top">
                          <span className={`fu-tag sm ${(statuses.find((s) => s.name === item.status)?.tone) || "faint"}`}>{statusLabel(item.status)}</span>
                          <span className="fu-entry-meta">{item.username} · {fmtDateTime(item.created_at)}</span>
                        </div>
                        {item.note && <div className="fu-entry-note">{item.note}</div>}
                        {item.amount != null && (
                          <div className="fu-entry-note fu-entry-payment">
                            <RiyalAmount amount={item.amount} />{item.payment_mode ? ` · ${paymentModeLabel(item.payment_mode, t)}` : ""}
                          </div>
                        )}
                        {item.next_follow_up_date && (
                          <div className="fu-entry-note">{t("nextFollowupDate")}: {fmtDate(item.next_follow_up_date)}</div>
                        )}
                      </div>
                    )
                  ))}
                </div>
              )}
            </div>

            {role === "admin" && (
              <div className="notes-box">
                <div className="k" style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 6 }}>
                  <UserCheck size={12} style={{ verticalAlign: -2, marginInlineEnd: 4 }} />
                  {t("portalTitle")}
                </div>
                <span className={`fu-tag ${detail.summary.portal_username && detail.summary.portal_active ? "ok" : "faint"}`}>
                  {detail.summary.portal_username
                    ? (detail.summary.portal_active ? t("portalActive") : t("portalDisabled"))
                    : t("portalNotSet")}
                </span>
                <p className="settings-meta" style={{ margin: "6px 0 0" }}>{t("portalManageHint")}</p>
              </div>
            )}

            <div className="history-section">
              <div className="history-section-head" style={{ cursor: "pointer" }} onClick={() => { setShowActivity((v) => !v); if (!activity) loadActivity(); }}>
                <h3><ClipboardList size={13} style={{ verticalAlign: -2, marginInlineEnd: 4 }} />{t("activityFeed")}</h3>
                <span className="activity-toggle">{showActivity ? "−" : "+"}</span>
              </div>
              {showActivity && (
                <div className="activity-timeline">
                  {!activity && <div className="loading-state">{t("loadingDots")}</div>}
                  {activity && activity.results.length === 0 && (
                    <div className="empty-state">{t("noActivity")}</div>
                  )}
                  {activity && activity.results.map((ev, i) => (
                    <div key={i} className={`activity-item activity-${ev.type}`}>
                      <div className="activity-dot" />
                      <div className="activity-body">
                        <div className="activity-title">
                          {ev.type === "invoice" && <><Receipt size={12} /> {t("activityInvoice")}: {ev.title}</>}
                          {ev.type === "credit_note" && <><Receipt size={12} /> {t("activityCreditNote")}: {ev.title}</>}
                          {ev.type === "payment" && <><Wallet size={12} /> {t("activityPayment")}: {ev.title}</>}
                          {ev.type === "followup" && <><ClipboardList size={12} /> {statusLabel(ev.title)}</>}
                        </div>
                        <div className="activity-meta">
                          {fmtDateTime(ev.date)}
                          {ev.type === "followup" && ev.username && ` · ${ev.username}`}
                          {(ev.type === "invoice" || ev.type === "credit_note" || ev.type === "payment") && ev.amount ? (
                            <> · <RiyalAmount amount={ev.amount} /></>
                          ) : null}
                        </div>
                        {ev.note && <div className="activity-note">{ev.note}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="history-section">
              <div className="history-section-head" style={{ cursor: "pointer" }} onClick={() => { setShowCostOfDebt((v) => !v); if (!costOfDebt) loadCostOfDebt(); }}>
                <h3><CircleDollarSign size={13} style={{ verticalAlign: -2, marginInlineEnd: 4 }} />{t("costOfDebtTitle")}</h3>
                <span className="activity-toggle">{showCostOfDebt ? "−" : "+"}</span>
              </div>
              {showCostOfDebt && (
                <div className="cost-of-debt-wrap">
                  {!costOfDebt && <div className="loading-state">{t("loadingDots")}</div>}
                  {costOfDebt && (
                    <div className="table-wrap">
                      <table className="data-table cost-of-debt-table">
                        <thead>
                          <tr>
                            <th>{t("codRow")}</th>
                            {costOfDebt.buckets.map((b) => (
                              <th key={b.bucket}>{t(`codBucket_${b.bucket}`)}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td>{t("codCurrentAmount")}</td>
                            {costOfDebt.buckets.map((b) => (
                              <td key={b.bucket}>{b.current_amount ? <RiyalAmount amount={b.current_amount} /> : "—"}</td>
                            ))}
                          </tr>
                          <tr>
                            <td>{t("codDiscountPct")}</td>
                            {costOfDebt.buckets.map((b) => (
                              <td key={b.bucket}>{b.discount_percent}%</td>
                            ))}
                          </tr>
                          <tr>
                            <td>{t("codDiscountCost")}</td>
                            {costOfDebt.buckets.map((b) => (
                              <td key={b.bucket}>{b.discount_cost ? <RiyalAmount amount={b.discount_cost} /> : "—"}</td>
                            ))}
                          </tr>
                          <tr>
                            <td>{t("codReturnPct")}</td>
                            {costOfDebt.buckets.map((b) => (
                              <td key={b.bucket}>{b.return_on_capital_percent}%</td>
                            ))}
                          </tr>
                          <tr>
                            <td>{t("codReturnValue")}</td>
                            {costOfDebt.buckets.map((b) => (
                              <td key={b.bucket}>{b.return_on_capital_value ? <RiyalAmount amount={b.return_on_capital_value} /> : "—"}</td>
                            ))}
                          </tr>
                          <tr>
                            <td>{t("codGracePeriod")}</td>
                            {costOfDebt.buckets.map((b) => (
                              <td key={b.bucket}>{b.grace_period_days}</td>
                            ))}
                          </tr>
                          <tr>
                            <td>{t("codDaysOfYear")}</td>
                            {costOfDebt.buckets.map((b) => (
                              <td key={b.bucket}>{b.days_of_year}</td>
                            ))}
                          </tr>
                          <tr>
                            <td>{t("codTargetCost")}</td>
                            {costOfDebt.buckets.map((b) => (
                              <td key={b.bucket}>{b.target_cost ? <RiyalAmount amount={b.target_cost} /> : "—"}</td>
                            ))}
                          </tr>
                          <tr>
                            <td>{t("codBreakeven")}</td>
                            {costOfDebt.buckets.map((b) => (
                              <td key={b.bucket} style={{ fontWeight: 700 }}>
                                {b.breakeven_days !== null ? <bdi>{b.breakeven_days}</bdi> : t("codDivZero")}
                              </td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="history-section">
              <div className="history-section-head" style={{ cursor: "pointer" }} onClick={() => { setShowPaymentPlans((v) => !v); if (!paymentPlans) loadPaymentPlans(); }}>
                <h3><CalendarClock size={13} style={{ verticalAlign: -2, marginInlineEnd: 4 }} />{t("paymentPlanTitle")}</h3>
                <span className="activity-toggle">{showPaymentPlans ? "−" : "+"}</span>
              </div>
              {showPaymentPlans && (
                <div className="payment-plan-wrap">
                  {!paymentPlans && <div className="loading-state">{t("loadingDots")}</div>}

                  {paymentPlans && !showPlanForm && (
                    <button className="btn-secondary sm" onClick={() => setShowPlanForm(true)} style={{ marginBottom: 12 }}>
                      + {t("createPaymentPlan")}
                    </button>
                  )}

                  {showPlanForm && (
                    <form onSubmit={handleCreatePlan} className="admin-form payment-plan-form" style={{ maxWidth: 420, marginBottom: 16 }}>
                      <label>{t("totalAmount")}</label>
                      <input type="number" min="0" step="0.01" value={planTotal} onChange={(e) => setPlanTotal(e.target.value)} required />
                      <label>{t("numberOfInstallments")}</label>
                      <input type="number" min="1" max="60" value={planCount} onChange={(e) => setPlanCount(e.target.value)} required />
                      <label>{t("frequency")}</label>
                      <select value={planFrequency} onChange={(e) => setPlanFrequency(e.target.value)}>
                        <option value="weekly">{t("frequencyWeekly")}</option>
                        <option value="biweekly">{t("frequencyBiweekly")}</option>
                        <option value="monthly">{t("frequencyMonthly")}</option>
                      </select>
                      <label>{t("startDate")}</label>
                      <input type="date" value={planStartDate} onChange={(e) => setPlanStartDate(e.target.value)} required />
                      <label>{t("noteOptional")}</label>
                      <input value={planNotes} onChange={(e) => setPlanNotes(e.target.value)} />
                      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                        <button className="btn-primary" type="submit" disabled={creatingPlan}>
                          {creatingPlan ? t("saving") : t("createPaymentPlan")}
                        </button>
                        <button className="btn-secondary" type="button" onClick={() => setShowPlanForm(false)}>{t("cancel")}</button>
                      </div>
                    </form>
                  )}

                  {paymentPlans && paymentPlans.length === 0 && !showPlanForm && (
                    <div className="empty-state">{t("noPaymentPlans")}</div>
                  )}

                  {paymentPlans && paymentPlans.map((plan) => (
                    <div key={plan.id} className="payment-plan-card">
                      <div className="payment-plan-card-head">
                        <div>
                          <strong><RiyalAmount amount={plan.total_amount} /></strong>
                          <span className="payment-plan-meta"> · {plan.installment_count} {t(`frequency${plan.frequency.charAt(0).toUpperCase()}${plan.frequency.slice(1)}`)}</span>
                          <span className={`fu-tag sm ${plan.status === "completed" ? "ok" : plan.status === "cancelled" ? "faint" : plan.status === "broken" ? "danger" : "warn"}`} style={{ marginInlineStart: 8 }}>
                            {t(`planStatus_${plan.status}`)}
                          </span>
                        </div>
                        {plan.status === "active" && (
                          <button className="icon-btn danger" title={t("cancelPlan")} onClick={() => handleCancelPlan(plan.id)}>
                            <X size={14} />
                          </button>
                        )}
                      </div>
                      <div className="payment-plan-progress">
                        {t("paidSoFar")}: <RiyalAmount amount={plan.paid_total} /> / <RiyalAmount amount={plan.total_amount} />
                      </div>
                      <div className="payment-plan-installments">
                        {plan.installments.map((inst) => (
                          <div key={inst.id} className={`payment-plan-installment ${inst.status}`}>
                            <div className="payment-plan-installment-main">
                              <span className="payment-plan-installment-num">#{inst.installment_number}</span>
                              <span>{fmtDate(inst.due_date)}</span>
                              <strong><RiyalAmount amount={inst.amount} /></strong>
                              <span className={`fu-tag sm ${inst.status === "paid" ? "ok" : inst.status === "overdue" ? "danger" : inst.status === "partial" ? "warn" : "faint"}`}>
                                {t(`installmentStatus_${inst.status}`)}
                              </span>
                            </div>
                            {inst.status === "paid" ? (
                              <div className="payment-plan-installment-paid-note">
                                {t("paidOn")} {fmtDate(inst.paid_date)}{inst.payment_mode ? ` · ${paymentModeLabel(inst.payment_mode, t)}` : ""}
                              </div>
                            ) : (
                              installmentEdit?.installmentId === inst.id ? (
                                <div className="payment-plan-installment-edit">
                                  <input
                                    type="number" min="0" step="0.01" placeholder={t("amountPaid")}
                                    value={installmentPaidAmount} onChange={(e) => setInstallmentPaidAmount(e.target.value)}
                                  />
                                  <select value={installmentPaymentMode} onChange={(e) => setInstallmentPaymentMode(e.target.value)}>
                                    <option value="">{t("selectOption")}</option>
                                    <option value="Cash">{t("paymentModeCash")}</option>
                                    <option value="Bank Transfer">{t("paymentModeBankTransfer")}</option>
                                    <option value="Cheque">{t("paymentModeCheque")}</option>
                                    <option value="Online">{t("paymentModeOnline")}</option>
                                  </select>
                                  <button className="btn-primary sm" onClick={() => handlePartialPay(plan.id, inst.id)}>{t("save")}</button>
                                  <button className="btn-secondary sm" onClick={() => setInstallmentEdit(null)}>{t("cancel")}</button>
                                </div>
                              ) : (
                                <div className="payment-plan-installment-actions">
                                  <button className="btn-secondary sm" onClick={() => handleMarkPaid(plan.id, inst)}>{t("markPaid")}</button>
                                  <button className="btn-secondary sm" onClick={() => { setInstallmentEdit({ planId: plan.id, installmentId: inst.id }); setInstallmentPaidAmount(""); setInstallmentPaymentMode(""); }}>
                                    {t("partialPayment")}
                                  </button>
                                </div>
                              )
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="history-section">
              <div className="history-section-head" style={{ cursor: "pointer" }} onClick={() => setShowChat((v) => !v)}>
                <h3><MessageCircle size={13} style={{ verticalAlign: -2, marginInlineEnd: 4 }} />{t("chatWithCustomer")}</h3>
                <span className="activity-toggle">{showChat ? "−" : "+"}</span>
              </div>
              {showChat && (
                <div className="chat-window staff-chat-window">
                  {!chatMessages && <div className="loading-state">{t("loadingDots")}</div>}
                  {chatMessages && chatMessages.length === 0 && <div className="empty-state">{t("noMessagesYet")}</div>}
                  {chatMessages && chatMessages.map((m) => (
                    <div key={m.id} className={`chat-bubble ${m.sender_type === "staff" ? "mine" : "theirs"}`}>
                      {m.sender_type === "staff" && m.sender_username && (
                        <div className="chat-bubble-sender">{m.sender_username}</div>
                      )}
                      <div className="chat-bubble-text">{m.message}</div>
                      <div className="chat-bubble-time">{fmtDateTime(m.created_at)}</div>
                    </div>
                  ))}
                  <form onSubmit={sendChatMessage} className="chat-input-row">
                    <input value={chatText} onChange={(e) => setChatText(e.target.value)} placeholder={t("typeMessage")} />
                    <button type="submit" className="btn-primary sm" disabled={sendingChat || !chatText.trim()}>
                      <Send size={14} />
                    </button>
                  </form>
                </div>
              )}
            </div>

            <div className="history-section">
              <div className="history-section-head">
                <h3><Receipt size={13} style={{ verticalAlign: -2, marginInlineEnd: 4 }} />{t("invoices")} ({detail.invoices.total})</h3>
                <MiniPager page={invoicePage} pageSize={20} total={detail.invoices.total} onPage={setInvoicePage} />
              </div>
              <div className="input-icon compact" style={{ marginBottom: 8 }}>
                <Search size={13} />
                <input
                  placeholder={t("searchInvoice")}
                  value={invoiceSearch}
                  onChange={(e) => setInvoiceSearch(e.target.value)}
                />
              </div>
              {detail.invoices.results.length === 0 && (
                <div className="empty-state">
                  {invoiceSearch ? t("noInvoicesSearch") : t("noInvoices")}
                </div>
              )}
              {detail.invoices.results.map((i) => (
                <div key={i.invoice_id} className="history-row invoice-row">
                  <span>
                    {i.number} · {fmtDate(i.invoice_date)}
                    {i.sales_team && <span className="sales-team-tag">{i.sales_team}</span>}
                  </span>
                  <span>
                    <RiyalAmount amount={i.amount_residual} /> / <RiyalAmount amount={i.amount_total} />
                    {i.days_overdue > 0 && i.amount_residual > 0 ? ` · ${i.days_overdue}d` : ""}
                  </span>
                </div>
              ))}
            </div>

            <div className="history-section">
              <div className="history-section-head">
                <h3><Wallet size={13} style={{ verticalAlign: -2, marginInlineEnd: 4 }} />{t("payments")} ({detail.payments.total})</h3>
                <MiniPager page={paymentPage} pageSize={20} total={detail.payments.total} onPage={setPaymentPage} />
              </div>
              <div className="input-icon compact" style={{ marginBottom: 8 }}>
                <Search size={13} />
                <input
                  placeholder={t("searchPayment")}
                  value={paymentSearch}
                  onChange={(e) => setPaymentSearch(e.target.value)}
                />
              </div>
              {detail.payments.results.length === 0 && (
                <div className="empty-state">
                  {paymentSearch ? t("noPaymentsSearch") : t("noPayments")}
                </div>
              )}
              {detail.payments.results.map((p) => (
                <div key={p.payment_id} className="history-row">
                  <span>{p.reference} · {fmtDate(p.date)}</span>
                  <span><RiyalAmount amount={p.amount} /> {p.journal_name ? `· ${p.journal_name}` : ""}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      {showShareModal && (
        <ShareCustomerModal partnerId={partnerId} onClose={() => setShowShareModal(false)} />
      )}
      {showVisitModal && (
        <div className="overlay modal-overlay" onClick={() => setShowVisitModal(false)}>
          <div className="prompt-modal" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setShowVisitModal(false)}><X size={16} /></button>
            <h3><MapPin size={15} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />{t("requestVisitButton")}</h3>
            <p className="prompt-message">{detail.profile.name}</p>
            <form onSubmit={handleRequestVisit}>
              <label>{t("visitReasonLabel")}</label>
              <textarea rows={3} value={visitReason} onChange={(e) => setVisitReason(e.target.value)} placeholder={t("visitReasonPlaceholder")} autoFocus />
              <div className="prompt-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowVisitModal(false)}>{t("cancel")}</button>
                <button type="submit" className="btn-primary" disabled={!visitReason.trim() || requestingVisit}>
                  {requestingVisit ? t("saving") : t("save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showUrgentModal && (
        <AnnouncementComposeModal
          contacts={staffList || []}
          initialSelected={(staffList || []).filter((s) => s.full_name === detail.profile.salesperson_name).map((s) => s.username)}
          initialMessage={t("urgentMessageTemplate").replace("{name}", detail.profile.name).replace("{balance}", detail.summary.current_due)}
          partnerId={partnerId}
          onClose={() => setShowUrgentModal(false)}
        />
      )}
    </div>
  );
}
