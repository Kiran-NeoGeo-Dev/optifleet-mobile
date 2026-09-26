import { useCallback, useState, useEffect } from "react";
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, Modal, Pressable, ScrollView, ActivityIndicator,
  StatusBar, Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { MainStackParamList } from "../../navigation/MainNavigator";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { Toast, useToast } from "../../components/Toast";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import {
  fetchAssociations, fetchVehiclesWithDevice,
  createAssociation, updateAssociation, deleteAssociation,
  fetchAvailableDrivers,
} from "../../services/associationService";
import {
  fetchAdminAssociations, fetchVehiclesDropdown, fetchAvailableDevices,
  createAdminAssociation, updateAdminAssociation, deleteAdminAssociation,
  fetchAdminFullAssociations, fetchVehiclesWithAdminDevice, fetchAllDrivers,
  createAdminFullAssociation, updateAdminFullAssociation, deleteAdminFullAssociation,
} from "../../services/adminAssociationService";
import { useAuth } from "../../hooks/useAuth";
import { COLORS, SHADOWS } from "../../components/ScreenBg";

const { width: SW } = Dimensions.get("window");

// Common types
type CommonAssociation = {
  id: number;
  vehicle_id: number;
  device_id: number;
  registration_no: string;
  device_code: string;
};

type ClientAssociation = CommonAssociation & {
  driver_id: number;
  driver_name: string;
  country: string;
  status: boolean;
};

type AdminAssociation = CommonAssociation & {
  vehicle_make: string;
  vehicle_model: string;
  device_model: string;
  created_at: string;
};

type VehicleDropdown = {
  id: number;
  registration_no: string;
  vehicle_make: string;
  vehicle_model: string;
};

type DeviceDropdown = {
  id: number;
  device_code: string;
  device_model: string;
  device_type: string;
  mobile_number: string;
};

type VehicleWithDevice = {
  vehicle_id: number;
  registration_no: string;
  device_id: number;
  device_code: string;
};

type DriverOption = {
  driver_id: number;
  driver_name: string;
  license_no: string;
};

type AssociationForm = {
  id?: number;
  vehicleId?: number;
  deviceId?: number;
  driverId?: number;
  country?: string;
  status?: boolean;
};

type Props = NativeStackScreenProps<MainStackParamList, "AssociationList"> | NativeStackScreenProps<any, "AdminFullAssociationList">;

const CLIENT_FORM: AssociationForm = { vehicleId: 0, deviceId: 0, driverId: 0, country: "India", status: true };
const ADMIN_FORM: AssociationForm = { vehicleId: 0, deviceId: 0 };
const ADMIN_FULL_FORM: AssociationForm = { vehicleId: 0, deviceId: 0, driverId: 0, country: "India", status: true };

