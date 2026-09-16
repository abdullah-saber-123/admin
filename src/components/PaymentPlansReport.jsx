import { useEffect, useState } from "react";
import { CalendarClock } from "lucide-react";
import { api } from "../api";
import { useLang } from "../i18n.jsx";
import RiyalAmount from "./RiyalAmount.jsx";

export default function PaymentPlansReport({ onSelectCustomer }) {
  const { t } = useLang();
  const [statusFilter, setStatusFilter] = useState("active");
  const [plans, setPlans] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setPlans(null);
    api.listAllPaymentPlans(statusFilter).then(setPlans).catch((e) => setError(e.message));
  }, [statusFilter]);

  const overdueCount = (plan) => plan.installments.filter((i) => i.status === "overdue").length;

  return (
    <div className="content-stack" style={{ maxWidth: "100%" }}>
      <div className="panel">
        <h2><CalendarClock size={15} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />{t("paymentPlansPageTitle")}</h2>
        <p className="panel-sub">{t("paymentPlansPageHint")}</p>

        <div className="quick-toggle-row">
          {["active", "completed", "cancelled"].map((s) => (
            <button
              key={s}
              className={`quick-toggle-chip ${statusFilter === s ? "active" : ""}`}
              onClick={() => setStatusFilter(s)}
            >
              {t(`planStatus_${s}`)}
            </button>
          ))}
        </div>

        {error && <div className="error-state">{error}</div>}
        {!error && !plans && <div className="loading-state">{t("loadingDots")}</div>}
        {plans && plans.length === 0 && <div className="empty-state">{t("noPaymentPlans")}</div>}

        {plans && plans.length > 0 && (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t("customer")}</th>
                  <th>{t("totalAmount")}</th>
                  <th>{t("paidSoFar")}</th>
                  <th>{t("numberOfInstallments")}</th>
                  <th>{t("frequency")}</th>
                  <th>{t("status")}</th>
                  <th>{t("overdue")}</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((plan) => (
                  <tr key={plan.id} className="clickable-row" onClick={() => onSelectCustomer?.(plan.partner_id)}>
                    <td data-label={t("customer")}><span className="cust-name">{plan.customer_name}</span></td>
                    <td data-label={t("totalAmount")}><RiyalAmount amount={plan.total_amount} /></td>
                    <td data-label={t("paidSoFar")}><RiyalAmount amount={plan.paid_total} /></td>
                    <td data-label={t("numberOfInstallments")}>{plan.installment_count}</td>
                    <td data-label={t("frequency")}>{t(`frequency${plan.frequency.charAt(0).toUpperCase()}${plan.frequency.slice(1)}`)}</td>
                    <td data-label={t("status")}>
                      <span className={`fu-tag sm ${plan.status === "completed" ? "ok" : plan.status === "cancelled" ? "faint" : "warn"}`}>
                        {t(`planStatus_${plan.status}`)}
                      </span>
                    </td>
                    <td data-label={t("overdue")}>
                      {overdueCount(plan) > 0 ? (
                        <span className="fu-tag sm danger">{overdueCount(plan)}</span>
                      ) : "—"}
                    </td>
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
