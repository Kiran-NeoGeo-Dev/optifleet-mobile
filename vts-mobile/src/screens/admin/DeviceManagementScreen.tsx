import { useState, useCallback, useEffect } from "react";
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  Modal, TextInput, Pressable, ActivityIndicator, StatusBar, ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AdminStackParamList } from "../../navigation/AdminNavigator";
import { Toast, useToast } from "../../components/Toast";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import {
  fetchDevices, createDevice, updateDevice, deleteDevice,
  Device, DevicePayload,
} from "../../services/deviceService";
import ClientSelector, { ClientOption } from "../../components/ClientSelector";
import { useAuth } from "../../hooks/useAuth";
import { pickAndParseFile } from "../../utils/importParser";
import ImportResultModal, { ImportResult } from "../../components/ImportResultModal";

const C = {
  bgDark:      "#0A1F44",
  bgMid:       "#0D3B8E",
  bgBright:    "#1565C0",
  accent:      "#1565C0",
  cream:       "#F6F1E9",
  white:       "#FFFFFF",
  green:       "#22C55E",
  red:         "#EF4444",
  orange:      "#F59E0B",
  label:       "#3A245C",
  muted:       "#4A6A8E",
  inputBg:     "#E8C9A0",
  inputBorder: "rgba(160,90,30,0.35)",
  inputText:   "#3B1F0A",
  placeholder: "#A0785A",
};

type Props = NativeStackScreenProps<AdminStackParamList, "DeviceManagement">;

const EMPTY: DevicePayload = { deviceId: "", deviceType: "MOBILE", mobileNumber: "", imeiNumber: "", deviceModel: "", status: true };