const AssociationListScreen = ({ navigation, route }: Props) => {
  const { isAdmin } = useAuth();
  const isAdminMode = isAdmin;
  // Detect if this is the Vehicle-Device-Driver (full) admin screen
  const isAdminFullMode = isAdmin && (route as any)?.name === "AdminFullAssociationList";
  const shouldOpenAddModal = route.params?.openAddModal ?? false;
  
  const [associations, setAssociations] = useState<ClientAssociation[] | AdminAssociation[]>([]);
  const [vehicles, setVehicles] = useState<VehicleWithDevice[] | VehicleDropdown[]>([]);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [availableDevices, setAvailableDevices] = useState<DeviceDropdown[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [modalVisible, setModalVisible] = useState(shouldOpenAddModal);
  const [modalMode, setModalMode] = useState<"add" | "edit" | "view">("add");
  const [form, setForm] = useState<AssociationForm>({});
  const [selRegNo, setSelRegNo] = useState("");
  const [selDeviceCode, setSelDeviceCode] = useState("");
  const [selDriverName, setSelDriverName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [vehicleSheet, setVehicleSheet] = useState(false);
  const [driverSheet, setDriverSheet] = useState(false);
  const [deviceSheet, setDeviceSheet] = useState(false);
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [deviceSearch, setDeviceSearch]   = useState("");
  const [driverSearch, setDriverSearch]   = useState("");
  const { toast, showToast, hideToast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (isAdminFullMode) {
        const [assocs, vehs, drvs] = await Promise.all([
          fetchAdminFullAssociations(),
          fetchVehiclesWithAdminDevice(),
          fetchAllDrivers(),
        ]);
        setAssociations(assocs as ClientAssociation[]);
        setVehicles(vehs as VehicleWithDevice[]);
        setDrivers(drvs as DriverOption[]);
      } else if (isAdminMode) {
        const [assocs, vehs, devs] = await Promise.all([
          fetchAdminAssociations(),
          fetchVehiclesDropdown(),
          fetchAvailableDevices()
        ]);
        setAssociations(assocs as AdminAssociation[]);
        setVehicles(vehs as VehicleDropdown[]);
        setAvailableDevices(devs as DeviceDropdown[]);
      } else {
        const [assocs, vehs] = await Promise.all([
          fetchAssociations(),
          fetchVehiclesWithDevice()
        ]);
        setAssociations(assocs as ClientAssociation[]);
        setVehicles(vehs as VehicleWithDevice[]);
      }
    } catch {
      showToast("Failed to load data", "error");
    } finally {
      setLoading(false);
    }
  }, [isAdminFullMode, isAdminMode]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Initialize form when modal opens via openAddModal parameter
  useEffect(() => {
    if (shouldOpenAddModal && modalVisible) {
      if (isAdminFullMode) {
        setForm(ADMIN_FULL_FORM);
      } else if (isAdminMode) {
        setForm(ADMIN_FORM);
      } else {
        setForm(CLIENT_FORM);
      }
      setSelRegNo("");
      setSelDriverName("");
      setSelDeviceCode("");
      setModalMode("add");
    }
  }, [shouldOpenAddModal, modalVisible, isAdminMode, isAdminFullMode]);


  const loadClientDrivers = async (excludeAssocId?: number) => {
    try {
      if (isAdminFullMode) {
        const list = await fetchAllDrivers(excludeAssocId);
        setDrivers(list);
      } else {
        const list = await fetchAvailableDrivers(excludeAssocId);
        setDrivers(list);
      }
    } catch {
      setDrivers([]);
    }
  };

  const openModal = async (mode: "add" | "edit" | "view", item?: any) => {
    setModalMode(mode);
    const editId: number | undefined = item?.id && typeof item.id === "number" ? item.id : undefined;
    if (item) {
      setSelRegNo(item.registration_no);
      if ('driver_name' in item) setSelDriverName(item.driver_name);
      setSelDeviceCode(item.device_code || "");
      setForm({
        id: editId,
        vehicleId: item.vehicle_id,
        deviceId: item.device_id,
        ...( 'driver_id' in item && { driverId: item.driver_id }),
        ...( 'country' in item && { country: item.country }),
        ...( 'status' in item && { status: item.status }),
      });
    } else {
      if (isAdminFullMode) setForm(ADMIN_FULL_FORM);
      else if (isAdminMode) setForm(ADMIN_FORM);
      else setForm(CLIENT_FORM);
      setSelRegNo("");
      setSelDriverName("");
      setSelDeviceCode("");
      setDrivers([]);
    }

    // Reload dropdowns with excludeId so current record's vehicle/device/driver remain selectable
    if (isAdminMode && !isAdminFullMode) {
      const [vehs, devs] = await Promise.all([
        fetchVehiclesDropdown(editId),
        fetchAvailableDevices(editId),
      ]);
      setVehicles(vehs as VehicleDropdown[]);
      setAvailableDevices(devs as DeviceDropdown[]);
    } else if (isAdminFullMode) {
      const drvs = await fetchAllDrivers(editId);
      setDrivers(drvs as DriverOption[]);
    } else {
      // For pending items (no editId) or edit mode, load available drivers
      await loadClientDrivers(editId);
    }

    setModalVisible(true);
  };

  const onVehicleSelect = async (v: any) => {
    setVehicleSheet(false);
    setSelRegNo(v.registration_no || v.license_plate);
    setSelDriverName("");
    
    const vehicleId = v.vehicle_id || v.id;
    const deviceId = v.device_id || v.deviceId || 0;
    
    // In admin full mode the vehicle already carries a device from admin_associations
    if (isAdminFullMode && v.device_code) {
      setSelDeviceCode(v.device_code);
    }
    
    setForm(prev => ({ ...prev, vehicleId, deviceId }));

    if ((!isAdminMode || isAdminFullMode) && deviceId) {
      await loadClientDrivers();
    }
  };

  const onDeviceSelect = (d: DeviceDropdown) => {
    setDeviceSheet(false);
    setSelDeviceCode(`${d.device_code} --- ${d.device_model}`);
    setForm(prev => ({ ...prev, deviceId: d.id }));
  };

  const onDriverSelect = (d: DriverOption) => {
    setDriverSheet(false);
    setSelDriverName(d.driver_name);
    setForm(prev => ({ ...prev, driverId: d.driver_id }));
  };

  const handleSave = async () => {
    if (!form.vehicleId || !form.deviceId) {
      showToast("Please select both vehicle and device", "error");
      return;
    }

    try {
      if (isAdminFullMode) {
        if (!form.driverId) { showToast("Please select a driver", "error"); return; }
        const payload = {
          vehicleId: form.vehicleId!, deviceId: form.deviceId!, driverId: form.driverId!,
          country: form.country || "India", status: form.status !== undefined ? form.status : true,
        };
        if (modalMode === "add") {
          await createAdminFullAssociation(payload);
          showToast("Vehicle-Device-Driver association created", "success");
        } else if (form.id !== undefined) {
          await updateAdminFullAssociation(form.id, payload);
          showToast("Association updated", "success");
        } else { showToast("Invalid association ID", "error"); return; }
      } else if (isAdminMode) {
        const payload = { vehicle_id: form.vehicleId!, device_id: form.deviceId! };
        if (modalMode === "add") {
          await createAdminAssociation(payload);
          showToast("Vehicle-Device association created", "success");
        } else if (form.id !== undefined) {
          await updateAdminAssociation(form.id, payload);
          showToast("Association updated", "success");
        } else { showToast("Invalid association ID", "error"); return; }
      } else {
        if (!form.driverId) { showToast("Please select a driver", "error"); return; }
        const payload = {
          vehicleId: form.vehicleId!, deviceId: form.deviceId!, driverId: form.driverId!,
          country: form.country || "India", status: form.status !== undefined ? form.status : true,
        };
        if (modalMode === "add") {
          await createAssociation(payload);
          showToast("Driver association created", "success");
        } else if (form.id !== undefined) {
          await updateAssociation(form.id, payload);
          showToast("Association updated", "success");
        } else { showToast("Invalid association ID", "error"); return; }
      }
      setModalVisible(false);
      load();
    } catch (e: any) {
      showToast(e.response?.data?.message || "Save failed", "error");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || typeof deleteTarget !== "number") return;
    try {
      if (isAdminFullMode) {
        await deleteAdminFullAssociation(deleteTarget);
      } else if (isAdminMode) {
        await deleteAdminAssociation(deleteTarget);
      } else {
        await deleteAssociation(deleteTarget);
      }
      showToast("Association deleted", "success");
      load();
    } catch {
      showToast("Delete failed", "error");
    } finally {
      setDeleteTarget(null);
    }
  };

  const filtered = associations.filter((a: any) => {
    const regNo = a.registration_no?.toLowerCase() || "";
    const deviceCode = a.device_code?.toLowerCase() || "";
    const driverName = a.driver_name?.toLowerCase() || "";
    return regNo.includes(query.toLowerCase()) || 
           deviceCode.includes(query.toLowerCase()) || 
           driverName.includes(query.toLowerCase());
  });

  const AssocCard = ({ item }: { item: any }) => {
    const isPending = item.association_status === "PENDING";
    const hasStatus = 'status' in item;
    const statusColor = isPending ? "#D97706"
      : hasStatus ? (item.status ? "#16A34A" : "#DC2626") : "#1565C0";
    const statusBg    = isPending ? "rgba(217,119,6,0.12)"
      : hasStatus ? (item.status ? "rgba(22,163,74,0.12)" : "rgba(220,38,38,0.12)") : "rgba(21,101,192,0.12)";
    const statusBorder= isPending ? "rgba(217,119,6,0.35)"
      : hasStatus ? (item.status ? "rgba(22,163,74,0.35)" : "rgba(220,38,38,0.35)") : "rgba(21,101,192,0.35)";
    const accentColor = isPending ? "#D97706" : hasStatus ? statusColor : "#1565C0";
    const statusLabel = isPending ? "Pending" : (item.status ? "Active" : "Inactive");

    return (
      <View style={[styles.card, SHADOWS.card]}>
        <View style={[styles.accentBar, { backgroundColor: accentColor }]} />
        <View style={styles.cardInner}>
          <View style={styles.topRow}>
            <View style={styles.idWrap}>
              <Ionicons name="git-network-outline" size={14} color="#7B2CBF" />
              <Text style={styles.idTxt}>{isPending ? "" : `#${item.id}  `}{item.registration_no}</Text>
            </View>
            <View style={[styles.statusPill, { backgroundColor: statusBg, borderColor: statusBorder }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusTxt, { color: statusColor }]}>{statusLabel}</Text>
            </View>
          </View>

          <View style={styles.detailGrid}>
            <View style={styles.detailCol}>
              <Text style={styles.detailLabel}>Device</Text>
              <Text style={styles.detailVal}>{item.device_code || "—"}</Text>
            </View>
            {(!isAdminMode || isAdminFullMode) && (
              <View style={styles.detailCol}>
                <Text style={styles.detailLabel}>Driver</Text>
                <Text style={[styles.detailVal, isPending && { color: "#D97706", fontSize: 11 }]}>
                  {isPending ? "Driver Association Pending" : (item.driver_name || "—")}
                </Text>
              </View>
            )}
            {(!isAdminMode || isAdminFullMode) && !isPending && (
              <View style={styles.detailCol}>
                <Text style={styles.detailLabel}>Country</Text>
                <Text style={styles.detailVal}>{item.country || "—"}</Text>
              </View>
            )}
            {item.km_travelled != null && item.km_travelled > 0 && (
              <View style={styles.detailCol}>
                <Text style={styles.detailLabel}>Distance Travelled</Text>
                <Text style={[styles.detailVal, { color: "#059669", fontWeight: "700" }]}>
                  {item.km_travelled.toFixed(1)} km
                </Text>
              </View>
            )}
          </View>

          <View style={styles.cardActions}>
            {!isPending && (
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: "rgba(99,102,241,0.10)", borderColor: "rgba(99,102,241,0.30)" }]} onPress={() => openModal("view", item)}>
                <Ionicons name="eye-outline" size={14} color="#6366f1" />
                <Text style={[styles.actionTxt, { color: "#6366f1" }]}>View</Text>
              </TouchableOpacity>
            )}
            {!isPending && (
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: "rgba(21,101,192,0.10)", borderColor: "rgba(21,101,192,0.30)" }]} onPress={() => openModal("edit", item)}>
                <Ionicons name="create-outline" size={14} color="#1565C0" />
                <Text style={[styles.actionTxt, { color: "#1565C0" }]}>Edit</Text>
              </TouchableOpacity>
            )}
            {!isPending && (
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: "rgba(239,68,68,0.10)", borderColor: "rgba(239,68,68,0.30)" }]} onPress={() => setDeleteTarget(item.id)}>
                <Ionicons name="trash-outline" size={14} color="#EF4444" />
                <Text style={[styles.actionTxt, { color: "#EF4444" }]}>Delete</Text>
              </TouchableOpacity>
            )}
            {isPending && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: "rgba(217,119,6,0.10)", borderColor: "rgba(217,119,6,0.35)" }]}
                onPress={() => openModal("add", {
                  vehicle_id: item.vehicle_id,
                  device_id: item.device_id,
                  registration_no: item.registration_no,
                  device_code: item.device_code,
                })}
              >
                <Ionicons name="person-add-outline" size={14} color="#D97706" />
                <Text style={[styles.actionTxt, { color: "#D97706" }]}>Assign Driver</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#0A1F44" />
      <LinearGradient
        colors={["#0A1F44", "#0D3B8E", "#1565C0"]}
        locations={[0, 0.5, 1]}
        start={{ x: 0.15, y: 0 }} end={{ x: 0.85, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {[0.18, 0.36, 0.54, 0.72].map((t, i) => (
        <View key={`h${i}`} style={[styles.gridH, { top: `${t * 100}%` as any }]} />
      ))}
      <View style={styles.orb} />

      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>{isAdminFullMode ? "Vehicle-Device-Driver" : isAdminMode ? "Vehicle-Device Links" : "Associations"}</Text>
            <Text style={styles.headerSub}>{filtered.length} record{filtered.length !== 1 ? "s" : ""}</Text>
          </View>
          <View style={{ width: 42 }} />
        </View>

        {/* Search */}
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={16} color="#5F6F8F" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search vehicle, device, driver…"
            placeholderTextColor="#5F6F8F"
            onChangeText={setQuery}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery("")}>
              <Ionicons name="close-circle" size={18} color="#5F6F8F" />
            </TouchableOpacity>
          )}
        </View>

      {loading ? (
        <ActivityIndicator color="#fff" style={{ marginTop: 40 }} size="large" />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(i) => String(i.id)}
          renderItem={({ item }) => <AssocCard item={item} />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="git-network-outline" size={52} color={COLORS.whiteFaint} />
              <Text style={styles.emptyTxt}>No associations found</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => openModal("add")}>
                <Text style={styles.emptyBtnTxt}>Create {isAdminMode ? "Link" : "Association"}</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      </SafeAreaView>

      {/* Modal */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <Pressable style={styles.overlay} onPress={() => setModalVisible(false)}>
          <Pressable style={styles.sheet}>
            <Text style={styles.sheetTitle}>
              {modalMode === "view"
                ? "Association Details"
                : modalMode === "edit"
                  ? "Edit " + (isAdminFullMode ? "Association" : isAdminMode ? "Link" : "Association")
                  : "New " + (isAdminFullMode ? "Association" : isAdminMode ? "Link" : "Association")}
            </Text>
            <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollContent}>
              
              {/* Vehicle Selection */}
              <Text style={styles.fieldLabel}>1. Vehicle Registration *</Text>
              {modalMode === "view" ? (
                <View style={styles.readOnly}>
                  <Text style={styles.readOnlyTxt}>{selRegNo}</Text>
                </View>
              ) : (
                <TouchableOpacity style={styles.selector} onPress={() => setVehicleSheet(true)}>
                  <Ionicons name="car-outline" size={16} color="#7B2CBF" />
                  <Text style={[styles.selectorTxt, !selRegNo && { color: "#5F6F8F" }]}>
                    {selRegNo || "Select vehicle"}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color="#5F6F8F" />
                </TouchableOpacity>
              )}

              {/* Device Selection */}
              <Text style={styles.fieldLabel}>2. Device {isAdminMode && !isAdminFullMode ? "*" : "(Auto)"}</Text>
              {modalMode === "view" ? (
                <View style={styles.readOnly}>
                  <Text style={styles.readOnlyTxt}>{selDeviceCode || form.deviceId ? `Device ID: ${form.deviceId}` : "—"}</Text>
                </View>
              ) : isAdminMode && !isAdminFullMode ? (
                <TouchableOpacity style={styles.selector} onPress={() => setDeviceSheet(true)}>
                  <Ionicons name="phone-portrait-outline" size={16} color="#7B2CBF" />
                  <Text style={[styles.selectorTxt, !selDeviceCode && { color: "#5F6F8F" }]}>
                    {selDeviceCode || "Select device"}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color="#5F6F8F" />
                </TouchableOpacity>
              ) : (
                <View style={styles.readOnly}>
                  <Text style={styles.readOnlyTxt}>
                    {selDeviceCode || form.deviceId ? `Auto: Device ID ${form.deviceId}` : "Select vehicle first"}
                  </Text>
                </View>
              )}

              {/* Driver + country + status: shown for client mode AND admin full mode */}
              {(!isAdminMode || isAdminFullMode) && (
                <>
                  <Text style={styles.fieldLabel}>3. Assign Driver *</Text>
                  {modalMode === "view" ? (
                    <View style={styles.readOnly}>
                      <Text style={styles.readOnlyTxt}>{selDriverName || "—"}</Text>
                    </View>
                  ) : (
                    <TouchableOpacity style={[styles.selector, !form.deviceId && styles.selectorDisabled]} onPress={() => form.deviceId && setDriverSheet(true)} disabled={!form.deviceId}>
                      <Ionicons name="person-outline" size={16} color="#7B2CBF" />
                      <Text style={[styles.selectorTxt, !selDriverName && { color: "#5F6F8F" }]}>
                        {selDriverName || (form.deviceId ? "Select driver" : "Select vehicle first")}
                      </Text>
                      <Ionicons name="chevron-down" size={16} color="#5F6F8F" />
                    </TouchableOpacity>
                  )}

                  <Text style={styles.fieldLabel}>4. Country</Text>
                  {modalMode === "view" ? (
                    <View style={styles.readOnly}>
                      <Text style={styles.readOnlyTxt}>{form.country || "India"}</Text>
                    </View>
                  ) : (
                    <TextInput 
                      style={styles.input} 
                      value={form.country} 
                      onChangeText={(t) => setForm(prev => ({ ...prev, country: t }))}
                      placeholder="India" 
                      placeholderTextColor="#5F6F8F"
                    />
                  )}

                  <Text style={styles.fieldLabel}>5. Status</Text>
                  {modalMode === "view" ? (
                    <View style={[styles.statusReadOnly, form.status ? styles.statusActive : styles.statusInactive]}>
                      <Text style={styles.statusReadOnlyTxt}>{form.status ? "Active" : "Inactive"}</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[styles.statusToggle, form.status ? styles.statusActive : styles.statusInactive]}
                      onPress={() => setForm(prev => ({ ...prev, status: !prev.status }))}
                    >
                      <Ionicons name={form.status ? "checkmark-circle" : "close-circle"} size={18} color={COLORS.white} />
                      <Text style={styles.statusToggleTxt}>Status: {form.status ? "Active" : "Inactive"}</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}

            </ScrollView>

            <View style={styles.sheetBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelTxt}>{modalMode === "view" ? "Close" : "Cancel"}</Text>
              </TouchableOpacity>
              {modalMode !== "view" && (
                <TouchableOpacity style={styles.saveBtnOuter} onPress={handleSave} activeOpacity={0.84}>
                  <LinearGradient colors={["#16A34A", "#14532D"]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.saveBtn}>
                    <LinearGradient colors={["rgba(255,255,255,0.14)", "rgba(255,255,255,0.00)"]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={styles.saveBtnGloss} />
                    <Text style={styles.saveTxt}>Save</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Vehicle Sheet */}
      <Modal visible={vehicleSheet} transparent animationType="slide" onRequestClose={() => { setVehicleSheet(false); setVehicleSearch(""); }}>
        <Pressable style={styles.overlay} onPress={() => { setVehicleSheet(false); setVehicleSearch(""); }}>
          <Pressable style={styles.sheetSmall}>
            <Text style={styles.sheetTitle}>Select Vehicle</Text>
            <View style={styles.sheetSearch}>
              <Ionicons name="search" size={15} color={COLORS.whiteMuted} />
              <TextInput
                style={styles.sheetSearchInput}
                placeholder="Search registration no..."
                placeholderTextColor={COLORS.placeholder}
                value={vehicleSearch}
                onChangeText={setVehicleSearch}
                autoFocus
              />
              {vehicleSearch.length > 0 && (
                <TouchableOpacity onPress={() => setVehicleSearch("")}>
                  <Ionicons name="close-circle" size={16} color={COLORS.whiteMuted} />
                </TouchableOpacity>
              )}
            </View>
            <FlatList
              data={(vehicles as any[]).filter(v =>
                v.registration_no?.toLowerCase().includes(vehicleSearch.toLowerCase())
              )}
              keyExtractor={(v) => String(v.id)}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.pickerItem} onPress={() => { onVehicleSelect(item); setVehicleSearch(""); }}>
                  <Ionicons name="car-outline" size={16} color={COLORS.accent} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pickerItemTxt}>{item.registration_no}</Text>
                    {isAdminMode ? (
                      <Text style={styles.pickerItemSub}>{item.vehicle_make} {item.vehicle_model}</Text>
                    ) : (
                      <Text style={styles.pickerItemSub}>{item.device_code ? `Device: ${item.device_code}` : "No device"}</Text>
                    )}
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={styles.noResults}>No vehicles found</Text>}
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Device Sheet (Admin only) */}
      <Modal visible={deviceSheet} transparent animationType="slide" onRequestClose={() => { setDeviceSheet(false); setDeviceSearch(""); }}>
        <Pressable style={styles.overlay} onPress={() => { setDeviceSheet(false); setDeviceSearch(""); }}>
          <Pressable style={styles.sheetSmall}>
            <Text style={styles.sheetTitle}>Select Device</Text>
            <View style={styles.sheetSearch}>
              <Ionicons name="search" size={15} color={COLORS.whiteMuted} />
              <TextInput
                style={styles.sheetSearchInput}
                placeholder="Search device code or model..."
                placeholderTextColor={COLORS.placeholder}
                value={deviceSearch}
                onChangeText={setDeviceSearch}
                autoFocus
              />
              {deviceSearch.length > 0 && (
                <TouchableOpacity onPress={() => setDeviceSearch("")}>
                  <Ionicons name="close-circle" size={16} color={COLORS.whiteMuted} />
                </TouchableOpacity>
              )}
            </View>
            <FlatList
              data={availableDevices.filter(d =>
                d.device_code?.toLowerCase().includes(deviceSearch.toLowerCase()) ||
                d.device_model?.toLowerCase().includes(deviceSearch.toLowerCase())
              )}
              keyExtractor={(d) => String(d.id)}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.pickerItem} onPress={() => { onDeviceSelect(item); setDeviceSearch(""); }}>
                  <Ionicons name="phone-portrait-outline" size={16} color={COLORS.accent} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pickerItemTxt}>{item.device_code}</Text>
                    <Text style={styles.pickerItemSub}>{item.device_model}</Text>
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={styles.noResults}>No devices found</Text>}
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Driver Sheet */}
      <Modal visible={driverSheet} transparent animationType="slide" onRequestClose={() => { setDriverSheet(false); setDriverSearch(""); }}>
        <Pressable style={styles.overlay} onPress={() => { setDriverSheet(false); setDriverSearch(""); }}>
          <Pressable style={styles.sheetSmall}>
            <Text style={styles.sheetTitle}>Select Driver</Text>
            <View style={styles.sheetSearch}>
              <Ionicons name="search" size={15} color={COLORS.whiteMuted} />
              <TextInput
                style={styles.sheetSearchInput}
                placeholder="Search driver name..."
                placeholderTextColor={COLORS.placeholder}
                value={driverSearch}
                onChangeText={setDriverSearch}
                autoFocus
              />
              {driverSearch.length > 0 && (
                <TouchableOpacity onPress={() => setDriverSearch("")}>
                  <Ionicons name="close-circle" size={16} color={COLORS.whiteMuted} />
                </TouchableOpacity>
              )}
            </View>
            <FlatList
              data={drivers.filter(d =>
                d.driver_name?.toLowerCase().includes(driverSearch.toLowerCase())
              )}
              keyExtractor={(d) => String(d.driver_id)}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.pickerItem} onPress={() => { onDriverSelect(item); setDriverSearch(""); }}>
                  <Ionicons name="person-outline" size={16} color={COLORS.accent} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pickerItemTxt}>{item.driver_name}</Text>
                    <Text style={styles.pickerItemSub}>License: {item.license_no}</Text>
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={styles.noResults}>No drivers found</Text>}
            />
          </Pressable>
        </Pressable>
      </Modal>

      <ConfirmDialog
        visible={!!deleteTarget}
        title="Delete Association"
        message="Are you sure you want to delete this association?"
        confirmText="Delete"
        cancelText="Cancel"
        confirmColor={COLORS.red}
        icon="trash-outline"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
      <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={hideToast} />
    </View>
  );
};

