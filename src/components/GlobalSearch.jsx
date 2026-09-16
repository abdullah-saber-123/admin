import { useEffect, useRef, useState } from "react";
import { Search, Users, FileText } from "lucide-react";
import { api } from "../api";
import { useLang } from "../i18n.jsx";

export default function GlobalSearch({ onSelectCustomer, onGoToDashboard }) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
    setQuery("");
    setResults(null);
  }, [open]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults(null);
      return;
    }
    setLoading(true);
    const timer = setTimeout(() => {
      api.globalSearch(query)
        .then(setResults)
        .catch(() => setResults({ customers: [], invoices: [] }))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const selectCustomer = (partnerId) => {
    onGoToDashboard?.();
    onSelectCustomer?.(partnerId);
    setOpen(false);
  };

  const hasResults = results && (results.customers.length > 0 || results.invoices.length > 0);
  const showEmpty = !loading && results && !hasResults;

  return (
    <>
      <button className="global-search-trigger" onClick={() => setOpen(true)}>
        <Search size={14} />
        <span>{t("searchEverywhere")}</span>
        <span className="global-search-kbd">Ctrl K</span>
      </button>

      {open && (
        <div className="overlay modal-overlay global-search-overlay" onClick={() => setOpen(false)}>
          <div className="global-search-modal" onClick={(e) => e.stopPropagation()}>
            <div className="global-search-input-row">
              <Search size={16} />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("searchEverywherePlaceholder")}
                onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
              />
              <kbd>Esc</kbd>
            </div>
            <div className="global-search-results">
              {loading && <div className="loading-state">{t("loadingDots")}</div>}
              {showEmpty && <div className="empty-state">{t("noMatch")}</div>}

              {!loading && results?.customers?.length > 0 && (
                <div className="global-search-group">
                  <div className="global-search-group-label">{t("customer")}</div>
                  {results.customers.map((c) => (
                    <button key={c.partner_id} className="global-search-result" onClick={() => selectCustomer(c.partner_id)}>
                      <Users size={14} />
                      <span className="gsr-title">{c.name}</span>
                      <span className="gsr-sub">{c.phone || ""}</span>
                    </button>
                  ))}
                </div>
              )}

              {!loading && results?.invoices?.length > 0 && (
                <div className="global-search-group">
                  <div className="global-search-group-label">{t("invoiceNumber")}</div>
                  {results.invoices.map((i) => (
                    <button key={i.invoice_id} className="global-search-result" onClick={() => selectCustomer(i.partner_id)}>
                      <FileText size={14} />
                      <span className="gsr-title"><bdi dir="ltr">{i.number}</bdi></span>
                      <span className="gsr-sub">{i.customer_name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
