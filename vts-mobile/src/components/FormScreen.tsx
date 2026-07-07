import React from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ScreenBg, COLORS, SHADOWS } from "./ScreenBg";

interface FormScreenProps {
  title: string;
  subtitle?: string;
  onBack: () => void;
  children: React.ReactNode;
}

export const FormScreen = ({ title, subtitle, onBack, children }: FormScreenProps) => (
  <ScreenBg overlay="dark">
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Ionicons name="chevron-back" size={22} color={COLORS.white} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>{title}</Text>
          {subtitle ? <Text style={styles.headerSub}>{subtitle}</Text> : null}
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.card, SHADOWS.card]}>
          {children}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  </ScreenBg>
);

// Shared field components
export const FieldGroup = ({ children }: { children: React.ReactNode }) => (
  <View style={fieldStyles.group}>{children}</View>
);

export const FieldLabel = ({ icon, label }: { icon: any; label: string }) => (
  <View style={fieldStyles.labelRow}>
    <View style={fieldStyles.iconWrap}>
      <Ionicons name={icon} size={13} color={COLORS.accent} />
    </View>
    <Text style={fieldStyles.label}>{label}</Text>
  </View>
);

export const SubmitButton = ({ label, onPress, loading, color }: { label: string; onPress: () => void; loading?: boolean; color?: string }) => (
  <TouchableOpacity
    style={[fieldStyles.submitBtn, { backgroundColor: color ?? COLORS.accent }, loading && { opacity: 0.7 }, SHADOWS.btn]}
    onPress={onPress}
    disabled={loading}
    activeOpacity={0.85}
  >
    <Text style={fieldStyles.submitText}>{loading ? "Please wait..." : label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 10 },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.glass, borderWidth: 1, borderColor: COLORS.glassBorder, alignItems: "center", justifyContent: "center" },
  headerText: { flex: 1, alignItems: "center" },
  headerTitle: { fontSize: 16, fontWeight: "800", color: COLORS.white },
  headerSub: { fontSize: 11, color: COLORS.whiteMuted, marginTop: 1 },
  scroll: { padding: 14, paddingBottom: 36 },
  card: { backgroundColor: COLORS.cardBg, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: COLORS.cardBorder },
});

const fieldStyles = StyleSheet.create({
  group: { marginBottom: 14 },
  labelRow: { flexDirection: "row", alignItems: "center", marginBottom: 6, gap: 5 },
  iconWrap: { width: 22, height: 22, borderRadius: 6, backgroundColor: COLORS.accentGlow, alignItems: "center", justifyContent: "center" },
  label: { fontSize: 11, fontWeight: "700", color: COLORS.whiteMuted, textTransform: "uppercase", letterSpacing: 0.4 },
  submitBtn: { borderRadius: 11, paddingVertical: 12, alignItems: "center", justifyContent: "center", marginTop: 6 },
  submitText: { fontSize: 15, fontWeight: "800", color: COLORS.white, letterSpacing: 0.3 },
});
