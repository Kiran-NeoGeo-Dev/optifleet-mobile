import { useState } from "react";
import { View, Text, Image, TouchableOpacity, Modal, ScrollView, StyleSheet, StatusBar, ActivityIndicator, Linking, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { MainStackParamList } from "../../navigation/MainNavigator";
import { createDriver } from "../../services/driverService";
import { Toast, useToast } from "../../components/Toast";

type Props = NativeStackScreenProps<MainStackParamList, "DriverPhotos">;

const DriverPhotosScreen = ({ route, navigation }: Props) => {
  const { driverPayload } = route.params;
  const [frontFace, setFrontFace] = useState<string | null>(null);
  const [leftFace,  setLeftFace]  = useState<string | null>(null);
  const [rightFace, setRightFace] = useState<string | null>(null);
  const [loading, setLoading]     = useState(false);
  const [modal, setModal]         = useState<{ visible: boolean; setter: (v: string | null) => void }>({ visible: false, setter: () => {} });
  // Preview modal state — shown after camera capture
  const [preview, setPreview]     = useState<{ visible: boolean; base64: string; uri: string; setter: (v: string | null) => void }>({
    visible: false, base64: "", uri: "", setter: () => {},
  });
  const { toast, showToast, hideToast } = useToast();

  const openModal = (setter: (v: string | null) => void) => setModal({ visible: true, setter });

  const closePreview = () => setPreview({ visible: false, base64: "", uri: "", setter: () => {} });

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") { showToast("Camera permission is required to take photos.", "warning"); return; }
    // Capture raw — no crop forced
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], base64: true, quality: 0.4, allowsEditing: false });
    setModal({ visible: false, setter: () => {} });
    if (!r.canceled && r.assets[0].base64) {
      // Show our own preview with Save / Crop options
      setPreview({ visible: true, base64: r.assets[0].base64, uri: r.assets[0].uri, setter: modal.setter });
    }
  };

  const cropPhoto = async () => {
    // Re-launch with allowsEditing on the already-captured URI
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"], base64: true, quality: 0.4,
      allowsEditing: true, aspect: [1, 1], exif: false,
    });
    if (!r.canceled && r.assets[0].base64) {
      preview.setter(r.assets[0].base64);
    }
    closePreview();
  };

  const fromGallery = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], base64: true, quality: 0.4, allowsEditing: false, selectionLimit: 1, exif: false });
    if (!r.canceled && r.assets[0].base64) modal.setter(r.assets[0].base64);
    setModal({ visible: false, setter: () => {} });
  };

  const openSmsApp = (phone: string, name: string, mobileNumber: string, dateOfBirth: string) => {
    const msg =
      `Dear ${name}, Welcome to OptiFleet - A Solution by NeoGeoInfo Technologies!\n\n` +
      `Welcome aboard! We're excited to have you with us.\n\n` +
      `Your account is now fully set up. Below are your login details:\n\n` +
      `Your Login Credentials\n` +
      `Mobile Number: ${mobileNumber}\n` +
      `________________________\n` +
      `Date of Birth: ${dateOfBirth}\n` +
      `________________________\n\n` +
      `To login: Open OptiFleet app → Select Driver → Enter your Mobile Number and Date of Birth (DD/MM/YYYY).\n\n` +
      `We look forward to helping you optimize your fleet operations!\n\n` +
      `Best regards,\nThe OptiFleet Team\nNeoGeoInfo Technologies`;
    const smsUrl = `sms:${phone}${Platform.OS === "ios" ? "&" : "?"}body=${encodeURIComponent(msg)}`;
    Linking.canOpenURL(smsUrl)
      .then(supported => { if (supported) Linking.openURL(smsUrl); })
      .catch(() => {});
  };

  const onSubmit = async () => {
    setLoading(true);
    try {
      await createDriver({ ...driverPayload, frontFaceImage: frontFace, leftFaceImage: leftFace, rightFaceImage: rightFace, status: driverPayload.status, clientId: driverPayload.clientId });
      showToast("Driver added successfully.", "success");
      // Open device SMS app with prefilled credentials
      if (driverPayload.phoneNumber && driverPayload.password) {
        openSmsApp(
          driverPayload.phoneNumber,
          driverPayload.driverName,
          driverPayload.phoneNumber,   // mobile number = username
          driverPayload.password        // date of birth = password
        );
      }
      setTimeout(() => navigation.popToTop(), 1500);
    } catch { showToast("Failed to create driver. Please try again.", "error"); }
    finally { setLoading(false); }
  };

  const PhotoCard = ({ title, instruction, image, onUpload }: { title: string; instruction: string; image: string | null; onUpload: () => void }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{title}</Text>
        <View style={[styles.badge, image ? styles.badgeDone : styles.badgePending]}>
          <View style={[styles.badgeDot, { backgroundColor: image ? "#22C55E" : "#F59E0B" }]} />
          <Text style={[styles.badgeTxt, { color: image ? "#22C55E" : "#F59E0B" }]}>{image ? "Done" : "Pending"}</Text>
        </View>
      </View>
      <View style={styles.circleWrap}>
        {image
          ? <Image source={{ uri: `data:image/jpeg;base64,${image}` }} style={styles.previewImg} />
          : <View style={styles.emptyCircle}>
              <Ionicons name="person-outline" size={36} color="rgba(21,101,192,0.35)" />
            </View>
        }
      </View>
      <Text style={styles.instruction}>{instruction}</Text>
      <TouchableOpacity style={styles.uploadBtn} onPress={onUpload} activeOpacity={0.82}>
        <Ionicons name="cloud-upload-outline" size={16} color="#3B1F0A" />
        <Text style={styles.uploadBtnTxt}>{image ? "Retake" : "Upload Photo"}</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#0A1F44" />
      <LinearGradient
        colors={["#0A1F44", "#0D3B8E", "#1565C0"]}
        locations={[0, 0.5, 1]}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {[0.18, 0.38, 0.58, 0.78].map((t, i) => (
        <View key={`h${i}`} style={[styles.gridH, { top: `${t * 100}%` as any }]} />
      ))}
      {[0.15, 0.50, 0.82].map((t, i) => (
        <View key={`v${i}`} style={[styles.gridV, { left: `${t * 100}%` as any }]} />
      ))}

      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={styles.headerTitle}>Driver Photos</Text>
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeTxt}>Upload face photos for recognition</Text>
            </View>
          </View>
          <View style={{ width: 42 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <PhotoCard title="Front Face Image"   instruction="Face the camera directly"     image={frontFace} onUpload={() => openModal(setFrontFace)} />
          <PhotoCard title="Left Face Profile"  instruction="Turn your head to the left"   image={leftFace}  onUpload={() => openModal(setLeftFace)} />
          <PhotoCard title="Right Face Profile" instruction="Turn your head to the right"  image={rightFace} onUpload={() => openModal(setRightFace)} />

          {/* Submit button */}
          <TouchableOpacity style={styles.submitBtn} onPress={onSubmit} disabled={loading} activeOpacity={0.84}>
            <LinearGradient
              colors={["#16A34A", "#14532D"]}
              start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
              style={styles.submitGrad}
            >
              <LinearGradient
                colors={["rgba(255,255,255,0.14)", "rgba(255,255,255,0.00)"]}
                start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
                style={styles.submitGloss}
              />
              {loading
                ? <ActivityIndicator size="small" color="#fff" />
                : <>
                    <Ionicons name="shield-checkmark-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.submitTxt}>Submit Driver Details</Text>
                  </>}
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>

      {/* Preview modal — Save or Crop choice after camera capture */}
      <Modal visible={preview.visible} transparent animationType="fade" onRequestClose={closePreview}>
        <View style={styles.modalBg}>
          <View style={[styles.modalBox, { width: "88%", paddingHorizontal: 16, paddingBottom: 16 }]}>
            <Text style={styles.modalTitle}>Photo Preview</Text>
            <Image
              source={{ uri: `data:image/jpeg;base64,${preview.base64}` }}
              style={styles.previewLarge}
              resizeMode="cover"
            />
            <Text style={styles.previewHint}>Save to upload as-is, or Crop to adjust the image.</Text>
            <View style={styles.previewBtnRow}>
              {/* Save — upload immediately */}
              <TouchableOpacity
                style={[styles.previewBtn, styles.previewBtnSave]}
                onPress={() => { preview.setter(preview.base64); closePreview(); }}
                activeOpacity={0.82}
              >
                <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                <Text style={styles.previewBtnTxt}>Save</Text>
              </TouchableOpacity>
              {/* Crop — open gallery editor */}
              <TouchableOpacity
                style={[styles.previewBtn, styles.previewBtnCrop]}
                onPress={cropPhoto}
                activeOpacity={0.82}
              >
                <Ionicons name="crop-outline" size={18} color="#1565C0" />
                <Text style={[styles.previewBtnTxt, { color: "#1565C0" }]}>Crop</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={closePreview} style={{ marginTop: 8, paddingVertical: 8 }}>
              <Text style={{ color: "#EF4444", fontSize: 14, fontWeight: "700", textAlign: "center" }}>Discard</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Source select modal */}
      <Modal visible={modal.visible} transparent animationType="fade" onRequestClose={() => setModal({ visible: false, setter: () => {} })}>
        <View style={styles.modalBg}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Select Source</Text>
            <TouchableOpacity style={styles.modalBtn} onPress={takePhoto}>
              <Ionicons name="camera" size={20} color="#1565C0" />
              <Text style={styles.modalBtnTxt}>Take Photo</Text>
            </TouchableOpacity>
            <View style={styles.modalDivider} />
            <TouchableOpacity style={styles.modalBtn} onPress={fromGallery}>
              <Ionicons name="image" size={20} color="#1565C0" />
              <Text style={styles.modalBtnTxt}>Choose from Gallery</Text>
            </TouchableOpacity>
            <View style={styles.modalDivider} />
            <TouchableOpacity style={styles.modalBtn} onPress={() => setModal({ visible: false, setter: () => {} })}>
              <Text style={{ color: "#EF4444", fontSize: 15, fontWeight: "700" }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={hideToast} />
    </View>
  );
};

