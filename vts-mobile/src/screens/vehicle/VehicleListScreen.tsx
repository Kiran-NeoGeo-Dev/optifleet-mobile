import { useCallback, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet, StatusBar } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { MainStackParamList } from "../../navigation/MainNavigator";
import { Vehicle } from "../../types/Vehicle";
import { fetchVehicles } from "../../services/vehicleService";
import { COLORS, SHADOWS } from "../../components/ScreenBg";

type Props = NativeStackScreenProps<MainStackParamList, "VehicleList">;

const FUEL_ACCENT: Record<string, string> = {
  Petrol: "#FBBF24", Diesel: "#38BDF8", CNG: "#34D399", Electric: "#A78BFA",
};

const VehicleListScreen = ({ navigation }: Props) => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [query, setQuery] = useState("");

  useFocusEffect(useCallback(() => {
    fetchVehicles().then(setVehicles).catch(() => {});
  }, []));

  const filtered = vehicles.filter(v =>
    (v.licensePlate || "").toLowerCase().includes(query.toLowerCase()) ||
    (v.ownerName || "").toLowerCase().includes(query.toLowerCase()) ||
    (v.vehicleMake || "").toLowerCase().includes(query.toLowerCase())
  );

  const renderCard = ({ item }: { item: Vehicle }) => {
    const isActive = item.status === "ACTIVE";
    const fuelColor = FUEL_ACCENT[item.fuelType || ""] ?? "#5A7A9F";

    return (
      <View style={[styles.card, SHADOWS.card]}>
        <View style={[styles.accentBar, { backgroundColor: fuelColor }]} />
        <View style={styles.cardInner}>
          <View style={styles.topRow}>
            <View style={styles.plateWrap}>
              <Ionicons name="shield-checkmark" size={14} color="#1565C0" />
              <Text style={styles.plate}>{item.licensePlate}</Text>
            </View>
            <View style={[styles.statusPill, {
              backgroundColor: isActive ? "rgba(22,163,74,0.12)" : "rgba(220,38,38,0.12)",
              borderColor: isActive ? "#16A34A55" : "#DC262655",
            }]}>
              <View style={[styles.statusDot, { backgroundColor: isActive ? "#16A34A" : "#DC2626" }]} />
              <Text style={[styles.statusTxt, { color: isActive ? "#16A34A" : "#DC2626" }]}>{item.status}</Text>
            </View>
          </View>

          <View style={styles.detailGrid}>
            <View style={styles.detailCol}>
              <Text style={styles.detailLabel}>Owner</Text>
              <Text style={styles.detailVal}>{item.ownerName || "—"}</Text>
            </View>
            <View style={styles.detailCol}>
              <Text style={styles.detailLabel}>Make / Model</Text>
              <Text style={styles.detailVal}>{[item.vehicleMake, item.vehicleModel].filter(Boolean).join(" / ") || "—"}</Text>
            </View>
          </View>

          <View style={styles.bottomRow}>
            {item.fuelType ? (
              <View style={[styles.fuelBadge, { borderColor: fuelColor + "66", backgroundColor: fuelColor + "18" }]}>
                <Ionicons name="flame" size={12} color={fuelColor} />
                <Text style={[styles.fuelTxt, { color: fuelColor }]}>{item.fuelType}</Text>
              </View>
            ) : <View />}
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
          <Ionicons name="search" size={16} color="#9C6B30" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by Reg. No., Owner, Make…"
            placeholderTextColor="#6B7280"
            value={query}
            onChangeText={setQuery}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery("")}>
              <Ionicons name="close-circle" size={18} color="#9C6B30" />
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
            <View style={styles.empty}>
              <Ionicons name="car-outline" size={52} color="rgba(255,255,255,0.30)" />
              <Text style={styles.emptyTxt}>No vehicles found</Text>
            </View>
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
  backBtn:      { width: 42, height: 42, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.12)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle:  { fontSize: 20, fontWeight: "800", color: "#fff", letterSpacing: 0.2 },
  headerSub:    { fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 2 },

  searchWrap:  { flexDirection: "row", alignItems: "center", backgroundColor: "#E8CBA7", borderRadius: 16, marginHorizontal: 16, marginBottom: 14, paddingHorizontal: 14, height: 54, borderWidth: 1, borderColor: "rgba(120,70,20,0.18)", shadowColor: "#7A4010", shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  searchInput: { flex: 1, fontSize: 15, color: "#2B1D0E", fontWeight: "500" },

  list:        { paddingHorizontal: 16, paddingBottom: 90 },

  card:        { backgroundColor: "rgba(255,255,255,0.92)", borderRadius: 18, marginBottom: 12, flexDirection: "row", overflow: "hidden", shadowColor: "#1A0040", shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 10 },
  accentBar:   { width: 5 },
  cardInner:   { flex: 1, padding: 14 },
  topRow:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  plateWrap:   { flexDirection: "row", alignItems: "center", gap: 6 },
  plate:       { fontSize: 15, fontWeight: "800", color: "#0A1F44" },
  statusPill:  { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },
  statusDot:   { width: 6, height: 6, borderRadius: 3 },
  statusTxt:   { fontSize: 10, fontWeight: "700", textTransform: "uppercase" },
  detailGrid:  { flexDirection: "row", gap: 16, marginBottom: 10 },
  detailCol:   { flex: 1 },
  detailLabel: { fontSize: 10, color: "#5A7A9F", fontWeight: "700", textTransform: "uppercase", marginBottom: 2, letterSpacing: 0.5 },
  detailVal:   { fontSize: 13, color: "#0A1F44", fontWeight: "600" },
  bottomRow:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  fuelBadge:   { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1 },
  fuelTxt:     { fontSize: 12, fontWeight: "700" },
  editBtn:     { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(21,101,192,0.10)", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: "rgba(21,101,192,0.30)" },
  editBtnTxt:  { fontSize: 12, fontWeight: "700", color: "#1565C0" },
  empty:       { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyTxt:    { fontSize: 16, color: "rgba(255,255,255,0.65)", fontWeight: "600" },
});

export default VehicleListScreen;
