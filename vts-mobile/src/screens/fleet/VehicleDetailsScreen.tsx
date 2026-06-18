import { useState } from "react";
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
  offline:{ label: "Offline", dot: "#EF4444", bg: "#FEE2E2", text: "#DC2626" },
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
  <View style={[cell.wrap, { borderLeftColor: iconColor }]}>
    <View style={[cell.iconBox, { backgroundColor: iconBg }]}>
      <Ionicons name={iconName as any} size={22} color={iconColor} />
    </View>
    <Text style={cell.label}>{label}</Text>
    <Text style={cell.value}>{value}</Text>
  </View>
);

const cell = StyleSheet.create({
  wrap:    { flex: 1, backgroundColor: "#F8FAFF", borderRadius: 14, padding: 14, minWidth: "46%", gap: 6, borderLeftWidth: 3 },
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
  const [liveStatus,   setLiveStatus]   = useState<string>(vehicle.tripStatus);
  const [driverName,   setDriverName]   = useState<string>(vehicle.driverName);
  const [speed,        setSpeed]        = useState<number>(vehicle.liveData?.speed ?? 0);

  // Extra telemetry (RPM, ignition, signal health) from fleet endpoint
  const [engineRpm,      setEngineRpm]      = useState<number>(0);
  const [ignition,       setIgnition]       = useState<string>("—");
  const [signalHealth,   setSignalHealth]   = useState<string>("—");
  const [lastUpdateTime, setLastUpdateTime] = useState<string>("—");
  const [lastUpdateDate, setLastUpdateDate] = useState<string>("—");
  const [telLoading,     setTelLoading]     = useState(true);
  const [imgError,       setImgError]       = useState(false);

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
      } else {
        setLiveStatus("Offline");
        setSpeed(0);
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
      setLastUpdateTime(data.lastUpdateTime || "—");
      setLastUpdateDate(data.lastUpdateDate || "—");
    } catch (_) {
    } finally {
      setTelLoading(false);
    }
  };

  // Poll both on focus — 5s interval for faster telemetry updates
  useFocusEffect(() => {
    refreshLive();
    refreshTelemetry();
    const t = setInterval(() => { refreshLive(); refreshTelemetry(); }, 5_000);
    return () => clearInterval(t);
  });

  const model = `${vehicle.vehicleMake ?? ""} ${vehicle.vehicleModel ?? ""}`.trim() || "—";

  const hasPhoto = !imgError && !!vehicle.vehiclePhoto && vehicle.vehiclePhoto.length > 0;
  const photoSrc = hasPhoto
    ? (vehicle.vehiclePhoto!.startsWith("data:") || vehicle.vehiclePhoto!.startsWith("http")
        ? vehicle.vehiclePhoto!
        : `data:image/jpeg;base64,${vehicle.vehiclePhoto}`)
    : null;

  const statusCfg = STATUS_MAP[(liveStatus ?? "").toLowerCase().trim()] ?? STATUS_MAP.parked;
  const isVehicleLive = (liveStatus ?? "").toLowerCase().trim() !== "offline";

  return (
    <View style={s.root}>
      {/* ── Header ── */}
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
            <View style={{ flex: 1 }}>
              <Text style={s.headerTitle}>Vehicle Details</Text>
              <Text style={s.headerSub}>Real-time vehicle information</Text>
            </View>
            {/* Live pill */}
            <View style={[
              s.livePill,
              !isVehicleLive && { backgroundColor: "rgba(239,68,68,0.20)", borderColor: "rgba(239,68,68,0.40)" },
            ]}>
              <View style={[s.liveDot, !isVehicleLive && { backgroundColor: "#EF4444" }]} />
              <Text style={[s.liveTxt, !isVehicleLive && { color: "#EF4444" }]}>
                {isVehicleLive ? "LIVE" : "OFFLINE"}
              </Text>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>

        {/* ── Hero Identity Card ── */}
        <View style={s.heroCard}>
          {/* Accent bar */}
          <View style={[s.accentBar, { backgroundColor: statusCfg.dot }]} />
          <View style={s.heroInner}>
            {/* Icon */}
            <View style={s.vehicleIconBox}>
              <Ionicons name="bus-outline" size={34} color="#7C3AED" />
            </View>
            {/* Info */}
            <View style={{ flex: 1 }}>
              <Text style={s.regNo}>{vehicle.licensePlate}</Text>
              <Text style={s.modelTxt}>{model}</Text>
              <View style={s.driverRow}>
                <Ionicons name="person-outline" size={13} color="#6B7280" />
                <Text style={s.driverName}>{driverName}</Text>
              </View>
            </View>
            {/* Status */}
            <View style={s.statusCol}>
              <StatusBadge status={liveStatus} />
              <Text style={s.speedTxt}>{speed} km/h</Text>
            </View>
          </View>
        </View>

        {/* ── Vehicle Photo ── */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>VEHICLE PHOTO</Text>
          {photoSrc ? (
            <View style={s.photoWrap}>
              <Image
                source={{ uri: photoSrc }}
                style={s.photo}
                resizeMode="cover"
                onError={() => setImgError(true)}
              />
              <View style={s.photoOverlay}>
                <Ionicons name="bus-outline" size={14} color="#fff" />
                <Text style={s.photoOverlayTxt}>{vehicle.licensePlate}</Text>
              </View>
            </View>
          ) : (
            <View style={s.photoPlaceholder}>
              <View style={s.photoPlaceholderIcon}>
                <Ionicons name="bus-outline" size={48} color="#D1D5DB" />
              </View>
              <Text style={s.photoPlaceholderText}>No Photo Available</Text>
            </View>
          )}
        </View>

        {/* ── Telemetry Grid ── */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>VEHICLE INFORMATION</Text>
          {telLoading ? (
            <ActivityIndicator color="#1565C0" style={{ marginVertical: 24 }} />
          ) : (
            <View style={s.infoGrid}>
              <View style={s.infoRow}>
                <InfoCell iconName="car-sport-outline"     iconBg="#EDE9FE" iconColor="#7C3AED" label="Model"         value={model} />
                <InfoCell iconName="speedometer-outline"   iconBg="#DBEAFE" iconColor="#2563EB" label="Speed"         value={`${speed} km/h`} />
              </View>
              <View style={s.infoRow}>
                <InfoCell iconName="construct-outline"     iconBg="#FEF9C3" iconColor="#CA8A04" label="Engine RPM"    value={`${engineRpm} RPM`} />
                <InfoCell iconName="cellular-outline"      iconBg="#FCE7F3" iconColor="#DB2777" label="Signal Health" value={signalHealth} />
              </View>
              <View style={s.infoRow}>
                <InfoCell iconName="power-outline"         iconBg="#DCFCE7" iconColor="#16A34A" label="Ignition"      value={ignition} />
                <InfoCell iconName="radio-outline"         iconBg="#FDF3E7" iconColor="#92400E" label="Last Updated"  value={lastUpdateTime !== "—" ? `${lastUpdateTime}\n${lastUpdateDate}` : "—"} />
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

  // Header
  header:              { paddingHorizontal: 16, paddingBottom: 20 },
  headerRow:           { flexDirection: "row", alignItems: "center", gap: 14, marginTop: 8 },
  backBtn:             { width: 42, height: 42, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  headerTitle:         { fontSize: 20, fontWeight: "800", color: "#fff" },
  headerSub:           { fontSize: 12, color: "rgba(255,255,255,0.70)", marginTop: 2 },
  livePill:            { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(34,197,94,0.20)", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: "rgba(34,197,94,0.40)" },
  liveDot:             { width: 7, height: 7, borderRadius: 4, backgroundColor: "#22C55E" },
  liveTxt:             { fontSize: 10, fontWeight: "800", color: "#22C55E", letterSpacing: 0.8 },

  scroll:              { flex: 1 },
  scrollContent:       { padding: 14, gap: 12, paddingBottom: 30 },

  // Hero card
  heroCard:            { backgroundColor: "#fff", borderRadius: 20, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  accentBar:           { height: 4, width: "100%" },
  heroInner:           { flexDirection: "row", alignItems: "center", gap: 14, padding: 16 },
  vehicleIconBox:      { width: 64, height: 64, borderRadius: 18, backgroundColor: "#EDE9FE", alignItems: "center", justifyContent: "center" },
  regNo:               { fontSize: 20, fontWeight: "900", color: "#0D1B3E" },
  modelTxt:            { fontSize: 13, color: "#1565C0", fontWeight: "700", marginTop: 2 },
  driverRow:           { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 5 },
  driverName:          { fontSize: 13, color: "#6B7280", fontWeight: "600" },
  statusCol:           { alignItems: "flex-end", gap: 8 },
  speedTxt:            { fontSize: 12, fontWeight: "700", color: "#0D1B3E" },

  // Generic card
  card:                { backgroundColor: "#fff", borderRadius: 20, padding: 16, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  sectionTitle:        { fontSize: 12, fontWeight: "800", color: "#1565C0", letterSpacing: 1.2, marginBottom: 14, textTransform: "uppercase" },

  // Photo
  photoWrap:           { borderRadius: 14, overflow: "hidden", position: "relative" },
  photo:               { width: "100%", height: 210 },
  photoOverlay:        { position: "absolute", bottom: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(10,31,68,0.55)", paddingHorizontal: 14, paddingVertical: 8 },
  photoOverlayTxt:     { fontSize: 13, fontWeight: "700", color: "#fff" },
  photoPlaceholder:    { height: 160, backgroundColor: "#F3F4F6", borderRadius: 14, alignItems: "center", justifyContent: "center", gap: 10, borderWidth: 1.5, borderColor: "#E5E7EB", borderStyle: "dashed" },
  photoPlaceholderIcon:{ width: 72, height: 72, borderRadius: 36, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  photoPlaceholderText:{ fontSize: 13, color: "#9CA3AF", fontWeight: "600" },

  // Telemetry grid
  infoGrid:            { gap: 10 },
  infoRow:             { flexDirection: "row", gap: 10 },
});

export default VehicleDetailsScreen;
