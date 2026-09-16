import { useCallback, useEffect, useState } from "react";
import { api } from "../api";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

const isSupported = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;

export default function usePushNotifications() {
  const [permission, setPermission] = useState(isSupported ? Notification.permission : "unsupported");
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isSupported) return;
    navigator.serviceWorker.register("/sw.js").then((reg) =>
      reg.pushManager.getSubscription().then((sub) => setSubscribed(!!sub))
    ).catch(() => {});
  }, []);

  const subscribe = useCallback(async () => {
    if (!isSupported) return false;
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") return false;

      const reg = await navigator.serviceWorker.register("/sw.js");
      const { public_key } = await api.pushVapidKey();
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(public_key),
      });
      const json = sub.toJSON();
      await api.pushSubscribe({ endpoint: json.endpoint, keys: json.keys });
      setSubscribed(true);
      return true;
    } catch {
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    if (!isSupported) return;
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await api.pushUnsubscribe({ endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  }, []);

  return { supported: isSupported, permission, subscribed, busy, subscribe, unsubscribe };
}
