import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import Link from "next/link";
import { LayoutDashboard, Users } from "lucide-react";
import { HeaderSearch } from "@/components/HeaderSearch";
import "./globals.css";

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
});

export const metadata: Metadata = {
  title: "منصة تحليل العملاء",
  description: "تحليل السداد والالتزام والمبيعات والتحصيل وأعمار الديون لعملاء الآجل",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ar" dir="rtl" className={`${cairo.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[var(--page)] text-[var(--ink)] font-sans">
        <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--surface)]/90 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6">
            <Link href="/" className="flex shrink-0 items-center gap-2 font-bold text-[15px]">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--brand)] text-white text-sm">
                س
              </span>
              <span className="hidden sm:inline">منصة تحليل العملاء</span>
            </Link>
            <div className="flex-1">
              <HeaderSearch />
            </div>
            <nav className="flex shrink-0 items-center gap-1 text-sm">
              <Link
                href="/"
                className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[var(--ink-secondary)] hover:bg-[var(--hover)] hover:text-[var(--ink)]"
              >
                <LayoutDashboard size={16} />
                لوحة التحكم
              </Link>
              <Link
                href="/customers"
                className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[var(--ink-secondary)] hover:bg-[var(--hover)] hover:text-[var(--ink)]"
              >
                <Users size={16} />
                العملاء
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">{children}</main>
      </body>
    </html>
  );
}
