import { useCallback, useRef, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  StatusBar, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";
import { fetchNotifications, markAllNotificationsRead, clearAllNotifications } from "../../services/notificationService";
import type { AlertNotification } from "../../hooks/useAlertNotifications";

const ALERT_ICON: Record<string, string> = {
  SMOKING:         "🚭",
  MOBILE_USAGE:    "📱",
  DROWSINESS:      "😴",
  OVERSPEED:       "🚨",
  ROUTE_DEVIATION: "📍",
};

const SEVERITY_COLOR: Record<string, string> = {
  OVERSPEED:       "#EF4444",
  SMOKING:         "#EF4444",
  MOBILE_USAGE:    "#F59E0B",
  ROUTE_DEVIATION: "#F59E0B",
  DROWSINESS:      "#3B82F6",
};

interface Props { navigation: any; }

const NotificationsScreen = ({ navigation }: Props) => {
  const [items,   setItems]   = useState<AlertNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const readKeysRef = useRef<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const data = await fetchNotifications(readKeysRef.current);
      setItems(data);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]));

  const markAllRead = async () => {
    try {
      await markAllNotificationsRead();
      items.forEach(n => readKeysRef.current.add(n.id));
      setItems(prev => prev.map(n => ({ ...n, read: true })));
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  };

  const clearAll = async () => {
    try {
      await clearAllNotifications();
      items.forEach(n => readKeysRef.current.add(n.id));
      setItems([]);
    } catch (error) {
      console.error("Failed to clear notifications:", error);
    }
  };

  const unread = items.filter(n => !n.read).length;

  const renderItem = ({ item }: { item: AlertNotification }) => {
    const key   = item.label?.toUpperCase?.() || "";
    const emoji = ALERT_ICON[key] || "🔔";
    const color = SEVERITY_COLOR[key] || "#94A3B8";
    return (
      <TouchableOpacity
        style={[s.card, !item.read && s.cardUnread]}
        onPress={() => { readKeysRef.current.add(item.id); setItems(prev => prev.map(n => n.id === item.id ? { ...n, read: true } : n)); }}
        activeOpacity={0.85}
      >
        {!item.read && <View style={[s.unreadDot, { backgroundColor: color }]} />}
        <View style={[s.leftBar, { backgroundColor: color }]} />
        <View style={[s.iconBox, { backgroundColor: color + "18" }]}>
          <Text style={{ fontSize: 22 }}>{emoji}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={s.cardTop}>
            <Text style={s.cardTitle}>{item.label}</Text>
            <Text style={s.cardTime}>{item.time}</Text>
          </View>
          <Text style={s.cardVehicle}>{item.vehicle} · {item.driver}</Text>
          <Text style={s.cardDetail} numberOfLines={1}>{item.detail}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
      </TouchableOpacity>
    );
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="#0A1F44" />
      <LinearGradient
        colors={["#0A1F44", "#0D3B8E", "#1565C0"]}
        locations={[0, 0.45, 1]}
        start={{ x: 0.15, y: 0 }} end={{ x: 0.85, y: 1 }}
        style={s.headerBg}
      />
      <SafeAreaView style={s.safe} edges={["top"]}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={s.headerCenter}>
            <Text style={s.headerTitle}>Notifications</Text>
            {unread > 0 && (
              <View style={s.badge}>
                <Text style={s.badgeTxt}>{unread > 99 ? "99+" : unread}</Text>
              </View>
            )}
          </View>
          <View style={s.headerActions}>
            {items.length > 0 && (
              <>
                <TouchableOpacity onPress={markAllRead}>
                  <Text style={s.actionTxt}>Mark all read</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={clearAll}>
                  <Text style={[s.actionTxt, { color: "#F87171" }]}>Clear</Text>
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity style={s.filterBtn}>
              <Ionicons name="options-outline" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* List */}
        {loading ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color="#fff" />
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            contentContainerStyle={s.list}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={s.empty}>
                <Ionicons name="notifications-off-outline" size={48} color="rgba(255,255,255,0.3)" />
                <Text style={s.emptyTxt}>No notifications yet</Text>
              </View>
            }
          />
        )}
      </SafeAreaView>
    </View>
  );
};

const s = StyleSheet.create({
  root:          { flex: 1, backgroundColor: "#F0F4FF" },
  headerBg:      { position: "absolute", top: 0, left: 0, right: 0, height: 130 },
  safe:          { flex: 1 },
  header:        { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16, gap: 10 },
  backBtn:       { width: 38, height: 38, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  headerCenter:  { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  headerTitle:   { fontSize: 20, fontWeight: "800", color: "#fff" },
  badge:         { backgroundColor: "#EF4444", borderRadius: 10, minWidth: 22, height: 22, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 },
  badgeTxt:      { fontSize: 11, fontWeight: "800", color: "#fff" },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  actionTxt:     { fontSize: 12, fontWeight: "700", color: "#38BDF8" },
  filterBtn:     { width: 34, height: 34, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  list:          { paddingHorizontal: 14, paddingTop: 8, paddingBottom: 30 },
  card:          { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 16, marginBottom: 10, padding: 14, gap: 12, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardUnread:    { backgroundColor: "#F8FAFF" },
  unreadDot:     { position: "absolute", left: 6, top: "50%", width: 8, height: 8, borderRadius: 4, marginTop: -4 },
  leftBar:       { width: 3, height: 44, borderRadius: 2 },
  iconBox:       { width: 46, height: 46, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  cardTop:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 3 },
  cardTitle:     { fontSize: 14, fontWeight: "800", color: "#0D1B3E" },
  cardTime:      { fontSize: 12, color: "#1565C0", fontWeight: "600" },
  cardVehicle:   { fontSize: 12, color: "#374151", fontWeight: "600", marginBottom: 2 },
  cardDetail:    { fontSize: 11, color: "#6B7280" },
  center:        { flex: 1, alignItems: "center", justifyContent: "center" },
  empty:         { alignItems: "center", paddingTop: 80, gap: 12 },
  emptyTxt:      { fontSize: 15, color: "rgba(255,255,255,0.5)", fontWeight: "600" },
});

export default NotificationsScreen;
