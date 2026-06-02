import { useCallback, useRef, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  StatusBar, Modal, Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { WebView } from "react-native-webview";
import { useAuth } from "../../hooks/useAuth";
import { fetchDashboardSummary, fetchLiveVehicles } from "../../services/dashboardService";
import { fetchNotifications } from "../../services/notificationService";
import { Toast, useToast } from "../../components/Toast";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import type { LiveVehicle } from "../../types/Dashboard";

const { width: SW } = Dimensions.get("window");

const C = {
  bg:     "#0A1F6E",
  card:   "#FFFFFF",
  blue:   "#1A3CC8",
  white:  "#FFFFFF",
  text:   "#0D1B3E",
  muted:  "#6B7280",
  green:  "#22C55E",
  orange: "#F59E0B",
  red:    "#EF4444",
  indigo: "#3B82F6",
};

// ── Stat Card — count only, no View > ────────────────────────────────────────
const StatCard = ({ icon, label, count, accent }: {
  icon: any; label: string; count: number; accent: string;
}) => (
  <View style={sc.card}>
    <View style={[sc.accentBar, { backgroundColor: accent }]} />
    <View style={[sc.iconBox, { backgroundColor: accent + "18" }]}>
      <Ionicons name={icon} size={22} color={accent} />
    </View>
    <View style={sc.cardBody}>
      <Text style={sc.label}>{label}</Text>
      <Text style={[sc.count, { color: accent }]}>{count}</Text>
    </View>
  </View>
);

// ── Alert severity ────────────────────────────────────────────────────────────
const SEVERITY: Record<string, { color: string; bg: string; label: string; barColor: string }> = {
  OVERSPEED:       { color: "#EF4444", bg: "#FEE2E2", label: "HIGH",   barColor: "#EF4444" },
  SMOKING:         { color: "#EF4444", bg: "#FEE2E2", label: "HIGH",   barColor: "#EF4444" },
  MOBILE_USAGE:    { color: "#F59E0B", bg: "#FEF3C7", label: "MEDIUM", barColor: "#F59E0B" },
  ROUTE_DEVIATION: { color: "#F59E0B", bg: "#FEF3C7", label: "MEDIUM", barColor: "#F59E0B" },
  DROWSINESS:      { color: "#6B7280", bg: "#F3F4F6", label: "INFO",   barColor: "#3B82F6" },
};

const ALERT_ICON: Record<string, any> = {
  SMOKING:         "flame-outline",
  MOBILE_USAGE:    "call-outline",
  DROWSINESS:      "moon-outline",
  OVERSPEED:       "speedometer-outline",
  ROUTE_DEVIATION: "navigate-outline",
};

// ── Live Map HTML with auto-refresh support ───────────────────────────────────
const buildMapHtml = (vehicles: LiveVehicle[]) => {
  const vJson = JSON.stringify(vehicles.map(v => ({
    lat: v.lat, lng: v.lng,
    id: v.vehicleId,
    regNo: v.vehicleId,
    status: v.tripStatus || "Idle",
    driver: v.driverName || "—",
    speed: v.speed || 0,
    overspeed: v.overspeed || "No",
    smoking: v.smoking || "No",
    mobileUsage: v.mobileUsage || "No",
    drowsiness: v.drowsiness || "Normal",
    routeDeviation: v.routeDeviation || "No",
  })));
  return `<!DOCTYPE html><html><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin=""/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""><\/script>
<style>
*{margin:0;padding:0;box-sizing:border-box}html,body,#map{width:100%;height:100%;overflow:hidden}
.pc{font-family:sans-serif;font-size:12px;min-width:200px;max-width:240px}
.pt{font-weight:800;font-size:13px;color:#0D1B3E;margin-bottom:6px;border-bottom:2px solid #1A3CC8;padding-bottom:4px}
.pr{display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid #f0f0f0}
.pk{color:#6B7280;font-size:11px}.pv{font-weight:700;color:#0D1B3E;font-size:11px}
.pv.yes{color:#EF4444}.pv.no{color:#22C55E}.pv.moving{color:#22C55E}.pv.idle{color:#F59E0B}.pv.parked{color:#EF4444}
<\/style>
</head><body><div id="map"></div>
<script>
var vehicles=${vJson};
var map,markers={};
function statusClass(v){return v?v.toLowerCase():''}
function buildPopup(x){
  var sc=statusClass(x.status);
  return '<div class="pc"><div class="pt">'+x.regNo+'<\/div>'+
    '<div class="pr"><span class="pk">Trip Status<\/span><span class="pv '+sc+'">'+x.status+'<\/span><\/div>'+
    '<div class="pr"><span class="pk">Driver<\/span><span class="pv">'+(x.driver||'—')+'<\/span><\/div>'+
    '<div class="pr"><span class="pk">Speed<\/span><span class="pv">'+x.speed+' km/h<\/span><\/div>'+
    '<div class="pr"><span class="pk">Latitude<\/span><span class="pv">'+x.lat.toFixed(6)+'<\/span><\/div>'+
    '<div class="pr"><span class="pk">Longitude<\/span><span class="pv">'+x.lng.toFixed(6)+'<\/span><\/div>'+
    '<div class="pr"><span class="pk">Overspeed<\/span><span class="pv '+(x.overspeed==='Yes'?'yes':'no')+'">'+x.overspeed+'<\/span><\/div>'+
    '<div class="pr"><span class="pk">Smoking<\/span><span class="pv '+(x.smoking==='Yes'?'yes':'no')+'">'+x.smoking+'<\/span><\/div>'+
    '<div class="pr"><span class="pk">Mobile Usage<\/span><span class="pv '+(x.mobileUsage==='Yes'?'yes':'no')+'">'+x.mobileUsage+'<\/span><\/div>'+
    '<div class="pr"><span class="pk">Drowsiness<\/span><span class="pv '+(x.drowsiness==='Fatigue'?'yes':'no')+'">'+x.drowsiness+'<\/span><\/div>'+
    '<div class="pr"><span class="pk">Route Deviation<\/span><span class="pv '+(x.routeDeviation==='Yes'?'yes':'no')+'">'+x.routeDeviation+'<\/span><\/div>'+
    '<\/div>';
}
function makeIcon(status){
  var col={Moving:'#22C55E',Idle:'#F59E0B',Parked:'#EF4444'}[status]||'#3B82F6';
  return L.divIcon({className:'',html:'<div style="width:34px;height:34px;border-radius:50%;background:'+col+';border:3px solid #fff;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.35);font-size:16px;">🚛<\/div>',iconSize:[34,34],iconAnchor:[17,17]});
}
window.onload=function(){
  var c=vehicles.length>0?[vehicles[0].lat,vehicles[0].lng]:[17.3850,78.4867];
  map=L.map('map',{center:c,zoom:12,zoomControl:true,attributionControl:false});
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,subdomains:['a','b','c']}).addTo(map);
  vehicles.forEach(function(x){
    var m=L.marker([x.lat,x.lng],{icon:makeIcon(x.status)}).bindPopup(buildPopup(x)).addTo(map);
    markers[x.id]=m;
  });
};
window.updateVehicles=function(newData){
  newData.forEach(function(x){
    if(markers[x.id]){
      markers[x.id].setLatLng([x.lat,x.lng]);
      markers[x.id].setIcon(makeIcon(x.status));
      markers[x.id].setPopupContent(buildPopup(x));
    } else {
      var m=L.marker([x.lat,x.lng],{icon:makeIcon(x.status)}).bindPopup(buildPopup(x)).addTo(map);
      markers[x.id]=m;
    }
  });
};
<\/script></body></html>`;
};

// ── Screen ────────────────────────────────────────────────────────────────────
const AdminDashboardScreen = ({ navigation }: { navigation: any }) => {
  const { logout } = useAuth();
  const [summary, setSummary] = useState({
    activeVehicles: 0, idleVehicles: 0, activeDrivers: 0, activeAlerts: 0,
  });
  const [liveVehicles, setLiveVehicles] = useState<LiveVehicle[]>([]);
  const [alerts, setAlerts]             = useState<any[]>([]);
  const [logoutDialog, setLogoutDialog] = useState(false);
  const [enablePrompt, setEnablePrompt] = useState(false);
  const notifEnabled  = useRef(false);
  const webViewRef    = useRef<any>(null);
  const mapInitRef    = useRef(false);
  const { toast, showToast, hideToast } = useToast();

  const loadAll = useCallback(async () => {
    try {
      const [sum, vehicles, notifs] = await Promise.all([
        fetchDashboardSummary(),
        fetchLiveVehicles().catch(() => [] as LiveVehicle[]),
        fetchNotifications(new Set()).catch(() => []),
      ]);

      // Use backend-computed live counts (from vehicle_tracking last 5 min)
      setSummary({
        activeVehicles: (sum as any).activeVehicles ?? 0,
        idleVehicles:   (sum as any).idleVehicles   ?? 0,
        activeDrivers:  (sum as any).activeDrivers  ?? 0,
        activeAlerts:   (sum as any).activeAlerts   ?? 0,
      });

      setLiveVehicles(vehicles);

      // Only live (non-resolved) alerts
      const liveAlerts = notifs.filter((n: any) => !n.read && n.status !== "Resolved");
      setAlerts(liveAlerts.slice(0, 6));

      // Update map markers live without full reload
      if (mapInitRef.current && webViewRef.current && vehicles.length > 0) {
        const vJson = JSON.stringify(vehicles.map(v => ({
          lat: v.lat, lng: v.lng, id: v.vehicleId, regNo: v.vehicleId,
          status: v.tripStatus || "Idle", driver: v.driverName || "—",
          speed: v.speed || 0, overspeed: v.overspeed || "No",
          smoking: v.smoking || "No", mobileUsage: v.mobileUsage || "No",
          drowsiness: v.drowsiness || "Normal", routeDeviation: v.routeDeviation || "No",
        })));
        webViewRef.current.injectJavaScript(`window.updateVehicles(${vJson}); true;`);
      }
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => {
    loadAll();
    const t = setInterval(loadAll, 10000);
    return () => clearInterval(t);
  }, [loadAll]));

  useFocusEffect(useCallback(() => {
    if (!notifEnabled.current) setEnablePrompt(true);
  }, []));

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      <SafeAreaView style={s.safe} edges={["top"]}>
        {/* ── Header ── */}
        <View style={s.header}>
          <Text style={s.title}>OptiFleet Admin Dashboard</Text>
          <TouchableOpacity style={s.logoutBtn} onPress={() => setLogoutDialog(true)}>
            <Ionicons name="log-out-outline" size={20} color="#EF4444" />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

          {/* ── 4 Stat Cards — count only ── */}
          <View style={s.grid}>
            <StatCard icon="car-sport-outline" label="Active Vehicles"
              count={summary.activeVehicles} accent={C.green} />
            <StatCard icon="time-outline" label="Idle Vehicles"
              count={summary.idleVehicles} accent={C.orange} />
            <StatCard icon="person-outline" label="Active Drivers"
              count={summary.activeDrivers} accent={C.indigo} />
            <StatCard icon="shield-outline" label="Active Alerts"
              count={summary.activeAlerts} accent={C.red} />
          </View>

          {/* ── Live Fleet Map ── */}
          <View style={s.card}>
            <View style={s.cardHeader}>
              <Text style={s.cardTitle}>Live Fleet Map</Text>
              <View style={s.liveBadge}>
                <View style={s.liveDot} />
                <Text style={s.liveTxt}>Live</Text>
              </View>
              <TouchableOpacity style={s.expandBtn} onPress={() => navigation.navigate("FullMap")}>
                <Ionicons name="expand-outline" size={16} color={C.blue} />
              </TouchableOpacity>
            </View>
            <View style={s.mapBox}>
              <WebView
                ref={webViewRef}
                source={{ html: buildMapHtml(liveVehicles) }}
                style={{ flex: 1 }}
                javaScriptEnabled domStorageEnabled
                mixedContentMode="always"
                allowUniversalAccessFromFileURLs
                originWhitelist={["*"]}
                scrollEnabled={false}
                onLoadEnd={() => { mapInitRef.current = true; }}
              />
            </View>
          </View>

          {/* ── Trip Management ── */}
          <TouchableOpacity style={s.tripCard} onPress={() => navigation.navigate("TripManagement")} activeOpacity={0.82}>
            <View style={s.tripIconBox}>
              <Ionicons name="location-outline" size={26} color={C.blue} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.tripTitle}>Trip Management</Text>
              <Text style={s.tripSub}>Route logistics & geofence monitoring</Text>
            </View>
            <Text style={s.viewLink}>View {">"}</Text>
          </TouchableOpacity>

          {/* ── Recent Fleet Alerts (live only) ── */}
          <View style={s.card}>
            <View style={s.cardHeader}>
              <Text style={s.cardTitle}>Recent Fleet Alerts</Text>
              <TouchableOpacity onPress={() => navigation.navigate("Notifications" as any)}>
                <Text style={s.viewAllTxt}>View all {">"}</Text>
              </TouchableOpacity>
            </View>

            {alerts.length === 0 ? (
              <View style={s.emptyBox}>
                <Ionicons name="checkmark-circle-outline" size={32} color={C.green} />
                <Text style={s.emptyTxt}>No active alerts</Text>
              </View>
            ) : (
              alerts.map((alert, idx) => {
                const key      = (alert.label || "").toUpperCase();
                const sev      = SEVERITY[key] || SEVERITY["DROWSINESS"];
                const iconName = ALERT_ICON[key] || "alert-circle-outline";
                const isLast   = idx === alerts.length - 1;
                return (
                  <View key={alert.id || idx} style={[s.alertRow, isLast && { borderBottomWidth: 0 }]}>
                    <View style={[s.alertBar, { backgroundColor: sev.barColor }]} />
                    <View style={[s.alertIconBox, { backgroundColor: sev.bg }]}>
                      <Ionicons name={iconName} size={20} color={sev.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.alertTitle}>{alert.label}</Text>
                      <Text style={s.alertSub}>{alert.vehicle} · {alert.driver}</Text>
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 4 }}>
                      <Text style={s.alertTime}>{alert.time}</Text>
                      <View style={[s.sevBadge, { backgroundColor: sev.bg }]}>
                        <Text style={[s.sevTxt, { color: sev.color }]}>{sev.label}</Text>
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </View>

          <View style={{ height: 16 }} />
        </ScrollView>
      </SafeAreaView>

      <ConfirmDialog
        visible={logoutDialog} title="Logout" message="Are you sure you want to logout?"
        confirmText="Logout" cancelText="Cancel" confirmColor={C.red} icon="log-out-outline"
        onCancel={() => setLogoutDialog(false)}
        onConfirm={() => { setLogoutDialog(false); showToast("Logged out.", "info"); setTimeout(logout, 1200); }}
      />
      <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={hideToast} />

      <Modal visible={enablePrompt} transparent animationType="fade" onRequestClose={() => setEnablePrompt(false)}>
        <View style={s.promptOverlay}>
          <View style={s.promptCard}>
            <Text style={{ fontSize: 52, marginBottom: 12 }}>🔔</Text>
            <Text style={s.promptTitle}>Don't miss Fleet updates!</Text>
            <Text style={s.promptSub}>Enable notifications for real-time fleet updates and alerts.</Text>
            <View style={s.promptBtns}>
              <TouchableOpacity style={s.promptGhost} onPress={() => setEnablePrompt(false)}>
                <Text style={s.promptGhostTxt}>Not now</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.promptSolid} onPress={() => { notifEnabled.current = true; setEnablePrompt(false); }}>
                <Text style={s.promptSolidTxt}>Enable</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// ── Stat Card styles ──────────────────────────────────────────────────────────
const sc = StyleSheet.create({
  card:      { width: "47.5%", backgroundColor: C.card, borderRadius: 14, padding: 12, marginBottom: 12, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3, overflow: "hidden" },
  accentBar: { position: "absolute", left: 0, top: 0, bottom: 0, width: 3, borderTopLeftRadius: 14, borderBottomLeftRadius: 14 },
  iconBox:   { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  cardBody:  { flex: 1 },
  label:     { fontSize: 11, color: C.muted, fontWeight: "600" },
  count:     { fontSize: 28, fontWeight: "800", marginTop: 2 },
});

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.bg },
  safe:   { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 18 },
  title:  { fontSize: 18, fontWeight: "800", color: C.white },
  logoutBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  scroll: { paddingHorizontal: 14, paddingBottom: 80 },
  grid:   { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  card:       { backgroundColor: C.card, borderRadius: 18, padding: 16, marginBottom: 14, shadowColor: "#000", shadowOpacity: 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  cardHeader: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  cardTitle:  { fontSize: 15, fontWeight: "800", color: C.text, flex: 1 },
  liveBadge:  { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#DCFCE7", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, marginRight: 8 },
  liveDot:    { width: 7, height: 7, borderRadius: 4, backgroundColor: C.green },
  liveTxt:    { fontSize: 11, fontWeight: "700", color: "#16A34A" },
  expandBtn:  { width: 30, height: 30, borderRadius: 8, backgroundColor: "#EFF6FF", alignItems: "center", justifyContent: "center" },
  mapBox:     { height: 210, borderRadius: 12, overflow: "hidden" },
  tripCard:    { flexDirection: "row", alignItems: "center", backgroundColor: C.card, borderRadius: 18, padding: 16, marginBottom: 14, gap: 14, shadowColor: "#000", shadowOpacity: 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  tripIconBox: { width: 52, height: 52, borderRadius: 14, backgroundColor: "#EFF6FF", alignItems: "center", justifyContent: "center" },
  tripTitle:   { fontSize: 15, fontWeight: "800", color: C.text },
  tripSub:     { fontSize: 12, color: C.muted, marginTop: 2 },
  viewLink:    { fontSize: 13, fontWeight: "700", color: C.blue },
  viewAllTxt:  { fontSize: 12, fontWeight: "700", color: C.blue },
  alertRow:    { flexDirection: "row", alignItems: "center", paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#F0F0F0", gap: 10 },
  alertBar:    { width: 3, height: 38, borderRadius: 2 },
  alertIconBox:{ width: 42, height: 42, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  alertTitle:  { fontSize: 13, fontWeight: "700", color: C.text },
  alertSub:    { fontSize: 11, color: C.muted, marginTop: 1 },
  alertTime:   { fontSize: 11, color: C.muted },
  sevBadge:    { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  sevTxt:      { fontSize: 10, fontWeight: "800" },
  emptyBox:    { alignItems: "center", paddingVertical: 20, gap: 8 },
  emptyTxt:    { fontSize: 13, color: C.muted },
  promptOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", padding: 24 },
  promptCard:    { backgroundColor: "#fff", borderRadius: 24, padding: 28, alignItems: "center", width: "100%", maxWidth: 340 },
  promptTitle:   { fontSize: 20, fontWeight: "800", color: C.text, textAlign: "center", marginBottom: 8 },
  promptSub:     { fontSize: 14, color: C.muted, textAlign: "center", lineHeight: 20, marginBottom: 28 },
  promptBtns:    { flexDirection: "row", gap: 12, width: "100%" },
  promptGhost:   { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: "#F3F4F6", alignItems: "center" },
  promptGhostTxt:{ fontSize: 15, fontWeight: "700", color: "#374151" },
  promptSolid:   { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: C.bg, alignItems: "center" },
  promptSolidTxt:{ fontSize: 15, fontWeight: "700", color: "#fff" },
});

export default AdminDashboardScreen;
