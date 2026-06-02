import { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity,
  ActivityIndicator, Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";
import Svg, { Circle } from "react-native-svg";
import { fetchDriverScorecard, FleetDriver, DriverScorecard, EventCounts } from "../../services/fleetService";

// ── Circular progress ring ────────────────────────────────────────────────────
// rawScore: 0 = perfect, higher = worse (per spec)
// Ring fill: inversely proportional. rawScore 0 → full green ring, rawScore 15+ → empty red ring
const RING_SIZE = 180;
const STROKE    = 14;
const RADIUS    = (RING_SIZE - STROKE) / 2;
const CIRCUM    = 2 * Math.PI * RADIUS;
const MAX_RAW   = 15; // rawScore >= 15 = completely empty ring (Very Poor)

// Color: green for low score (safe), red for high score (unsafe)
const rawScoreColor = (raw: number) =>
  raw <= 2 ? "#22C55E" : raw <= 6 ? "#F59E0B" : "#EF4444";

const ScoreRing = ({ rawScore }: { rawScore: number }) => {
  // Ring shows how "good" the driver is — inverse of rawScore
  const pct   = Math.max(0, Math.min(100, (1 - rawScore / MAX_RAW) * 100));
  const dash  = (pct / 100) * CIRCUM;
  const color = rawScoreColor(rawScore);
  return (
    <View style={{ alignItems: "center", justifyContent: "center", width: RING_SIZE, height: RING_SIZE }}>
      <Svg width={RING_SIZE} height={RING_SIZE} style={{ position: "absolute" }}>
        <Circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RADIUS}
          stroke="#E5E7EB" strokeWidth={STROKE} fill="none" />
        <Circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RADIUS}
          stroke={color} strokeWidth={STROKE} fill="none"
          strokeDasharray={`${dash} ${CIRCUM - dash}`}
          strokeDashoffset={CIRCUM / 4}
          strokeLinecap="round" />
      </Svg>
      {/* Show rawScore as the score value, formatted to 1 decimal */}
      <Text style={[ring.score, { color }]}>{rawScore.toFixed(1)}</Text>
    </View>
  );
};

const ring = StyleSheet.create({
  score: { fontSize: 38, fontWeight: "900" },
});

// ── Event row ─────────────────────────────────────────────────────────────────
const EventRow = ({ icon, label, count, color }: { icon: string; label: string; count: number; color: string }) => (
  <View style={er.row}>
    <Ionicons name={icon as any} size={14} color={color} />
    <Text style={er.label} numberOfLines={1}>{label}</Text>
    <Text style={[er.count, { color }]}>{count}</Text>
  </View>
);

const er = StyleSheet.create({
  row:   { flexDirection: "row", alignItems: "center", paddingVertical: 4, gap: 4 },
  label: { flex: 1, fontSize: 11, color: "#374151", fontWeight: "600" },
  count: { fontSize: 12, fontWeight: "800", minWidth: 16, textAlign: "right" },
});

// ── Remark text ───────────────────────────────────────────────────────────────
const REMARK_DESC: Record<string, string> = {
  "Excellent": "Excellent! Keep up the great driving habits.",
  "Very Good": "Very Good! Minor improvements can make you perfect.",
  "Good":      "Good driving. Watch for occasional violations.",
  "Fair":      "Fair performance. Focus on reducing violations.",
  "Poor":      "Poor performance. Needs significant improvement.",
  "Very Poor": "Critical safety concerns. Immediate action required.",
};

const remarkColor = (r: string) => {
  if (r === "Excellent" || r === "Very Good") return "#22C55E";
  if (r === "Good")      return "#10B981";
  if (r === "Fair")      return "#F59E0B";
  if (r === "Poor")      return "#F97316";
  return "#EF4444";
};

// Fleet list card: show rawScore with color (lower=greener)
const listScoreColor = (raw: number) =>
  raw <= 2 ? "#22C55E" : raw <= 6 ? "#F59E0B" : "#EF4444";

const PERIODS = ["Today", "Yesterday", "This Week"] as const;
type Period = typeof PERIODS[number];
const PERIOD_KEY: Record<Period, string> = { "Today": "today", "Yesterday": "yesterday", "This Week": "week" };

// ── Screen ────────────────────────────────────────────────────────────────────
interface Props {
  navigation: any;
  route: { params: { driver: FleetDriver } };
}

