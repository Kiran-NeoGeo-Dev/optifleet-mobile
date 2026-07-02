import { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  FlatList, ActivityIndicator, StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AdminStackParamList } from "../../navigation/AdminNavigator";
import {
  fetchSystemOverviewSummary,
  fetchSystemOverviewOrganizations,
} from "../../services/superadminService";
import { OrganizationOverview, SystemOverviewSummary } from "../../types/SystemOverview";
import { toDisplayDate } from "../../utils/dateFormatter";
import { Toast, useToast } from "../../components/Toast";

type Props = NativeStackScreenProps<AdminStackParamList, "SystemOverview">;

const SystemOverviewScreen = ({ navigation }: Props) => {
  const [summary, setSummary] = useState<SystemOverviewSummary | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationOverview[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const { toast, showToast, hideToast } = useToast();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryData, orgs] = await Promise.all([
        fetchSystemOverviewSummary(),
        fetchSystemOverviewOrganizations(),
      ]);

      setSummary(summaryData);
      setOrganizations(orgs.sort((a, b) => b.orgId - a.orgId));
    } catch (error) {
      showToast("Unable to load system overview. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useFocusEffect(useCallback(() => {
    loadData();
  }, [loadData]));

  const filteredOrganizations = organizations.filter(org => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const label = `organization ${org.orgId}`.toLowerCase();
    return String(org.orgId).includes(q)
      || label.includes(q)
      || (org.ownerName || "").toLowerCase().includes(q)
      || (org.username || "").toLowerCase().includes(q);
  });

  const summaryCards = summary ? [
    { label: "Organizations", value: summary.organizations, accent: "#2563EB", icon: "layers-outline" },
    { label: "Users", value: summary.totalUsers, accent: "#0EA5E9", icon: "people-outline" },
    { label: "Devices", value: summary.totalDevices, accent: "#10B981", icon: "phone-portrait-outline" },
    { label: "Vehicles", value: summary.totalVehicles, accent: "#F97316", icon: "car-outline" },
    { label: "Drivers", value: summary.totalDrivers, accent: "#8B5CF6", icon: "person-outline" },
  ] : [];

  const renderSummaryCard = ({ label, value, accent, icon }: { label: string; value: number; accent: string; icon: string }) => (
    <View style={[styles.summaryCard, { borderColor: accent + "22" }]}> 
      <View style={[styles.summaryIcon, { backgroundColor: accent + "20" }]}>
        <Ionicons name={icon as any} size={20} color={accent} />
      </View>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, { color: accent }]}>{value}</Text>
    </View>
  );

  const renderOrganizationCard = ({ item }: { item: OrganizationOverview }) => (
    <View style={styles.orgCard}>
      <View style={styles.orgCardHeader}>
        <View>
          <Text style={styles.orgTitle}>Organization {item.orgId}</Text>
          <Text style={styles.orgSubtitle}>{item.ownerName || item.username || "Unknown Owner"}</Text>
        </View>
        <View style={styles.orgTag}>
          <Text style={styles.orgTagText}>Org ID</Text>
        </View>
      </View>

      <View style={styles.orgMetaRow}>
        <View style={styles.metaLabelBox}>
          <Text style={styles.metaLabel}>Owner</Text>
          <Text style={styles.metaValue}>{item.ownerName || "—"}</Text>
        </View>
        <View style={styles.metaLabelBox}>
          <Text style={styles.metaLabel}>Username</Text>
          <Text style={styles.metaValue}>{item.username || "—"}</Text>
        </View>
      </View>

      <View style={styles.metaRow}> 
        <Text style={styles.createdAtLabel}>Created on</Text>
        <Text style={styles.createdAtValue}>{toDisplayDate(item.createdDate)}</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{item.users}</Text>
          <Text style={styles.statText}>Users</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{item.devices}</Text>
          <Text style={styles.statText}>Devices</Text>
        </View>
      </View>
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{item.vehicles}</Text>
          <Text style={styles.statText}>Vehicles</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{item.drivers}</Text>
          <Text style={styles.statText}>Drivers</Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A1F44" />
      <LinearGradient
        colors={["#0A1F44", "#0D3B8E", "#1565C0"]}
        locations={[0, 0.5, 1]}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.8}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerText}> 
            <Text style={styles.title}>System Overview</Text>
            <Text style={styles.subtitle}>Enterprise-level organization analytics for Super Admins.</Text>
          </View>
        </View>

        <View style={styles.content}>
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={18} color="#6B7280" style={{ marginRight: 10 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name, username or org ID..."
              placeholderTextColor="#9CA3AF"
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery("")}> 
                <Ionicons name="close-circle" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>

          {loading ? (
            <ActivityIndicator color="#fff" size="large" style={{ marginTop: 44 }} />
          ) : (
            <View style={styles.summarySection}>
              <View style={styles.summaryHeaderRow}>
                <Text style={styles.summarySectionTitle}>Key Metrics</Text>
                <Text style={styles.summarySectionSubtitle}>Live organization totals</Text>
              </View>
              <FlatList
                horizontal
                data={summaryCards}
                keyExtractor={(item) => item.label}
                renderItem={({ item }) => renderSummaryCard(item)}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.summaryList}
              />
            </View>
          )}

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Organizations</Text>
            <Text style={styles.sectionCount}>{filteredOrganizations.length} found</Text>
          </View>

          {loading ? null : filteredOrganizations.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="alert-circle-outline" size={48} color="rgba(255,255,255,0.35)" />
              <Text style={styles.emptyText}>No organizations match your search.</Text>
            </View>
          ) : (
            <FlatList
              data={filteredOrganizations}
              keyExtractor={(item) => item.orgId.toString()}
              renderItem={renderOrganizationCard}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.orgList}
            />
          )}
        </View>
      </SafeAreaView>
      <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={hideToast} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A1F44" },
  safeArea: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 18 },
  backButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center", marginRight: 12 },
  headerText: { flex: 1 },
  title: { fontSize: 24, fontWeight: "800", color: "#fff" },
  subtitle: { fontSize: 13, color: "rgba(255,255,255,0.78)", marginTop: 4, lineHeight: 18 },
  content: { flex: 1, backgroundColor: "#EEF2FF", borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 16, paddingTop: 18 },
  searchBar: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 20, paddingHorizontal: 16, height: 54, marginBottom: 18, borderWidth: 1, borderColor: "#E5E7EB", shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 3 },
  searchInput: { flex: 1, fontSize: 14, color: "#111827" },
  summarySection: { backgroundColor: "#fff", borderRadius: 24, padding: 16, marginBottom: 18, borderWidth: 1, borderColor: "#E5E7EB", shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  summaryHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  summarySectionTitle: { fontSize: 16, fontWeight: "800", color: "#111827" },
  summarySectionSubtitle: { fontSize: 12, color: "#6B7280" },
  summaryList: { paddingVertical: 6, paddingRight: 8 },
  summaryCard: { width: 170, minHeight: 140, backgroundColor: "#F8FAFF", borderRadius: 20, padding: 16, marginRight: 12, borderWidth: 1, borderColor: "#E0E7FF", shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  summaryIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", marginBottom: 14, borderWidth: 1, borderColor: "rgba(37,99,235,0.16)" },
  summaryLabel: { fontSize: 11, color: "#2563EB", fontWeight: "800", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.7 },
  summaryValue: { fontSize: 30, fontWeight: "900", color: "#111827" },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6, marginBottom: 10 },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: "#111827" },
  sectionCount: { fontSize: 12, color: "#6B7280" },
  orgList: { paddingBottom: 48 },
  orgCard: { backgroundColor: "#fff", borderRadius: 20, padding: 18, marginBottom: 14, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 2, borderLeftWidth: 6, borderLeftColor: "#2563EB" },
  orgCardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  orgTitle: { fontSize: 16, fontWeight: "800", color: "#111827" },
  orgSubtitle: { fontSize: 12, color: "#6B7280", marginTop: 4 },
  orgTag: { borderRadius: 999, backgroundColor: "#EFF6FF", paddingHorizontal: 10, paddingVertical: 6 },
  orgTagText: { fontSize: 11, color: "#2563EB", fontWeight: "700" },
  orgMetaRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  metaLabelBox: { flex: 1, backgroundColor: "#F8FAFF", borderRadius: 14, padding: 12 },
  metaLabel: { fontSize: 11, fontWeight: "700", color: "#6B7280", marginBottom: 6 },
  metaValue: { fontSize: 13, fontWeight: "800", color: "#111827" },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  createdAtLabel: { fontSize: 12, color: "#6B7280" },
  createdAtValue: { fontSize: 12, color: "#111827", fontWeight: "700" },
  statsRow: { flexDirection: "row", justifyContent: "space-between", gap: 10, marginBottom: 10 },
  statBox: { flex: 1, backgroundColor: "#EFF6FF", borderRadius: 16, paddingVertical: 14, alignItems: "center" },
  statNumber: { fontSize: 18, fontWeight: "800", color: "#111827" },
  statText: { fontSize: 12, color: "#6B7280", marginTop: 4 },
  emptyState: { marginTop: 40, alignItems: "center", justifyContent: "center" },
  emptyText: { marginTop: 16, fontSize: 15, color: "#6B7280", textAlign: "center", lineHeight: 22, maxWidth: 260 },
});

export default SystemOverviewScreen;
