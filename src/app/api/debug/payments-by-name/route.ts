import { NextResponse } from "next/server";
import { diagnosePayments } from "@/lib/debug-payments";
import { odooSearchReadAll } from "@/lib/odoo";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name");
  if (!name) {
    return NextResponse.json({ error: "أضف ?name=اسم_العميل في نهاية الرابط" }, { status: 400 });
  }

  try {
    const matches = await odooSearchReadAll<{ id: number; name: string }>(
      "res.partner",
      [["name", "ilike", name]],
      ["id", "name"],
      { order: "name asc" }
    );

    if (matches.length === 0) {
      return NextResponse.json({ error: `لا يوجد عميل باسم يحتوي "${name}"` }, { status: 404 });
    }

    const top = matches.slice(0, 5);
    const results = await Promise.all(top.map((m) => diagnosePayments(m.id, m.name)));

    return NextResponse.json({
      searchedName: name,
      totalMatches: matches.length,
      allMatches: matches,
      diagnostics: results,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}
