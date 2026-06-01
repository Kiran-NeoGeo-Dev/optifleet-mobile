import { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ActivityIndicator,
  ScrollView, TouchableOpacity, StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { MainStackParamList } from "../../navigation/MainNavigator";
import { fetchClientDetails } from "../../services/authService";
import { Client } from "../../types/Client";

type Props = NativeStackScreenProps<MainStackParamList, "ClientDetails">;

const C = {
  bgDark:   "#0A1F44",
  bgMid:    "#0D3B8E",
  bgBright: "#1565C0",
  cream:    "#FFF3EC",
  white:    "#FFFFFF",
  accent:   "#38BDF8",
};

const FieldRow = ({
  icon, iconBg, iconColor, label, value, last,
}: {
  icon: any; iconBg: string; iconColor: string;
  label: string; value?: string; last?: boolean;
}) => (
  <View style={[f.row, !last && f.rowBorder]}>
    <View style={[f.iconBox, { backgroundColor: iconBg }]}>
      <Ionicons name={icon} size={22} color={iconColor} />
    </View>
    <View style={f.textWrap}>
      <Text style={f.label}>{label}</Text>
      <Text style={f.value}>{value || "—"}</Text>
    </View>
  </View>
);

const ClientDetailsScreen = ({ navigation }: Props) => {
  const [client,  setClient]  = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchClientDetails().then(setClient).finally(() => setLoading(false));
  }, []);

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.bgDark} />

      <LinearGradient
        colors={[C.bgDark, C.bgMid, C.bgBright]}
        locations={[0, 0.55, 1]}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {[0.18, 0.38, 0.58, 0.78].map((t, i) => (
        <View key={`h${i}`} style={[s.gridH, { top: `${t * 100}%` as any }]} />
      ))}
      {[0.15, 0.50, 0.82].map((t, i) => (
        <View key={`v${i}`} style={[s.gridV, { left: `${t * 100}%` as any }]} />
      ))}
      <View style={s.dotGrid} pointerEvents="none">
        {Array.from({ length: 20 }).map((_, i) => (
          <View key={i} style={s.dot} />
        ))}
      </View>

      <SafeAreaView style={{ flex: 1 }}>

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
            <Ionicons name="chevron-back" size={22} color={C.white} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={s.headerTitle}>User Profile</Text>
            <Text style={s.headerSub}>Manage user account details</Text>
          </View>
          <View style={{ width: 42 }} />
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={C.accent} style={{ marginTop: 80 }} />
        ) : (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

            {/* Hero Banner */}
            <View style={s.banner}>
              <View style={s.ringOuter}>
                <View style={s.ringInner}>
                  <View style={s.avatarBox}>
                    <Ionicons name="person" size={44} color={C.accent} />
                  </View>
                </View>
              </View>

              <Text style={s.clientName}>
                {client?.fullName || client?.username || "—"}
              </Text>

              <View style={s.roleBadge}>
                <Ionicons name="briefcase-outline" size={13} color={C.accent} />
                <Text style={s.roleBadgeTxt}>
                  {client?.role === "Client" ? "USER" : (client?.role || "USER").toUpperCase()}
                </Text>
              </View>
            </View>

            {/* Info Card */}
            <View style={s.card}>
              <FieldRow
                icon="mail-outline"
                iconBg="#FFF3E0" iconColor="#F57C00"
                label="EMAIL ADDRESS"
                value={client?.emailAddress}
              />
              <FieldRow
                icon="call-outline"
                iconBg="#E8F5E9" iconColor="#2E7D32"
                label="PHONE NUMBER"
                value={client?.dialCode || client?.phoneNumber
                  ? `${client?.dialCode ?? ""} ${client?.phoneNumber ?? ""}`.trim()
                  : undefined}
              />
              <FieldRow
                icon="briefcase-outline"
                iconBg="#E3F2FD" iconColor="#1565C0"
                label="ROLE"
                value={client?.role === "Client" ? "User" : client?.role}
              />
              <FieldRow
                icon="document-text-outline"
                iconBg="#FCE4EC" iconColor="#C2185B"
                label="ROLE DESCRIPTION"
                value={client?.roleDescription}
                last
              />
            </View>

          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
};

const f = StyleSheet.create({
  row:       { flexDirection: "row", alignItems: "center", paddingVertical: 16, paddingHorizontal: 16, gap: 14 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.06)" },
  iconBox:   { width: 52, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  textWrap:  { flex: 1 },
  label:     { fontSize: 11, fontWeight: "700", color: "#8A8A9A", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 },
  value:     { fontSize: 15, fontWeight: "600", color: "#1A1A2E" },
});

const s = StyleSheet.create({
  root:    { flex: 1 },
  gridH:   { position: "absolute", left: 0, right: 0, height: 1, backgroundColor: "rgba(255,255,255,0.025)" },
  gridV:   { position: "absolute", top: 0, bottom: 0, width: 1,  backgroundColor: "rgba(255,255,255,0.025)" },

  dotGrid: { position: "absolute", top: 60, right: 16, flexDirection: "row", flexWrap: "wrap", width: 80, gap: 8, opacity: 0.18 },
  dot:     { width: 4, height: 4, borderRadius: 2, backgroundColor: C.accent },

  header:      { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 10, paddingBottom: 16 },
  backBtn:     { width: 42, height: 42, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.12)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 20, fontWeight: "800", color: C.white },
  headerSub:   { fontSize: 12, color: "rgba(255,255,255,0.60)", marginTop: 2 },

  scroll: { paddingHorizontal: 16, paddingBottom: 48 },

  banner:    { backgroundColor: "rgba(10,31,68,0.70)", borderRadius: 20, paddingVertical: 32, alignItems: "center", marginBottom: 20, borderWidth: 1, borderColor: "rgba(56,189,248,0.18)" },
  ringOuter: { width: 110, height: 110, borderRadius: 55, borderWidth: 1.5, borderColor: "rgba(56,189,248,0.35)", alignItems: "center", justifyContent: "center", marginBottom: 20 },
  ringInner: { width: 88,  height: 88,  borderRadius: 44, borderWidth: 1.5, borderColor: "rgba(56,189,248,0.55)", alignItems: "center", justifyContent: "center" },
  avatarBox: { width: 70,  height: 70,  borderRadius: 35, backgroundColor: "rgba(56,189,248,0.12)", alignItems: "center", justifyContent: "center" },
  clientName:   { fontSize: 28, fontWeight: "800", color: C.white, marginBottom: 12, letterSpacing: -0.3 },
  roleBadge:    { flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: "rgba(56,189,248,0.12)", borderRadius: 20, paddingHorizontal: 18, paddingVertical: 8, borderWidth: 1, borderColor: "rgba(56,189,248,0.30)" },
  roleBadgeTxt: { fontSize: 12, fontWeight: "800", color: C.accent, letterSpacing: 1.5 },

  card: { backgroundColor: "#FFF3EC", borderRadius: 24, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
});

export default ClientDetailsScreen;
