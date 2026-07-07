import { useCallback, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, StatusBar } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { AdminStackParamList } from "../../navigation/AdminNavigator";
import { UserDetail, fetchAllUsers, deleteUser } from "../../services/adminService";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { Toast, useToast } from "../../components/Toast";
import { api } from "../../services/api";

type Props = NativeStackScreenProps<AdminStackParamList, "AdminUserList">;

const AdminUserListScreen = ({ navigation }: Props) => {
  const [users,        setUsers]        = useState<UserDetail[]>([]);
  const [query,        setQuery]        = useState("");
  const [loading,      setLoading]      = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const { toast, showToast, hideToast } = useToast();

  const load = () => {
    setLoading(true);
    fetchAllUsers().then(setUsers).catch(() => {}).finally(() => setLoading(false));
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteUser(deleteTarget);
      showToast("User deleted successfully.", "success");
      load();
    } catch { showToast("Delete failed. Please try again.", "error"); }
    finally { setDeleteTarget(null); }
  };

  const filtered = users.filter(u =>
    (u.username || "").toLowerCase().includes(query.toLowerCase()) ||
    (u.full_name || "").toLowerCase().includes(query.toLowerCase()) ||
    (u.role || "").toLowerCase().includes(query.toLowerCase())
  );

  const renderCard = ({ item }: { item: UserDetail }) => {
    const initials  = (item.full_name || item.username || "U").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
    const isAdmin   = item.role?.toLowerCase() === "admin";
    const roleColor = isAdmin ? "#7B2CBF" : "#1565C0";
    const roleLabel = item.role?.toLowerCase() === "client" ? "USER" : (item.role || "USER").toUpperCase();
    return (
      <View style={s.card}>
        <View style={[s.accentBar, { backgroundColor: roleColor }]} />
        <View style={s.inner}>
          <View style={s.topRow}>
            <View style={[s.avatar, { borderColor: roleColor }]}>
              <Text style={s.avatarTxt}>{initials}</Text>
            </View>
            <View style={s.nameBlock}>
              <Text style={s.name}>{item.full_name || item.username}</Text>
              <View style={[s.pill, { backgroundColor: roleColor + "18", borderColor: roleColor }]}>
                <Text style={[s.pillTxt, { color: roleColor }]}>{roleLabel}</Text>
              </View>
            </View>
          </View>
          {!!item.email_address && (
            <View style={s.infoRow}>
              <Ionicons name="mail-outline" size={13} color="#6B7280" />
              <Text style={s.infoTxt}>{item.email_address}</Text>
            </View>
          )}
          <View style={s.infoRow}>
            <Ionicons name="call-outline" size={13} color="#6B7280" />
            <Text style={s.infoTxt}>{item.dial_code ? `${item.dial_code} ` : ""}{item.phone_number || "—"}</Text>
          </View>
          <View style={s.divider} />
          <View style={s.actions}>
            <TouchableOpacity style={[s.btn, { backgroundColor: "rgba(14,165,233,0.10)", borderColor: "rgba(14,165,233,0.35)" }]}
              onPress={() => navigation.navigate("ViewUser", { clientId: item.client_id })}>
              <Ionicons name="eye-outline" size={13} color="#0EA5E9" />
              <Text style={[s.btnTxt, { color: "#0EA5E9" }]}>View</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.btn, { backgroundColor: "rgba(234,179,8,0.10)", borderColor: "rgba(234,179,8,0.35)" }]}
              onPress={() => navigation.navigate("EditUser", { clientId: item.client_id })}>
              <Ionicons name="create-outline" size={13} color="#CA8A04" />
              <Text style={[s.btnTxt, { color: "#CA8A04" }]}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.btn, { backgroundColor: "rgba(239,68,68,0.10)", borderColor: "rgba(239,68,68,0.35)" }]}
              onPress={() => setDeleteTarget(item.client_id)}>
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
            <Text style={s.title}>All Users</Text>
            <Text style={s.subtitle}>Manage registered users</Text>
          </View>
          <View style={s.countBadge}>
            <Text style={s.countTxt}>{filtered.length}</Text>
          </View>
        </View>

        <View style={s.searchWrap}>
          <Ionicons name="search" size={16} color="#6B7280" style={{ marginRight: 8 }} />
          <TextInput style={s.searchInput} placeholder="Search by username, role…" placeholderTextColor="#6B7280" value={query} onChangeText={setQuery} />
          {query.length > 0 && <TouchableOpacity onPress={() => setQuery("")}><Ionicons name="close-circle" size={18} color="#9C6B30" /></TouchableOpacity>}
        </View>

        {loading
          ? <ActivityIndicator color="#fff" size="large" style={{ marginTop: 60 }} />
          : <FlatList data={filtered} keyExtractor={i => i.client_id.toString()} renderItem={renderCard}
              contentContainerStyle={s.list} showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={s.empty}>
                  <Ionicons name="people-outline" size={48} color="rgba(255,255,255,0.30)" />
                  <Text style={s.emptyTxt}>No users found</Text>
                </View>
              }
            />
        }

        <ConfirmDialog visible={!!deleteTarget} title="Delete User"
          message="This will permanently delete the user and all their related data. Are you sure?"
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
  searchWrap:  { flexDirection: "row", alignItems: "center", backgroundColor: "#E8CBA7", borderRadius: 12, marginHorizontal: 14, marginBottom: 10, paddingHorizontal: 12, height: 42, borderWidth: 1, borderColor: "rgba(120,70,20,0.22)" },
  searchInput: { flex: 1, fontSize: 13, color: "#2B1D0E", fontWeight: "500" },
  list:        { paddingHorizontal: 14, paddingBottom: 70 },
  card:        { backgroundColor: "#FFFFFF", borderRadius: 12, marginBottom: 8, flexDirection: "row", overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 7, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  accentBar:   { width: 3 },
  inner:       { flex: 1, padding: 11 },
  topRow:      { flexDirection: "row", alignItems: "center", marginBottom: 6, gap: 10 },
  avatar:      { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center", borderWidth: 1 },
  avatarTxt:   { fontSize: 13, fontWeight: "800", color: "#0D1B3E" },
  nameBlock:   { flex: 1, gap: 4 },
  name:        { fontSize: 13, fontWeight: "700", color: "#0D1B3E" },
  pill:        { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1 },
  pillTxt:     { fontSize: 9, fontWeight: "700" },
  infoRow:     { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 4 },
  infoTxt:     { fontSize: 11, color: "#6B7280" },
  divider:     { height: 1, backgroundColor: "rgba(15,23,42,0.06)", marginVertical: 7 },
  actions:     { flexDirection: "row", gap: 6 },
  btn:         { flexDirection: "row", alignItems: "center", gap: 3, borderWidth: 1, borderRadius: 7, paddingHorizontal: 8, paddingVertical: 5, height: 28 },
  btnTxt:      { fontSize: 11, fontWeight: "700" },
  empty:       { alignItems: "center", paddingTop: 50, gap: 10 },
  emptyTxt:    { fontSize: 14, color: "rgba(255,255,255,0.65)", fontWeight: "600" },
});

export default AdminUserListScreen;