const DeviceManagementScreen = ({ navigation, route }: Props) => {
  const { isAdmin } = useAuth();
  const [selectedClient, setSelectedClient] = useState<ClientOption | null>(null);
  const [devices, setDevices]         = useState<Device[]>([]);
  const [loading, setLoading]         = useState(false);
  const [search, setSearch]           = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMode, setModalMode]     = useState<"add" | "edit" | "view">("add");
  const [form, setForm]               = useState<DevicePayload & { id?: number }>(EMPTY);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const { toast, showToast, hideToast } = useToast();
  const openAddModal = route.params?.openAddModal;
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importing, setImporting]       = useState(false);

  const load = async () => {
    setLoading(true);
    try { setDevices(await fetchDevices()); }
    catch { showToast("Failed to load devices", "error"); }
    finally { setLoading(false); }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  useEffect(() => {
    if (openAddModal) {
      openModal("add");
    }
  }, [openAddModal]);

  const openModal = (mode: "add" | "edit" | "view", device?: Device) => {
    setModalMode(mode);
    setForm(device
      ? { id: device.id, deviceId: device.deviceId, deviceType: device.deviceType, mobileNumber: device.mobileNumber, imeiNumber: device.imeiNumber, deviceModel: device.deviceModel, status: device.status }
      : { ...EMPTY });
    // Pre-select assigned client when editing
    if (mode === "edit" && device?.clientId) {
      setSelectedClient({ id: device.clientId, full_name: "", username: "" });
    } else if (mode === "add") {
      setSelectedClient(null);
    }
    setModalVisible(true);
  };

  const validate = () => {
    if (!form.deviceId.trim())      { showToast("Device ID is required", "error"); return false; }
    if (!/^\d{10}$/.test(form.mobileNumber)) { showToast("Mobile number must be 10 digits", "error"); return false; }
    if (!/^\d{15}$/.test(form.imeiNumber))   { showToast("IMEI must be 15 digits", "error"); return false; }
    if (!form.deviceModel.trim())   { showToast("Device model is required", "error"); return false; }
    return true;
  };

  const handleSave = async () => {
    if (!validate()) return;
    if (isAdmin && modalMode === "add" && !selectedClient) {
      showToast("Please select a client.", "error");
      return;
    }
    const payload: DevicePayload = { deviceId: form.deviceId, deviceType: form.deviceType, mobileNumber: form.mobileNumber, imeiNumber: form.imeiNumber, deviceModel: form.deviceModel, status: form.status, clientId: selectedClient?.id };
    try {
      if (modalMode === "add") { await createDevice(payload); showToast("Device created", "success"); }
      else                     { await updateDevice(form.id!, payload); showToast("Device updated", "success"); }
      setModalVisible(false);
      load();
    } catch (e: any) {
      showToast(e?.response?.data?.message || "Save failed", "error");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try { await deleteDevice(deleteTarget); showToast("Device deleted", "success"); load(); }
    catch { showToast("Delete failed", "error"); }
    finally { setDeleteTarget(null); }
  };

  const closeModal = () => {
    if (openAddModal) {
      navigation.goBack();
    } else {
      setModalVisible(false);
    }
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const rows = await pickAndParseFile();
      if (!rows.length) { showToast("No data found in file.", "warning"); setImporting(false); return; }

      let success = 0;
      const failures: ImportResult["failures"] = [];

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const statusRaw   = (r["Status"]     || "").toLowerCase();
        const deviceType  = (r["DeviceType"] || EMPTY.deviceType).trim();
        const payload: DevicePayload = {
          deviceId:     (r["DeviceId"]      || "").trim(),
          deviceType:   deviceType || EMPTY.deviceType,
          mobileNumber: (r["MobileNumber"]  || "").trim(),
          imeiNumber:   (r["IMEINumber"]    || "").trim(),
          deviceModel:  (r["DeviceModel"]   || "").trim(),
          status:       statusRaw !== "inactive",
        };
        try {
          await createDevice(payload);
          success++;
        } catch (e: any) {
          failures.push({
            row: i + 2,
            reason: e?.response?.data?.message || e?.message || "Unknown error",
          });
        }
      }

      setImportResult({ total: rows.length, success, failures });
      if (success > 0) load();
    } catch (e: any) {
      showToast(e?.message || "Failed to read file.", "error");
    } finally {
      setImporting(false);
    }
  };

  const filtered = devices.filter(d =>
    (d.deviceId ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (d.deviceModel ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (d.mobileNumber ?? "").includes(search)
  );

  const DeviceCard = ({ item }: { item: Device }) => (
    <View style={[styles.card]}>
      <View style={[styles.cardAccent, { backgroundColor: item.status ? C.green : C.red }]} />
      <View style={styles.cardRow}>
        <Text style={styles.deviceId}>{item.deviceId}</Text>
        <View style={[styles.badge, { backgroundColor: item.status ? C.green + "33" : C.red + "33", borderColor: item.status ? C.green : C.red }]}>
          <Text style={[styles.badgeText, { color: item.status ? C.green : C.red }]}>{item.status ? "Active" : "Inactive"}</Text>
        </View>
      </View>
      <Text style={styles.cardModel}>{item.deviceModel}</Text>
      <Text style={styles.cardSub}>📱 {item.mobileNumber}  •  🔢 {item.imeiNumber}</Text>
      <View style={styles.cardActions}>
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: "#6366f122" }]} onPress={() => openModal("view", item)}>
          <Ionicons name="eye-outline" size={15} color="#6366f1" /><Text style={[styles.actionTxt, { color: "#6366f1" }]}>View</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: C.accent + "22" }]} onPress={() => openModal("edit", item)}>
          <Ionicons name="create-outline" size={15} color={C.accent} /><Text style={[styles.actionTxt, { color: C.accent }]}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: C.red + "22" }]} onPress={() => setDeleteTarget(item.id)}>
          <Ionicons name="trash-outline" size={15} color={C.red} /><Text style={[styles.actionTxt, { color: C.red }]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const showList = !(openAddModal && modalMode === "add" && modalVisible);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#0A1F44" />
      <LinearGradient
        colors={["#0A1F44", "#0D3B8E", "#1565C0"]}
        locations={[0, 0.5, 1]}
        start={{ x: 0.15, y: 0 }} end={{ x: 0.85, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {[0.18, 0.38, 0.58, 0.78].map((t, i) => (
        <View key={`h${i}`} style={[styles.gridH, { top: `${t * 100}%` as any }]} />
      ))}
      <SafeAreaView style={{ flex: 1 }}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={C.white} />
        </TouchableOpacity>
        <Text style={styles.title}>Device Management</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countTxt}>{filtered.length}</Text>
        </View>
      </View>

      {/* Search */}
      {showList && (
        <>
          <View style={styles.searchWrap}>
            <Ionicons name="search-outline" size={16} color="#9C6B30" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by ID, model or mobile..."
              placeholderTextColor="#6B7280"
              value={search}
              onChangeText={setSearch}
            />
          </View>

          {loading
            ? <ActivityIndicator color={C.accent} style={{ marginTop: 40 }} />
            : <FlatList
                data={filtered}
                keyExtractor={i => i.id.toString()}
                renderItem={({ item }) => <DeviceCard item={item} />}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
                ListEmptyComponent={<Text style={styles.empty}>No devices found</Text>}
              />
          }
        </>
      )}

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={closeModal}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>

            {/* ── Hero header ── */}
            <View style={styles.heroRow}>
              <TouchableOpacity style={styles.sheetBackBtn} onPress={closeModal}>
                <Ionicons name="chevron-back" size={20} color={C.white} />
              </TouchableOpacity>
              <View style={styles.heroIconWrap}>
                <Ionicons name="phone-portrait-outline" size={28} color={C.white} />
              </View>
              <View style={{ width: 38 }} />
            </View>
            <Text style={styles.sheetTitle}>
              {modalMode === "add" ? "Register Device" : modalMode === "edit" ? "Edit Device" : "Device Details"}
            </Text>
            <Text style={styles.sheetSub}>
              {modalMode === "add" ? "Register a new device to the system" : modalMode === "edit" ? "Update device information" : "View device information"}
            </Text>

            <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 16 }} keyboardShouldPersistTaps="handled">

              {/* ── Card ── */}
              <View style={styles.formCard}>

                {/* Client selector + Import button — add and edit modes */}
                {isAdmin && (modalMode === "add" || modalMode === "edit") && (
                  <View style={styles.selectorRow}>
                    <View style={{ flex: 1 }}>
                      <ClientSelector selectedClientId={selectedClient?.id ?? null} onSelect={setSelectedClient} />
                    </View>
                    {modalMode === "add" && (
                      <TouchableOpacity
                        style={styles.importBtn}
                        onPress={handleImport}
                        disabled={importing}
                      >
                        {importing
                          ? <ActivityIndicator size="small" color="#fff" />
                          : <Ionicons name="cloud-upload-outline" size={15} color="#fff" />
                        }
                        <Text style={styles.importBtnTxt}>{importing ? "Importing…" : "Import Excel / CSV"}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {/* Device ID */}
                <View style={styles.dotLabel}>
                  <View style={styles.dot} />
                  <Text style={styles.dotLabelTxt}>DEVICE ID</Text>
                </View>
                <View style={[styles.fieldBox, modalMode === "view" && styles.fieldBoxReadonly]}>
                  <View style={[styles.fieldIconBox, { backgroundColor: "#FFF3E0" }]}>
                    <Ionicons name="phone-portrait-outline" size={18} color="#F57C00" />
                  </View>
                  <TextInput style={styles.fieldInput} placeholder="Enter device ID" placeholderTextColor={C.placeholder}
                    value={form.deviceId} onChangeText={t => setForm(f => ({ ...f, deviceId: t }))}
                    editable={modalMode !== "view"} autoCapitalize="none" />
                </View>

                {/* Mobile Number */}
                <View style={styles.dotLabel}>
                  <View style={styles.dot} />
                  <Text style={styles.dotLabelTxt}>MOBILE NUMBER</Text>
                </View>
                <View style={[styles.fieldBox, modalMode === "view" && styles.fieldBoxReadonly]}>
                  <View style={[styles.fieldIconBox, { backgroundColor: "#EDE7F6" }]}>
                    <Ionicons name="call-outline" size={18} color="#7B2CBF" />
                  </View>
                  <TextInput style={styles.fieldInput} placeholder="10-digit mobile number" placeholderTextColor={C.placeholder}
                    value={form.mobileNumber} onChangeText={t => setForm(f => ({ ...f, mobileNumber: t }))}
                    keyboardType="numeric" maxLength={10} editable={modalMode !== "view"} />
                </View>

                {/* IMEI */}
                <View style={styles.dotLabel}>
                  <View style={styles.dot} />
                  <Text style={styles.dotLabelTxt}>IMEI NUMBER</Text>
                </View>
                <View style={[styles.fieldBox, modalMode === "view" && styles.fieldBoxReadonly]}>
                  <View style={[styles.fieldIconBox, { backgroundColor: "#E8F5E9" }]}>
                    <Ionicons name="barcode-outline" size={18} color="#2E7D32" />
                  </View>
                  <TextInput style={styles.fieldInput} placeholder="15-digit IMEI number" placeholderTextColor={C.placeholder}
                    value={form.imeiNumber} onChangeText={t => setForm(f => ({ ...f, imeiNumber: t }))}
                    keyboardType="numeric" maxLength={15} editable={modalMode !== "view"} />
                </View>

                {/* Device Model */}
                <View style={styles.dotLabel}>
                  <View style={styles.dot} />
                  <Text style={styles.dotLabelTxt}>DEVICE MODEL</Text>
                </View>
                <View style={[styles.fieldBox, modalMode === "view" && styles.fieldBoxReadonly]}>
                  <View style={[styles.fieldIconBox, { backgroundColor: "#E3F2FD" }]}>
                    <Ionicons name="hardware-chip-outline" size={18} color="#1565C0" />
                  </View>
                  <TextInput style={styles.fieldInput} placeholder="e.g. Samsung Galaxy A32" placeholderTextColor={C.placeholder}
                    value={form.deviceModel} onChangeText={t => setForm(f => ({ ...f, deviceModel: t }))}
                    editable={modalMode !== "view"} />
                </View>

                {/* Status */}
                <View style={styles.dotLabel}>
                  <View style={styles.dot} />
                  <Text style={styles.dotLabelTxt}>STATUS</Text>
                </View>
                <View style={styles.toggleRow}>
                  <TouchableOpacity
                    style={[styles.toggleBtn, form.status && styles.toggleActive]}
                    onPress={() => modalMode !== "view" && setForm(f => ({ ...f, status: true }))}
                  >
                    <Ionicons name="checkmark-circle" size={16} color={form.status ? C.green : C.muted} />
                    <Text style={[styles.toggleTxt, form.status && { color: C.green }]}>Active</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.toggleBtn, !form.status && styles.toggleInactive]}
                    onPress={() => modalMode !== "view" && setForm(f => ({ ...f, status: false }))}
                  >
                    <Ionicons name="close-circle" size={16} color={!form.status ? C.red : C.muted} />
                    <Text style={[styles.toggleTxt, !form.status && { color: C.red }]}>Inactive</Text>
                  </TouchableOpacity>
                </View>

              </View>

              {/* ── Footer buttons ── */}
              <View style={styles.sheetBtns}>
                {modalMode !== "view" && (
                  <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                    <LinearGradient
                      colors={["#16A34A", "#14532D"]}
                      start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                      style={styles.saveBtnGrad}
                    >
                      <LinearGradient
                        colors={["rgba(255,255,255,0.14)", "rgba(255,255,255,0.00)"]}
                        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
                        style={styles.saveBtnGloss}
                      />
                      <Ionicons name="shield-checkmark-outline" size={18} color={C.white} />
                      <Text style={styles.saveTxt}>{modalMode === "add" ? "Register Device" : "Update Device"}</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )}
              </View>

            </ScrollView>
          </View>
        </View>
      </Modal>

      <ImportResultModal
        visible={!!importResult}
        result={importResult}
        onClose={() => setImportResult(null)}
      />
      <ConfirmDialog
        visible={!!deleteTarget}
        title="Delete Device"
        message="Are you sure you want to delete this device?"
        confirmText="Delete"
        cancelText="Cancel"
        confirmColor={C.red}
        icon="trash-outline"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
      <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={hideToast} />
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  root:          { flex: 1 },
  gridH:         { position: "absolute", left: 0, right: 0, height: 1, backgroundColor: "rgba(255,255,255,0.025)" },
  header:        { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8, gap: 10 },
  backBtn:       { width: 36, height: 36, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.12)", borderWidth: 1, borderColor: "rgba(255,255,255,0.20)", alignItems: "center", justifyContent: "center" },
  title:         { flex: 1, fontSize: 18, fontWeight: "800", color: C.white },
  countBadge:    { backgroundColor: "rgba(245,158,11,0.18)", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: C.orange + "44" },
  countTxt:      { fontSize: 12, fontWeight: "800", color: C.orange },
  searchWrap:    { flexDirection: "row", alignItems: "center", alignSelf: "center", width: "90%", maxWidth: 420, marginBottom: 10, backgroundColor: "#E8CBA7", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: "rgba(120,70,20,0.18)", shadowColor: "#7A4010", shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  searchInput:   { flex: 1, color: "#2B1D0E", fontSize: 13, fontWeight: "500" },
  empty:         { textAlign: "center", color: "rgba(255,255,255,0.55)", marginTop: 40 },
  card:          { backgroundColor: C.cream, borderRadius: 12, padding: 11, marginBottom: 8, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 7, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  cardAccent:    { position: "absolute", top: 0, left: 0, right: 0, height: 2 },
  cardRow:       { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4, marginTop: 2 },
  deviceId:      { fontSize: 13, fontWeight: "700", color: C.bgDark },
  badge:         { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 7, borderWidth: 1 },
  badgeText:     { fontSize: 10, fontWeight: "700" },
  cardModel:     { fontSize: 12, color: C.muted, marginBottom: 3 },
  cardSub:       { fontSize: 11, color: "#6A8AB0", marginBottom: 8 },
  cardActions:   { flexDirection: "row", gap: 6 },
  actionBtn:     { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999 },
  actionTxt:     { fontSize: 11, fontWeight: "600" },
  overlay:       { flex: 1, backgroundColor: "rgba(0,0,0,0.0)", justifyContent: "flex-end" },
  sheet:         { flex: 1, backgroundColor: C.bgDark },
  heroRow:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 32, paddingBottom: 6 },
  sheetBackBtn:  { width: 32, height: 32, borderRadius: 9, backgroundColor: "rgba(255,255,255,0.12)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  heroIconWrap:  { width: 44, height: 44, borderRadius: 22, backgroundColor: C.bgMid, borderWidth: 2, borderColor: "rgba(255,255,255,0.20)", alignItems: "center", justifyContent: "center" },
  sheetTitle:    { fontSize: 17, fontWeight: "800", color: C.white, textAlign: "center", marginTop: 4 },
  sheetSub:      { fontSize: 11, color: "rgba(255,255,255,0.60)", textAlign: "center", marginTop: 2, marginBottom: 2, paddingHorizontal: 28 },
  sheetHandle:   { width: 36, height: 3, borderRadius: 2, backgroundColor: "rgba(21,101,192,0.20)", alignSelf: "center", marginBottom: 12 },
  formCard:      { backgroundColor: C.cream, borderRadius: 18, padding: 16, marginHorizontal: 14, shadowColor: "#000", shadowOpacity: 0.07, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 5 },
  dotLabel:      { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6, marginTop: 3 },
  dot:           { width: 6, height: 6, borderRadius: 3, backgroundColor: C.bgMid },
  dotLabelTxt:   { fontSize: 10, fontWeight: "800", color: C.bgDark, letterSpacing: 0.9 },
  fieldBox:      { flexDirection: "row", alignItems: "center", backgroundColor: C.inputBg, borderRadius: 10, borderWidth: 1, borderColor: C.inputBorder, minHeight: 44, marginBottom: 10, overflow: "hidden" },
  fieldBoxReadonly: { opacity: 0.65 },
  fieldIconBox:  { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  fieldIcon:     { marginLeft: 10, marginRight: 3 },
  fieldInput:    { flex: 1, fontSize: 13, color: C.inputText, paddingVertical: 10, paddingRight: 10 },
  fieldLabel:    { fontSize: 12, fontWeight: "700", color: C.label, marginBottom: 5, marginTop: 3 },
  toggleRow:     { flexDirection: "row", gap: 8, marginBottom: 6 },
  toggleBtn:     { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 10, borderRadius: 10, backgroundColor: "rgba(21,101,192,0.06)", borderWidth: 1, borderColor: "rgba(21,101,192,0.14)" },
  toggleActive:  { backgroundColor: "rgba(34,197,94,0.12)", borderColor: "#22C55E88" },
  toggleInactive:{ backgroundColor: "rgba(248,113,113,0.12)", borderColor: "#F8717188" },
  toggleTxt:     { fontSize: 13, fontWeight: "700", color: C.muted },
  selectorRow:   { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 3 },
  importBtn:     { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#0D3B8E", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, marginTop: 3, alignSelf: "flex-start" },
  importBtnTxt:  { color: "#fff", fontSize: 11, fontWeight: "700" },
  sheetBtns:     { marginHorizontal: 14, marginTop: 12, marginBottom: 24 },
  saveBtn:       { borderRadius: 12, overflow: "hidden", shadowColor: "#14532D", shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  saveBtnGrad:   { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: 12, overflow: "hidden" },
  saveBtnGloss:  { position: "absolute", top: 0, left: 0, right: 0, height: 20, borderRadius: 12 },
  saveTxt:       { color: C.white, fontWeight: "800", fontSize: 14, letterSpacing: 0.3 },
  input:         { backgroundColor: C.inputBg, borderWidth: 1, borderColor: C.inputBorder, borderRadius: 10, padding: 11, color: C.inputText, fontSize: 13, marginBottom: 10 },
  inputReadonly: { opacity: 0.6 },
  statusToggle:  { flexDirection: "row", alignItems: "center", gap: 6, padding: 10, borderRadius: 10, marginBottom: 16 },
  statusActive:  { backgroundColor: C.green + "33", borderWidth: 1, borderColor: C.green },
  statusInactive:{ backgroundColor: C.red + "33",   borderWidth: 1, borderColor: C.red },
  statusTxt:     { color: C.white, fontWeight: "700", fontSize: 13 },
});

export default DeviceManagementScreen;