const DriverScorecardScreen = ({ navigation, route }: Props) => {
  const { driver } = route.params;
  const [data,        setData]        = useState<DriverScorecard | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [period,      setPeriod]      = useState<Period>("Today");
  const [showPicker,  setShowPicker]  = useState(false);
  const [imgError,    setImgError]    = useState(false);

  const load = useCallback(async (p: Period) => {
    setLoading(true);
    try { setData(await fetchDriverScorecard(driver.id, PERIOD_KEY[p])); }
    catch (_) {}
    finally { setLoading(false); }
  }, [driver.id]);

  useFocusEffect(useCallback(() => { load(period); }, [period]));

  const hasPhoto = !imgError && !!driver.photoFront && driver.photoFront.length > 4;
  const photoUri = hasPhoto
    ? (driver.photoFront!.startsWith("data:") || driver.photoFront!.startsWith("http")
        ? driver.photoFront! : `data:image/jpeg;base64,${driver.photoFront}`)
    : null;

  const rawScore = data?.safetyScore ?? 0;
  const remark   = data?.remark ?? "—";
  const events   = data?.events ?? { smoking: 0, mobile: 0, overspeed: 0, drowsiness: 0, seatbelt: 0, kmDriven: 0 };

  const PeriodColumn = ({ title, ev }: { title: string; ev: EventCounts }) => (
    <View style={sc.periodCol}>
      <View style={sc.periodHeader}>
        <Ionicons name="calendar-outline" size={13} color="#1565C0" />
        <Text style={sc.periodTitle}>{title}</Text>
      </View>
      {([
        { icon: "flame-outline",       label: "Smoking",   count: ev.smoking,    color: "#EF4444" },
        { icon: "call-outline",        label: "Mobile",    count: ev.mobile,     color: "#F59E0B" },
        { icon: "speedometer-outline", label: "Overspeed", count: ev.overspeed,  color: "#F97316" },
        { icon: "moon-outline",        label: "Drowsy",    count: ev.drowsiness, color: "#8B5CF6" },
        { icon: "shield-outline",      label: "Seatbelt",  count: ev.seatbelt,   color: "#10B981" },
      ] as const).map(r => (
        <View key={r.label} style={sc.evRow}>
          <Ionicons name={r.icon as any} size={13} color={r.color} />
          <Text style={sc.evLabel}>{r.label}</Text>
          <Text style={[sc.evCount, { color: r.color }]}>{r.count}</Text>
        </View>
      ))}
    </View>
  );

  return (
    <View style={sc.root}>
      <LinearGradient
        colors={["#0A1F44", "#0D3B8E", "#1565C0"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={sc.header}
      >
        <SafeAreaView edges={["top"]}>
          <View style={sc.headerRow}>
            <TouchableOpacity style={sc.backBtn} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={18} color="#fff" />
              <Text style={sc.backTxt}>Back</Text>
            </TouchableOpacity>
            <Text style={sc.headerTitle}>DRIVER SCORECARD</Text>
            <View style={{ width: 60 }} />
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={sc.scroll}>

        {/* Driver Profile Card */}
        <View style={sc.card}>
          <View style={sc.profileRow}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={sc.photo} onError={() => setImgError(true)} />
            ) : (
              <View style={sc.photoPlaceholder}>
                <Ionicons name="person" size={36} color="#9CA3AF" />
              </View>
            )}
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={sc.driverName}>{driver.driverName}</Text>
              <View style={sc.badgeRow}>
                <View style={[sc.badge, driver.active ? sc.badgeGreen : sc.badgeRed]}>
                  <Text style={[sc.badgeTxt, { color: driver.active ? "#16A34A" : "#DC2626" }]}>
                    {driver.active ? "ACTIVE" : "INACTIVE"}
                  </Text>
                </View>
                <Text style={{ color: "#9CA3AF", fontSize: 12 }}>•</Text>
                <Text style={sc.vehicleReg}>{driver.vehicleRegNo ?? "—"}</Text>
              </View>
              <View style={sc.detailRow}>
                <Ionicons name="bus-outline" size={14} color="#6B7280" />
                <Text style={sc.detailTxt}>Heavy Vehicle</Text>
              </View>
              <View style={sc.detailRow}>
                <Ionicons name="call-outline" size={14} color="#6B7280" />
                <Text style={sc.detailTxt}>{driver.phoneNumber ?? "—"}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Period Filter */}
        <LinearGradient colors={["#0D3B8E", "#1565C0"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={sc.filterCard}>
          <View style={sc.filterRow}>
            <Text style={sc.filterLabel}>Show Score For</Text>
            <TouchableOpacity style={sc.dropdown} onPress={() => setShowPicker(true)}>
              <Text style={sc.dropdownTxt}>{period}</Text>
              <Ionicons name="chevron-down" size={16} color="#1565C0" />
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Overall Safety Score */}
        <View style={sc.card}>
          <Text style={sc.sectionTitle}>OVERALL SAFETY SCORE</Text>
          {loading ? (
            <ActivityIndicator color="#1565C0" style={{ marginVertical: 40 }} />
          ) : (
            <>
              <View style={{ alignItems: "center", marginVertical: 16 }}>
                <ScoreRing rawScore={rawScore} />
                <Text style={[sc.remarkLabel, { color: remarkColor(remark), marginTop: 12 }]}>
                  {remark.toUpperCase()}
                </Text>
              </View>
              <Text style={sc.remarkDesc}>{REMARK_DESC[remark] ?? ""}</Text>
            </>
          )}
        </View>

        {/* Event Summary — 3 columns */}
        {data && (
          <View style={sc.card}>
            <View style={sc.periodGrid}>
              <PeriodColumn title="TODAY"     ev={data.todayEvents}     />
              <View style={sc.divider} />
              <PeriodColumn title="YESTERDAY" ev={data.yesterdayEvents} />
              <View style={sc.divider} />
              <PeriodColumn title="THIS WEEK" ev={data.weekEvents}      />
            </View>
          </View>
        )}

      </ScrollView>

      {/* Period Picker Modal */}
      <Modal visible={showPicker} transparent animationType="fade" onRequestClose={() => setShowPicker(false)}>
        <TouchableOpacity style={sc.overlay} onPress={() => setShowPicker(false)} activeOpacity={1}>
          <View style={sc.pickerCard}>
            {PERIODS.map(p => (
              <TouchableOpacity
                key={p}
                style={[sc.pickerItem, period === p && sc.pickerItemActive]}
                onPress={() => { setPeriod(p); setShowPicker(false); }}
              >
                <Text style={[sc.pickerTxt, period === p && sc.pickerTxtActive]}>{p}</Text>
                {period === p && <Ionicons name="checkmark" size={16} color="#1565C0" />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const sc = StyleSheet.create({
  root:           { flex: 1, backgroundColor: "#F3F4F6" },
  header:         { paddingHorizontal: 16, paddingBottom: 16 },
  headerRow:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  backBtn:        { flexDirection: "row", alignItems: "center", gap: 6 },
  backTxt:        { color: "#fff", fontSize: 14, fontWeight: "600" },
  headerTitle:    { fontSize: 16, fontWeight: "900", color: "#fff", letterSpacing: 1 },
  scroll:         { padding: 14, gap: 12, paddingBottom: 30 },
  card:           { backgroundColor: "#fff", borderRadius: 20, padding: 16, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  profileRow:     { flexDirection: "row", alignItems: "flex-start" },
  photo:          { width: 90, height: 90, borderRadius: 45 },
  photoPlaceholder:{ width: 90, height: 90, borderRadius: 45, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  driverName:     { fontSize: 20, fontWeight: "800", color: "#0D1B3E", marginBottom: 6 },
  badgeRow:       { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  badge:          { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  badgeGreen:     { backgroundColor: "#DCFCE7" },
  badgeRed:       { backgroundColor: "#FEE2E2" },
  badgeTxt:       { fontSize: 11, fontWeight: "800" },
  vehicleReg:     { fontSize: 13, fontWeight: "700", color: "#1565C0" },
  detailRow:      { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  detailTxt:      { fontSize: 13, color: "#6B7280" },
  filterCard:     { paddingHorizontal: 16, paddingVertical: 14, borderRadius: 0, marginHorizontal: -14 },
  filterRow:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  filterLabel:    { fontSize: 15, color: "#fff", fontWeight: "600" },
  dropdown:       { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 0, backgroundColor: "#fff", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  dropdownTxt:    { fontSize: 14, color: "#1565C0", fontWeight: "600" },
  sectionTitle:   { fontSize: 13, fontWeight: "800", color: "#1565C0", textAlign: "center", letterSpacing: 1, marginBottom: 4 },
  remarkLabel:    { fontSize: 18, fontWeight: "900", letterSpacing: 1 },
  remarkDesc:     { fontSize: 13, color: "#6B7280", textAlign: "center", lineHeight: 18, marginTop: 8 },
  periodGrid:   { flexDirection: "row" },
  periodCol:    { flex: 1, paddingHorizontal: 2 },
  periodHeader: { flexDirection: "row", alignItems: "center", gap: 3, marginBottom: 8, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: "#E5E7EB" },
  periodTitle:  { fontSize: 9, fontWeight: "800", color: "#1565C0", letterSpacing: 0.3 },
  evRow:        { flexDirection: "row", alignItems: "center", paddingVertical: 6, gap: 6 },
  evLabel:      { flex: 1, fontSize: 11, color: "#374151", fontWeight: "600" },
  evCount:      { fontSize: 12, fontWeight: "800", minWidth: 16, textAlign: "right" },
  divider:      { width: 1, backgroundColor: "#E5E7EB", marginHorizontal: 4 },
  overlay:        { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center" },
  pickerCard:     { backgroundColor: "#fff", borderRadius: 16, padding: 8, width: 240, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 16, elevation: 10 },
  pickerItem:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderRadius: 10 },
  pickerItemActive:{ backgroundColor: "#EFF6FF" },
  pickerTxt:      { fontSize: 15, color: "#374151", fontWeight: "600" },
  pickerTxtActive:{ color: "#1565C0", fontWeight: "800" },
});

export default DriverScorecardScreen;
