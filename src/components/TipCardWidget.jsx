import { useEffect, useState, useCallback } from "react";
import { Lightbulb, ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "../api";
import { useLang } from "../i18n.jsx";
import { fmtDate } from "../dateUtils.js";

// Always-visible, non-blocking card (unlike the full-screen Announcement
// overlay) that sits in the dashboard's own charts-row grid - renders
// nothing at all when there are no cards targeted to this viewer, so it
// never leaves an empty box behind.
export default function TipCardWidget() {
  const { t, lang } = useLang();
  const [cards, setCards] = useState(null);
  const [index, setIndex] = useState(0);

  const load = useCallback(() => {
    api.tipCards().then(setCards).catch(() => setCards([]));
  }, []);

  useEffect(load, [load]);

  if (!cards || cards.length === 0) return null;

  const safeIndex = Math.min(index, cards.length - 1);
  const card = cards[safeIndex];

  return (
    <div className="chart-card tip-card-widget">
      <div className="tip-card-head">
        <h3 dir="auto"><Lightbulb size={13} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />{t("tipCardsTitle")}</h3>
        {cards.length > 1 && <span className="tip-card-counter">{safeIndex + 1} / {cards.length}</span>}
      </div>
      <div className="tip-card-body">
        {card.image_url && <img className="tip-card-img" src={card.image_url} alt="" />}
        <p className="tip-card-title" dir="auto">{card.title}</p>
        <p className="tip-card-text" dir="auto">{card.body}</p>
        <p className="tip-card-meta">{t("tipCardFrom")}: {card.created_by} · {fmtDate(card.created_at)}</p>
      </div>
      {cards.length > 1 && (
        <div className="tip-card-footer">
          <button className="tip-card-nav-btn" onClick={() => setIndex((i) => (i - 1 + cards.length) % cards.length)}>
            {lang === "ar" ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
          <div className="tip-card-dots">
            {cards.map((_, i) => (
              <span key={i} className={`tip-card-dot ${i === safeIndex ? "active" : ""}`} onClick={() => setIndex(i)} />
            ))}
          </div>
          <button className="tip-card-nav-btn" onClick={() => setIndex((i) => (i + 1) % cards.length)}>
            {lang === "ar" ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
          </button>
        </div>
      )}
    </div>
  );
}
