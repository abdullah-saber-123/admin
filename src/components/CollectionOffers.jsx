import { useEffect, useState, useCallback, useRef } from "react";
import { Megaphone, Plus, Printer, Check, X as XIcon, MessageCircle, ArrowLeft, Search, ArrowUp, ArrowDown, ArrowUpDown, ClipboardList, Users2 } from "lucide-react";
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

function NominateCustomerPicker({ offerId, nominatedPartnerIds, onNominated }) {
  const { t } = useLang();
  const { showToast } = useToast();
  const [data, setData] = useState(null);
  const [allRows, setAllRows] = useState([]);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [cities, setCities] = useState([]);
  const [cityFilter, setCityFilter] = useState("");
  const [collectors, setCollectors] = useState([]);
  const [collectorFilter, setCollectorFilter] = useState("");
  const [collectorSelectOpen, setCollectorSelectOpen] = useState(false);
  const [collectorSearch, setCollectorSearch] = useState("");
  const [minBalance, setMinBalance] = useState("");
  const [maxBalance, setMaxBalance] = useState("");
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sortBy, setSortBy] = useState("current_due");
  const [sortDir, setSortDir] = useState("desc");
  const [nominating, setNominating] = useState(null);
  const tableWrapRef = useRef(null);
  const scrollLoadLockRef = useRef(false);

  useEffect(() => {
    api.cities().then(setCities).catch(() => {});
    api.collectors().then(setCollectors).catch(() => {});
  }, []);

  const load = useCallback(() => {
    setError(null);
    if (page > 1) setLoadingMore(true);
    api.collectionOfferCustomers(offerId, {
      search, city: cityFilter, collector: collectorFilter,
      min_balance: minBalance !== "" ? minBalance : "", max_balance: maxBalance !== "" ? maxBalance : "",
      page, page_size: 25, sort_by: sortBy, sort_dir: sortDir,
    })
      .then((res) => {
        setData(res);
        setAllRows((prev) => (prev.length === 0 ? res.results : [...prev, ...res.results]));
      })
      .catch((e) => setError(e.message))
      .finally(() => {
        setLoadingMore(false);
        scrollLoadLockRef.current = false;
      });
  }, [offerId, search, cityFilter, collectorFilter, minBalance, maxBalance, page, sortBy, sortDir]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    setPage(1); setAllRows([]); scrollLoadLockRef.current = false;
  }, [search, cityFilter, collectorFilter, minBalance, maxBalance, sortBy, sortDir]);

  useEffect(() => {
    const el = tableWrapRef.current;
    if (!el || !data) return undefined;
    const hasMore = allRows.length < data.total;
    if (!hasMore) return undefined;
    const onScroll = () => {
      if (scrollLoadLockRef.current) return;
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 300) {
        scrollLoadLockRef.current = true;
        setPage((p) => p + 1);
      }
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, [data, allRows.length]);

  const toggleSort = (field) => {
    if (sortBy === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortBy(field); setSortDir("desc"); }
  };
  const sortIcon = (field) => {
    if (sortBy !== field) return <ArrowUpDown size={11} style={{ opacity: 0.4 }} />;
    return sortDir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />;
  };

  const nominate = async (c) => {
    setNominating(c.partner_id);
    try {
      await api.nominateForCollectionOffer(offerId, c.partner_id);
      showToast(t("nominationSubmitted"), "success");
      onNominated();
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setNominating(null);
    }
  };

  return (
    <>
      <div className="more-filters-row" style={{ marginBottom: 14 }}>
        <div className="more-filter-field">
          <div className="input-icon compact">
            <Search size={13} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("searchPlaceholder")} />
          </div>
        </div>
        <div className="more-filter-field">
          <label>{t("cityLabel")}</label>
          <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)}>
            <option value="">{t("allStatus")}</option>
            {cities.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        {collectors.length > 1 && (
          <div className="more-filter-field" style={{ position: "relative" }}>
            <label>{t("collectorField")}</label>
            <button type="button" className="multi-select-trigger" onClick={() => setCollectorSelectOpen((v) => !v)}>
              {collectorFilter ? `${collectorFilter.split(",").filter(Boolean).length} ${t("selected")}` : t("allStatus")}
            </button>
            {collectorSelectOpen && (
              <>
                <div className="columns-menu-backdrop" onClick={() => { setCollectorSelectOpen(false); setCollectorSearch(""); }} />
                <div className="columns-menu">
                  <div className="multiselect-search">
                    <Search size={12} />
                    <input
                      autoFocus
                      value={collectorSearch}
                      onChange={(e) => setCollectorSearch(e.target.value)}
                      placeholder={t("searchPlaceholder")}
                    />
                  </div>
                  <div className="multiselect-scroll">
                    {collectors.filter((c) => c.toLowerCase().includes(collectorSearch.toLowerCase())).map((c) => {
                      const selected = (collectorFilter || "").split(",").filter(Boolean);
                      return (
                        <label key={c} className="multiselect-item">
                          <input
                            type="checkbox"
                            checked={selected.includes(c)}
                            onChange={() => {
                              const next = selected.includes(c) ? selected.filter((x) => x !== c) : [...selected, c];
                              setCollectorFilter(next.join(","));
                            }}
                          />
                          {c}
                        </label>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
        <div className="more-filter-field">
          <label>{t("balanceFrom")}</label>
          <input type="number" min="0" value={minBalance} onChange={(e) => setMinBalance(e.target.value)} />
        </div>
        <div className="more-filter-field">
          <label>{t("balanceTo")}</label>
          <input type="number" min="0" value={maxBalance} onChange={(e) => setMaxBalance(e.target.value)} />
        </div>
      </div>

      {error && <div className="error-state">{error}</div>}
      {!error && !data && <div className="loading-state">{t("loadingDots")}</div>}
      {data && allRows.length === 0 && <div className="empty-state">{t("noActivity")}</div>}

      {data && allRows.length > 0 && (
        <>
          <div className="table-wrap" ref={tableWrapRef}>
            <table className="data-table">
              <thead>
                <tr>
                  <th className="sortable" onClick={() => toggleSort("name")}>{t("customer")} {sortIcon("name")}</th>
                  <th className="sortable" onClick={() => toggleSort("current_due")}>{t("balanceDue")} {sortIcon("current_due")}</th>
                  <th>{t("creditLimitLabel")}</th>
                  <th>{t("collectorField")}</th>
                  <th>{t("paymentTypeLabel")}</th>
                  <th>{t("nominate")}</th>
                </tr>
              </thead>
              <tbody>
                {allRows.map((c) => {
                  const already = nominatedPartnerIds?.includes(c.partner_id);
                  return (
                    <tr key={c.partner_id}>
                      <td data-label={t("customer")}><span className="cust-name">{c.name}</span></td>
                      <td data-label={t("balanceDue")}><RiyalAmount amount={c.current_due} /></td>
                      <td data-label={t("creditLimitLabel")}>{c.credit_limit ? <RiyalAmount amount={c.credit_limit} /> : t("noCreditLimit")}</td>
                      <td data-label={t("collectorField")}>{c.salesperson_name || "—"}</td>
                      <td data-label={t("paymentTypeLabel")}>{c.payment_type || "—"}</td>
                      <td data-label={t("nominate")}>
                        <button className="btn-primary sm" disabled={already || nominating === c.partner_id} onClick={() => nominate(c)}>
                          {already ? t("alreadyNominated") : nominating === c.partner_id ? t("saving") : t("nominate")}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="infinite-scroll-status">
            {loadingMore ? (
              <span className="loading-state" style={{ padding: 0 }}>{t("loadingDots")}</span>
            ) : (
              <span>
                <bdi>{allRows.length}</bdi> / <bdi>{data.total}</bdi>
                {allRows.length < data.total ? ` – ${t("scrollForMore")}` : ""}
              </span>
            )}
          </div>
        </>
      )}
    </>
  );
}

function groupNominationsByCustomer(nominations) {
  const byPartner = new Map();
  for (const n of nominations) {
    if (!byPartner.has(n.partner_id)) {
      byPartner.set(n.partner_id, {
        partner_id: n.partner_id,
        customer_name: n.customer_name,
        customer_phone: n.customer_phone,
        current_due: n.current_due,
        credit_limit: n.credit_limit,
        payment_type: n.payment_type,
        salesperson_name: n.salesperson_name,
        nominators: [],
        nomination_ids: [],
        status: n.status,
        batch: n.batch,
        admin_note: n.admin_note,
        customer_notified: false,
      });
    }
    const g = byPartner.get(n.partner_id);
    g.nominators.push(n.nominated_by);
    g.nomination_ids.push(n.id);
    if (n.customer_notified) g.customer_notified = true;
  }
  return Array.from(byPartner.values());
}

function OfferNominees({ offer, onBack }) {
  const { t } = useLang();
  const { showToast } = useToast();
  const [nominations, setNominations] = useState(null);
  const [batchDrafts, setBatchDrafts] = useState({});
  const [noteDrafts, setNoteDrafts] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [printing, setPrinting] = useState(false);

  const load = useCallback(() => {
    api.listCollectionOfferNominations(offer.id).then(setNominations).catch((e) => showToast(e.message, "error"));
  }, [offer.id]);

  useEffect(() => { load(); }, [load]);

  const groups = nominations ? groupNominationsByCustomer(nominations) : null;

  const decide = async (group, status) => {
    setBusyId(group.partner_id);
    try {
      await Promise.all(group.nomination_ids.map((id) => api.decideCollectionOfferNomination(offer.id, id, {
        status, batch: batchDrafts[group.partner_id] ?? group.batch ?? "", admin_note: noteDrafts[group.partner_id] ?? group.admin_note ?? "",
      })));
      load();
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setBusyId(null);
    }
  };

  const saveRow = async (group) => {
    setBusyId(group.partner_id);
    try {
      await Promise.all(group.nomination_ids.map((id) => api.decideCollectionOfferNomination(offer.id, id, {
        batch: batchDrafts[group.partner_id] ?? group.batch ?? "", admin_note: noteDrafts[group.partner_id] ?? group.admin_note ?? "",
      })));
      showToast(t("saved"), "success");
      load();
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setBusyId(null);
    }
  };

  const openWhatsapp = async (group) => {
    try {
      const { url } = await api.collectionOfferNominationWhatsappLink(offer.id, group.nomination_ids[0]);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      showToast(e.message, "error");
    }
  };

  const toggleNotified = async (group) => {
    setBusyId(group.partner_id);
    try {
      await Promise.all(group.nomination_ids.map((id) => api.decideCollectionOfferNomination(offer.id, id, {
        customer_notified: !group.customer_notified,
      })));
      load();
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setBusyId(null);
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
          <h2>{offer.name} — {t("nominees")}</h2>
          <p className="panel-sub">{offer.event_date || t("noDateSet")}</p>
        </div>
        <button className="btn-secondary sm" onClick={handlePrint} disabled={printing}>
          <Printer size={13} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />{t("print")}
        </button>
      </div>

      {!groups && <div className="loading-state">{t("loadingDots")}</div>}
      {groups && groups.length === 0 && <div className="empty-state">{t("noNomineesYet")}</div>}
      {groups && groups.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("customer")}</th>
                <th>{t("balanceDue")}</th>
                <th>{t("creditLimitLabel")}</th>
                <th>{t("collectorField")}</th>
                <th>{t("paymentTypeLabel")}</th>
                <th>{t("nominatedBy")}</th>
                <th>{t("status")}</th>
                <th>{t("batchLabel")}</th>
                <th>{t("noteLabel")}</th>
                <th>{t("customerNotified")}</th>
                <th>{t("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.partner_id}>
                  <td data-label={t("customer")}>
                    <span className="cust-name">{g.customer_name || g.partner_id}</span>
                    {g.nominators.length > 1 && (
                      <span className="share-status-badge pending" title={g.nominators.join(", ")} style={{ marginInlineStart: 6, cursor: "help" }}>
                        ×{g.nominators.length}
                      </span>
                    )}
                  </td>
                  <td data-label={t("balanceDue")}><RiyalAmount amount={g.current_due || 0} /></td>
                  <td data-label={t("creditLimitLabel")}>{g.credit_limit ? <RiyalAmount amount={g.credit_limit} /> : t("noCreditLimit")}</td>
                  <td data-label={t("collectorField")}>{g.salesperson_name || "—"}</td>
                  <td data-label={t("paymentTypeLabel")}>{g.payment_type || "—"}</td>
                  <td data-label={t("nominatedBy")} title={g.nominators.join(", ")}>{g.nominators.join(", ")}</td>
                  <td data-label={t("status")}><span className={`share-status-badge ${g.status}`}>{statusLabel[g.status] || g.status}</span></td>
                  <td data-label={t("batchLabel")}>
                    <div className="credit-limit-edit" style={{ width: 130 }}>
                      <input
                        value={batchDrafts[g.partner_id] ?? g.batch ?? ""}
                        onChange={(e) => setBatchDrafts((prev) => ({ ...prev, [g.partner_id]: e.target.value }))}
                        placeholder={t("batchPlaceholder")}
                      />
                    </div>
                  </td>
                  <td data-label={t("noteLabel")}>
                    <div className="credit-limit-edit" style={{ width: 150 }}>
                      <input
                        value={noteDrafts[g.partner_id] ?? g.admin_note ?? ""}
                        onChange={(e) => setNoteDrafts((prev) => ({ ...prev, [g.partner_id]: e.target.value }))}
                        placeholder={t("noteLabel")}
                        onBlur={() => saveRow(g)}
                      />
                    </div>
                  </td>
                  <td data-label={t("customerNotified")}>
                    <input
                      type="checkbox"
                      checked={!!g.customer_notified}
                      disabled={busyId === g.partner_id}
                      onChange={() => toggleNotified(g)}
                    />
                  </td>
                  <td data-label={t("actions")}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="icon-btn" title={t("accept")} disabled={busyId === g.partner_id} onClick={() => decide(g, "accepted")}>
                        <Check size={14} />
                      </button>
                      <button className="icon-btn" title={t("reject")} disabled={busyId === g.partner_id} onClick={() => decide(g, "rejected")}>
                        <XIcon size={14} />
                      </button>
                      <button className="icon-btn" title={t("save")} disabled={busyId === g.partner_id} onClick={() => saveRow(g)}>
                        <ClipboardList size={14} />
                      </button>
                      <button className="icon-btn" title={t("sendWhatsapp")} disabled={g.status !== "accepted"} onClick={() => openWhatsapp(g)}>
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

function OfferDetail({ offer, users, username, onBack, onChanged, onViewNominees }) {
  const { t } = useLang();
  const { showToast } = useToast();
  const [myNominations, setMyNominations] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [editingParticipants, setEditingParticipants] = useState(false);
  const [selectedParticipants, setSelectedParticipants] = useState([]);

  const load = useCallback(() => {
    api.getCollectionOffer(offer.id).then((d) => setParticipants(d.participants.map((p) => p.username))).catch(() => {});
    api.listCollectionOfferNominations(offer.id)
      .then((noms) => setMyNominations(noms.filter((n) => n.nominated_by === username)))
      .catch((e) => showToast(e.message, "error"));
  }, [offer.id, username]);

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
          <button className="btn-secondary sm" onClick={onViewNominees}>
            <Users2 size={13} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />{t("nominees")}
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

      <div style={{ marginTop: 20 }}>
        <h3 style={{ fontSize: 14 }}>{t("yourNominations")}</h3>
        {myNominations && myNominations.length > 0 && (
          <ul style={{ margin: "0 0 12px", paddingInlineStart: 18 }}>
            {myNominations.map((n) => (
              <li key={n.id} className="panel-sub">
                <span className="cust-name">{n.customer_name}</span> —{" "}
                <span className={`share-status-badge ${n.status}`}>{statusLabel[n.status] || n.status}</span>
                {n.batch ? ` · ${n.batch}` : ""}
              </li>
            ))}
          </ul>
        )}
        {offer.status === "open" ? (
          <NominateCustomerPicker
            offerId={offer.id}
            nominatedPartnerIds={myNominations?.map((n) => n.partner_id) || []}
            onNominated={load}
          />
        ) : (
          <p className="panel-sub">{t("offerClosed")}</p>
        )}
      </div>
    </div>
  );
}

function AdminOffers({ username }) {
  const { t } = useLang();
  const { showToast } = useToast();
  const [offers, setOffers] = useState(null);
  const [users, setUsers] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState(null);
  const [viewingNominees, setViewingNominees] = useState(false);

  const load = useCallback(() => {
    api.listCollectionOffers().then(setOffers).catch((e) => showToast(e.message, "error"));
  }, []);

  useEffect(() => {
    load();
    api.listUsers().then((list) => setUsers(list.filter((u) => u.active))).catch(() => {});
  }, [load]);

  if (selectedOffer && viewingNominees) {
    return <OfferNominees offer={selectedOffer} onBack={() => setViewingNominees(false)} />;
  }

  if (selectedOffer) {
    return (
      <OfferDetail
        offer={selectedOffer}
        users={users}
        username={username}
        onBack={() => { setSelectedOffer(null); load(); }}
        onChanged={() => { load(); api.getCollectionOffer(selectedOffer.id).then(setSelectedOffer); }}
        onViewNominees={() => setViewingNominees(true)}
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
                <tr key={o.id} className="clickable-row" onClick={() => { setSelectedOffer(o); setViewingNominees(false); }}>
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

function StaffNominate({ offer, nominatedPartnerIds, onNominated, onBack }) {
  const { t } = useLang();
  return (
    <div className="panel">
      <button className="btn-secondary sm" onClick={onBack} style={{ marginBottom: 8 }}>
        <ArrowLeft size={13} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />{t("back")}
      </button>
      <h2><Megaphone size={15} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />{offer.name}</h2>
      <p className="panel-sub">{t("nominateHint")}</p>
      <NominateCustomerPicker offerId={offer.id} nominatedPartnerIds={nominatedPartnerIds} onNominated={onNominated} />
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
    const live = offers?.find((o) => o.id === nominatingOffer.id) || nominatingOffer;
    return (
      <StaffNominate
        offer={live}
        nominatedPartnerIds={live.my_nominations?.map((n) => n.partner_id) || []}
        onBack={() => { setNominatingOffer(null); load(); }}
        onNominated={load}
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
                {o.status === "open" ? (
                  <button className="btn-primary sm" onClick={() => setNominatingOffer(o)}>{t("nominate")}</button>
                ) : (
                  <span className="share-status-badge ended">{t("offerClosed")}</span>
                )}
              </div>
              {o.my_nominations && o.my_nominations.length > 0 && (
                <ul style={{ margin: "10px 0 0", paddingInlineStart: 18 }}>
                  {o.my_nominations.map((n) => (
                    <li key={n.partner_id} className="panel-sub">
                      <span className="cust-name">{n.customer_name || n.partner_id}</span> —{" "}
                      <span className={`share-status-badge ${n.status}`}>{statusLabel[n.status] || n.status}</span>
                      {n.batch ? ` · ${n.batch}` : ""}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CollectionOffers({ role, username }) {
  return (
    <div className="content-stack" style={{ maxWidth: "100%" }}>
      {role === "admin" ? <AdminOffers username={username} /> : <StaffOffers />}
    </div>
  );
}