const styles = StyleSheet.create({
  root:          { flex: 1 },
  gridH:         { position: "absolute", left: 0, right: 0, height: 1, backgroundColor: "rgba(255,255,255,0.025)" },
  gridV:         { position: "absolute", top: 0, bottom: 0, width: 1,  backgroundColor: "rgba(255,255,255,0.025)" },

  // Header
  header:        { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 10, paddingBottom: 14 },
  backBtn:       { width: 42, height: 42, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.12)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  headerTitle:   { fontSize: 22, fontWeight: "800", color: "#fff", letterSpacing: -0.3 },
  headerBadge:   { backgroundColor: "rgba(255,255,255,0.10)", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4, marginTop: 4, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)" },
  headerBadgeTxt:{ fontSize: 11, fontWeight: "600", color: "rgba(255,255,255,0.75)" },

  scroll:        { paddingHorizontal: 16, paddingBottom: 90 },

  // Photo card — cream background
  card:          { backgroundColor: "#F6F1E9", borderRadius: 20, padding: 16, marginBottom: 14, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 5 },
  cardHeader:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  cardTitle:     { fontSize: 15, fontWeight: "700", color: "#0D1B3E" },
  badge:         { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1 },
  badgeDone:     { backgroundColor: "rgba(34,197,94,0.12)",  borderColor: "#22C55E55" },
  badgePending:  { backgroundColor: "rgba(245,158,11,0.15)", borderColor: "#F59E0B55" },
  badgeDot:      { width: 6, height: 6, borderRadius: 3 },
  badgeTxt:      { fontSize: 11, fontWeight: "700" },
  circleWrap:    { alignItems: "center", marginBottom: 10 },
  previewImg:    { width: 110, height: 110, borderRadius: 55, borderWidth: 2, borderColor: "rgba(21,101,192,0.25)" },
  emptyCircle:   { width: 110, height: 110, borderRadius: 55, backgroundColor: "rgba(21,101,192,0.06)", borderWidth: 1.5, borderColor: "rgba(21,101,192,0.20)", borderStyle: "dashed", alignItems: "center", justifyContent: "center" },
  instruction:   { fontSize: 12, color: "#4A6A8E", textAlign: "center", marginBottom: 14 },
  uploadBtn:     { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#E8C9A0", borderRadius: 12, paddingVertical: 11, borderWidth: 1, borderColor: "rgba(160,90,30,0.35)" },
  uploadBtnTxt:  { fontSize: 14, fontWeight: "700", color: "#3B1F0A" },

  // Submit button
  submitBtn:     { borderRadius: 16, overflow: "hidden", marginTop: 4, marginBottom: 8, shadowColor: "#14532D", shadowOpacity: 0.30, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  submitGrad:    { flexDirection: "row", height: 56, alignItems: "center", justifyContent: "center", borderRadius: 16, overflow: "hidden" },
  submitGloss:   { position: "absolute", top: 0, left: 0, right: 0, height: 26, borderRadius: 16 },
  submitTxt:     { fontSize: 16, fontWeight: "800", color: "#fff", letterSpacing: 0.3 },

  // Modal — cream
  modalBg:       { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", alignItems: "center" },
  modalBox:      { backgroundColor: "#F6F1E9", borderRadius: 24, paddingVertical: 8, paddingHorizontal: 0, width: "80%", alignItems: "center", shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 20, elevation: 10 },
  modalTitle:    { fontSize: 17, fontWeight: "800", color: "#0D1B3E", paddingVertical: 16 },
  modalBtn:      { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 14, width: "100%", justifyContent: "center" },
  modalBtnTxt:   { fontSize: 15, color: "#0D1B3E", fontWeight: "600" },
  modalDivider:  { height: 1, width: "100%", backgroundColor: "rgba(160,90,30,0.12)" },
  // Preview modal
  previewLarge:    { width: "100%", height: 240, borderRadius: 14, marginBottom: 10 },
  previewHint:     { fontSize: 12, color: "#4A6A8E", textAlign: "center", marginBottom: 14 },
  previewBtnRow:   { flexDirection: "row", gap: 10, width: "100%" },
  previewBtn:      { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 13, borderRadius: 12, borderWidth: 1 },
  previewBtnSave:  { backgroundColor: "#16A34A", borderColor: "#14532D" },
  previewBtnCrop:  { backgroundColor: "rgba(21,101,192,0.08)", borderColor: "rgba(21,101,192,0.35)" },
  previewBtnTxt:   { fontSize: 14, fontWeight: "700", color: "#fff" },
});

export default DriverPhotosScreen;
