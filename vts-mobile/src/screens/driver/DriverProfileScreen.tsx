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
  bgDark:   "#0A1F44",
  bgMid:    "#0D3B8E",
  bgBright: "#1565C0",
  cream:    "#F6F1E9",
  white:    "#FFFFFF",
  accent:   "#38BDF8",
  muted:    "rgba(255,255,255,0.55)",
};

const INFO_ROWS = [
  { key: "username",      label: "USERNAME",       icon: "person-outline",       color: "#7B2CBF" },
  { key: "phoneNumber",   label: "PHONE NUMBER",   icon: "call-outline",         color: "#22C55E" },
  { key: "aadharNumber",  label: "AADHAAR NUMBER", icon: "card-outline",         color: "#3B82F6" },
  { key: "licenseNumber", label: "LICENSE NUMBER", icon: "id-card-outline",      color: "#F59E0B" },
  { key: "licenseExpiry", label: "LICENSE EXPIRY", icon: "calendar-outline",     color: "#EC4899" },
  { key: "comments",      label: "COMMENTS",       icon: "chatbubble-outline",   color: "#0D9488" },
] as const;

const DriverProfileScreen = ({ navigation }: Props) => {
  const [driver, setDriver] = useState<Driver | null>(null);
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
        const d = new Date(v);
        return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
      } catch { return v; }
    }
    return String(v);
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.bgDark} />
      <LinearGradient
        colors={[C.bgDark, C.bgMid, C.bgBright]}
        locations={[0, 0.5, 1]}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Dot grid decoration */}
      {[...Array(6)].map((_, i) => (
        <View key={i} style={[s.dot, { top: 60 + i * 18, right: 18 + (i % 2) * 10, opacity: 0.12 + i * 0.02 }]} />
      ))}

      <SafeAreaView style={s.safe}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={22} color={C.white} />
          </TouchableOpacity>
          <View style={s.headerCenter}>
            <Text style={s.headerTitle}>Driver Profile</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {loading ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color={C.accent} />
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

            {/* Avatar card */}
            <View style={s.avatarCard}>
              {driver?.frontFaceImage ? (
                <Image
                  source={{ uri: `data:image/jpeg;base64,${driver.frontFaceImage}` }}
                  style={s.avatarImg}
                />
              ) : (
                <View style={s.avatarFallback}>
                  <Ionicons name="person" size={48} color={C.accent} />
                </View>
              )}
              <Text style={s.driverName}>{driver?.driverName ?? "—"}</Text>
              <View style={[s.statusBadge, { backgroundColor: driver?.status ? "#14532D" : "#7F1D1D" }]}>
                <View style={[s.statusDot, { backgroundColor: driver?.status ? "#22C55E" : "#EF4444" }]} />
                <Text style={s.statusTxt}>{driver?.status ? "Active" : "Inactive"}</Text>
              </View>
            </View>

            {/* Info rows */}
            <View style={s.infoCard}>
              {INFO_ROWS.map((row, idx) => (
                <View key={row.key} style={[s.infoRow, idx < INFO_ROWS.length - 1 && s.infoRowBorder]}>
                  <View style={[s.infoIconBox, { backgroundColor: row.color + "18" }]}>
                    <Ionicons name={row.icon as any} size={18} color={row.color} />
                  </View>
                  <View style={s.infoText}>
                    <Text style={s.infoLabel}>{row.label}</Text>
                    <Text style={s.infoValue}>{getValue(row.key)}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="rgba(0,0,0,0.18)" />
                </View>
              ))}
            </View>

          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
};

const s = StyleSheet.create({
  root:          { flex: 1 },
  safe:          { flex: 1 },
  center:        { flex: 1, alignItems: "center", justifyContent: "center" },
  dot:           { position: "absolute", width: 6, height: 6, borderRadius: 3, backgroundColor: C.white },

  header:        { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12 },
  headerCenter:  { flex: 1, alignItems: "center" },
  headerTitle:   { fontSize: 18, fontWeight: "800", color: C.white },
  backBtn:       { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },

  scroll:        { paddingHorizontal: 16, paddingBottom: 40 },

  avatarCard:    { alignItems: "center", paddingVertical: 28, marginBottom: 16 },
  avatarImg:     { width: 110, height: 110, borderRadius: 55, borderWidth: 3, borderColor: C.accent, marginBottom: 14 },
  avatarFallback:{ width: 110, height: 110, borderRadius: 55, backgroundColor: "rgba(56,189,248,0.15)", borderWidth: 3, borderColor: C.accent, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  driverName:    { fontSize: 22, fontWeight: "800", color: C.white, marginBottom: 10 },
  statusBadge:   { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  statusDot:     { width: 8, height: 8, borderRadius: 4 },
  statusTxt:     { fontSize: 13, fontWeight: "700", color: C.white },

  infoCard:      { backgroundColor: C.cream, borderRadius: 20, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  infoRow:       { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16, gap: 12 },
  infoRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(0,0,0,0.07)" },
  infoIconBox:   { width: 40, height: 40, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  infoText:      { flex: 1 },
  infoLabel:     { fontSize: 10, fontWeight: "700", color: "#6B7280", letterSpacing: 0.8, marginBottom: 2 },
  infoValue:     { fontSize: 15, fontWeight: "700", color: "#0D1B3E" },
});

export default DriverProfileScreen;
