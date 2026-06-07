import { useEffect, useState } from "react";
import { View, StyleSheet } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AdminStackParamList } from "../../navigation/AdminNavigator";
import { fetchUser, updateUser } from "../../services/adminService";
import { FormScreen, GlassCard, GlassField, GlassButton } from "../../components/GlassUI";
import { Toast, useToast } from "../../components/Toast";

// Maps raw backend/DB error messages to clean user-friendly messages
const friendlyError = (raw: string): string => {
  const r = (raw || "").toLowerCase();
  if (r.includes("phone") || r.includes("unique_phone"))       return "Phone number already exists. Please use a different phone number.";
  if (r.includes("email") || r.includes("unique_email"))       return "Email address already exists. Please use a different email address.";
  if (r.includes("username") || r.includes("unique_username")) return "Username already exists. Please choose another username.";
  if (r.includes("duplicate") || r.includes("unique") || r.includes("already exists")) return "A user with these details already exists. Please check and try again.";
  if (r.includes("constraint"))                                return "This information conflicts with an existing record. Please review your inputs.";
  return "Failed to update user. Please try again.";
};

type Props = NativeStackScreenProps<AdminStackParamList, "EditUser">;

const EditUserScreen = ({ route, navigation }: Props) => {
  const { clientId } = route.params;
  const [fullName,        setFullName]        = useState("");
  const [emailAddress,    setEmailAddress]    = useState("");
  const [phoneNumber,     setPhoneNumber]     = useState("");
  const [dialCode,        setDialCode]        = useState("+91");
  const [role,            setRole]            = useState("");
  const [roleDescription, setRoleDescription] = useState("");
  const [newUsername,     setNewUsername]     = useState("");
  const [newPassword,     setNewPassword]     = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading,         setLoading]         = useState(false);
  const { toast, showToast, hideToast } = useToast();

  useEffect(() => {
    fetchUser(clientId).then(u => {
      setFullName(u.full_name || "");
      setEmailAddress(u.email_address || "");
      setPhoneNumber(u.phone_number || "");
      setDialCode(u.dial_code || "+91");
      setRole(u.role || "");
      setRoleDescription(u.role_description || "");
    }).catch(() => showToast("Failed to load user.", "error"));
  }, [clientId]);

  const onSave = async () => {
    if (!fullName.trim())    { showToast("Full name is required.", "warning"); return; }
    if (!phoneNumber.trim()) { showToast("Phone number is required.", "warning"); return; }
    if (newUsername.trim() && newUsername.trim().length < 3) {
      showToast("New username must be at least 3 characters.", "warning"); return;
    }
    if (newPassword.trim() && newPassword.trim().length < 6) {
      showToast("New password must be at least 6 characters.", "warning"); return;
    }
    if (newPassword.trim() && newPassword.trim() !== confirmPassword.trim()) {
      showToast("Passwords do not match.", "warning"); return;
    }
    setLoading(true);
    try {
      await updateUser(clientId, {
        fullName:        fullName.trim(),
        emailAddress:    emailAddress.trim(),
        phoneNumber:     phoneNumber.trim(),
        dialCode:        dialCode.trim(),
        role:            role.trim(),
        roleDescription: roleDescription.trim(),
        newUsername:     newUsername.trim() || undefined,
        newPassword:     newPassword.trim() || undefined,
      });
      showToast("User updated successfully.", "success");
      setTimeout(() => navigation.goBack(), 1500);
    } catch (e: any) {
      const raw = e?.response?.data?.error || e?.response?.data?.message || "";
      showToast(friendlyError(raw), "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormScreen title="Edit User" subtitle="Update user details" onBack={() => navigation.goBack()}
      toast={<Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={hideToast} />}>
      <GlassCard>
        <GlassField icon="person-outline"        label="Full Name"        value={fullName}        onChangeText={setFullName}        placeholder="Enter full name"        autoCapitalize="words" />
        <GlassField icon="mail-outline"          label="Email Address"    value={emailAddress}    onChangeText={setEmailAddress}    placeholder="Enter email address"    keyboardType="email-address" />
        <View style={s.phoneRow}>
          <View style={s.dialWrap}>
            <GlassField icon="flag-outline" label="Dial Code" value={dialCode} onChangeText={setDialCode} placeholder="+91" keyboardType="phone-pad" />
          </View>
          <View style={s.phoneWrap}>
            <GlassField icon="call-outline" label="Phone Number" value={phoneNumber} onChangeText={setPhoneNumber} placeholder="10-digit number" keyboardType="phone-pad" maxLength={10} />
          </View>
        </View>
        <GlassField icon="shield-outline"        label="Role"             value={role}            onChangeText={setRole}            placeholder="e.g. Admin, Client" />
        <GlassField icon="document-text-outline" label="Role Description" value={roleDescription} onChangeText={setRoleDescription} placeholder="Enter role description" autoCapitalize="sentences" />

        {/* ── Login Credentials Section ── */}
        <GlassField icon="person-add-outline"    label="New Username (optional)"  value={newUsername}     onChangeText={setNewUsername}     placeholder="Enter new username"  autoCapitalize="none" autoCorrect={false} />
        <GlassField icon="lock-open-outline"     label="New Password"  value={newPassword}     onChangeText={setNewPassword}     placeholder="Min 6 characters"   secureTextEntry autoCapitalize="none" />
        <GlassField icon="lock-closed-outline"   label="Confirm Password"         value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Re-enter new password" secureTextEntry autoCapitalize="none" />

        <GlassButton label="Save Changes" onPress={onSave} loading={loading} color="#16A34A" icon="checkmark" />
      </GlassCard>
    </FormScreen>
  );
};

const s = StyleSheet.create({
  phoneRow: { flexDirection: "row", gap: 10 },
  dialWrap: { width: 90 },
  phoneWrap:{ flex: 1 },
});

export default EditUserScreen;
