import { odooSearchReadAll } from "./odoo";
import { fetchReceivableLines, type ReceivableLine } from "./receivables";
import type {
  AgingBuckets,
  CustomerAnalysis,
  DashboardSummary,
  OdooInvoice,
  OdooPartner,
  RatingGrade,
  Recommendation,
} from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

function daysBetween(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / DAY_MS);
}

function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7);
}

function emptyAging(): AgingBuckets {
  return { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0 };
}

async function fetchPartners(): Promise<OdooPartner[]> {
  return odooSearchReadAll<OdooPartner>(
    "res.partner",
    [["customer_rank", ">", 0]],
    ["id", "name", "email", "phone", "mobile", "city", "category_id", "credit_limit", "property_payment_term_id"],
    { order: "name asc" }
  );
}

async function fetchInvoices(partnerIds?: number[]): Promise<OdooInvoice[]> {
  const domain: unknown[] = [
    ["move_type", "in", ["out_invoice", "out_refund"]],
    ["state", "=", "posted"],
  ];
  if (partnerIds?.length) domain.push(["partner_id", "in", partnerIds]);

  return odooSearchReadAll<OdooInvoice>(
    "account.move",
    domain,
    ["id", "partner_id", "move_type", "invoice_date", "invoice_date_due", "amount_total", "amount_residual", "payment_state", "state", "currency_id"],
    { order: "invoice_date desc" }
  );
}

async function fetchCustomerPayments(partnerIds?: number[]): Promise<{ id: number; partner_id: [number, string] | false; amount: number; date: string }[]> {
  const domain: unknown[] = [
    ["payment_type", "=", "inbound"],
    ["partner_type", "=", "customer"],
    ["state", "=", "posted"],
  ];
  if (partnerIds?.length) domain.push(["partner_id", "in", partnerIds]);

  return odooSearchReadAll(
    "account.payment",
    domain,
    ["id", "partner_id", "amount", "date"],
    { order: "date desc" }
  );
}

function gradeFromScore(score: number): RatingGrade {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 50) return "C";
  return "D";
}

function buildRecommendations(input: {
  totalOutstanding: number;
  creditLimit: number;
  aging: AgingBuckets;
  commitmentPct: number;
  paymentRatePct: number;
  avgDelayDays: number;
  lastInvoiceDaysAgo: number | null;
}): Recommendation[] {
  const recs: Recommendation[] = [];
  const { totalOutstanding, creditLimit, aging, commitmentPct, paymentRatePct, avgDelayDays, lastInvoiceDaysAgo } = input;

  const severeOverdue = aging.d61_90 + aging.d90_plus;
  const severeRatio = totalOutstanding > 0 ? severeOverdue / totalOutstanding : 0;

  if (aging.d90_plus > 0 && severeRatio > 0.2) {
    recs.push({
      severity: "critical",
      title: "مديونية متعثرة تجاوزت 90 يوماً",
      detail: `يوجد رصيد متأخر بقيمة ${aging.d90_plus.toLocaleString("ar-SA", { maximumFractionDigits: 0 })} لأكثر من 90 يوماً. يُنصح بإيقاف منح آجل إضافي والبدء بإجراءات تحصيل رسمية.`,
    });
  }

  if (creditLimit > 0 && totalOutstanding > creditLimit) {
    recs.push({
      severity: "critical",
      title: "تجاوز حد الائتمان المسموح",
      detail: `الرصيد المستحق (${totalOutstanding.toLocaleString("ar-SA", { maximumFractionDigits: 0 })}) تجاوز حد الائتمان المحدد (${creditLimit.toLocaleString("ar-SA", { maximumFractionDigits: 0 })}). يجب مراجعة الحد أو تجميد الآجل الإضافي.`,
    });
  }

  if (commitmentPct < 60) {
    recs.push({
      severity: "warning",
      title: "ضعف الالتزام بمواعيد السداد",
      detail: `نسبة الالتزام بالسداد في مواعيدها ${commitmentPct.toFixed(0)}% فقط. يُنصح بمراجعة شروط الائتمان أو طلب دفعات مقدمة على الطلبيات القادمة.`,
    });
  } else if (commitmentPct >= 60 && commitmentPct < 80) {
    recs.push({
      severity: "info",
      title: "التزام متوسط بالسداد",
      detail: `نسبة الالتزام ${commitmentPct.toFixed(0)}%. تابع العميل بشكل دوري لتحسين الانضباط في السداد.`,
    });
  }

  if (avgDelayDays > 30) {
    recs.push({
      severity: "warning",
      title: "متوسط تأخير مرتفع",
      detail: `متوسط تأخر السداد عن الفواتير المتأخرة حالياً ${avgDelayDays.toFixed(0)} يوماً. يُفضل التواصل المباشر لتحديد خطة سداد.`,
    });
  }

  if (lastInvoiceDaysAgo !== null && lastInvoiceDaysAgo > 90 && totalOutstanding > 0) {
    recs.push({
      severity: "info",
      title: "انقطاع نشاط الشراء مع وجود رصيد مستحق",
      detail: `لم تُسجَّل مبيعات جديدة لهذا العميل منذ ${lastInvoiceDaysAgo} يوماً رغم وجود رصيد مستحق. يُنصح بمتابعة التحصيل قبل استئناف التعامل.`,
    });
  }

  if (paymentRatePct >= 90 && commitmentPct >= 85) {
    recs.push({
      severity: "positive",
      title: "عميل ملتزم وموثوق",
      detail: "أداء السداد ممتاز والالتزام مرتفع. يمكن دراسة زيادة سقف الائتمان أو تحسين شروط التعامل التجارية.",
    });
  }

  if (recs.length === 0) {
    recs.push({
      severity: "info",
      title: "وضع ائتماني مستقر",
      detail: "لا توجد مؤشرات خطر واضحة حالياً. استمر بالمتابعة الدورية المعتادة.",
    });
  }

  return recs;
}

