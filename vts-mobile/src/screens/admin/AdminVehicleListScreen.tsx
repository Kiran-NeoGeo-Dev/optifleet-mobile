import { useCallback, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, StatusBar } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { AdminStackParamList } from "../../navigation/AdminNavigator";
import { Vehicle } from "../../types/Vehicle";
import { fetchAllVehiclesAdmin } from "../../services/adminService";
import { deleteVehicle } from "../../services/vehicleService";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { Toast, useToast } from "../../components/Toast";

type Props = NativeStackScreenProps<AdminStackParamList, "AdminVehicleList">;

const FUEL_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  Petrol:   { color: "#D97706", bg: "rgba(217,119,6,0.10)",   border: "rgba(217,119,6,0.35)" },
  Diesel:   { color: "#2563EB", bg: "rgba(37,99,235,0.10)",   border: "rgba(37,99,235,0.35)" },
  CNG:      { color: "#16A34A", bg: "rgba(22,163,74,0.10)",   border: "rgba(22,163,74,0.35)" },
  Electric: { color: "#7C3AED", bg: "rgba(124,58,237,0.10)",  border: "rgba(124,58,237,0.35)" },
};

const AdminVehicleListScreen = ({ navigation }: Props) => {
  const [vehicles, setVehicles]         = useState<Vehicle[]>([]);
  const [query,    setQuery]            = useState("");
  const [loading,  setLoading]          = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const { toast, showToast, hideToast } = useToast();

  const load = useCallback(() => {
    setLoading(true);
    fetchAllVehiclesAdmin().then(setVehicles).catch(() => setVehicles([])).finally(() => setLoading(false));
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteVehicle(deleteTarget);
      showToast("Vehicle deleted", "success");
      load();
    } catch { showToast("Delete failed", "error"); }
    finally { setDeleteTarget(null); }
  };

  const filtered = vehicles.filter(v =>
    (v.licensePlate || "").toLowerCase().includes(query.toLowerCase()) ||
    (v.ownerName    || "").toLowerCase().includes(query.toLowerCase()) ||
    (v.vehicleMake  || "").toLowerCase().includes(query.toLowerCase())
  );

  const renderCard = ({ item }: { item: Vehicle }) => {
    const fuel = FUEL_COLORS[item.fuelType || ""] ?? { color: "#6B7280", bg: "rgba(107,114,128,0.10)", border: "rgba(107,114,128,0.30)" };
    return (
      <View style={s.card}>
        <View style={[s.accentBar, { backgroundColor: fuel.color }]} />
        <View style={s.inner}>
          <View style={s.topRow}>
            <View style={s.plateWrap}>
              <Ionicons name="shield-checkmark" size={14} color="#1565C0" />
              <Text style={s.plate}>{item.licensePlate}</Text>
            </View>
            {Boolean(item.fuelType) && (
              <View style={[s.fuelBadge, { borderColor: fuel.border, backgroundColor: fuel.bg }]}>
                <Ionicons name="flame" size={11} color={fuel.color} />
                <Text style={[s.fuelTxt, { color: fuel.color }]}>{item.fuelType}</Text>
              </View>
            )}
          </View>
          <View style={s.detailGrid}>
            <View style={s.col}>
              <Text style={s.colLabel}>Owner</Text>
              <Text style={s.colVal}>{item.ownerName || "—"}</Text>
            </View>
            <View style={s.col}>
              <Text style={s.colLabel}>Make / Model</Text>
              <Text style={s.colVal}>{[item.vehicleMake, item.vehicleModel].filter(Boolean).join(" / ") || "—"}</Text>
            </View>
          </View>
          <View style={s.divider} />
          <View style={s.actions}>
            <TouchableOpacity style={[s.btn, { backgroundColor: "rgba(234,179,8,0.10)", borderColor: "rgba(234,179,8,0.35)" }]}
              onPress={() => navigation.navigate("EditVehicle", { vehicleId: item.id })}>
              <Ionicons name="create-outline" size={13} color="#CA8A04" />
              <Text style={[s.btnTxt, { color: "#CA8A04" }]}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.btn, { backgroundColor: "rgba(239,68,68,0.10)", borderColor: "rgba(239,68,68,0.35)" }]}
              onPress={() => setDeleteTarget(item.id)}>
              <Ionicons name="trash-outline" size={13} color="#EF4444" />
              <Text style={[s.btnTxt, { color: "#EF4444" }]}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <StatusBar barStyle="light-content" backgroundColor="#0A1F44" />
      <LinearGradient
        colors={["#0A1F44", "#0D3B8E", "#1565C0"]}
        locations={[0, 0.5, 1]}
        start={{ x: 0.15, y: 0 }} end={{ x: 0.85, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>All Vehicles</Text>
            <Text style={s.subtitle}>Manage registered vehicles</Text>
          </View>
          <View style={s.countBadge}>
            <Text style={s.countTxt}>{filtered.length}</Text>
          </View>
        </View>

        <View style={s.searchWrap}>
          <Ionicons name="search" size={16} color="#5F6F8F" style={{ marginRight: 8 }} />
          <TextInput style={s.searchInput} placeholder="Search by Plate, Owner, Make…" placeholderTextColor="#5F6F8F" value={query} onChangeText={setQuery} />
          {query.length > 0 && <TouchableOpacity onPress={() => setQuery("")}><Ionicons name="close-circle" size={18} color="#5F6F8F" /></TouchableOpacity>}
        </View>

        {loading
          ? <ActivityIndicator color="#fff" size="large" style={{ marginTop: 60 }} />
          : <FlatList data={filtered} keyExtractor={i => i.id.toString()} renderItem={renderCard}
              contentContainerStyle={s.list} showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={s.empty}>
                  <Ionicons name="car-outline" size={48} color="rgba(255,255,255,0.30)" />
                  <Text style={s.emptyTxt}>No vehicles found</Text>
                </View>
              }
            />
        }

        <ConfirmDialog visible={!!deleteTarget} title="Delete Vehicle" message="Are you sure you want to delete this vehicle?"
          confirmText="Delete" cancelText="Cancel" confirmColor="#EF4444" icon="trash-outline"
          onCancel={() => setDeleteTarget(null)} onConfirm={handleDelete} />
        <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={hideToast} />
      </SafeAreaView>
    </View>
  );
};

