import { useState } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, KeyboardAvoidingView, Platform, StatusBar, Dimensions, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import DateTimePicker from "@react-native-community/datetimepicker";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AdminStackParamList } from "../../navigation/AdminNavigator";
import { MainStackParamList } from "../../navigation/MainNavigator";
import { Toast, useToast } from "../../components/Toast";
import ClientSelector, { ClientOption } from "../../components/ClientSelector";
import { useAuth } from "../../hooks/useAuth";
import { createDriver } from "../../services/driverService";
import { pickAndParseFile } from "../../utils/importParser";
import ImportResultModal, { ImportResult } from "../../components/ImportResultModal";

type Props = {
  navigation:
    NativeStackScreenProps<AdminStackParamList, "AddDriver">["navigation"] &
    NativeStackScreenProps<MainStackParamList, "AddDriver">["navigation"];
};

const { width: SW } = Dimensions.get("window");

// ── Palette — mirrors AdminDashboard (blue) ─────────────────────────────────
const C = {
  bgDark:      "#0A1F44",
  bgMid:       "#0D3B8E",
  bgBright:    "#1565C0",
  purple:      "#1565C0",
  btn1:        "#0D3B8E",
  btn2:        "#0A1F44",
  cream:       "#F6F1E9",
  heading:     "#0D1B3E",
  label:       "#3A245C",
  muted:       "#4A6A8E",
  inputBg:     "#F0F4FF",
  inputBorder: "#BFDBFE",
  inputText:   "#10204A",
  placeholder: "#5F6F8F",
  white:       "#FFFFFF",
  red:         "#EF4444",
  green:       "#22C55E",
};

const fmt = (d: Date) =>
  `${String(d.getDate()).padStart(2,"0")} / ${String(d.getMonth()+1).padStart(2,"0")} / ${d.getFullYear()}`;

