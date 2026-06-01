import { useEffect, useState } from "react";
import { View, StyleSheet, Platform } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { MainStackParamList } from "../../navigation/MainNavigator";
import { fetchDriver, updateDriver } from "../../services/driverService";
import { FormScreen, GlassCard, GlassField, GlassDateField, GlassToggle, GlassButton, FieldLabel } from "../../components/GlassUI";
import { COLORS } from "../../components/ScreenBg";
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
        <GlassField icon="call-outline"    label="Phone Number"   value={phoneNumber}  onChangeText={t => { setPhoneNumber(t);  if (errors.phoneNumber) setErrors({...errors, phoneNumber: ""}); }}  placeholder="10-digit number"    keyboardType="phone-pad"     error={errors.phoneNumber} />
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

        <View style={styles.fieldWrap}>
          <FieldLabel icon="toggle-outline" label="Status" />
          <GlassToggle value={status} onChange={setStatus} />
        </View>

        <GlassField icon="chatbubble-outline" label="Comments" value={comments} onChangeText={setComments} placeholder="Additional notes…" multiline />

        <GlassButton label="Continue to Retake Photos" onPress={onContinue} icon="arrow-forward" color="#D97706" />
        <GlassButton label="Save Driver Details" onPress={onSave} color="#16A34A" icon="checkmark" />
      </GlassCard>
    </FormScreen>
  );
};

const styles = StyleSheet.create({ fieldWrap: { marginBottom: 16 } });

export default EditDriverScreen;
