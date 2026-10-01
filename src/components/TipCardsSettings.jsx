import { useEffect, useState, useCallback } from "react";
import { Lightbulb, Plus, Pencil, Trash2, Eye, EyeOff } from "lucide-react";
import { api } from "../api";
import { useLang } from "../i18n.jsx";
import { useToast } from "../toast.jsx";
import { fmtDate } from "../dateUtils.js";
import TipCardComposeModal from "./TipCardComposeModal.jsx";

export default function TipCardsSettings() {
  const { t } = useLang();
  const { showToast } = useToast();
  const [cards, setCards] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [error, setError] = useState(null);
  const [showCompose, setShowCompose] = useState(false);
  const [editingCard, setEditingCard] = useState(null);

  const load = useCallback(() => {
    setError(null);
    api.adminTipCards().then(setCards).catch((e) => setError(e.message));
  }, []);

  useEffect(load, [load]);
  useEffect(() => {
    // Every active account, admin's own included - unlike staffChatContacts
    // (built for messaging, which never lists yourself), admin needs to be
    // able to target a card at themselves too (e.g. to preview how it looks).
    api.listUsers()
      .then((d) => setContacts(Array.isArray(d) ? d.filter((u) => u.active) : []))
      .catch(() => {});
  }, []);

  const handleToggleActive = async (card) => {
    try {
      await api.updateTipCard(card.id, { active: !card.active });
      load();
    } catch (e) {
      showToast(e.message, "error");
    }
  };

  const handleDelete = async (card) => {
    if (!window.confirm(t("confirmDeleteTipCard"))) return;
    try {
      await api.deleteTipCard(card.id);
      showToast(t("tipCardDeleted"), "success");
      load();
    } catch (e) {
      showToast(e.message, "error");
    }
  };

  return (
    <div className="content-stack" style={{ maxWidth: "100%" }}>
      <div className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
          <div>
            <h2><Lightbulb size={15} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />{t("tipCardsTitle")}</h2>
            <p className="panel-sub">{t("tipCardsSettingsHint")}</p>
          </div>
          <button className="btn-primary sm" onClick={() => { setEditingCard(null); setShowCompose(true); }}>
            <Plus size={13} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />
            {t("newTipCard")}
          </button>
        </div>

        {error && <div className="error-state">{error}</div>}
        {!error && !cards && <div className="loading-state">{t("loadingDots")}</div>}

        {cards && (
          <div className="table-wrap" style={{ marginTop: 14 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t("tipCardTitleCol")}</th>
                  <th>{t("tipCardTargetCol")}</th>
                  <th>{t("tipCardStatusCol")}</th>
                  <th>{t("date")}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {cards.map((c) => (
                  <tr key={c.id}>
                    <td>{c.title}</td>
                    <td>{c.target_usernames.length === 0 ? t("tipCardTargetAll") : `${c.target_usernames.length} ${t("tipCardTargetCount")}`}</td>
                    <td>
                      <button className={`btn-secondary sm ${c.active ? "" : "danger"}`} onClick={() => handleToggleActive(c)}>
                        {c.active ? <Eye size={13} style={{ verticalAlign: -2, marginInlineEnd: 4 }} /> : <EyeOff size={13} style={{ verticalAlign: -2, marginInlineEnd: 4 }} />}
                        {c.active ? t("tipCardActive") : t("tipCardInactive")}
                      </button>
                    </td>
                    <td>{fmtDate(c.created_at)}</td>
                    <td>
                      <button className="btn-secondary sm" onClick={() => { setEditingCard(c); setShowCompose(true); }}>
                        <Pencil size={13} />
                      </button>
                      <button className="btn-secondary sm danger" style={{ marginInlineStart: 6 }} onClick={() => handleDelete(c)}>
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
                {cards.length === 0 && (
                  <tr><td colSpan={5} className="empty-state">{t("noResults")}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCompose && (
        <TipCardComposeModal
          contacts={contacts}
          editingCard={editingCard}
          onClose={() => setShowCompose(false)}
          onSaved={load}
        />
      )}
    </div>
  );
}
