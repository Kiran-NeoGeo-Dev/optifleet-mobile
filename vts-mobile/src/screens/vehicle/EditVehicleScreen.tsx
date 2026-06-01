import { useEffect, useState } from "react";
import { View, Text, Image, TouchableOpacity, Modal, StyleSheet, Platform } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { MainStackParamList } from "../../navigation/MainNavigator";
import { fetchVehicle, updateVehicle } from "../../services/vehicleService";
import { FormScreen, GlassCard, GlassField, GlassDateField, FuelSelector, GlassButton, FieldLabel } from "../../components/GlassUI";
import { COLORS, SHADOWS } from "../../components/ScreenBg";
import { Toast, useToast } from "../../components/Toast";
import ClientSelector, { ClientOption } from "../../components/ClientSelector";
import { useAuth } from "../../hooks/useAuth";

type Props = NativeStackScreenProps<MainStackParamList, "EditVehicle">;
type DF = "dateOfReg" | "regValidity" | "dateOfMfg" | "insDate" | "lastPuc" | "pucDue";

const EditVehicleScreen = ({ route, navigation }: Props) => {
  const { vehicleId } = route.params;
  const { isAdmin } = useAuth();
  const [selectedClient, setSelectedClient] = useState<ClientOption | null>(null);
  const [regNum, setRegNum]           = useState("");
  const [dateOfReg, setDateOfReg]     = useState<Date | null>(null);
  const [regValidity, setRegValidity] = useState<Date | null>(null);
  const [chassis, setChassis]         = useState("");
  const [engine, setEngine]           = useState("");
  const [owner, setOwner]             = useState("");
  const [make, setMake]               = useState("");
  const [model, setModel]             = useState("");
  const [dateOfMfg, setDateOfMfg]     = useState<Date | null>(null);
  const [fuel, setFuel]               = useState("Petrol");
  const [insNum, setInsNum]           = useState("");
  const [insDate, setInsDate]         = useState<Date | null>(null);
  const [lastPuc, setLastPuc]         = useState<Date | null>(null);
  const [pucDue, setPucDue]           = useState<Date | null>(null);
  const [photo, setPhoto]             = useState<string | null>(null);
  const [activePicker, setActivePicker] = useState<DF | null>(null);
  const [photoModal, setPhotoModal]   = useState(false);
  const [loading, setLoading]         = useState(false);
  const { toast, showToast, hideToast } = useToast();

  const fmt = (d: Date) =>
    `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
  const pd = (s?: string) => s ? new Date(s) : null;

  const dateMap: Record<DF, { val: Date | null; set: (d: Date) => void }> = {
    dateOfReg:   { val: dateOfReg,   set: setDateOfReg },
    regValidity: { val: regValidity, set: setRegValidity },
    dateOfMfg:   { val: dateOfMfg,   set: setDateOfMfg },
    insDate:     { val: insDate,     set: setInsDate },
    lastPuc:     { val: lastPuc,     set: setLastPuc },
    pucDue:      { val: pucDue,      set: setPucDue },
  };

  useEffect(() => {
    fetchVehicle(vehicleId).then(v => {
      setRegNum(v.licensePlate);
      setDateOfReg(pd(v.dateOfRegistration));   // Issue 2 fix: was v.manufactureDate (wrong field)
      setRegValidity(pd(v.registrationValidity));
      setChassis(v.chassisNumber || "");
      setEngine(v.engineNumber || "");
      setOwner(v.ownerName || "");
      setMake(v.vehicleMake || "");
      setModel(v.vehicleModel || "");
      setDateOfMfg(pd(v.dateOfManufacturing));
      setFuel(v.fuelType || "Petrol");
      setInsNum(v.insuranceNumber || "");
      setInsDate(pd(v.insuranceDate));
      setLastPuc(pd(v.lastPucDate));
      setPucDue(pd(v.pucDueOn));
      setPhoto(v.vehiclePhoto || null);
      // Issue 1 fix: pre-populate client selector from vehicle's current clientId
      if (v.clientId) {
        setSelectedClient({ id: v.clientId, full_name: "", username: "" });
      }
    });
  }, [vehicleId]);

  const pickPhoto = async (cam: boolean) => {
    setPhotoModal(false);
    const result = cam
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], base64: true, quality: 0.4 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], base64: true, quality: 0.4 });
    if (!result.canceled && result.assets[0].base64) setPhoto(result.assets[0].base64);
  };

  const onSubmit = async () => {
    if (!regNum.trim()) { showToast("Vehicle Registration Number is required.", "warning"); return; }
    setLoading(true);
    try {
      await updateVehicle(vehicleId, {
        licensePlate: regNum,
        manufactureDate: dateOfReg ? dateOfReg.toISOString().split("T")[0] : "",
        registrationValidity: regValidity?.toISOString().split("T")[0],
        chassisNumber: chassis, engineNumber: engine, ownerName: owner,
        vehicleMake: make, vehicleModel: model,
        dateOfManufacturing: dateOfMfg?.toISOString().split("T")[0],
        fuelType: fuel, insuranceNumber: insNum,
        vehicleInsuranceDate: insDate?.toISOString().split("T")[0],
        lastPucDate: lastPuc?.toISOString().split("T")[0],
        pucDueOn: pucDue?.toISOString().split("T")[0],
        vehiclePhoto: photo,
        clientId: selectedClient?.id,   // Issue 1 fix: send clientId for reassignment
      });
      showToast("Vehicle updated successfully.", "success");
      setTimeout(() => navigation.goBack(), 1500);
    } catch { showToast("Failed to update vehicle. Please try again.", "error"); }
    finally { setLoading(false); }
  };

  return (
    <FormScreen title="Edit Vehicle" subtitle="Update fleet asset details" onBack={() => navigation.goBack()} toast={<Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={hideToast} />}>
      <GlassCard>
        {isAdmin && (
          <ClientSelector
            selectedClientId={selectedClient?.id ?? null}
            onSelect={setSelectedClient}
          />
        )}
        <GlassField icon="shield-outline"   label="Vehicle Registration Number *" value={regNum}   onChangeText={setRegNum}   placeholder="e.g. AP09AB1234" autoCapitalize="characters" />
        <GlassDateField icon="calendar-outline" label="Date of Registration"   value={dateOfReg   ? fmt(dateOfReg)   : null} onPress={() => setActivePicker("dateOfReg")} />
        <GlassDateField icon="calendar-outline" label="Registration Validity"  value={regValidity ? fmt(regValidity) : null} onPress={() => setActivePicker("regValidity")} />
        <GlassField icon="barcode-outline"  label="Chassis Number"   value={chassis} onChangeText={setChassis} placeholder="Chassis number"    autoCapitalize="characters" />
        <GlassField icon="cog-outline"      label="Engine Number"    value={engine}  onChangeText={setEngine}  placeholder="Engine number"     autoCapitalize="characters" />
        <GlassField icon="person-outline"   label="Owner Name"       value={owner}   onChangeText={setOwner}   placeholder="Owner full name"   autoCapitalize="words" />
        <GlassField icon="car-sport-outline" label="Vehicle Make"    value={make}    onChangeText={setMake}    placeholder="e.g. Toyota, Tata" autoCapitalize="words" />
        <GlassField icon="car-outline"      label="Vehicle Model"    value={model}   onChangeText={setModel}   placeholder="e.g. Camry, Nexon" autoCapitalize="words" />
        <GlassDateField icon="calendar-outline" label="Date of Manufacturing" value={dateOfMfg ? fmt(dateOfMfg) : null} onPress={() => setActivePicker("dateOfMfg")} />

        <View style={styles.fieldWrap}>
          <FieldLabel icon="flame-outline" label="Fuel Type" />
          <FuelSelector value={fuel} onChange={setFuel} />
        </View>

        <GlassField icon="document-text-outline" label="Vehicle Insurance Number" value={insNum} onChangeText={setInsNum} placeholder="Insurance number" autoCapitalize="characters" />
        <GlassDateField icon="calendar-outline" label="Vehicle Insurance Date" value={insDate ? fmt(insDate) : null} onPress={() => setActivePicker("insDate")} />
        <GlassDateField icon="calendar-outline" label="Last PUC Date"          value={lastPuc ? fmt(lastPuc) : null} onPress={() => setActivePicker("lastPuc")} />
        <GlassDateField icon="calendar-outline" label="PUC Due On"             value={pucDue  ? fmt(pucDue)  : null} onPress={() => setActivePicker("pucDue")} />

        <View style={styles.fieldWrap}>
          <FieldLabel icon="camera-outline" label="Vehicle Photo" />
          <TouchableOpacity style={styles.photoBox} onPress={() => setPhotoModal(true)} activeOpacity={0.8}>
            {photo
              ? <Image source={{ uri: `data:image/jpeg;base64,${photo}` }} style={styles.photoImg} />
              : <View style={styles.photoEmpty}>
                  <Ionicons name="cloud-upload-outline" size={30} color={COLORS.whiteMuted} />
                  <Text style={styles.photoHint}>Tap to upload</Text>
                </View>
            }
          </TouchableOpacity>
        </View>

        <GlassButton label="Update Vehicle Details" onPress={onSubmit} loading={loading} icon="checkmark-circle" color="#16A34A" />
      </GlassCard>

      {activePicker && (
        <DateTimePicker
          value={dateMap[activePicker].val ?? new Date()}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(_, d) => { if (d) dateMap[activePicker].set(d); setActivePicker(null); }}
        />
      )}

      <Modal visible={photoModal} transparent animationType="fade" onRequestClose={() => setPhotoModal(false)}>
        <View style={styles.modalBg}>
          <View style={[styles.modalBox, SHADOWS.card]}>
            <Text style={styles.modalTitle}>Select Photo Source</Text>
            <TouchableOpacity style={styles.modalBtn} onPress={() => pickPhoto(true)}>
              <Ionicons name="camera" size={20} color={COLORS.accent} />
              <Text style={styles.modalBtnTxt}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalBtn} onPress={() => pickPhoto(false)}>
              <Ionicons name="image" size={20} color={COLORS.accent} />
              <Text style={styles.modalBtnTxt}>Choose from Gallery</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalBtn} onPress={() => setPhotoModal(false)}>
              <Text style={{ color: COLORS.red, fontSize: 15, fontWeight: "700" }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </FormScreen>
  );
};

const styles = StyleSheet.create({
  fieldWrap:  { marginBottom: 16 },
  photoBox:   { borderRadius: 14, borderWidth: 1, borderColor: COLORS.inputBorder, overflow: "hidden", backgroundColor: COLORS.inputBg },
  photoImg:   { width: "100%", height: 180 },
  photoEmpty: { height: 120, alignItems: "center", justifyContent: "center", gap: 8 },
  photoHint:  { fontSize: 13, color: COLORS.whiteMuted },
  modalBg:    { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center" },
  modalBox:   { backgroundColor: COLORS.cardBg, borderRadius: 20, padding: 24, width: "80%", alignItems: "center", borderWidth: 1, borderColor: COLORS.cardBorder },
  modalTitle: { fontSize: 17, fontWeight: "800", color: COLORS.white, marginBottom: 20 },
  modalBtn:   { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, width: "100%", justifyContent: "center" },
  modalBtnTxt:{ fontSize: 15, color: COLORS.white, fontWeight: "600" },
});

export default EditVehicleScreen;
