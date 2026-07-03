import React, { useEffect, useRef, useState } from "react";
import { Animated, Text, StyleSheet, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

export type ToastType = "success" | "error" | "warning" | "info";

interface ToastProps {
  visible: boolean;
  message: string;
  type?: ToastType;
  onHide: () => void;
  duration?: number;
}

// ── Color map per type ────────────────────────────────────────────────────────
const CONFIG: Record<ToastType, { bg: string; icon: any }> = {
  success: { bg: "rgba(16,185,129,0.95)",  icon: "checkmark-circle" },   // 🟢 green  — data saved/submitted
  error:   { bg: "rgba(239,68,68,0.95)",   icon: "close-circle"     },   // 🔴 red    — failed/error
  warning: { bg: "rgba(245,158,11,0.95)",  icon: "warning"          },   // 🟡 amber  — validation/required
  info:    { bg: "rgba(56,189,248,0.95)",  icon: "information-circle"},   // 🔵 blue   — info/permission
};

export const Toast = ({ visible, message, type = "success", onHide, duration = 3000 }: ToastProps) => {
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(40)).current;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!visible) return;
    Animated.parallel([
      Animated.timing(opacity,     { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.spring(translateY,  { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity,    { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 40, duration: 250, useNativeDriver: true }),
      ]).start(onHide);
    }, duration);

    return () => clearTimeout(timer);
  }, [visible]);

  if (!visible) return null;

  const { bg, icon } = CONFIG[type];

  // compute bottom offset: safe-area inset + nav height (70) + margin
  const NAV_HEIGHT = 70;
  const MARGIN = 16;
  const bottomOffset = (insets.bottom || 0) + NAV_HEIGHT + MARGIN;

  return (
    <Animated.View style={[styles.toast, { backgroundColor: bg, opacity, transform: [{ translateY }], bottom: bottomOffset }]}>
      <Ionicons name={icon} size={22} color="#fff" />
      <Text style={styles.msg}>{message}</Text>
    </Animated.View>
  );
};

// ── useToast hook ─────────────────────────────────────────────────────────────
export const useToast = () => {
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: ToastType }>({
    visible: false, message: "", type: "success",
  });

  const showToast = React.useCallback((message: string, type: ToastType = "success") =>
    setToast({ visible: true, message, type }), []);

  const hideToast = React.useCallback(() => setToast(t => ({ ...t, visible: false })), []);

  return { toast, showToast, hideToast };
};

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    left: 20,
    right: 20,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
    zIndex: 9999,
  },
  msg: { flex: 1, fontSize: 14, fontWeight: "600", color: "#fff", lineHeight: 20 },
});
