import { useState } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, KeyboardAvoidingView, Platform, StatusBar, Image, Modal, ActivityIndicator,
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
import { pickAndParseFile } from "../../utils/importParser";
import ImportResultModal, { ImportResult } from "../../components/ImportResultModal";

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
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importing, setImporting]       = useState(false);

  // Parses date strings from Excel/CSV: "10-Jan-2020", "2020-01-10", serial numbers, etc.
  const parseImportDate = (s: string): string => {
    if (!s || !s.trim()) return "";
    const trimmed = s.trim();
    // xlsx with raw:false returns serial numbers as formatted strings like "10-Jan-2020" or "2020-01-10"
    // Try direct JS parse first (handles ISO and most locale formats)
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
    // Try DD-Mon-YYYY e.g. "10-Jan-2020"
    const monthMap: Record<string, string> = {
      jan:"01",feb:"02",mar:"03",apr:"04",may:"05",jun:"06",
      jul:"07",aug:"08",sep:"09",oct:"10",nov:"11",dec:"12",
    };
    const m1 = trimmed.match(/^(\d{1,2})[\-\/](\w{3})[\-\/](\d{4})$/);
    if (m1) {
      const mo = monthMap[m1[2].toLowerCase()];
      if (mo) return `${m1[3]}-${mo}-${m1[1].padStart(2,"0")}`;
    }
    // Try DD/MM/YYYY or DD-MM-YYYY
    const m2 = trimmed.match(/^(\d{1,2})[\-\/](\d{1,2})[\-\/](\d{4})$/);
    if (m2) return `${m2[3]}-${m2[2].padStart(2,"0")}-${m2[1].padStart(2,"0")}`;
    return "";
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
        try {
          await createVehicle({
            licensePlate:         (r["VehicleRegistrationNumber"] || "").trim().toUpperCase(),
            ownerName:            (r["OwnerName"]            || "").trim(),
            vehicleMake:          (r["VehicleMake"]          || "").trim(),
            vehicleModel:         (r["VehicleModel"]         || "").trim(),
            fuelType:             (r["FuelType"]             || "").trim(),
            manufactureDate:      parseImportDate(r["DateOfRegistration"] || ""),
            registrationValidity: parseImportDate(r["RegistrationValidity"] || ""),
            dateOfManufacturing:  parseImportDate(r["DateOfManufacturing"] || ""),
            chassisNumber:        (r["ChassisNumberVIN"] || "").trim().toUpperCase(),
            engineNumber:         (r["EngineNumber"] || "").trim().toUpperCase(),
            insuranceNumber:      (r["InsuranceNumber"] || "").trim().toUpperCase(),
            vehicleInsuranceDate: parseImportDate(r["InsuranceDate"] || ""),
            lastPucDate:          parseImportDate(r["LastPUCDate"] || ""),
            pucDueOn:             parseImportDate(r["PUCDueOn"] || ""),
            clientId:             isAdmin ? selectedClient?.id : (authClientId ?? undefined),
          });
          success++;
        } catch (e: any) {
          const msg = e?.response?.data?.errors
            ? Object.values(e.response.data.errors).join(", ")
            : e?.response?.data?.message || e?.message || "Unknown error";
          failures.push({ row: i + 2, reason: msg });
        }
      }

      setImportResult({ total: rows.length, success, failures });
    } catch (e: any) {
      showToast(e?.message || "Failed to read file.", "error");
    } finally {
      setImporting(false);
    }
  };

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
    if (!regNum.trim())
      e.regNum = "This field is required.";
    else if (!/^[A-Z0-9]{8,12}$/i.test(regNum.trim().replace(/\s/g,"")))
      e.regNum = "Please enter a valid registration number (8–12 alphanumeric characters).";
    if (!dateOfReg)
      e.dateOfReg = "This field is required.";
    else if (dateOfReg > t)
      e.dateOfReg = "Date of registration cannot be a future date.";
    if (!regValidity)
      e.regValidity = "This field is required.";
    else if (regValidity <= t)
      e.regValidity = "Registration validity must be a future date.";
    if (!chassis.trim())
      e.chassis = "This field is required.";
    else if (chassis.trim().length !== 17)
      e.chassis = "Chassis number (VIN) must be exactly 17 characters.";
    else if (/[IOQ]/i.test(chassis.trim()))
      e.chassis = "Chassis number cannot contain the letters I, O, or Q.";
    if (!engine.trim())
      e.engine = "This field is required.";
    else if (!/^[A-Z0-9]{8,20}$/i.test(engine.trim()))
      e.engine = "Please enter a valid engine number (8–20 alphanumeric characters).";
    if (!owner.trim())
      e.owner = "This field is required.";
    else if (!/^[a-zA-Z\s]+$/.test(owner.trim()))
      e.owner = "Owner name must contain only letters and spaces.";
    if (!make.trim())
      e.make = "This field is required.";
    if (!model.trim())
      e.model = "This field is required.";
    if (!dateOfMfg)
      e.dateOfMfg = "This field is required.";
    else if (dateOfMfg > t)
      e.dateOfMfg = "Date of manufacturing cannot be a future date.";
    if (!insNum.trim())
      e.insNum = "This field is required.";
    else if (!/^[A-Z0-9]{8,25}$/i.test(insNum.trim()))
      e.insNum = "Please enter a valid insurance number (8–25 alphanumeric characters).";
    if (!insDate)
      e.insDate = "This field is required.";
    if (!lastPuc)
      e.lastPuc = "This field is required.";
    if (!pucDue)
      e.pucDue = "This field is required.";
    else if (lastPuc && pucDue <= lastPuc)
      e.pucDue = "PUC due date must be after the last PUC date.";
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
              <View style={s.sectionHeaderRow}>
                <View style={s.sectionWrap}>
                  <Text style={s.sectionTitle}>Vehicle Information</Text>
                  <View style={s.sectionLine} />
                </View>
                <TouchableOpacity style={s.importBtn} onPress={handleImport} disabled={importing}>
                  {importing
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Ionicons name="cloud-upload-outline" size={13} color="#fff" />
                  }
                  <Text style={s.importBtnTxt}>{importing ? "Importing…" : "Import Excel / CSV"}</Text>
                </TouchableOpacity>
              </View>

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

      <ImportResultModal
        visible={!!importResult}
        result={importResult}
        onClose={() => setImportResult(null)}
      />
      <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={hideToast} />
    </View>
  );
};

