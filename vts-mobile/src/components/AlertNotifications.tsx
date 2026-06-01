import { useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  ScrollView, Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { AlertNotification } from "../hooks/useAlertNotifications";

// ── Toast card (top-right, auto-dismiss) ─────────────────────────────────────
const ToastCard = ({ alert, onDismiss }: { alert: AlertNotification; onDismiss: (id: string) => void }) => {
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(80)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 260, useNativeDriver: true }),
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[styles.toast, { borderLeftColor: alert.color, opacity, transform: [{ translateX }] }]}>
      <View style={styles.toastHeader}>
        <Text style={styles.toastEmoji}>{alert.emoji}</Text>
        <Text style={[styles.toastLabel, { color: alert.color }]}>{alert.label}</Text>
        <TouchableOpacity onPress={() => onDismiss(alert.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.toastClose}>✕</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.toastLine}>🚛 <Text style={styles.bold}>{alert.vehicle}</Text></Text>
      <Text style={styles.toastLine}>👤 {alert.driver}</Text>
      <Text style={styles.toastLine}>📶 {alert.status}</Text>
      <Text style={[styles.toastLine, { color: alert.color, fontWeight: "700" }]}>{alert.detail}</Text>
    </Animated.View>
  );
};

// ── Bell button with badge ────────────────────────────────────────────────────
export const BellButton = ({
  unreadCount,
  onPress,
}: {
  unreadCount: number;
  onPress: () => void;
}) => (
  <TouchableOpacity style={styles.bellBtn} onPress={onPress} activeOpacity={0.75}>
    <Ionicons name="notifications-outline" size={22} color="#fff" />
    {unreadCount > 0 && (
      <View style={styles.badge}>
        <Text style={styles.badgeTxt}>{unreadCount > 99 ? "99+" : unreadCount}</Text>
      </View>
    )}
  </TouchableOpacity>
);

