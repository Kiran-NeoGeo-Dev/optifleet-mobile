import { useCallback, useRef, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  FlatList, ActivityIndicator, Modal, StatusBar, Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { Toast, useToast } from "../../components/Toast";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { api } from "../../services/api";
import { ENDPOINTS } from "../../config/apiConfig";
import { useAuth } from "../../hooks/useAuth";

export interface TripItem {
  id: number;
  tripId: string;
  vehicleId: string;
  driverName: string;
  driverId?: number;
  startPlace: string;
  endPlace: string;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  distanceKm: number;
  duration: string;
  status: string;
  customPolyline: string | null;
  updatedAt?: string;
  plannedEndTime?: string | null;
}

const { width: SW } = Dimensions.get("window");

const STATUS_FILTER_COLOR: Record<string, { bg: string; border: string }> = {
  "All Statuses": { bg: "#059669",  border: "#047857" },
  "Not Started":  { bg: "#6B7280",  border: "#4B5563" },
  "In Progress":  { bg: "#1565C0",  border: "#0D3B8E" },
  "Completed":    { bg: "#16A34A",  border: "#15803D" },
  "Delayed":      { bg: "#B45309",  border: "#92400E" },
};

const STATUS_OPTIONS = ["All Statuses", "Not Started", "In Progress", "Completed", "Delayed"];

const STATUS_STYLE: Record<string, { color: string; bg: string; border: string; icon: any; headerColors: [string, string] }> = {
  "Completed":   { color: "#16A34A", bg: "#DCFCE7", border: "#86EFAC", icon: "checkmark-circle",  headerColors: ["#14532D", "#16A34A"] },
  "In Progress": { color: "#1565C0", bg: "#DBEAFE", border: "#93C5FD", icon: "radio-button-on",   headerColors: ["#0D3B8E", "#1565C0"] },
  "Delayed":     { color: "#B45309", bg: "#FEF3C7", border: "#FCD34D", icon: "warning",           headerColors: ["#78350F", "#B45309"] },
  "Not Started": { color: "#6B7280", bg: "#F3F4F6", border: "#D1D5DB", icon: "time-outline",      headerColors: ["#374151", "#6B7280"] },
};

const getStatus = (s: string) => STATUS_STYLE[s] ?? STATUS_STYLE["Not Started"];

interface Props { navigation: any; }

const TripManagementScreen = ({ navigation }: Props) => {
  const { isAdmin } = useAuth();
  const [trips, setTrips]               = useState<TripItem[]>([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState("");
  const [statusFilter, setStatusFilter] = useState("All Statuses");
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TripItem | null>(null);
  const { toast, showToast, hideToast } = useToast();

  const isFocused = useRef(false);

  const loadTrips = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.get<TripItem[]>(ENDPOINTS.TRIPS);
      setTrips(res.data ?? []);
    } catch {
      if (!silent) showToast("Failed to load trips.", "error");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    isFocused.current = true;
    loadTrips();
    const interval = setInterval(() => {
      if (isFocused.current) loadTrips(true);
    }, 30_000);
    return () => {
      isFocused.current = false;
      clearInterval(interval);
    };
  }, [loadTrips]));

  const filtered = trips.filter(t => {
    const q = search.toLowerCase();
    const matchSearch = !q || t.tripId?.toLowerCase().includes(q) || t.vehicleId?.toLowerCase().includes(q) || t.driverName?.toLowerCase().includes(q);
    const matchStatus = statusFilter === "All Statuses" || t.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`${ENDPOINTS.TRIPS}/${deleteTarget.id}`);
      showToast("Trip deleted.", "success");
      setDeleteTarget(null);
      loadTrips(true);
    } catch {
      showToast("Failed to delete trip.", "error");
      setDeleteTarget(null);
    }
  };

  const renderItem = ({ item }: { item: TripItem }) => {
    const st = getStatus(item.status);
    return (
      <View style={styles.card}>
        {/* Gradient header strip — color reflects trip status */}
        <LinearGradient
          colors={st.headerColors}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={styles.cardHeader}
        >
          <View style={styles.tripIdWrap}>
            <View style={styles.tripIconBox}>
              <Ionicons name="navigate-outline" size={13} color="#fff" />
            </View>
            <Text style={styles.tripId} numberOfLines={1}>{item.tripId}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: st.bg, borderColor: st.border }]}>
            <Ionicons name={st.icon} size={11} color={st.color} />
            <Text style={[styles.statusText, { color: st.color }]}>{item.status}</Text>
          </View>
        </LinearGradient>

        <View style={styles.cardBody}>
          {/* Route row */}
          <View style={styles.routeRow}>
            <View style={styles.routePoint}>
              <View style={[styles.routeDot, { backgroundColor: "#16A34A" }]} />
              <Text style={styles.routeTxt} numberOfLines={1}>{item.startPlace?.split(",")[0] || "—"}</Text>
            </View>
            <View style={styles.routeLine}>
              <View style={styles.routeDash} />
              <Ionicons name="arrow-forward" size={11} color="#9CA3AF" />
              <View style={styles.routeDash} />
            </View>
            <View style={styles.routePoint}>
              <View style={[styles.routeDot, { backgroundColor: "#EF4444" }]} />
              <Text style={styles.routeTxt} numberOfLines={1}>{item.endPlace?.split(",")[0] || "—"}</Text>
            </View>
          </View>

          {/* Details chips */}
          <View style={styles.chipsRow}>
            <View style={styles.chip}>
              <Ionicons name="car-sport-outline" size={12} color="#0D3B8E" />
              <Text style={styles.chipTxt}>{item.vehicleId || "—"}</Text>
            </View>
            <View style={styles.chip}>
              <Ionicons name="person-circle-outline" size={12} color="#0D3B8E" />
              <Text style={styles.chipTxt}>{item.driverName || "—"}</Text>
            </View>
            {item.distanceKm > 0 && (
              <View style={[styles.chip, styles.chipDist]}>
                <Ionicons name="speedometer-outline" size={12} color="#B45309" />
                <Text style={[styles.chipTxt, { color: "#92400E" }]}>{item.distanceKm} km</Text>
              </View>
            )}
            {!!item.duration && (
              <View style={[styles.chip, styles.chipDuration]}>
                <Ionicons name="time-outline" size={12} color="#6B21A8" />
                <Text style={[styles.chipTxt, { color: "#581C87" }]}>{item.duration}</Text>
              </View>
            )}
          </View>

          {/* Action buttons */}
          <View style={styles.actions}>
            <TouchableOpacity style={[styles.actionBtn, styles.trackBtn]}
              onPress={() => navigation.navigate("TripLiveTracking", { trip: item })}>
              <Ionicons name="radio-outline" size={14} color="#fff" />
              <Text style={styles.actionBtnTxt}>Track</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.editBtn]}
              onPress={() => navigation.navigate("EditTrip", { trip: item })}>
              <Ionicons name="create-outline" size={14} color="#fff" />
              <Text style={styles.actionBtnTxt}>Edit</Text>
            </TouchableOpacity>
            {isAdmin && (
              <TouchableOpacity style={[styles.actionBtn, styles.deleteBtn]}
                onPress={() => setDeleteTarget(item)}>
                <Ionicons name="trash-outline" size={14} color="#fff" />
                <Text style={styles.actionBtnTxt}>Delete</Text>
              </TouchableOpacity>
            )}
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
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={styles.headerGrad}
      >
        <SafeAreaView edges={["top"]}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
              <Ionicons name="arrow-back" size={20} color="#fff" />
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>Trip Management</Text>
              <Text style={styles.headerSub}>Monitor & manage all trips</Text>
            </View>
            <View style={styles.tripCountBadge}>
              <Text style={styles.tripCountTxt}>{filtered.length}</Text>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <SafeAreaView style={styles.safe} edges={["bottom", "left", "right"]}>

        {/* ── Search + Filter bar ── */}
        <View style={styles.searchCard}>
          <View style={styles.searchBox}>
            <View style={styles.searchIconBox}>
              <Ionicons name="search-outline" size={16} color="#9C6B30" />
            </View>
            <TextInput
              style={styles.searchInput}
              placeholder="Search Trip ID, Vehicle, Driver..."
              placeholderTextColor="#9C6B30"
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch("")}>
                <Ionicons name="close-circle" size={18} color="#9C6B30" />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            style={[styles.filterBtn, { backgroundColor: STATUS_FILTER_COLOR[statusFilter].bg, borderColor: STATUS_FILTER_COLOR[statusFilter].border }]}
            onPress={() => setShowStatusPicker(true)}
          >
            <Ionicons name="options-outline" size={16} color="#fff" />
            <Text style={styles.filterBtnTxt}>
              {statusFilter === "All Statuses" ? "Filter" : statusFilter.split(" ")[0]}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── List ── */}
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#1565C0" />
            <Text style={styles.loadingTxt}>Loading trips...</Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={item => String(item.id)}
            renderItem={renderItem}
            extraData={filtered}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <View style={styles.emptyIconBox}>
                  <Ionicons name="map-outline" size={40} color="#1565C0" />
                </View>
                <Text style={styles.emptyTitle}>No trips found</Text>
                <Text style={styles.emptySubtitle}>Try adjusting your search or filter</Text>
              </View>
            }
          />
        )}
      </SafeAreaView>

      {/* ── Status Picker Modal ── */}
      <Modal visible={showStatusPicker} transparent animationType="fade" onRequestClose={() => setShowStatusPicker(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowStatusPicker(false)}>
          <View style={styles.pickerBox}>
            <Text style={styles.pickerTitle}>Filter by Status</Text>
            {STATUS_OPTIONS.map(s => {
              const fc = STATUS_FILTER_COLOR[s];
              const isActive = statusFilter === s;
              return (
                <TouchableOpacity
                  key={s}
                  style={[styles.pickerItem, isActive && { backgroundColor: fc.bg + "22" }]}
                  onPress={() => { setStatusFilter(s); setShowStatusPicker(false); }}
                >
                  <View style={[styles.pickerDot, { backgroundColor: fc.bg }]} />
                  <Text style={[styles.pickerText, isActive && { color: fc.bg, fontWeight: "700" }]}>{s}</Text>
                  {isActive && <Ionicons name="checkmark" size={16} color={fc.bg} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>

      <ConfirmDialog
        visible={!!deleteTarget}
        title="Delete Trip"
        message={`Delete trip ${deleteTarget?.tripId}? This cannot be undone.`}
        confirmText="Delete" cancelText="Cancel" confirmColor="#DC2626" icon="trash-outline"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
      <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={hideToast} />
    </View>
  );
};

const styles = StyleSheet.create({
  root:             { flex: 1, backgroundColor: "#F3F4F6" },
  safe:             { flex: 1 },

  // Header
  headerGrad:       { paddingHorizontal: 16, paddingBottom: 12 },
  header:           { flexDirection: "row", alignItems: "center", paddingTop: 8, gap: 10 },
  backBtn:          { width: 36, height: 36, borderRadius: 11, backgroundColor: "rgba(255,255,255,0.15)", borderWidth: 1, borderColor: "rgba(255,255,255,0.20)", alignItems: "center", justifyContent: "center" },
  headerCenter:     { flex: 1 },
  headerTitle:      { fontSize: 18, fontWeight: "800", color: "#fff", letterSpacing: 0.2 },
  headerSub:        { fontSize: 11, color: "rgba(255,255,255,0.65)", marginTop: 1 },
  tripCountBadge:   { backgroundColor: "rgba(255,255,255,0.20)", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: "rgba(255,255,255,0.25)" },
  tripCountTxt:     { fontSize: 14, fontWeight: "800", color: "#fff" },

  // Search card
  searchCard:       { marginHorizontal: 14, marginTop: 10, marginBottom: 10, flexDirection: "row", gap: 8, alignItems: "center" },
  searchBox:        { flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: "#E8CBA7", borderRadius: 10, paddingHorizontal: 10, height: 40, gap: 6, borderWidth: 1, borderColor: "rgba(120,70,20,0.22)" },
  searchIconBox:    { width: 22, height: 22, borderRadius: 6, backgroundColor: "rgba(120,70,20,0.12)", alignItems: "center", justifyContent: "center" },
  searchInput:      { flex: 1, fontSize: 12, color: "#2B1D0E", fontWeight: "500" },
  filterBtn:        { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#059669", borderRadius: 10, paddingHorizontal: 10, height: 40, borderWidth: 1.5, borderColor: "#047857" },
  filterBtnActive:  { backgroundColor: "#F59E0B", borderColor: "#D97706" },
  filterBtnTxt:     { fontSize: 11, color: "#fff", fontWeight: "800" },

  // List
  list:             { paddingHorizontal: 14, paddingBottom: 80 },

  // Trip card
  card:             { backgroundColor: "#fff", borderRadius: 14, marginBottom: 10, overflow: "hidden", shadowColor: "#0A1F44", shadowOpacity: 0.14, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 5 },
  cardHeader:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 9 },
  cardBody:         { padding: 11 },
  tripIdWrap:       { flexDirection: "row", alignItems: "center", gap: 6, flex: 1 },
  tripIconBox:      { width: 22, height: 22, borderRadius: 6, backgroundColor: "rgba(255,255,255,0.22)", alignItems: "center", justifyContent: "center" },
  tripId:           { fontSize: 12, fontWeight: "800", color: "#fff", flex: 1, letterSpacing: 0.2 },
  statusBadge:      { flexDirection: "row", alignItems: "center", gap: 3, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1 },
  statusText:       { fontSize: 10, fontWeight: "700" },

  // Route
  routeRow:         { flexDirection: "row", alignItems: "center", marginBottom: 9, gap: 4 },
  routePoint:       { flex: 1, flexDirection: "row", alignItems: "center", gap: 5 },
  routeDot:         { width: 8, height: 8, borderRadius: 4 },
  routeTxt:         { fontSize: 12, color: "#1A2F5C", fontWeight: "700", flex: 1 },
  routeLine:        { flexDirection: "row", alignItems: "center", gap: 2 },
  routeDash:        { width: 8, height: 1.5, backgroundColor: "#CBD5E1", borderRadius: 1 },

  // Chips
  chipsRow:         { flexDirection: "row", gap: 6, flexWrap: "wrap", marginBottom: 10 },
  chip:             { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#EFF6FF", borderRadius: 7, paddingHorizontal: 7, paddingVertical: 4, borderWidth: 1, borderColor: "#BFDBFE" },
  chipDist:         { backgroundColor: "#FFFBEB", borderColor: "#FDE68A" },
  chipDuration:     { backgroundColor: "#F5F3FF", borderColor: "#DDD6FE" },
  chipTxt:          { fontSize: 10, color: "#1E3A6D", fontWeight: "700" },

  // Actions
  actions:          { flexDirection: "row", gap: 6 },
  actionBtn:        { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, borderRadius: 9, paddingVertical: 8 },
  actionBtnTxt:     { fontSize: 11, fontWeight: "800", color: "#fff", letterSpacing: 0.2 },
  trackBtn:         { backgroundColor: "#059669" },
  editBtn:          { backgroundColor: "#F59E0B" },
  deleteBtn:        { backgroundColor: "#EF4444" },

  // States
  center:           { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 60 },
  loadingTxt:       { color: "#6B7280", marginTop: 12, fontSize: 14 },
  emptyBox:         { alignItems: "center", paddingTop: 48 },
  emptyIconBox:     { width: 64, height: 64, borderRadius: 18, backgroundColor: "#EFF6FF", alignItems: "center", justifyContent: "center", marginBottom: 12, elevation: 2 },
  emptyTitle:       { fontSize: 16, fontWeight: "800", color: "#0D1B3E", marginBottom: 4 },
  emptySubtitle:    { fontSize: 12, color: "#6B7280" },

  // Modal
  modalOverlay:     { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", alignItems: "center" },
  pickerBox:        { backgroundColor: "#FFFFFF", borderRadius: 18, padding: 6, minWidth: SW * 0.75, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 16, elevation: 16 },
  pickerTitle:      { fontSize: 13, fontWeight: "800", color: "#0D1B3E", paddingHorizontal: 14, paddingVertical: 10, letterSpacing: 0.3 },
  pickerItem:       { flexDirection: "row", alignItems: "center", paddingVertical: 11, paddingHorizontal: 14, borderRadius: 11, gap: 8 },
  pickerItemActive: { backgroundColor: "#DBEAFE" },
  pickerDot:        { width: 9, height: 9, borderRadius: 5 },
  pickerText:       { flex: 1, fontSize: 13, color: "#374151", fontWeight: "600" },
});

export default TripManagementScreen;
