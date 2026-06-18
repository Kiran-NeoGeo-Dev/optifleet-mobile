import { useEffect, useRef, useState, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Modal, Image } from "react-native";
import { WebView } from "react-native-webview";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Speech from "expo-speech";
import { useAuth } from "../../hooks/useAuth";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { COLORS } from "../../components/ScreenBg";
import { api } from "../../services/api";
import { ENDPOINTS } from "../../config/apiConfig";
import { useAlertNotifications } from "../../hooks/useAlertNotifications";
import AlertNotifications from "../../components/AlertNotifications";
import { fetchMyDriverProfile } from "../../services/driverService";
import { Driver } from "../../types/Driver";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { DriverStackParamList } from "../../navigation/DriverNavigator";
import { calculateOsrmRoute } from "../../utils/osrmRoute";

type Props = NativeStackScreenProps<DriverStackParamList, "DriverMap">;

interface ActiveTrip {
  id:             number;
  tripId:         string;
  vehicleId:      string;
  driverName:     string;
  startPlace:     string;
  endPlace:       string;
  startLat:       number;
  startLng:       number;
  endLat:         number;
  endLng:         number;
  distanceKm:     string;
  duration:       string;
  status:         string;
  customPolyline: string | null;
}

interface PopupData {
  vehicleId:      string;
  status:         string;
  driverName:     string;
  speed:          string;
  location:       string;
  overspeed:      string;
  smoking:        string;
  mobileUsage:    string;
  drowsiness:     string;
  routeDeviation: string;
  address?:        string;
  coordinates?:    string;
  lastUpdateTime?: string;
  lastUpdateDate?: string;
}

interface TrackingUpdate {
  vehicleId:           string;
  lat:                 number;
  lng:                 number;
  speed:               number;
  tripStatus:          string;
  remainingRoute:      { lat: number; lng: number }[];
  remainingDistanceKm: number;
  etaMinutes:          number;
  progressPercentage:  number;
  popupData:           PopupData;
  isDeviating:         boolean;
}

