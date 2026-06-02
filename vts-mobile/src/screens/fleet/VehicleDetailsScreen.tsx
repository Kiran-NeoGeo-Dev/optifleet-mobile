import { useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Image,
  TouchableOpacity, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";
import { fetchLiveVehicles } from "../../services/dashboardService";
import { fetchVehicleTelemetry } from "../../services/fleetService";
import type { LiveVehicle } from "../../types/Dashboard";

// ── Status Badge — identical mapping to Dashboard map popup ──────────────────
const STATUS_MAP: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  moving: { label: "Moving",  dot: "#22C55E", bg: "#DCFCE7", text: "#16A34A" },
  idle:   { label: "Idling",  dot: "#F59E0B", bg: "#FEF3C7", text: "#D97706" },
  parked: { label: "Parked",  dot: "#EF4444", bg: "#FEE2E2", text: "#DC2626" },
};

const StatusBadge = ({ status }: { status: string }) => {
  const cfg = STATUS_MAP[(status ?? "").toLowerCase().trim()] ?? STATUS_MAP.parked;
  return (
    <View style={[badge.wrap, { backgroundColor: cfg.bg }]}>
      <View style={[badge.dot, { backgroundColor: cfg.dot }]} />
      <Text style={[badge.label, { color: cfg.text }]}>{cfg.label}</Text>
    </View>
  );
};

const badge = StyleSheet.create({
  wrap:  { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 6 },
  dot:   { width: 8, height: 8, borderRadius: 4 },
  label: { fontSize: 13, fontWeight: "700" },
});

// ── Info Cell ─────────────────────────────────────────────────────────────────
const InfoCell = ({ iconName, iconBg, iconColor, label, value }: {
  iconName: string; iconBg: string; iconColor: string; label: string; value: string;
}) => (
  <View style={cell.wrap}>
    <View style={[cell.iconBox, { backgroundColor: iconBg }]}>
      <Ionicons name={iconName as any} size={22} color={iconColor} />
    </View>
    <Text style={cell.label}>{label}</Text>
    <Text style={cell.value}>{value}</Text>
  </View>
);

const cell = StyleSheet.create({
  wrap:    { flex: 1, backgroundColor: "#F8FAFF", borderRadius: 14, padding: 14, minWidth: "46%", gap: 6 },
  iconBox: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  label:   { fontSize: 10, fontWeight: "700", color: "#6B7280", letterSpacing: 0.5, textTransform: "uppercase" },
  value:   { fontSize: 15, fontWeight: "800", color: "#0D1B3E" },
});

// ── Screen ────────────────────────────────────────────────────────────────────
interface VehicleRow {
  id: number; licensePlate: string;
  vehicleMake: string; vehicleModel: string;
  vehiclePhoto: string | null; clientId: number | undefined;
  driverName: string; tripStatus: string;
  liveData: LiveVehicle | null;
}

interface Props {
  navigation: any;
  route: { params: { vehicle: VehicleRow } };
}

