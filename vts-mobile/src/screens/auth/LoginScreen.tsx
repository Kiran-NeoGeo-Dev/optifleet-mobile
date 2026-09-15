import { useState, useRef, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, Image, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, Dimensions, StatusBar,
  Animated, Easing, ScrollView, LayoutChangeEvent, ActivityIndicator, Pressable, Keyboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { login } from "../../services/authService";
import { api, setAuthToken } from "../../services/api";
import { useAuth } from "../../hooks/useAuth";
import { Toast, useToast } from "../../components/Toast";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AuthStackParamList } from "../../navigation/AuthNavigator";
import { ENDPOINTS } from "../../config/apiConfig";

type LoginProps = NativeStackScreenProps<AuthStackParamList, "Login">;

const { width: SW, height: SH } = Dimensions.get("window");

const ROLE_TABS = [
  { label: "Admin",  icon: "shield-checkmark-outline" as const },
  { label: "User",   icon: "business-outline"         as const },
  { label: "Driver", icon: "car-outline"              as const },
];

const ROLE_MAP: Record<string, string[]> = {
  Admin:  ["admin", "superadmin"],
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

  // Driver OTP state
  const [otp,          setOtp]          = useState("");
  const [otpSent,      setOtpSent]      = useState(false);
  const [otpSending,   setOtpSending]   = useState(false);
  const [countdown,    setCountdown]    = useState(0);

  const [spacerH, setSpacerH] = useState(SH * 0.42);

  const { login: setAuth } = useAuth();
  const { toast, showToast, hideToast } = useToast();

  const onCardLayout = useCallback((e: LayoutChangeEvent) => {
    const cardH = e.nativeEvent.layout.height;
    // Spacer = screen height minus card height minus bottom padding, capped to 40–46% of screen
    const next = Math.min(Math.max(SH - cardH - 16, SH * 0.40), SH * 0.46);
    setSpacerH(next);
  }, []);

  const cardFade  = useRef(new Animated.Value(0)).current;
  const cardSlide = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(cardFade,  { toValue: 1, duration: 600, delay: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(cardSlide, { toValue: 0, duration: 600, delay: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);

  // OTP countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Reset OTP state when switching roles
  useEffect(() => {
    setOtpSent(false);
    setOtp("");
    setCountdown(0);
  }, [activeRole]);

  // Auto-format OTP input: only digits, max 6
  const onOtpChange = (text: string) => {
    const digits = text.replace(/\D/g, "");
    setOtp(digits.slice(0, 6));
  };

  const onSendOtp = async () => {
    if (!username.trim()) {
      showToast("Please enter your mobile number.", "error");
      return;
    }

    // Validate 10-digit mobile number
    const cleanMobile = username.trim();
    if (!/^[6-9]\d{9}$/.test(cleanMobile)) {
      showToast("Please enter a valid 10-digit mobile number.", "error");
      return;
    }

    try {
      setOtpSending(true);
      const res = await api.post(ENDPOINTS.DRIVER_SEND_OTP, {
        mobileNumber: cleanMobile,
      });
      showToast("OTP sent successfully to your mobile number.", "success");
      setOtpSent(true);
      setCountdown(60); // 60 seconds countdown for resend
    } catch (e: any) {
      const errorMsg = e?.response?.data?.error || "Failed to send OTP. Please try again.";
      showToast(errorMsg, "error");
    } finally {
      setOtpSending(false);
    }
  };

  const onSubmit = async () => {
    // Prevent double submission using loading state (FIX BUG-008)
    if (loading) return;

    if (activeRole === "Driver") {
      if (!username.trim()) {
        showToast("Please enter your mobile number.", "error");
        return;
      }
      if (!otpSent) {
        showToast("Please send OTP first.", "error");
        return;
      }
      if (!otp.trim() || otp.length !== 6) {
        showToast("Please enter the 6-digit OTP.", "error");
        return;
      }
      try {
        setLoading(true);
        const res = await api.post(ENDPOINTS.DRIVER_VERIFY_OTP, {
          mobileNumber: username.trim(),
          otp:          otp.trim(),
        });
        const { token, clientId, username: uname, role } = res.data;
        showToast("Login successful! Welcome to OptiFleet.", "success");
        setAuthToken(token);
        setAuth(token, uname, clientId, role);
      } catch (e: any) {
        showToast(e?.response?.data?.error || "Invalid OTP. Please try again.", "error");
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!username.trim() || !password.trim()) {
      showToast("Please enter username and password.", "error");
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
      setAuth(res.token, res.username, res.clientId, res.role ?? "Client");
    } catch (e: any) {
      const is401     = e?.response?.status === 401;
      const serverMsg = e?.response?.data?.message;
      const errorMsg  = e?.message || "";
      
      // Detect SSL/certificate errors
      if (errorMsg.includes("CERTIFICATE_VERIFY_FAILED") || errorMsg.includes("CERT_UNTRUSTED") || errorMsg.includes("EHOSTUNREACH")) {
        showToast("SSL Certificate Error: Cannot connect to server. Ensure backend is running and certificate is valid.", "error");
      } else if (is401 || serverMsg) {
        showToast("Invalid username or password.", "error");
      } else if (errorMsg.includes("timeout") || errorMsg.includes("ECONNREFUSED")) {
        showToast("Connection timeout: Cannot reach backend server. Check network and backend status.", "error");
      } else {
        showToast("Network error — check backend is running.", "error");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <View style={s.blueBg} />
      <Image
        source={require("../../../assets/images/Fleet.png")}
        style={s.heroImage}
        resizeMode="cover"
      />
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
          <Pressable style={{ flex: 1 }} onPress={Keyboard.dismiss}>
          <ScrollView
            contentContainerStyle={s.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces
          >
            <View style={{ height: spacerH }} />

            <Animated.View
              style={[s.card, { opacity: cardFade, transform: [{ translateY: cardSlide }] }]}
              onLayout={onCardLayout}
            >

              <Text style={s.title}>Welcome Back</Text>
              <Text style={s.subtitle}>Sign in to continue with OptiFleet</Text>

              {/* Role tabs */}
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
                      <Ionicons name={tab.icon} size={18} color={active ? "#1A56DB" : "#5F6F8F"} style={{ marginRight: 5 }} />
                      <Text style={[s.tabTxt, active && s.tabTxtActive]}>{tab.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Mobile / Username field */}
              <Text style={s.label}>
                {activeRole === "Driver" ? "Mobile Number" : "Username"}
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
                  placeholder={activeRole === "Driver" ? "Enter Mobile Number" : "Enter Username"}
                  placeholderTextColor="#5F6F8F"
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType={activeRole === "Driver" ? "phone-pad" : "default"}
                  maxLength={activeRole === "Driver" ? 10 : undefined}
                />
              </View>

              {/* Driver: OTP fields */}
              {activeRole === "Driver" && (
                <>
                  {/* Send OTP button */}
                  {!otpSent && (
                    <TouchableOpacity
                      style={s.sendOtpBtn}
                      onPress={onSendOtp}
                      disabled={otpSending}
                      activeOpacity={0.75}
                    >
                      {otpSending ? (
                        <ActivityIndicator color="#1A56DB" size="small" />
                      ) : (
                        <Text style={s.sendOtpTxt}>Send OTP</Text>
                      )}
                    </TouchableOpacity>
                  )}

                  {/* OTP input field */}
                  {otpSent && (
                    <>
                      <Text style={s.label}>Enter OTP</Text>
                      <View style={s.field}>
                        <View style={s.fieldIconWrap}>
                          <Ionicons name="key-outline" size={19} color="#8B652F" />
                        </View>
                        <TextInput
                          style={s.fieldInput}
                          placeholder="Enter 6-digit OTP"
                          placeholderTextColor="#5F6F8F"
                          value={otp}
                          onChangeText={onOtpChange}
                          keyboardType="number-pad"
                          maxLength={6}
                          autoFocus
                        />
                      </View>

                      {/* Resend OTP */}
                      <View style={s.resendRow}>
                        {countdown > 0 ? (
                          <Text style={s.resendDisabled}>
                            Resend OTP in {countdown}s
                          </Text>
                        ) : (
                          <TouchableOpacity onPress={onSendOtp} activeOpacity={0.7}>
                            <Text style={s.resendTxt}>Resend OTP</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </>
                  )}
                </>
              )}

              {/* Admin/User: Password field */}
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
                      <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={21} color="#8B652F" />
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {/* Remember me + Forgot (hide Forgot for Driver) */}
              <View style={s.optRow}>
                <TouchableOpacity style={s.remRow} onPress={() => setRememberMe(!rememberMe)} activeOpacity={0.7}>
                  <View style={[s.cb, rememberMe && s.cbOn]}>
                    {rememberMe && <Ionicons name="checkmark" size={11} color="#fff" />}
                  </View>
                  <Text style={s.remTxt}>Remember me</Text>
                </TouchableOpacity>
                {activeRole !== "Driver" && (
                  <TouchableOpacity onPress={() => navigation.navigate("AdminRecovery")} activeOpacity={0.7}>
                    <Text style={s.forgotTxt}>Forgot Password?</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Sign In / Verify OTP button */}
              <TouchableOpacity style={s.btnOuter} onPress={onSubmit} disabled={loading || (activeRole === "Driver" && !otpSent)} activeOpacity={0.85}>
                <LinearGradient
                  colors={["#2D6CFB", "#1040CC"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={s.btnGrad}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" size="small" style={{ flex: 1 }} />
                  ) : (
                    <Text style={s.btnTxt}>
                      {activeRole === "Driver" && otpSent ? "Verify OTP" : "Sign In"}
                    </Text>
                  )}
                  <View style={s.btnArrow}>
                    {loading
                      ? <ActivityIndicator color="#2D6CFB" size="small" />
                      : <Ionicons name="arrow-forward" size={18} color="#2D6CFB" />}
                  </View>
                </LinearGradient>
              </TouchableOpacity>

            </Animated.View>

            <View style={{ height: 16 }} />
          </ScrollView>
          </Pressable>
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

  scroll: { flexGrow: 1, paddingHorizontal: 14 },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 16,
    paddingBottom: 16,
    shadowColor: "#0A1F6E",
    shadowOpacity: 0.22,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 16,
  },

  title:    { fontSize: 26, fontWeight: "800", color: "#0D1B3E", textAlign: "center", marginBottom: 2, letterSpacing: -0.3 },
  subtitle: { fontSize: 14, color: "#43516D", fontWeight: "600", textAlign: "center", marginBottom: 10 },

  tabWrap: { flexDirection: "row", backgroundColor: "#F0F4FF", borderRadius: 16, padding: 4, marginBottom: 10 },
  tabItem: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 10, borderRadius: 12 },
  tabItemActive: { backgroundColor: "#FFFFFF", borderWidth: 1.5, borderColor: "#2D6CFB", shadowColor: "#2D6CFB", shadowOpacity: 0.10, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  tabTxt:       { fontSize: 13, fontWeight: "600", color: "#5F6F8F" },
  tabTxtActive: { fontSize: 13, fontWeight: "700", color: "#1A56DB" },

  label: { fontSize: 14, fontWeight: "700", color: "#1A2F5C", marginBottom: 5 },
  field: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#F0F4FF", borderRadius: 14,
    borderWidth: 1.5, borderColor: "#BFDBFE",
    height: 50, marginBottom: 8, paddingRight: 14,
    shadowColor: "#1A46B4", shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  fieldIconWrap: { width: 48, alignItems: "center", justifyContent: "center" },
  fieldInput:    { flex: 1, fontSize: 15, color: "#10204A", paddingVertical: 0, height: 50 },
  eyeBtn:        { paddingLeft: 8 },
  calendarBtn:   { paddingLeft: 8 },

  optRow:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  remRow:    { flexDirection: "row", alignItems: "center" },
  cb:        { width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: "#2D6CFB", marginRight: 8, alignItems: "center", justifyContent: "center" },
  cbOn:      { backgroundColor: "#2D6CFB", borderColor: "#2D6CFB" },
  remTxt:    { fontSize: 14, color: "#4A6080" },
  forgotTxt: { fontSize: 14, fontWeight: "700", color: "#2D6CFB" },

  sendOtpBtn: { backgroundColor: "#2D6CFB", borderRadius: 12, paddingVertical: 12, alignItems: "center", justifyContent: "center", marginBottom: 8, shadowColor: "#2D6CFB", shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 5 },
  sendOtpTxt: { fontSize: 15, fontWeight: "700", color: "#FFFFFF", letterSpacing: 0.3 },
  
  resendRow:      { flexDirection: "row", justifyContent: "flex-end", marginBottom: 8 },
  resendTxt:      { fontSize: 14, fontWeight: "700", color: "#2D6CFB" },
  resendDisabled: { fontSize: 14, fontWeight: "600", color: "#8B9DC3" },

  btnOuter: { borderRadius: 16, overflow: "hidden", shadowColor: "#2D6CFB", shadowOpacity: 0.32, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 10 },
  btnGrad:  { height: 50, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: 20, borderRadius: 16 },
  btnTxt:   { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "800", color: "#FFFFFF", letterSpacing: 0.3, marginLeft: 32 },
  btnArrow: { width: 32, height: 32, borderRadius: 10, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
});

export default LoginScreen;