const styles = StyleSheet.create({
  root:         { flex: 1 },
  safe:         { flex: 1 },
  gridH:        { position: "absolute", left: 0, right: 0, height: 1, backgroundColor: "rgba(255,255,255,0.025)" },
  orb:          { position: "absolute", bottom: 100, left: -70, width: 190, height: 190, borderRadius: 95, backgroundColor: "rgba(13,59,142,0.12)" },

  header:       { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6 },
  backBtn:      { width: 36, height: 36, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.12)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle:  { fontSize: 17, fontWeight: "800", color: "#fff", letterSpacing: 0.2 },
  headerSub:    { fontSize: 11, color: "rgba(255,255,255,0.65)", marginTop: 1 },

  searchWrap:  { flexDirection: "row", alignItems: "center", backgroundColor: "#F0F4FF", borderRadius: 12, marginHorizontal: 14, marginBottom: 10, paddingHorizontal: 12, height: 42, borderWidth: 1, borderColor: "#BFDBFE", shadowColor: "#7A4010", shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  searchInput: { flex: 1, fontSize: 13, color: "#10204A", fontWeight: "500" },

  list: { paddingHorizontal: 14, paddingBottom: 70 },

  card:      { backgroundColor: "rgba(255,255,255,0.92)", borderRadius: 14, marginBottom: 8, flexDirection: "row", overflow: "hidden", shadowColor: "#1A0040", shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  accentBar: { width: 4 },
  cardInner: { flex: 1, padding: 10 },

  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 7 },
  idWrap: { flexDirection: "row", alignItems: "center", gap: 5 },
  idTxt:  { fontSize: 13, fontWeight: "800", color: "#0A1F44" },

  statusPill: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1 },
  statusDot:  { width: 5, height: 5, borderRadius: 3 },
  statusTxt:  { fontSize: 9, fontWeight: "700", textTransform: "uppercase", color: "#0A1F44" },

  detailGrid:  { flexDirection: "row", gap: 6, marginBottom: 8 },
  detailCol:   { flex: 1 },
  detailLabel: { fontSize: 9, color: "#5A7A9F", fontWeight: "700", textTransform: "uppercase", marginBottom: 2, letterSpacing: 0.4 },
  detailVal:   { fontSize: 12, color: "#0A1F44", fontWeight: "700" },

  cardActions: { flexDirection: "row", gap: 6 },
  actionBtn:   { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, borderWidth: 1 },
  actionTxt:   { fontSize: 11, fontWeight: "700" },

  empty:       { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyTxt:    { fontSize: 16, color: "rgba(255,255,255,0.65)", fontWeight: "600" },
  emptyBtn:    { backgroundColor: "rgba(255,255,255,0.15)", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, marginTop: 4, borderWidth: 1, borderColor: "rgba(255,255,255,0.30)" },
  emptyBtnTxt: { color: "#fff", fontWeight: "700" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#F6F1E9", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 18, paddingTop: 20, paddingBottom: 24, maxHeight: "90%", shadowColor: "#1A0040", shadowOpacity: 0.20, shadowRadius: 22, shadowOffset: { width: 0, height: -6 }, elevation: 16 },
  sheetSmall: { backgroundColor: COLORS.cardBg, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, maxHeight: "70%", borderWidth: 1, borderColor: COLORS.cardBorder },
  sheetTitle: { fontSize: 16, fontWeight: "800", color: "#0A1F44", marginBottom: 12 },
  sheetSubtitle: { fontSize: 12, color: "#3A5A7A", marginBottom: 14, lineHeight: 16 },
  sheetDivider: { height: 1, backgroundColor: "rgba(21,101,192,0.12)", marginBottom: 12 },
  fieldLabel: { fontSize: 11, fontWeight: "700", color: "#1A2F5C", textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 6, marginTop: 12 },
  selector: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#F0F4FF", borderWidth: 1.5, borderColor: "#BFDBFE", borderRadius: 10, paddingHorizontal: 12, height: 44, shadowColor: "#7A4010", shadowOpacity: 0.05, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  selectorDisabled: { opacity: 0.5 },
  selectorTxt: { flex: 1, color: "#10204A", fontSize: 13, fontWeight: "500" },
  readOnly: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#F0F4FF", borderWidth: 1.5, borderColor: "#BFDBFE", borderRadius: 10, paddingHorizontal: 12, height: 44 },
  statusReadOnly: { flexDirection: "row", alignItems: "center", gap: 6, padding: 10, borderRadius: 10, marginTop: 8 },
  readOnlyTxt: { color: "#10204A", fontSize: 13, fontWeight: "500" },
  statusReadOnlyTxt: { color: "#10204A", fontWeight: "700", fontSize: 13 },
  input: { backgroundColor: "#F0F4FF", borderWidth: 1.5, borderColor: "#BFDBFE", borderRadius: 10, paddingHorizontal: 12, height: 44, color: "#10204A", fontSize: 13, fontWeight: "500" },
  statusToggle: { flexDirection: "row", alignItems: "center", gap: 6, padding: 10, borderRadius: 10, marginTop: 8, marginBottom: 6 },
  statusActive: { backgroundColor: "rgba(34,197,94,0.12)", borderWidth: 1, borderColor: "#22C55E" },
  statusInactive: { backgroundColor: "rgba(248,113,113,0.12)", borderWidth: 1, borderColor: "#F87171" },
  statusToggleTxt: { color: "#10204A", fontWeight: "700", fontSize: 13 },
  scrollContent: { maxHeight: 380 },
  sheetBtns: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 20 },
  cancelBtn: { paddingHorizontal: 18, paddingVertical: 11, borderRadius: 10, backgroundColor: "rgba(220,38,38,0.06)", borderWidth: 2, borderColor: "rgba(220,38,38,0.35)" },
  cancelTxt: { color: "#DC2626", fontWeight: "800", fontSize: 13 },
  saveBtn: { paddingHorizontal: 24, paddingVertical: 11, borderRadius: 10, overflow: "hidden", flexDirection: "row", alignItems: "center", justifyContent: "center" },
  saveBtnOuter: { borderRadius: 10, shadowColor: "#14532D", shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 5, overflow: "hidden" },
  saveBtnGloss: { position: "absolute", top: 0, left: 0, right: 0, height: 18, borderRadius: 10 },
  saveTxt: { color: "#fff", fontWeight: "800", fontSize: 13 },
  pickerItem: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11, paddingHorizontal: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.glassBorder },
  pickerItemTxt: { fontSize: 13, color: COLORS.white, fontWeight: "600" },
  pickerItemSub: { fontSize: 11, color: COLORS.whiteMuted, marginTop: 1 },
  sheetSearch:      { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: COLORS.inputBg, borderRadius: 10, borderWidth: 1, borderColor: COLORS.inputBorder, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 10 },
  sheetSearchInput: { flex: 1, fontSize: 13, color: COLORS.white },
  noResults:        { textAlign: "center", color: COLORS.whiteMuted, paddingVertical: 16, fontSize: 12 },
});

export default AssociationListScreen;

