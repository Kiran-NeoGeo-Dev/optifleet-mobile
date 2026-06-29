import { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  StatusBar, Modal, Dimensions, Animated,
} from "react-native";
import RightDrawer from "../../components/RightDrawer";

import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";
import { WebView } from "react-native-webview";
import { useAuth } from "../../hooks/useAuth";
import { fetchDashboardSummary, fetchLiveVehicles } from "../../services/dashboardService";
import { fetchNotifications } from "../../services/notificationService";
import { Toast, useToast } from "../../components/Toast";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import LottieView from "lottie-react-native";
import * as Speech from "expo-speech";
import type { LiveVehicle } from "../../types/Dashboard";

const C = {
  bg:     "#F0F4FF",
  card:   "#FFFFFF",
  blue:   "#1A3CC8",
  blueDk: "#0A1F44",
  blueMd: "#0D3B8E",
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
      <Ionicons name={icon} size={18} color={accent} />
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
    address: v.address || "",
    coordinates: v.coordinates || "",
    lastUpdateTime: v.lastUpdateTime || "",
    lastUpdateDate: v.lastUpdateDate || "",
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
.pa{font-weight:600;color:#0D1B3E;font-size:11px;display:block;margin-top:2px;line-height:15px;word-break:break-word}
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
    (x.address?'<div style="padding:3px 0;border-bottom:1px solid #f0f0f0"><span class="pk">Address<\/span><span class="pa">'+x.address+'<\/span><\/div>':'')+
    (x.coordinates?'<div class="pr"><span class="pk">Coordinates<\/span><span class="pv">'+x.coordinates+'<\/span><\/div>':'')+
    (x.lastUpdateTime||x.lastUpdateDate?'<div class="pr"><span class="pk">Last Update<\/span><span class="pv">'+(x.lastUpdateTime||'')+(x.lastUpdateDate?' · '+x.lastUpdateDate:'')+'<\/span><\/div>':'')+
    '<div class="pr"><span class="pk">Overspeed<\/span><span class="pv '+(x.overspeed==='Yes'?'yes':'no')+'">'+x.overspeed+'<\/span><\/div>'+
    '<div class="pr"><span class="pk">Smoking<\/span><span class="pv '+(x.smoking==='Yes'?'yes':'no')+'">'+x.smoking+'<\/span><\/div>'+
    '<div class="pr"><span class="pk">Mobile Usage<\/span><span class="pv '+(x.mobileUsage==='Yes'?'yes':'no')+'">'+x.mobileUsage+'<\/span><\/div>'+
    '<div class="pr"><span class="pk">Drowsiness<\/span><span class="pv '+(x.drowsiness==='Fatigue'?'yes':'no')+'">'+x.drowsiness+'<\/span><\/div>'+
    '<div class="pr"><span class="pk">Route Deviation<\/span><span class="pv '+(x.routeDeviation==='Yes'?'yes':'no')+'">'+x.routeDeviation+'<\/span><\/div>'+
    '<div class="pr"><span class="pk">Harsh Braking<\/span><span class="pv '+(x.harshBraking==='Yes'?'yes':'no')+'">'+x.harshBraking+'<\/span><\/div>'+
    '<div class="pr"><span class="pk">Harsh Acceleration<\/span><span class="pv '+(x.harshAcceleration==='Yes'?'yes':'no')+'">'+x.harshAcceleration+'<\/span><\/div>'+
    '<div class="pr"><span class="pk">Rash Turning<\/span><span class="pv '+(x.rashTurning==='Yes'?'yes':'no')+'">'+x.rashTurning+'<\/span><\/div>'+
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
  const [drawerOpen,   setDrawerOpen]   = useState(false);
  const [enablePrompt, setEnablePrompt] = useState(false);
  const notifEnabled  = useRef(false);
  const lottieRef    = useRef<LottieView>(null);
  const webViewRef    = useRef<any>(null);
  const mapInitRef    = useRef(false);
  const { toast, showToast, hideToast } = useToast();
  const sheetAnim = useRef(new Animated.Value(0)).current;
  const SH = Dimensions.get("window").height;

  useEffect(() => {
    if (enablePrompt) {
      sheetAnim.setValue(SH);
      Animated.spring(sheetAnim, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
      setTimeout(() => lottieRef.current?.play(), 100);
    }
  }, [enablePrompt]);

  const closeSheet = () => {
    Animated.timing(sheetAnim, { toValue: SH, duration: 260, useNativeDriver: true }).start(() => setEnablePrompt(false));
  };

  const handleEnable = () => {
    Speech.speak("Notifications enabled", { rate: 1.2, pitch: 1.3 });
    notifEnabled.current = true;
    closeSheet();
  };

  const loadAll = useCallback(async () => {
    try {
      const [sum, vehicles, notifs] = await Promise.all([
        fetchDashboardSummary(),
        fetchLiveVehicles().catch(() => [] as LiveVehicle[]),
        fetchNotifications(new Set()).catch(() => []),
      ]);

      // Use backend-computed live counts from ThingsBoard state + telemetry freshness.
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
          address: v.address || "", coordinates: v.coordinates || "",
          lastUpdateTime: v.lastUpdateTime || "", lastUpdateDate: v.lastUpdateDate || "",
        })));
      }
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => {
    loadAll();
    const t = setInterval(loadAll, 5_000);
    return () => clearInterval(t);
  }, [loadAll]));

  useFocusEffect(useCallback(() => {
    if (!notifEnabled.current) setEnablePrompt(true);
  }, []));

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.blueDk} />
      {/* ── Single curved header ── */}
      <View style={s.headerBg}>
        <LinearGradient
          colors={[C.blueDk, C.blueMd, C.blue]}
          locations={[0, 0.45, 1]}
          start={{ x: 0.15, y: 0 }} end={{ x: 0.85, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <SafeAreaView style={s.safe} edges={["top"]}>
        {/* ── Header ── */}
        <View style={s.header}>
          <View style={s.headerTopRow}>
            {/* Hamburger — top LEFT */}
            <TouchableOpacity style={s.menuBtn} onPress={() => setDrawerOpen(true)} activeOpacity={0.8}>
              <Ionicons name="menu" size={28} color={C.white} />
            </TouchableOpacity>
            {/* Notification bell — top RIGHT (unchanged) */}
            <TouchableOpacity style={s.notifBtn} onPress={() => navigation.navigate("Notifications")}>
              <LottieView
                source={require("../../../assets/animations/notification1.json")}
                autoPlay loop
                style={s.notifLottie}
              />
              {alerts.length > 0 && (
                <View style={s.badge}>
                  <Text style={s.badgeTxt}>{alerts.length > 99 ? "99+" : String(alerts.length)}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
          <Text style={s.title}>OptiFleet Admin Dashboard</Text>
          <Text style={s.subtitle}>Fleet Management & Analytics Platform</Text>
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
              <LottieView
                source={require("../../../assets/animations/vehicle_animation.json")}
                autoPlay
                loop
                style={{ width: 48, height: 48, marginRight: 6 }}
              />
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
              <LottieView
                source={require("../../../assets/animations/notification2.json")}
                autoPlay
                loop
                style={[s.tripLottie, { width: 52, height: 52 }]}
              />
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
              <LottieView
                source={require("../../../assets/animations/announcement.json")}
                autoPlay
                loop
                style={{ width: 48, height: 48, marginRight: 6 }}
              />
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

      <RightDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onMyProfile={() => navigation.navigate("AdminProfile")}
      />

      <ConfirmDialog
        visible={logoutDialog} title="Logout" message="Are you sure you want to logout from OptiFleet?"
        confirmText="Logout" cancelText="Cancel" confirmColor={C.red} icon="log-out-outline"
        onCancel={() => setLogoutDialog(false)}
        onConfirm={() => { setLogoutDialog(false); setTimeout(logout, 300); }}
      />
      <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={hideToast} />

      <Modal visible={enablePrompt} transparent animationType="none" onRequestClose={closeSheet}>
        <View style={s.promptOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={closeSheet} />
          <Animated.View style={[s.promptSheet, { transform: [{ translateY: sheetAnim }] }]}>
            <View style={s.sheetBellBg}>
              <LottieView
                ref={lottieRef}
                source={require("../../../assets/animations/notification.json")}
                autoPlay
                loop
                style={s.lottie}
              />
            </View>
            <Text style={s.promptTitle}>Don't miss Fleet updates!</Text>
            <Text style={s.promptSub}>Enable notifications for real-time fleet updates and alerts.</Text>
            <View style={s.promptBtns}>
              <TouchableOpacity style={s.promptGhost} onPress={closeSheet}>
                <Text style={s.promptGhostTxt}>Not now</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.promptSolid} onPress={handleEnable}>
                <Text style={s.promptSolidTxt}>Enable</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
};

// ── Stat Card styles ──────────────────────────────────────────────────────────
const sc = StyleSheet.create({
  card:      { width: "47.5%", backgroundColor: C.card, borderRadius: 12, padding: 10, marginBottom: 10, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3, overflow: "hidden" },
  accentBar: { position: "absolute", left: 0, top: 0, bottom: 0, width: 3, borderTopLeftRadius: 12, borderBottomLeftRadius: 12 },
  iconBox:   { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  cardBody:  { flex: 1 },
  label:     { fontSize: 10, color: C.muted, fontWeight: "600" },
  count:     { fontSize: 22, fontWeight: "800", marginTop: 2 },
});

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.bg },
  headerBg: { position: "absolute", top: 0, left: -40, right: -40, height: 280, overflow: "hidden", borderBottomLeftRadius: 180, borderBottomRightRadius: 180 },
  safe:   { flex: 1 },
  header:       { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 36 },
  headerTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
  avatarBtn:    { width: 52, height: 52, borderRadius: 26, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  menuBtn:      { width: 52, height: 52, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.18)", borderWidth: 1, borderColor: "rgba(255,255,255,0.22)", alignItems: "center", justifyContent: "center" },
  notifBtn:     { width: 52, height: 52, borderRadius: 26, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  notifLottie:  { width: 44, height: 44 },
  badge:        { position: "absolute", top: 4, right: 4, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: "#EF4444", alignItems: "center", justifyContent: "center", paddingHorizontal: 3, borderWidth: 1.5, borderColor: C.white },
  badgeTxt:     { fontSize: 9, fontWeight: "800", color: "#fff" },
  title:        { fontSize: 26, fontWeight: "800", color: C.white, letterSpacing: 0.3, marginBottom: 6 },
  subtitle:     { fontSize: 13, color: "rgba(255,255,255,0.75)", fontWeight: "500", letterSpacing: 0.2 },
  logoutBtn:    { width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
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
  tripLottie:  { width: 44, height: 44 },
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
  promptOverlay:  { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  promptSheet:    { backgroundColor: "#fff", borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingBottom: 36, paddingTop: 0, alignItems: "center" },
  sheetBellBg:    { width: "112%", alignItems: "center", justifyContent: "center", backgroundColor: "#1A3CC8", borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: 8, paddingTop: 8, marginBottom: 16 },
  lottie:         { width: 170, height: 170 },
  promptTitle:   { fontSize: 20, fontWeight: "800", color: C.text, textAlign: "center", marginBottom: 8 },
  promptSub:     { fontSize: 14, color: "#1E3A5F", textAlign: "center", lineHeight: 20, marginBottom: 24 },
  promptBtns:    { flexDirection: "row", gap: 12, width: "100%" },
  promptGhost:   { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: "#FEE2E2", alignItems: "center" },
  promptGhostTxt:{ fontSize: 15, fontWeight: "700", color: "#EF4444" },
  promptSolid:   { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: "#22C55E", alignItems: "center" },
  promptSolidTxt:{ fontSize: 15, fontWeight: "700", color: "#fff" },
});

export default AdminDashboardScreen;
