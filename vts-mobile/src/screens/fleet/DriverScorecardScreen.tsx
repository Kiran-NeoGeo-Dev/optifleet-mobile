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
const PIE  = 220;
const CX   = PIE / 2;
const CY   = PIE / 2;
const OR   = 94;
const IR   = 58;
const GAP  = 3;
const EACH = 360 / TIERS.length;

const makeArc = (startDeg: number, endDeg: number, expand = false) => {
  const r  = expand ? OR + 7 : OR;
  const ir = expand ? IR - 4 : IR;
  const toXY = (deg: number, radius: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return { x: CX + radius * Math.cos(rad), y: CY + radius * Math.sin(rad) };
  };
  const s = startDeg + GAP / 2;
  const e = endDeg   - GAP / 2;
  const lg = e - s > 180 ? 1 : 0;
  const o1 = toXY(s, r),  o2 = toXY(e, r);
  const i1 = toXY(e, ir), i2 = toXY(s, ir);
  return `M${o1.x} ${o1.y} A${r} ${r} 0 ${lg} 1 ${o2.x} ${o2.y} L${i1.x} ${i1.y} A${ir} ${ir} 0 ${lg} 0 ${i2.x} ${i2.y}Z`;
};

const ScorePieChart = ({ rawScore, remark }: { rawScore: number; remark: string }) => {
  const activeColor = rawScoreColor(rawScore);
  const activeTier  = remarkToTierIndex(remark);

  return (
    <View style={{ alignItems: "center" }}>
      <View style={pie.chartShadow}>
        <Svg width={PIE} height={PIE}>
          {TIERS.map((t, i) => {
            const start    = i * EACH;
            const isActive = i === activeTier;
            return (
              <Path
                key={t.label}
                d={makeArc(start, start + EACH, isActive)}
                fill={isActive ? t.color : t.color + "35"}
                stroke={isActive ? t.color : "#fff"}
                strokeWidth={isActive ? 0 : 1.5}
                opacity={isActive ? 1 : 0.85}
              />
            );
          })}
          <Circle cx={CX} cy={CY} r={IR + 2} fill="rgba(0,0,0,0.04)" />
          <Circle cx={CX} cy={CY} r={IR - 1} fill="#fff" />
          <SvgText x={CX} y={CY - 8} textAnchor="middle" fontSize="26" fontWeight="900" fill={activeColor}>
            {rawScore.toFixed(2)}
          </SvgText>
          <SvgText x={CX} y={CY + 10} textAnchor="middle" fontSize="8" fontWeight="700" fill="#9CA3AF">
            SAFETY SCORE
          </SvgText>
        </Svg>
      </View>

      {/* Tier legend chips */}
      <View style={pie.legend}>
        {TIERS.map((t, i) => {
          const isActive = i === activeTier;
          return (
            <View key={t.label} style={[pie.chip, isActive && { borderColor: t.color, borderWidth: 1.5, backgroundColor: t.color + "15" }]}>
              <View style={[pie.dot, { backgroundColor: t.color }]} />
              <Text style={[pie.chipTxt, isActive && { color: t.color, fontWeight: "800" }]}>{t.label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const pie = StyleSheet.create({
  chartShadow:   { shadowColor: "#000", shadowOpacity: 0.10, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  legend:        { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 6, marginTop: 14 },
  chip:          { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, backgroundColor: "#F3F4F6", borderWidth: 1, borderColor: "transparent" },
  dot:           { width: 7, height: 7, borderRadius: 4 },
  chipTxt:       { fontSize: 12, color: "#374151", fontWeight: "700" },
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
  const [tempYear,   setTempYear]   = useState(now.getFullYear());
  const [tempMonth,  setTempMonth]  = useState<MonthName>(MONTHS[now.getMonth()]);

  const openPicker  = () => { setTempYear(selYear); setTempMonth(selMonth); setShowPicker(true); };
  const applyPicker = () => { setSelYear(tempYear); setSelMonth(tempMonth); setShowPicker(false); };

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

  const accentColor = driver.active ? "#22C55E" : "#EF4444";

  const EVENT_ROWS = [
    { icon: "flame-outline",       label: "Smoking",     count: events.smoking,     color: "#EF4444", bg: "#FEE2E2" },
    { icon: "call-outline",        label: "Mobile",      count: events.mobile,      color: "#F59E0B", bg: "#FEF3C7" },
    { icon: "speedometer-outline", label: "Overspeed",   count: events.overspeed,   color: "#F97316", bg: "#FFEDD5" },
    { icon: "moon-outline",        label: "Drowsy",      count: events.drowsiness,  color: "#8B5CF6", bg: "#EDE9FE" },
    { icon: "shield-outline",      label: "Seatbelt",    count: events.seatbelt,    color: "#10B981", bg: "#D1FAE5" },
    { icon: "eye-off-outline",     label: "Distraction", count: events.distraction, color: "#EC4899", bg: "#FCE7F3" },
  ] as const;

  return (
    <View style={sc.root}>

      {/* ── Header ── */}
      <LinearGradient
        colors={["#0A1F44", "#0D3B8E", "#1565C0"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={sc.header}
      >
        <SafeAreaView edges={["top"]}>
          <View style={sc.headerRow}>
            <TouchableOpacity style={sc.backBtn} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={20} color="#fff" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={sc.headerTitle}>Driver Scorecard</Text>
              <Text style={sc.headerSub}>Safety Performance Report</Text>
            </View>
            {/* Active status pill */}
            <View style={[sc.statusPill, { backgroundColor: driver.active ? "rgba(34,197,94,0.20)" : "rgba(239,68,68,0.20)", borderColor: driver.active ? "rgba(34,197,94,0.45)" : "rgba(239,68,68,0.45)" }]}>
              <View style={[sc.statusDot, { backgroundColor: accentColor }]} />
              <Text style={[sc.statusTxt, { color: accentColor }]}>{driver.active ? "ACTIVE" : "INACTIVE"}</Text>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={sc.scroll}>

        {/* ── Driver Hero Card ── */}
        <View style={sc.heroCard}>
          <View style={[sc.accentBar, { backgroundColor: accentColor }]} />
          <View style={sc.heroInner}>
            {/* Avatar */}
            <View style={[sc.avatarRing, { borderColor: accentColor + "55" }]}>
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={sc.photo} onError={() => setImgError(true)} />
              ) : (
                <View style={sc.photoPlaceholder}>
                  <Ionicons name="person" size={34} color="#9CA3AF" />
                </View>
              )}
            </View>
            {/* Info */}
            <View style={{ flex: 1 }}>
              <Text style={sc.driverName}>{driver.driverName}</Text>
              <View style={sc.detailRow}>
                <Ionicons name="bus-outline" size={13} color="#1565C0" />
                <Text style={sc.vehicleReg}>{driver.vehicleRegNo ?? "—"}</Text>
              </View>
              {vehicleModel && (
                <View style={sc.detailRow}>
                  <Ionicons name="car-sport-outline" size={13} color="#6B7280" />
                  <Text style={sc.detailTxt}>{vehicleModel}</Text>
                </View>
              )}
              <View style={sc.detailRow}>
                <Ionicons name="call-outline" size={13} color="#6B7280" />
                <Text style={sc.detailTxt}>{driver.phoneNumber ?? "—"}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── Month Filter Card ── */}
        <LinearGradient
          colors={["#0D3B8E", "#1565C0"]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={sc.filterCard}
        >
          <View style={sc.filterRow}>
            <View style={sc.filterLeft}>
              <View style={sc.filterIconBox}>
                <Ionicons name="calendar-outline" size={18} color="#1565C0" />
              </View>
              <View>
                <Text style={sc.filterTitle}>Monthly Score</Text>
                <Text style={sc.filterSub}>{selMonth} {selYear}</Text>
              </View>
            </View>
            <TouchableOpacity style={sc.dropdown} onPress={openPicker}>
              <Text style={sc.dropdownTxt}>Change</Text>
              <Ionicons name="chevron-down" size={15} color="#1565C0" />
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* ── Overall Safety Score Card ── */}
        <View style={sc.card}>
          <Text style={sc.sectionTitle}>OVERALL SAFETY SCORE</Text>
          {loading ? (
            <ActivityIndicator color="#1565C0" style={{ marginVertical: 40 }} />
          ) : hasNoData ? (
            <View style={sc.emptyState}>
              <View style={sc.emptyIconBox}>
                <Ionicons name="analytics-outline" size={40} color="#D1D5DB" />
              </View>
              <Text style={sc.emptyTitle}>No trip data for this month</Text>
              <Text style={sc.emptyDesc}>Score requires completed trip distance</Text>
            </View>
          ) : (
            <>
              <View style={{ alignItems: "center", marginVertical: 8 }}>
                <ScorePieChart rawScore={rawScore} remark={remark} />
              </View>
              {/* Remark banner */}
              <View style={[sc.remarkBanner, { backgroundColor: remarkColor(remark) + "12", borderColor: remarkColor(remark) + "40" }]}>
                <View style={[sc.remarkDot, { backgroundColor: remarkColor(remark) }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[sc.remarkLabel, { color: remarkColor(remark) }]}>{remark.toUpperCase()}</Text>
                  <Text style={sc.remarkDesc}>{REMARK_DESC[remark] ?? ""}</Text>
                </View>
              </View>
            </>
          )}
        </View>

        {/* ── Events Card ── */}
        {data && (
          <View style={sc.card}>
            <Text style={sc.sectionTitle}>EVENTS — {selMonth.toUpperCase()} {selYear}</Text>
            <View style={sc.evList}>
              {EVENT_ROWS.map((r, idx) => (
                <View key={r.label} style={[sc.evRow, idx < EVENT_ROWS.length - 1 && sc.evRowBorder]}>
                  <View style={[sc.evIconBox, { backgroundColor: r.bg }]}>
                    <Ionicons name={r.icon as any} size={15} color={r.color} />
                  </View>
                  <Text style={sc.evLabel}>{r.label}</Text>
                  <View style={[sc.evCountBadge, { backgroundColor: r.count > 0 ? r.bg : "#F3F4F6" }]}>
                    <Text style={[sc.evCount, { color: r.count > 0 ? r.color : "#9CA3AF" }]}>{r.count}</Text>
                  </View>
                </View>
              ))}
              {/* KM Driven — distinct separator row */}
              <View style={[sc.evRow, sc.kmRow]}>
                <View style={[sc.evIconBox, { backgroundColor: "#DBEAFE" }]}>
                  <Ionicons name="speedometer-outline" size={15} color="#1565C0" />
                </View>
                <Text style={[sc.evLabel, { color: "#0D1B3E", fontWeight: "700" }]}>KM Driven</Text>
                <View style={[sc.evCountBadge, { backgroundColor: "#DBEAFE" }]}>
                  <Text style={[sc.evCount, { color: "#1565C0" }]}>{events.kmDriven.toFixed(1)}</Text>
                </View>
              </View>
            </View>
          </View>
        )}

      </ScrollView>

      {/* ── Month-Year Grid Picker Modal ── */}
      <Modal visible={showPicker} transparent animationType="fade" onRequestClose={() => setShowPicker(false)}>
        <View style={sc.overlay}>
          <View style={sc.pickerCard}>
            <Text style={sc.pickerTitle}>Select Month</Text>
            <View style={sc.yearRow}>
              <TouchableOpacity style={sc.yearBtn} onPress={() => setTempYear(y => y - 1)}>
                <Ionicons name="chevron-back" size={20} color="#1565C0" />
              </TouchableOpacity>
              <Text style={sc.yearTxt}>{tempYear}</Text>
              <TouchableOpacity
                style={sc.yearBtn}
                onPress={() => setTempYear(y => y + 1)}
                disabled={tempYear >= now.getFullYear()}
              >
                <Ionicons name="chevron-forward" size={20} color={tempYear >= now.getFullYear() ? "#D1D5DB" : "#1565C0"} />
              </TouchableOpacity>
            </View>
            <View style={sc.monthGrid}>
              {MONTHS.map(m => {
                const isSelected = tempMonth === m;
                return (
                  <TouchableOpacity
                    key={m}
                    style={[sc.monthCell, isSelected && sc.monthCellActive]}
                    onPress={() => setTempMonth(m)}
                    activeOpacity={0.7}
                  >
                    <Text style={[sc.monthCellTxt, isSelected && sc.monthCellTxtActive]}>
                      {m.slice(0, 3)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={sc.pickerActions}>
              <TouchableOpacity style={sc.cancelBtn} onPress={() => setShowPicker(false)}>
                <Text style={sc.cancelBtnTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={sc.applyBtn} onPress={applyPicker}>
                <Text style={sc.applyBtnTxt}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const sc = StyleSheet.create({
  root:             { flex: 1, backgroundColor: "#F3F4F6" },

  // Header
  header:           { paddingHorizontal: 16, paddingBottom: 20 },
  headerRow:        { flexDirection: "row", alignItems: "center", gap: 14, marginTop: 8 },
  backBtn:          { width: 42, height: 42, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  headerTitle:      { fontSize: 20, fontWeight: "800", color: "#fff" },
  headerSub:        { fontSize: 12, color: "rgba(255,255,255,0.70)", marginTop: 2 },
  statusPill:       { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1 },
  statusDot:        { width: 7, height: 7, borderRadius: 4 },
  statusTxt:        { fontSize: 10, fontWeight: "800", letterSpacing: 0.6 },

  scroll:           { padding: 14, gap: 12, paddingBottom: 30 },

  // Hero card
  heroCard:         { backgroundColor: "#fff", borderRadius: 20, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  accentBar:        { height: 4, width: "100%" },
  heroInner:        { flexDirection: "row", alignItems: "center", gap: 16, padding: 16 },
  avatarRing:       { width: 80, height: 80, borderRadius: 40, borderWidth: 2.5, padding: 2 },
  photo:            { width: "100%", height: "100%", borderRadius: 37 },
  photoPlaceholder: { width: "100%", height: "100%", borderRadius: 37, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  driverName:       { fontSize: 17, fontWeight: "800", color: "#0D1B3E", marginBottom: 6 },
  detailRow:        { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  detailTxt:        { fontSize: 12, color: "#6B7280", fontWeight: "500" },
  vehicleReg:       { fontSize: 13, fontWeight: "700", color: "#1565C0" },

  // Filter card
  filterCard:       { paddingHorizontal: 16, paddingVertical: 14, borderRadius: 16 },
  filterRow:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  filterLeft:       { flexDirection: "row", alignItems: "center", gap: 12 },
  filterIconBox:    { width: 38, height: 38, borderRadius: 10, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  filterTitle:      { fontSize: 14, color: "#fff", fontWeight: "700" },
  filterSub:        { fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 2 },
  dropdown:         { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#fff", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9 },
  dropdownTxt:      { fontSize: 13, color: "#1565C0", fontWeight: "700" },

  // Generic card
  card:             { backgroundColor: "#fff", borderRadius: 20, padding: 16, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  sectionTitle:     { fontSize: 12, fontWeight: "800", color: "#1565C0", letterSpacing: 1.2, marginBottom: 16, textTransform: "uppercase" },

  // Empty state
  emptyState:       { alignItems: "center", paddingVertical: 32, gap: 10 },
  emptyIconBox:     { width: 72, height: 72, borderRadius: 36, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  emptyTitle:       { fontSize: 15, color: "#374151", fontWeight: "700" },
  emptyDesc:        { fontSize: 12, color: "#9CA3AF", textAlign: "center" },

  // Remark banner
  remarkBanner:     { flexDirection: "row", alignItems: "flex-start", gap: 12, borderWidth: 1, borderRadius: 14, padding: 14, marginTop: 16 },
  remarkDot:        { width: 10, height: 10, borderRadius: 5, marginTop: 3 },
  remarkLabel:      { fontSize: 16, fontWeight: "900", letterSpacing: 1, marginBottom: 4 },
  remarkDesc:       { fontSize: 13, color: "#374151", lineHeight: 19, fontWeight: "600" },

  // Events
  evList:           { gap: 0 },
  evRow:            { flexDirection: "row", alignItems: "center", paddingVertical: 10, gap: 12 },
  evRowBorder:      { borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  kmRow:            { marginTop: 4, borderTopWidth: 1.5, borderTopColor: "#E5E7EB", paddingTop: 12 },
  evIconBox:        { width: 32, height: 32, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  evLabel:          { flex: 1, fontSize: 13, color: "#374151", fontWeight: "600" },
  evCountBadge:     { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, minWidth: 36, alignItems: "center" },
  evCount:          { fontSize: 13, fontWeight: "800" },

  // Picker modal
  overlay:          { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
  pickerCard:       { backgroundColor: "#fff", borderRadius: 20, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16, width: 320, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 20, elevation: 12 },
  pickerTitle:      { fontSize: 16, fontWeight: "800", color: "#0D1B3E", textAlign: "center", marginBottom: 16 },
  yearRow:          { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16, backgroundColor: "#F3F4F6", borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12 },
  yearBtn:          { width: 36, height: 36, borderRadius: 10, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  yearTxt:          { fontSize: 18, fontWeight: "800", color: "#0D1B3E" },
  monthGrid:        { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 },
  monthCell:        { width: "22%", flexGrow: 1, alignItems: "center", justifyContent: "center", paddingVertical: 12, borderRadius: 12, backgroundColor: "#F3F4F6" },
  monthCellActive:  { backgroundColor: "#1565C0" },
  monthCellTxt:     { fontSize: 13, fontWeight: "700", color: "#374151" },
  monthCellTxtActive:{ fontSize: 13, fontWeight: "800", color: "#fff" },
  pickerActions:    { flexDirection: "row", gap: 10 },
  cancelBtn:        { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: "#E5E7EB", alignItems: "center" },
  cancelBtnTxt:     { fontSize: 14, fontWeight: "700", color: "#6B7280" },
  applyBtn:         { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: "#1565C0", alignItems: "center" },
  applyBtnTxt:      { fontSize: 14, fontWeight: "800", color: "#fff" },
});

export default DriverScorecardScreen;
