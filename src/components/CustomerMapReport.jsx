import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { MapPinned, Route, X, ArrowUp, ArrowDown, Navigation } from "lucide-react";
import { api } from "../api";
import { useLang } from "../i18n.jsx";

const SAUDI_CENTER = [24.0, 45.0];
const SAUDI_ZOOM = 6;

function markerColor(c) {
  if (c.legal_hold) return "#c13a3a";
  if ((c.overdue_amount || 0) > 0) return "#b3541f";
  return "#0f4c56";
}

// Straight-line (haversine) distance in km - good enough to order nearby
// stops sensibly; it isn't real driving distance (that needs a paid
// routing API), which is why the "open in Maps" link hands the actual
// turn-by-turn work to Google Maps instead of drawing roads ourselves.
function haversineKm(a, b) {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const lat1 = (a[0] * Math.PI) / 180;
  const lat2 = (b[0] * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function nearestNeighborOrder(start, stops) {
  const remaining = [...stops];
  const ordered = [];
  let current = start;
  while (remaining.length) {
    let bestIdx = 0;
    let bestDist = Infinity;
    remaining.forEach((s, i) => {
      const d = haversineKm(current, [s.latitude, s.longitude]);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    });
    const next = remaining.splice(bestIdx, 1)[0];
    ordered.push(next);
    current = [next.latitude, next.longitude];
  }
  return ordered;
}

function googleMapsRouteUrl(stops, origin) {
  const points = origin ? [origin, ...stops.map((s) => [s.latitude, s.longitude])] : stops.map((s) => [s.latitude, s.longitude]);
  if (points.length < 2) return null;
  const fmt = (p) => `${p[0]},${p[1]}`;
  const originStr = fmt(points[0]);
  const destStr = fmt(points[points.length - 1]);
  const waypoints = points.slice(1, -1).map(fmt).join("|");
  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("api", "1");
  url.searchParams.set("origin", originStr);
  url.searchParams.set("destination", destStr);
  if (waypoints) url.searchParams.set("waypoints", waypoints);
  url.searchParams.set("travelmode", "driving");
  return url.toString();
}

export default function CustomerMapReport({ onSelectCustomer }) {
  const { t } = useLang();
  const mapElRef = useRef(null);
  const mapRef = useRef(null);
  const markersLayerRef = useRef(null);
  const routeLineRef = useRef(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [cities, setCities] = useState([]);
  const [regions, setRegions] = useState([]);
  const [collectors, setCollectors] = useState([]);
  const [cityFilter, setCityFilter] = useState("");
  const [regionFilter, setRegionFilter] = useState("");
  const [collectorFilter, setCollectorFilter] = useState("");
  const [viewMode, setViewMode] = useState("pins"); // "pins" | "clusters"
  const [routeMode, setRouteMode] = useState(false);
  const [routeStops, setRouteStops] = useState([]);
  const [myLocation, setMyLocation] = useState(null);
  const [locatingMe, setLocatingMe] = useState(false);

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

  const toggleRouteStop = (c) => {
    setRouteStops((prev) => {
      const exists = prev.some((s) => s.partner_id === c.partner_id);
      if (exists) return prev.filter((s) => s.partner_id !== c.partner_id);
      return [...prev, c];
    });
  };

  // Rebuild the markers layer whenever the data, the pins/clusters toggle,
  // or route selection changes (a selected stop needs its numbered badge
  // to update immediately).
  useEffect(() => {
    if (!mapRef.current || !data) return;
    if (markersLayerRef.current) {
      mapRef.current.removeLayer(markersLayerRef.current);
    }
    const layer = viewMode === "clusters" ? L.markerClusterGroup() : L.layerGroup();
    const points = [];

    data.customers.forEach((c) => {
      const stopIndex = routeStops.findIndex((s) => s.partner_id === c.partner_id);
      let marker;
      if (stopIndex >= 0) {
        marker = L.marker([c.latitude, c.longitude], {
          icon: L.divIcon({
            className: "",
            html: `<div style="width:26px;height:26px;border-radius:999px;background:#0f4c56;color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3);">${stopIndex + 1}</div>`,
            iconSize: [26, 26],
            iconAnchor: [13, 13],
          }),
        });
      } else {
        marker = L.circleMarker([c.latitude, c.longitude], {
          radius: 7,
          color: markerColor(c),
          fillColor: markerColor(c),
          fillOpacity: 0.75,
          weight: 2,
        });
      }

      if (routeMode) {
        marker.on("click", () => toggleRouteStop(c));
      } else {
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
      }

      marker.addTo(layer);
      points.push([c.latitude, c.longitude]);
    });

    layer.addTo(mapRef.current);
    markersLayerRef.current = layer;

    if (routeStops.length === 0 && points.length > 0) {
      mapRef.current.fitBounds(points, { padding: [40, 40], maxZoom: 12 });
    } else if (points.length === 0) {
      mapRef.current.setView(SAUDI_CENTER, SAUDI_ZOOM);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, onSelectCustomer, t, viewMode, routeMode, routeStops]);

  // Draw/update the route line connecting the selected stops, in order.
  useEffect(() => {
    if (!mapRef.current) return;
    if (routeLineRef.current) {
      mapRef.current.removeLayer(routeLineRef.current);
      routeLineRef.current = null;
    }
    if (!routeMode || routeStops.length < 2) return;
    const latlngs = (myLocation ? [myLocation] : []).concat(routeStops.map((s) => [s.latitude, s.longitude]));
    const line = L.polyline(latlngs, { color: "#0f4c56", weight: 3, dashArray: "6 6" }).addTo(mapRef.current);
    routeLineRef.current = line;
  }, [routeMode, routeStops, myLocation]);

  const handleLocateMe = () => {
    if (!navigator.geolocation) return;
    setLocatingMe(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setMyLocation([pos.coords.latitude, pos.coords.longitude]);
        setLocatingMe(false);
      },
      () => setLocatingMe(false),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const handleOptimizeRoute = () => {
    if (routeStops.length < 2) return;
    const start = myLocation || [routeStops[0].latitude, routeStops[0].longitude];
    const toOrder = myLocation ? routeStops : routeStops.slice(1);
    const ordered = nearestNeighborOrder(start, toOrder);
    setRouteStops(myLocation ? ordered : [routeStops[0], ...ordered]);
  };

  const moveStop = (index, dir) => {
    setRouteStops((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const routeMapsUrl = googleMapsRouteUrl(routeStops, myLocation);

  const pct = data && data.total_customers > 0 ? Math.round((data.with_location_count / data.total_customers) * 100) : 0;

  return (
    <div className="content-stack" style={{ maxWidth: "100%" }}>
      <div className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
          <div>
            <h2><MapPinned size={15} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />{t("customerMapTitle")}</h2>
            <p className="panel-sub">{t("customerMapHint")}</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <div className="my-day-sort-toggle">
              <button className={viewMode === "pins" ? "active" : ""} onClick={() => setViewMode("pins")}>{t("customerMapViewPins")}</button>
              <button className={viewMode === "clusters" ? "active" : ""} onClick={() => setViewMode("clusters")}>{t("customerMapViewClusters")}</button>
            </div>
            <button
              className={`btn-secondary sm${routeMode ? " active-toggle" : ""}`}
              onClick={() => setRouteMode((v) => !v)}
            >
              <Route size={13} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />
              {routeMode ? t("customerMapExitRouteMode") : t("customerMapRouteMode")}
            </button>
          </div>
        </div>

        <div className="more-filters-row" style={{ marginTop: 14, marginBottom: 14 }}>
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

        <div style={{ display: "flex", gap: 18 }}>
          <div style={{ position: "relative", flexGrow: 1, minWidth: 0 }}>
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

          {routeMode && (
            <div style={{ width: 280, flexShrink: 0, border: "1px solid var(--border)", borderRadius: 14, padding: 16, display: "flex", flexDirection: "column" }}>
              <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 4 }}>{t("customerMapRouteTitle")}</div>
              <p className="settings-meta" style={{ marginBottom: 10 }}>{t("customerMapRouteHint")}</p>

              <button className="btn-secondary sm" onClick={handleLocateMe} disabled={locatingMe} style={{ marginBottom: 8 }}>
                <Navigation size={12} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />
                {myLocation ? t("customerMapLocationSet") : (locatingMe ? t("locationLocating") : t("customerMapUseMyLocation"))}
              </button>

              {routeStops.length === 0 ? (
                <p className="settings-meta">{t("customerMapRouteEmpty")}</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10, overflowY: "auto", maxHeight: 320 }}>
                  {routeStops.map((s, i) => (
                    <div key={s.partner_id} style={{ display: "flex", alignItems: "center", gap: 6, border: "1px solid var(--border)", borderRadius: 8, padding: "6px 8px" }}>
                      <span className="fu-tag faint sm" style={{ flexShrink: 0 }}>{i + 1}</span>
                      <span style={{ fontSize: 12, flexGrow: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
                      <button className="icon-btn" style={{ width: 18, height: 18 }} onClick={() => moveStop(i, -1)} disabled={i === 0}><ArrowUp size={10} /></button>
                      <button className="icon-btn" style={{ width: 18, height: 18 }} onClick={() => moveStop(i, 1)} disabled={i === routeStops.length - 1}><ArrowDown size={10} /></button>
                      <button className="icon-btn danger" style={{ width: 18, height: 18 }} onClick={() => toggleRouteStop(s)}><X size={10} /></button>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: "auto" }}>
                <button className="btn-secondary sm" onClick={handleOptimizeRoute} disabled={routeStops.length < 2}>{t("customerMapOptimizeRoute")}</button>
                <a
                  className="btn-primary sm"
                  href={routeMapsUrl || undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    textAlign: "center",
                    ...(!routeMapsUrl ? { pointerEvents: "none", opacity: 0.5 } : {}),
                  }}
                  aria-disabled={!routeMapsUrl}
                >
                  {t("customerMapOpenInMaps")}
                </a>
                {routeStops.length > 0 && (
                  <button className="btn-secondary sm danger" onClick={() => setRouteStops([])}>{t("customerMapClearRoute")}</button>
                )}
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
          {routeMode && (
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 999, background: "#0f4c56", display: "inline-block", border: "2px solid #fff", boxShadow: "0 0 0 1px #0f4c56" }} /> {t("customerMapLegendRouteStop")}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
