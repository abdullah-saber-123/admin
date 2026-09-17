import { useEffect, useState, useCallback } from "react";
import { Megaphone, Plus, Printer, Check, X as XIcon, MessageCircle, ArrowLeft, Search, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { api } from "../api";
import { useLang } from "../i18n.jsx";
import { useToast } from "../toast.jsx";
import RiyalAmount from "./RiyalAmount.jsx";

function CreateOfferModal({ users, onClose, onCreated }) {
  const { t } = useLang();
  const { showToast } = useToast();
  const [name, setName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [selected, setSelected] = useState([]);
  const [saving, setSaving] = useState(false);

  const toggleUser = (username) => {
    setSelected((prev) => (prev.includes(username) ? prev.filter((u) => u !== username) : [...prev, username]));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await api.createCollectionOffer({
        name: name.trim(),
        event_date: eventDate || null,
        participant_usernames: selected,
      });
      showToast(t("collectionOfferCreated"), "success");
      onCreated();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="overlay modal-overlay" onClick={onClose}>
      <div className="prompt-modal" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}><XIcon size={18} /></button>
        <h3>{t("newCollectionOffer")}</h3>
        <form onSubmit={handleSubmit}>
          <label>{t("offerName")}</label>
          <input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder={t("offerName")} />

          <label style={{ marginTop: 10 }}>{t("offerEventDate")}</label>
          <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />

          <label style={{ marginTop: 10 }}>{t("offerParticipants")}</label>
          <div className="multiselect-list">
            {users.length === 0 && <p className="prompt-message">—</p>}
            {users.map((u) => (
              <label key={u.username} className="multiselect-item">
                <input type="checkbox" checked={selected.includes(u.username)} onChange={() => toggleUser(u.username)} />
                {u.full_name || u.username}
              </label>
            ))}
          </div>

          <div className="prompt-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>{t("cancel")}</button>
            <button type="submit" className="btn-primary" disabled={saving || !name.trim()}>
              {saving ? t("saving") : t("create")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function OfferDetail({ offer, users, onBack, onChanged }) {
  const { t } = useLang();
  const { showToast } = useToast();
  const [nominations, setNominations] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [editingParticipants, setEditingParticipants] = useState(false);
  const [selectedParticipants, setSelectedParticipants] = useState([]);
  const [batchDrafts, setBatchDrafts] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [printing, setPrinting] = useState(false);

  const load = useCallback(() => {
    api.getCollectionOffer(offer.id).then((d) => setParticipants(d.participants.map((p) => p.username))).catch(() => {});
    api.listCollectionOfferNominations(offer.id).then(setNominations).catch((e) => showToast(e.message, "error"));
  }, [offer.id]);

  useEffect(() => { load(); }, [load]);

  const toggleStatus = async () => {
    try {
      await api.updateCollectionOffer(offer.id, { status: offer.status === "open" ? "closed" : "open" });
      onChanged();
    } catch (e) {
      showToast(e.message, "error");
    }
  };

  const saveParticipants = async () => {
    try {
      await api.setCollectionOfferParticipants(offer.id, selectedParticipants);
      setParticipants(selectedParticipants);
      setEditingParticipants(false);
      showToast(t("saved"), "success");
    } catch (e) {
      showToast(e.message, "error");
    }
  };

  const decide = async (nom, status) => {
    setBusyId(nom.id);
    try {
      await api.decideCollectionOfferNomination(offer.id, nom.id, { status, batch: batchDrafts[nom.id] ?? nom.batch ?? "" });
      load();
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setBusyId(null);
    }
  };

  const openWhatsapp = async (nom) => {
    try {
      const { url } = await api.collectionOfferNominationWhatsappLink(offer.id, nom.id);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      showToast(e.message, "error");
    }
  };

  const handlePrint = async () => {
    setPrinting(true);
    try {
      await api.printCollectionOfferNominations(offer.id);
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setPrinting(false);
    }
  };

  const statusLabel = { pending: t("nominationPending"), accepted: t("nominationAccepted"), rejected: t("nominationRejected") };

  return (
    <div className="panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
        <div>
          <button className="btn-secondary sm" onClick={onBack} style={{ marginBottom: 8 }}>
            <ArrowLeft size={13} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />{t("back")}
          </button>
          <h2>{offer.name}</h2>
          <p className="panel-sub">
            {offer.event_date || t("noDateSet")} · <span className={`share-status-badge ${offer.status === "open" ? "accepted" : "ended"}`}>{offer.status === "open" ? t("offerOpen") : t("offerClosed")}</span>
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn-secondary sm" onClick={handlePrint} disabled={printing}>
            <Printer size={13} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />{t("print")}
          </button>
          <button className="btn-secondary sm" onClick={toggleStatus}>
            {offer.status === "open" ? t("closeOffer") : t("reopenOffer")}
          </button>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0, fontSize: 14 }}>{t("offerParticipants")} ({participants.length})</h3>
          {!editingParticipants && (
            <button className="btn-secondary sm" onClick={() => { setSelectedParticipants(participants); setEditingParticipants(true); }}>
              {t("edit")}
            </button>
          )}
        </div>
        {editingParticipants ? (
          <>
            <div className="multiselect-list" style={{ marginTop: 8 }}>
              {users.map((u) => (
                <label key={u.username} className="multiselect-item">
                  <input
                    type="checkbox"
                    checked={selectedParticipants.includes(u.username)}
                    onChange={() => setSelectedParticipants((prev) => prev.includes(u.username) ? prev.filter((x) => x !== u.username) : [...prev, u.username])}
                  />
                  {u.full_name || u.username}
                </label>
              ))}
            </div>
            <div className="prompt-actions" style={{ justifyContent: "flex-start", marginTop: 8 }}>
              <button className="btn-secondary sm" onClick={() => setEditingParticipants(false)}>{t("cancel")}</button>
              <button className="btn-primary sm" onClick={saveParticipants}>{t("save")}</button>
            </div>
          </>
        ) : (
          <p className="panel-sub">{participants.length ? participants.join(", ") : t("noParticipantsYet")}</p>
        )}
      </div>

      <h3 style={{ marginTop: 20, fontSize: 14 }}>{t("nominees")}</h3>
      {!nominations && <div className="loading-state">{t("loadingDots")}</div>}
      {nominations && nominations.length === 0 && <div className="empty-state">{t("noNomineesYet")}</div>}
      {nominations && nominations.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("customer")}</th>
                <th>{t("balanceDue")}</th>
                <th>{t("creditLimitLabel")}</th>
                <th>{t("nominatedBy")}</th>
                <th>{t("status")}</th>
                <th>{t("batchLabel")}</th>
                <th>{t("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {nominations.map((n) => (
                <tr key={n.id}>
                  <td data-label={t("customer")}><span className="cust-name">{n.customer_name || n.partner_id}</span></td>
                  <td data-label={t("balanceDue")}><RiyalAmount amount={n.current_due || 0} /></td>
                  <td data-label={t("creditLimitLabel")}>{n.credit_limit ? <RiyalAmount amount={n.credit_limit} /> : t("noCreditLimit")}</td>
                  <td data-label={t("nominatedBy")}>{n.nominated_by}</td>
                  <td data-label={t("status")}><span className={`share-status-badge ${n.status}`}>{statusLabel[n.status] || n.status}</span></td>
                  <td data-label={t("batchLabel")}>
                    <div className="credit-limit-edit" style={{ width: 130 }}>
                      <input
                        value={batchDrafts[n.id] ?? n.batch ?? ""}
                        onChange={(e) => setBatchDrafts((prev) => ({ ...prev, [n.id]: e.target.value }))}
                        placeholder={t("batchPlaceholder")}
                      />
                    </div>
                  </td>
                  <td data-label={t("actions")}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="icon-btn" title={t("accept")} disabled={busyId === n.id} onClick={() => decide(n, "accepted")}>
                        <Check size={14} />
                      </button>
                      <button className="icon-btn" title={t("reject")} disabled={busyId === n.id} onClick={() => decide(n, "rejected")}>
                        <XIcon size={14} />
                      </button>
                      <button className="icon-btn" title={t("sendWhatsapp")} disabled={n.status !== "accepted"} onClick={() => openWhatsapp(n)}>
                        <MessageCircle size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AdminOffers() {
  const { t } = useLang();
  const { showToast } = useToast();
  const [offers, setOffers] = useState(null);
  const [users, setUsers] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState(null);

  const load = useCallback(() => {
    api.listCollectionOffers().then(setOffers).catch((e) => showToast(e.message, "error"));
  }, []);

  useEffect(() => {
    load();
    api.listUsers().then((list) => setUsers(list.filter((u) => u.active))).catch(() => {});
  }, [load]);

  if (selectedOffer) {
    return (
      <OfferDetail
        offer={selectedOffer}
        users={users}
        onBack={() => { setSelectedOffer(null); load(); }}
        onChanged={() => { load(); api.getCollectionOffer(selectedOffer.id).then(setSelectedOffer); }}
      />
    );
  }

  return (
    <div className="panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2><Megaphone size={15} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />{t("collectionOfferTitle")}</h2>
          <p className="panel-sub">{t("collectionOfferHint")}</p>
        </div>
        <button className="btn-primary sm" onClick={() => setShowCreate(true)}>
          <Plus size={13} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />{t("newCollectionOffer")}
        </button>
      </div>

      {!offers && <div className="loading-state">{t("loadingDots")}</div>}
      {offers && offers.length === 0 && <div className="empty-state">{t("noOffersYet")}</div>}
      {offers && offers.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("offerName")}</th>
                <th>{t("offerEventDate")}</th>
                <th>{t("status")}</th>
                <th>{t("offerParticipants")}</th>
                <th>{t("nominees")}</th>
              </tr>
            </thead>
            <tbody>
              {offers.map((o) => (
                <tr key={o.id} className="clickable-row" onClick={() => setSelectedOffer(o)}>
                  <td data-label={t("offerName")}><span className="cust-name">{o.name}</span></td>
                  <td data-label={t("offerEventDate")}>{o.event_date || t("noDateSet")}</td>
                  <td data-label={t("status")}><span className={`share-status-badge ${o.status === "open" ? "accepted" : "ended"}`}>{o.status === "open" ? t("offerOpen") : t("offerClosed")}</span></td>
                  <td data-label={t("offerParticipants")}>{o.participants_count}</td>
                  <td data-label={t("nominees")}>
                    {o.nominations_count} ({o.pending_count} {t("nominationPending")})
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <CreateOfferModal
          users={users}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load(); }}
        />
      )}
    </div>
  );
}

function StaffNominate({ offer, onNominated, onBack }) {
  const { t } = useLang();
  const { showToast } = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("current_due");
  const [sortDir, setSortDir] = useState("desc");
  const [nominating, setNominating] = useState(null);

  const load = useCallback(() => {
    api.customers({ search, page, page_size: 25, sort_by: sortBy, sort_dir: sortDir })
      .then(setData).catch((e) => setError(e.message));
  }, [search, page, sortBy, sortDir]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => { setPage(1); }, [search]);

  const toggleSort = (field) => {
    if (sortBy === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortBy(field); setSortDir("desc"); }
  };
  const sortIcon = (field) => {
    if (sortBy !== field) return <ArrowUpDown size={11} style={{ opacity: 0.4 }} />;
    return sortDir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />;
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / (data.page_size || 25))) : 1;

  const nominate = async (c) => {
    setNominating(c.partner_id);
    try {
      await api.nominateForCollectionOffer(offer.id, c.partner_id);
      showToast(t("nominationSubmitted"), "success");
      onNominated();
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setNominating(null);
    }
  };

  return (
    <div className="panel">
      <button className="btn-secondary sm" onClick={onBack} style={{ marginBottom: 8 }}>
        <ArrowLeft size={13} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />{t("back")}
      </button>
      <h2><Megaphone size={15} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />{offer.name}</h2>
      <p className="panel-sub">{t("nominateHint")}</p>

      <div className="more-filters-row" style={{ marginBottom: 14 }}>
        <div className="more-filter-field">
          <div className="input-icon compact">
            <Search size={13} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("searchPlaceholder")} />
          </div>
        </div>
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
                  <th className="sortable" onClick={() => toggleSort("current_due")}>{t("balanceDue")} {sortIcon("current_due")}</th>
                  <th>{t("creditLimitLabel")}</th>
                  <th>{t("nominate")}</th>
                </tr>
              </thead>
              <tbody>
                {data.results.map((c) => (
                  <tr key={c.partner_id}>
                    <td data-label={t("customer")}><span className="cust-name">{c.name}</span></td>
                    <td data-label={t("balanceDue")}><RiyalAmount amount={c.current_due} /></td>
                    <td data-label={t("creditLimitLabel")}>{c.credit_limit ? <RiyalAmount amount={c.credit_limit} /> : t("noCreditLimit")}</td>
                    <td data-label={t("nominate")}>
                      <button className="btn-primary sm" disabled={nominating === c.partner_id} onClick={() => nominate(c)}>
                        {nominating === c.partner_id ? t("saving") : t("nominate")}
                      </button>
                    </td>
                  </tr>
                ))}
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
  );
}

function StaffOffers() {
  const { t } = useLang();
  const { showToast } = useToast();
  const [offers, setOffers] = useState(null);
  const [nominatingOffer, setNominatingOffer] = useState(null);

  const load = useCallback(() => {
    api.myCollectionOffers().then(setOffers).catch((e) => showToast(e.message, "error"));
  }, []);

  useEffect(() => { load(); }, [load]);

  if (nominatingOffer) {
    return (
      <StaffNominate
        offer={nominatingOffer}
        onBack={() => { setNominatingOffer(null); load(); }}
        onNominated={() => { setNominatingOffer(null); load(); }}
      />
    );
  }

  const statusLabel = { pending: t("nominationPending"), accepted: t("nominationAccepted"), rejected: t("nominationRejected") };

  return (
    <div className="panel">
      <h2><Megaphone size={15} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />{t("collectionOfferTitle")}</h2>
      <p className="panel-sub">{t("collectionOfferStaffHint")}</p>

      {!offers && <div className="loading-state">{t("loadingDots")}</div>}
      {offers && offers.length === 0 && <div className="empty-state">{t("noActiveOffersForYou")}</div>}

      {offers && offers.length > 0 && (
        <div className="content-stack">
          {offers.map((o) => (
            <div key={o.id} className="panel" style={{ padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <div>
                  <strong>{o.name}</strong>
                  <p className="panel-sub" style={{ margin: 0 }}>{o.event_date || t("noDateSet")}</p>
                </div>
                {o.my_nomination ? (
                  <span className={`share-status-badge ${o.my_nomination.status}`}>
                    {t("alreadyNominated")} — {statusLabel[o.my_nomination.status]}
                    {o.my_nomination.batch ? ` · ${o.my_nomination.batch}` : ""}
                  </span>
                ) : o.status === "open" ? (
                  <button className="btn-primary sm" onClick={() => setNominatingOffer(o)}>{t("nominate")}</button>
                ) : (
                  <span className="share-status-badge ended">{t("offerClosed")}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CollectionOffers({ role }) {
  return (
    <div className="content-stack" style={{ maxWidth: "100%" }}>
      {role === "admin" ? <AdminOffers /> : <StaffOffers />}
    </div>
  );
}
