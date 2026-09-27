import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPinned } from "lucide-react";
import { api } from "../api";
import { useLang } from "../i18n.jsx";

const SAUDI_CENTER = [24.0, 45.0];
const SAUDI_ZOOM = 6;

function markerColor(c) {
  if (c.legal_hold) return "#c13a3a";
  if ((c.overdue_amount || 0) > 0) return "#b3541f";
  return "#0f4c56";
}

export default function CustomerMapReport({ onSelectCustomer }) {
  const { t } = useLang();
  const mapElRef = useRef(null);
  const mapRef = useRef(null);
  const markersLayerRef = useRef(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [cities, setCities] = useState([]);
  const [regions, setRegions] = useState([]);
  const [collectors, setCollectors] = useState([]);
  const [cityFilter, setCityFilter] = useState("");
  const [regionFilter, setRegionFilter] = useState("");
  const [collectorFilter, setCollectorFilter] = useState("");

  useEffect(() => {
    api.cities().then(setCities).catch(() => {});
    api.fieldOptions("region").then((opts) => setRegions(opts.map((o) => o.value))).catch(() => {});
    api.collectors().then(setCollectors).catch(() => {});
  }, []);

  useEffect(() => {
    if (!mapElRef.current || mapRef.current) return;
    const map = L.map(mapElRef.current, { center: SAUDI_CENTER, zoom: SAUDI_ZOOM });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);
    markersLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    setError(null);
    api.customerMap({ city: cityFilter, region: regionFilter, collector: collectorFilter })
      .then(setData)
      .catch((e) => setError(e.message));
  }, [cityFilter, regionFilter, collectorFilter]);

  useEffect(() => {
    if (!mapRef.current || !markersLayerRef.current || !data) return;
    markersLayerRef.current.clearLayers();
    const points = [];
    data.customers.forEach((c) => {
      const marker = L.circleMarker([c.latitude, c.longitude], {
        radius: 7,
        color: markerColor(c),
        fillColor: markerColor(c),
        fillOpacity: 0.75,
        weight: 2,
      });
      const popupHtml = `
        <div style="font-family: 'Tajawal', system-ui, sans-serif; direction: rtl; min-width: 180px;">
          <div style="font-weight: 700; font-size: 13px; margin-bottom: 4px;">${c.name}</div>
          <div style="font-size: 12px; color: #5b6472;">${c.city || ""}${c.salesperson_name ? " · " + c.salesperson_name : ""}</div>
          <div style="font-size: 12px; margin-top: 4px;">${t("totalDue")}: ${(c.current_due || 0).toLocaleString("en-US")} ${t("sar")}</div>
          <button data-partner-id="${c.partner_id}" class="map-popup-open-btn" style="margin-top: 8px; width: 100%; padding: 6px 0; border-radius: 8px; border: 1px solid #e1e6ee; background: #f7f9fb; color: #0f4c56; font-family: inherit; font-size: 12px; font-weight: 700; cursor: pointer;">${t("customerMapOpenCustomerPage")}</button>
        </div>
      `;
      marker.bindPopup(popupHtml);
      marker.on("popupopen", () => {
        const btn = document.querySelector(`.map-popup-open-btn[data-partner-id="${c.partner_id}"]`);
        if (btn) btn.onclick = () => onSelectCustomer?.(c.partner_id);
      });
      marker.addTo(markersLayerRef.current);
      points.push([c.latitude, c.longitude]);
    });
    if (points.length > 0) {
      mapRef.current.fitBounds(points, { padding: [40, 40], maxZoom: 12 });
    } else {
      mapRef.current.setView(SAUDI_CENTER, SAUDI_ZOOM);
    }
  }, [data, onSelectCustomer, t]);

  const pct = data && data.total_customers > 0 ? Math.round((data.with_location_count / data.total_customers) * 100) : 0;

  return (
    <div className="content-stack" style={{ maxWidth: "100%" }}>
      <div className="panel">
        <h2><MapPinned size={15} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />{t("customerMapTitle")}</h2>
        <p className="panel-sub">{t("customerMapHint")}</p>

        <div className="more-filters-row" style={{ marginBottom: 14 }}>
          <div className="more-filter-field">
            <label>{t("cityLabel")}</label>
            <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)}>
              <option value="">{t("allStatus")}</option>
              {cities.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="more-filter-field">
            <label>{t("regionLabel")}</label>
            <select value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)}>
              <option value="">{t("allStatus")}</option>
              {regions.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          {collectors.length > 1 && (
            <div className="more-filter-field">
              <label>{t("collectorField")}</label>
              <select value={collectorFilter} onChange={(e) => setCollectorFilter(e.target.value)}>
                <option value="">{t("allStatus")}</option>
                {collectors.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}
          {data && (
            <div className="more-filter-field" style={{ marginInlineStart: "auto" }}>
              <span className="fu-tag faint">
                {t("customerMapCoverage").replace("{n}", data.with_location_count).replace("{total}", data.total_customers).replace("{pct}", pct)}
              </span>
            </div>
          )}
        </div>

        {error && <div className="error-state">{error}</div>}

        <div style={{ position: "relative" }}>
          <div ref={mapElRef} style={{ width: "100%", height: 560, borderRadius: 14, border: "1px solid var(--border)" }} />
          {data && data.with_location_count === 0 && (
            <div style={{
              position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
              background: "rgba(255,255,255,0.85)", borderRadius: 14, pointerEvents: "none", textAlign: "center", padding: 24,
            }}>
              <div>
                <MapPinned size={28} style={{ color: "var(--text-faint)", marginBottom: 8 }} />
                <p className="settings-meta" style={{ maxWidth: 340, margin: "0 auto" }}>{t("customerMapEmptyHint")}</p>
              </div>
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 18, marginTop: 12, fontSize: 12, color: "var(--text-dim)" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 999, background: "#0f4c56", display: "inline-block" }} /> {t("customerMapLegendNormal")}
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 999, background: "#b3541f", display: "inline-block" }} /> {t("customerMapLegendOverdue")}
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 999, background: "#c13a3a", display: "inline-block" }} /> {t("customerMapLegendLegalHold")}
          </span>
        </div>
      </div>
    </div>
  );
}
