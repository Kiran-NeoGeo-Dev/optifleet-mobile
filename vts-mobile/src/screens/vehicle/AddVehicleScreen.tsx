import { useState } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, KeyboardAvoidingView, Platform, StatusBar, Image, Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AdminStackParamList } from "../../navigation/AdminNavigator";
import { MainStackParamList } from "../../navigation/MainNavigator";
import { createVehicle } from "../../services/vehicleService";
import { Toast, useToast } from "../../components/Toast";
import ClientSelector, { ClientOption } from "../../components/ClientSelector";
import { useAuth } from "../../hooks/useAuth";

type Props =
  | NativeStackScreenProps<AdminStackParamList, "AddVehicle">
  | NativeStackScreenProps<MainStackParamList, "AddVehicle">;

type DF = "dateOfReg" | "regValidity" | "dateOfMfg" | "insDate" | "lastPuc" | "pucDue";

const C = {
  bgDark:      "#0A1F44",
  bgMid:       "#0D3B8E",
  bgBright:    "#1565C0",
  purple:      "#1565C0",
  btn1:        "#0D3B8E",
  btn2:        "#0A1F44",
  cream:       "#F6F1E9",
  label:       "#3A245C",
  muted:       "#4A6A8E",
  inputBg:     "#E8C9A0",
  inputBorder: "rgba(160,90,30,0.35)",
  inputText:   "#3B1F0A",
  placeholder: "#A0785A",
  white:       "#FFFFFF",
  red:         "#EF4444",
  green:       "#22C55E",
};

const fmt = (d: Date) =>
  `${String(d.getDate()).padStart(2,"0")} / ${String(d.getMonth()+1).padStart(2,"0")} / ${d.getFullYear()}`;

const FUELS = ["Petrol", "Diesel", "CNG", "Electric"];

// ── Reusable text field ───────────────────────────────────────────────────────
const Field = ({
  icon, label, value, onChangeText, placeholder,
  keyboardType, autoCapitalize, maxLength, error,
}: {
  icon: any; label: string; value: string;
  onChangeText: (t: string) => void; placeholder: string;
  keyboardType?: any; autoCapitalize?: any; maxLength?: number; error?: string;
}) => (
  <View style={s.fieldWrap}>
    <Text style={s.fieldLabel}>{label}</Text>
    <View style={[s.field, !!error && s.fieldErr]}>
      <View style={s.iconWrap}>
        <Ionicons name={icon} size={17} color={C.purple} />
      </View>
      <TextInput
        style={[s.input, { flex: 1 }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.placeholder}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize ?? "none"}
        maxLength={maxLength}
        autoCorrect={false}
      />
    </View>
    {!!error && <Text style={s.errTxt}><Ionicons name="alert-circle-outline" size={12} /> {error}</Text>}
  </View>
);

// ── Date picker field ─────────────────────────────────────────────────────────
const DateField = ({ icon, label, value, onPress, error }: {
  icon: any; label: string; value: string | null; onPress: () => void; error?: string;
}) => (
  <View style={s.fieldWrap}>
    <Text style={s.fieldLabel}>{label}</Text>
    <TouchableOpacity style={[s.field, !!error && s.fieldErr]} onPress={onPress} activeOpacity={0.75}>
      <View style={s.iconWrap}>
        <Ionicons name={icon} size={17} color={C.purple} />
      </View>
      <Text style={[s.input, { flex: 1, paddingVertical: 0, lineHeight: 20 }, !value && { color: C.placeholder }]}>
        {value || "Tap to pick date"}
      </Text>
      <Ionicons name="chevron-down" size={16} color={C.placeholder} style={{ marginRight: 4 }} />
    </TouchableOpacity>
    {!!error && <Text style={s.errTxt}><Ionicons name="alert-circle-outline" size={12} /> {error}</Text>}
  </View>
);

// ── Section header ────────────────────────────────────────────────────────────
const Section = ({ title }: { title: string }) => (
  <View style={s.sectionWrap}>
    <Text style={s.sectionTitle}>{title}</Text>
    <View style={s.sectionLine} />
  </View>
);

