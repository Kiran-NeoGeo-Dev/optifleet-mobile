import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  StatusBar,
  Animated,
  Easing,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { login } from "../../services/authService";
import { api } from "../../services/api";
import * as SMS from "expo-sms";
import { useAuth } from "../../hooks/useAuth";
import { Toast, useToast } from "../../components/Toast";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AuthStackParamList } from "../../navigation/AuthNavigator";

type LoginProps = NativeStackScreenProps<AuthStackParamList, "Login">;

const { width: SW, height: SH } = Dimensions.get("window");

const ROLE_TABS = [
  { label: "Admin",  icon: "shield-checkmark-outline" as const },
  { label: "User",   icon: "business-outline"         as const },
  { label: "Driver", icon: "car-outline"              as const },
];

const ROLE_MAP: Record<string, string[]> = {
  Admin:  ["admin"],
  User:   ["client", "user"],
  Driver: ["driver"],
};

const LoginScreen = ({ navigation }: LoginProps) => {
  const [username,     setUsername]     = useState("");
  const [password,     setPassword]     = useState("");
  const [loading,      setLoading]      = useState(false);
  const [rememberMe,   setRememberMe]   = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [activeRole,   setActiveRole]   = useState("Admin");
  const { login: setAuth } = useAuth();
  const { toast, showToast, hideToast } = useToast();
  const submittingRef = useRef(false);

  const cardFade  = useRef(new Animated.Value(0)).current;
  const cardSlide = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(cardFade,  { toValue: 1, duration: 600, delay: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(cardSlide, { toValue: 0, duration: 600, delay: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);

  const onSubmit = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;

    if (activeRole === "Driver") {
      if (!username.trim()) {
        showToast("Please enter your phone number.", "error");
        submittingRef.current = false;
        return;
      }
      try {
        setLoading(true);
        const res        = await api.post("/api/driver-otp/generate", { phoneNumber: username.trim() });
        const otpValue   = res.data.otp;
        const driverName = res.data.driverName || "";
        const msg        = `Your OptiFleet OTP is: ${otpValue}\nValid for 5 minutes.\n- NeoGeoInfo Technologies`;
        const isAvailable = await SMS.isAvailableAsync();
        if (isAvailable) await SMS.sendSMSAsync([username.trim()], msg);
        showToast("OTP sent! Enter it below.", "success");
        setTimeout(() => navigation.navigate("DriverOtp", { phoneNumber: username.trim(), driverName }), 800);
      } catch (e: any) {
        showToast(e?.response?.data?.error || "Phone number not registered. Please contact admin.", "error");
      } finally {
        setLoading(false);
        submittingRef.current = false;
      }
      return;
    }

    if (!username.trim() || !password.trim()) {
      showToast("Please enter username and password.", "error");
      submittingRef.current = false;
      return;
    }
    try {
      setLoading(true);
      const res          = await login({ username: username.trim(), password: password.trim() });
      const returnedRole = (res.role ?? "").toLowerCase();
      const validRoles   = ROLE_MAP[activeRole] ?? [activeRole.toLowerCase()];
      if (!validRoles.includes(returnedRole)) {
        showToast(`Invalid credentials for ${activeRole}. Please select the correct role.`, "error");
        return;
      }
      showToast("Login successful! Welcome to OptiFleet.", "success");
      setTimeout(() => setAuth(res.token, res.username, res.clientId, res.role ?? "Client"), 1800);
    } catch (e: any) {
      const is401     = e?.response?.status === 401;
      const serverMsg = e?.response?.data?.message;
      showToast(is401 || serverMsg ? "Invalid username or password." : "Network error — check backend is running.", "error");
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Fleet.png — full screen background, never changes */}
      <View style={s.blueBg} />
      <Image
        source={require("../../../assets/images/Fleet.png")}
        style={s.heroImage}
        resizeMode="cover"
      />
      {/* Soft gradient so card blends in at bottom */}
      <LinearGradient
        colors={["transparent", "rgba(10,30,100,0.18)"]}
        locations={[0.55, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <SafeAreaView style={s.safe}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}
        >
          <ScrollView
            contentContainerStyle={s.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces
          >
            {/* Spacer — pushes card down so truck image stays fully visible */}
            <View style={{ height: SH * 0.45 }} />

            {/* ── Login card ── */}
            <Animated.View style={[s.card, { opacity: cardFade, transform: [{ translateY: cardSlide }] }]}>

              {/* Title */}
              <Text style={s.title}>Welcome Back</Text>
              <Text style={s.subtitle}>Sign in to continue with OptiFleet</Text>

              {/* Role tabs — white bg, blue border on active */}
              <View style={s.tabWrap}>
                {ROLE_TABS.map((tab) => {
                  const active = activeRole === tab.label;
                  return (
                    <TouchableOpacity
                      key={tab.label}
                      style={[s.tabItem, active && s.tabItemActive]}
                      onPress={() => setActiveRole(tab.label)}
                      activeOpacity={0.75}
                    >
                      <Ionicons
                        name={tab.icon}
                        size={16}
                        color={active ? "#1A56DB" : "#5F6F8F"}
                        style={{ marginRight: 5 }}
                      />
                      <Text style={[s.tabTxt, active && s.tabTxtActive]}>
                        {tab.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Username / Phone label + field */}
              <Text style={s.label}>
                {activeRole === "Driver" ? "Phone Number" : "Username"}
              </Text>
              <View style={s.field}>
                <View style={s.fieldIconWrap}>
                  <Ionicons
                    name={activeRole === "Driver" ? "call-outline" : "person-outline"}
                    size={19}
                    color="#8B652F"
                  />
                </View>
                <TextInput
                  style={s.fieldInput}
                  placeholder={activeRole === "Driver" ? "Enter Phone Number" : "Enter Username"}
                  placeholderTextColor="#5F6F8F"
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType={activeRole === "Driver" ? "phone-pad" : "default"}
                  maxLength={activeRole === "Driver" ? 10 : undefined}
                />
              </View>

              {/* Password */}
              {activeRole !== "Driver" && (
                <>
                  <Text style={s.label}>Password</Text>
                  <View style={s.field}>
                    <View style={s.fieldIconWrap}>
                      <Ionicons name="lock-closed-outline" size={19} color="#8B652F" />
                    </View>
                    <TextInput
                      style={[s.fieldInput, { flex: 1 }]}
                      placeholder="Enter Password"
                      placeholderTextColor="#5F6F8F"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                    />
                    <TouchableOpacity
                      onPress={() => setShowPassword(!showPassword)}
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                      style={s.eyeBtn}
                    >
                      <Ionicons
                        name={showPassword ? "eye-off-outline" : "eye-outline"}
                        size={21}
                        color="#8B652F"
                      />
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {/* Driver hint */}
              {activeRole === "Driver" && (
                <Text style={s.driverHint}>
                  Enter your registered phone number. An OTP will be sent via SMS.
                </Text>
              )}

              {/* Remember me + Forgot */}
              <View style={s.optRow}>
                <TouchableOpacity style={s.remRow} onPress={() => setRememberMe(!rememberMe)} activeOpacity={0.7}>
                  <View style={[s.cb, rememberMe && s.cbOn]}>
                    {rememberMe && <Ionicons name="checkmark" size={11} color="#fff" />}
                  </View>
                  <Text style={s.remTxt}>Remember me</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => navigation.navigate("AdminRecovery")} activeOpacity={0.7}>
                  <Text style={s.forgotTxt}>Admin/Forgot Password?</Text>
                </TouchableOpacity>
              </View>

              {/* Sign In button */}
              <TouchableOpacity style={s.btnOuter} onPress={onSubmit} disabled={loading} activeOpacity={0.85}>
                <LinearGradient
                  colors={["#2D6CFB", "#1040CC"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={s.btnGrad}
                >
                  <Text style={s.btnTxt}>
                    {loading ? "Please wait…" : activeRole === "Driver" ? "Send OTP" : "Sign In"}
                  </Text>
                  <View style={s.btnArrow}>
                    <Ionicons name="arrow-forward" size={18} color="#2D6CFB" />
                  </View>
                </LinearGradient>
              </TouchableOpacity>

            </Animated.View>

            {/* Bottom padding so card isn't flush with screen edge */}
            <View style={{ height: 32 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={hideToast} />
    </View>
  );
};

const s = StyleSheet.create({
  root:      { flex: 1, backgroundColor: "#1A46B4" },
  blueBg:    { ...StyleSheet.absoluteFillObject, backgroundColor: "#1A46B4" },
  heroImage: { position: "absolute", top: 0, left: 0, width: SW, height: SH },
  safe:      { flex: 1 },

  scroll: {
    flexGrow: 1,
    paddingHorizontal: 14,
  },

  // ── Card ──────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 28,
    shadowColor: "#0A1F6E",
    shadowOpacity: 0.22,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 16,
  },

  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#0D1B3E",
    textAlign: "center",
    marginBottom: 5,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    color: "#43516D",
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 20,
  },

  // ── Role tabs ─────────────────────────────────────────────────────────────
  tabWrap: {
    flexDirection: "row",
    backgroundColor: "#F0F4FF",
    borderRadius: 16,
    padding: 5,
    marginBottom: 20,
  },
  tabItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
    borderRadius: 12,
  },
  // Active: white bg + blue border (matches screenshot exactly)
  tabItemActive: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#2D6CFB",
    shadowColor: "#2D6CFB",
    shadowOpacity: 0.10,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  tabTxt:       { fontSize: 13, fontWeight: "600", color: "#5F6F8F" },
  tabTxtActive: { fontSize: 13, fontWeight: "700", color: "#1A56DB" },

  // ── Fields ────────────────────────────────────────────────────────────────
  label: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1A2F5C",
    marginBottom: 8,
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8D0A9",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#C8AC7A",
    height: 54,
    marginBottom: 14,
    paddingRight: 14,
    shadowColor: "#7A5522",
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  fieldIconWrap: {
    width: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  fieldInput: {
    flex: 1,
    fontSize: 15,
    color: "#10204A",
    paddingVertical: 0,
  },
  eyeBtn: { paddingLeft: 8 },

  driverHint: {
    fontSize: 12,
    color: "#43516D",
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 14,
    lineHeight: 18,
  },

  // ── Options row ───────────────────────────────────────────────────────────
  optRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },
  remRow: { flexDirection: "row", alignItems: "center" },
  cb: {
    width: 20, height: 20, borderRadius: 5,
    borderWidth: 2, borderColor: "#2D6CFB",
    marginRight: 8, alignItems: "center", justifyContent: "center",
  },
  cbOn:      { backgroundColor: "#2D6CFB", borderColor: "#2D6CFB" },
  remTxt:    { fontSize: 14, color: "#4A6080" },
  forgotTxt: { fontSize: 14, fontWeight: "700", color: "#2D6CFB" },

  // ── Sign In button ────────────────────────────────────────────────────────
  btnOuter: {
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#2D6CFB",
    shadowOpacity: 0.32,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  btnGrad: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    borderRadius: 16,
  },
  btnTxt: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.3,
    marginLeft: 32,   // offset so text stays visually centred with arrow on right
  },
  btnArrow: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: "#FFFFFF",
    alignItems: "center", justifyContent: "center",
  },
});

export default LoginScreen;