const DriverMapScreen = ({ navigation }: Props) => {
  const { username, logout }            = useAuth();
  const [logoutDialog, setLogoutDialog] = useState(false);
  const [trip, setTrip]                 = useState<ActiveTrip | null>(null);
  const [loading, setLoading]           = useState(true);
  const [noTrip, setNoTrip]             = useState(false);
  const webViewRef                      = useRef<any>(null);
  const [driverProfile, setDriverProfile] = useState<Driver | null>(null);

  // Live tracking state
  const [remainingKm, setRemainingKm]   = useState<number | null>(null);
  const [etaMin, setEtaMin]             = useState<number | null>(null);
  const [progress, setProgress]         = useState(0);
  const [liveSpeed, setLiveSpeed]       = useState(0);
  const [isDeviating, setIsDeviating]   = useState(false);

  // Popup
  const [popup, setPopup]               = useState<PopupData | null>(null);
  const [showPopup, setShowPopup]       = useState(false);

  const { toasts, bellHistory, unreadCount, processPopup, dismissToast, markAllRead, clearAll } = useAlertNotifications();
  const [notifPanelOpen, setNotifPanelOpen] = useState(false);
  const pollRef                         = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastVoiceRef                    = useRef(0);
  const mapReadyRef                     = useRef(false);

  // ── Fetch driver profile on mount ─────────────────────────────────────────
  useEffect(() => {
    fetchMyDriverProfile().then(setDriverProfile).catch(() => {});
  }, []);

  // ── Fetch trip on mount ────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get<ActiveTrip>(ENDPOINTS.DRIVER_ACTIVE_TRIP);
        if (res.data?.id) setTrip(res.data);
        else setNoTrip(true);
      } catch { setNoTrip(true); }
      finally { setLoading(false); }
    })();
  }, []);

  // ── Start polling live tracking once trip is loaded ────────────────────────
  useEffect(() => {
    if (!trip) return;
    const poll = async () => {
      try {
        const res = await api.get<TrackingUpdate>(
          `${ENDPOINTS.LIVE_TRACKING_STATE}/${trip.vehicleId}`
        );
        const u = res.data;
        if (!u) return;

        setRemainingKm(Number.parseFloat(u.remainingDistanceKm.toFixed(1)));
        setEtaMin(Math.round(u.etaMinutes));
        setProgress(Number.parseFloat(u.progressPercentage.toFixed(1)));
        setLiveSpeed(u.speed);
        setIsDeviating(u.isDeviating);
        if (u.popupData) { setPopup(u.popupData); processPopup(u.popupData); }

        // Inject live position + shrinking route into map
        if (mapReadyRef.current && u.remainingRoute?.length > 0) {
          const latlngs = u.remainingRoute.map(p => [p.lat, p.lng]);
          const js = `updateLiveTracking(
            ${u.lat}, ${u.lng},
            ${JSON.stringify(latlngs)},
            "${trip.vehicleId}"
          ); true;`;
          webViewRef.current?.injectJavaScript(js);
        }

        // Voice guidance every 5 minutes or on deviation
        const now = Date.now();
        if (now - lastVoiceRef.current > 300000 || u.isDeviating) {
          lastVoiceRef.current = now;
          const eta = Math.round(u.etaMinutes);
          const km  = u.remainingDistanceKm.toFixed(1);
          if (u.isDeviating) {
            Speech.speak("Warning! You have deviated from the planned route. Please return to route.", { language: "en-IN" });
          } else if (eta > 0) {
            Speech.speak(`Continue on route. ${km} kilometres remaining. Estimated arrival in ${eta} minutes.`, { language: "en-IN" });
          }
        }
      } catch {
        setLiveSpeed(0);
        setIsDeviating(false);
        webViewRef.current?.injectJavaScript("window.clearLiveTracking && window.clearLiveTracking(); true;");
      }
    };

    pollRef.current = setInterval(poll, 5000);
    poll(); // immediate first call
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [trip]);

  // ── Inject initial route once WebView loads ────────────────────────────────
  const injectRoute = useCallback(async () => {
    if (!trip) return;
    mapReadyRef.current = true;
    let latlngs: [number, number][] = [];

    if (trip.customPolyline) {
      try {
        const pts = JSON.parse(trip.customPolyline) as { lat: number; lng: number }[];
        latlngs = pts.map(p => [p.lat, p.lng]);
      } catch { /* fall through */ }
    }

    if (latlngs.length === 0) {
      const result = await calculateOsrmRoute(trip.startLat, trip.startLng, trip.endLat, trip.endLng);
      if (result) latlngs = result.latlngs;
    }

    if (latlngs.length === 0)
      return; // no route — don't draw anything, wait for telemetry

    const js = `drawRoute(
      ${JSON.stringify(latlngs)},
      ${trip.startLat}, ${trip.startLng},
      ${trip.endLat}, ${trip.endLng},
      "${trip.vehicleId}"
    ); true;`;
    webViewRef.current?.injectJavaScript(js);
    setTimeout(() => webViewRef.current?.injectJavaScript(js), 800);
  }, [trip]);

  // ── Handle popup click from map ────────────────────────────────────────────
  const onWebViewMessage = (e: any) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.type === "vehicleClick") setShowPopup(true);
    } catch { /* silent */ }
  };

  // ── Leaflet HTML ───────────────────────────────────────────────────────────
  const initLat = trip?.startLat ?? 17.4065;
  const initLng = trip?.startLng ?? 78.4772;

  const mapHtml = `
<!DOCTYPE html><html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}html,body,#map{width:100%;height:100%}
    .leaflet-control-zoom{margin-top:10px!important;margin-left:10px!important}
  </style>
</head>
<body>
<div id="map"></div>
<script>
  var map = L.map('map',{zoomControl:true}).setView([${initLat},${initLng}],13);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OSM'}).addTo(map);

  var routeLayer=null, startMarker=null, endMarker=null, vehicleMarker=null;

  var truckIcon = L.divIcon({
    html:'<div style="font-size:40px">🚚</div>',
    className:'', iconSize:[44,44], iconAnchor:[22,44]
  });
  var destIcon = L.divIcon({
    html:'<svg xmlns="http://www.w3.org/2000/svg" width="36" height="46" viewBox="0 0 28 36"><path d="M14 0C6.27 0 0 6.27 0 14c0 9.33 14 22 14 22S28 23.33 28 14C28 6.27 21.73 0 14 0z" fill="#FF3B30"/><circle cx="14" cy="14" r="6" fill="#fff"/></svg>',
    className:'', iconSize:[36,46], iconAnchor:[18,46]
  });
  var liveIcon = L.divIcon({
    html:'<div style="width:24px;height:24px;border-radius:50%;background:#0EA5E9;border:3px solid #fff;box-shadow:0 0 0 5px rgba(14,165,233,0.35)"></div>',
    className:'', iconSize:[24,24], iconAnchor:[12,12]
  });

  window.drawRoute = function(latlngs, sLat, sLng, eLat, eLng, vehicleId) {
    if(routeLayer)    map.removeLayer(routeLayer);
    if(startMarker)   map.removeLayer(startMarker);
    if(endMarker)     map.removeLayer(endMarker);
    if(vehicleMarker) map.removeLayer(vehicleMarker);
    routeLayer  = L.polyline(latlngs, {color:'#38BDF8', weight:5, opacity:0.9}).addTo(map);
    startMarker = L.marker([sLat, sLng], {icon: truckIcon}).addTo(map);
    endMarker   = L.marker([eLat, eLng], {icon: destIcon}).addTo(map);
    if(vehicleId) {
      var vIcon = L.divIcon({
        html:'<div style="background:#0EA5E9;color:#fff;font-size:13px;font-weight:700;padding:5px 10px;border-radius:8px;border:2px solid #fff;white-space:nowrap;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.5)">' + vehicleId + '</div>',
        className:'', iconSize:[null,null], iconAnchor:[0,44]
      });
      vehicleMarker = L.marker([sLat, sLng], {icon: vIcon, zIndexOffset:500}).addTo(map);
      vehicleMarker.on('click', function(){
        window.ReactNativeWebView.postMessage(JSON.stringify({type:'vehicleClick'}));
      });
    }
    setTimeout(function(){ map.fitBounds(routeLayer.getBounds(),{padding:[60,60],maxZoom:16}); },100);
  };

  window.updateLiveTracking = function(lat, lng, remainingLatlngs, vehicleId) {
    if(startMarker) { startMarker.setLatLng([lat, lng]); }
    if(vehicleMarker) { map.removeLayer(vehicleMarker); }
    var vIcon = L.divIcon({
      html:'<div style="background:#0EA5E9;color:#fff;font-size:13px;font-weight:700;padding:5px 10px;border-radius:8px;border:2px solid #fff;white-space:nowrap;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.5)">' + vehicleId + '</div>',
      className:'', iconSize:[null,null], iconAnchor:[0,44]
    });
    vehicleMarker = L.marker([lat, lng], {icon: vIcon, zIndexOffset:1000}).addTo(map);
    vehicleMarker.on('click', function(){
      window.ReactNativeWebView.postMessage(JSON.stringify({type:'vehicleClick'}));
    });
    startMarker.off('click').on('click', function(){
      window.ReactNativeWebView.postMessage(JSON.stringify({type:'vehicleClick'}));
    });
    if(routeLayer) map.removeLayer(routeLayer);
    if(remainingLatlngs && remainingLatlngs.length > 0) {
      routeLayer = L.polyline(remainingLatlngs, {color:'#38BDF8', weight:5, opacity:0.9}).addTo(map);
    }
  };
  window.clearLiveTracking = function() {
    if(vehicleMarker) { map.removeLayer(vehicleMarker); vehicleMarker = null; }
  };
</script>
</body></html>`;

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={[styles.root, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={{ color: COLORS.whiteMuted, marginTop: 12 }}>Loading your trip…</Text>
      </SafeAreaView>
    );
  }

  const etaLabel = etaMin != null && etaMin > 0
    ? (etaMin >= 60 ? `${Math.floor(etaMin / 60)}h ${etaMin % 60}min` : `${etaMin}min`)
    : (trip?.duration ?? "—");

  const distLabel = remainingKm != null ? `${remainingKm} km` : (trip?.distanceKm ? `${trip.distanceKm} km` : "—");

  return (
    <SafeAreaView style={styles.root}>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="car-outline" size={22} color={COLORS.accent} />
          <Text style={styles.headerTitle}>Live Map</Text>
          {isDeviating && (
            <View style={styles.deviationBadge}>
              <Text style={styles.deviationText}>⚠ OFF ROUTE</Text>
            </View>
          )}
        </View>
        <View style={styles.headerRight}>
          {/* Driver photo avatar — tappable → DriverProfile */}
          <TouchableOpacity onPress={() => navigation.navigate("DriverProfile")} activeOpacity={0.8}>
            {driverProfile?.frontFaceImage ? (
              <Image
                source={{ uri: `data:image/jpeg;base64,${driverProfile.frontFaceImage}` }}
                style={styles.avatarImg}
              />
            ) : (
              <View style={styles.avatarFallback}>
                <Ionicons name="person" size={18} color="#fff" />
              </View>
            )}
          </TouchableOpacity>
          {/* Bell */}
          <TouchableOpacity style={styles.bellBtn} onPress={() => { markAllRead(); setNotifPanelOpen(true); }} activeOpacity={0.75}>
            <Ionicons name="notifications-outline" size={22} color="#fff" />
            {unreadCount > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeTxt}>{unreadCount > 99 ? "99+" : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.logoutBtn} onPress={() => setLogoutDialog(true)}>
            <Ionicons name="log-out-outline" size={20} color={COLORS.red} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Trip info bar */}
      {trip && (
        <View style={styles.infoBar}>
          <View style={styles.infoCol}>
            <Text style={styles.infoLabel}>VEHICLE</Text>
            <Text style={styles.infoValue}>{trip.vehicleId ?? ""}</Text>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoCol}>
            <Text style={styles.infoLabel}>REMAINING</Text>
            <Text style={styles.infoValue}>{distLabel ?? ""}</Text>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoCol}>
            <Text style={styles.infoLabel}>ETA</Text>
            <Text style={styles.infoValue}>{etaLabel ?? ""}</Text>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoCol}>
            <Text style={styles.infoLabel}>SPEED</Text>
            <Text style={[styles.infoValue, { color: "#38BDF8" }]}>{liveSpeed ?? 0} km/h</Text>
          </View>
        </View>
      )}

      {/* Progress bar */}
      {trip && (
        <View style={styles.progressBg}>
          <View style={[styles.progressFill, { width: `${Math.min(progress, 100)}%` as any }]} />
          <Text style={styles.progressLabel}>{progress.toFixed(0)}% completed</Text>
        </View>
      )}

      {/* No trip */}
      {noTrip && (
        <View style={styles.noTripBox}>
          <Ionicons name="map-outline" size={40} color={COLORS.whiteMuted} />
          <Text style={styles.noTripText}>No active trip assigned</Text>
        </View>
      )}

      {/* Map */}
      <View style={{ flex: 1 }}>
        <WebView
          ref={webViewRef}
          style={styles.map}
          source={{ html: mapHtml }}
          javaScriptEnabled
          originWhitelist={["*"]}
          onLoad={injectRoute}
          onMessage={onWebViewMessage}
        />

        {/* Floating driver overlay on map — top right */}
        {driverProfile && (
          <TouchableOpacity
            style={styles.driverOverlay}
            onPress={() => navigation.navigate("DriverProfile")}
            activeOpacity={0.88}
          >
            {driverProfile.frontFaceImage ? (
              <Image
                source={{ uri: `data:image/jpeg;base64,${driverProfile.frontFaceImage}` }}
                style={styles.overlayImg}
              />
            ) : (
              <View style={styles.overlayImgFallback}>
                <Ionicons name="person" size={16} color="#fff" />
              </View>
            )}
            <View style={styles.overlayInfo}>
              <Text style={styles.overlayName} numberOfLines={1}>{driverProfile.driverName ?? ""}</Text>
              {trip && <Text style={styles.overlayVehicle} numberOfLines={1}>{trip.vehicleId ?? ""}</Text>}
              <View style={styles.overlayStatus}>
                <View style={[styles.overlayDot, { backgroundColor: driverProfile.status ? "#22C55E" : "#EF4444" }]} />
                <Text style={styles.overlayStatusTxt}>{driverProfile.status ? "Active" : "Inactive"}</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
      </View>
      {trip && (
        <View style={styles.routeBar}>
          <View style={styles.routeItem}>
            <Text style={styles.routeLabel}>🚚 FROM</Text>
            <Text style={styles.routePlace} numberOfLines={1}>{trip.startPlace?.split(",")[0] ?? ""}</Text>
          </View>
          <Ionicons name="arrow-forward" size={16} color={COLORS.whiteMuted} />
          <View style={styles.routeItem}>
            <Text style={styles.routeLabel}>📍 TO</Text>
            <Text style={styles.routePlace} numberOfLines={1}>{trip.endPlace?.split(",")[0] ?? ""}</Text>
          </View>
        </View>
      )}

      {/* Vehicle Popup Modal */}
      <Modal visible={showPopup} transparent animationType="fade" onRequestClose={() => setShowPopup(false)}>
        <TouchableOpacity style={styles.popupOverlay} activeOpacity={1} onPress={() => setShowPopup(false)}>
          <View style={styles.popupBox}>
            {popup ? (
              <>
                <Text style={styles.popupTitle}>{popup.vehicleId ?? ""}</Text>
                <Text style={styles.popupStatus}>{popup.status ?? "Idle"}</Text>
                {([
                  ["Driver",          popup.driverName ?? "—"],
                  ["Speed",           popup.speed ? `${popup.speed} km/h` : "0 km/h"],
                  ["Coordinates",     popup.coordinates || "—"],
                  ["Last Update",     [popup.lastUpdateTime, popup.lastUpdateDate].filter(Boolean).join(" · ") || "—"],
                  ["Overspeed",       popup.overspeed ?? "—"],
                  ["Smoking",         popup.smoking ?? "—"],
                  ["Mobile Usage",    popup.mobileUsage ?? "—"],
                  ["Drowsiness",      popup.drowsiness ?? "—"],
                  ["Route Deviation", popup.routeDeviation ?? "—"],
                ] as [string, string][]).map(([label, value]) => (
                  <View key={label} style={styles.popupRow}>
                    <Text style={styles.popupLabel}>{label}:</Text>
                    <Text style={[styles.popupValue,
                      (value === "Yes" || value === "Fatigue") && { color: "#FF3B30" }
                    ]}>{value ?? "—"}</Text>
                  </View>
                ))}
                {/* Address — stacked layout */}
                {popup && (
                  <View style={styles.popupAddressRow}>
                    <Text style={styles.popupLabel}>Address:</Text>
                    <Text style={styles.popupAddressValue} numberOfLines={4}>
                      {popup.address || popup.location || "—"}
                    </Text>
                  </View>
                )}
              </>
            ) : (
              <Text style={[styles.popupStatus, { textAlign: "center", marginVertical: 16 }]}>
                Loading vehicle data…
              </Text>
            )}
            <TouchableOpacity style={styles.popupClose} onPress={() => setShowPopup(false)}>
              <Text style={{ color: COLORS.accent, fontWeight: "700" }}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <ConfirmDialog
        visible={logoutDialog}
        title="Logout"
        message="Are you sure you want to logout?"
        confirmText="Logout"
        cancelText="Cancel"
        confirmColor={COLORS.red}
        icon="log-out-outline"
        onCancel={() => setLogoutDialog(false)}
        onConfirm={() => { setLogoutDialog(false); logout(); }}
      />

      <AlertNotifications
        toasts={toasts}
        bellHistory={bellHistory}
        unreadCount={unreadCount}
        onDismissToast={dismissToast}
        onMarkAllRead={markAllRead}
        onClearAll={clearAll}
        topOffset={210}
        hideBell
        panelOpen={notifPanelOpen}
        onPanelClose={() => setNotifPanelOpen(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root:            { flex: 1, backgroundColor: "#0A1428" },
  header:          { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10, backgroundColor: "rgba(8,16,32,0.82)", borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.12)" },
  headerLeft:      { flexDirection: "row", alignItems: "center", gap: 8 },
  headerTitle:     { fontSize: 18, fontWeight: "800", color: "#fff" },
  headerRight:     { flexDirection: "row", alignItems: "center", gap: 10 },
  usernameText:    { fontSize: 13, color: "rgba(255,255,255,0.6)", fontWeight: "600" },
  logoutBtn:       { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,59,48,0.15)", borderWidth: 1, borderColor: "rgba(255,59,48,0.4)", alignItems: "center", justifyContent: "center" },
  bellBtn:          { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },
  bellBadge:        { position: "absolute", top: -4, right: -4, backgroundColor: "#EF4444", borderRadius: 9, minWidth: 18, height: 18, alignItems: "center", justifyContent: "center", paddingHorizontal: 3, borderWidth: 2, borderColor: "#0A1428" },
  bellBadgeTxt:     { fontSize: 9, fontWeight: "800", color: "#fff", lineHeight: 13 },
  deviationBadge:  { backgroundColor: "#FF3B30", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  deviationText:   { color: "#fff", fontSize: 10, fontWeight: "800" },
  infoBar:         { flexDirection: "row", backgroundColor: "rgba(8,16,32,0.80)", paddingVertical: 8, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.1)" },
  infoCol:         { flex: 1, alignItems: "center" },
  infoLabel:       { fontSize: 9, fontWeight: "700", color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: 0.5 },
  infoValue:       { fontSize: 12, fontWeight: "800", color: "#fff", marginTop: 2 },
  infoDivider:     { width: 1, backgroundColor: "rgba(255,255,255,0.12)", marginHorizontal: 4 },
  progressBg:      { height: 18, backgroundColor: "rgba(8,16,32,0.8)", justifyContent: "center" },
  progressFill:    { position: "absolute", left: 0, top: 0, bottom: 0, backgroundColor: "#0EA5E9", opacity: 0.5 },
  progressLabel:   { fontSize: 10, color: "#fff", fontWeight: "700", textAlign: "center" },
  map:             { flex: 1 },
  noTripBox:       { position: "absolute", top: "45%", alignSelf: "center", alignItems: "center", zIndex: 10 },
  noTripText:      { color: "rgba(255,255,255,0.5)", marginTop: 8, fontSize: 14 },
  routeBar:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "rgba(8,16,32,0.82)", paddingHorizontal: 14, paddingVertical: 9, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.1)", gap: 8 },
  routeItem:       { flex: 1 },
  routeLabel:      { fontSize: 10, fontWeight: "700", color: "rgba(255,255,255,0.45)", textTransform: "uppercase" },
  routePlace:      { fontSize: 13, fontWeight: "700", color: "#fff", marginTop: 2 },
  // Header avatar
  avatarImg:       { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: "#38BDF8" },
  avatarFallback:  { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(56,189,248,0.2)", borderWidth: 2, borderColor: "#38BDF8", alignItems: "center", justifyContent: "center" },
  // Floating driver overlay
  driverOverlay:   { position: "absolute", top: 10, right: 10, zIndex: 20, flexDirection: "row", alignItems: "center", backgroundColor: "rgba(10,20,40,0.88)", borderRadius: 14, padding: 10, gap: 10, borderWidth: 1, borderColor: "rgba(56,189,248,0.3)", shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 8, maxWidth: 180 },
  overlayImg:      { width: 42, height: 42, borderRadius: 21, borderWidth: 2, borderColor: "#38BDF8" },
  overlayImgFallback: { width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(56,189,248,0.2)", borderWidth: 2, borderColor: "#38BDF8", alignItems: "center", justifyContent: "center" },
  overlayInfo:     { flex: 1 },
  overlayName:     { fontSize: 13, fontWeight: "800", color: "#fff", marginBottom: 2 },
  overlayVehicle:  { fontSize: 11, fontWeight: "700", color: "#38BDF8", marginBottom: 4 },
  overlayStatus:   { flexDirection: "row", alignItems: "center", gap: 4 },
  overlayDot:      { width: 7, height: 7, borderRadius: 4 },
  overlayStatusTxt:{ fontSize: 11, fontWeight: "600", color: "rgba(255,255,255,0.75)" },
  // Popup
  popupOverlay:    { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", alignItems: "center" },
  popupBox:        { backgroundColor: "#0D1A2C", borderRadius: 16, padding: 18, width: "85%", borderWidth: 1, borderColor: "rgba(255,255,255,0.14)" },
  popupTitle:      { fontSize: 18, fontWeight: "800", color: "#fff", marginBottom: 2 },
  popupStatus:     { fontSize: 13, color: "#38BDF8", fontWeight: "600", marginBottom: 12 },
  popupRow:        { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(255,255,255,0.08)" },
  popupLabel:      { fontSize: 13, color: "rgba(255,255,255,0.55)", fontWeight: "600" },
  popupValue:      { fontSize: 13, color: "#fff", fontWeight: "700" },
  popupAddressRow: { flexDirection: "column", paddingVertical: 5, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(255,255,255,0.08)" },
  popupAddressValue: { fontSize: 12, color: "#fff", fontWeight: "600", marginTop: 2, lineHeight: 17 },
  popupClose:      { alignItems: "center", marginTop: 14 },
});

export default DriverMapScreen;
