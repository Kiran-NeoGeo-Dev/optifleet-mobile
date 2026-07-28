import { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  StatusBar, Modal, Animated, Dimensions,
} from "react-native";
import RightDrawer from "../../components/RightDrawer";
import { setupNotificationChannel, requestNotificationPermissions, sendLocalNotification } from "../../services/pushNotificationService";

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
  blue:   "#1565C0",
  blueDk: "#0A1F44",
  blueMd: "#0D3B8E",
  white:  "#FFFFFF",
  bg:     "#F0F4FF",
  card:   "#FFFFFF",
  red:    "#EF4444",
  text:   "#0D1B3E",
  muted:  "#6B7280",
};

// ── Stat Card — with arrow navigation ────────────────────────────────────────
const StatCard = ({ icon, label, count, accent, onPress }: {
  icon: any; label: string; count: number; accent: string; onPress?: () => void;
}) => (
  <TouchableOpacity style={[sc.card, { borderLeftColor: accent, borderLeftWidth: 4 }]} onPress={onPress} activeOpacity={onPress ? 0.75 : 1}>
    <View style={[sc.iconBox, { backgroundColor: accent + "18" }]}>
      <Ionicons name={icon} size={20} color={accent} />
    </View>
    <Text style={sc.label}>{label}</Text>
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <Text style={[sc.count, { color: accent }]}>{count}</Text>
      <Ionicons name="chevron-forward" size={18} color={accent} />
    </View>
  </TouchableOpacity>
);

const ALERT_ICON: Record<string, string> = {
  SMOKING: "🚭", MOBILE_USAGE: "📱", DROWSINESS: "😴", OVERSPEED: "🚨", ROUTE_DEVIATION: "📍",
  HARSH_BRAKING: "🛑", HARSH_ACCELERATION: "⚡", RASH_TURNING: "↪️",
};
const SEVERITY: Record<string, { color: string; bg: string; label: string }> = {
  OVERSPEED:         { color: "#EF4444", bg: "#FEE2E2", label: "HIGH"   },
  SMOKING:           { color: "#EF4444", bg: "#FEE2E2", label: "HIGH"   },
  MOBILE_USAGE:      { color: "#F59E0B", bg: "#FEF3C7", label: "MEDIUM" },
  ROUTE_DEVIATION:   { color: "#F59E0B", bg: "#FEF3C7", label: "MEDIUM" },
  DROWSINESS:        { color: "#3B82F6", bg: "#DBEAFE", label: "INFO"   },
  HARSH_BRAKING:     { color: "#DC2626", bg: "#FEE2E2", label: "HIGH"   },
  HARSH_ACCELERATION:{ color: "#D97706", bg: "#FEF3C7", label: "MEDIUM" },
  RASH_TURNING:      { color: "#DB2777", bg: "#FEE2E2", label: "MEDIUM" },
};

