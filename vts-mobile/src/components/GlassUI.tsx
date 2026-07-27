import React from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, StatusBar, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS, SHADOWS } from "./ScreenBg";

// Design tokens for warm + blue theme
const W = {
  inputBg:      "#F0F4FF",
  inputBorder:  "#BFDBFE",
  inputText:    "#10204A",
  placeholder:  "#5F6F8F",
  label:        "rgba(255,255,255,0.80)",
  cardBg:       "#FFFFFF",
  cardBorder:   "rgba(0,0,0,0.06)",
  accent:       "#1565C0",
  white:        "#FFFFFF",
};

// ─── Page Header ──────────────────────────────────────────────────────────────
export const PageHeader = ({ title, subtitle, onBack }: { title: string; subtitle?: string; onBack: () => void }) => (
  <View style={hStyles.row}>
    <TouchableOpacity style={hStyles.backBtn} onPress={onBack} activeOpacity={0.75}>
      <Ionicons name="chevron-back" size={22} color="#fff" />
    </TouchableOpacity>
    <View style={hStyles.center}>
      <Text style={hStyles.title}>{title}</Text>
      {subtitle ? <Text style={hStyles.sub}>{subtitle}</Text> : null}
    </View>
    <View style={{ width: 42 }} />
  </View>
);

const hStyles = StyleSheet.create({
  row:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingTop: 10, paddingBottom: 8 },
  backBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.12)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  center:  { flex: 1, alignItems: "center" },
  title:   { fontSize: 17, fontWeight: "800", color: "#fff", letterSpacing: 0.2 },
  sub:     { fontSize: 11, color: "rgba(255,255,255,0.65)", marginTop: 2 },
});

// ─── Glass Field ──────────────────────────────────────────────────────────────
export const GlassField = ({
  icon, label, value, onChangeText, placeholder, keyboardType, autoCapitalize, autoCorrect, secureTextEntry, multiline, maxLength, error, noMargin,
}: {
  icon: any; label: string; value: string; onChangeText: (t: string) => void;
  placeholder?: string; keyboardType?: any; autoCapitalize?: any; autoCorrect?: boolean; secureTextEntry?: boolean;
  multiline?: boolean; maxLength?: number; error?: string; noMargin?: boolean;
}) => (
  <View style={[fStyles.wrap, noMargin && { marginBottom: 0 }]}>
    {!!label && (
      <View style={fStyles.labelRow}>
        <Ionicons name={icon} size={14} color="#1565C0" />
        <Text style={fStyles.label}>{label}</Text>
      </View>
    )}
    <TextInput
      style={[fStyles.input, multiline && fStyles.multiline, error && fStyles.inputError]}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={W.placeholder}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize ?? "none"}
      autoCorrect={autoCorrect}
      secureTextEntry={secureTextEntry}
      multiline={multiline}
      maxLength={maxLength}
      textAlignVertical={multiline ? "top" : "center"}
    />
    {error ? <Text style={fStyles.error}><Ionicons name="alert-circle-outline" size={11} /> {error}</Text> : null}
  </View>
);

// ─── Glass Date Picker Row ────────────────────────────────────────────────────
export const GlassDateField = ({ icon, label, value, onPress }: { icon: any; label: string; value: string | null; onPress: () => void }) => (
  <View style={fStyles.wrap}>
    <View style={fStyles.labelRow}>
      <Ionicons name={icon} size={14} color="#1565C0" />
      <Text style={fStyles.label}>{label}</Text>
    </View>
    <TouchableOpacity style={fStyles.input} onPress={onPress} activeOpacity={0.7}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ color: value ? W.inputText : W.placeholder, fontSize: 14 }}>
          {value ?? "DD / MM / YYYY"}
        </Text>
        <Ionicons name="calendar-outline" size={16} color={W.accent} />
      </View>
    </TouchableOpacity>
  </View>
);

// ─── Toggle Pair (Active / Inactive) ─────────────────────────────────────────
export const GlassToggle = ({ value, onChange }: { value: "ACTIVE" | "INACTIVE"; onChange: (v: "ACTIVE" | "INACTIVE") => void }) => (
  <View style={tStyles.row}>
    <TouchableOpacity style={[tStyles.btn, value === "ACTIVE" && tStyles.activeOn]} onPress={() => onChange("ACTIVE")}>
      <Ionicons name="checkmark-circle" size={15} color={value === "ACTIVE" ? "#22C55E" : "#9CA3AF"} />
      <Text style={[tStyles.txt, value === "ACTIVE" && { color: "#16A34A" }]}>Active</Text>
    </TouchableOpacity>
    <TouchableOpacity style={[tStyles.btn, value === "INACTIVE" && tStyles.inactiveOn]} onPress={() => onChange("INACTIVE")}>
      <Ionicons name="close-circle" size={15} color={value === "INACTIVE" ? "#EF4444" : "#9CA3AF"} />
      <Text style={[tStyles.txt, value === "INACTIVE" && { color: "#DC2626" }]}>Inactive</Text>
    </TouchableOpacity>
  </View>
);