const RECONCILED_EPSILON = 0.01;

function analyzeCustomer(
  partner: OdooPartner,
  invoices: OdooInvoice[],
  payments: { amount: number; date: string }[],
  receivableLines: ReceivableLine[]
): CustomerAnalysis {
  const today = new Date();
  const aging = emptyAging();

  let totalSales = 0;
  const monthlySalesMap = new Map<string, number>();
  let lastInvoiceDate: Date | null = null;

  for (const inv of invoices) {
    const sign = inv.move_type === "out_refund" ? -1 : 1;
    totalSales += sign * inv.amount_total;

    if (inv.invoice_date) {
      const d = new Date(inv.invoice_date);
      if (!lastInvoiceDate || d > lastInvoiceDate) lastInvoiceDate = d;
      const key = monthKey(inv.invoice_date);
      monthlySalesMap.set(key, (monthlySalesMap.get(key) ?? 0) + sign * inv.amount_total);
    }
  }

  const monthlyCollectionsMap = new Map<string, number>();
  let totalCollected = 0;
  for (const p of payments) {
    totalCollected += p.amount;
    const key = monthKey(p.date);
    monthlyCollectionsMap.set(key, (monthlyCollectionsMap.get(key) ?? 0) + p.amount);
  }

  // Outstanding balance, aging, and commitment come from the customer's
  // receivable-account journal items (matching Odoo's own Partner Ledger /
  // Aged Receivable reports), not from invoice header fields - this covers
  // manual journal entries, write-offs, and partial reconciliations that
  // invoices alone would miss.
  let totalOutstanding = 0;
  let dueCount = 0;
  let onTimeCount = 0;
  let overdueCount = 0;
  let overdueDelaySum = 0;

  for (const line of receivableLines) {
    totalOutstanding += line.amountResidual;
    const isCharge = line.debit > line.credit;
    const isOpen = Math.abs(line.amountResidual) > RECONCILED_EPSILON;
    const dueDate = new Date(line.dateMaturity ?? line.date);

    if (isCharge && dueDate <= today) {
      dueCount += 1;
      if (isOpen) {
        overdueCount += 1;
        overdueDelaySum += daysBetween(today, dueDate);
      } else {
        onTimeCount += 1;
      }
    }

    if (isOpen) {
      const delay = daysBetween(today, dueDate);
      if (delay <= 0) aging.current += line.amountResidual;
      else if (delay <= 30) aging.d1_30 += line.amountResidual;
      else if (delay <= 60) aging.d31_60 += line.amountResidual;
      else if (delay <= 90) aging.d61_90 += line.amountResidual;
      else aging.d90_plus += line.amountResidual;
    }
  }

  const paymentRatePct =
    totalSales > 0 ? Math.max(0, Math.min(100, ((totalSales - totalOutstanding) / totalSales) * 100)) : 100;
  const commitmentPct = dueCount > 0 ? (onTimeCount / dueCount) * 100 : 100;
  const avgDelayDays = overdueCount > 0 ? overdueDelaySum / overdueCount : 0;
  const dso = totalSales > 0 ? (totalOutstanding / totalSales) * 365 : 0;

  const severeOverdue = aging.d61_90 + aging.d90_plus;
  const overdueSeverity = totalOutstanding > 0 ? Math.min(100, (severeOverdue / totalOutstanding) * 100) : 0;

  const score = Math.max(
    0,
    Math.min(100, 0.4 * paymentRatePct + 0.3 * commitmentPct + 0.3 * (100 - overdueSeverity))
  );

  const lastInvoiceDaysAgo = lastInvoiceDate ? daysBetween(today, lastInvoiceDate) : null;

  const sortedMonths = (map: Map<string, number>) =>
    Array.from(map.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .slice(-12)
      .map(([month, total]) => ({ month, total }));

  return {
    id: partner.id,
    name: partner.name,
    email: partner.email || null,
    phone: partner.phone || partner.mobile || null,
    city: partner.city || null,
    creditLimit: partner.credit_limit ?? 0,

    totalSales,
    invoiceCount: invoices.length,
    totalCollected,
    totalOutstanding,

    paymentRatePct,
    commitmentPct,
    overdueInvoiceCount: overdueCount,
    avgDelayDays,
    dso,

    score,
    grade: gradeFromScore(score),

    aging,

    monthlySales: sortedMonths(monthlySalesMap),
    monthlyCollections: sortedMonths(monthlyCollectionsMap),

    recommendations: buildRecommendations({
      totalOutstanding,
      creditLimit: partner.credit_limit ?? 0,
      aging,
      commitmentPct,
      paymentRatePct,
      avgDelayDays,
      lastInvoiceDaysAgo,
    }),
  };
}

export async function getAllCustomerAnalyses(): Promise<CustomerAnalysis[]> {
  const partners = await fetchPartners();
  const partnerIds = partners.map((p) => p.id);
  const [invoices, payments, receivableLines] = await Promise.all([
    fetchInvoices(partnerIds),
    fetchCustomerPayments(partnerIds),
    fetchReceivableLines(partnerIds),
  ]);

  const invoicesByPartner = new Map<number, OdooInvoice[]>();
  for (const inv of invoices) {
    if (!inv.partner_id) continue;
    const pid = inv.partner_id[0];
    if (!invoicesByPartner.has(pid)) invoicesByPartner.set(pid, []);
    invoicesByPartner.get(pid)!.push(inv);
  }

  const paymentsByPartner = new Map<number, { amount: number; date: string }[]>();
  for (const p of payments) {
    if (!p.partner_id) continue;
    const pid = p.partner_id[0];
    if (!paymentsByPartner.has(pid)) paymentsByPartner.set(pid, []);
    paymentsByPartner.get(pid)!.push({ amount: p.amount, date: p.date });
  }

  const linesByPartner = new Map<number, ReceivableLine[]>();
  for (const line of receivableLines) {
    if (!linesByPartner.has(line.partnerId)) linesByPartner.set(line.partnerId, []);
    linesByPartner.get(line.partnerId)!.push(line);
  }

  return partners
    .map((partner) =>
      analyzeCustomer(
        partner,
        invoicesByPartner.get(partner.id) ?? [],
        paymentsByPartner.get(partner.id) ?? [],
        linesByPartner.get(partner.id) ?? []
      )
    )
    .filter((c) => c.invoiceCount > 0 || c.totalOutstanding !== 0);
}

export async function getCustomerAnalysis(partnerId: number): Promise<CustomerAnalysis | null> {
  const partners = await odooSearchReadAll<OdooPartner>(
    "res.partner",
    [["id", "=", partnerId]],
    ["id", "name", "email", "phone", "mobile", "city", "category_id", "credit_limit", "property_payment_term_id"]
  );
  const partner = partners[0];
  if (!partner) return null;

  const [invoices, payments, receivableLines] = await Promise.all([
    fetchInvoices([partnerId]),
    fetchCustomerPayments([partnerId]),
    fetchReceivableLines([partnerId]),
  ]);

  return analyzeCustomer(
    partner,
    invoices,
    payments.map((p) => ({ amount: p.amount, date: p.date })),
    receivableLines
  );
}

export function buildDashboardSummary(customers: CustomerAnalysis[]): DashboardSummary {
  const aging = emptyAging();
  const gradeDistribution: Record<RatingGrade, number> = { A: 0, B: 0, C: 0, D: 0 };

  let totalSales = 0;
  let totalOutstanding = 0;
  let totalCollected = 0;
  let paymentRateSum = 0;
  let commitmentSum = 0;

  for (const c of customers) {
    totalSales += c.totalSales;
    totalOutstanding += c.totalOutstanding;
    totalCollected += c.totalCollected;
    paymentRateSum += c.paymentRatePct;
    commitmentSum += c.commitmentPct;
    gradeDistribution[c.grade] += 1;

    aging.current += c.aging.current;
    aging.d1_30 += c.aging.d1_30;
    aging.d31_60 += c.aging.d31_60;
    aging.d61_90 += c.aging.d61_90;
    aging.d90_plus += c.aging.d90_plus;
  }

  const n = customers.length || 1;

  const topRiskCustomers = [...customers]
    .filter((c) => c.totalOutstanding > 0)
    .sort((a, b) => b.aging.d61_90 + b.aging.d90_plus - (a.aging.d61_90 + a.aging.d90_plus))
    .slice(0, 10)
    .map((c) => ({
      id: c.id,
      name: c.name,
      outstanding: c.totalOutstanding,
      overdue: c.aging.d61_90 + c.aging.d90_plus,
      score: c.score,
    }));

  const topSalesCustomers = [...customers]
    .sort((a, b) => b.totalSales - a.totalSales)
    .slice(0, 10)
    .map((c) => ({ id: c.id, name: c.name, totalSales: c.totalSales }));

  return {
    totalCustomers: customers.length,
    totalSales,
    totalOutstanding,
    totalCollected,
    avgPaymentRate: paymentRateSum / n,
    avgCommitment: commitmentSum / n,
    aging,
    gradeDistribution,
    topRiskCustomers,
    topSalesCustomers,
  };
}
