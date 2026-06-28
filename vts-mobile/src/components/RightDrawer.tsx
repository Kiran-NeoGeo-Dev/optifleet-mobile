import { useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  Dimensions, Modal, ScrollView, Linking, PanResponder, Platform, StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { ConfirmDialog } from "./ConfirmDialog";
import { useAuth } from "../hooks/useAuth";

const { width: SW } = Dimensions.get("window");
const DRAWER_W = SW * 0.72;

const C = {
  bgDark:  "#0A1F44",
  bgMid:   "#0D3B8E",
  blue:    "#1565C0",
  white:   "#FFFFFF",
  text:    "#0D1B3E",
  muted:   "#6B7280",
  red:     "#EF4444",
  green:   "#16A34A",
  divider: "rgba(13,27,62,0.08)",
};

interface Props {
  visible:     boolean;
  onClose:     () => void;
  onMyProfile: () => void;
}

// ── Full-screen info page (always mounted, controlled by visible prop) ────────
const InfoPage = ({
  visible, title, subtitle, icon, onClose, children,
}: {
  visible: boolean; title: string; subtitle: string;
  icon: any; onClose: () => void; children: React.ReactNode;
}) => (
  <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
    <View style={{ flex: 1, backgroundColor: "#F0F4FF" }}>
      {/* Curved blue header — same as AdminProfileScreen / ClientDetailsScreen */}
      <View style={ip.headerBg}>
        <LinearGradient
          colors={[C.bgDark, C.bgMid, C.blue]}
          locations={[0, 0.45, 1]}
          start={{ x: 0.15, y: 0 }} end={{ x: 0.85, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        {/* Nav row */}
        <View style={ip.navRow}>
          <TouchableOpacity style={ip.backBtn} onPress={onClose} activeOpacity={0.8}>
            <Ionicons name="chevron-back" size={22} color={C.white} />
          </TouchableOpacity>
          <Text style={ip.navTitle}>{title}</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Hero */}
        <View style={ip.hero}>
          <View style={ip.heroIconRing}>
            <Ionicons name={icon} size={30} color={C.white} />
          </View>
          <Text style={ip.heroTitle}>{title}</Text>
          <Text style={ip.heroSub}>{subtitle}</Text>
        </View>

        {/* White card — overlaps header bottom */}
        <ScrollView contentContainerStyle={ip.scroll} showsVerticalScrollIndicator={false}>
          <View style={ip.card}>
            {children}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  </Modal>
);

// ── Section divider ───────────────────────────────────────────────────────────
const Sect = ({ label }: { label: string }) => (
  <View style={ip.sectWrap}>
    <Text style={ip.sectTxt}>{label}</Text>
    <View style={ip.sectLine} />
  </View>
);

// ── Contact row ───────────────────────────────────────────────────────────────
const CRow = ({
  icon, iconBg, iconColor, label, value, onPress,
}: {
  icon: any; iconBg: string; iconColor: string;
  label: string; value: string; onPress?: () => void;
}) => (
  <TouchableOpacity
    style={ip.cRow}
    onPress={onPress}
    activeOpacity={onPress ? 0.75 : 1}
    disabled={!onPress}
  >
    <View style={[ip.cIcon, { backgroundColor: iconBg }]}>
      <Ionicons name={icon} size={18} color={iconColor} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={ip.cLabel}>{label}</Text>
      <Text style={[ip.cValue, onPress && { color: C.blue }]}>{value}</Text>
    </View>
    {onPress && <Ionicons name="open-outline" size={14} color={C.muted} />}
  </TouchableOpacity>
);

// ── Drawer menu item ──────────────────────────────────────────────────────────
const Item = ({
  icon, iconBg, iconColor, label, labelColor, onPress, last,
}: {
  icon: any; iconBg: string; iconColor: string;
  label: string; labelColor?: string; onPress: () => void; last?: boolean;
}) => (
  <>
    <TouchableOpacity style={d.item} onPress={onPress} activeOpacity={0.72}>
      <View style={[d.itemIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <Text style={[d.itemLabel, labelColor ? { color: labelColor } : {}]}>{label}</Text>
      {!labelColor && <Ionicons name="chevron-forward" size={18} color="#1565C0" />}
    </TouchableOpacity>
    {!last && <View style={d.sep} />}
  </>
);

// ── Main RightDrawer ──────────────────────────────────────────────────────────
const RightDrawer = ({ visible, onClose, onMyProfile }: Props) => {
  const { logout } = useAuth();
  const slideX     = useRef(new Animated.Value(DRAWER_W)).current;
  const bgOpacity  = useRef(new Animated.Value(0)).current;

  // Info page states — live outside the visible gate so Modals stay mounted
  const [logoutDialog,   setLogoutDialog]   = useState(false);
  const [aboutVisible,   setAboutVisible]   = useState(false);
  const [contactVisible, setContactVisible] = useState(false);
  const [privacyVisible, setPrivacyVisible] = useState(false);

  // Swipe-right-to-close
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dx > 12 && Math.abs(g.dy) < 60,
      onPanResponderMove:  (_, g) => { if (g.dx > 0) slideX.setValue(g.dx); },
      onPanResponderRelease: (_, g) => {
        if (g.dx > DRAWER_W * 0.30) { onClose(); }
        else Animated.spring(slideX, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }).start();
      },
    })
  ).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideX,    { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }),
        Animated.timing(bgOpacity, { toValue: 1, duration: 240, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideX,    { toValue: DRAWER_W, duration: 220, useNativeDriver: true }),
        Animated.timing(bgOpacity, { toValue: 0,        duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const doLogout = () => { setLogoutDialog(false); setTimeout(logout, 300); };

  const runAfterDrawerPress = (action: () => void) => {
    onClose();
    requestAnimationFrame(action);
  };

  const openPage = (setter: (v: boolean) => void) => {
    runAfterDrawerPress(() => setter(true));
  };

  return (
    <>
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">

        {/* ── Dim overlay ── */}
        {visible && (
          <Animated.View style={[d.overlay, { opacity: bgOpacity }]} pointerEvents="auto">
            <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
          </Animated.View>
        )}

        {/* ── Drawer panel ── */}
        <Animated.View
          style={[d.drawer, { transform: [{ translateX: slideX }] }]}
          {...(visible ? pan.panHandlers : {})}
          pointerEvents={visible ? "auto" : "none"}
        >
        {/* Issue 2 fix: extend blue all the way to top — no SafeAreaView top edge */}
        <View style={{ flex: 1 }}>

          {/* Blue gradient header — covers status bar area */}
          <LinearGradient
            colors={["#0A1F44", "#0D3B8E", "#1565C0", "#3B82F6"]}
            locations={[0, 0.3, 0.7, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={d.header}
          >
            {/* Wave decoration lines */}
            <View style={d.wave1} /><View style={d.wave2} />
            <View style={d.wave3} /><View style={d.wave4} />
            {/* Glowing particles */}
            <View style={d.p1} /><View style={d.p2} />
            <View style={d.p3} /><View style={d.p4} />

            {/* Issue 1 fix: close button removed */}
            {/* Shield + title row — pushed down to clear status bar */}
            <View style={d.headerRow}>
              <View style={d.shieldBox}>
                <Ionicons name="shield-checkmark" size={32} color={C.blue} />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={d.headerTitle}>OptiFleet</Text>
                <Text style={d.headerSub}>Fleet Management System</Text>
              </View>
            </View>

            {/* Progress bar */}
            <View style={d.progressRow}>
              <View style={d.progressLine} />
              <View style={d.progressDot} />
            </View>
          </LinearGradient>

          {/* Menu items */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={d.menuContent}
            showsVerticalScrollIndicator={false}
          >
            <Item
              icon="person-circle-outline" iconBg="#EDE7F6" iconColor="#7B2CBF"
              label="My Profile"
              onPress={() => runAfterDrawerPress(onMyProfile)}
            />
            <Item
              icon="information-circle-outline" iconBg="#E3F2FD" iconColor={C.blue}
              label="About Us"
              onPress={() => openPage(setAboutVisible)}
            />
            <Item
              icon="call-outline" iconBg="#E8F5E9" iconColor={C.green}
              label="Contact Us"
              onPress={() => openPage(setContactVisible)}
            />
            <Item
              icon="shield-checkmark-outline" iconBg="#FFF3E0" iconColor="#F57C00"
              label="Privacy Policy"
              onPress={() => openPage(setPrivacyVisible)}
            />
            <Item
              icon="log-out-outline" iconBg="#FEE2E2" iconColor={C.red}
              label="Logout" labelColor={C.red}
              onPress={() => runAfterDrawerPress(() => setLogoutDialog(true))}
              last
            />
          </ScrollView>

          {/* Footer — safe area handles bottom inset */}
          <SafeAreaView edges={["bottom"]}>
            <View style={d.footer}>
              <Text style={d.footerTxt} numberOfLines={2}>Powered by NeoGeoInfo Technologies Limited</Text>
              <Text style={d.footerVer} numberOfLines={1}>OptiFleet v1.0.0</Text>
            </View>
          </SafeAreaView>

        </View>
        </Animated.View>

      </View>
    </Modal>

        {/* ══ Info pages & dialogs ══ */}

        <ConfirmDialog
          visible={logoutDialog}
          title="Logout"
          message="Are you sure you want to logout from OptiFleet?"
          confirmText="Logout"
          cancelText="Cancel"
          confirmColor={C.red}
          icon="log-out-outline"
          onCancel={() => setLogoutDialog(false)}
          onConfirm={doLogout}
        />

        {/* ── About Us ── */}
        <InfoPage
          visible={aboutVisible}
          title="About Us"
          subtitle='"Vigilance Over Movement"'
          icon="shield-checkmark-outline"
          onClose={() => setAboutVisible(false)}
        >
        <Text style={ip.body}>
          OptiFleet is a smart Fleet Management and Vehicle Tracking Platform developed by{" "}
          <Text style={ip.bold}>Neogeoinfo Technologies Limited</Text>.{" "}
          The platform leverages IoT-enabled real-time tracking, route optimization, driver
          behavior monitoring, geofencing, and fleet analytics to help organizations improve
          operational efficiency, safety, and asset visibility.
        </Text>
        <Text style={ip.body}>
          Designed for industries such as Logistics, Transportation, Oil &amp; Gas, Mining, and
          Supply Chain Management, OptiFleet empowers businesses with actionable insights for
          better decision-making and optimized fleet performance.
        </Text>

        <Sect label="Our Tagline" />
        <View style={ip.taglineBox}>
          <Ionicons name="shield-checkmark" size={18} color={C.blue} />
          <Text style={ip.tagline}>"Vigilance Over Movement"</Text>
        </View>

        <Sect label="Developed By" />
        <View style={ip.devRow}>
          <View style={[ip.cIcon, { backgroundColor: "#E3F2FD" }]}>
            <Ionicons name="business-outline" size={18} color={C.blue} />
          </View>
          <Text style={ip.devTxt}>Neogeoinfo Technologies Limited</Text>
        </View>
        </InfoPage>

        {/* ── Contact Us ── */}
        <InfoPage
          visible={contactVisible}
          title="Contact Us"
          subtitle="We'd love to hear from you"
          icon="call-outline"
          onClose={() => setContactVisible(false)}
        >
        <Sect label="Neogeoinfo Technologies Limited" />
        <CRow
          icon="globe-outline" iconBg="#EFF6FF" iconColor={C.blue}
          label="Website" value="www.neogeoinfo.com"
          onPress={() => Linking.openURL("http://www.neogeoinfo.com")}
        />
        <CRow
          icon="logo-linkedin" iconBg="#E8F4FD" iconColor="#0077B5"
          label="LinkedIn" value="linkedin.com/company/neogeoinfo"
          onPress={() => Linking.openURL("https://www.linkedin.com/company/neogeoinfo")}
        />

        <Sect label="Registered Office" />
        <View style={ip.addressCard}>
          <View style={ip.addrIconRow}>
            <View style={[ip.cIcon, { backgroundColor: "#FFF3E0" }]}>
              <Ionicons name="location-outline" size={18} color="#F57C00" />
            </View>
            <Text style={ip.addrTitle}>Gurugram, Haryana</Text>
          </View>
          <Text style={ip.addrTxt}>
            349–354, 3rd Floor, JMD Megapolis,{"\n"}Sector 48, Gurugram, Haryana – 122018
          </Text>
        </View>
        <CRow
          icon="call-outline" iconBg="#E8F5E9" iconColor={C.green}
          label="Phone" value="+91 8287 993 694"
          onPress={() => Linking.openURL("tel:+918287993694")}
        />

        <Sect label="Hyderabad Office" />
        <View style={ip.addressCard}>
          <View style={ip.addrIconRow}>
            <View style={[ip.cIcon, { backgroundColor: "#FFF3E0" }]}>
              <Ionicons name="location-outline" size={18} color="#F57C00" />
            </View>
            <Text style={ip.addrTitle}>Hyderabad, Telangana</Text>
          </View>
          <Text style={ip.addrTxt}>
            NSL Arena, Tower 2, 4th Floor,{"\n"}
            Uppal – Ramanthapur Road,{"\n"}
            Hyderabad, Telangana – 500039
          </Text>
        </View>
        <CRow
          icon="call-outline" iconBg="#E8F5E9" iconColor={C.green}
          label="Phone" value="040-4211101 / 040-4211102"
          onPress={() => Linking.openURL("tel:04042111011")}
        />
        <CRow
          icon="call-outline" iconBg="#E8F5E9" iconColor={C.green}
          label="Mobile" value="+91 9885 069 780"
          onPress={() => Linking.openURL("tel:+919885069780")}
        />

        <View style={ip.noteBox}>
          <Ionicons name="information-circle-outline" size={16} color={C.blue} style={{ marginTop: 1 }} />
          <Text style={ip.noteTxt}>
            For business inquiries, partnerships, technical support, or fleet management solutions,
            please contact Neogeoinfo Technologies Limited through the above channels.
          </Text>
        </View>
        </InfoPage>

        {/* ── Privacy Policy ── */}
        <InfoPage
          visible={privacyVisible}
          title="Privacy Policy"
          subtitle="Your privacy is our priority"
          icon="lock-closed-outline"
          onClose={() => setPrivacyVisible(false)}
        >
        {([
          {
            icon: "heart-outline" as const,             iconBg: "#FCE4EC", iconColor: "#C2185B",
            head: "Our Commitment",
            body: "At OptiFleet, we value and respect your privacy. We are committed to protecting your personal information and being transparent about how we use it.",
          },
          {
            icon: "server-outline" as const,            iconBg: "#E3F2FD", iconColor: C.blue,
            head: "Data We Collect",
            body: "The application collects and processes fleet-related information, including vehicle details, device information, driver information, GPS location data, and trip history, solely for operational, monitoring, analytics, security, and service improvement purposes.",
          },
          {
            icon: "shield-checkmark-outline" as const,  iconBg: "#E8F5E9", iconColor: C.green,
            head: "Data Security",
            body: "All collected information is handled securely and is never sold, rented, or shared with unauthorized third parties. Data is used only to provide fleet tracking, monitoring, reporting, and related services.",
          },
          {
            icon: "checkmark-circle-outline" as const,  iconBg: "#FFF3E0", iconColor: "#F57C00",
            head: "User Consent",
            body: "By using OptiFleet, users consent to the collection and processing of data necessary for delivering reliable fleet management and vehicle tracking services.",
          },
        ] as const).map((item, i) => (
          <View key={i} style={ip.pBlock}>
            <View style={ip.pHead}>
              <View style={[ip.cIcon, { backgroundColor: item.iconBg }]}>
                <Ionicons name={item.icon} size={18} color={item.iconColor} />
              </View>
              <Text style={ip.pHeadTxt}>{item.head}</Text>
            </View>
            <Text style={ip.pBody}>{item.body}</Text>
          </View>
        ))}
        </InfoPage>

    </>
  );
};

// ── Drawer styles ─────────────────────────────────────────────────────────────
const d = StyleSheet.create({
  overlay:     { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.48)", zIndex: 100 },
  drawer:      { position: "absolute", top: 0, right: 0, bottom: 0, width: DRAWER_W, backgroundColor: "#fff", shadowColor: "#000", shadowOpacity: 0.26, shadowRadius: 24, shadowOffset: { width: -6, height: 0 }, elevation: 24, zIndex: 101 },

  // Issue 2 fix: paddingTop accounts for status bar so blue covers it fully
  header:      { paddingTop: (Platform.OS === "android" ? StatusBar.currentHeight ?? 32 : 52) + 24, paddingBottom: 64, paddingHorizontal: 24, overflow: "hidden", borderBottomLeftRadius: 38 },
  wave1:       { position: "absolute", top: 28, right: -40, width: 180, height: 3, backgroundColor: "rgba(255,255,255,0.12)", transform: [{ rotate: "-12deg" }] },
  wave2:       { position: "absolute", top: 72, right: -60, width: 220, height: 3, backgroundColor: "rgba(255,255,255,0.08)", transform: [{ rotate: "-8deg" }] },
  wave3:       { position: "absolute", top: 116, right: -50, width: 160, height: 3, backgroundColor: "rgba(255,255,255,0.06)", transform: [{ rotate: "-18deg" }] },
  wave4:       { position: "absolute", top: 160, right: -70, width: 200, height: 3, backgroundColor: "rgba(255,255,255,0.04)", transform: [{ rotate: "-5deg" }] },
  p1:          { position: "absolute", top: 48,  right: 70,  width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.28)" },
  p2:          { position: "absolute", top: 96,  right: 110, width: 4, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.22)" },
  p3:          { position: "absolute", top: 142, right: 55,  width: 5, height: 5, borderRadius: 2.5, backgroundColor: "rgba(255,255,255,0.18)" },
  p4:          { position: "absolute", top: 180, right: 85,  width: 4, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.14)" },
  closeBtn:    { alignSelf: "flex-end", width: 34, height: 34, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center", marginBottom: 10 },
  headerRow:   { flexDirection: "row", alignItems: "center" },
  shieldBox:   { width: 64, height: 64, borderRadius: 18, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
  headerTitle: { fontSize: 22, fontWeight: "800", color: "#fff", letterSpacing: 0.3 },
  headerSub:   { fontSize: 12, color: "rgba(255,255,255,0.82)", marginTop: 4 },
  progressRow: { flexDirection: "row", alignItems: "center", marginTop: 24 },
  progressLine:{ flex: 1, height: 4, backgroundColor: "#10B981", borderRadius: 2 },
  progressDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#FFD700", marginLeft: 10 },

  menuContent: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  item:        { flexDirection: "row", alignItems: "center", paddingVertical: 15, paddingHorizontal: 4, gap: 14 },
  itemIcon:    { width: 44, height: 44, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  itemLabel:   { flex: 1, fontSize: 15, fontWeight: "700", color: "#0D1B3E" },
  sep:         { height: StyleSheet.hairlineWidth, backgroundColor: "rgba(13,27,62,0.08)", marginHorizontal: 4 },
  footer:      { alignItems: "center", justifyContent: "center", minHeight: 64, paddingHorizontal: 12, paddingBottom: 16, paddingTop: 12, backgroundColor: "#F8FAFF", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(13,27,62,0.08)" },
  footerTxt:   { width: "100%", fontSize: 12, color: "#475569", fontWeight: "700", textAlign: "center", lineHeight: 17 },
  footerVer:   { width: "100%", fontSize: 11, color: "#1565C0", fontWeight: "700", marginTop: 3, textAlign: "center", lineHeight: 15 },
});

// ── InfoPage styles ───────────────────────────────────────────────────────────
const ip = StyleSheet.create({
  headerBg:    { position: "absolute", top: 0, left: -40, right: -40, height: 260, overflow: "hidden", borderBottomLeftRadius: 180, borderBottomRightRadius: 180 },
  navRow:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8 },
  backBtn:     { width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.18)", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)", alignItems: "center", justifyContent: "center" },
  navTitle:    { fontSize: 18, fontWeight: "800", color: "#fff" },
  hero:        { alignItems: "center", paddingTop: 6, paddingBottom: 48 },
  heroIconRing:{ width: 68, height: 68, borderRadius: 34, backgroundColor: "rgba(255,255,255,0.20)", borderWidth: 2, borderColor: "rgba(255,255,255,0.50)", alignItems: "center", justifyContent: "center", marginBottom: 12 },
  heroTitle:   { fontSize: 22, fontWeight: "800", color: "#fff", marginBottom: 6 },
  heroSub:     { fontSize: 13, color: "rgba(255,255,255,0.75)", fontWeight: "500", fontStyle: "italic" },
  scroll:      { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 40 },
  card:        { backgroundColor: "#fff", borderRadius: 20, padding: 20, marginTop: 0, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 4 },

  sectWrap:    { marginTop: 20, marginBottom: 12 },
  sectTxt:     { fontSize: 12, fontWeight: "800", color: "#1565C0", textTransform: "uppercase", letterSpacing: 1.0, marginBottom: 6 },
  sectLine:    { height: 1, backgroundColor: "rgba(21,101,192,0.12)" },

  body:        { fontSize: 14, color: "#1A2F4E", lineHeight: 22, marginBottom: 14 },
  bold:        { fontWeight: "700", color: "#0D1B3E" },

  taglineBox:  { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#EFF6FF", borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 6, borderWidth: 1, borderColor: "rgba(21,101,192,0.12)" },
  tagline:     { fontSize: 15, fontWeight: "800", color: "#1565C0", fontStyle: "italic", flex: 1 },
  devRow:      { flexDirection: "row", alignItems: "center", gap: 12 },
  devTxt:      { fontSize: 14, fontWeight: "700", color: "#0D1B3E" },

  cRow:        { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(13,27,62,0.06)" },
  cIcon:       { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  cLabel:      { fontSize: 11, fontWeight: "700", color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 },
  cValue:      { fontSize: 14, fontWeight: "600", color: "#0D1B3E" },

  addressCard: { backgroundColor: "#F8FAFF", borderRadius: 12, padding: 14, marginVertical: 8, borderWidth: 1, borderColor: "rgba(21,101,192,0.08)" },
  addrIconRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  addrTitle:   { fontSize: 13, fontWeight: "700", color: "#0D1B3E" },
  addrTxt:     { fontSize: 13, color: "#1A2F4E", lineHeight: 20, marginLeft: 50 },

  noteBox:     { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: "#EFF6FF", borderRadius: 12, padding: 14, marginTop: 16, borderWidth: 1, borderColor: "rgba(21,101,192,0.12)" },
  noteTxt:     { flex: 1, fontSize: 13, color: "#1A2F4E", lineHeight: 20 },

  pBlock:      { marginBottom: 14, borderRadius: 14, borderWidth: 1, borderColor: "rgba(13,27,62,0.07)", padding: 14, backgroundColor: "#FAFBFF" },
  pHead:       { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
  pHeadTxt:    { fontSize: 14, fontWeight: "800", color: "#0D1B3E" },
  pBody:       { fontSize: 13, color: "#1A2F4E", lineHeight: 20 },
});

export default RightDrawer;
