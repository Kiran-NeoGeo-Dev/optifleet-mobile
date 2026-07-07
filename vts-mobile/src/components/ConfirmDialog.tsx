import React from "react";
import { View, Text, TouchableOpacity, Modal, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "./ScreenBg";

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: string;
  icon?: any;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog = ({
  visible, title, message,
  confirmText = "Confirm", cancelText = "Cancel",
  confirmColor = COLORS.red, icon = "warning-outline",
  onConfirm, onCancel,
}: ConfirmDialogProps) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
    <View style={styles.overlay}>
      <View style={styles.box}>
        <View style={[styles.iconWrap, { backgroundColor: confirmColor + "22" }]}>
          <Ionicons name={icon} size={28} color={confirmColor} />
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
        <View style={styles.btnRow}>
          <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} activeOpacity={0.8}>
            <Text style={styles.cancelTxt}>{cancelText}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: confirmColor }]} onPress={onConfirm} activeOpacity={0.8}>
            <Text style={styles.confirmTxt}>{confirmText}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", paddingHorizontal: 32 },
  box:        { backgroundColor: COLORS.cardBg, borderRadius: 16, padding: 18, width: "100%", alignItems: "center", borderWidth: 1, borderColor: COLORS.cardBorder },
  iconWrap:   { width: 44, height: 44, borderRadius: 13, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  title:      { fontSize: 15, fontWeight: "800", color: COLORS.white, marginBottom: 5, textAlign: "center" },
  message:    { fontSize: 12, color: COLORS.whiteMuted, textAlign: "center", lineHeight: 18, marginBottom: 16 },
  btnRow:     { flexDirection: "row", gap: 8, width: "100%" },
  cancelBtn:  { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: COLORS.glass, borderWidth: 1, borderColor: COLORS.glassBorder, alignItems: "center" },
  cancelTxt:  { fontSize: 13, fontWeight: "700", color: COLORS.whiteMuted },
  confirmBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center" },
  confirmTxt: { fontSize: 13, fontWeight: "800", color: COLORS.white },
});
