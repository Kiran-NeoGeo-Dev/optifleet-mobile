import { useCallback, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet, StatusBar, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { MainStackParamList } from "../../navigation/MainNavigator";
import { FleetVehicle, fetchFleetVehicles } from "../../services/fleetService";
import { COLORS, SHADOWS } from "../../components/ScreenBg";

type Props = NativeStackScreenProps<MainStackParamList, "VehicleList">;

const FUEL_ACCENT: Record<string, string> = {
  Petrol: "#FBBF24", Diesel: "#38BDF8", CNG: "#34D399", Electric: "#A78BFA",
};

// Status color mapping for live trip status
const STATUS_CONFIG: Record<string, { color: string; bg: string; border: string }> = {
  moving:  { color: "#16A34A", bg: "rgba(22,163,74,0.12)", border: "#16A34A55" },
  idle:    { color: "#F59E0B", bg: "rgba(245,158,11,0.12)", border: "#F59E0B55" },
  parked:  { color: "#6B7280", bg: "rgba(107,116,128,0.12)", border: "#6B728055" },
  offline: { color: "#DC2626", bg: "rgba(220,38,38,0.12)",   border: "#DC262655" },
};

const VehicleListScreen = ({ navigation }: Props) => {
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadVehicles = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(false);
    try {
      const data = await fetchFleetVehicles();
      setVehicles(data);
    } catch (err) {
      setError(true);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    loadVehicles();
    // Poll every 10 seconds for real-time status updates
    const interval = setInterval(() => loadVehicles(true), 10_000);
    return () => clearInterval(interval);
  }, [loadVehicles]));

  const filtered = vehicles.filter(v =>
    (v.licensePlate || "").toLowerCase().includes(query.toLowerCase()) ||
    (v.driverName || "").toLowerCase().includes(query.toLowerCase()) ||
    (v.vehicleMake || "").toLowerCase().includes(query.toLowerCase())
  );

  const renderCard = ({ item }: { item: FleetVehicle }) => {
    // Use live trip status (Moving/Idle/Parked/Offline) from ThingsBoard
    const statusKey = (item.tripStatus || "Offline").toLowerCase();
    const statusCfg = STATUS_CONFIG[statusKey] || STATUS_CONFIG.offline;

    return (
      <View style={[styles.card, SHADOWS.card]}>
        <View style={[styles.accentBar, { backgroundColor: statusCfg.color }]} />
        <View style={styles.cardInner}>
          <View style={styles.topRow}>
            <View style={styles.plateWrap}>
              <Ionicons name="shield-checkmark" size={14} color="#1565C0" />
              <Text style={styles.plate}>{item.licensePlate}</Text>
            </View>
            <View style={[styles.statusPill, {
              backgroundColor: statusCfg.bg,
              borderColor: statusCfg.border,
            }]}>
              <View style={[styles.statusDot, { backgroundColor: statusCfg.color }]} />
              <Text style={[styles.statusTxt, { color: statusCfg.color }]}>{item.tripStatus}</Text>
            </View>
          </View>

          <View style={styles.detailGrid}>
            <View style={styles.detailCol}>
              <Text style={styles.detailLabel}>Driver</Text>
              <Text style={styles.detailVal}>{item.driverName || "—"}</Text>
            </View>
            <View style={styles.detailCol}>
              <Text style={styles.detailLabel}>Make / Model</Text>
              <Text style={styles.detailVal}>{[item.vehicleMake, item.vehicleModel].filter(Boolean).join(" / ") || "—"}</Text>
            </View>
          </View>

          <View style={styles.bottomRow}>
            {/* Live status indicator */}
            <View style={[styles.liveBadge, { 
              borderColor: statusKey === 'offline' ? "#DC262666" : "#16A34A66",
              backgroundColor: statusKey === 'offline' ? "rgba(220,38,38,0.08)" : "rgba(22,163,74,0.08)"
            }]}>
              <View style={[styles.liveDot, { 
                backgroundColor: statusKey === 'offline' ? "#DC2626" : "#16A34A" 
              }]} />
              <Text style={[styles.liveTxt, { 
                color: statusKey === 'offline' ? "#DC2626" : "#16A34A" 
              }]}>
                {statusKey === 'offline' ? 'OFFLINE' : 'LIVE'}
              </Text>
            </View>
            <TouchableOpacity style={styles.editBtn} onPress={() => navigation.navigate("EditVehicle", { vehicleId: item.id })}>
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
            <Text style={styles.headerTitle}>Vehicle List</Text>
            <Text style={styles.headerSub}>{filtered.length} vehicle{filtered.length !== 1 ? "s" : ""}</Text>
          </View>
          <View style={{ width: 42 }} />
        </View>

        {/* Search */}
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={16} color="#5F6F8F" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by Reg. No., Owner, Make…"
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

        <FlatList
          data={filtered}
          keyExtractor={i => i.id.toString()}
          renderItem={renderCard}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            loading ? (
              <View style={styles.empty}>
                <ActivityIndicator size="large" color="rgba(255,255,255,0.7)" />
              </View>
            ) : error ? (
              <View style={styles.empty}>
                <Ionicons name="cloud-offline-outline" size={52} color="rgba(255,255,255,0.30)" />
                <Text style={styles.emptyTxt}>Failed to load vehicles</Text>
              </View>
            ) : (
              <View style={styles.empty}>
                <Ionicons name="car-outline" size={52} color="rgba(255,255,255,0.30)" />
                <Text style={styles.emptyTxt}>No vehicles found</Text>
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

  list:        { paddingHorizontal: 14, paddingBottom: 80 },

  card:        { backgroundColor: "#FFFFFF", borderRadius: 12, marginBottom: 8, flexDirection: "row", overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 7, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  accentBar:   { width: 3 },
  cardInner:   { flex: 1, padding: 11 },
  topRow:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 7 },
  plateWrap:   { flexDirection: "row", alignItems: "center", gap: 5 },
  plate:       { fontSize: 13, fontWeight: "800", color: "#0A1F44" },
  statusPill:  { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1 },
  statusDot:   { width: 5, height: 5, borderRadius: 3 },
  statusTxt:   { fontSize: 9, fontWeight: "700", textTransform: "uppercase" },
  detailGrid:  { flexDirection: "row", gap: 12, marginBottom: 7 },
  detailCol:   { flex: 1 },
  detailLabel: { fontSize: 9, color: "#5A7A9F", fontWeight: "700", textTransform: "uppercase", marginBottom: 1, letterSpacing: 0.5 },
  detailVal:   { fontSize: 12, color: "#0A1F44", fontWeight: "600" },
  bottomRow:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  liveBadge:   { flexDirection: "row", alignItems: "center", gap: 3, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1 },
  liveDot:     { width: 5, height: 5, borderRadius: 3 },
  liveTxt:     { fontSize: 10, fontWeight: "700" },
  editBtn:     { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "rgba(21,101,192,0.10)", borderRadius: 7, paddingHorizontal: 8, paddingVertical: 5, height: 28, borderWidth: 1, borderColor: "rgba(21,101,192,0.30)" },
  editBtnTxt:  { fontSize: 11, fontWeight: "700", color: "#1565C0" },
  empty:       { alignItems: "center", paddingTop: 50, gap: 10 },
  emptyTxt:    { fontSize: 14, color: "rgba(255,255,255,0.65)", fontWeight: "600" },
});

export default VehicleListScreen;
