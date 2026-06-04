import { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity,
  ActivityIndicator, Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";
import Svg, { Path, Circle, Text as SvgText } from "react-native-svg";
import { fetchDriverScorecard, FleetDriver, DriverScorecard, EventCounts } from "../../services/fleetService";

// ── Score helpers (exact same logic as backend getRemark) ─────────────────────
const rawScoreColor = (raw: number) =>
  raw <= 2 ? "#16A34A" : raw <= 4 ? "#22C55E" : raw <= 6 ? "#EAB308" : raw <= 8 ? "#F97316" : raw <= 10 ? "#EF4444" : "#991B1B";

// 6 equal tiers — each occupies 60° of the pie
const TIERS = [
  { label: "Excellent", color: "#16A34A" },
  { label: "Very Good", color: "#22C55E" },
  { label: "Good",      color: "#EAB308" },
  { label: "Fair",      color: "#F97316" },
  { label: "Poor",      color: "#EF4444" },
  { label: "Very Poor", color: "#991B1B" },
];

const remarkToTierIndex = (remark: string) =>
  TIERS.findIndex(t => t.label === remark);

// ── Pie Chart Component ───────────────────────────────────────────────────────
const PIE  = 200;
const CX   = PIE / 2;
const CY   = PIE / 2;
const OR   = 86;   // outer radius
const IR   = 50;   // inner radius
const GAP  = 2.5;  // degrees gap between slices
const EACH = 360 / TIERS.length; // 60° each

const makeArc = (startDeg: number, endDeg: number) => {
  const toXY = (deg: number, r: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
  };
  const s = startDeg + GAP / 2;
  const e = endDeg   - GAP / 2;
  const lg = e - s > 180 ? 1 : 0;
  const o1 = toXY(s, OR), o2 = toXY(e, OR);
  const i1 = toXY(e, IR), i2 = toXY(s, IR);
  return `M${o1.x} ${o1.y} A${OR} ${OR} 0 ${lg} 1 ${o2.x} ${o2.y} L${i1.x} ${i1.y} A${IR} ${IR} 0 ${lg} 0 ${i2.x} ${i2.y}Z`;
};

const ScorePieChart = ({ rawScore, remark }: { rawScore: number; remark: string }) => {
  const activeColor = rawScoreColor(rawScore);
  const activeTier  = remarkToTierIndex(remark);

  return (
    <View style={{ alignItems: "center" }}>
      <Svg width={PIE} height={PIE}>
        {TIERS.map((t, i) => {
          const start = i * EACH;
          const path  = makeArc(start, start + EACH);
          const isActive = i === activeTier;
          return (
            <Path
              key={t.label}
              d={path}
              fill={isActive ? t.color : t.color + "28"}
              stroke="#fff"
              strokeWidth={2}
            />
          );
        })}
        {/* Donut hole */}
        <Circle cx={CX} cy={CY} r={IR - 1} fill="#fff" />
        {/* Score value */}
        <SvgText
          x={CX} y={CY - 5}
          textAnchor="middle"
          fontSize="28"
          fontWeight="900"
          fill={activeColor}
        >
          {rawScore.toFixed(2)}
        </SvgText>
        {/* Score label */}
        <SvgText
          x={CX} y={CY + 14}
          textAnchor="middle"
          fontSize="9"
          fontWeight="700"
          fill="#9CA3AF"
        >
          SAFETY SCORE
        </SvgText>
      </Svg>

      {/* Tier legend chips */}
      <View style={pie.legend}>
        {TIERS.map((t, i) => {
          const isActive = i === activeTier;
          return (
            <View
              key={t.label}
              style={[
                pie.chip,
                isActive && { borderColor: t.color, borderWidth: 1.5, backgroundColor: t.color + "18" },
              ]}
            >
              <View style={[pie.dot, { backgroundColor: t.color }]} />
              <Text style={[pie.chipTxt, isActive && { color: t.color, fontWeight: "800" }]}>
                {t.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const pie = StyleSheet.create({
  legend:  { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 6, marginTop: 4 },
  chip:    { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20, backgroundColor: "#F3F4F6", borderWidth: 1, borderColor: "transparent" },
  dot:     { width: 7, height: 7, borderRadius: 4 },
  chipTxt: { fontSize: 11, color: "#6B7280", fontWeight: "600" },
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

const REMARK_COLORS: Record<string, string> = {
  "Excellent": "#16A34A",
  "Very Good": "#22C55E",
  "Good":      "#EAB308",
  "Fair":      "#F97316",
  "Poor":      "#EF4444",
  "Very Poor": "#991B1B",
};

const remarkColor = (r: string) => REMARK_COLORS[r] ?? "#6B7280";

// ── Month picker ──────────────────────────────────────────────────────────────
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;
type MonthName = typeof MONTHS[number];

// ── Screen ────────────────────────────────────────────────────────────────────
interface Props {
  navigation: any;
  route: { params: { driver: FleetDriver } };
}

const DriverScorecardScreen = ({ navigation, route }: Props) => {
  const { driver } = route.params;
  const now = new Date();
  const [data,       setData]       = useState<DriverScorecard | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [selYear,    setSelYear]    = useState(now.getFullYear());
  const [selMonth,   setSelMonth]   = useState<MonthName>(MONTHS[now.getMonth()]);
  const [showPicker, setShowPicker] = useState(false);
  const [imgError,   setImgError]   = useState(false);

  const monthNum = (m: MonthName) => MONTHS.indexOf(m) + 1;

  const load = useCallback(async (year: number, month: MonthName) => {
    setLoading(true);
    try { setData(await fetchDriverScorecard(driver.id, year, monthNum(month))); }
    catch (_) {}
    finally { setLoading(false); }
  }, [driver.id]);

  useFocusEffect(useCallback(() => { load(selYear, selMonth); }, [selYear, selMonth]));

  const hasPhoto = !imgError && !!driver.photoFront && driver.photoFront.length > 4;
  const photoUri = hasPhoto
    ? (driver.photoFront!.startsWith("data:") || driver.photoFront!.startsWith("http")
        ? driver.photoFront! : `data:image/jpeg;base64,${driver.photoFront}`)
    : null;

  const rawScore     = data?.safetyScore ?? 0;
  const remark       = data?.remark ?? "—";
  const events       = data?.events ?? { smoking: 0, mobile: 0, overspeed: 0, drowsiness: 0, seatbelt: 0, distraction: 0, kmDriven: 0 };
  const vehicleModel = data?.vehicleModel ?? driver.vehicleModel ?? null;
  const hasNoData    = data != null && events.kmDriven === 0 &&
                       events.smoking === 0 && events.mobile === 0 && events.distraction === 0 &&
                       events.overspeed === 0 && events.drowsiness === 0 && events.seatbelt === 0;

  const MonthEventsCard = ({ ev }: { ev: EventCounts }) => (
    <View style={sc.card}>
      <Text style={sc.sectionTitle}>EVENTS — {selMonth.toUpperCase()} {selYear}</Text>
      <View style={{ marginTop: 8 }}>
        {([
          { icon: "flame-outline",       label: "Smoking",     count: ev.smoking,     color: "#EF4444" },
          { icon: "call-outline",        label: "Mobile",      count: ev.mobile,      color: "#F59E0B" },
          { icon: "speedometer-outline", label: "Overspeed",   count: ev.overspeed,   color: "#F97316" },
          { icon: "moon-outline",        label: "Drowsy",      count: ev.drowsiness,  color: "#8B5CF6" },
          { icon: "shield-outline",      label: "Seatbelt",    count: ev.seatbelt,    color: "#10B981" },
          { icon: "eye-off-outline",     label: "Distraction", count: ev.distraction, color: "#EC4899" },
        ] as const).map(r => (
          <View key={r.label} style={sc.evRow}>
            <Ionicons name={r.icon as any} size={14} color={r.color} />
            <Text style={sc.evLabel}>{r.label}</Text>
            <Text style={[sc.evCount, { color: r.color }]}>{r.count}</Text>
          </View>
        ))}
        <View style={[sc.evRow, { borderTopWidth: 1, borderTopColor: "#E5E7EB", marginTop: 4, paddingTop: 8 }]}>
          <Ionicons name="speedometer-outline" size={14} color="#1565C0" />
          <Text style={[sc.evLabel, { color: "#1565C0" }]}>KM Driven</Text>
          <Text style={[sc.evCount, { color: "#1565C0" }]}>{ev.kmDriven.toFixed(1)}</Text>
        </View>
      </View>
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
                <Text style={sc.detailTxt}>{vehicleModel ?? "—"}</Text>
              </View>
              <View style={sc.detailRow}>
                <Ionicons name="call-outline" size={14} color="#6B7280" />
                <Text style={sc.detailTxt}>{driver.phoneNumber ?? "—"}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Month Filter */}
        <LinearGradient colors={["#0D3B8E", "#1565C0"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={sc.filterCard}>
          <View style={sc.filterRow}>
            <Text style={sc.filterLabel}>Monthly Score</Text>
            <TouchableOpacity style={sc.dropdown} onPress={() => setShowPicker(true)}>
              <Text style={sc.dropdownTxt}>{selMonth} {selYear}</Text>
              <Ionicons name="chevron-down" size={16} color="#1565C0" />
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Overall Safety Score */}
        <View style={sc.card}>
          <Text style={sc.sectionTitle}>OVERALL SAFETY SCORE</Text>
          {loading ? (
            <ActivityIndicator color="#1565C0" style={{ marginVertical: 40 }} />
          ) : hasNoData ? (
            <View style={{ alignItems: "center", marginVertical: 32, gap: 8 }}>
              <Ionicons name="analytics-outline" size={48} color="#D1D5DB" />
              <Text style={{ fontSize: 15, color: "#9CA3AF", fontWeight: "600" }}>No trip data for this month</Text>
              <Text style={{ fontSize: 12, color: "#D1D5DB", textAlign: "center" }}>Score requires completed trip distance</Text>
            </View>
          ) : (
            <>
              <View style={{ alignItems: "center", marginVertical: 16 }}>
                <ScorePieChart rawScore={rawScore} remark={remark} />
                <Text style={[sc.remarkLabel, { color: remarkColor(remark), marginTop: 12 }]}>
                  {remark.toUpperCase()}
                </Text>
              </View>
              <Text style={sc.remarkDesc}>{REMARK_DESC[remark] ?? ""}</Text>
            </>
          )}
        </View>

        {/* Event Summary — monthly */}
        {data && <MonthEventsCard ev={events} />}

      </ScrollView>

      {/* Month Picker Modal */}
      <Modal visible={showPicker} transparent animationType="fade" onRequestClose={() => setShowPicker(false)}>
        <TouchableOpacity style={sc.overlay} onPress={() => setShowPicker(false)} activeOpacity={1}>
          <View style={sc.pickerCard}>
            <View style={sc.yearRow}>
              <TouchableOpacity onPress={() => setSelYear(y => y - 1)}>
                <Ionicons name="chevron-back" size={20} color="#1565C0" />
              </TouchableOpacity>
              <Text style={sc.yearTxt}>{selYear}</Text>
              <TouchableOpacity
                onPress={() => setSelYear(y => y + 1)}
                disabled={selYear >= now.getFullYear()}
              >
                <Ionicons name="chevron-forward" size={20} color={selYear >= now.getFullYear() ? "#D1D5DB" : "#1565C0"} />
              </TouchableOpacity>
            </View>
            {MONTHS.map(m => (
              <TouchableOpacity
                key={m}
                style={[sc.pickerItem, selMonth === m && sc.pickerItemActive]}
                onPress={() => { setSelMonth(m); setShowPicker(false); }}
              >
                <Text style={[sc.pickerTxt, selMonth === m && sc.pickerTxtActive]}>{m}</Text>
                {selMonth === m && <Ionicons name="checkmark" size={16} color="#1565C0" />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const sc = StyleSheet.create({
  root:             { flex: 1, backgroundColor: "#F3F4F6" },
  header:           { paddingHorizontal: 16, paddingBottom: 16 },
  headerRow:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  backBtn:          { flexDirection: "row", alignItems: "center", gap: 6 },
  backTxt:          { color: "#fff", fontSize: 14, fontWeight: "600" },
  headerTitle:      { fontSize: 16, fontWeight: "900", color: "#fff", letterSpacing: 1 },
  scroll:           { padding: 14, gap: 12, paddingBottom: 30 },
  card:             { backgroundColor: "#fff", borderRadius: 20, padding: 16, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  profileRow:       { flexDirection: "row", alignItems: "flex-start" },
  photo:            { width: 90, height: 90, borderRadius: 45 },
  photoPlaceholder: { width: 90, height: 90, borderRadius: 45, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  driverName:       { fontSize: 20, fontWeight: "800", color: "#0D1B3E", marginBottom: 6 },
  badgeRow:         { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  badge:            { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  badgeGreen:       { backgroundColor: "#DCFCE7" },
  badgeRed:         { backgroundColor: "#FEE2E2" },
  badgeTxt:         { fontSize: 11, fontWeight: "800" },
  vehicleReg:       { fontSize: 13, fontWeight: "700", color: "#1565C0" },
  detailRow:        { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  detailTxt:        { fontSize: 13, color: "#6B7280" },
  filterCard:       { paddingHorizontal: 16, paddingVertical: 14, borderRadius: 0, marginHorizontal: -14 },
  filterRow:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  filterLabel:      { fontSize: 15, color: "#fff", fontWeight: "600" },
  dropdown:         { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#fff", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  dropdownTxt:      { fontSize: 14, color: "#1565C0", fontWeight: "600" },
  sectionTitle:     { fontSize: 13, fontWeight: "800", color: "#1565C0", textAlign: "center", letterSpacing: 1, marginBottom: 4 },
  remarkLabel:      { fontSize: 18, fontWeight: "900", letterSpacing: 1 },
  remarkDesc:       { fontSize: 13, color: "#6B7280", textAlign: "center", lineHeight: 18, marginTop: 8 },
  evRow:            { flexDirection: "row", alignItems: "center", paddingVertical: 6, gap: 6 },
  evLabel:          { flex: 1, fontSize: 12, color: "#374151", fontWeight: "600" },
  evCount:          { fontSize: 13, fontWeight: "800", minWidth: 24, textAlign: "right" },
  overlay:          { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center" },
  pickerCard:       { backgroundColor: "#fff", borderRadius: 16, padding: 8, width: 260, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 16, elevation: 10 },
  yearRow:          { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#E5E7EB" },
  yearTxt:          { fontSize: 15, fontWeight: "800", color: "#0D1B3E" },
  pickerItem:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10 },
  pickerItemActive: { backgroundColor: "#EFF6FF" },
  pickerTxt:        { fontSize: 14, color: "#374151", fontWeight: "600" },
  pickerTxtActive:  { color: "#1565C0", fontWeight: "800" },
});

export default DriverScorecardScreen;
