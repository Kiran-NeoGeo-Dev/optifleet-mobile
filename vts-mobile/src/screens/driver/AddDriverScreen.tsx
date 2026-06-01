import { useState } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, KeyboardAvoidingView, Platform, StatusBar, Dimensions,
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

type Props =
  | NativeStackScreenProps<AdminStackParamList, "AddDriver">
  | NativeStackScreenProps<MainStackParamList, "AddDriver">;

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
  inputBg:     "#E8C9A0",       // warm peach / cream beige
  inputBorder: "rgba(160,90,30,0.35)",
  inputText:   "#3B1F0A",       // dark warm brown
  placeholder: "#A0785A",       // warm tan
  white:       "#FFFFFF",
  red:         "#EF4444",
  green:       "#22C55E",
};

const fmt = (d: Date) =>
  `${String(d.getDate()).padStart(2,"0")} / ${String(d.getMonth()+1).padStart(2,"0")} / ${d.getFullYear()}`;

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
  const [status,         setStatus]         = useState<"ACTIVE" | "INACTIVE">("ACTIVE");
  const [comments,       setComments]       = useState("");
  const [errors,         setErrors]         = useState<Record<string, string>>({});
  const { toast, showToast, hideToast }     = useToast();

  const clrErr = (field: string) =>
    setErrors(prev => ({ ...prev, [field]: "" }));

  const validate = () => {
    const e: Record<string, string> = {};
    const today = new Date(); today.setHours(0,0,0,0);

    if (!driverName.trim())
      e.driverName = "Driver name is required.";
    else if (!/^[a-zA-Z\s]+$/.test(driverName.trim()))
      e.driverName = "Only letters and spaces allowed.";
    else if (driverName.trim().length < 3 || driverName.trim().length > 50)
      e.driverName = "Must be 3 to 50 characters.";

    if (!phoneNumber.trim())
      e.phoneNumber = "Phone number is required.";
    else if (!/^[6-9]\d{9}$/.test(phoneNumber.trim()))
      e.phoneNumber = "Enter a valid 10-digit mobile number.";

    if (!licenseNumber.trim())
      e.licenseNumber = "License number is required.";
    else if (!/^[A-Z0-9\s]{10,18}$/i.test(licenseNumber.trim()))
      e.licenseNumber = "Enter 10 to 18 letters or numbers.";

    if (!aadharNumber.trim())
      e.aadharNumber = "Aadhaar number is required.";
    else if (!/^\d{12}$/.test(aadharNumber.trim()))
      e.aadharNumber = "Aadhaar must be exactly 12 digits.";

    if (!licenseExpiry)
      e.licenseExpiry = "Please pick the license expiry date.";
    else if (licenseExpiry <= today)
      e.licenseExpiry = "Expiry date must be a future date.";

    if (!comments.trim())
      e.comments = "Please add a short note or comment.";
    else if (comments.trim().length > 250)
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

              <Text style={s.sectionTitle}>Driver Information</Text>

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
              <Field
                icon="call-outline" label="Mobile Number"
                value={phoneNumber}
                onChangeText={t => { setPhoneNumber(t); clrErr("phoneNumber"); }}
                placeholder="10-digit number starting with 6, 7, 8 or 9"
                keyboardType="phone-pad" maxLength={10} error={errors.phoneNumber}
              />

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
                icon="chatbubble-outline" label="Notes / Comments"
                value={comments}
                onChangeText={t => { setComments(t); clrErr("comments"); }}
                placeholder="Add a short note about this driver (e.g. experienced, city routes)"
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
  header:       { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 10, paddingBottom: 14 },
  backBtn:      { width: 42, height: 42, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.12)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle:  { fontSize: 22, fontWeight: "800", color: C.white, letterSpacing: -0.3 },
  headerSub:    { fontSize: 12, color: "rgba(255,255,255,0.55)", marginTop: 2, letterSpacing: 0.3 },

  scroll: { paddingHorizontal: 16, paddingBottom: 48 },

  // Card — same as LoginScreen
  card: {
    backgroundColor: C.cream,
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 24,
    overflow: "hidden",
    shadowColor: "#1A0040",
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 14,
  },
  cardEdge: {
    position: "absolute", top: 0, left: 0, right: 0, height: 5,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
  },

  // Section title inside card
  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: C.purple,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginTop: 8,
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(21,101,192,0.12)",
    paddingBottom: 8,
  },

  // Field
  fieldWrap:  { marginBottom: 16 },
  fieldLabel: { fontSize: 13, fontWeight: "700", color: C.label, marginBottom: 8 },
  field: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.inputBg,
    borderRadius: 14,
    paddingRight: 12,
    minHeight: 52,
    borderWidth: 1,
    borderColor: C.inputBorder,
    shadowColor: "#A06020",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  fieldMulti: { alignItems: "flex-start", paddingTop: 4, paddingBottom: 4 },
  fieldErr:   { borderColor: "#F87171" },
  iconWrap:   { width: 44, minHeight: 52, alignItems: "center", justifyContent: "center" },
  input: {
    flex: 1,
    fontSize: 14,
    color: C.inputText,
    paddingVertical: 14,
  },
  inputMulti: { height: 90, paddingTop: 12, paddingBottom: 8 },
  errTxt:     { fontSize: 12, color: C.red, marginTop: 5, marginLeft: 2 },

  // Status toggle
  toggleRow:     { flexDirection: "row", gap: 10 },
  toggleBtn:     { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 13, borderRadius: 12, backgroundColor: "rgba(21,101,192,0.06)", borderWidth: 1, borderColor: "rgba(21,101,192,0.14)" },
  toggleActive:  { backgroundColor: "rgba(34,197,94,0.12)", borderColor: "#22C55E88" },
  toggleInactive:{ backgroundColor: "rgba(248,113,113,0.12)", borderColor: "#F8717188" },
  toggleTxt:     { fontSize: 14, fontWeight: "700", color: C.muted },

  // Button — same as LoginScreen
  btnShadow: {
    borderRadius: 16, marginTop: 8,
    shadowColor: "#92400E", shadowOpacity: 0.28,
    shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 8,
  },
  btnOuter: { borderRadius: 16, overflow: "hidden" },
  btnGrad:  { height: 56, flexDirection: "row", alignItems: "center", justifyContent: "center", borderRadius: 16, overflow: "hidden" },
  btnGloss: { position: "absolute", top: 0, left: 0, right: 0, height: 26, borderRadius: 16 },
  btnTxt:   { fontSize: 16, fontWeight: "800", color: C.white, letterSpacing: 0.3 },
});

export default AddDriverScreen;
