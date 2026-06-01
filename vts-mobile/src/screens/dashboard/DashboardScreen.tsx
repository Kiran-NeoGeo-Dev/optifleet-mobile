import { useCallback, useRef, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  Modal, Pressable, ScrollView, StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { MainStackParamList } from "../../navigation/MainNavigator";
import { useAuth } from "../../hooks/useAuth";
import { fetchDashboardSummary } from "../../services/dashboardService";
import { useFocusEffect } from "@react-navigation/native";
import { Toast, useToast } from "../../components/Toast";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { BellButton, NotificationPanel } from "../../components/AlertNotifications";
import { useAlertNotifications } from "../../hooks/useAlertNotifications";
import { fetchNotifications } from "../../services/notificationService";

type Props = NativeStackScreenProps<MainStackParamList, "Dashboard">;

const C = {
  bgDark: "#0A1F44",
  bgMid: "#0D3B8E",
  bgBright: "#1565C0",
  purple: "#1565C0",
  cream: "#F6F1E9",
  cardText: "#0D1B3E",
  mutedText: "#4A6A8E",
  white: "#FFFFFF",
  red: "#F87171",
};

const OVERVIEW_ITEMS = [
  { key: "totalDrivers", icon: "people" as const, label: "Total Drivers", sub: "All registered drivers", accent: "#7B2CBF", nav: "DriverList" },
  { key: "totalVehicles", icon: "car" as const, label: "Total Vehicles", sub: "All registered vehicles", accent: "#EF4444", nav: "VehicleList" },
  { key: "activeDrivers", icon: "flash" as const, label: "Active Drivers", sub: "Currently active drivers", accent: "#22C55E", nav: undefined },
  { key: "activeVehicles", icon: "star" as const, label: "Active Vehicles", sub: "Currently active vehicles", accent: "#3B82F6", nav: undefined },
] as const;

const OPERATIONS_ITEMS = [
  { key: "totalAssociations", icon: "link-outline" as const, label: "Associations", sub: "Driver & vehicle associations", accent: "#EC4899", nav: "AssociationList" },
  { key: "totalTrips", icon: "navigate-outline" as const, label: "Trip Management", sub: "All trips and routes", accent: "#F59E0B", nav: "TripManagement" },
] as const;

const StatRow = ({ icon, label, sub, value, accent, onPress, last }: {
  icon: any; label: string; sub: string; value: number;
  accent: string; onPress?: () => void; last?: boolean;
}) => (
  <TouchableOpacity
    style={[sr.row, !last && sr.divider]}
    onPress={onPress}
    activeOpacity={onPress ? 0.72 : 1}
    disabled={!onPress}
  >
    <View style={[sr.bar, { backgroundColor: accent }]} />
    <View style={[sr.iconBox, { backgroundColor: accent + "18" }]}>
      <Ionicons name={icon} size={20} color={accent} />
    </View>
    <View style={sr.labelWrap}>
      <Text style={sr.label}>{label}</Text>
      <Text style={sr.sub}>{sub}</Text>
    </View>
    <Text style={[sr.value, { color: accent }]}>{value}</Text>
    {onPress && (
      <View style={[sr.arrow, { backgroundColor: accent + "14" }]}>
        <Ionicons name="chevron-forward" size={13} color={accent} />
      </View>
    )}
  </TouchableOpacity>
);

const StatCard = ({ icon, label, value, accent, onPress }: {
  icon: any; label: string; value: number; accent: string; onPress?: () => void;
}) => (
  <TouchableOpacity style={sc.card} onPress={onPress} activeOpacity={0.78}>
    <View style={[sc.iconBox, { backgroundColor: accent + "18" }]}>
      <Ionicons name={icon} size={22} color={accent} />
    </View>
    <Text style={[sc.value, { color: accent }]}>{value}</Text>
    <Text style={sc.label}>{label}</Text>
    <Ionicons name="chevron-forward" size={13} color={accent} style={sc.arrow} />
  </TouchableOpacity>
);

const DashboardScreen = ({ navigation }: Props) => {
  const { logout, username } = useAuth();
  const [fabOpen, setFabOpen] = useState(false);
  const [logoutDialog, setLogoutDialog] = useState(false);
  const [panelOpen,    setPanelOpen]    = useState(false);
  const [enablePrompt, setEnablePrompt] = useState(false);
  const notifEnabled = useRef(false);
  const [summary, setSummary] = useState({
    totalDrivers: 0, activeDrivers: 0, totalVehicles: 0,
    activeVehicles: 0, totalAssociations: 0, totalTrips: 0,
  });
  const { toast, showToast, hideToast } = useToast();
  const { } = useAlertNotifications();
  const readKeysRef = useRef<Set<string>>(new Set());
  const [notifHistory, setNotifHistory] = useState<any[]>([]);
  const [notifUnread,  setNotifUnread]  = useState(0);
  const initials = (username || "U").slice(0, 2).toUpperCase();

  const loadNotifications = useCallback(() => {
    fetchNotifications(readKeysRef.current)
      .then(items => {
        setNotifHistory(items);
        setNotifUnread(items.filter((n: any) => !n.read).length);
      })
      .catch(() => {});
  }, []);

  useFocusEffect(useCallback(() => {
    fetchDashboardSummary().then(setSummary).catch(() => {});
    const interval = setInterval(() => fetchDashboardSummary().then(setSummary).catch(() => {}), 30000);
    return () => clearInterval(interval);
  }, []));

  useFocusEffect(useCallback(() => {
    if (!notifEnabled.current) {
      setEnablePrompt(true);
    } else {
      loadNotifications();
      const t = setInterval(loadNotifications, 30000);
      return () => clearInterval(t);
    }
  }, [loadNotifications]));

  const handleEnableNotifications = () => {
    notifEnabled.current = true;
    setEnablePrompt(false);
    loadNotifications();
  };

  const val = (key: string) => (summary as any)[key] ?? 0;

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.bgDark} />
      <LinearGradient
        colors={[C.bgDark, C.bgMid, C.bgBright]}
        locations={[0, 0.5, 1]}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {[0.18, 0.36, 0.54, 0.72].map((t, i) => (
        <View key={`h${i}`} style={[s.gridH, { top: `${t * 100}%` as any }]} />
      ))}
      {[0.15, 0.42, 0.68, 0.88].map((t, i) => (
        <View key={`v${i}`} style={[s.gridV, { left: `${t * 100}%` as any }]} />
      ))}
      <View style={s.bgGlow} />

      <SafeAreaView style={s.safe}>
        <View style={s.header}>
          <TouchableOpacity style={s.logoutBtn} onPress={() => setLogoutDialog(true)}>
            <Ionicons name="log-out-outline" size={20} color={C.red} />
            <Text style={s.logoutTxt}>Logout</Text>
          </TouchableOpacity>

          <View style={s.headerCenter}>
            <Text style={s.brandTxt}>
              <Text style={{ color: C.white }}>Opti</Text>
              <Text style={{ color: C.white }}>Fleet</Text>
            </Text>
            <Text style={s.pageTitle}>Dashboard</Text>
          </View>

          <View style={s.headerRight}>
            <BellButton unreadCount={notifUnread} onPress={() => { setPanelOpen(true); notifHistory.forEach((n: any) => readKeysRef.current.add(n.id)); setNotifUnread(0); setNotifHistory(h => h.map((n: any) => ({ ...n, read: true }))); }} />
            <TouchableOpacity style={s.avatarBtn} onPress={() => navigation.navigate("ClientDetails")}>
              <Text style={s.avatarTxt}>{initials}</Text>
              <View style={s.onlineDot} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
          <Text style={s.sectionLabel}>OVERVIEW</Text>
          <View style={s.overviewGrid}>
            {OVERVIEW_ITEMS.map((item) => (
              <StatCard
                key={item.key}
                icon={item.icon}
                label={item.label}
                value={val(item.key)}
                accent={item.accent}
                onPress={item.nav ? () => navigation.navigate(item.nav as any) : undefined}
              />
            ))}
          </View>

          <Text style={s.sectionLabel}>OPERATIONS</Text>
          <View style={s.listCard}>
            {OPERATIONS_ITEMS.map((item, idx) => (
              <StatRow
                key={item.key}
                icon={item.icon}
                label={item.label}
                sub={item.sub}
                value={val(item.key)}
                accent={item.accent}
                onPress={item.nav ? () => navigation.navigate(item.nav as any) : undefined}
                last={idx === OPERATIONS_ITEMS.length - 1}
              />
            ))}
          </View>

        </ScrollView>

        <TouchableOpacity style={s.fab} onPress={() => setFabOpen(true)} activeOpacity={0.85}>
          <LinearGradient
            colors={["#22C55E", "#16A34A"]}
            start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
            style={s.fabGrad}
          >
            <Ionicons name="add" size={30} color={C.white} />
          </LinearGradient>
        </TouchableOpacity>
      </SafeAreaView>

      <Modal visible={fabOpen} transparent animationType="fade" onRequestClose={() => setFabOpen(false)}>
        <Pressable style={s.modalBg} onPress={() => setFabOpen(false)}>
          <View style={s.fabMenu}>
            {[
              { icon: "person-add-outline", label: "Add Driver", color: "#1565C0", action: () => navigation.navigate("AddDriver") },
              { icon: "car-outline", label: "Add Vehicle", color: "#3B82F6", action: () => navigation.navigate("AddVehicle") },
              { icon: "git-network-outline", label: "Add Association", color: "#22C55E", action: () => navigation.navigate("AssociationList", { openAddModal: true }) },
              { icon: "map-outline", label: "Register Trip", color: "#F59E0B", action: () => navigation.navigate("RegisterTrip") },
            ].map((item, idx, arr) => (
              <View key={item.label}>
                <TouchableOpacity style={s.fabItem} onPress={() => { setFabOpen(false); item.action(); }}>
                  <View style={[s.fabItemIcon, { backgroundColor: item.color + "18" }]}>
                    <Ionicons name={item.icon as any} size={18} color={item.color} />
                  </View>
                  <Text style={s.fabItemTxt}>{item.label}</Text>
                  <Ionicons name="chevron-forward" size={15} color={C.mutedText} />
                </TouchableOpacity>
                {idx < arr.length - 1 && <View style={s.fabDivider} />}
              </View>
            ))}
          </View>
        </Pressable>
      </Modal>

      <ConfirmDialog
        visible={logoutDialog} title="Logout" message="Are you sure you want to logout from OptiFleet?"
        confirmText="Logout" cancelText="Cancel" confirmColor={C.red} icon="log-out-outline"
        onCancel={() => setLogoutDialog(false)}
        onConfirm={() => { setLogoutDialog(false); showToast("Logged out successfully.", "info"); setTimeout(logout, 1200); }}
      />
      <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={hideToast} />

      {/* Notification Panel */}
      <NotificationPanel
        visible={panelOpen}
        history={notifHistory}
        onClose={() => setPanelOpen(false)}
        onMarkAllRead={() => {
          notifHistory.forEach((n: any) => readKeysRef.current.add(n.id));
          setNotifHistory(h => h.map((n: any) => ({ ...n, read: true })));
          setNotifUnread(0);
        }}
        onClearAll={() => {
          notifHistory.forEach((n: any) => readKeysRef.current.add(n.id));
          setNotifHistory([]);
          setNotifUnread(0);
        }}
      />

      {/* Enable Notifications Prompt */}
      <Modal visible={enablePrompt} transparent animationType="fade" onRequestClose={() => setEnablePrompt(false)}>
        <View style={s.promptOverlay}>
          <View style={s.promptCard}>
            <Text style={s.promptBell}>🔔</Text>
            <Text style={s.promptTitle}>Don't miss Fleet updates!</Text>
            <Text style={s.promptSub}>Enable notifications for real time fleet updates and alerts.</Text>
            <View style={s.promptBtns}>
              <TouchableOpacity style={s.promptBtnGhost} onPress={() => setEnablePrompt(false)}>
                <Text style={s.promptBtnGhostTxt}>Not now</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.promptBtnSolid} onPress={handleEnableNotifications}>
                <Text style={s.promptBtnSolidTxt}>Enable</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const sc = StyleSheet.create({
  card: {
    width: "44%",
    backgroundColor: C.cream,
    borderRadius: 16,
    padding: 10,
    marginBottom: 6,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  iconBox: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  value: { fontSize: 22, fontWeight: "800", marginBottom: 2 },
  label: { fontSize: 10, fontWeight: "600", color: "#4A6A8E" },
  arrow: { position: "absolute", top: 10, right: 10 },
});

const sr = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 14, gap: 10 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(0,0,0,0.05)" },
  bar: { width: 3, height: 30, borderRadius: 2 },
  iconBox: { width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  labelWrap: { flex: 1 },
  label: { fontSize: 13, fontWeight: "700", color: C.cardText, marginBottom: 1 },
  sub: { fontSize: 11, color: C.mutedText },
  value: { fontSize: 20, fontWeight: "800", minWidth: 32, textAlign: "right" },
  arrow: { width: 26, height: 26, borderRadius: 7, alignItems: "center", justifyContent: "center", marginLeft: 2 },
});