const VehicleDetailsScreen = ({ navigation, route }: Props) => {
  const { vehicle } = route.params;

  // Live status — refresh from same endpoint Dashboard uses
  const [liveStatus,  setLiveStatus]  = useState<string>(vehicle.tripStatus);
  const [driverName,  setDriverName]  = useState<string>(vehicle.driverName);
  const [speed,       setSpeed]       = useState<number>(vehicle.liveData?.speed ?? 0);

  // Extra telemetry (RPM, ignition, signal health) from fleet endpoint
  const [engineRpm,   setEngineRpm]   = useState<number>(0);
  const [ignition,    setIgnition]    = useState<string>("—");
  const [signalHealth,setSignalHealth]= useState<string>("—");
  const [telLoading,  setTelLoading]  = useState(true);
  const [imgError,    setImgError]    = useState(false);

  // Refresh live status from the same /api/dashboard/live-vehicles call
  const refreshLive = async () => {
    try {
      const list = await fetchLiveVehicles();
      const match = list.find(
        lv => (lv.vehicleId ?? "").toUpperCase() === (vehicle.licensePlate ?? "").toUpperCase()
      );
      if (match) {
        setLiveStatus(match.tripStatus ?? "Parked");
        setDriverName(match.driverName ?? vehicle.driverName);
        setSpeed(match.speed ?? 0);
      }
    } catch (_) {}
  };

  // Fetch RPM, ignition, signal health from fleet telemetry endpoint
  const refreshTelemetry = async () => {
    try {
      const data = await fetchVehicleTelemetry(vehicle.id);
      setEngineRpm(data.engineRpm ?? 0);
      setIgnition((data.ignitionStatus ?? "OFF").toUpperCase());
      setSignalHealth(data.signalHealth ?? "—");
    } catch (_) {
    } finally {
      setTelLoading(false);
    }
  };

  // Poll both on focus — same 10s interval as Dashboard
  useFocusEffect(() => {
    refreshLive();
    refreshTelemetry();
    const t = setInterval(() => { refreshLive(); refreshTelemetry(); }, 10_000);
    return () => clearInterval(t);
  });

  const model = `${vehicle.vehicleMake ?? ""} ${vehicle.vehicleModel ?? ""}`.trim() || "—";

  const hasPhoto = !imgError && !!vehicle.vehiclePhoto && vehicle.vehiclePhoto.length > 0;
  const photoSrc = hasPhoto
    ? (vehicle.vehiclePhoto!.startsWith("data:") || vehicle.vehiclePhoto!.startsWith("http")
        ? vehicle.vehiclePhoto!
        : `data:image/jpeg;base64,${vehicle.vehiclePhoto}`)
    : null;

  return (
    <View style={s.root}>
      <LinearGradient
        colors={["#0A1F44", "#0D3B8E", "#1565C0"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={s.header}
      >
        <SafeAreaView edges={["top"]}>
          <View style={s.headerRow}>
            <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={20} color="#fff" />
            </TouchableOpacity>
            <View>
              <Text style={s.headerTitle}>Vehicle Details</Text>
              <Text style={s.headerSub}>Real-time vehicle information</Text>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Identity card — status from same live feed as Dashboard */}
        <View style={s.card}>
          <View style={s.identityRow}>
            <View style={s.vehicleIconBox}>
              <Ionicons name="bus-outline" size={30} color="#7C3AED" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.regNo}>{vehicle.licensePlate}</Text>
              <Text style={s.driverName}>Driver: {driverName}</Text>
            </View>
            <StatusBadge status={liveStatus} />
          </View>
        </View>

        {/* Vehicle Photo from vehicles.photo column */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>Vehicle Photo</Text>
          {photoSrc ? (
            <Image
              source={{ uri: photoSrc }}
              style={s.photo}
              resizeMode="cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <View style={s.photoPlaceholder}>
              <Ionicons name="bus-outline" size={56} color="#D1D5DB" />
              <Text style={s.photoPlaceholderText}>No Photo Available</Text>
            </View>
          )}
        </View>

        {/* Vehicle Information */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>Vehicle Information</Text>
          {telLoading ? (
            <ActivityIndicator color="#1565C0" style={{ marginVertical: 20 }} />
          ) : (
            <View style={s.infoGrid}>
              <View style={s.infoRow}>
                <InfoCell iconName="person-circle-outline" iconBg="#EDE9FE" iconColor="#7C3AED" label="Model"         value={model} />
                <InfoCell iconName="speedometer-outline"   iconBg="#DBEAFE" iconColor="#3B82F6" label="Speed"         value={`${speed} km/h`} />
              </View>
              <View style={s.infoRow}>
                <InfoCell iconName="construct-outline"     iconBg="#FFEDD5" iconColor="#F97316" label="Engine RPM"    value={`${engineRpm} RPM`} />
                <InfoCell iconName="cellular-outline"      iconBg="#D1FAE5" iconColor="#10B981" label="Signal Health" value={signalHealth} />
              </View>
              <View style={s.infoRow}>
                <InfoCell iconName="power-outline"         iconBg="#D1FAE5" iconColor="#10B981" label="Ignition"      value={ignition} />
                <InfoCell iconName="time-outline"          iconBg="#EDE9FE" iconColor="#7C3AED" label="Last Updated"  value="Live" />
              </View>
            </View>
          )}
        </View>

      </ScrollView>
    </View>
  );
};

const s = StyleSheet.create({
  root:                { flex: 1, backgroundColor: "#F3F4F6" },
  header:              { paddingHorizontal: 16, paddingBottom: 20 },
  headerRow:           { flexDirection: "row", alignItems: "center", gap: 14, marginTop: 8 },
  backBtn:             { width: 42, height: 42, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  headerTitle:         { fontSize: 22, fontWeight: "800", color: "#fff" },
  headerSub:           { fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 2 },
  scroll:              { flex: 1 },
  scrollContent:       { padding: 14, gap: 12 },
  card:                { backgroundColor: "#fff", borderRadius: 20, padding: 16, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  identityRow:         { flexDirection: "row", alignItems: "center", gap: 14 },
  vehicleIconBox:      { width: 60, height: 60, borderRadius: 16, backgroundColor: "#EDE9FE", alignItems: "center", justifyContent: "center" },
  regNo:               { fontSize: 18, fontWeight: "800", color: "#0D1B3E" },
  driverName:          { fontSize: 13, color: "#6B7280", marginTop: 4 },
  sectionTitle:        { fontSize: 16, fontWeight: "800", color: "#0D1B3E", marginBottom: 14 },
  photo:               { width: "100%", height: 200, borderRadius: 14 },
  photoPlaceholder:    { height: 180, backgroundColor: "#F3F4F6", borderRadius: 14, alignItems: "center", justifyContent: "center", gap: 10 },
  photoPlaceholderText:{ fontSize: 14, color: "#9CA3AF" },
  infoGrid:            { gap: 10 },
  infoRow:             { flexDirection: "row", gap: 10 },
});

export default VehicleDetailsScreen;
