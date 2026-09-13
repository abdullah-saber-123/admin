export interface OdooPartner {
  id: number;
  name: string;
  email: string | false;
  phone: string | false;
  mobile: string | false;
  city: string | false;
  category_id: [number, string][] | [];
  credit_limit: number;
  property_payment_term_id: [number, string] | false;
}

export interface OdooInvoice {
  id: number;
  partner_id: [number, string] | false;
  move_type: "out_invoice" | "out_refund" | string;
  invoice_date: string | false;
  invoice_date_due: string | false;
  amount_total: number;
  amount_residual: number;
  payment_state: "not_paid" | "in_payment" | "paid" | "partial" | "reversed" | string;
  state: "draft" | "posted" | "cancel" | string;
  currency_id: [number, string] | false;
}

export interface AgingBuckets {
  current: number;
  d1_30: number;
  d31_60: number;
  d61_90: number;
  d90_plus: number;
}

export type RatingGrade = "A" | "B" | "C" | "D";

export interface Recommendation {
  severity: "critical" | "warning" | "info" | "positive";
  title: string;
  detail: string;
}

export interface CustomerAnalysis {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  creditLimit: number;

  totalSales: number;
  invoiceCount: number;
  totalCollected: number;
  totalOutstanding: number;

  paymentRatePct: number;
  commitmentPct: number;
  overdueInvoiceCount: number;
  avgDelayDays: number;
  dso: number;

  score: number;
  grade: RatingGrade;

  aging: AgingBuckets;

  monthlySales: { month: string; total: number }[];
  monthlyCollections: { month: string; total: number }[];

  recommendations: Recommendation[];
}

export interface LedgerEntry {
  id: number;
  date: string;
  moveName: string;
  label: string;
  ref: string | null;
  debit: number;
  credit: number;
  balance: number;
  reconciled: boolean;
}

export interface PartnerLedger {
  partnerId: number;
  partnerName: string;
  openingBalance: number;
  closingBalance: number;
  entries: LedgerEntry[];
}

export interface DashboardSummary {
  totalCustomers: number;
  totalSales: number;
  totalOutstanding: number;
  totalCollected: number;
  avgPaymentRate: number;
  avgCommitment: number;
  aging: AgingBuckets;
  gradeDistribution: Record<RatingGrade, number>;
  topRiskCustomers: { id: number; name: string; outstanding: number; overdue: number; score: number }[];
  topSalesCustomers: { id: number; name: string; totalSales: number }[];
}