const s = StyleSheet.create({
  root:  { flex: 1 },
  safe:  { flex: 1 },
  gridH: { position: "absolute", left: 0, right: 0, height: 1, backgroundColor: "rgba(255,255,255,0.025)" },

  header:       { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 },
  backBtn:      { width: 36, height: 36, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.12)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle:  { fontSize: 18, fontWeight: "800", color: C.white, letterSpacing: -0.3 },
  headerSub:    { fontSize: 11, color: "rgba(255,255,255,0.55)", marginTop: 1 },

  scroll: { paddingHorizontal: 14, paddingBottom: 70 },

  card: {
    backgroundColor: C.cream, borderRadius: 20,
    paddingHorizontal: 16, paddingTop: 18, paddingBottom: 16,
    overflow: "hidden",
    shadowColor: "#1A0040", shadowOpacity: 0.15, shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 }, elevation: 10,
  },
  cardEdge: { position: "absolute", top: 0, left: 0, right: 0, height: 4, borderTopLeftRadius: 20, borderTopRightRadius: 20 },

  sectionHeaderRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 4, marginBottom: 2 },
  importBtn:     { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#0D3B8E", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, marginTop: 2, alignSelf: "flex-start" },
  importBtnTxt:  { color: "#fff", fontSize: 10, fontWeight: "700" },

  sectionWrap:  { flex: 1, marginTop: 4, marginBottom: 10 },
  sectionTitle: { fontSize: 11, fontWeight: "800", color: C.purple, letterSpacing: 1.0, textTransform: "uppercase", marginBottom: 6 },
  sectionLine:  { height: 1, backgroundColor: "rgba(21,101,192,0.12)" },

  fieldWrap:  { marginBottom: 12 },
  fieldLabel: { fontSize: 12, fontWeight: "700", color: C.label, marginBottom: 6 },
  field: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: C.inputBg, borderRadius: 10,
    paddingRight: 10, minHeight: 44,
    borderWidth: 1, borderColor: C.inputBorder,
    shadowColor: "#A06020", shadowOpacity: 0.06, shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  fieldErr:   { borderColor: C.red },
  iconWrap:   { width: 38, minHeight: 44, alignItems: "center", justifyContent: "center" },
  input:      { fontSize: 13, color: C.inputText, paddingVertical: 11 },
  errTxt:     { fontSize: 11, color: C.red, marginTop: 3, marginLeft: 2 },

  fuelRow:       { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  fuelBtn:       { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 10, backgroundColor: "rgba(21,101,192,0.06)", borderWidth: 1, borderColor: "rgba(21,101,192,0.14)" },
  fuelBtnActive: { backgroundColor: C.purple, borderColor: C.purple },
  fuelTxt:       { fontSize: 12, fontWeight: "600", color: C.muted },
  fuelTxtActive: { color: C.white, fontWeight: "800" },

  photoBox:    { borderRadius: 10, borderWidth: 1.5, borderColor: C.inputBorder, overflow: "hidden", backgroundColor: C.inputBg },
  photoBoxErr: { borderColor: C.red },
  photoImg:    { width: "100%", height: 150 },
  photoEmpty:  { height: 100, alignItems: "center", justifyContent: "center", gap: 5 },
  photoHint:   { fontSize: 13, color: C.label, fontWeight: "600" },
  photoSub:    { fontSize: 11, color: C.placeholder },

  btnShadow: { borderRadius: 12, marginTop: 6, shadowColor: "#14532D", shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  btnOuter:  { borderRadius: 12, overflow: "hidden" },
  btnGrad:   { height: 46, flexDirection: "row", alignItems: "center", justifyContent: "center", borderRadius: 12, overflow: "hidden" },
  btnGloss:  { position: "absolute", top: 0, left: 0, right: 0, height: 20, borderRadius: 12 },
  btnTxt:    { fontSize: 14, fontWeight: "800", color: C.white, letterSpacing: 0.3 },

  modalBg:      { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", alignItems: "center" },
  modalBox:     { backgroundColor: C.cream, borderRadius: 16, paddingVertical: 6, width: "72%", shadowColor: "#1A0040", shadowOpacity: 0.18, shadowRadius: 16, elevation: 10, shadowOffset: { width: 0, height: 6 } },
  modalTitle:   { fontSize: 14, fontWeight: "800", color: C.label, textAlign: "center", paddingVertical: 12, paddingHorizontal: 16 },
  modalDivider: { height: StyleSheet.hairlineWidth, backgroundColor: "rgba(160,90,30,0.12)", marginHorizontal: 12 },
  modalBtn:     { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12 },
  modalBtnTxt:  { fontSize: 14, color: C.label, fontWeight: "700" },

  muted: { color: C.muted },
});

export default AddVehicleScreen;
