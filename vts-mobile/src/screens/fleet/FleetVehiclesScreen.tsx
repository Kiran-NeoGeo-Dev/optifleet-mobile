import { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, ActivityIndicator, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";
import { fetchLiveVehicles } from "../../services/dashboardService";
import { fetchVehicles }     from "../../services/vehicleService";
import { fetchFleetDrivers } from "../../services/fleetService";
import type { LiveVehicle }  from "../../types/Dashboard";
import type { Vehicle }      from "../../types/Vehicle";

// ── Status config — same values as Dashboard map popup ───────────────────────
const STATUS_MAP: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  moving: { label: "Moving",  dot: "#22C55E", bg: "#DCFCE7", text: "#16A34A" },
  idle:   { label: "Idling",  dot: "#F59E0B", bg: "#FEF3C7", text: "#D97706" },
  parked: { label: "Parked",  dot: "#EF4444", bg: "#FEE2E2", text: "#DC2626" },
  offline:{ label: "Offline", dot: "#EF4444", bg: "#FEE2E2", text: "#DC2626" },
};

const StatusBadge = ({ status }: { status: string }) => {
  const cfg = STATUS_MAP[(status ?? "").toLowerCase().trim()] ?? STATUS_MAP.parked;
  return (
    <View style={[b.wrap, { backgroundColor: cfg.bg }]}>
      <View style={[b.dot, { backgroundColor: cfg.dot }]} />
      <Text style={[b.label, { color: cfg.text }]}>{cfg.label}</Text>
    </View>
  );
};

const b = StyleSheet.create({
  wrap:  { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, gap: 4 },
  dot:   { width: 6, height: 6, borderRadius: 3 },
  label: { fontSize: 10, fontWeight: "700" },
});

const ICON_PALETTE: Array<[string, string]> = [
  ["#7C3AED", "#EDE9FE"], ["#10B981", "#D1FAE5"], ["#F97316", "#FFEDD5"],
  ["#3B82F6", "#DBEAFE"], ["#EC4899", "#FCE7F3"], ["#06B6D4", "#CFFAFE"],
];

// Merged vehicle row shown in the list
interface VehicleRow {
  id:           number;
  licensePlate: string;
  vehicleMake:  string;
  vehicleModel: string;
  vehiclePhoto: string | null;
  clientId:     number | undefined;
  driverName:   string;
  tripStatus:   string;
  // carry full live data for VehicleDetails
  liveData:     LiveVehicle | null;
}

interface Props { navigation: any }

