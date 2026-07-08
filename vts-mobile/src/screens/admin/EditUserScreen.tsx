import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, Modal, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AdminStackParamList } from "../../navigation/AdminNavigator";
import { fetchUser, updateUser } from "../../services/adminService";
import { FormScreen, GlassCard, GlassField, GlassButton, FieldLabel } from "../../components/GlassUI";
import { Toast, useToast } from "../../components/Toast";
import { CountryCodePicker } from "../../components/CountryCodePicker";

const W = {
  inputBg:     "#E8CBA7",
  inputBorder: "rgba(120,70,20,0.22)",
  inputText:   "#2B1D0E",
  placeholder: "#6B7280",
  accent:      "#1565C0",
};

const ROLE_OPTIONS = ["User", "Admin"];

const friendlyError = (raw: string): string => {
  const r = (raw || "").toLowerCase();
  if (r.includes("phone") || r.includes("unique_phone"))       return "Phone number already exists. Please use a different phone number.";
  if (r.includes("email") || r.includes("unique_email"))       return "Email address already exists. Please use a different email address.";
  if (r.includes("username") || r.includes("unique_username")) return "Username already exists. Please choose another username.";
  if (r.includes("duplicate") || r.includes("unique") || r.includes("already exists")) return "A user with these details already exists. Please check and try again.";
  if (r.includes("constraint"))                                return "This information conflicts with an existing record. Please review your inputs.";
  return "Failed to update user. Please try again.";
};

// Sorted dial codes longest-first so +971 matches before +97, +1 etc.
const DIAL_CODES_DESC = ["+998","+995","+994","+993","+992","+977","+976","+975","+974","+973","+972","+971","+970","+968","+967","+966","+965","+964","+963","+962","+961","+960","+886","+880","+856","+855","+852","+850","+599","+598","+597","+595","+593","+592","+591","+509","+508","+507","+506","+505","+504","+503","+502","+501","+421","+420","+389","+387","+386","+385","+383","+382","+381","+380","+379","+378","+377","+376","+375","+374","+373","+372","+371","+370","+359","+358","+357","+356","+355","+354","+353","+352","+351","+350","+255","+254","+253","+252","+251","+250","+249","+248","+246","+245","+244","+243","+242","+241","+240","+239","+238","+237","+236","+235","+234","+233","+232","+231","+230","+229","+228","+227","+226","+225","+224","+223","+222","+221","+220","+218","+216","+213","+212","+98","+95","+94","+93","+92","+91","+90","+86","+84","+82","+81","+66","+65","+64","+63","+62","+61","+60","+58","+57","+56","+55","+54","+53","+52","+51","+49","+48","+47","+46","+45","+44","+43","+41","+40","+39","+36","+34","+33","+32","+31","+30","+27","+20","+7","+1"];

const parsePhone = (raw: string): { dial: string; number: string } => {
  if (!raw.startsWith("+")) return { dial: "+91", number: raw };
  for (const d of DIAL_CODES_DESC) {
    if (raw.startsWith(d)) return { dial: d, number: raw.slice(d.length) };
  }
  return { dial: "+91", number: raw.replace(/^\+/, "") };
};

type Props = NativeStackScreenProps<AdminStackParamList, "EditUser">;

