import { useState } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, KeyboardAvoidingView, Platform, StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AuthStackParamList } from "../../navigation/AuthNavigator";
import { Toast, useToast } from "../../components/Toast";
import { api } from "../../services/api";

type Props = NativeStackScreenProps<AuthStackParamList, "AdminRecovery">;

const C = {
  bgDark:      "#0A1F44",
  purple:      "#1565C0",
  btn1:        "#1976D2",
  btn2:        "#0D3B8E",
  cream:       "#F6F1E9",
  label:       "#1A2F5C",
  muted:       "#4A6A8E",
  inputBg:     "#E8C9A0",
  inputBorder: "rgba(160,90,30,0.40)",
  inputText:   "#2C1A0E",
  placeholder: "#8B6F47",
  white:       "#FFFFFF",
};

// ── Reusable field ─────────────────────────────────────────────────────────────
const Field = ({
  icon, label, value, onChangeText, placeholder,
  keyboardType, autoCapitalize, secureTextEntry, showToggle, onToggle,
}: {
  icon: any; label: string; value: string;
  onChangeText: (t: string) => void; placeholder: string;
  keyboardType?: any; autoCapitalize?: any;
  secureTextEntry?: boolean; showToggle?: boolean; onToggle?: () => void;
}) => (
  <View style={s.fieldWrap}>
    <View style={s.fieldLabelRow}>
      <Ionicons name={icon} size={16} color={C.purple} />
      <Text style={s.fieldLabel}>{label}</Text>
    </View>
    <View style={s.field}>
      <TextInput
        style={[s.input, { flex: 1 }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.placeholder}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize ?? "none"}
        secureTextEntry={secureTextEntry}
        autoCorrect={false}
      />
      {showToggle && (
        <TouchableOpacity onPress={onToggle} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={{ paddingRight: 4 }}>
          <Ionicons name={secureTextEntry ? "eye-outline" : "eye-off-outline"} size={18} color={C.placeholder} />
        </TouchableOpacity>
      )}
    </View>
  </View>
);

