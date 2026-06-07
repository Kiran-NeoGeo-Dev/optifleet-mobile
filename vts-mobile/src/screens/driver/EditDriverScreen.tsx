import { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { MainStackParamList } from "../../navigation/MainNavigator";
import { fetchDriver, updateDriver } from "../../services/driverService";
import { Ionicons } from "@expo/vector-icons";
import { FormScreen, GlassCard, GlassField, GlassDateField, GlassToggle, GlassButton, FieldLabel } from "../../components/GlassUI";
import { Toast, useToast } from "../../components/Toast";
import ClientSelector, { ClientOption } from "../../components/ClientSelector";
import { useAuth } from "../../hooks/useAuth";

type Props = NativeStackScreenProps<MainStackParamList, "EditDriver">;

const EditDriverScreen = ({ route, navigation }: Props) => {
  const { driverId } = route.params;
  const { isAdmin } = useAuth();
  const [selectedClient, setSelectedClient] = useState<ClientOption | null>(null);
  const [driverName, setDriverName]       = useState("");
  const [phoneNumber, setPhoneNumber]     = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [aadharNumber, setAadharNumber]   = useState("");
  const [licenseExpiry, setLicenseExpiry] = useState<Date | null>(null);
  const [showPicker, setShowPicker]       = useState(false);
  const [dob, setDob]                     = useState("");  // DD/MM/YYYY
  const [dobDate, setDobDate]             = useState<Date>(new Date(1990, 0, 1));
  const [showDobPicker, setShowDobPicker] = useState(false);
  const [status, setStatus]               = useState<"ACTIVE" | "INACTIVE">("ACTIVE");
  const [comments, setComments]           = useState("");
  const [errors, setErrors]               = useState<Record<string, string>>({});
  const { toast, showToast, hideToast }   = useToast();

  const fmt = (d: Date) =>
    `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;

  useEffect(() => {
    fetchDriver(driverId).then(d => {
      setDriverName(d.driverName);
      setPhoneNumber(d.phoneNumber || "");
      setLicenseNumber(d.licenseNumber || "");
      setAadharNumber(d.aadharNumber || "");
      if (d.licenseExpiry) setLicenseExpiry(new Date(d.licenseExpiry));
      setStatus(d.status ? "ACTIVE" : "INACTIVE");
      setComments(d.comments || "");
      // Load existing DOB from password field
      if (d.password) setDob(d.password);
      if (d.clientId) {
        setSelectedClient({ id: d.clientId, full_name: "", username: "" });
      }
    });
  }, [driverId]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!driverName.trim()) e.driverName = "Driver name is required.";
    else if (!/^[a-zA-Z\s]+$/.test(driverName.trim())) e.driverName = "Letters and spaces only.";
    if (!phoneNumber.trim()) e.phoneNumber = "Phone number is required.";
    else if (!/^\d{10}$/.test(phoneNumber.trim())) e.phoneNumber = "Must be exactly 10 digits.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onContinue = () => {
    if (validate()) {
      navigation.navigate("EditDriverPhotos", {
        driverId,
        driverPayload: {
          driverName, phoneNumber, comments,
          licenseNumber, aadharNumber,
          licenseExpiry: licenseExpiry ? licenseExpiry.toISOString() : undefined,
          status,
          username: phoneNumber.trim(),
          password: dob.trim(),  // Date of Birth DD/MM/YYYY stored as password
          clientId: selectedClient?.id,
        },
      });
    }
  };

  const onSave = async () => {
    if (!validate()) return;
    try {
      await updateDriver(driverId, {
        driverName, phoneNumber, comments,
        licenseNumber, aadharNumber,
        licenseExpiry: licenseExpiry ? licenseExpiry.toISOString().split("T")[0] : undefined,
        status,
        username: phoneNumber.trim(),
        password: dob.trim(),  // Date of Birth DD/MM/YYYY stored as password
        clientId: selectedClient?.id,
      });
      showToast("Driver updated successfully.", "success");
      setTimeout(() => navigation.goBack(), 1500);
    } catch {
      showToast("Failed to update driver. Please try again.", "error");
    }
  };

  return (
    <FormScreen title="Edit Driver" subtitle="Update driver details" onBack={() => navigation.goBack()} toast={<Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={hideToast} />}>
      <GlassCard>
        {isAdmin && (
          <ClientSelector
            selectedClientId={selectedClient?.id ?? null}
            onSelect={setSelectedClient}
          />
        )}
        <GlassField icon="person-outline"  label="Driver Name"    value={driverName}   onChangeText={t => { setDriverName(t);   if (errors.driverName)  setErrors({...errors, driverName: ""}); }}  placeholder="Full name"          autoCapitalize="words"       error={errors.driverName} />

        {/* ── LOGIN CREDENTIALS: Mobile Number + Date of Birth ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Login Credentials</Text>
        </View>

        <GlassField icon="call-outline"    label="Mobile Number"   value={phoneNumber}  onChangeText={t => { setPhoneNumber(t);  if (errors.phoneNumber) setErrors({...errors, phoneNumber: ""}); }}  placeholder="10-digit number"    keyboardType="phone-pad"     error={errors.phoneNumber} />

        {/* Date of Birth — directly below Mobile Number */}
        <View style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <Ionicons name="gift-outline" size={14} color="#1565C0" />
            <Text style={{ fontSize: 12, fontWeight: "700", color: "#1A2F5C", textTransform: "uppercase", letterSpacing: 0.7 }}>Date of Birth</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#E8CBA7", borderRadius: 12, borderWidth: 1, borderColor: "rgba(120,70,20,0.22)", paddingHorizontal: 14, height: 48 }}>
            <TextInput
              style={{ flex: 1, fontSize: 14, color: "#2B1D0E" }}
              value={dob}
              onChangeText={t => {
                const digits = t.replace(/\D/g, "");
                let formatted = digits;
                if (digits.length > 2) formatted = digits.slice(0,2) + "/" + digits.slice(2);
                if (digits.length > 4) formatted = digits.slice(0,2) + "/" + digits.slice(2,4) + "/" + digits.slice(4,8);
                setDob(formatted);
              }}
              placeholder="DD/MM/YYYY"
              placeholderTextColor="#6B7280"
              keyboardType="numeric"
              maxLength={10}
            />
            <TouchableOpacity onPress={() => setShowDobPicker(true)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="calendar" size={20} color="#1565C0" />
            </TouchableOpacity>
          </View>
        </View>
        {showDobPicker && (
          <DateTimePicker
            value={dobDate}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            maximumDate={new Date()}
            onChange={(_, d) => {
              setShowDobPicker(false);
              if (d) { setDobDate(d); setDob(fmt(d)); }
            }}
          />
        )}
        <GlassField icon="card-outline"    label="Driving License Number" value={licenseNumber} onChangeText={setLicenseNumber} placeholder="License number" autoCapitalize="characters" />
        <GlassField icon="finger-print-outline" label="Aadhar Number" value={aadharNumber} onChangeText={setAadharNumber} placeholder="12-digit Aadhar" keyboardType="numeric" maxLength={12} />

        <GlassDateField icon="calendar-outline" label="Driving License Expiry" value={licenseExpiry ? fmt(licenseExpiry) : null} onPress={() => setShowPicker(true)} />
        {showPicker && (
          <DateTimePicker
            value={licenseExpiry ?? new Date()}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={(_, d) => { setShowPicker(false); if (d) setLicenseExpiry(d); }}
          />
        )}

        {/* DOB moved up — removed from here */}

        <View style={styles.fieldWrap}>
          <FieldLabel icon="toggle-outline" label="Status" />
          <GlassToggle value={status} onChange={setStatus} />
        </View>

        <GlassField icon="chatbubble-outline" label="Notes / Comments (Optional)" value={comments} onChangeText={setComments} placeholder="Additional notes (optional)" multiline />

        <GlassButton label="Continue to Retake Photos" onPress={onContinue} icon="arrow-forward" color="#D97706" />
        <GlassButton label="Save Driver Details" onPress={onSave} color="#16A34A" icon="checkmark" />
      </GlassCard>
    </FormScreen>
  );
};

const styles = StyleSheet.create({
  fieldWrap:     { marginBottom: 16 },
  sectionHeader: { marginTop: 8, marginBottom: 14, borderBottomWidth: 1, borderBottomColor: "rgba(21,101,192,0.12)", paddingBottom: 8 },
  sectionTitle:  { fontSize: 13, fontWeight: "800", color: "#1565C0", letterSpacing: 1.2, textTransform: "uppercase" },
});

export default EditDriverScreen;