// ── Notification Panel (full modal) ──────────────────────────────────────────
export const NotificationPanel = ({
  visible,
  history,
  onClose,
  onMarkAllRead,
  onClearAll,
}: {
  visible:      boolean;
  history:      AlertNotification[];
  onClose:      () => void;
  onMarkAllRead: () => void;
  onClearAll:   () => void;
}) => (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <View style={styles.panelOverlay}>
      <View style={styles.panel}>
        {/* Panel header */}
        <View style={styles.panelHeader}>
          <View style={styles.panelHeaderLeft}>
            <Ionicons name="notifications" size={20} color="#38BDF8" />
            <Text style={styles.panelTitle}>Notifications</Text>
            {history.length > 0 && (
              <View style={styles.panelBadge}>
                <Text style={styles.panelBadgeTxt}>{history.length}</Text>
              </View>
            )}
          </View>
          <View style={styles.panelActions}>
            {history.length > 0 && (
              <>
                <TouchableOpacity onPress={onMarkAllRead} style={styles.panelActionBtn}>
                  <Text style={styles.panelActionTxt}>Mark all read</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={onClearAll} style={styles.panelActionBtn}>
                  <Text style={[styles.panelActionTxt, { color: "#F87171" }]}>Clear</Text>
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
          </View>
        </View>

        {/* List */}
        {history.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="notifications-off-outline" size={40} color="rgba(255,255,255,0.2)" />
            <Text style={styles.emptyTxt}>No notifications yet</Text>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
            {history.map(item => (
              <View
                key={item.id}
                style={[styles.historyItem, !item.read && styles.historyItemUnread]}
              >
                <View style={[styles.historyDot, { backgroundColor: item.color }]} />
                <View style={{ flex: 1 }}>
                  <View style={styles.historyTop}>
                    <Text style={styles.historyEmoji}>{item.emoji}</Text>
                    <Text style={[styles.historyLabel, { color: item.color }]}>{item.label}</Text>
                    <Text style={styles.historyTime}>{item.time}</Text>
                  </View>
                  <Text style={styles.historyVehicle}>{item.vehicle} · {item.driver}</Text>
                  <Text style={styles.historyDetail}>{item.detail}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </View>
  </Modal>
);

// ── Main export: Toasts overlay + Bell + Panel ────────────────────────────────
interface Props {
  toasts:         AlertNotification[];
  bellHistory:    AlertNotification[];
  unreadCount:    number;
  onDismissToast: (id: string) => void;
  onMarkAllRead:  () => void;
  onClearAll:     () => void;
  topOffset?:     number;
  hideBell?:      boolean;
  panelOpen?:     boolean;
  onPanelClose?:  () => void;
}

const AlertNotifications = ({
  toasts, bellHistory, unreadCount,
  onDismissToast, onMarkAllRead, onClearAll,
  topOffset = 56, hideBell = false,
  panelOpen: externalPanelOpen, onPanelClose,
}: Props) => {
  const [internalPanelOpen, setInternalPanelOpen] = useState(false);
  const panelOpen = externalPanelOpen ?? internalPanelOpen;

  const openPanel  = () => { setInternalPanelOpen(true);  onMarkAllRead(); };
  const closePanel = () => { setInternalPanelOpen(false); onPanelClose?.(); };

  return (
    <>
      {/* Floating toast cards — top right */}
      {toasts.length > 0 && (
        <View style={[styles.toastsContainer, { top: topOffset + 52 }]} pointerEvents="box-none">
          {toasts.map(a => (
            <ToastCard key={a.id} alert={a} onDismiss={onDismissToast} />
          ))}
        </View>
      )}

      {/* Floating bell — hidden when screen has its own inline bell */}
      {!hideBell && (
        <View style={[styles.bellContainer, { top: topOffset }]} pointerEvents="box-none">
          <BellButton unreadCount={unreadCount} onPress={openPanel} />
        </View>
      )}

      {/* Notification panel */}
      <NotificationPanel
        visible={panelOpen}
        history={bellHistory}
        onClose={closePanel}
        onMarkAllRead={onMarkAllRead}
        onClearAll={onClearAll}
      />
    </>
  );
};

const styles = StyleSheet.create({
  // Toasts
  toastsContainer: { position: "absolute", top: 108, right: 12, zIndex: 9998, gap: 8, maxWidth: 250 },
  toast:           { backgroundColor: "rgba(8,16,32,0.94)", borderRadius: 14, padding: 12, borderLeftWidth: 3, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", gap: 4 },
  toastHeader:     { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 3 },
  toastEmoji:      { fontSize: 15 },
  toastLabel:      { flex: 1, fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  toastClose:      { fontSize: 12, color: "rgba(255,255,255,0.4)", fontWeight: "700" },
  toastLine:       { fontSize: 11, color: "rgba(255,255,255,0.75)", lineHeight: 16 },
  bold:            { fontWeight: "700", color: "#fff" },

  // Bell
  bellContainer: { position: "absolute", top: 56, right: 12, zIndex: 9999 },
  bellBtn:       { width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(8,16,32,0.88)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  badge:         { position: "absolute", top: -6, right: -6, backgroundColor: "#EF4444", borderRadius: 10, minWidth: 20, height: 20, alignItems: "center", justifyContent: "center", paddingHorizontal: 4, borderWidth: 2, borderColor: "#0A1428" },
  badgeTxt:      { fontSize: 10, fontWeight: "800", color: "#fff", lineHeight: 14 },

  // Panel
  panelOverlay:     { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  panel:            { backgroundColor: "#0D1A2C", borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "75%", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  panelHeader:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)" },
  panelHeaderLeft:  { flexDirection: "row", alignItems: "center", gap: 8 },
  panelTitle:       { fontSize: 17, fontWeight: "800", color: "#fff" },
  panelBadge:       { backgroundColor: "#EF4444", borderRadius: 10, minWidth: 20, height: 20, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  panelBadgeTxt:    { fontSize: 10, fontWeight: "800", color: "#fff" },
  panelActions:     { flexDirection: "row", alignItems: "center", gap: 12 },
  panelActionBtn:   { paddingVertical: 4 },
  panelActionTxt:   { fontSize: 12, color: "#38BDF8", fontWeight: "700" },
  emptyBox:         { alignItems: "center", paddingVertical: 48, gap: 12 },
  emptyTxt:         { fontSize: 14, color: "rgba(255,255,255,0.35)", fontWeight: "600" },

  // History items
  historyItem:       { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(255,255,255,0.06)", gap: 12 },
  historyItemUnread: { backgroundColor: "rgba(56,189,248,0.05)" },
  historyDot:        { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  historyTop:        { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 3 },
  historyEmoji:      { fontSize: 14 },
  historyLabel:      { fontSize: 12, fontWeight: "800", flex: 1 },
  historyTime:       { fontSize: 10, color: "rgba(255,255,255,0.35)", fontWeight: "600" },
  historyVehicle:    { fontSize: 12, color: "#fff", fontWeight: "700", marginBottom: 2 },
  historyDetail:     { fontSize: 11, color: "rgba(255,255,255,0.55)" },
});

export default AlertNotifications;