const tStyles = StyleSheet.create({
  row:        { flexDirection: "row", gap: 10 },
  btn:        { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: 10, backgroundColor: "#F3F4F6", borderWidth: 1.5, borderColor: "#D1D5DB" },
  activeOn:   { backgroundColor: "#DCFCE7", borderColor: "#22C55E" },
  inactiveOn: { backgroundColor: "#FEE2E2", borderColor: "#EF4444" },
  txt:        { fontSize: 14, fontWeight: "700", color: "#6B7280" },
});

// ─── Fuel Type Selector ───────────────────────────────────────────────────────
const FUELS = ["Petrol", "Diesel", "CNG", "Electric"];
export const FuelSelector = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
  <View style={fuStyles.row}>
    {FUELS.map(f => (
      <TouchableOpacity key={f} style={[fuStyles.btn, value === f && fuStyles.active]} onPress={() => onChange(f)}>
        <Text style={[fuStyles.txt, value === f && { color: COLORS.accent, fontWeight: "800" }]}>{f}</Text>
      </TouchableOpacity>
    ))}
  </View>
);

const fuStyles = StyleSheet.create({
  row:    { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  btn:    { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, backgroundColor: "#F3F4F6", borderWidth: 1.5, borderColor: "rgba(0,0,0,0.10)", minHeight: 44, alignItems: "center", justifyContent: "center" },
  active: { backgroundColor: "rgba(21,101,192,0.12)", borderColor: "rgba(21,101,192,0.40)" },
  txt:    { fontSize: 13, fontWeight: "600", color: "#6B7280" },
});

// ─── Primary Button ───────────────────────────────────────────────────────────
export const GlassButton = ({ label, onPress, loading, color, icon }: { label: string; onPress: () => void; loading?: boolean; color?: string; icon?: any }) => (
  <TouchableOpacity
    style={[bStyles.btn, { backgroundColor: color ?? "#1565C0" }, loading && { opacity: 0.75 }]}
    onPress={onPress}
    disabled={loading}
    activeOpacity={0.82}
  >
    {loading
      ? <ActivityIndicator color="#fff" size="small" />
      : (
        <>
          {icon && <Ionicons name={icon} size={18} color="#fff" style={{ marginRight: 8 }} />}
          <Text style={bStyles.txt}>{label}</Text>
        </>
      )
    }
  </TouchableOpacity>
);

const bStyles = StyleSheet.create({
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", borderRadius: 11, paddingVertical: 11, marginTop: 4 },
  txt: { fontSize: 14, fontWeight: "800", color: COLORS.white, letterSpacing: 0.3 },
});

// ─── Form Screen Wrapper ──────────────────────────────────────────────────────
export const FormScreen = ({ title, subtitle, onBack, children, toast }: { title: string; subtitle?: string; onBack: () => void; children: React.ReactNode; toast?: React.ReactNode }) => (
  <View style={{ flex: 1 }}>
    <StatusBar barStyle="light-content" backgroundColor="#0A1F44" />
    <LinearGradient
      colors={["#0A1F44", "#0D3B8E", "#1565C0"]}
      locations={[0, 0.5, 1]}
      start={{ x: 0.15, y: 0 }} end={{ x: 0.85, y: 1 }}
      style={StyleSheet.absoluteFill}
    />
    <SafeAreaView style={{ flex: 1 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <PageHeader title={title} subtitle={subtitle} onBack={onBack} />
        <ScrollView contentContainerStyle={fsStyles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
    {toast}
  </View>
);

// ─── Section Card ─────────────────────────────────────────────────────────────
export const GlassCard = ({ children, style }: { children: React.ReactNode; style?: any }) => (
  <View style={[cStyles.card, style]}>{children}</View>
);

export const FieldLabel = ({ icon, label }: { icon: any; label: string }) => (
  <View style={fStyles.labelRow}>
    <Ionicons name={icon} size={14} color="#1565C0" />
    <Text style={fStyles.label}>{label}</Text>
  </View>
);

const fsStyles = StyleSheet.create({
  scroll: { paddingHorizontal: 16, paddingBottom: 48 },
});

const cStyles = StyleSheet.create({
  card: { backgroundColor: W.cardBg, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: W.cardBorder, marginBottom: 10, shadowColor: "#000", shadowOpacity: 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
});

const fStyles = StyleSheet.create({
  wrap:       { marginBottom: 12 },
  labelRow:   { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 5 },
  label:      { fontSize: 12, fontWeight: "700", color: "#1A2F5C", textTransform: "uppercase", letterSpacing: 0.7 },
  input:      { backgroundColor: W.inputBg, borderRadius: 10, borderWidth: 1.5, borderColor: W.inputBorder, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, color: W.inputText, minHeight: 46 },
  inputError: { borderColor: "rgba(239,68,68,0.60)" },
  multiline:  { height: 100, textAlignVertical: "top" },
  error:      { fontSize: 12, color: "#EF4444", marginTop: 5, marginLeft: 2 },
});