// ── Screen ────────────────────────────────────────────────────────────────────
const AddVehicleScreen = ({ navigation }: Props) => {
  const { isAdmin, clientId: authClientId } = useAuth();
  const [selectedClient, setSelectedClient] = useState<ClientOption | null>(null);
  const [regNum,       setRegNum]       = useState("");
  const [dateOfReg,    setDateOfReg]    = useState<Date | null>(null);
  const [regValidity,  setRegValidity]  = useState<Date | null>(null);
  const [chassis,      setChassis]      = useState("");
  const [engine,       setEngine]       = useState("");
  const [owner,        setOwner]        = useState("");
  const [make,         setMake]         = useState("");
  const [model,        setModel]        = useState("");
  const [dateOfMfg,    setDateOfMfg]    = useState<Date | null>(null);
  const [fuel,         setFuel]         = useState("Petrol");
  const [insNum,       setInsNum]       = useState("");
  const [insDate,      setInsDate]      = useState<Date | null>(null);
  const [lastPuc,      setLastPuc]      = useState<Date | null>(null);
  const [pucDue,       setPucDue]       = useState<Date | null>(null);
  const [photo,        setPhoto]        = useState<string | null>(null);
  const [photoSizeKB,  setPhotoSizeKB]  = useState(0);
  const [activePicker, setActivePicker] = useState<DF | null>(null);
  const [photoModal,   setPhotoModal]   = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [errors,       setErrors]       = useState<Record<string, string>>({});
  const { toast, showToast, hideToast } = useToast();

  const clrErr = (k: string) => setErrors(p => ({ ...p, [k]: "" }));
  const today  = () => { const d = new Date(); d.setHours(0,0,0,0); return d; };

  const dateMap: Record<DF, { val: Date | null; set: (d: Date) => void }> = {
    dateOfReg:   { val: dateOfReg,   set: setDateOfReg },
    regValidity: { val: regValidity, set: setRegValidity },
    dateOfMfg:   { val: dateOfMfg,   set: setDateOfMfg },
    insDate:     { val: insDate,     set: setInsDate },
    lastPuc:     { val: lastPuc,     set: setLastPuc },
    pucDue:      { val: pucDue,      set: setPucDue },
  };

  const pickPhoto = async (cam: boolean) => {
    setPhotoModal(false);
    const result = cam
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], base64: true, quality: 0.6 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], base64: true, quality: 0.6 });
    if (!result.canceled && result.assets[0].base64) {
      const sizeKB = Math.round((result.assets[0].base64.length * 3) / 4 / 1024);
      if (sizeKB > 2048) { showToast("Photo must be under 2 MB.", "warning"); return; }
      setPhoto(result.assets[0].base64);
      setPhotoSizeKB(sizeKB);
      clrErr("photo");
    }
  };

  const validate = () => {
    const e: Record<string, string> = {};
    const t = today();
    if (!regNum.trim()) e.regNum = "Registration number is required.";
    else if (!/^[A-Z0-9]{8,12}$/i.test(regNum.trim().replace(/\s/g,""))) e.regNum = "Must be 8–12 alphanumeric characters.";
    if (!dateOfReg) e.dateOfReg = "Date of registration is required.";
    else if (dateOfReg > t) e.dateOfReg = "Cannot be a future date.";
    if (!regValidity) e.regValidity = "Registration validity is required.";
    else if (regValidity <= t) e.regValidity = "Must be a future date.";
    if (!chassis.trim()) e.chassis = "Chassis number is required.";
    else if (chassis.trim().length !== 17) e.chassis = "Must be exactly 17 characters.";
    else if (/[IOQ]/i.test(chassis.trim())) e.chassis = "Cannot contain I, O, or Q.";
    if (!engine.trim()) e.engine = "Engine number is required.";
    else if (!/^[A-Z0-9]{8,20}$/i.test(engine.trim())) e.engine = "Must be 8–20 alphanumeric characters.";
    if (!owner.trim()) e.owner = "Owner name is required.";
    else if (!/^[a-zA-Z\s]+$/.test(owner.trim())) e.owner = "Only letters and spaces allowed.";
    if (!make.trim()) e.make = "Vehicle make is required.";
    if (!model.trim()) e.model = "Vehicle model is required.";
    if (!dateOfMfg) e.dateOfMfg = "Date of manufacturing is required.";
    else if (dateOfMfg > t) e.dateOfMfg = "Cannot be a future date.";
    if (!insNum.trim()) e.insNum = "Insurance number is required.";
    else if (!/^[A-Z0-9]{8,25}$/i.test(insNum.trim())) e.insNum = "Must be 8–25 alphanumeric characters.";
    if (!insDate) e.insDate = "Insurance date is required.";
    if (!lastPuc) e.lastPuc = "Last PUC date is required.";
    if (!pucDue) e.pucDue = "PUC due date is required.";
    else if (lastPuc && pucDue <= lastPuc) e.pucDue = "Must be after Last PUC Date.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onSubmit = async () => {
    if (isAdmin && !selectedClient) { showToast("Please select a client first.", "warning"); return; }
    if (!validate()) { showToast("Please fix the errors shown below.", "warning"); return; }
    setLoading(true);
    try {
      await createVehicle({
        licensePlate:         regNum.trim().toUpperCase(),
        manufactureDate:      dateOfReg!.toISOString().split("T")[0],
        registrationValidity: regValidity!.toISOString().split("T")[0],
        chassisNumber:        chassis.trim().toUpperCase(),
        engineNumber:         engine.trim().toUpperCase(),
        ownerName:            owner.trim(),
        vehicleMake:          make.trim(),
        vehicleModel:         model.trim(),
        dateOfManufacturing:  dateOfMfg!.toISOString().split("T")[0],
        fuelType:             fuel,
        insuranceNumber:      insNum.trim().toUpperCase(),
        vehicleInsuranceDate: insDate!.toISOString().split("T")[0],
        lastPucDate:          lastPuc!.toISOString().split("T")[0],
        pucDueOn:             pucDue!.toISOString().split("T")[0],
        vehiclePhoto:         photo,
        clientId:             isAdmin ? selectedClient?.id : (authClientId ?? undefined),
      });
      showToast("Vehicle added successfully.", "success");
      setTimeout(() => navigation.goBack(), 1500);
    } catch (e: any) {
      const serverMsg = e?.response?.data?.message || e?.response?.data?.error;
      showToast(serverMsg || "Failed to add vehicle. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.bgDark} />
      <LinearGradient
        colors={["#0A1F44", "#0D3B8E", "#1565C0"]}
        locations={[0, 0.5, 1]}
        start={{ x: 0.15, y: 0 }} end={{ x: 0.85, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {[0.18, 0.36, 0.54, 0.72].map((t, i) => (
        <View key={`h${i}`} style={[s.gridH, { top: `${t * 100}%` as any }]} />
      ))}

      <SafeAreaView style={s.safe}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>

          {/* Header */}
          <View style={s.header}>
            <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
              <Ionicons name="chevron-back" size={22} color={C.white} />
            </TouchableOpacity>
            <View style={s.headerCenter}>
              <Text style={s.headerTitle}>Add Vehicle</Text>
              <Text style={s.headerSub}>Fill in all details below</Text>
            </View>
            <View style={{ width: 42 }} />
          </View>

          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={s.card}>
              <LinearGradient
                colors={[C.bgMid, "transparent"]}
                start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
                style={s.cardEdge}
              />

              {/* ── VEHICLE INFORMATION ── */}
              <Section title="Vehicle Information" />

              {isAdmin && (
                <View style={s.fieldWrap}>
                  <ClientSelector selectedClientId={selectedClient?.id ?? null} onSelect={setSelectedClient} />
                </View>
              )}

              <Field icon="shield-outline"    label="Vehicle Registration Number"
                value={regNum}  onChangeText={t => { setRegNum(t); clrErr("regNum"); }}
                placeholder="e.g. AP39AB1234" autoCapitalize="characters" error={errors.regNum} />

              <Field icon="person-outline"    label="Owner Name"
                value={owner}   onChangeText={t => { setOwner(t); clrErr("owner"); }}
                placeholder="e.g. Ravi Kumar" autoCapitalize="words" error={errors.owner} />

              <Field icon="car-sport-outline" label="Vehicle Make"
                value={make}    onChangeText={t => { setMake(t); clrErr("make"); }}
                placeholder="e.g. Toyota, Tata, Maruti" autoCapitalize="words" error={errors.make} />

              <Field icon="car-outline"       label="Vehicle Model"
                value={model}   onChangeText={t => { setModel(t); clrErr("model"); }}
                placeholder="e.g. Camry, Nexon, Swift" autoCapitalize="words" error={errors.model} />

              {/* Fuel Type */}
              <View style={s.fieldWrap}>
                <Text style={s.fieldLabel}>Fuel Type</Text>
                <View style={s.fuelRow}>
                  {FUELS.map(f => (
                    <TouchableOpacity
                      key={f}
                      style={[s.fuelBtn, fuel === f && s.fuelBtnActive]}
                      onPress={() => setFuel(f)}
                      activeOpacity={0.8}
                    >
                      <Text style={[s.fuelTxt, fuel === f && s.fuelTxtActive]}>{f}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* ── REGISTRATION DETAILS ── */}
              <Section title="Registration Details" />

              <DateField icon="calendar-outline" label="Date of Registration"
                value={dateOfReg ? fmt(dateOfReg) : null}
                onPress={() => setActivePicker("dateOfReg")} error={errors.dateOfReg} />

              <DateField icon="calendar-outline" label="Registration Validity"
                value={regValidity ? fmt(regValidity) : null}
                onPress={() => setActivePicker("regValidity")} error={errors.regValidity} />

              <DateField icon="calendar-outline" label="Date of Manufacturing"
                value={dateOfMfg ? fmt(dateOfMfg) : null}
                onPress={() => setActivePicker("dateOfMfg")} error={errors.dateOfMfg} />

              {/* ── TECHNICAL DETAILS ── */}
              <Section title="Technical Details" />

              <Field icon="barcode-outline"   label="Chassis Number (VIN) — 17 characters"
                value={chassis} onChangeText={t => { setChassis(t); clrErr("chassis"); }}
                placeholder="17-character VIN (no I, O, Q)" autoCapitalize="characters" maxLength={17} error={errors.chassis} />

              <Field icon="cog-outline"       label="Engine Number"
                value={engine}  onChangeText={t => { setEngine(t); clrErr("engine"); }}
                placeholder="e.g. ENG45879632" autoCapitalize="characters" error={errors.engine} />

              {/* ── INSURANCE & PUC ── */}
              <Section title="Insurance & PUC" />

              <Field icon="document-text-outline" label="Insurance Number"
                value={insNum}  onChangeText={t => { setInsNum(t); clrErr("insNum"); }}
                placeholder="e.g. INS20240012345" autoCapitalize="characters" error={errors.insNum} />

              <DateField icon="calendar-outline" label="Insurance Date"
                value={insDate ? fmt(insDate) : null}
                onPress={() => setActivePicker("insDate")} error={errors.insDate} />

              <DateField icon="calendar-outline" label="Last PUC Date"
                value={lastPuc ? fmt(lastPuc) : null}
                onPress={() => setActivePicker("lastPuc")} error={errors.lastPuc} />

              <DateField icon="calendar-outline" label="PUC Due On"
                value={pucDue ? fmt(pucDue) : null}
                onPress={() => setActivePicker("pucDue")} error={errors.pucDue} />

              {/* ── VEHICLE PHOTO ── */}
              <Section title="Vehicle Photo" />

              <View style={s.fieldWrap}>
                <TouchableOpacity
                  style={[s.photoBox, !!errors.photo && s.photoBoxErr]}
                  onPress={() => setPhotoModal(true)}
                  activeOpacity={0.8}
                >
                  {photo
                    ? <Image source={{ uri: `data:image/jpeg;base64,${photo}` }} style={s.photoImg} />
                    : <View style={s.photoEmpty}>
                        <Ionicons name="cloud-upload-outline" size={32} color={C.placeholder} />
                        <Text style={s.photoHint}>Tap to upload vehicle photo</Text>
                        <Text style={s.photoSub}>JPG / PNG — max 2 MB</Text>
                      </View>
                  }
                </TouchableOpacity>
                {!!errors.photo && <Text style={s.errTxt}><Ionicons name="alert-circle-outline" size={12} /> {errors.photo}</Text>}
              </View>

              {/* Submit button */}
              <View style={s.btnShadow}>
                <TouchableOpacity style={s.btnOuter} onPress={onSubmit} disabled={loading} activeOpacity={0.84}>
                  <LinearGradient colors={["#16A34A", "#14532D"]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={s.btnGrad}>
                    <LinearGradient colors={["rgba(255,255,255,0.14)", "rgba(255,255,255,0.00)"]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={s.btnGloss} />
                    <Ionicons name="shield-checkmark-outline" size={18} color={C.white} style={{ marginRight: 8 }} />
                    <Text style={s.btnTxt}>{loading ? "Saving…" : "Submit Vehicle Details"}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Date picker */}
      {activePicker && (
        <DateTimePicker
          value={dateMap[activePicker].val ?? new Date()}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(_, d) => {
            if (d) { dateMap[activePicker].set(d); clrErr(activePicker); }
            setActivePicker(null);
          }}
        />
      )}

      {/* Photo source modal */}
      <Modal visible={photoModal} transparent animationType="fade" onRequestClose={() => setPhotoModal(false)}>
        <View style={s.modalBg}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>Select Photo Source</Text>
            <TouchableOpacity style={s.modalBtn} onPress={() => pickPhoto(true)}>
              <Ionicons name="camera" size={20} color={C.purple} />
              <Text style={s.modalBtnTxt}>Take Photo</Text>
            </TouchableOpacity>
            <View style={s.modalDivider} />
            <TouchableOpacity style={s.modalBtn} onPress={() => pickPhoto(false)}>
              <Ionicons name="image" size={20} color={C.purple} />
              <Text style={s.modalBtnTxt}>Choose from Gallery</Text>
            </TouchableOpacity>
            <View style={s.modalDivider} />
            <TouchableOpacity style={s.modalBtn} onPress={() => setPhotoModal(false)}>
              <Text style={[s.modalBtnTxt, { color: C.red }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={hideToast} />
    </View>
  );
};

const s = StyleSheet.create({
  root:  { flex: 1 },
  safe:  { flex: 1 },
  gridH: { position: "absolute", left: 0, right: 0, height: 1, backgroundColor: "rgba(255,255,255,0.025)" },

  header:       { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 10, paddingBottom: 14 },
  backBtn:      { width: 42, height: 42, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.12)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle:  { fontSize: 22, fontWeight: "800", color: C.white, letterSpacing: -0.3 },
  headerSub:    { fontSize: 12, color: "rgba(255,255,255,0.55)", marginTop: 2 },

  scroll: { paddingHorizontal: 16, paddingBottom: 48 },

  card: {
    backgroundColor: C.cream, borderRadius: 28,
    paddingHorizontal: 20, paddingTop: 28, paddingBottom: 24,
    overflow: "hidden",
    shadowColor: "#1A0040", shadowOpacity: 0.18, shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 }, elevation: 14,
  },
  cardEdge: { position: "absolute", top: 0, left: 0, right: 0, height: 5, borderTopLeftRadius: 28, borderTopRightRadius: 28 },

  sectionWrap:  { marginTop: 8, marginBottom: 14 },
  sectionTitle: { fontSize: 13, fontWeight: "800", color: C.purple, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8 },
  sectionLine:  { height: 1, backgroundColor: "rgba(21,101,192,0.12)" },

  fieldWrap:  { marginBottom: 16 },
  fieldLabel: { fontSize: 13, fontWeight: "700", color: C.label, marginBottom: 8 },
  field: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: C.inputBg, borderRadius: 14,
    paddingRight: 12, minHeight: 52,
    borderWidth: 1, borderColor: C.inputBorder,
    shadowColor: "#A06020", shadowOpacity: 0.08, shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  fieldErr:   { borderColor: C.red },
  iconWrap:   { width: 44, minHeight: 52, alignItems: "center", justifyContent: "center" },
  input:      { fontSize: 14, color: C.inputText, paddingVertical: 14 },
  errTxt:     { fontSize: 12, color: C.red, marginTop: 5, marginLeft: 2 },

  fuelRow:       { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  fuelBtn:       { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 12, backgroundColor: "rgba(21,101,192,0.06)", borderWidth: 1, borderColor: "rgba(21,101,192,0.14)" },
  fuelBtnActive: { backgroundColor: C.purple, borderColor: C.purple },
  fuelTxt:       { fontSize: 13, fontWeight: "600", color: C.muted },
  fuelTxtActive: { color: C.white, fontWeight: "800" },

  photoBox:    { borderRadius: 14, borderWidth: 1.5, borderColor: C.inputBorder, overflow: "hidden", backgroundColor: C.inputBg },
  photoBoxErr: { borderColor: C.red },
  photoImg:    { width: "100%", height: 180 },
  photoEmpty:  { height: 130, alignItems: "center", justifyContent: "center", gap: 6 },
  photoHint:   { fontSize: 14, color: C.label, fontWeight: "600" },
  photoSub:    { fontSize: 12, color: C.placeholder },

  btnShadow: { borderRadius: 16, marginTop: 8, shadowColor: "#14532D", shadowOpacity: 0.30, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  btnOuter:  { borderRadius: 16, overflow: "hidden" },
  btnGrad:   { height: 56, flexDirection: "row", alignItems: "center", justifyContent: "center", borderRadius: 16, overflow: "hidden" },
  btnGloss:  { position: "absolute", top: 0, left: 0, right: 0, height: 26, borderRadius: 16 },
  btnTxt:    { fontSize: 16, fontWeight: "800", color: C.white, letterSpacing: 0.3 },

  modalBg:      { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", alignItems: "center" },
  modalBox:     { backgroundColor: C.cream, borderRadius: 20, paddingVertical: 8, width: "78%", shadowColor: "#1A0040", shadowOpacity: 0.20, shadowRadius: 20, elevation: 12, shadowOffset: { width: 0, height: 8 } },
  modalTitle:   { fontSize: 16, fontWeight: "800", color: C.label, textAlign: "center", paddingVertical: 16, paddingHorizontal: 20 },
  modalDivider: { height: StyleSheet.hairlineWidth, backgroundColor: "rgba(160,90,30,0.12)", marginHorizontal: 16 },
  modalBtn:     { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 16 },
  modalBtnTxt:  { fontSize: 15, color: C.label, fontWeight: "700" },

  muted: { color: C.muted },
});

export default AddVehicleScreen;
