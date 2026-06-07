import { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, ActivityIndicator, StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { DriverStackParamList } from "../../navigation/DriverNavigator";
import { Driver } from "../../types/Driver";
import { fetchMyDriverProfile } from "../../services/driverService";

type Props = NativeStackScreenProps<DriverStackParamList, "DriverProfile">;

const C = {
  bg:     "#F0F4FF",
  blueDk: "#0A1F44",
  blueMd: "#0D3B8E",
  blue:   "#1565C0",
  white:  "#FFFFFF",
};

const INFO_ROWS = [
  { key: "username",      label: "Username",       icon: "person-outline",     iconBg: "#EDE7F6", iconColor: "#7B2CBF" },
  { key: "phoneNumber",   label: "Phone Number",   icon: "call-outline",       iconBg: "#E8F5E9", iconColor: "#2E7D32" },
  { key: "aadharNumber",  label: "Aadhaar Number", icon: "card-outline",       iconBg: "#E3F2FD", iconColor: "#1565C0" },
  { key: "licenseNumber", label: "License Number", icon: "id-card-outline",    iconBg: "#FFF3E0", iconColor: "#F57C00" },
  { key: "licenseExpiry", label: "License Expiry", icon: "calendar-outline",   iconBg: "#FCE4EC", iconColor: "#C2185B" },
  { key: "comments",      label: "Comments",       icon: "chatbubble-outline", iconBg: "#E0F2F1", iconColor: "#0D9488" },
] as const;

const DriverProfileScreen = ({ navigation }: Props) => {
  const [driver,  setDriver]  = useState<Driver | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMyDriverProfile()
      .then(setDriver)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const getValue = (key: string) => {
    if (!driver) return "—";
    const v = (driver as any)[key];
    if (!v) return "—";
    if (key === "licenseExpiry") {
      try {
        return new Date(v).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
      } catch { return v; }
    }
    return String(v);
  };

  const initials = (driver?.driverName || "D")
    .split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();

  const hasPhoto = !!driver?.frontFaceImage && driver.frontFaceImage.length > 4;

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.blueDk} />

      {/* Curved blue header background — same as AdminProfileScreen */}
      <View style={s.headerBg}>
        <LinearGradient
          colors={[C.blueDk, C.blueMd, C.blue]}
          locations={[0, 0.45, 1]}
          start={{ x: 0.15, y: 0 }} end={{ x: 0.85, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <SafeAreaView style={s.safe} edges={["top"]}>
        {loading ? (
          <View style={s.loader}>
            <ActivityIndicator size="large" color={C.white} />
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

            {/* Top nav row */}
            <View style={s.navRow}>
              <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
                <Ionicons name="chevron-back" size={22} color={C.white} />
              </TouchableOpacity>
              <Text style={s.navTitle}>Driver Profile</Text>
              <View style={{ width: 40 }} />
            </View>

            {/* Hero area — photo or initials avatar */}
            <View style={s.heroArea}>
              {hasPhoto ? (
                <Image
                  source={{ uri: `data:image/jpeg;base64,${driver!.frontFaceImage}` }}
                  style={s.avatarImg}
                />
              ) : (
                <View style={s.avatarRing}>
                  <Text style={s.avatarTxt}>{initials}</Text>
                </View>
              )}
              <Text style={s.heroName}>{driver?.driverName ?? "—"}</Text>
              <View style={[s.heroBadge, { backgroundColor: driver?.status ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)" }]}>
                <View style={[s.statusDot, { backgroundColor: driver?.status ? "#22C55E" : "#EF4444" }]} />
                <Text style={s.heroBadgeTxt}>{driver?.status ? "ACTIVE" : "INACTIVE"}</Text>
              </View>
            </View>

            {/* White info card */}
            <View style={s.card}>
              <Text style={s.sectionTitle}>Driver Details</Text>
              {INFO_ROWS.map((row, idx) => (
                <View key={row.key} style={[f.row, idx < INFO_ROWS.length - 1 && f.rowBorder]}>
                  <View style={[f.iconBox, { backgroundColor: row.iconBg }]}>
                    <Ionicons name={row.icon as any} size={18} color={row.iconColor} />
                  </View>
                  <View style={f.textWrap}>
                    <Text style={f.label}>{row.label}</Text>
                    <Text style={f.value}>{getValue(row.key)}</Text>
                  </View>
                </View>
              ))}
            </View>

          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
};

const f = StyleSheet.create({
  row:       { flexDirection: "row", alignItems: "center", paddingVertical: 13, gap: 12 },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(0,0,0,0.07)" },
  iconBox:   { width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  textWrap:  { flex: 1 },
  label:     { fontSize: 11, fontWeight: "700", color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 2 },
  value:     { fontSize: 14, fontWeight: "600", color: "#0D1B3E" },
});

const s = StyleSheet.create({
  root:      { flex: 1, backgroundColor: "#F0F4FF" },
  headerBg:  { position: "absolute", top: 0, left: -40, right: -40, height: 260, overflow: "hidden", borderBottomLeftRadius: 180, borderBottomRightRadius: 180 },
  safe:      { flex: 1 },
  loader:    { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll:    { paddingHorizontal: 16, paddingBottom: 40 },

  navRow:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 10, paddingBottom: 8 },
  backBtn:  { width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.18)", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)", alignItems: "center", justifyContent: "center" },
  navTitle: { fontSize: 18, fontWeight: "800", color: "#FFFFFF" },

  heroArea:   { alignItems: "center", paddingTop: 8, paddingBottom: 50 },
  avatarImg:  { width: 84, height: 84, borderRadius: 42, borderWidth: 3, borderColor: "rgba(255,255,255,0.80)", marginBottom: 12 },
  avatarRing: { width: 84, height: 84, borderRadius: 42, backgroundColor: "rgba(255,255,255,0.22)", borderWidth: 2.5, borderColor: "rgba(255,255,255,0.60)", alignItems: "center", justifyContent: "center", marginBottom: 12 },
  avatarTxt:  { fontSize: 28, fontWeight: "800", color: "#FFFFFF" },
  heroName:   { fontSize: 20, fontWeight: "800", color: "#FFFFFF", marginBottom: 8, letterSpacing: 0.2 },
  heroBadge:  { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5, borderWidth: 1, borderColor: "rgba(255,255,255,0.30)" },
  statusDot:  { width: 8, height: 8, borderRadius: 4 },
  heroBadgeTxt: { fontSize: 11, fontWeight: "800", color: "#FFFFFF", letterSpacing: 1.2 },

  card:         { backgroundColor: "#FFFFFF", borderRadius: 20, padding: 16, marginTop: -28, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  sectionTitle: { fontSize: 13, fontWeight: "800", color: "#0D1B3E", marginBottom: 4, letterSpacing: 0.3 },
});

export default DriverProfileScreen;