const s = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  gridH: { position: "absolute", left: 0, right: 0, height: 1, backgroundColor: "rgba(255,255,255,0.025)" },
  gridV: { position: "absolute", top: 0, bottom: 0, width: 1, backgroundColor: "rgba(255,255,255,0.025)" },
  bgGlow: { position: "absolute", bottom: 60, left: -50, width: 160, height: 160, borderRadius: 80, backgroundColor: "rgba(13,59,142,0.12)" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 10, paddingBottom: 14 },
  headerCenter: { alignItems: "center", flex: 1 },
  brandTxt: { fontSize: 17, fontWeight: "800", letterSpacing: 0.4, color: C.white },
  pageTitle: { fontSize: 26, fontWeight: "800", color: C.white, marginTop: 2, marginBottom: 8 },
  logoutBtn: { alignItems: "center", gap: 4, width: 52 },
  logoutTxt: { fontSize: 10, fontWeight: "700", color: C.red },
  avatarBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.10)", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  avatarTxt: { fontSize: 14, fontWeight: "800", color: C.white },
  onlineDot: { position: "absolute", bottom: 1, right: 1, width: 10, height: 10, borderRadius: 5, backgroundColor: "#22C55E", borderWidth: 2, borderColor: C.bgDark },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  // Enable-notifications prompt
  promptOverlay:    { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", padding: 24 },
  promptCard:       { backgroundColor: "#fff", borderRadius: 24, padding: 28, alignItems: "center", width: "100%", maxWidth: 340 },
  promptBell:       { fontSize: 64, marginBottom: 16 },
  promptTitle:      { fontSize: 20, fontWeight: "800", color: "#0D1B3E", textAlign: "center", marginBottom: 8 },
  promptSub:        { fontSize: 14, color: "#6B7280", textAlign: "center", lineHeight: 20, marginBottom: 28 },
  promptBtns:       { flexDirection: "row", gap: 12, width: "100%" },
  promptBtnGhost:   { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: "#F3F4F6", alignItems: "center" },
  promptBtnGhostTxt:{ fontSize: 15, fontWeight: "700", color: "#374151" },
  promptBtnSolid:   { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: "#0D1B3E", alignItems: "center" },
  promptBtnSolidTxt:{ fontSize: 15, fontWeight: "700", color: "#fff" },
  scroll: { paddingHorizontal: 14, paddingBottom: 110 },
  sectionLabel: { fontSize: 11, fontWeight: "800", color: "rgba(255,255,255,0.58)", letterSpacing: 1.5, marginBottom: 8, marginTop: 2 },
  overviewGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginBottom: 6 },
  listCard: { backgroundColor: C.cream, borderRadius: 18, marginBottom: 14, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  fab: { position: "absolute", bottom: 32, right: 24, width: 60, height: 60, borderRadius: 30, overflow: "hidden", shadowColor: "#22C55E", shadowOpacity: 0.28, shadowRadius: 10, elevation: 6, shadowOffset: { width: 0, height: 3 } },
  fabGrad: { width: 60, height: 60, alignItems: "center", justifyContent: "center" },
  modalBg: { flex: 1, justifyContent: "flex-end", alignItems: "flex-end" },
  fabMenu: { backgroundColor: C.cream, borderRadius: 20, paddingVertical: 6, marginBottom: 108, marginRight: 24, minWidth: 230, shadowColor: "#1A0040", shadowOpacity: 0.20, shadowRadius: 24, elevation: 14, shadowOffset: { width: 0, height: 8 } },
  fabItem: { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16, gap: 12 },
  fabItemIcon: { width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  fabItemTxt: { flex: 1, fontSize: 14, fontWeight: "700", color: C.cardText },
  fabDivider: { height: StyleSheet.hairlineWidth, backgroundColor: "rgba(21,101,192,0.10)", marginHorizontal: 16 },
});

export default DashboardScreen;
