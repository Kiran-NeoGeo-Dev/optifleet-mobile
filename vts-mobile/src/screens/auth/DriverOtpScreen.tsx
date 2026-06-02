import { useState, useRef } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  StatusBar, KeyboardAvoidingView, Platform, ScrollView,
  Image, Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as SMS from "expo-sms";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AuthStackParamList } from "../../navigation/AuthNavigator";
import { api } from "../../services/api";
import { ENDPOINTS } from "../../config/apiConfig";
import { useAuth } from "../../hooks/useAuth";
import { Toast, useToast } from "../../components/Toast";
import { setAuthToken } from "../../services/api";

type Props = NativeStackScreenProps<AuthStackParamList, "DriverOtp">;

const { width: SW, height: SH } = Dimensions.get("window");

const DriverOtpScreen = ({ route, navigation }: Props) => {
  const { phoneNumber, driverName } = route.params;
  const [otp, setOtp]         = useState("");
  const [loading, setLoading] = useState(false);
  const { login: setAuth }    = useAuth();
  const { toast, showToast, hideToast } = useToast();
  const submitting = useRef(false);

  const onResend = async () => {
    try {
      const res      = await api.post(ENDPOINTS.DRIVER_OTP_GENERATE, { phoneNumber });
      const otpValue = res.data.otp;
      const msg      = `Your OptiFleet OTP is: ${otpValue}\nValid for 5 minutes.\n- NeoGeoInfo Technologies`;
      const isAvailable = await SMS.isAvailableAsync();
      if (isAvailable) await SMS.sendSMSAsync([phoneNumber], msg);
      showToast("New OTP sent to your phone.", "success");
    } catch {
      showToast("Failed to resend OTP. Try again.", "error");
    }
  };

  const onVerify = async () => {
    if (submitting.current) return;
    if (!otp.trim() || otp.trim().length !== 6) {
      showToast("Please enter the 6-digit OTP.", "error");
      return;
    }
    submitting.current = true;
    setLoading(true);
    try {
      const res = await api.post(ENDPOINTS.DRIVER_OTP_VERIFY, { phoneNumber, otp: otp.trim() });
      const { token, clientId, username, role } = res.data;
      showToast("Login successful! Welcome to OptiFleet.", "success");
      setAuthToken(token);
      setTimeout(() => setAuth(token, username, clientId, role), 1500);
    } catch (e: any) {
      showToast(e?.response?.data?.error || "Invalid or expired OTP.", "error");
    } finally {
      setLoading(false);
      submitting.current = false;
    }
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Same Fleet.png background as LoginScreen */}
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
          <ScrollView
            contentContainerStyle={s.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces
          >
            {/* Spacer */}
            <View style={{ height: SH * 0.30 }} />

            {/* ── Card ── */}
            <View style={s.card}>

              {/* Back button row */}
              <View style={s.topRow}>
                <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
                  <Ionicons name="chevron-back" size={20} color="#1A56DB" />
                </TouchableOpacity>
                <View style={s.iconCircle}>
                  <Ionicons name="phone-portrait-outline" size={26} color="#1A56DB" />
                </View>
                <View style={{ width: 36 }} />
              </View>

              {/* Title */}
              <Text style={s.title}>Driver Verification</Text>
              <Text style={s.subtitle}>
                OTP sent to{" "}
                <Text style={s.phoneHighlight}>{phoneNumber}</Text>
                {driverName ? `\nWelcome, ${driverName}` : ""}
              </Text>

              <View style={s.divider} />

              {/* OTP field */}
              <Text style={s.label}>6-Digit OTP</Text>
              <View style={s.field}>
                <View style={s.fieldIconWrap}>
                  <Ionicons name="key-outline" size={19} color="#8B652F" />
                </View>
                <TextInput
                  style={s.otpInput}
                  value={otp}
                  onChangeText={setOtp}
                  placeholder="• • • • • •"
                  placeholderTextColor="#5F6F8F"
                  keyboardType="numeric"
                  maxLength={6}
                  autoFocus
                />
              </View>

              <Text style={s.expiry}>⏱ OTP valid for 5 minutes</Text>

              {/* Verify button */}
              <TouchableOpacity style={s.btnOuter} onPress={onVerify} disabled={loading} activeOpacity={0.85}>
                <LinearGradient
                  colors={["#2D6CFB", "#1040CC"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={s.btnGrad}
                >
                  <Text style={s.btnTxt}>
                    {loading ? "Verifying…" : "Verify OTP & Login"}
                  </Text>
                  <View style={s.btnArrow}>
                    <Ionicons name="checkmark" size={18} color="#2D6CFB" />
                  </View>
                </LinearGradient>
              </TouchableOpacity>

              {/* Resend */}
              <TouchableOpacity style={s.resendBtn} onPress={onResend} activeOpacity={0.75}>
                <Ionicons name="refresh-outline" size={16} color="#2D6CFB" style={{ marginRight: 6 }} />
                <Text style={s.resendTxt}>Resend OTP</Text>
              </TouchableOpacity>

            </View>

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
    paddingHorizontal: 16,
  },

  // ── Card ──────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 28,
    shadowColor: "#0A1F6E",
    shadowOpacity: 0.22,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 16,
  },

  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: "#F0F4FF",
    borderWidth: 1, borderColor: "#DDE6F8",
    alignItems: "center", justifyContent: "center",
  },
  iconCircle: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: "#EEF3FF",
    borderWidth: 1.5, borderColor: "#DDE6F8",
    alignItems: "center", justifyContent: "center",
  },

  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0D1B3E",
    textAlign: "center",
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    color: "#6B82A8",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 18,
  },
  phoneHighlight: {
    fontWeight: "800",
    color: "#1A56DB",
  },
  divider: {
    height: 1,
    backgroundColor: "#EEF3FF",
    marginBottom: 18,
  },

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
    height: 58,
    marginBottom: 10,
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
  otpInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: "800",
    color: "#10204A",
    letterSpacing: 10,
    paddingVertical: 0,
  },

  expiry: {
    fontSize: 12,
    color: "#6B82A8",
    textAlign: "center",
    marginBottom: 18,
  },

  btnOuter: {
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#2D6CFB",
    shadowOpacity: 0.32,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
    marginBottom: 4,
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
    marginLeft: 32,
  },
  btnArrow: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: "#FFFFFF",
    alignItems: "center", justifyContent: "center",
  },

  resendBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
  },
  resendTxt: {
    fontSize: 14,
    fontWeight: "700",
    color: "#2D6CFB",
  },
});

export default DriverOtpScreen;