const fmtDob = (d: Date) =>
  `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;

// ── Reusable field ────────────────────────────────────────────────────────────
const Field = ({
  icon, label, value, onChangeText, placeholder,
  keyboardType, autoCapitalize, secureTextEntry,
  multiline, maxLength, error,
}: {
  icon: any; label: string; value: string;
  onChangeText: (t: string) => void; placeholder: string;
  keyboardType?: any; autoCapitalize?: any; secureTextEntry?: boolean;
  multiline?: boolean; maxLength?: number; error?: string;
}) => (
  <View style={s.fieldWrap}>
    <Text style={s.fieldLabel}>{label}</Text>
    <View style={[s.field, !!error && s.fieldErr, multiline && s.fieldMulti]}>
      <View style={s.iconWrap}>
        <Ionicons name={icon} size={17} color={C.purple} />
      </View>
      <TextInput
        style={[s.input, multiline && s.inputMulti]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.placeholder}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize ?? "none"}
        secureTextEntry={secureTextEntry}
        multiline={multiline}
        maxLength={maxLength}
        textAlignVertical={multiline ? "top" : "center"}
        autoCorrect={false}
      />
    </View>
    {!!error && (
      <Text style={s.errTxt}>
        <Ionicons name="alert-circle-outline" size={12} /> {error}
      </Text>
    )}
  </View>
);

// ── Screen ────────────────────────────────────────────────────────────────────
const AddDriverScreen = ({ navigation }: Props) => {
  const { isAdmin } = useAuth();
  const [selectedClient, setSelectedClient] = useState<ClientOption | null>(null);
  const [driverName,     setDriverName]     = useState("");
  const [phoneNumber,    setPhoneNumber]    = useState("");
  const [licenseNumber,  setLicenseNumber]  = useState("");
  const [aadharNumber,   setAadharNumber]   = useState("");
  const [licenseExpiry,  setLicenseExpiry]  = useState<Date | null>(null);
  const [showPicker,     setShowPicker]     = useState(false);
  const [dob,            setDob]            = useState("");  // DD/MM/YYYY typed
  const [dobDate,        setDobDate]        = useState<Date>(new Date(1990, 0, 1));
  const [showDobPicker,  setShowDobPicker]  = useState(false);
  const [status,         setStatus]         = useState<"ACTIVE" | "INACTIVE">("ACTIVE");
  const [comments,       setComments]       = useState("");
  const [errors,         setErrors]         = useState<Record<string, string>>({});
  const { toast, showToast, hideToast }     = useToast();
  const [importResult, setImportResult]     = useState<ImportResult | null>(null);
  const [importing, setImporting]           = useState(false);

  const handleImport = async () => {
    if (isAdmin && !selectedClient) {
      showToast("Please select a client first.", "warning");
      return;
    }
    setImporting(true);
    try {
      const rows = await pickAndParseFile();
      if (!rows.length) { showToast("No data found in file.", "warning"); setImporting(false); return; }

      let success = 0;
      const failures: ImportResult["failures"] = [];

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const fullName = (r["FullName"] || "").trim();
        const mobile   = (r["MobileNumber"] || "").trim();
        const dobRaw   = (r["DateOfBirth"] || "").trim();
        const license  = (r["DrivingLicenseNumber"] || "").trim();
        const aadhar   = (r["AadhaarNumber"] || "").trim();
        const expiry   = (r["LicenseExpiryDate"] || "").trim();
        const statusRaw= (r["DriverStatus"] || "").toLowerCase();
        const notes    = (r["Notes / Comments"] || r["Notes"] || "").trim();

        // Parse date strings: "12-Jun-1988", "15-Aug-2030", "2030-08-15", "15/08/2030"
        const parseImportDate = (s: string): string | undefined => {
          if (!s || !s.trim()) return undefined;
          const t = s.trim();
          const d = new Date(t);
          if (!isNaN(d.getTime())) return d.toISOString();
          const months: Record<string, string> = {
            jan:"01",feb:"02",mar:"03",apr:"04",may:"05",jun:"06",
            jul:"07",aug:"08",sep:"09",oct:"10",nov:"11",dec:"12",
          };
          const m1 = t.match(/^(\d{1,2})[\-\/](\w{3})[\-\/](\d{4})$/);
          if (m1) {
            const mo = months[m1[2].toLowerCase()];
            if (mo) return new Date(`${m1[3]}-${mo}-${m1[1].padStart(2,"0")}`).toISOString();
          }
          const m2 = t.match(/^(\d{1,2})[\-\/](\d{1,2})[\-\/](\d{4})$/);
          if (m2) return new Date(`${m2[3]}-${m2[2].padStart(2,"0")}-${m2[1].padStart(2,"0")}`).toISOString();
          return undefined;
        };

        try {
          await createDriver({
            driverName:    fullName,
            phoneNumber:   mobile,
            licenseNumber: license.toUpperCase(),
            aadharNumber:  aadhar,
            licenseExpiry: parseImportDate(expiry),
            status:        statusRaw === "inactive" ? "INACTIVE" : "ACTIVE",
            comments:      notes,
            username:      mobile,
            password:      dobRaw,
            clientId:      isAdmin ? selectedClient?.id : undefined,
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

  const clrErr = (field: string) =>
    setErrors(prev => ({ ...prev, [field]: "" }));

  const validate = () => {
    const e: Record<string, string> = {};
    const today = new Date(); today.setHours(0,0,0,0);

    if (!driverName.trim())
      e.driverName = "This field is required.";
    else if (!/^[a-zA-Z\s]+$/.test(driverName.trim()))
      e.driverName = "Only letters and spaces allowed.";
    else if (driverName.trim().length < 3 || driverName.trim().length > 50)
      e.driverName = "Must be 3 to 50 characters.";

    if (!phoneNumber.trim())
      e.phoneNumber = "This field is required.";
    else if (!/^[6-9]\d{9}$/.test(phoneNumber.trim()))
      e.phoneNumber = "Please enter a valid 10-digit mobile number starting with 6, 7, 8 or 9.";

    if (!licenseNumber.trim())
      e.licenseNumber = "This field is required.";
    else if (!/^[A-Z0-9\s]{10,18}$/i.test(licenseNumber.trim()))
      e.licenseNumber = "Enter a valid license number (10 to 18 letters or digits).";

    if (!aadharNumber.trim())
      e.aadharNumber = "This field is required.";
    else if (!/^\d{12}$/.test(aadharNumber.trim()))
      e.aadharNumber = "Aadhaar number must be exactly 12 digits.";

    if (!licenseExpiry)
      e.licenseExpiry = "This field is required.";
    else if (licenseExpiry <= today)
      e.licenseExpiry = "License expiry date must be a future date.";

    if (!dob.trim())
      e.dob = "This field is required.";
    else if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dob.trim()))
      e.dob = "Please enter date in DD/MM/YYYY format.";
    // BUG-006: Validate minimum driving age (18 years)
    else {
      const [day, month, year] = dob.trim().split('/').map(Number);
      const birthDate = new Date(year, month - 1, day);
      const ageInYears = (today.getTime() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      if (ageInYears < 18) {
        e.dob = "Driver does not meet the minimum required driving age.";
      }
    }

    if (comments.trim().length > 250)
      e.comments = "Maximum 250 characters allowed.";

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onContinue = () => {
    if (isAdmin && !selectedClient) {
      showToast("Please select a client first.", "warning");
      return;
    }
    if (!validate()) {
      showToast("Please fix the errors shown below.", "warning");
      return;
    }
    navigation.navigate("DriverPhotos", {
      driverPayload: {
        driverName:    driverName.trim(),
        phoneNumber:   phoneNumber.trim(),
        comments:      comments.trim(),
        licenseNumber: licenseNumber.trim().toUpperCase(),
        aadharNumber:  aadharNumber.trim(),
        licenseExpiry: licenseExpiry ? licenseExpiry.toISOString() : undefined,
        status,
        username:      phoneNumber.trim(),
        password:      dob.trim(),  // Date of Birth in DD/MM/YYYY — stored as password
        clientId:      selectedClient?.id,
      },
    });
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.bgDark} />

      {/* Blue gradient — same as AdminDashboard */}
      <LinearGradient
        colors={[C.bgDark, C.bgMid, C.bgBright]}
        locations={[0, 0.5, 1]}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Subtle grid lines */}
      {[0.18, 0.36, 0.54, 0.72].map((t, i) => (
        <View key={`h${i}`} style={[s.gridH, { top: `${t * 100}%` as any }]} />
      ))}
      {[0.15, 0.42, 0.68, 0.88].map((t, i) => (
        <View key={`v${i}`} style={[s.gridV, { left: `${t * 100}%` as any }]} />
      ))}

      <SafeAreaView style={s.safe}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>

          {/* ── Header ── */}
          <View style={s.header}>
            <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
              <Ionicons name="chevron-back" size={22} color={C.white} />
            </TouchableOpacity>
            <View style={s.headerCenter}>
              <Text style={s.headerTitle}>Add Driver</Text>
              <Text style={s.headerSub}>Fill in all details below</Text>
            </View>
            <View style={{ width: 42 }} />
          </View>

          <ScrollView
            contentContainerStyle={s.scroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* ── Card ── */}
            <View style={s.card}>

              {/* Card top-edge tint */}
              <LinearGradient
                colors={[C.bgMid, "transparent"]}
                start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
                style={s.cardEdge}
              />

              <View style={s.sectionHeaderRow}>
                <Text style={s.sectionTitle}>Driver Information</Text>
                <TouchableOpacity style={s.importBtn} onPress={handleImport} disabled={importing}>
                  {importing
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Ionicons name="cloud-upload-outline" size={13} color="#fff" />
                  }
                  <Text style={s.importBtnTxt}>{importing ? "Importing…" : "Import Excel / CSV"}</Text>
                </TouchableOpacity>
              </View>

              {/* Client selector — admin only */}
              {isAdmin && (
                <View style={s.fieldWrap}>
                  <ClientSelector
                    selectedClientId={selectedClient?.id ?? null}
                    onSelect={setSelectedClient}
                  />
                </View>
              )}

              <Field
                icon="person-outline" label="Full Name"
                value={driverName}
                onChangeText={t => { setDriverName(t); clrErr("driverName"); }}
                placeholder="e.g. Ravi Kumar"
                autoCapitalize="words" error={errors.driverName}
              />

              {/* ── LOGIN CREDENTIALS: Mobile Number + Date of Birth ── */}
              <Text style={s.sectionTitle}>Login Credentials</Text>

              <Field
                icon="call-outline" label="Mobile Number"
                value={phoneNumber}
                onChangeText={t => { setPhoneNumber(t); clrErr("phoneNumber"); }}
                placeholder="10-digit number starting with 6, 7, 8 or 9"
                keyboardType="phone-pad" maxLength={10} error={errors.phoneNumber}
              />

              <View style={s.fieldWrap}>
                <Text style={s.fieldLabel}>Date of Birth</Text>
                <View style={[s.field, !!errors.dob && s.fieldErr]}>
                  <View style={s.iconWrap}>
                    <Ionicons name="gift-outline" size={17} color={C.purple} />
                  </View>
                  <TextInput
                    style={[s.input, { flex: 1 }]}
                    value={dob}
                    onChangeText={t => {
                      const digits = t.replace(/\D/g, "");
                      let formatted = digits;
                      if (digits.length > 2)  formatted = digits.slice(0,2) + "/" + digits.slice(2);
                      if (digits.length > 4)  formatted = digits.slice(0,2) + "/" + digits.slice(2,4) + "/" + digits.slice(4,8);
                      setDob(formatted);
                      clrErr("dob");
                    }}
                    placeholder="DD/MM/YYYY"
                    placeholderTextColor={C.placeholder}
                    keyboardType="numeric"
                    maxLength={10}
                  />
                  <TouchableOpacity
                    onPress={() => setShowDobPicker(true)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={{ paddingRight: 4 }}
                  >
                    <Ionicons name="calendar" size={20} color={C.purple} />
                  </TouchableOpacity>
                </View>
                {!!errors.dob && (
                  <Text style={s.errTxt}><Ionicons name="alert-circle-outline" size={12} /> {errors.dob}</Text>
                )}
              </View>
              {showDobPicker && (
                <DateTimePicker
                  value={dobDate}
                  mode="date"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  maximumDate={new Date()}
                  onChange={(_, d) => {
                    setShowDobPicker(false);
                    if (d) { setDobDate(d); setDob(fmtDob(d)); clrErr("dob"); }
                  }}
                />
              )}

              <Text style={s.sectionTitle}>License & Identity</Text>

              <Field
                icon="card-outline" label="Driving License Number"
                value={licenseNumber}
                onChangeText={t => { setLicenseNumber(t); clrErr("licenseNumber"); }}
                placeholder="e.g. AP12 20230012345"
                autoCapitalize="characters" error={errors.licenseNumber}
              />
              <Field
                icon="finger-print-outline" label="Aadhaar Number"
                value={aadharNumber}
                onChangeText={t => { setAadharNumber(t); clrErr("aadharNumber"); }}
                placeholder="Enter your 12-digit Aadhaar number"
                keyboardType="numeric" maxLength={12} error={errors.aadharNumber}
              />

              {/* Date picker */}
              <View style={s.fieldWrap}>
                <Text style={s.fieldLabel}>License Expiry Date</Text>
                <TouchableOpacity
                  style={[s.field, !!errors.licenseExpiry && s.fieldErr]}
                  onPress={() => setShowPicker(true)}
                  activeOpacity={0.75}
                >
                  <View style={s.iconWrap}>
                    <Ionicons name="calendar-outline" size={17} color={C.purple} />
                  </View>
                  <Text style={[s.input, { flex: 1, paddingVertical: 0, lineHeight: 20 },
                    !licenseExpiry && { color: C.placeholder }]}>
                    {licenseExpiry ? fmt(licenseExpiry) : "Tap to pick expiry date"}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color={C.placeholder} style={{ marginRight: 4 }} />
                </TouchableOpacity>
                {!!errors.licenseExpiry && (
                  <Text style={s.errTxt}><Ionicons name="alert-circle-outline" size={12} /> {errors.licenseExpiry}</Text>
                )}
              </View>
              {showPicker && (
                <DateTimePicker
                  value={licenseExpiry ?? new Date()}
                  mode="date"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  minimumDate={new Date(Date.now() + 86400000)}
                  onChange={(_, d) => {
                    setShowPicker(false);
                    if (d) { setLicenseExpiry(d); clrErr("licenseExpiry"); }
                  }}
                />
              )}

              {/* ── License Expiry only — DOB moved up to Login Credentials ── */}

              <Text style={s.sectionTitle}>Status & Notes</Text>

              {/* Status toggle */}
              <View style={s.fieldWrap}>
                <Text style={s.fieldLabel}>Driver Status</Text>
                <View style={s.toggleRow}>
                  <TouchableOpacity
                    style={[s.toggleBtn, status === "ACTIVE" && s.toggleActive]}
                    onPress={() => setStatus("ACTIVE")}
                  >
                    <Ionicons name="checkmark-circle" size={16} color={status === "ACTIVE" ? C.green : C.muted} />
                    <Text style={[s.toggleTxt, status === "ACTIVE" && { color: C.green }]}>Active</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.toggleBtn, status === "INACTIVE" && s.toggleInactive]}
                    onPress={() => setStatus("INACTIVE")}
                  >
                    <Ionicons name="close-circle" size={16} color={status === "INACTIVE" ? C.red : C.muted} />
                    <Text style={[s.toggleTxt, status === "INACTIVE" && { color: C.red }]}>Inactive</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <Field
                icon="chatbubble-outline" label="Notes / Comments (Optional)"
                value={comments}
                onChangeText={t => { setComments(t); clrErr("comments"); }}
                placeholder="Add a short note about this driver (optional)"
                multiline maxLength={250} error={errors.comments}
              />

              {/* Continue button — yellow/amber gradient */}
              <View style={s.btnShadow}>
                <TouchableOpacity style={s.btnOuter} onPress={onContinue} activeOpacity={0.84}>
                  <LinearGradient
                    colors={["#D97706", "#92400E"]}
                    start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                    style={s.btnGrad}
                  >
                    <LinearGradient
                      colors={["rgba(255,255,255,0.14)", "rgba(255,255,255,0.00)"]}
                      start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
                      style={s.btnGloss}
                    />
                    <Ionicons name="camera-outline" size={18} color={C.white} style={{ marginRight: 8 }} />
                    <Text style={s.btnTxt}>Continue to Driver Photos</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>

            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

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
  gridV: { position: "absolute", top: 0, bottom: 0, width: 1,  backgroundColor: "rgba(255,255,255,0.025)" },

  // Header
  header:       { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 },
  backBtn:      { width: 36, height: 36, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.12)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle:  { fontSize: 18, fontWeight: "800", color: C.white, letterSpacing: -0.3 },
  headerSub:    { fontSize: 11, color: "rgba(255,255,255,0.55)", marginTop: 1, letterSpacing: 0.3 },

  scroll: { paddingHorizontal: 14, paddingBottom: 70 },

  // Card — same as LoginScreen
  card: {
    backgroundColor: C.cream,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 16,
    overflow: "hidden",
    shadowColor: "#1A0040",
    shadowOpacity: 0.15,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  cardEdge: {
    position: "absolute", top: 0, left: 0, right: 0, height: 4,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
  },

  sectionHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4, marginBottom: 10, borderBottomWidth: 1, borderBottomColor: "rgba(21,101,192,0.12)", paddingBottom: 6 },
  importBtn:     { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#0D3B8E", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  importBtnTxt:  { color: "#fff", fontSize: 10, fontWeight: "700" },

  // Section title inside card
  sectionTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: C.purple,
    letterSpacing: 1.0,
    textTransform: "uppercase",
    marginTop: 6,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(21,101,192,0.12)",
    paddingBottom: 6,
  },

  // Field
  fieldWrap:  { marginBottom: 12 },
  fieldLabel: { fontSize: 12, fontWeight: "700", color: C.label, marginBottom: 6 },
  field: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.inputBg,
    borderRadius: 10,
    paddingRight: 10,
    minHeight: 44,
    borderWidth: 1,
    borderColor: C.inputBorder,
    shadowColor: "#A06020",
    shadowOpacity: 0.06,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  fieldMulti: { alignItems: "flex-start", paddingTop: 4, paddingBottom: 4 },
  fieldErr:   { borderColor: "#F87171" },
  iconWrap:   { width: 38, minHeight: 44, alignItems: "center", justifyContent: "center" },
  input: {
    flex: 1,
    fontSize: 13,
    color: C.inputText,
    paddingVertical: 11,
  },
  inputMulti: { height: 72, paddingTop: 10, paddingBottom: 6 },
  errTxt:     { fontSize: 11, color: C.red, marginTop: 3, marginLeft: 2 },

  // Status toggle
  toggleRow:     { flexDirection: "row", gap: 8 },
  toggleBtn:     { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 10, borderRadius: 10, backgroundColor: "rgba(21,101,192,0.06)", borderWidth: 1, borderColor: "rgba(21,101,192,0.14)" },
  toggleActive:  { backgroundColor: "rgba(34,197,94,0.12)", borderColor: "#22C55E88" },
  toggleInactive:{ backgroundColor: "rgba(248,113,113,0.12)", borderColor: "#F8717188" },
  toggleTxt:     { fontSize: 13, fontWeight: "700", color: C.muted },

  // Button — same as LoginScreen
  btnShadow: {
    borderRadius: 12, marginTop: 6,
    shadowColor: "#92400E", shadowOpacity: 0.25,
    shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  btnOuter: { borderRadius: 12, overflow: "hidden" },
  btnGrad:  { height: 46, flexDirection: "row", alignItems: "center", justifyContent: "center", borderRadius: 12, overflow: "hidden" },
  btnGloss: { position: "absolute", top: 0, left: 0, right: 0, height: 20, borderRadius: 12 },
  btnTxt:   { fontSize: 14, fontWeight: "800", color: C.white, letterSpacing: 0.3 },
});

export default AddDriverScreen;