// ── Live Map HTML ─────────────────────────────────────────────────────────────
const buildMapHtml = (vehicles: LiveVehicle[]) => {
  const vJson = JSON.stringify(vehicles.map(v => ({
    lat: v.lat, lng: v.lng,
    id: v.vehicleId, regNo: v.vehicleId,
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
.pt{font-weight:800;font-size:13px;color:#0D1B3E;margin-bottom:6px;border-bottom:2px solid #1565C0;padding-bottom:4px}
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
    '<div class="pr"><span class="pk">Overspeed<\/span><span class="pv '+(x.overspeed==="Yes"?"yes":"no")+'">'+x.overspeed+'<\/span><\/div>'+
    '<div class="pr"><span class="pk">Smoking<\/span><span class="pv '+(x.smoking==="Yes"?"yes":"no")+'">'+x.smoking+'<\/span><\/div>'+
    '<div class="pr"><span class="pk">Mobile Usage<\/span><span class="pv '+(x.mobileUsage==="Yes"?"yes":"no")+'">'+x.mobileUsage+'<\/span><\/div>'+
    '<div class="pr"><span class="pk">Drowsiness<\/span><span class="pv '+(x.drowsiness==="Fatigue"?"yes":"no")+'">'+x.drowsiness+'<\/span><\/div>'+
    '<div class="pr"><span class="pk">Route Deviation<\/span><span class="pv '+(x.routeDeviation==="Yes"?"yes":"no")+'">'+x.routeDeviation+'<\/span><\/div>'+
    '<div class="pr"><span class="pk">Harsh Braking<\/span><span class="pv '+(x.harshBraking==="Yes"?"yes":"no")+'">'+x.harshBraking+'<\/span><\/div>'+
    '<div class="pr"><span class="pk">Harsh Acceleration<\/span><span class="pv '+(x.harshAcceleration==="Yes"?"yes":"no")+'">'+x.harshAcceleration+'<\/span><\/div>'+
    '<div class="pr"><span class="pk">Rash Turning<\/span><span class="pv '+(x.rashTurning==="Yes"?"yes":"no")+'">'+x.rashTurning+'<\/span><\/div>'+
    '<\/div>';
}
function makeIcon(status){
  var col={Moving:'#22C55E',Idle:'#F59E0B',Parked:'#EF4444'}[status]||'#3B82F6';
  return L.divIcon({className:'',html:'<div style="width:32px;height:32px;border-radius:50%;background:'+col+';border:2.5px solid #fff;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.4);font-size:16px;">🚛<\/div>',iconSize:[32,32],iconAnchor:[16,16]});
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

const UserDashboardScreen = ({ navigation }: { navigation: any }) => {
  const { logout } = useAuth();
  const [summary, setSummary] = useState({
    activeVehicles: 0, idleVehicles: 0, activeDrivers: 0, activeAlerts: 0,
  });
  const [liveVehicles, setLiveVehicles] = useState<LiveVehicle[]>([]);
  const [alerts, setAlerts]             = useState<any[]>([]);
  const [logoutDialog, setLogoutDialog] = useState(false);
  const [drawerOpen,   setDrawerOpen]   = useState(false);
  const [enablePrompt, setEnablePrompt] = useState(false);
  const notifEnabled = useRef(false);
  const readKeysRef  = useRef<Set<string>>(new Set());
  const sentKeysRef  = useRef<Set<string>>(new Set());
  const lottieRef   = useRef<LottieView>(null);
  const webViewRef   = useRef<any>(null);
  const mapInitRef   = useRef(false);
  const { toast, showToast, hideToast } = useToast();
  const sheetAnim = useRef(new Animated.Value(0)).current;
  const SH = Dimensions.get("window").height;

  useEffect(() => {
    setupNotificationChannel();
    requestNotificationPermissions();
  }, []);

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
        fetchDashboardSummary().catch(() => ({ activeVehicles: 0, idleVehicles: 0, activeDrivers: 0, activeAlerts: 0 })),
        fetchLiveVehicles().catch(() => [] as LiveVehicle[]),
        fetchNotifications(readKeysRef.current).catch(() => []),
      ]);

      const liveAlerts = notifs.filter((n: any) => n.status !== "Resolved");

      // Fire Android tray notification for each new alert (deduplicate by stable vehicleId+alertType)
      liveAlerts.forEach((n: any) => {
        const stableKey = `${n.vehicle ?? n.vehicleId ?? ""}_${n.label ?? n.alertType ?? ""}`;
        if (stableKey && !sentKeysRef.current.has(stableKey)) {
          sentKeysRef.current.add(stableKey);
          sendLocalNotification(
            `Fleet Alert: ${n.label ?? n.alertType ?? "Alert"}`,
            `Vehicle: ${n.vehicle ?? n.vehicleId ?? ""} · Driver: ${n.driver ?? n.driverName ?? ""}`,
            { alertId: stableKey }
          );
        }
      });

      // Preserve read state across polls
      liveAlerts.forEach((n: any) => { if (n.read) readKeysRef.current.add(n.id); });

      // Clear resolved alerts from sentKeysRef so they can re-fire if they recur
      const activeStableKeys = new Set(liveAlerts.map((n: any) => `${n.vehicle ?? n.vehicleId ?? ""}_${n.label ?? n.alertType ?? ""}`));
      sentKeysRef.current.forEach(k => { if (!activeStableKeys.has(k)) sentKeysRef.current.delete(k); });
      const alertsWithReadState = liveAlerts.map((n: any) => ({
        ...n,
        read: readKeysRef.current.has(n.id),
      }));

      setSummary({
        activeVehicles: (sum as any).activeVehicles ?? 0,
        idleVehicles:   (sum as any).idleVehicles   ?? 0,
        activeDrivers:  (sum as any).activeDrivers  ?? 0,
        activeAlerts:   liveAlerts.length,
      });

      setLiveVehicles(vehicles);
      setAlerts(alertsWithReadState.slice(0, 6));

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
        webViewRef.current.injectJavaScript(`window.updateVehicles(${vJson}); true;`);
      }
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => {
    loadAll();
    const t = setInterval(loadAll, 5_000);
    return () => clearInterval(t);
  }, [loadAll]));

  useFocusEffect(useCallback(() => {
    if (!notifEnabled.current) {
      const t = setTimeout(() => setEnablePrompt(true), 500);
      return () => clearTimeout(t);
    }
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
      <SafeAreaView style={s.safe} edges={["top"]} pointerEvents="box-none">
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
          <Text style={s.title}>OptiFleet User Dashboard</Text>
          <Text style={s.subtitle}>Smart Fleet Management & Analytics Platform</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
          {/* ── 4 Stat Cards — with navigation ── */}
          <View style={s.cardsGrid}>
            <StatCard icon="car-sport-outline" label="Active Vehicles" count={summary.activeVehicles} accent="#22C55E"
              onPress={() => navigation.navigate("FleetVehicles")} />
            <StatCard icon="time-outline"       label="Idle Vehicles"   count={summary.idleVehicles}   accent="#F59E0B"
              onPress={() => navigation.navigate("FleetVehicles")} />
            <StatCard icon="person-outline"     label="Active Drivers"  count={summary.activeDrivers}  accent="#3B82F6"
              onPress={() => navigation.navigate("FleetDrivers")} />
            <StatCard icon="shield-outline"     label="Active Alerts"   count={summary.activeAlerts}   accent="#EF4444"
              onPress={() => navigation.navigate("Notifications")} />
          </View>

          {/* ── Live Fleet Map ── */}
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <LottieView
                source={require("../../../assets/animations/vehicle_animation.json")}
                autoPlay
                loop
                style={{ width: 36, height: 36, marginRight: 4 }}
              />
              <Text style={s.sectionTitle}>Live Fleet Map</Text>
              <View style={s.liveBadge}>
                <View style={s.liveDot} />
                <Text style={s.liveTxt}>Live</Text>
              </View>
              <TouchableOpacity style={s.expandBtn} onPress={() => navigation.navigate("FullMap")} activeOpacity={0.8}>
                <Ionicons name="expand-outline" size={16} color={C.blue} />
              </TouchableOpacity>
            </View>
            <View style={s.mapBox}>
              <WebView
                ref={webViewRef}
                source={{ html: buildMapHtml(liveVehicles) }}
                style={s.map}
                javaScriptEnabled domStorageEnabled mixedContentMode="always"
                allowUniversalAccessFromFileURLs originWhitelist={["*"]}
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
                autoPlay loop
                style={s.tripLottie}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.tripTitle}>Trip Management</Text>
              <Text style={s.tripSub}>Route logistics & geofence monitoring</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={C.blue} />
          </TouchableOpacity>

          {/* ── Recent Fleet Alerts (live only) ── */}
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <LottieView
                source={require("../../../assets/animations/announcement.json")}
                autoPlay
                loop
                style={{ width: 36, height: 36, marginRight: 4 }}
              />
              <Text style={s.sectionTitle}>Recent Fleet Alerts</Text>
              <TouchableOpacity onPress={() => navigation.navigate("Notifications" as any)}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: C.blue }}>View all</Text>
              </TouchableOpacity>
            </View>
            {alerts.length === 0 ? (
              <View style={s.emptyAlerts}>
                <Ionicons name="checkmark-circle-outline" size={32} color="#22C55E" />
                <Text style={s.emptyAlertsTxt}>No active alerts</Text>
              </View>
            ) : (
              alerts.map((alert, idx) => {
                const key  = alert.label?.toUpperCase?.() || "";
                const sev  = SEVERITY[key] || SEVERITY["DROWSINESS"];
                const emoji = ALERT_ICON[key] || "🔔";
                return (
                  <TouchableOpacity key={alert.id || idx} style={s.alertRow}
                    onPress={() => navigation.navigate("Notifications" as any)} activeOpacity={0.75}>
                    <View style={[s.alertBar, { backgroundColor: sev.color }]} />
                    <View style={[s.alertIconBox, { backgroundColor: sev.bg }]}>
                      <Text style={{ fontSize: 18 }}>{emoji}</Text>
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
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </ScrollView>
      </SafeAreaView>

      <RightDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onMyProfile={() => navigation.navigate("ClientDetails")}
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

const sc = StyleSheet.create({
  card:    { width: "47.5%", backgroundColor: "#fff", borderRadius: 12, padding: 11, marginBottom: 10, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  iconBox: { width: 32, height: 32, borderRadius: 9, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  label:   { fontSize: 12, color: "#6B7280", fontWeight: "600", marginBottom: 2 },
  count:   { fontSize: 22, fontWeight: "800" },
});

const s = StyleSheet.create({
  root:       { flex: 1, backgroundColor: C.bg },
  headerBg:   { position: "absolute", top: 0, left: -40, right: -40, height: 200, overflow: "hidden", borderBottomLeftRadius: 130, borderBottomRightRadius: 130 },
  safe:       { flex: 1 },
  header:       { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12 },
  headerTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  avatarBtn:    { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  menuBtn:      { width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.18)", borderWidth: 1, borderColor: "rgba(255,255,255,0.22)", alignItems: "center", justifyContent: "center" },
  notifBtn:     { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  notifLottie:  { width: 34, height: 34 },
  badge:        { position: "absolute", top: 2, right: 2, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: "#EF4444", alignItems: "center", justifyContent: "center", paddingHorizontal: 3, borderWidth: 1.5, borderColor: C.white },
  badgeTxt:     { fontSize: 9, fontWeight: "800", color: "#fff" },
  title:        { fontSize: 17, fontWeight: "800", color: C.white, letterSpacing: 0.3, marginBottom: 2 },
  subtitle:     { fontSize: 11, color: "rgba(255,255,255,0.75)", fontWeight: "500", letterSpacing: 0.2 },
  logoutBtn:    { width: 32, height: 32, borderRadius: 9, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  scroll:     { paddingHorizontal: 12, paddingBottom: 80 },
  cardsGrid:  { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginBottom: 4 },
  section:    { backgroundColor: C.card, borderRadius: 14, padding: 12, marginBottom: 10, shadowColor: "#000", shadowOpacity: 0.07, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  sectionHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  sectionTitle:  { fontSize: 14, fontWeight: "800", color: C.text, flex: 1 },
  liveBadge:  { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#DCFCE7", borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  liveDot:    { width: 6, height: 6, borderRadius: 3, backgroundColor: "#22C55E" },
  liveTxt:    { fontSize: 10, fontWeight: "700", color: "#16A34A" },
  expandBtn:  { width: 26, height: 26, borderRadius: 7, backgroundColor: "#EFF6FF", alignItems: "center", justifyContent: "center", marginLeft: 6 },
  mapBox:     { height: Math.round(Dimensions.get("window").height * 0.28), borderRadius: 10, overflow: "hidden" },
  map:        { flex: 1 },
  miniCardsRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  miniCard:   { flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: C.card, borderRadius: 12, padding: 10, gap: 8, shadowColor: "#000", shadowOpacity: 0.07, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  tripCard:   { flexDirection: "row", alignItems: "center", backgroundColor: C.card, borderRadius: 12, padding: 10, marginBottom: 8, gap: 8, shadowColor: "#000", shadowOpacity: 0.07, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  tripIconBox:{ width: 36, height: 36, borderRadius: 10, backgroundColor: "#EFF6FF", alignItems: "center", justifyContent: "center" },
  tripLottie: { width: 30, height: 30 },
  tripTitle:  { fontSize: 13, fontWeight: "800", color: C.text },
  tripSub:    { fontSize: 10, color: C.muted, marginTop: 1 },
  alertRow:   { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#F0F0F0", gap: 8 },
  alertBar:   { width: 3, height: 32, borderRadius: 2 },
  alertIconBox:{ width: 36, height: 36, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  alertTitle: { fontSize: 12, fontWeight: "700", color: C.text },
  alertSub:   { fontSize: 11, color: C.muted, marginTop: 1 },
  alertTime:  { fontSize: 10, color: C.muted },
  sevBadge:   { borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  sevTxt:     { fontSize: 9, fontWeight: "800" },
  emptyAlerts:{ alignItems: "center", paddingVertical: 14, gap: 6 },
  emptyAlertsTxt: { fontSize: 12, color: C.muted },
  promptOverlay:  { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  promptSheet:    { backgroundColor: "#fff", borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingBottom: 36, paddingTop: 0, alignItems: "center" },
  sheetBellBg:    { width: "112%", alignItems: "center", justifyContent: "center", backgroundColor: "#1565C0", borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: 8, paddingTop: 8, marginBottom: 16 },
  lottie:         { width: 130, height: 130 },
  promptTitle:   { fontSize: 18, fontWeight: "800", color: C.text, textAlign: "center", marginBottom: 6 },
  promptSub:     { fontSize: 13, color: "#1E3A5F", textAlign: "center", lineHeight: 19, marginBottom: 20 },
  promptBtns:    { flexDirection: "row", gap: 10, width: "100%" },
  promptGhost:   { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: "#FEE2E2", alignItems: "center" },
  promptGhostTxt:{ fontSize: 14, fontWeight: "700", color: "#EF4444" },
  promptSolid:   { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: "#22C55E", alignItems: "center" },
  promptSolidTxt:{ fontSize: 14, fontWeight: "700", color: "#fff" },
});

export default UserDashboardScreen;
