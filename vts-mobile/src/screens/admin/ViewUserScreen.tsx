import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, StatusBar } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AdminStackParamList } from "../../navigation/AdminNavigator";
import { UserDetail, fetchUser } from "../../services/adminService";
import { FormScreen, GlassCard } from "../../components/GlassUI";

type Props = NativeStackScreenProps<AdminStackParamList, "ViewUser">;

const Row = ({ icon, label, value }: { icon: any; label: string; value: string }) => (
  <View style={s.row}>
    <View style={s.rowIcon}><Ionicons name={icon} size={16} color="#1565C0" /></View>
    <View style={s.rowBody}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowValue}>{value || "—"}</Text>
    </View>
  </View>
);

const ViewUserScreen = ({ route, navigation }: Props) => {
  const { clientId } = route.params;
  const [user,    setUser]    = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUser(clientId).then(setUser).catch(() => {}).finally(() => setLoading(false));
  }, [clientId]);

  if (loading) return (
    <View style={{ flex: 1, backgroundColor: "#0A1F44", alignItems: "center", justifyContent: "center" }}>
      <StatusBar barStyle="light-content" backgroundColor="#0A1F44" />
      <ActivityIndicator color="#fff" size="large" />
    </View>
  );

  const initials  = (user?.full_name || user?.username || "U").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const roleColor = user?.role?.toLowerCase() === "admin" ? "#7B2CBF" : "#1565C0";
  const createdAt = user?.created_at ? new Date(user.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

  return (
    <FormScreen title="View User" subtitle="User profile details" onBack={() => navigation.goBack()}>
      <GlassCard>
        <View style={s.hero}>
          <View style={[s.avatar, { borderColor: roleColor }]}>
            <Text style={s.avatarTxt}>{initials}</Text>
          </View>
          <Text style={s.heroName}>{user?.full_name || user?.username}</Text>
          <View style={[s.pill, { backgroundColor: roleColor + "18", borderColor: roleColor }]}>
            <Text style={[s.pillTxt, { color: roleColor }]}>{(user?.role || "CLIENT").toUpperCase()}</Text>
          </View>
        </View>
        <View style={s.divider} />
        <Row icon="at-outline"            label="Username"         value={user?.username || ""} />
        <Row icon="person-outline"        label="Full Name"        value={user?.full_name || ""} />
        <Row icon="mail-outline"          label="Email Address"    value={user?.email_address || ""} />
        <Row icon="call-outline"          label="Phone Number"     value={`${user?.dial_code || ""} ${user?.phone_number || ""}`.trim()} />
        <Row icon="shield-outline"        label="Role"             value={user?.role || ""} />
        <Row icon="document-text-outline" label="Role Description" value={user?.role_description || ""} />
        <Row icon="calendar-outline"      label="Created At"       value={createdAt} />
      </GlassCard>
    </FormScreen>
  );
};

const s = StyleSheet.create({
  hero:      { alignItems: "center", paddingVertical: 16, gap: 8 },
  avatar:    { width: 72, height: 72, borderRadius: 36, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center", borderWidth: 2 },
  avatarTxt: { fontSize: 26, fontWeight: "800", color: "#0D1B3E" },
  heroName:  { fontSize: 18, fontWeight: "800", color: "#0D1B3E" },
  pill:      { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
  pillTxt:   { fontSize: 11, fontWeight: "700" },
  divider:   { height: 1, backgroundColor: "rgba(21,101,192,0.12)", marginVertical: 14 },
  row:       { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 14 },
  rowIcon:   { width: 32, height: 32, borderRadius: 9, backgroundColor: "rgba(21,101,192,0.08)", alignItems: "center", justifyContent: "center", marginTop: 2 },
  rowBody:   { flex: 1 },
  rowLabel:  { fontSize: 11, fontWeight: "700", color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 3 },
  rowValue:  { fontSize: 14, fontWeight: "600", color: "#0D1B3E" },
});

export default ViewUserScreen;
