const ODOO_BASE_URL = process.env.ODOO_BASE_URL ?? "";
const ODOO_DB = process.env.ODOO_DB ?? "";
const ODOO_USERNAME = process.env.ODOO_USERNAME ?? "";
const ODOO_API_KEY = process.env.ODOO_API_KEY ?? "";

interface JsonRpcResponse<T> {
  jsonrpc: "2.0";
  id: number;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: { name?: string; debug?: string; message?: string };
  };
}

let cachedUid: number | null = null;
let cachedUidAt = 0;
const UID_TTL_MS = 30 * 60 * 1000;

async function jsonRpcCall<T>(service: string, method: string, args: unknown[]): Promise<T> {
  const res = await fetch(`${ODOO_BASE_URL}/jsonrpc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "call",
      params: { service, method, args },
      id: Math.floor(Math.random() * 1_000_000_000),
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Odoo HTTP error ${res.status}: ${await res.text()}`);
  }

  const json = (await res.json()) as JsonRpcResponse<T>;
  if (json.error) {
    const detail = json.error.data?.message ?? json.error.message;
    throw new Error(`Odoo RPC error: ${detail}`);
  }
  return json.result as T;
}

async function getUid(): Promise<number> {
  if (cachedUid && Date.now() - cachedUidAt < UID_TTL_MS) {
    return cachedUid;
  }
  const uid = await jsonRpcCall<number | false>("common", "authenticate", [
    ODOO_DB,
    ODOO_USERNAME,
    ODOO_API_KEY,
    {},
  ]);
  if (!uid) {
    throw new Error("فشل تسجيل الدخول إلى أودو: تحقق من بيانات الاتصال (DB / Username / API Key)");
  }
  cachedUid = uid;
  cachedUidAt = Date.now();
  return uid;
}

export interface SearchReadOptions {
  offset?: number;
  limit?: number;
  order?: string;
  context?: Record<string, unknown>;
}

export async function odooSearchRead<T = Record<string, unknown>>(
  model: string,
  domain: unknown[],
  fields: string[],
  options: SearchReadOptions = {}
): Promise<T[]> {
  const uid = await getUid();
  const kwargs: Record<string, unknown> = { fields };
  if (options.offset !== undefined) kwargs.offset = options.offset;
  if (options.limit !== undefined) kwargs.limit = options.limit;
  if (options.order !== undefined) kwargs.order = options.order;
  if (options.context !== undefined) kwargs.context = options.context;

  return jsonRpcCall<T[]>("object", "execute_kw", [
    ODOO_DB,
    uid,
    ODOO_API_KEY,
    model,
    "search_read",
    [domain],
    kwargs,
  ]);
}

const PAGE_SIZE = 2000;

export async function odooSearchReadAll<T = Record<string, unknown>>(
  model: string,
  domain: unknown[],
  fields: string[],
  options: Pick<SearchReadOptions, "order" | "context"> = {}
): Promise<T[]> {
  const all: T[] = [];
  let offset = 0;
  for (;;) {
    const page = await odooSearchRead<T>(model, domain, fields, { ...options, offset, limit: PAGE_SIZE });
    all.push(...page);
    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return all;
}

export async function odooReadGroup<T = Record<string, unknown>>(
  model: string,
  domain: unknown[],
  fields: string[],
  groupBy: string[],
  options: { limit?: number; orderby?: string } = {}
): Promise<T[]> {
  const uid = await getUid();
  return jsonRpcCall<T[]>("object", "execute_kw", [
    ODOO_DB,
    uid,
    ODOO_API_KEY,
    model,
    "read_group",
    [domain, fields, groupBy],
    options,
  ]);
}

export function isOdooConfigured(): boolean {
  return Boolean(ODOO_BASE_URL && ODOO_DB && ODOO_USERNAME && ODOO_API_KEY);
}
