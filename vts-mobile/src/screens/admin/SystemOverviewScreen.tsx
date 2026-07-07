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
    { label: "Organizations", value: summary.organizations, accent: "#DC2626", icon: "layers-outline" },
    { label: "Users", value: summary.totalUsers, accent: "#F97316", icon: "people-outline" },
    { label: "Devices", value: summary.totalDevices, accent: "#10B981", icon: "phone-portrait-outline" },
    { label: "Vehicles", value: summary.totalVehicles, accent: "#8B5CF6", icon: "car-outline" },
    { label: "Drivers", value: summary.totalDrivers, accent: "#EC4899", icon: "person-outline" },
  ] : [];

  const renderSummaryCard = ({ label, value, accent, icon }: { label: string; value: number; accent: string; icon: string }) => (
    <View style={styles.summaryCard}>
      <LinearGradient colors={[accent, accent + "CC"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.summaryGrad}>
        <Ionicons name={icon as any} size={18} color="rgba(255,255,255,0.90)" />
        <Text style={styles.summaryValue}>{value}</Text>
      </LinearGradient>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );

  const ORG_ACCENTS = ["#DC2626", "#10B981", "#F97316", "#8B5CF6", "#EC4899", "#7C3AED"];

  const renderOrganizationCard = ({ item, index }: { item: OrganizationOverview; index: number }) => {
    const accent = ORG_ACCENTS[index % ORG_ACCENTS.length];
    return (
    <View style={[styles.orgCard, { borderLeftColor: accent }]}>
      <View style={styles.orgCardHeader}>
        <View>
          <Text style={styles.orgTitle}>Organization {item.orgId}</Text>
          <Text style={styles.orgSubtitle}>{item.ownerName || item.username || "Unknown Owner"}</Text>
        </View>
        <View style={[styles.orgTag, { backgroundColor: accent + "15" }]}>
          <Text style={[styles.orgTagText, { color: accent }]}>Org ID</Text>
        </View>
      </View>

      <View style={styles.orgMetaRow}>
        <View style={[styles.metaLabelBox, { backgroundColor: accent + "10" }]}>
          <Text style={styles.metaLabel}>Owner</Text>
          <Text style={styles.metaValue}>{item.ownerName || "—"}</Text>
        </View>
        <View style={[styles.metaLabelBox, { backgroundColor: accent + "10" }]}>
          <Text style={styles.metaLabel}>Username</Text>
          <Text style={styles.metaValue}>{item.username || "—"}</Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.createdAtLabel}>Created on</Text>
        <Text style={styles.createdAtValue}>{toDisplayDate(item.createdDate)}</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={[styles.statBox, { backgroundColor: accent + "12" }]}>
          <Text style={[styles.statNumber, { color: accent }]}>{item.users}</Text>
          <Text style={styles.statText}>Users</Text>
        </View>
        <View style={[styles.statBox, { backgroundColor: accent + "12" }]}>
          <Text style={[styles.statNumber, { color: accent }]}>{item.devices}</Text>
          <Text style={styles.statText}>Devices</Text>
        </View>
      </View>
      <View style={styles.statsRow}>
        <View style={[styles.statBox, { backgroundColor: accent + "12" }]}>
          <Text style={[styles.statNumber, { color: accent }]}>{item.vehicles}</Text>
          <Text style={styles.statText}>Vehicles</Text>
        </View>
        <View style={[styles.statBox, { backgroundColor: accent + "12" }]}>
          <Text style={[styles.statNumber, { color: accent }]}>{item.drivers}</Text>
          <Text style={styles.statText}>Drivers</Text>
        </View>
      </View>
    </View>
  );
  };

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
            <Ionicons name="chevron-back" size={20} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerText}> 
            <Text style={styles.title}>System Overview</Text>
            <Text style={styles.subtitle}>Enterprise-level organization analytics for Super Admins.</Text>
          </View>
        </View>

        <View style={styles.content}>
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={16} color="#9CA3AF" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name, username or org ID..."
              placeholderTextColor="#9CA3AF"
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery("")} style={{ marginLeft: 6 }}>
                <Ionicons name="close-circle" size={16} color="#9CA3AF" />
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
            <Text style={styles.sectionCount}>
              {loading ? "Loading..." : `${filteredOrganizations.length} found`}
            </Text>
          </View>

          {loading ? (
            <View style={styles.skeletonContainer}>
              {[1, 2].map(i => (
                <View key={i} style={styles.skeletonCard}>
                  <View style={styles.skeletonTitle} />
                  <View style={styles.skeletonLine} />
                  <View style={styles.skeletonRow}>
                    <View style={styles.skeletonBox} />
                    <View style={styles.skeletonBox} />
                  </View>
                  <View style={styles.skeletonRow}>
                    <View style={styles.skeletonBox} />
                    <View style={styles.skeletonBox} />
                  </View>
                </View>
              ))}
            </View>
          ) : filteredOrganizations.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="alert-circle-outline" size={48} color="rgba(255,255,255,0.35)" />
              <Text style={styles.emptyText}>No organizations match your search.</Text>
            </View>
          ) : (
            <FlatList
              data={filteredOrganizations}
              keyExtractor={(item) => item.orgId.toString()}
              renderItem={({ item, index }) => renderOrganizationCard({ item, index })}
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
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  backButton: { width: 32, height: 32, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center", marginRight: 10 },
  headerText: { flex: 1 },
  title: { fontSize: 17, fontWeight: "800", color: "#fff" },
  subtitle: { fontSize: 10, color: "rgba(255,255,255,0.75)", marginTop: 2, lineHeight: 14 },
  content: { flex: 1, backgroundColor: "#F0F4FF", borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 12, paddingTop: 12 },

  // Search bar — warm tone matching TripManagement & FleetDrivers
  searchBar: { flexDirection: "row", alignItems: "center", backgroundColor: "#E8CBA7", borderRadius: 10, paddingHorizontal: 10, height: 38, marginBottom: 10, borderWidth: 1, borderColor: "rgba(120,70,20,0.22)", elevation: 2 },
  searchInput: { flex: 1, fontSize: 12, color: "#2B1D0E" },

  // Key Metrics section
  summarySection: { backgroundColor: "#fff", borderRadius: 12, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: "#E5E7EB", shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  summaryHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  summarySectionTitle: { fontSize: 12, fontWeight: "800", color: "#0D1B3E" },
  summarySectionSubtitle: { fontSize: 10, color: "#6B7280" },
  summaryList: { paddingVertical: 2, paddingHorizontal: 0 },

  // Key Metric cards — gradient top + white count + label below
  // widen cards so longer labels (e.g. "Organizations") don't wrap awkwardly
  summaryCard:    { width: 84, backgroundColor: "#fff", borderRadius: 8, marginHorizontal: 4, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  summaryGrad:    { paddingVertical: 8, paddingHorizontal: 6, alignItems: "center", gap: 3 },
  summaryValue:   { fontSize: 18, fontWeight: "900", color: "#fff" },
  summaryLabel:   { fontSize: 7, color: "#6B7280", fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.3, textAlign: "center", paddingVertical: 5, paddingHorizontal: 3 },

  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 2, marginBottom: 6 },
  sectionTitle: { fontSize: 13, fontWeight: "800", color: "#0D1B3E" },
  sectionCount: { fontSize: 10, color: "#6B7280" },
  orgList: { paddingBottom: 36 },

  // Org cards — compact with colored left border per card
  orgCard: { backgroundColor: "#fff", borderRadius: 10, padding: 8, marginBottom: 6, shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 5, shadowOffset: { width: 0, height: 1 }, elevation: 1, borderLeftWidth: 3, borderLeftColor: "#1A3CC8" },
  orgCardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  orgTitle: { fontSize: 11, fontWeight: "800", color: "#0D1B3E" },
  orgSubtitle: { fontSize: 9, color: "#6B7280", marginTop: 1 },
  orgTag: { borderRadius: 5, backgroundColor: "#EFF6FF", paddingHorizontal: 5, paddingVertical: 2 },
  orgTagText: { fontSize: 8, color: "#1A3CC8", fontWeight: "700" },
  orgMetaRow: { flexDirection: "row", gap: 5, marginBottom: 6 },
  metaLabelBox: { flex: 1, backgroundColor: "#F0F4FF", borderRadius: 6, padding: 6 },
  metaLabel: { fontSize: 8, fontWeight: "700", color: "#6B7280", marginBottom: 2 },
  metaValue: { fontSize: 10, fontWeight: "800", color: "#0D1B3E" },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  createdAtLabel: { fontSize: 9, color: "#6B7280" },
  createdAtValue: { fontSize: 9, color: "#0D1B3E", fontWeight: "700" },
  statsRow: { flexDirection: "row", justifyContent: "space-between", gap: 5, marginBottom: 5 },
  statBox: { flex: 1, backgroundColor: "#F0F4FF", borderRadius: 6, paddingVertical: 6, alignItems: "center" },
  statNumber: { fontSize: 13, fontWeight: "800", color: "#0D1B3E" },
  statText: { fontSize: 8, color: "#6B7280", marginTop: 1 },

  emptyState: { marginTop: 36, alignItems: "center", justifyContent: "center" },
  emptyText: { marginTop: 12, fontSize: 12, color: "#6B7280", textAlign: "center", lineHeight: 18, maxWidth: 240 },
  skeletonContainer: { gap: 8 },
  skeletonCard: { backgroundColor: "#fff", borderRadius: 12, padding: 10, borderLeftWidth: 3, borderLeftColor: "#E5E7EB" },
  skeletonTitle: { height: 12, width: "55%", backgroundColor: "#E5E7EB", borderRadius: 6, marginBottom: 6 },
  skeletonLine: { height: 9, width: "35%", backgroundColor: "#F3F4F6", borderRadius: 5, marginBottom: 12 },
  skeletonRow: { flexDirection: "row", gap: 6, marginBottom: 6 },
  skeletonBox: { flex: 1, height: 40, backgroundColor: "#F3F4F6", borderRadius: 8 },
});

export default SystemOverviewScreen;