import { useState } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, KeyboardAvoidingView, Platform, StatusBar, ActivityIndicator, Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AdminStackParamList } from "../../navigation/AdminNavigator";
import { createClientAccount } from "../../services/adminService";
import { Toast, useToast } from "../../components/Toast";
import { useAuth } from "../../hooks/useAuth";

type Props = NativeStackScreenProps<AdminStackParamList, "CreateClient">;

const C = {
  bgDark:      "#0A1F44",
  bgMid:       "#0D3B8E",
  bgBright:    "#1565C0",
  cream:       "#F6F1E9",
  cardText:    "#0D1B3E",
  labelText:   "#3A245C",
  inputBg:     "#E8C9A0",
  inputBorder: "rgba(160,90,30,0.35)",
  inputText:   "#3B1F0A",
  placeholder: "#A0785A",
  mutedText:   "#4A6A8E",
  white:       "#FFFFFF",
  red:         "#EF4444",
  accent:      "#1565C0",
};

const Field = ({
  icon, label, value, onChangeText, placeholder,
  keyboardType, secureTextEntry, multiline, maxLength, error,
}: {
  icon: any; label: string; value: string; onChangeText: (t: string) => void;
  placeholder?: string; keyboardType?: any; secureTextEntry?: boolean;
  multiline?: boolean; maxLength?: number; error?: string;
}) => (
  <View style={f.wrap}>
    <Text style={f.label}>
      <Ionicons name={icon} size={12} color={C.accent} />{"  "}{label}
    </Text>
    <TextInput
      style={[f.input, multiline && f.multiline, !!error && f.inputErr]}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={C.placeholder}
      keyboardType={keyboardType}
      autoCapitalize="none"
      secureTextEntry={secureTextEntry}
      multiline={multiline}
      maxLength={maxLength}
      textAlignVertical={multiline ? "top" : "center"}
    />
    {!!error && (
      <Text style={f.error}>
        <Ionicons name="alert-circle-outline" size={11} /> {error}
      </Text>
    )}
  </View>
);

const friendlyError = (raw: string): string => {
  const r = (raw || "").toLowerCase();
  if (r.includes("phone") || r.includes("unique_phone"))       return "Phone number already exists. Please use a different phone number.";
  if (r.includes("email") || r.includes("unique_email"))       return "Email address already exists. Please use a different email address.";
  if (r.includes("username") || r.includes("unique_username")) return "Username already exists. Please choose another username.";
  if (r.includes("duplicate") || r.includes("unique") || r.includes("already exists")) return "A user with these details already exists. Please check and try again.";
  if (r.includes("constraint")) return "This information conflicts with an existing record. Please review your inputs.";
  return "Failed to create user. Please try again.";
};