const s = StyleSheet.create({
  header:      { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8, gap: 10 },
  backBtn:     { width: 36, height: 36, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.12)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  title:       { fontSize: 18, fontWeight: "800", color: "#fff" },
  subtitle:    { fontSize: 11, color: "rgba(255,255,255,0.65)", marginTop: 1 },
  countBadge:  { backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: "rgba(255,255,255,0.25)" },
  countTxt:    { fontSize: 12, fontWeight: "800", color: "#fff" },
  searchWrap:  { flexDirection: "row", alignItems: "center", backgroundColor: "#F0F4FF", borderRadius: 12, marginHorizontal: 14, marginBottom: 10, paddingHorizontal: 12, height: 42, borderWidth: 1, borderColor: "#BFDBFE" },
  searchInput: { flex: 1, fontSize: 13, color: "#10204A", fontWeight: "500" },
  list:        { paddingHorizontal: 14, paddingBottom: 70 },
  card:        { backgroundColor: "#FFFFFF", borderRadius: 12, marginBottom: 8, flexDirection: "row", overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 7, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  accentBar:   { width: 3 },
  inner:       { flex: 1, padding: 11 },
  topRow:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 7 },
  plateWrap:   { flexDirection: "row", alignItems: "center", gap: 5 },
  plate:       { fontSize: 13, fontWeight: "800", color: "#0D1B3E" },
  fuelBadge:   { flexDirection: "row", alignItems: "center", gap: 3, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1 },
  fuelTxt:     { fontSize: 10, fontWeight: "700" },
  detailGrid:  { flexDirection: "row", gap: 12, marginBottom: 7 },
  col:         { flex: 1 },
  colLabel:    { fontSize: 9, color: "#64748B", fontWeight: "700", textTransform: "uppercase", marginBottom: 1 },
  colVal:      { fontSize: 12, color: "#0D1B3E", fontWeight: "600" },
  divider:     { height: 1, backgroundColor: "rgba(15,23,42,0.06)", marginBottom: 7 },
  actions:     { flexDirection: "row", gap: 6 },
  btn:         { flexDirection: "row", alignItems: "center", gap: 3, borderWidth: 1, borderRadius: 7, paddingHorizontal: 8, paddingVertical: 5, height: 28 },
  btnTxt:      { fontSize: 11, fontWeight: "700" },
  empty:       { alignItems: "center", paddingTop: 50, gap: 10 },
  emptyTxt:    { fontSize: 14, color: "rgba(255,255,255,0.65)", fontWeight: "600" },
});

export default AdminVehicleListScreen;
