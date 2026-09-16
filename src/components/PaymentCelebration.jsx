import { useEffect, useState, useRef } from "react";
import { PartyPopper } from "lucide-react";
import { getSession } from "../api";
import { useLang } from "../i18n.jsx";
import { subscribeSignal } from "../callSocket.js";
import RiyalAmount from "./RiyalAmount.jsx";

export default function PaymentCelebration() {
  const { t } = useLang();
  const session = getSession();
  const [queue, setQueue] = useState([]);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!session || session.role !== "admin") return undefined;
    const unsubscribe = subscribeSignal((data) => {
      if (data.type === "payment_celebration") {
        setQueue((q) => [...q, { ...data, id: Date.now() + Math.random() }]);
      }
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.username]);

  useEffect(() => {
    if (queue.length === 0) return undefined;
    timerRef.current = setTimeout(() => {
      setQueue((q) => q.slice(1));
    }, 5000);
    return () => clearTimeout(timerRef.current);
  }, [queue]);

  if (!session || session.role !== "admin" || queue.length === 0) return null;
  const current = queue[0];

  return (
    <div className="payment-celebration-wrap">
      <div key={current.id} className="payment-celebration-card">
        <div className="payment-celebration-icon"><PartyPopper size={22} /></div>
        <div className="payment-celebration-body">
          <div className="payment-celebration-title">{t("paymentCelebrationTitle")}</div>
          <div className="payment-celebration-amount"><RiyalAmount amount={current.amount} /></div>
          <div className="payment-celebration-meta">{current.customer_name} · {current.collector}</div>
        </div>
      </div>
    </div>
  );
}
