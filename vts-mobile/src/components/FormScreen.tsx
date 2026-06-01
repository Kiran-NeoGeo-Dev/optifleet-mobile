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
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.glass, borderWidth: 1, borderColor: COLORS.glassBorder, alignItems: "center", justifyContent: "center" },
  headerText: { flex: 1, alignItems: "center" },
  headerTitle: { fontSize: 18, fontWeight: "800", color: COLORS.white },
  headerSub: { fontSize: 12, color: COLORS.whiteMuted, marginTop: 2 },
  scroll: { padding: 16, paddingBottom: 40 },
  card: { backgroundColor: COLORS.cardBg, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: COLORS.cardBorder },
});

const fieldStyles = StyleSheet.create({
  group: { marginBottom: 18 },
  labelRow: { flexDirection: "row", alignItems: "center", marginBottom: 8, gap: 6 },
  iconWrap: { width: 24, height: 24, borderRadius: 7, backgroundColor: COLORS.accentGlow, alignItems: "center", justifyContent: "center" },
  label: { fontSize: 12, fontWeight: "700", color: COLORS.whiteMuted, textTransform: "uppercase", letterSpacing: 0.4 },
  submitBtn: { borderRadius: 12, paddingVertical: 14, alignItems: "center", justifyContent: "center", marginTop: 8 },
  submitText: { fontSize: 16, fontWeight: "800", color: COLORS.white, letterSpacing: 0.3 },
});
