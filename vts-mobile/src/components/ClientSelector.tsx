import { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Modal, FlatList, StyleSheet, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "./ScreenBg";
import { fetchAllClients } from "../services/adminService";

export interface ClientOption {
  id: number;
  full_name: string;
  username: string;
  role?: string;
}

interface Props {
  selectedClientId: number | null;
  onSelect: (client: ClientOption) => void;
}

const ClientSelector = ({ selectedClientId, onSelect }: Props) => {
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [search, setSearch]   = useState("");
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchAllClients()
      .then((data: any[]) => {
        const mapped = data
          .filter(c => c.role?.toLowerCase() !== "admin")
          .map(c => ({
            id:        c.id ?? c.client_id,
            full_name: c.full_name ?? "",
            username:  c.username ?? "",
            role:      c.role ?? "",
          }));
        setClients(mapped);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const selected = clients.find(c => c.id === selectedClientId);
  const filtered = clients.filter(c =>
    (c.full_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
    c.username.toLowerCase().includes(search.toLowerCase()) ||
    String(c.id).includes(search)
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.dotRow}>
        <View style={styles.dot} />
        <Text style={styles.label}>SELECT USER</Text>
      </View>
      <TouchableOpacity style={styles.selector} onPress={() => setVisible(true)} activeOpacity={0.8}>
        {selected ? (
          <View style={{ flex: 1 }}>
            <Text style={styles.selectedName}>{selected.full_name || selected.username}</Text>
            <Text style={styles.selectedSub}>@{selected.username}  •  ID: {selected.id}</Text>
          </View>
        ) : (
          <Text style={styles.placeholder}>Search & select user…</Text>
        )}
        <Ionicons name="chevron-down" size={16} color="#A0785A" />
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="slide" onRequestClose={() => setVisible(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Select User</Text>
            <View style={styles.searchRow}>
              <Ionicons name="search-outline" size={16} color={COLORS.whiteMuted} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by name, username or ID…"
                placeholderTextColor={COLORS.whiteMuted}
                value={search}
                onChangeText={setSearch}
                autoFocus
              />
            </View>
            {loading
              ? <ActivityIndicator color={COLORS.accent} style={{ marginTop: 20 }} />
              : <FlatList
                  data={filtered}
                  keyExtractor={item => String(item.id)}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[styles.item, item.id === selectedClientId && styles.itemSelected]}
                      onPress={() => { onSelect(item); setVisible(false); setSearch(""); }}
                    >
                      <View style={styles.avatar}>
                        <Text style={styles.avatarTxt}>
                          {(item.full_name || item.username).slice(0, 2).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.itemName}>{item.full_name || item.username}</Text>
                        <Text style={styles.itemSub}>@{item.username}  •  ID: {item.id}</Text>
                      </View>
                      {item.id === selectedClientId && (
                        <Ionicons name="checkmark-circle" size={18} color={COLORS.accent} />
                      )}
                    </TouchableOpacity>
                  )}
                  ListEmptyComponent={<Text style={styles.empty}>No users found</Text>}
                />
            }
            <TouchableOpacity style={styles.closeBtn} onPress={() => { setVisible(false); setSearch(""); }}>
              <Text style={styles.closeTxt}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap:         { marginBottom: 14 },
  dotRow:        { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 8, marginTop: 4 },
  dot:           { width: 7, height: 7, borderRadius: 4, backgroundColor: "#0D3B8E" },
  label:         { fontSize: 11, fontWeight: "800", color: "#0D1B3E", textTransform: "uppercase", letterSpacing: 1.0 },
  selector:     { flexDirection: "row", alignItems: "center", backgroundColor: "#E8C9A0", borderRadius: 14, borderWidth: 1, borderColor: "rgba(160,90,30,0.35)", minHeight: 54, paddingHorizontal: 14, paddingVertical: 0 },
  placeholder:  { flex: 1, fontSize: 14, color: "#A0785A" },
  selectedName: { fontSize: 14, fontWeight: "700", color: "#3B1F0A" },
  selectedSub:  { fontSize: 11, color: "#A0785A", marginTop: 2 },
  overlay:      { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet:        { backgroundColor: COLORS.cardBg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: "75%", borderWidth: 1, borderColor: COLORS.cardBorder },
  sheetTitle:   { fontSize: 17, fontWeight: "800", color: COLORS.white, marginBottom: 14, textAlign: "center" },
  searchRow:    { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.glass, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: COLORS.glassBorder, marginBottom: 12 },
  searchInput:  { flex: 1, color: COLORS.white, fontSize: 14 },
  item:         { flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.glassBorder, gap: 12 },
  itemSelected: { backgroundColor: COLORS.accent + "11" },
  avatar:       { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.accentGlow, borderWidth: 1, borderColor: COLORS.accent + "55", alignItems: "center", justifyContent: "center" },
  avatarTxt:    { fontSize: 13, fontWeight: "800", color: COLORS.accent },
  itemName:     { fontSize: 14, fontWeight: "700", color: COLORS.white },
  itemSub:      { fontSize: 11, color: COLORS.whiteMuted, marginTop: 2 },
  empty:        { textAlign: "center", color: COLORS.whiteMuted, paddingVertical: 20 },
  closeBtn:     { alignItems: "center", paddingVertical: 14 },
  closeTxt:     { color: COLORS.red, fontWeight: "700", fontSize: 15 },
});

export default ClientSelector;
