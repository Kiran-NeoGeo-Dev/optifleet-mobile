import { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, ActivityIndicator, RefreshControl, Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";
import { fetchFleetDrivers, FleetDriver, fetchFleetVehicles } from "../../services/fleetService";

// ── Helpers ───────────────────────────────────────────────────────────────────
const initials = (name: string) =>
  (name ?? "?").split(" ").slice(0, 2).map(w => w[0]?.toUpperCase() ?? "").join("");

const scoreColor = (score: number) =>
  score >= 95 ? "#16A34A" : score >= 90 ? "#22C55E" : score >= 85 ? "#EAB308" : score >= 80 ? "#F97316" : score >= 75 ? "#EF4444" : "#991B1B";

const AVATAR_COLORS = ["#EDE9FE", "#D1FAE5", "#DBEAFE", "#FCE7F3", "#FFEDD5", "#CFFAFE"];
const AVATAR_TEXT   = ["#7C3AED", "#10B981", "#3B82F6", "#EC4899", "#F97316", "#06B6D4"];

interface Props { navigation: any }

const FleetDriversScreen = ({ navigation }: Props) => {
  const [drivers,    setDrivers]    = useState<FleetDriver[]>([]);
  const [query,      setQuery]      = useState("");
  const [activeTab,  setActiveTab]  = useState<"active" | "inactive">("active");
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try { setDrivers(await fetchFleetDrivers()); }
    catch (_) {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  // Also fetch fleet vehicle -> driver mapping to provide fallback for vehicleRegNo
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const fv = await fetchFleetVehicles();
        if (!mounted) return;
        // build reverse map: driverName -> licensePlate (first match)
        const map = new Map<string, string>();
        fv.forEach((v: any) => {
          if (v.driverName && v.licensePlate) {
            const k = (v.driverName ?? "").trim();
            if (!map.has(k)) map.set(k, v.licensePlate);
          }
        });
        // apply fallback to existing drivers list
        setDrivers(prev => prev.map(d => ({ ...d, vehicleRegNo: d.vehicleRegNo ?? map.get((d.driverName ?? "").trim()) ?? d.vehicleRegNo })));
      } catch (_) {}
    })();
    return () => { mounted = false; };
  }, []);

  useFocusEffect(useCallback(() => {
    load();
    const t = setInterval(() => load(true), 10_000);
    return () => clearInterval(t);
  }, [load]));

  const q = query.toLowerCase();
  const filtered = drivers.filter(d => {
    const matchTab = activeTab === "active" ? d.active : !d.active;
    if (!matchTab) return false;
    if (!q) return true;
    return d.driverName?.toLowerCase().includes(q)
        || d.phoneNumber?.toLowerCase().includes(q)
        || d.vehicleRegNo?.toLowerCase().includes(q);
  });

  const activeCount   = drivers.filter(d =>  d.active).length;
  const inactiveCount = drivers.filter(d => !d.active).length;

  const renderItem = ({ item, index }: { item: FleetDriver; index: number }) => {
    const ci = index % AVATAR_COLORS.length;
    const hasPhoto = !!item.photoFront && item.photoFront.length > 4;
    const photoUri = hasPhoto
      ? (item.photoFront!.startsWith("data:") || item.photoFront!.startsWith("http")
          ? item.photoFront! : `data:image/jpeg;base64,${item.photoFront}`)
      : null;

    const scoreNum = item.safetyScore != null ? item.safetyScore : 0;
    return (
      <TouchableOpacity
        style={s.card}
        onPress={() => navigation.navigate("DriverScorecard", { driver: item })}
        activeOpacity={0.75}
      >
        {/* Avatar */}
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={s.avatar} />
        ) : (
          <View style={[s.avatarBox, { backgroundColor: AVATAR_COLORS[ci] }]}>
            <Text style={[s.avatarText, { color: AVATAR_TEXT[ci] }]}>{initials(item.driverName)}</Text>
          </View>
        )}

        {/* Info */}
        <View style={s.cardInfo}>
          <Text style={s.driverName}>{item.driverName}</Text>
          <View style={s.infoRow}>
            <Ionicons name="call-outline" size={11} color="#6B7280" />
            <Text style={s.infoText}>{item.phoneNumber ?? "—"}</Text>
          </View>
          <View style={s.infoRow}>
            <Ionicons name="bus-outline" size={11} color="#1565C0" />
            <Text style={[s.infoText, { color: "#1565C0", fontWeight: "700" }]}>
              {item.vehicleRegNo ?? "—"}
            </Text>
          </View>
        </View>

        {/* Score + Badge + Arrow */}
        <View style={s.cardRight}>
          <Text style={[s.scoreNum, { color: scoreColor(scoreNum) }]}>
            {scoreNum.toFixed(1)}%
          </Text>
          <Text style={s.safetyLabel}>Safety Score</Text>
          <View style={s.badgeRow}>
            <View style={[s.badge, item.active ? s.badgeActive : s.badgeInactive]}>
              <View style={[s.badgeDot, { backgroundColor: item.active ? "#22C55E" : "#EF4444" }]} />
              <Text style={[s.badgeTxt, { color: item.active ? "#16A34A" : "#DC2626" }]}>
                {item.active ? "Active" : "Inactive"}
              </Text>
            </View>
          </View>
        </View>
        <View style={s.viewBtn}><Text style={s.viewBtnTxt}>View ›</Text></View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={s.root}>
      <LinearGradient
        colors={["#0A1F44", "#0D3B8E", "#1565C0"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={s.header}
      >
        <SafeAreaView edges={["top"]}>
          <Text style={s.headerTitle}>Fleet Drivers</Text>
          <Text style={s.headerSub}>All drivers in your fleet</Text>
          <View style={s.searchBox}>
            <Ionicons name="search-outline" size={18} color="#6B7280" />
            <TextInput
              style={s.searchInput}
              placeholder="Search by driver name, phone or vehicle..."
              placeholderTextColor="#6B7280"
              value={query}
              onChangeText={setQuery}
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery("")}>
                <Ionicons name="close-circle" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* Tabs */}
      <View style={s.tabs}>
        {(["active", "inactive"] as const).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[s.tab, activeTab === tab && s.tabActive]}
            onPress={() => setActiveTab(tab)}
            activeOpacity={0.75}
          >
            <Text>
              {tab === "active" ? (
                <Text>
                  <Text style={activeTab === "active" ? s.tabTxtActiveGreen : s.tabTxt}>Active </Text>
                  <Text style={s.tabCount}>(</Text>
                  <Text style={activeTab === "active" ? s.tabCountNumActive : s.tabCountNumActive}>{activeCount}</Text>
                  <Text style={s.tabCount}>)</Text>
                </Text>
              ) : (
                <Text>
                  <Text style={activeTab === "inactive" ? s.tabTxtActiveRed : s.tabTxt}>Inactive </Text>
                  <Text style={s.tabCount}>(</Text>
                  <Text style={activeTab === "inactive" ? s.tabCountNumInactive : s.tabCountNumInactive}>{inactiveCount}</Text>
                  <Text style={s.tabCount}>)</Text>
                </Text>
              )}
            </Text>
            {activeTab === tab && <View style={s.tabLine} />}
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color="#1565C0" size="large" style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              colors={["#1565C0"]}
            />
          }
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="people-outline" size={52} color="#D1D5DB" />
              <Text style={s.emptyText}>No drivers found</Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: "#F0F4FF" },
  header:      { paddingHorizontal: 16, paddingBottom: 14 },
  headerTitle: { fontSize: 18, fontWeight: "800", color: "#fff", marginTop: 6 },
  headerSub:   { fontSize: 11, color: "rgba(255,255,255,0.75)", marginTop: 1, marginBottom: 10 },
  searchBox:   { flexDirection: "row", alignItems: "center", backgroundColor: "#FDE8C8", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 6, gap: 6, borderWidth: 1, borderColor: "#F0C080" },
  searchInput: { flex: 1, fontSize: 12, color: "#1F2937" },
  tabs:        { flexDirection: "row", backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E5E7EB" },
  tab:         { flex: 1, alignItems: "center", paddingVertical: 8, position: "relative" },
  tabActive:   {},
  tabTxt:      { fontSize: 13, fontWeight: "600", color: "#6B7280" },
  tabTxtActive:      { color: "#1A3CC8", fontWeight: "800" },
  tabTxtActiveGreen: { fontSize: 13, fontWeight: "800", color: "#16A34A" },
  tabTxtActiveRed:   { fontSize: 13, fontWeight: "800", color: "#DC2626" },
  tabCount:          { fontSize: 13, fontWeight: "700", color: "#0F172A" },
  tabCountNumActive: { fontSize: 13, fontWeight: "800", color: "#15803D" },
  tabCountNumInactive:{ fontSize: 13, fontWeight: "800", color: "#B91C1C" },
  tabLine:     { position: "absolute", bottom: 0, left: "15%", right: "15%", height: 3, backgroundColor: "#FFD700", borderRadius: 2 },
  list:        { padding: 10, gap: 7, paddingBottom: 80 },
  card:        { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 12, padding: 9, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3, gap: 9 },
  avatar:      { width: 40, height: 40, borderRadius: 20 },
  avatarBox:   { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  avatarText:  { fontSize: 13, fontWeight: "800" },
  cardInfo:    { flex: 1, gap: 2 },
  driverName:  { fontSize: 13, fontWeight: "800", color: "#0D1B3E" },
  infoRow:     { flexDirection: "row", alignItems: "center", gap: 4 },
  infoText:    { fontSize: 11, color: "#6B7280" },
  cardRight:   { alignItems: "flex-end", gap: 2 },
  scoreNum:    { fontSize: 14, fontWeight: "700" },
  safetyLabel: { fontSize: 9, fontWeight: "700", color: "#374151", letterSpacing: 0.3 },
  viewBtn:     { marginLeft: 4, backgroundColor: "#3B82F6", borderRadius: 7, paddingHorizontal: 9, paddingVertical: 4 },
  viewBtnTxt:  { fontSize: 10, fontWeight: "800", color: "#FFFFFF" },
  badgeRow:    { flexDirection: "row" },
  badge:       { flexDirection: "row", alignItems: "center", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, gap: 3 },
  badgeActive: { backgroundColor: "#DCFCE7" },
  badgeInactive:{ backgroundColor: "#FEE2E2" },
  badgeDot:    { width: 5, height: 5, borderRadius: 2.5 },
  badgeTxt:    { fontSize: 10, fontWeight: "700" },
  empty:       { alignItems: "center", marginTop: 50, gap: 10 },
  emptyText:   { fontSize: 14, color: "#9CA3AF" },
});

export default FleetDriversScreen;
