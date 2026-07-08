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
  bg:     "#F0F4FF",
  blueDk: "#0A1F44",
  blueMd: "#0D3B8E",
  blue:   "#1565C0",
  white:  "#FFFFFF",
};

const FieldRow = ({
  icon, iconBg, iconColor, label, value, last,
}: {
  icon: any; iconBg: string; iconColor: string;
  label: string; value?: string; last?: boolean;
}) => (
  <View style={[f.row, !last && f.rowBorder]}>
    <View style={[f.iconBox, { backgroundColor: iconBg }]}>
      <Ionicons name={icon} size={18} color={iconColor} />
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

  const initials  = (client?.fullName || client?.username || "U")
    .split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
  const roleLabel = client?.role === "Client" ? "USER" : (client?.role || "USER").toUpperCase();
  const phone     = client?.phoneNumber || undefined;

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.blueDk} />

      {/* Curved blue header background */}
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
              <Text style={s.navTitle}>User Profile</Text>
              <View style={{ width: 40 }} />
            </View>

            {/* Avatar hero — sits inside the blue header area */}
            <View style={s.heroArea}>
              <View style={s.avatarRing}>
                <Text style={s.avatarTxt}>{initials}</Text>
              </View>
              <Text style={s.heroName}>{client?.fullName || client?.username || "—"}</Text>
              <View style={s.heroBadge}>
                <Ionicons name="briefcase-outline" size={12} color={C.white} />
                <Text style={s.heroBadgeTxt}>{roleLabel}</Text>
              </View>
            </View>

            {/* White info card */}
            <View style={s.card}>
              <Text style={s.sectionTitle}>Account Details</Text>
              <FieldRow
                icon="mail-outline"
                iconBg="#FFF3E0" iconColor="#F57C00"
                label="Email Address"
                value={client?.emailAddress}
              />
              <FieldRow
                icon="call-outline"
                iconBg="#E8F5E9" iconColor="#2E7D32"
                label="Phone Number"
                value={phone}
              />
              <FieldRow
                icon="briefcase-outline"
                iconBg="#E3F2FD" iconColor="#1565C0"
                label="Role"
                value={client?.role === "Client" ? "User" : client?.role}
              />
              <FieldRow
                icon="document-text-outline"
                iconBg="#FCE4EC" iconColor="#C2185B"
                label="Role Description"
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
  row:       { flexDirection: "row", alignItems: "center", paddingVertical: 13, gap: 12 },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(0,0,0,0.07)" },
  iconBox:   { width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  textWrap:  { flex: 1 },
  label:     { fontSize: 11, fontWeight: "700", color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 2 },
  value:     { fontSize: 14, fontWeight: "600", color: "#0D1B3E" },
});

const s = StyleSheet.create({
  root:      { flex: 1, backgroundColor: "#F0F4FF" },
  headerBg:  { position: "absolute", top: 0, left: -40, right: -40, height: 200, overflow: "hidden", borderBottomLeftRadius: 130, borderBottomRightRadius: 130 },
  safe:      { flex: 1 },
  loader:    { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll:    { paddingHorizontal: 16, paddingBottom: 40 },

  navRow:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 10, paddingBottom: 8 },
  backBtn:   { width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.18)", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)", alignItems: "center", justifyContent: "center" },
  navTitle:  { fontSize: 18, fontWeight: "800", color: "#FFFFFF" },

  heroArea:    { alignItems: "center", paddingTop: 4, paddingBottom: 28 },
  avatarRing:  { width: 56, height: 56, borderRadius: 28, backgroundColor: "rgba(255,255,255,0.22)", borderWidth: 2, borderColor: "rgba(255,255,255,0.60)", alignItems: "center", justifyContent: "center", marginBottom: 6 },
  avatarTxt:   { fontSize: 18, fontWeight: "800", color: "#FFFFFF" },
  heroName:    { fontSize: 15, fontWeight: "800", color: "#FFFFFF", marginBottom: 5, letterSpacing: 0.2 },
  heroBadge:   { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: "rgba(255,255,255,0.30)" },
  heroBadgeTxt:{ fontSize: 9, fontWeight: "800", color: "#FFFFFF", letterSpacing: 0.8 },

  card:         { backgroundColor: "#FFFFFF", borderRadius: 14, padding: 12, marginTop: -14, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  sectionTitle: { fontSize: 13, fontWeight: "800", color: "#0D1B3E", marginBottom: 4, letterSpacing: 0.3 },
});

export default ClientDetailsScreen;
