import { useEffect, useRef, useState, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Modal, ActivityIndicator, StatusBar } from "react-native";
import { WebView } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "../../services/api";
import { ENDPOINTS } from "../../config/apiConfig";
import type { TripItem } from "./TripManagementScreen";
import { useAlertNotifications } from "../../hooks/useAlertNotifications";
import AlertNotifications from "../../components/AlertNotifications";
import { calculateOsrmRoute } from "../../utils/osrmRoute";

interface PopupData {
  vehicleId: string; status: string; driverName: string; speed: string;
  location: string; overspeed: string; smoking: string; mobileUsage: string;
  drowsiness: string; routeDeviation: string;
  address?: string; coordinates?: string;
  lastUpdateTime?: string; lastUpdateDate?: string;
}

interface Props {
  navigation: any;
  route: { params: { trip: TripItem } };
}

const TripLiveTrackingScreen = ({ navigation, route }: Props) => {
  const { trip } = route.params;

  const [remainingKm, setRemainingKm] = useState<number | null>(null);
  const [etaMin, setEtaMin]           = useState<number | null>(null);
  const [progress, setProgress]       = useState(0);
  const [liveSpeed, setLiveSpeed]     = useState(0);
  const [isDeviating, setIsDeviating] = useState(false);
  const [popup, setPopup]             = useState<PopupData | null>(null);
  const [showPopup, setShowPopup]     = useState(false);

  const { toasts, bellHistory, unreadCount, processPopup, dismissToast, markAllRead, clearAll } = useAlertNotifications();
  const [notifPanelOpen, setNotifPanelOpen] = useState(false);
  const webViewRef   = useRef<any>(null);
  const pollRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const mapReadyRef  = useRef(false);

  // Poll live tracking state
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await api.get<any>(`${ENDPOINTS.LIVE_TRACKING_STATE}/${trip.vehicleId}`);
        const u = res.data;
        if (!u) return;
        setRemainingKm(Number.parseFloat(u.remainingDistanceKm.toFixed(1)));
        setEtaMin(Math.round(u.etaMinutes));
        setProgress(Number.parseFloat(u.progressPercentage.toFixed(1)));
        setLiveSpeed(u.speed ?? 0);
        setIsDeviating(u.isDeviating ?? false);
        if (u.popupData) { setPopup(u.popupData); processPopup(u.popupData); }
        if (mapReadyRef.current && u.remainingRoute?.length > 0) {
          const latlngs = u.remainingRoute.map((p: any) => [p.lat, p.lng]);
          const js = `updateLiveTracking(${u.lat},${u.lng},${JSON.stringify(latlngs)},"${trip.vehicleId}"); true;`;
          webViewRef.current?.injectJavaScript(js);
        }
      } catch { /* silent */ }
    };
    pollRef.current = setInterval(poll, 5000);
    poll();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [trip.vehicleId]);

  const injectRoute = useCallback(async () => {
    mapReadyRef.current = true;
    let latlngs: [number, number][] = [];

    // ALWAYS prefer stored custom_polyline (road-following route)
    if (trip.customPolyline) {
      try { latlngs = JSON.parse(trip.customPolyline).map((p: any) => [p.lat, p.lng]); } catch { /* fall through */ }
    }

    // Fallback: fetch road route from OSRM — NEVER draw straight line
    if (latlngs.length === 0) {
      const result = await calculateOsrmRoute(trip.startLat, trip.startLng, trip.endLat, trip.endLng);
      if (result) latlngs = result.latlngs;
    }

    if (latlngs.length === 0) return; // no route at all — don't draw anything

    const js = `drawRoute(${JSON.stringify(latlngs)},${trip.startLat},${trip.startLng},${trip.endLat},${trip.endLng},"${trip.vehicleId}"); true;`;
    webViewRef.current?.injectJavaScript(js);
    setTimeout(() => webViewRef.current?.injectJavaScript(js), 800);
  }, [trip]);

  const onWebViewMessage = (e: any) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.type === "vehicleClick") setShowPopup(true);
    } catch { /* silent */ }
  };

  const etaLabel = etaMin != null && etaMin > 0
    ? (etaMin >= 60 ? `${Math.floor(etaMin / 60)}h ${etaMin % 60}min` : `${etaMin}min`)
    : (trip.duration ?? "—");
  const distLabel = remainingKm != null ? `${remainingKm} km` : (trip.distanceKm ? `${trip.distanceKm} km` : "—");

  const mapHtml = `
<!DOCTYPE html><html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>*{margin:0;padding:0;box-sizing:border-box}html,body,#map{width:100%;height:100%}</style>
</head>
<body>
<div id="map"></div>
<script>
  var map=L.map('map',{zoomControl:true}).setView([${trip.startLat},${trip.startLng}],13);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OSM'}).addTo(map);
  var routeLayer=null,startMarker=null,endMarker=null,vehicleMarker=null;
  var truckIcon=L.divIcon({html:'<div style="font-size:40px">🚚</div>',className:'',iconSize:[44,44],iconAnchor:[22,44]});
  var destIcon=L.divIcon({html:'<svg xmlns="http://www.w3.org/2000/svg" width="36" height="46" viewBox="0 0 28 36"><path d="M14 0C6.27 0 0 6.27 0 14c0 9.33 14 22 14 22S28 23.33 28 14C28 6.27 21.73 0 14 0z" fill="#FF3B30"/><circle cx="14" cy="14" r="6" fill="#fff"/></svg>',className:'',iconSize:[36,46],iconAnchor:[18,46]});
  window.drawRoute=function(latlngs,sLat,sLng,eLat,eLng,vehicleId){
    if(routeLayer)map.removeLayer(routeLayer);
    if(startMarker)map.removeLayer(startMarker);
    if(endMarker)map.removeLayer(endMarker);
    if(vehicleMarker)map.removeLayer(vehicleMarker);
    routeLayer=L.polyline(latlngs,{color:'#38BDF8',weight:5,opacity:0.9}).addTo(map);
    startMarker=L.marker([sLat,sLng],{icon:truckIcon}).addTo(map);
    endMarker=L.marker([eLat,eLng],{icon:destIcon}).addTo(map);
    if(vehicleId){
      var vIcon=L.divIcon({html:'<div style="background:#0EA5E9;color:#fff;font-size:13px;font-weight:700;padding:5px 10px;border-radius:8px;border:2px solid #fff;white-space:nowrap;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.5)">'+vehicleId+'</div>',className:'',iconSize:[null,null],iconAnchor:[0,44]});
      vehicleMarker=L.marker([sLat,sLng],{icon:vIcon,zIndexOffset:500}).addTo(map);
      vehicleMarker.on('click',function(){window.ReactNativeWebView.postMessage(JSON.stringify({type:'vehicleClick'}));});
    }
    setTimeout(function(){map.fitBounds(routeLayer.getBounds(),{padding:[60,60],maxZoom:16});},100);
  };
  window.updateLiveTracking=function(lat,lng,remainingLatlngs,vehicleId){
    if(startMarker)startMarker.setLatLng([lat,lng]);
    if(vehicleMarker)map.removeLayer(vehicleMarker);
    var vIcon=L.divIcon({html:'<div style="background:#0EA5E9;color:#fff;font-size:13px;font-weight:700;padding:5px 10px;border-radius:8px;border:2px solid #fff;white-space:nowrap;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.5)">'+vehicleId+'</div>',className:'',iconSize:[null,null],iconAnchor:[0,44]});
    vehicleMarker=L.marker([lat,lng],{icon:vIcon,zIndexOffset:1000}).addTo(map);
    vehicleMarker.on('click',function(){window.ReactNativeWebView.postMessage(JSON.stringify({type:'vehicleClick'}));});
    if(startMarker)startMarker.off('click').on('click',function(){window.ReactNativeWebView.postMessage(JSON.stringify({type:'vehicleClick'}));});
    if(routeLayer)map.removeLayer(routeLayer);
    if(remainingLatlngs&&remainingLatlngs.length>0)
      routeLayer=L.polyline(remainingLatlngs,{color:'#38BDF8',weight:5,opacity:0.9}).addTo(map);
  };
</script>
</body></html>`;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#0A1F44" />
      <LinearGradient
        colors={["#0A1F44", "#0D3B8E", "#1565C0"]}
        locations={[0, 0.5, 1]}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {[0.08, 0.18, 0.28].map((t, i) => (
          <View key={i} style={[styles.gridH, { top: `${t * 100}%` as any }]} />
        ))}
      </View>

      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.headerTitle}>{trip.tripId}</Text>
            <Text style={styles.headerSub}>{trip.vehicleId} · {trip.driverName}</Text>
          </View>
          {isDeviating && (
            <View style={styles.deviationBadge}>
              <Text style={styles.deviationText}>⚠ OFF ROUTE</Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.bellBtn}
            onPress={() => { markAllRead(); setNotifPanelOpen(true); }}
            activeOpacity={0.75}
          >
            <Ionicons name="notifications-outline" size={22} color="#fff" />
            {unreadCount > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeTxt}>{unreadCount > 99 ? "99+" : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Info bar */}
        <View style={styles.infoBar}>
          {[
            ["REMAINING", distLabel],
            ["ETA",       etaLabel],
            ["SPEED",     `${liveSpeed} km/h`],
            ["PROGRESS",  `${progress.toFixed(0)}%`],
          ].map(([label, value], i, arr) => (
            <View key={label} style={{ flex: 1, alignItems: "center" }}>
              <Text style={styles.infoLabel}>{label}</Text>
              <Text style={[styles.infoValue, label === "SPEED" && { color: "#38BDF8" }, label === "PROGRESS" && { color: isDeviating ? "#FF3B30" : "#4ADE80" }]}>{value}</Text>
              {i < arr.length - 1 && <View style={styles.infoDivider} />}
            </View>
          ))}
        </View>

        {/* Progress bar */}
        <View style={styles.progressBg}>
          <LinearGradient
            colors={["#1565C0", "#38BDF8"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={[styles.progressFill, { width: `${Math.min(progress, 100)}%` as any }]}
          />
          <Text style={styles.progressLabel}>{progress.toFixed(0)}% completed</Text>
        </View>

        {/* Map */}
        <WebView
          ref={webViewRef}
          style={{ flex: 1 }}
          source={{ html: mapHtml }}
          javaScriptEnabled
          originWhitelist={["*"]}
          onLoad={injectRoute}
          onMessage={onWebViewMessage}
        />

        {/* Route bar */}
        <View style={styles.routeBar}>
          <LinearGradient
            colors={["rgba(21,101,192,0.07)", "rgba(21,101,192,0.00)"]}
            start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
            style={styles.routeBarEdge}
          />
          <View style={styles.routeItem}>
            <View style={styles.routeDotGreen} />
            <View>
              <Text style={styles.routeLabel}>FROM</Text>
              <Text style={styles.routePlace} numberOfLines={1}>{trip.startPlace?.split(",")[0]}</Text>
            </View>
          </View>
          <Ionicons name="arrow-forward" size={18} color="rgba(255,255,255,0.40)" />
          <View style={[styles.routeItem, { alignItems: "flex-end" }]}>
            <View>
              <Text style={[styles.routeLabel, { textAlign: "right" }]}>TO</Text>
              <Text style={styles.routePlace} numberOfLines={1}>{trip.endPlace?.split(",")[0]}</Text>
            </View>
            <View style={styles.routeDotRed} />
          </View>
        </View>
      </SafeAreaView>

      {/* Vehicle popup */}
      <Modal visible={showPopup} transparent animationType="fade" onRequestClose={() => setShowPopup(false)}>
        <TouchableOpacity style={styles.popupOverlay} activeOpacity={1} onPress={() => setShowPopup(false)}>
          <View style={styles.popupBox}>
            <LinearGradient
              colors={["rgba(21,101,192,0.10)", "rgba(21,101,192,0.00)"]}
              start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
              style={styles.popupEdge}
            />
            {popup ? (
              <>
                <Text style={styles.popupTitle}>{popup.vehicleId}</Text>
                <Text style={styles.popupStatus}>{popup.status ?? "Idle"}</Text>
                {([
                  ["Driver",          popup.driverName],
                  ["Speed",           popup.speed ? `${popup.speed} km/h` : "0 km/h"],
                  ["Coordinates",     popup.coordinates || "—"],
                  ["Last Update",     [popup.lastUpdateTime, popup.lastUpdateDate].filter(Boolean).join(" · ") || "—"],
                  ["Overspeed",       popup.overspeed],
                  ["Smoking",         popup.smoking],
                  ["Mobile Usage",    popup.mobileUsage],
                  ["Drowsiness",      popup.drowsiness],
                  ["Route Deviation", popup.routeDeviation],
                ] as [string, string][]).map(([label, value]) => (
                  <View key={label} style={styles.popupRow}>
                    <Text style={styles.popupLabel}>{label}:</Text>
                    <Text style={[styles.popupValue, (value === "Yes" || value === "Fatigue") && { color: "#FF3B30" }]}>{value ?? "—"}</Text>
                  </View>
                ))}
                {/* Address — stacked layout */}
                <View style={styles.popupAddressRow}>
                  <Text style={styles.popupLabel}>Address:</Text>
                  <Text style={styles.popupAddressValue} numberOfLines={4}>
                    {popup.address || popup.location || "—"}
                  </Text>
                </View>
              </>
            ) : (
              <ActivityIndicator color="#1565C0" style={{ marginVertical: 20 }} />
            )}
            <TouchableOpacity style={styles.popupClose} onPress={() => setShowPopup(false)}>
              <Text style={{ color: "#1565C0", fontWeight: "700", fontSize: 15 }}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <AlertNotifications
        toasts={toasts}
        bellHistory={bellHistory}
        unreadCount={unreadCount}
        onDismissToast={dismissToast}
        onMarkAllRead={markAllRead}
        onClearAll={clearAll}
        topOffset={122}
        hideBell
        panelOpen={notifPanelOpen}
        onPanelClose={() => setNotifPanelOpen(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root:           { flex: 1 },
  safe:           { flex: 1 },
  gridH:          { position: "absolute", left: 0, right: 0, height: 1, backgroundColor: "rgba(255,255,255,0.025)" },

  header:         { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12, gap: 0 },
  backBtn:        { width: 42, height: 42, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.12)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  headerTitle:    { fontSize: 15, fontWeight: "800", color: "#fff", letterSpacing: 0.2 },
  headerSub:      { fontSize: 11, color: "rgba(255,255,255,0.60)", marginTop: 2 },
  deviationBadge: { backgroundColor: "#EF4444", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginRight: 8 },
  deviationText:  { color: "#fff", fontSize: 10, fontWeight: "800" },
  bellBtn:        { width: 42, height: 42, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.12)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center", marginLeft: 8 },
  bellBadge:      { position: "absolute", top: -4, right: -4, backgroundColor: "#EF4444", borderRadius: 9, minWidth: 18, height: 18, alignItems: "center", justifyContent: "center", paddingHorizontal: 3, borderWidth: 2, borderColor: "#0A1F44" },
  bellBadgeTxt:   { fontSize: 9, fontWeight: "800", color: "#fff", lineHeight: 13 },

  infoBar:        { flexDirection: "row", backgroundColor: "rgba(255,255,255,0.08)", marginHorizontal: 16, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 8, marginBottom: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.14)" },
  infoLabel:      { fontSize: 9, fontWeight: "700", color: "rgba(255,255,255,0.50)", textTransform: "uppercase", letterSpacing: 0.8 },
  infoValue:      { fontSize: 13, fontWeight: "800", color: "#fff", marginTop: 3 },
  infoDivider:    { position: "absolute", right: 0, top: 6, bottom: 6, width: 1, backgroundColor: "rgba(255,255,255,0.14)" },

  progressBg:     { height: 20, marginHorizontal: 16, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.10)", justifyContent: "center", marginBottom: 10, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.14)" },
  progressFill:   { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 10 },
  progressLabel:  { fontSize: 10, color: "#fff", fontWeight: "800", textAlign: "center", letterSpacing: 0.3 },

  routeBar:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#F6F1E9", paddingHorizontal: 18, paddingVertical: 12, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: "hidden", shadowColor: "#1A0040", shadowOpacity: 0.18, shadowRadius: 14, shadowOffset: { width: 0, height: -4 }, elevation: 10 },
  routeBarEdge:   { position: "absolute", top: 0, left: 0, right: 0, height: 4, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  routeItem:      { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  routeDotGreen:  { width: 10, height: 10, borderRadius: 5, backgroundColor: "#16A34A" },
  routeDotRed:    { width: 10, height: 10, borderRadius: 5, backgroundColor: "#EF4444" },
  routeLabel:     { fontSize: 10, fontWeight: "700", color: "#3A5A7A", textTransform: "uppercase", letterSpacing: 0.8 },
  routePlace:     { fontSize: 14, fontWeight: "800", color: "#0A1F44", marginTop: 2 },

  popupOverlay:   { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", alignItems: "center" },
  popupBox:       { backgroundColor: "#F6F1E9", borderRadius: 24, padding: 20, width: "88%", overflow: "hidden", shadowColor: "#1A0040", shadowOpacity: 0.22, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 16 },
  popupEdge:      { position: "absolute", top: 0, left: 0, right: 0, height: 4, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  popupTitle:     { fontSize: 18, fontWeight: "800", color: "#0A1F44", marginBottom: 2 },
  popupStatus:    { fontSize: 13, color: "#1565C0", fontWeight: "700", marginBottom: 12 },
  popupRow:       { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(21,101,192,0.12)" },
  popupLabel:     { fontSize: 13, color: "#3A5A7A", fontWeight: "600" },
  popupValue:     { fontSize: 13, color: "#0A1F44", fontWeight: "700" },
  popupAddressRow: { flexDirection: "column", paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(21,101,192,0.12)" },
  popupAddressValue: { fontSize: 12, color: "#0A1F44", fontWeight: "600", marginTop: 2, lineHeight: 17 },
  popupClose:     { alignItems: "center", marginTop: 14 },
});

export default TripLiveTrackingScreen;