const RoleDropdown = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => {
  const [open, setOpen] = useState(false);
  return (
    <View style={s.fieldWrap}>
      <FieldLabel icon="shield-outline" label="Role" />
      <TouchableOpacity
        style={s.dropTrigger}
        onPress={() => setOpen(true)}
        activeOpacity={0.8}
      >
        <Text style={[s.dropTxt, !value && { color: W.placeholder }]}>{value || "Select Role"}</Text>
        <Ionicons name="chevron-down" size={16} color={W.placeholder} />
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={s.backdrop} onPress={() => setOpen(false)} activeOpacity={1}>
          <View style={s.menu}>
            {ROLE_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt}
                style={[s.menuItem, value === opt && s.menuItemActive]}
                onPress={() => { onChange(opt); setOpen(false); }}
              >
                <Text style={[s.menuTxt, value === opt && s.menuTxtActive]}>{opt}</Text>
                {value === opt && <Ionicons name="checkmark" size={16} color={W.accent} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

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
      const { dial, number } = parsePhone(u.phone_number || "");
      setDialCode(dial);
      setPhoneNumber(number);
      setRole(u.role || "");
      setRoleDescription(u.role_description || "");
    }).catch(() => showToast("Failed to load user.", "error"));
  }, [clientId]);

  const onSave = async () => {
    if (!fullName.trim()) { showToast("Full name is required.", "warning"); return; }
    if (!phoneNumber.trim() || !/^\d{4,15}$/.test(phoneNumber.trim())) {
      showToast("Please enter a valid phone number.", "warning"); return;
    }
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
        phoneNumber:     `${dialCode}${phoneNumber.trim()}`,
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
        <GlassField icon="person-outline"        label="Full Name"       value={fullName}        onChangeText={setFullName}        placeholder="Enter full name"      autoCapitalize="words" />
        <GlassField icon="mail-outline"          label="Email Address"   value={emailAddress}    onChangeText={setEmailAddress}    placeholder="Enter email address"  keyboardType="email-address" />

        {/* ── Phone row: label above, picker + input side by side ── */}
        <View style={s.fieldWrap}>
          <FieldLabel icon="call-outline" label="Phone Number" />
          <View style={s.phoneRow}>
            <CountryCodePicker
              value={dialCode}
              onChange={setDialCode}
              inputBg={W.inputBg}
              inputBorder={W.inputBorder}
              inputText={W.inputText}
            />
          <View style={{ flex: 1 }}>
            <GlassField
              icon="call-outline" label=""
              value={phoneNumber}
              onChangeText={t => setPhoneNumber(t.replace(/[^0-9]/g, ""))}
              placeholder="Phone number"
              keyboardType="phone-pad"
              maxLength={15}
              noMargin
            />
          </View>
          </View>
        </View>

        <RoleDropdown value={role} onChange={setRole} />
        <GlassField icon="document-text-outline" label="Role Description" value={roleDescription} onChangeText={setRoleDescription} placeholder="Enter role description" autoCapitalize="sentences" />
        <GlassField icon="person-add-outline"    label="New Username (optional)" value={newUsername}     onChangeText={setNewUsername}     placeholder="Enter new username"    autoCapitalize="none" autoCorrect={false} />
        <GlassField icon="lock-open-outline"     label="New Password"            value={newPassword}     onChangeText={setNewPassword}     placeholder="Min 6 characters"     secureTextEntry autoCapitalize="none" />
        <GlassField icon="lock-closed-outline"   label="Confirm Password"        value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Re-enter new password" secureTextEntry autoCapitalize="none" />
        <GlassButton label="Save Changes" onPress={onSave} loading={loading} color="#16A34A" icon="checkmark" />
      </GlassCard>
    </FormScreen>
  );
};

const s = StyleSheet.create({
  fieldWrap:       { marginBottom: 12 },
  phoneRow:        { flexDirection: "row", alignItems: "center", gap: 8 },
  dropTrigger:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#E8CBA7", borderRadius: 9, borderWidth: 1, borderColor: "rgba(120,70,20,0.22)", paddingHorizontal: 11, paddingVertical: 9, fontSize: 13 },
  dropTxt:         { fontSize: 13, color: "#2B1D0E", fontWeight: "600" },
  backdrop:        { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "center", alignItems: "center" },
  menu:            { backgroundColor: "#fff", borderRadius: 12, width: 200, overflow: "hidden", elevation: 8, shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } },
  menuItem:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14, paddingHorizontal: 18 },
  menuItemActive:  { backgroundColor: "#E8CBA7" },
  menuTxt:         { fontSize: 14, color: "#2B1D0E", fontWeight: "600" },
  menuTxtActive:   { color: "#1565C0" },
});

export default EditUserScreen;
