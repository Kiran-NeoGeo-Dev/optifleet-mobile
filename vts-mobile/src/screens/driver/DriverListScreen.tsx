import { useCallback, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet, StatusBar, ActivityIndicator, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { MainStackParamList } from "../../navigation/MainNavigator";
import { FleetDriver, fetchFleetDrivers } from "../../services/fleetService";
import { COLORS, SHADOWS } from "../../components/ScreenBg";

type Props = NativeStackScreenProps<MainStackParamList, "DriverList">;

const DriverListScreen = ({ navigation }: Props) => {
  const [drivers, setDrivers] = useState<FleetDriver[]>([]);
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"active" | "inactive">("active");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const loadDrivers = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(false);
    try {
      const data = await fetchFleetDrivers();
      setDrivers(data);
    } catch (err) {
      setError(true);
    } finally {
      if (!silent) setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    loadDrivers();
    // Poll every 15 seconds for real-time status updates (drivers change less frequently than vehicles)
    const interval = setInterval(() => loadDrivers(true), 15_000);
    return () => clearInterval(interval);
  }, [loadDrivers]));

  const q = query.toLowerCase();
  const filtered = drivers.filter(d => {
    const matchTab = activeTab === "active" ? d.active : !d.active;
    if (!matchTab) return false;
    if (!q) return true;
    return d.driverName?.toLowerCase().includes(q) ||
           (d.phoneNumber || "").toLowerCase().includes(q) ||
           (d.vehicleRegNo || "").toLowerCase().includes(q);
  });

  const activeCount = drivers.filter(d => d.active).length;
  const inactiveCount = drivers.filter(d => !d.active).length;

  const renderCard = ({ item }: { item: FleetDriver }) => {
    const initials = item.driverName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
    const isActive = item.active;

    return (
      <View style={[styles.card, SHADOWS.card]}>
        <View style={[styles.accentBar, { backgroundColor: isActive ? "#16A34A" : "#DC2626" }]} />
        <View style={styles.cardInner}>
          <View style={styles.topRow}>
            <View style={[styles.avatar, { borderColor: isActive ? "#16A34A66" : "#DC262666" }]}>
              <Text style={styles.avatarTxt}>{initials}</Text>
            </View>
            <View style={styles.nameBlock}>
              <Text style={styles.driverName}>{item.driverName}</Text>
              <View style={[styles.statusPill, {
                backgroundColor: isActive ? "rgba(22,163,74,0.12)" : "rgba(220,38,38,0.12)",
                borderColor: isActive ? "#16A34A55" : "#DC262655",
              }]}>
                <View style={[styles.statusDot, { backgroundColor: isActive ? "#16A34A" : "#DC2626" }]} />
                <Text style={[styles.statusTxt, { color: isActive ? "#16A34A" : "#DC2626" }]}>
                  {isActive ? "ACTIVE" : "INACTIVE"}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="call-outline" size={13} color="#1565C0" />
            <Text style={styles.infoTxt}>{item.phoneNumber || "—"}</Text>
          </View>

          {item.vehicleRegNo && (
            <View style={styles.infoRow}>
              <Ionicons name="bus-outline" size={13} color="#1565C0" />
              <Text style={[styles.infoTxt, { fontWeight: "600", color: "#1565C0" }]}>{item.vehicleRegNo}</Text>
            </View>
          )}

          <View style={styles.actions}>
            <TouchableOpacity style={styles.viewBtn} onPress={() => navigation.navigate("ViewDriverPhotos", { driverId: item.id })}>
              <Ionicons name="eye-outline" size={14} color="#6366f1" />
              <Text style={styles.viewBtnTxt}>Photos</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.editBtn} onPress={() => navigation.navigate("EditDriver", { driverId: item.id })}>
              <Ionicons name="create-outline" size={14} color="#1565C0" />
              <Text style={styles.editBtnTxt}>Edit</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#0A1F44" />
      <LinearGradient
        colors={["#0A1F44", "#0D3B8E", "#1565C0"]}
        locations={[0, 0.5, 1]}
        start={{ x: 0.15, y: 0 }} end={{ x: 0.85, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {[0.18, 0.36, 0.54, 0.72].map((t, i) => (
        <View key={`h${i}`} style={[styles.gridH, { top: `${t * 100}%` as any }]} />
      ))}
      <View style={styles.orb} />

      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Driver List</Text>
            <Text style={styles.headerSub}>
              {activeTab === "active" ? activeCount : inactiveCount} {activeTab} driver
              {(activeTab === "active" ? activeCount : inactiveCount) !== 1 ? "s" : ""}
            </Text>
          </View>
          <View style={{ width: 42 }} />
        </View>

        {/* Search */}
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={16} color="#5F6F8F" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by Name, Phone, Vehicle…"
            placeholderTextColor="#5F6F8F"
            value={query}
            onChangeText={setQuery}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery("")}>
              <Ionicons name="close-circle" size={18} color="#5F6F8F" />
            </TouchableOpacity>
          )}
        </View>

        {/* Active/Inactive Tabs */}
        <View style={styles.tabs}>
          {(["active", "inactive"] as const).map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
              activeOpacity={0.75}
            >
              <Text>
                {tab === "active" ? (
                  <Text>
                    <Text style={activeTab === "active" ? styles.tabTxtActiveGreen : styles.tabTxt}>Active </Text>
                    <Text style={styles.tabCount}>(</Text>
                    <Text style={activeTab === "active" ? styles.tabCountNumActive : styles.tabCountNumActive}>{activeCount}</Text>
                    <Text style={styles.tabCount}>)</Text>
                  </Text>
                ) : (
                  <Text>
                    <Text style={activeTab === "inactive" ? styles.tabTxtActiveRed : styles.tabTxt}>Inactive </Text>
                    <Text style={styles.tabCount}>(</Text>
                    <Text style={activeTab === "inactive" ? styles.tabCountNumInactive : styles.tabCountNumInactive}>{inactiveCount}</Text>
                    <Text style={styles.tabCount}>)</Text>
                  </Text>
                )}
              </Text>
              {activeTab === tab && <View style={styles.tabLine} />}
            </TouchableOpacity>
          ))}
        </View>

        <FlatList
          data={filtered}
          keyExtractor={i => i.id.toString()}
          renderItem={renderCard}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); loadDrivers(); }}
              colors={["#1565C0"]}
            />
          }
          ListEmptyComponent={
            loading ? (
              <View style={styles.empty}>
                <ActivityIndicator size="large" color="rgba(255,255,255,0.7)" />
              </View>
            ) : error ? (
              <View style={styles.empty}>
                <Ionicons name="cloud-offline-outline" size={52} color="rgba(255,255,255,0.30)" />
                <Text style={styles.emptyTxt}>Failed to load drivers</Text>
              </View>
            ) : (
              <View style={styles.empty}>
                <Ionicons name="people-outline" size={52} color="rgba(255,255,255,0.30)" />
                <Text style={styles.emptyTxt}>No drivers found</Text>
              </View>
            )
          }
        />
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  root:         { flex: 1 },
  safe:         { flex: 1 },
  gridH:        { position: "absolute", left: 0, right: 0, height: 1, backgroundColor: "rgba(255,255,255,0.025)" },
  orb:          { position: "absolute", bottom: 100, left: -70, width: 190, height: 190, borderRadius: 95, backgroundColor: "rgba(13,59,142,0.12)" },

  header:       { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8 },
  backBtn:      { width: 36, height: 36, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.12)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle:  { fontSize: 18, fontWeight: "800", color: "#fff", letterSpacing: 0.2 },
  headerSub:    { fontSize: 11, color: "rgba(255,255,255,0.65)", marginTop: 1 },

  searchWrap:  { flexDirection: "row", alignItems: "center", backgroundColor: "#F0F4FF", borderRadius: 12, marginHorizontal: 14, marginBottom: 10, paddingHorizontal: 12, height: 42, borderWidth: 1, borderColor: "#BFDBFE", elevation: 2 },
  searchInput: { flex: 1, fontSize: 13, color: "#10204A", fontWeight: "500" },

  tabs:        { flexDirection: "row", backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E5E7EB" },
  tab:         { flex: 1, alignItems: "center", paddingVertical: 7, position: "relative" },
  tabActive:   {},
  tabTxt:      { fontSize: 13, fontWeight: "600", color: "#6B7280" },
  tabTxtActiveGreen: { fontSize: 13, fontWeight: "800", color: "#16A34A" },
  tabTxtActiveRed:   { fontSize: 13, fontWeight: "800", color: "#DC2626" },
  tabCount:          { fontSize: 13, fontWeight: "700", color: "#0F172A" },
  tabCountNumActive: { fontSize: 13, fontWeight: "800", color: "#15803D" },
  tabCountNumInactive:{ fontSize: 13, fontWeight: "800", color: "#B91C1C" },
  tabLine:     { position: "absolute", bottom: 0, left: "15%", right: "15%", height: 3, backgroundColor: "#FFD700", borderRadius: 2 },

  list:        { paddingHorizontal: 14, paddingBottom: 80 },

  card:        { backgroundColor: "#FFFFFF", borderRadius: 12, marginBottom: 8, flexDirection: "row", overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 7, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  accentBar:   { width: 3 },
  cardInner:   { flex: 1, padding: 11 },
  topRow:      { flexDirection: "row", alignItems: "center", marginBottom: 6, gap: 10 },
  avatar:      { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(21,101,192,0.10)", alignItems: "center", justifyContent: "center", borderWidth: 1 },
  avatarTxt:   { fontSize: 13, fontWeight: "800", color: "#0A1F44" },
  nameBlock:   { flex: 1, gap: 4 },
  driverName:  { fontSize: 13, fontWeight: "700", color: "#0A1F44" },
  statusPill:  { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1 },
  statusDot:   { width: 5, height: 5, borderRadius: 3 },
  statusTxt:   { fontSize: 9, fontWeight: "700", textTransform: "uppercase" },
  infoRow:     { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 7 },
  infoTxt:     { fontSize: 11, color: "#4A6A8E", flex: 1 },
  actions:     { flexDirection: "row", gap: 6 },
  viewBtn:     { flexDirection: "row", alignItems: "center", gap: 3, borderWidth: 1, borderColor: "rgba(99,102,241,0.30)", borderRadius: 7, paddingHorizontal: 8, paddingVertical: 5, height: 28, backgroundColor: "rgba(99,102,241,0.08)" },
  viewBtnTxt:  { fontSize: 11, fontWeight: "700", color: "#6366f1" },
  editBtn:     { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "rgba(21,101,192,0.10)", borderRadius: 7, paddingHorizontal: 8, paddingVertical: 5, height: 28, borderWidth: 1, borderColor: "rgba(21,101,192,0.30)" },
  editBtnTxt:  { fontSize: 11, fontWeight: "700", color: "#1565C0" },
  empty:       { alignItems: "center", paddingTop: 50, gap: 10 },
  emptyTxt:    { fontSize: 14, color: "rgba(255,255,255,0.65)", fontWeight: "600" },
});

export default DriverListScreen;