const RoleDropdown = ({
  value, onChange, error, options,
}: { value: string; onChange: (v: string) => void; error?: string; options: string[] }) => {
  const [open, setOpen] = useState(false);
  return (
    <View style={f.wrap}>
      <Text style={f.label}>
        <Ionicons name="briefcase-outline" size={12} color={C.accent} />{"  "}Role *
      </Text>
      <TouchableOpacity
        style={[f.input, f.rowInput, !!error && f.inputErr, { justifyContent: "space-between" }]}
        onPress={() => setOpen(true)}
        activeOpacity={0.8}
      >
        <Text style={{ fontSize: 14, color: value ? C.inputText : C.placeholder }}>
          {value || "Select Role"}
        </Text>
        <Ionicons name="chevron-down" size={18} color={C.mutedText} />
      </TouchableOpacity>
      {!!error && (
        <Text style={f.error}><Ionicons name="alert-circle-outline" size={11} /> {error}</Text>
      )}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={rd.backdrop} onPress={() => setOpen(false)} activeOpacity={1}>
          <View style={rd.menu}>
            {options.map(opt => (
              <TouchableOpacity
                key={opt}
                style={[rd.option, value === opt && rd.optionActive]}
                onPress={() => { onChange(opt); setOpen(false); }}
              >
                <Text style={[rd.optionTxt, value === opt && rd.optionTxtActive]}>{opt}</Text>
                {value === opt && <Ionicons name="checkmark" size={16} color={C.accent} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const rd = StyleSheet.create({
  backdrop:        { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "center", alignItems: "center" },
  menu:            { backgroundColor: "#fff", borderRadius: 16, width: 220, overflow: "hidden", elevation: 10, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  option:          { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 16, paddingHorizontal: 20 },
  optionActive:    { backgroundColor: C.inputBg },
  optionTxt:       { fontSize: 15, color: C.inputText, fontWeight: "600" },
  optionTxtActive: { color: C.accent },
});

const CreateClientScreen = ({ navigation }: Props) => {
  const { role: authRole }                    = useAuth();
  const isSuperAdmin                          = authRole?.toLowerCase() === "superadmin";
  const roleOptions                           = isSuperAdmin ? ["Admin"] : ["User", "Admin"];
  const [username,        setUsername]        = useState("");
  const [password,        setPassword]        = useState("");
  const [showPassword,    setShowPassword]    = useState(false);
  const [fullName,        setFullName]        = useState("");
  const [emailAddress,    setEmailAddress]    = useState("");
  const [phoneNumber,     setPhoneNumber]     = useState("");
  const [role,            setRole]            = useState(isSuperAdmin ? "Admin" : "User");
  const [roleDescription, setRoleDescription] = useState("");
  const [errors,          setErrors]          = useState<Record<string, string>>({});
  const [loading,         setLoading]         = useState(false);
  const { toast, showToast, hideToast }       = useToast();

  const validate = () => {
    const e: Record<string, string> = {};
    if (!username.trim() || username.trim().length < 3)
      e.username = "Min 3 characters required.";
    if (!password.trim() || password.trim().length < 6)
      e.password = "Min 6 characters required.";
    if (!fullName.trim())
      e.fullName = "Full name is required.";
    if (!emailAddress.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddress))
      e.emailAddress = "Valid email is required.";
    if (!phoneNumber.trim() || !/^[6-9]\d{9}$/.test(phoneNumber))
      e.phoneNumber = "10 digits starting with 6–9.";
    if (!role.trim())
      e.role = "Role is required.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const clear = (key: string) => setErrors(p => ({ ...p, [key]: "" }));

  const onSubmit = async () => {
    if (!validate()) { showToast("Please fix all errors.", "warning"); return; }
    setLoading(true);
    try {
      await createClientAccount({
        username: username.trim(), password: password.trim(),
        fullName: fullName.trim(), emailAddress: emailAddress.trim(),
        phoneNumber: phoneNumber.trim(), role: role.trim(),
        roleDescription: roleDescription.trim(),
      });
      showToast(`${role} account created successfully!`, "success");
      setTimeout(() => navigation.goBack(), 1800);
    } catch (e: any) {
      const raw = e?.response?.data?.error || e?.response?.data?.message || "";
      showToast(friendlyError(raw), "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.bgDark} />

      <LinearGradient
        colors={[C.bgDark, C.bgMid, C.bgBright]}
        locations={[0, 0.5, 1]}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {[0.18, 0.38, 0.58, 0.78].map((t, i) => (
        <View key={`h${i}`} style={[s.gridH, { top: `${t * 100}%` as any }]} />
      ))}
      {[0.15, 0.45, 0.75].map((t, i) => (
        <View key={`v${i}`} style={[s.gridV, { left: `${t * 100}%` as any }]} />
      ))}
      <View style={s.bgGlow} />

      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>

          <View style={s.header}>
            <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
              <Ionicons name="chevron-back" size={22} color={C.white} />
            </TouchableOpacity>
            <View style={{ flex: 1, alignItems: "center" }}>
              <Text style={s.brandTxt}>
                <Text style={{ color: C.white }}>Opti</Text>
                <Text style={{ color: C.white }}>Fleet</Text>
              </Text>
              <Text style={s.pageTitle}>Create User or Admin</Text>
            </View>
            <View style={{ width: 42 }} />
          </View>

          <View style={s.badgeRow}>
            <View style={s.badge}>
              <Ionicons name="person-add-outline" size={13} color={C.accent} />
              <Text style={s.badgeTxt}>Admin — Create login credentials</Text>
            </View>
          </View>

          <ScrollView
            contentContainerStyle={s.scroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={s.card}>
              <LinearGradient
                colors={[C.bgMid, "transparent"]}
                start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
                style={s.cardTopBar}
              />

              <Text style={s.cardTitle}>Account Details</Text>
              <Text style={s.cardSub}>Fill in the details to create a new user or admin account</Text>

              <Field
                icon="person-outline" label="Username *"
                value={username} onChangeText={t => { setUsername(t); clear("username"); }}
                placeholder="Min 3 characters" error={errors.username}
              />

              <View style={f.wrap}>
                <Text style={f.label}>
                  <Ionicons name="lock-closed-outline" size={12} color={C.accent} />{"  "}Password *
                </Text>
                <View style={[f.input, f.rowInput, !!errors.password && f.inputErr]}>
                  <TextInput
                    style={{ flex: 1, fontSize: 14, color: C.inputText, paddingVertical: 0 }}
                    value={password}
                    onChangeText={t => { setPassword(t); clear("password"); }}
                    placeholder="Min 6 characters"
                    placeholderTextColor={C.placeholder}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity onPress={() => setShowPassword(p => !p)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={18} color={C.mutedText} />
                  </TouchableOpacity>
                </View>
                {!!errors.password && (
                  <Text style={f.error}><Ionicons name="alert-circle-outline" size={11} /> {errors.password}</Text>
                )}
              </View>

              <View style={s.divider} />

              <Field
                icon="person-circle-outline" label="Full Name *"
                value={fullName} onChangeText={t => { setFullName(t); clear("fullName"); }}
                placeholder="Enter full name" error={errors.fullName}
              />

              <Field
                icon="mail-outline" label="Email ID *"
                value={emailAddress} onChangeText={t => { setEmailAddress(t); clear("emailAddress"); }}
                placeholder="email@example.com" keyboardType="email-address" error={errors.emailAddress}
              />

              <Field
                icon="call-outline" label="Phone Number *"
                value={phoneNumber} onChangeText={t => { setPhoneNumber(t); clear("phoneNumber"); }}
                placeholder="10 digits starting 6–9" keyboardType="phone-pad" maxLength={10} error={errors.phoneNumber}
              />

              <View style={s.divider} />

              <RoleDropdown
                value={role}
                onChange={v => { setRole(v); clear("role"); }}
                error={errors.role}
                options={roleOptions}
              />

              <Field
                icon="document-text-outline" label="Role Description"
                value={roleDescription} onChangeText={setRoleDescription}
                placeholder="Brief description (optional)" multiline
              />

              <TouchableOpacity
                style={[s.submitBtn, loading && { opacity: 0.7 }]}
                onPress={onSubmit}
                disabled={loading}
                activeOpacity={0.84}
              >
                <LinearGradient
                  colors={["#16A34A", "#14532D"]}
                  start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                  style={s.submitGrad}
                >
                  <LinearGradient
                    colors={["rgba(255,255,255,0.14)", "rgba(255,255,255,0.00)"]}
                    start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
                    style={s.submitGloss}
                  />
                  {loading
                    ? <ActivityIndicator size="small" color={C.white} />
                    : <>
                        <Ionicons name="person-add-outline" size={20} color={C.white} style={{ marginRight: 8 }} />
                        <Text style={s.submitTxt}>Create Account</Text>
                      </>
                  }
                </LinearGradient>
              </TouchableOpacity>

            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={hideToast} />
    </View>
  );
};

const f = StyleSheet.create({
  wrap:      { marginBottom: 16 },
  label:     { fontSize: 11, fontWeight: "700", color: C.labelText, textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 7 },
  input:     { backgroundColor: C.inputBg, borderRadius: 12, borderWidth: 1, borderColor: C.inputBorder, paddingHorizontal: 14, paddingVertical: 13, fontSize: 14, color: C.inputText },
  rowInput:  { flexDirection: "row", alignItems: "center", paddingVertical: 0, height: 50 },
  inputErr:  { borderColor: C.red + "88" },
  multiline: { height: 90, textAlignVertical: "top", paddingTop: 12 },
  error:     { fontSize: 12, color: C.red, marginTop: 5, marginLeft: 2 },
});

const s = StyleSheet.create({
  root:       { flex: 1 },
  gridH:      { position: "absolute", left: 0, right: 0, height: 1, backgroundColor: "rgba(255,255,255,0.025)" },
  gridV:      { position: "absolute", top: 0, bottom: 0, width: 1, backgroundColor: "rgba(255,255,255,0.025)" },
  bgGlow:     { position: "absolute", bottom: 60, left: -50, width: 160, height: 160, borderRadius: 80, backgroundColor: "rgba(13,59,142,0.12)" },
  header:     { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6 },
  backBtn:    { width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(255,255,255,0.12)", borderWidth: 1, borderColor: "rgba(255,255,255,0.20)", alignItems: "center", justifyContent: "center" },
  brandTxt:   { fontSize: 12, fontWeight: "800", letterSpacing: 0.4 },
  pageTitle:  { fontSize: 22, fontWeight: "800", color: C.white, marginTop: 2 },
  badgeRow:   { alignItems: "center", marginBottom: 12 },
  badge:      { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.10)", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)" },
  badgeTxt:   { fontSize: 12, fontWeight: "600", color: "rgba(255,255,255,0.80)" },
  scroll:     { paddingHorizontal: 16, paddingBottom: 48 },
  card:       { backgroundColor: C.cream, borderRadius: 24, padding: 20, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.10, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  cardTopBar: { position: "absolute", top: 0, left: 0, right: 0, height: 4, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  cardTitle:  { fontSize: 20, fontWeight: "800", color: C.cardText, marginBottom: 4, marginTop: 4 },
  cardSub:    { fontSize: 13, color: C.mutedText, marginBottom: 22, lineHeight: 18 },
  divider:    { height: 1, backgroundColor: "rgba(160,90,30,0.12)", marginVertical: 12 },
  submitBtn:  { borderRadius: 16, overflow: "hidden", marginTop: 8, shadowColor: "#14532D", shadowOpacity: 0.30, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  submitGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", height: 56, borderRadius: 16, overflow: "hidden" },
  submitGloss:{ position: "absolute", top: 0, left: 0, right: 0, height: 26, borderRadius: 16 },
  submitTxt:  { fontSize: 16, fontWeight: "800", color: C.white, letterSpacing: 0.3 },
});

export default CreateClientScreen;