const FleetVehiclesScreen = ({ navigation }: Props) => {
  const [rows,       setRows]       = useState<VehicleRow[]>([]);
  const [filtered,   setFiltered]   = useState<VehicleRow[]>([]);
  const [query,      setQuery]      = useState("");
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Merge vehicles DB list with live telemetry — same source as Dashboard
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [vehicles, liveList] = await Promise.all([
        fetchVehicles().catch(() => [] as Vehicle[]),
        fetchLiveVehicles().catch(() => [] as LiveVehicle[]),
      ]);

      // Fetch fleet drivers to get a reliable mapping: licensePlate -> driverName
      const fleetDrivers = await fetchFleetDrivers().catch(() => [] as any[]);
      const driverByReg = new Map<string, string>();
      fleetDrivers.forEach((d: any) => {
        if (d.vehicleRegNo) driverByReg.set((d.vehicleRegNo ?? "").toUpperCase(), d.driverName ?? "");
      });

      // Build quick lookup: registrationNo (vehicleId in LiveVehicle) → live row
      const liveMap = new Map<string, LiveVehicle>();
      liveList.forEach(lv => liveMap.set((lv.vehicleId ?? "").toUpperCase(), lv));

      const merged: VehicleRow[] = vehicles.map(v => {
        const key  = (v.licensePlate ?? "").toUpperCase();
        const live = liveMap.get(key) ?? null;
        const driverFromFleet = driverByReg.get(key) ?? null;
        return {
          id:           v.id,
          licensePlate: v.licensePlate,
          vehicleMake:  v.vehicleMake  ?? "",
          vehicleModel: v.vehicleModel ?? "",
          vehiclePhoto: v.vehiclePhoto ?? null,
          clientId:     v.clientId,
          // Prefer live driver, then driver assigned in fleet service, else placeholder
          driverName:   live?.driverName ?? driverFromFleet ?? "—",
          // tripStatus comes from the SAME LiveVehicle data the Dashboard map uses
          tripStatus:   live?.tripStatus ?? "Offline",
          liveData:     live,
        };
      });

      setRows(merged);
    } catch (_) {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Refresh every time screen gains focus (same pattern as Dashboard)
  useFocusEffect(useCallback(() => {
    load();
    const t = setInterval(() => load(true), 5_000);
    return () => clearInterval(t);
  }, [load]));

  useEffect(() => {
    if (!query.trim()) { setFiltered(rows); return; }
    const q = query.toLowerCase();
    setFiltered(rows.filter(r =>
      r.licensePlate?.toLowerCase().includes(q) ||
      r.driverName?.toLowerCase().includes(q)
    ));
  }, [query, rows]);

  const renderItem = ({ item, index }: { item: VehicleRow; index: number }) => {
    const [iconColor, iconBg] = ICON_PALETTE[index % ICON_PALETTE.length];
    return (
      <TouchableOpacity
        style={s.card}
        onPress={() => navigation.navigate("VehicleDetails", { vehicle: item })}
        activeOpacity={0.75}
      >
        <View style={[s.iconBox, { backgroundColor: iconBg }]}>
          <Ionicons name="bus-outline" size={22} color={iconColor} />
        </View>
        <View style={s.cardBody}>
          <Text style={s.regNo}>{item.licensePlate}</Text>
          <Text style={s.driver}>Driver: {item.driverName}</Text>
        </View>
        <StatusBadge status={item.tripStatus} />
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
          <View style={s.headerRow}>
            <View>
              <Text style={s.headerTitle}>Fleet Vehicles</Text>
              <Text style={s.headerSub}>All vehicles in your fleet</Text>
            </View>
          </View>
          <View style={s.searchBox}>
            <Ionicons name="search-outline" size={18} color="#6B7280" />
            <TextInput
              style={s.searchInput}
              placeholder="Search by Vehicle No. or Driver..."
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
              <Ionicons name="bus-outline" size={52} color="#D1D5DB" />
              <Text style={s.emptyText}>No vehicles found</Text>
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
  headerRow:   { flexDirection: "row", alignItems: "center", marginTop: 6, marginBottom: 12 },
  headerTitle: { fontSize: 18, fontWeight: "800", color: "#fff" },
  headerSub:   { fontSize: 11, color: "rgba(255,255,255,0.75)", marginTop: 1 },
  searchBox:   { flexDirection: "row", alignItems: "center", backgroundColor: "#FDE8C8", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 6, gap: 6, borderWidth: 1, borderColor: "#F0C080" },
  searchInput: { flex: 1, fontSize: 12, color: "#1F2937" },
  list:        { padding: 10, gap: 7, paddingBottom: 80 },
  card:        { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 12, padding: 9, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3, gap: 9 },
  iconBox:     { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  cardBody:    { flex: 1 },
  regNo:       { fontSize: 13, fontWeight: "800", color: "#0D1B3E" },
  driver:      { fontSize: 11, color: "#6B7280", marginTop: 1 },
  viewBtn:     { marginLeft: 4, backgroundColor: "#3B82F6", borderRadius: 7, paddingHorizontal: 9, paddingVertical: 4 },
  viewBtnTxt:  { fontSize: 10, fontWeight: "800", color: "#FFFFFF" },
  empty:       { alignItems: "center", marginTop: 50, gap: 10 },
  emptyText:   { fontSize: 14, color: "#9CA3AF" },
});

export default FleetVehiclesScreen;