// ── Screen ─────────────────────────────────────────────────────────────────────
const AdminRecoveryScreen = ({ navigation }: Props) => {
  const [newUsername, setNewUsername] = useState("");
  const [newPass,     setNewPass]     = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [fullName,    setFullName]    = useState("");
  const [email,       setEmail]       = useState("");
  const [phone,       setPhone]       = useState("");
  const [role,        setRole]        = useState("Admin");
  const [roleDesc,    setRoleDesc]    = useState("");
  const [showNew,     setShowNew]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading,     setLoading]     = useState(false);
  const { toast, showToast, hideToast } = useToast();

  const clearAll = () => {
    setNewUsername(""); setNewPass(""); setConfirmPass("");
    setFullName(""); setEmail(""); setPhone("");
    setRole("Admin"); setRoleDesc("");
  };

  const onReset = async () => {
    if (!newUsername.trim()) { showToast("New username is required.", "error"); return; }
    if (!newPass.trim())     { showToast("New password is required.", "error"); return; }
    if (newPass.length < 6)  { showToast("Password must be at least 6 characters.", "error"); return; }
    if (newPass !== confirmPass) { showToast("Passwords do not match.", "error"); return; }
    if (!email.trim())       { showToast("Email address is required.", "error"); return; }

    setLoading(true);
    try {
      await api.post("/api/auth/admin-recovery", {
        newUsername:     newUsername.trim(),
        newPassword:     newPass.trim(),
        fullName:        fullName.trim() || undefined,
        email:           email.trim(),
        phone:           phone.trim() || undefined,
        role:            role.trim() || "Admin",
        roleDescription: roleDesc.trim() || undefined,
      });
      showToast("Credentials saved! Please login with your new username & password.", "success");
      setTimeout(() => navigation.goBack(), 2000);
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.response?.data?.message || "Reset failed. Please try again.";
      showToast(msg, "error");
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
              <Text style={s.headerBrand}>OptiFleet</Text>
              <Text style={s.headerSub}>SECURE ADMIN RECOVERY</Text>
            </View>
            <View style={{ width: 42 }} />
          </View>

          {/* Hero */}
          <View style={s.hero}>
            <View style={s.shieldWrap}>
              <Ionicons name="shield" size={100} color="rgba(255,255,255,0.18)" />
              <View style={s.keyOverlay}>
                <Text style={s.keyEmoji}>🔑</Text>
              </View>
            </View>
          </View>

          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={s.card}>

              <LinearGradient
                colors={["rgba(21,101,192,0.07)", "rgba(21,101,192,0.00)"]}
                start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
                style={s.cardEdge}
              />

              <View style={s.cardTitleRow}>
                <Ionicons name="person-circle-outline" size={28} color={C.purple} />
                <Text style={s.cardTitle}>Admin Recovery</Text>
              </View>
              <Text style={s.cardSub}>Set your new admin login credentials.</Text>

              <View style={s.divider}><View style={s.dividerLine} /></View>

              {/* 1. New Username */}
              <Field icon="person-add-outline"      label="New Username"      value={newUsername} onChangeText={setNewUsername} placeholder="Enter new username" />

              {/* 2. New Password */}
              <Field icon="lock-open-outline"        label="New Password"      value={newPass}     onChangeText={setNewPass}     placeholder="Enter new password"   secureTextEntry={!showNew}     showToggle onToggle={() => setShowNew(!showNew)} />

              {/* 3. Confirm Password */}
              <Field icon="lock-closed-outline"      label="Confirm Password"  value={confirmPass} onChangeText={setConfirmPass} placeholder="Re-enter new password" secureTextEntry={!showConfirm} showToggle onToggle={() => setShowConfirm(!showConfirm)} />

              {/* 4. Full Name */}
              <Field icon="person-outline"           label="Full Name"         value={fullName}    onChangeText={setFullName}    placeholder="Enter your full name" autoCapitalize="words" />

              {/* 5. Email Address */}
              <Field icon="mail-outline"             label="Email Address"     value={email}       onChangeText={setEmail}       placeholder="Enter email address"  keyboardType="email-address" />

              {/* 6. Phone Number */}
              <View style={s.fieldWrap}>
                <View style={s.fieldLabelRow}>
                  <Ionicons name="call-outline" size={16} color={C.purple} />
                  <Text style={s.fieldLabel}>Phone Number</Text>
                </View>
                <View style={s.phoneRow}>
                  <View style={s.dialBox}>
                    <Text style={s.dialFlag}>🇮🇳</Text>
                    <Text style={s.dialCode}>+91</Text>
                  </View>
                  <View style={[s.field, { flex: 1 }]}>
                    <TextInput
                      style={[s.input, { flex: 1 }]}
                      value={phone}
                      onChangeText={setPhone}
                      placeholder="Enter phone number"
                      placeholderTextColor={C.placeholder}
                      keyboardType="phone-pad"
                      maxLength={10}
                    />
                  </View>
                </View>
              </View>

              {/* 7. Role */}
              <Field icon="shield-outline"           label="Role"              value={role}        onChangeText={setRole}        placeholder="Admin" />

              {/* 8. Role Description */}
              <Field icon="document-text-outline"    label="Role Description"  value={roleDesc}    onChangeText={setRoleDesc}    placeholder="Enter role description" autoCapitalize="sentences" />

              {/* Reset Credentials button */}
              <View style={s.btnShadow}>
                <TouchableOpacity style={s.btnOuter} onPress={onReset} disabled={loading} activeOpacity={0.84}>
                  <LinearGradient colors={["#16A34A", "#14532D"]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={s.btnGrad}>
                    <LinearGradient colors={["rgba(255,255,255,0.14)", "rgba(255,255,255,0.00)"]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={s.btnGloss} />
                    <Ionicons name="shield-checkmark-outline" size={18} color={C.white} style={{ marginRight: 8 }} />
                    <Text style={s.btnTxt}>{loading ? "Saving…" : "Reset Credentials"}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>

              {/* Clear All */}
              <TouchableOpacity style={s.clearBtn} onPress={clearAll} activeOpacity={0.75}>
                <Ionicons name="refresh-outline" size={18} color="#DC2626" style={{ marginRight: 8 }} />
                <Text style={s.clearTxt}>Clear All</Text>
              </TouchableOpacity>

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

  header:       { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8 },
  backBtn:      { width: 42, height: 42, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.12)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  headerCenter: { flex: 1, alignItems: "center" },
  headerBrand:  { fontSize: 20, fontWeight: "800", color: C.white },
  headerSub:    { fontSize: 10, color: "rgba(255,255,255,0.90)", letterSpacing: 2, marginTop: 1 },

  hero:       { alignItems: "center", paddingVertical: 14 },
  shieldWrap: { width: 110, height: 110, alignItems: "center", justifyContent: "center" },
  keyOverlay: { position: "absolute", alignItems: "center", justifyContent: "center" },
  keyEmoji:   { fontSize: 42 },

  scroll: { paddingHorizontal: 16, paddingBottom: 32 },

  card: {
    backgroundColor: C.cream, borderRadius: 28,
    paddingHorizontal: 20, paddingTop: 24, paddingBottom: 20,
    overflow: "hidden",
    shadowColor: "#1A0040", shadowOpacity: 0.18, shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 }, elevation: 14,
  },
  cardEdge:     { position: "absolute", top: 0, left: 0, right: 0, height: 5, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 },
  cardTitle:    { fontSize: 24, fontWeight: "800", color: "#0A1F44" },
  cardSub:      { fontSize: 13, color: "#3A5A7A", marginBottom: 14, lineHeight: 18 },
  divider:      { marginBottom: 18 },
  dividerLine:  { height: 1, backgroundColor: "rgba(21,101,192,0.12)" },

  fieldWrap:     { marginBottom: 14 },
  fieldLabelRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 7 },
  fieldLabel:    { fontSize: 13, fontWeight: "700", color: C.label },
  field: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: C.inputBg, borderRadius: 12,
    paddingHorizontal: 14, minHeight: 48,
    borderWidth: 1, borderColor: C.inputBorder,
  },
  input: { fontSize: 14, color: C.inputText, paddingVertical: 12 },

  phoneRow: { flexDirection: "row", gap: 10 },
  dialBox:  { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.inputBg, borderRadius: 12, paddingHorizontal: 12, height: 48, borderWidth: 1, borderColor: C.inputBorder },
  dialFlag: { fontSize: 18 },
  dialCode: { fontSize: 14, fontWeight: "700", color: C.inputText },

  btnShadow: { borderRadius: 16, marginBottom: 12, shadowColor: "#14532D", shadowOpacity: 0.28, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  btnOuter:  { borderRadius: 16, overflow: "hidden" },
  btnGrad:   { height: 54, flexDirection: "row", alignItems: "center", justifyContent: "center", borderRadius: 16, overflow: "hidden" },
  btnGloss:  { position: "absolute", top: 0, left: 0, right: 0, height: 26, borderRadius: 16 },
  btnTxt:    { fontSize: 16, fontWeight: "800", color: C.white, letterSpacing: 0.3 },

  clearBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 15, borderRadius: 16, borderWidth: 2, borderColor: "rgba(220,38,38,0.50)", backgroundColor: "rgba(220,38,38,0.10)" },
  clearTxt: { fontSize: 16, fontWeight: "800", color: "#DC2626", letterSpacing: 0.3 },
});

export default AdminRecoveryScreen;
