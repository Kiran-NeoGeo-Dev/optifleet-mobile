import { useState } from "react";
import { View, Text, Image, TouchableOpacity, Modal, ScrollView, StyleSheet, StatusBar } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { MainStackParamList } from "../../navigation/MainNavigator";
import { updateDriver } from "../../services/driverService";
import { PageHeader, GlassButton } from "../../components/GlassUI";
import { Toast, useToast } from "../../components/Toast";

type Props = NativeStackScreenProps<MainStackParamList, "EditDriverPhotos">;

const EditDriverPhotosScreen = ({ route, navigation }: Props) => {
  const { driverId, driverPayload } = route.params;
  const [frontFace, setFrontFace] = useState<string | null>(null);
  const [leftFace,  setLeftFace]  = useState<string | null>(null);
  const [rightFace, setRightFace] = useState<string | null>(null);
  const [loading, setLoading]     = useState(false);
  const [modal, setModal]         = useState<{ visible: boolean; setter: (v: string | null) => void }>({ visible: false, setter: () => {} });
  const [preview, setPreview]     = useState<{ visible: boolean; base64: string; uri: string; setter: (v: string | null) => void }>({
    visible: false, base64: "", uri: "", setter: () => {},
  });
  const { toast, showToast, hideToast } = useToast();

  const openModal = (setter: (v: string | null) => void) => setModal({ visible: true, setter });
  const closePreview = () => setPreview({ visible: false, base64: "", uri: "", setter: () => {} });

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") { showToast("Camera permission is required to take photos.", "warning"); return; }
    // Capture raw — no forced crop, same as DriverPhotosScreen
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], base64: true, quality: 0.4, allowsEditing: false });
    setModal({ visible: false, setter: () => {} });
    if (!r.canceled && r.assets[0].base64) {
      // Open preview modal — user chooses Save, Crop, or Discard
      setPreview({ visible: true, base64: r.assets[0].base64, uri: r.assets[0].uri, setter: modal.setter });
    }
  };

  const cropPhoto = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"], base64: true, quality: 0.4,
      allowsEditing: true, aspect: [1, 1], exif: false,
    });
    if (!r.canceled && r.assets[0].base64) preview.setter(r.assets[0].base64);
    closePreview();
  };

  const fromGallery = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], base64: true, quality: 0.4, allowsEditing: false, selectionLimit: 1, exif: false });
    if (!r.canceled && r.assets[0].base64) modal.setter(r.assets[0].base64);
    setModal({ visible: false, setter: () => {} });
  };

  const onSubmit = async () => {
    setLoading(true);
    try {
      await updateDriver(driverId, { ...driverPayload, frontFaceImage: frontFace, leftFaceImage: leftFace, rightFaceImage: rightFace });
      showToast("Driver photos updated successfully.", "success");
      setTimeout(() => navigation.popToTop(), 1500);
    } catch { showToast("Failed to update driver photos. Please try again.", "error"); }
    finally { setLoading(false); }
  };

  const PhotoCard = ({ title, instruction, image, onUpload }: { title: string; instruction: string; image: string | null; onUpload: () => void }) => (
    <View style={s.card}>
      <View style={s.cardHeader}>
        <Text style={s.cardTitle}>{title}</Text>
        <View style={[s.badge, image ? s.badgeDone : s.badgePending]}>
          <View style={[s.badgeDot, { backgroundColor: image ? "#22C55E" : "#F59E0B" }]} />
          <Text style={[s.badgeTxt, { color: image ? "#16A34A" : "#B45309" }]}>{image ? "Done" : "Pending"}</Text>
        </View>
      </View>
      <View style={s.circleWrap}>
        {image
          ? <Image source={{ uri: `data:image/jpeg;base64,${image}` }} style={s.previewImg} />
          : <View style={s.emptyCircle}>
              <Ionicons name="person-outline" size={52} color="#475569" />
            </View>
        }
      </View>
      <Text style={s.instruction}>{instruction}</Text>
      <TouchableOpacity style={s.uploadBtn} onPress={onUpload} activeOpacity={0.82}>
        <Ionicons name="refresh-outline" size={16} color="#fff" />
        <Text style={s.uploadBtnTxt}>{image ? "Retake" : "Upload Photo"}</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <StatusBar barStyle="light-content" backgroundColor="#0A1F44" />
      <LinearGradient
        colors={["#0A1F44", "#0D3B8E", "#1565C0"]}
        locations={[0, 0.5, 1]}
        start={{ x: 0.15, y: 0 }} end={{ x: 0.85, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={{ flex: 1 }}>
        <PageHeader title="Edit Driver Photos" subtitle="Retake face photos" onBack={() => navigation.goBack()} />
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          <PhotoCard title="Front Face Image"   instruction="Face the camera directly"    image={frontFace} onUpload={() => openModal(setFrontFace)} />
          <PhotoCard title="Left Face Profile"  instruction="Turn your head to the left"  image={leftFace}  onUpload={() => openModal(setLeftFace)} />
          <PhotoCard title="Right Face Profile" instruction="Turn your head to the right" image={rightFace} onUpload={() => openModal(setRightFace)} />
          <TouchableOpacity style={s.resubmitBtn} onPress={onSubmit} disabled={loading} activeOpacity={0.85}>
            <LinearGradient colors={["#22C55E", "#16A34A"]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={s.resubmitGrad}>
              <Ionicons name="checkmark-circle" size={18} color="#fff" style={{ marginRight: 8 }} />
              <Text style={s.resubmitTxt}>{loading ? "Please wait…" : "Resubmit Driver Details"}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>

        <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={hideToast} />
      </SafeAreaView>

      <Modal visible={modal.visible} transparent animationType="fade" onRequestClose={() => setModal({ visible: false, setter: () => {} })}>
        <View style={s.modalBg}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>Select Source</Text>
            <TouchableOpacity style={s.modalBtn} onPress={takePhoto}>
              <Ionicons name="camera" size={20} color="#1565C0" />
              <Text style={s.modalBtnTxt}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.modalBtn} onPress={fromGallery}>
              <Ionicons name="image" size={20} color="#1565C0" />
              <Text style={s.modalBtnTxt}>Choose from Gallery</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.modalBtn} onPress={() => setModal({ visible: false, setter: () => {} })}>
              <Text style={{ color: "#EF4444", fontSize: 15, fontWeight: "700" }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Photo Preview Modal — same as DriverPhotosScreen: Save / Crop / Discard */}
      <Modal visible={preview.visible} transparent animationType="fade" onRequestClose={closePreview}>
        <View style={s.modalBg}>
          <View style={[s.modalBox, { width: "88%", paddingHorizontal: 16, paddingBottom: 16 }]}>
            <Text style={s.modalTitle}>Photo Preview</Text>
            <Image
              source={{ uri: `data:image/jpeg;base64,${preview.base64}` }}
              style={s.previewLarge}
              resizeMode="cover"
            />
            <Text style={s.previewHint}>Save to upload as-is, or Crop to adjust the image.</Text>
            <View style={s.previewBtnRow}>
              <TouchableOpacity
                style={[s.previewBtn, s.previewBtnSave]}
                onPress={() => { preview.setter(preview.base64); closePreview(); }}
                activeOpacity={0.82}
              >
                <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                <Text style={s.previewBtnTxt}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.previewBtn, s.previewBtnCrop]}
                onPress={cropPhoto}
                activeOpacity={0.82}
              >
                <Ionicons name="crop-outline" size={18} color="#1565C0" />
                <Text style={[s.previewBtnTxt, { color: "#1565C0" }]}>Crop</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={closePreview} style={{ marginTop: 8, paddingVertical: 8 }}>
              <Text style={{ color: "#EF4444", fontSize: 14, fontWeight: "700", textAlign: "center" }}>Discard</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const s = StyleSheet.create({
  scroll:       { paddingHorizontal: 16, paddingBottom: 90 },
  // White card
  card:         { backgroundColor: "#F8F5EF", borderRadius: 20, padding: 16, marginBottom: 14, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  cardHeader:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  cardTitle:    { fontSize: 15, fontWeight: "700", color: "#0D1B3E" },
  badge:        { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1 },
  badgeDone:    { backgroundColor: "rgba(34,197,94,0.10)", borderColor: "rgba(34,197,94,0.40)" },
  badgePending: { backgroundColor: "rgba(234,179,8,0.08)", borderColor: "rgba(234,179,8,0.30)" },
  badgeDot:     { width: 6, height: 6, borderRadius: 3 },
  badgeTxt:     { fontSize: 11, fontWeight: "700" },
  circleWrap:   { alignItems: "center", marginBottom: 10 },
  previewImg:   { width: 110, height: 110, borderRadius: 55 },
  emptyCircle:  { width: 110, height: 110, borderRadius: 55, backgroundColor: "#F3F4F6", borderWidth: 1.5, borderColor: "rgba(148,163,184,0.22)", borderStyle: "dashed", alignItems: "center", justifyContent: "center" },
  instruction:  { fontSize: 13, fontWeight: "600", color: "#1E293B", textAlign: "center", marginBottom: 12 },
  uploadBtn:    { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#1D6FE8", borderRadius: 12, paddingVertical: 12, shadowColor: "#1565C0", shadowOpacity: 0.30, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  uploadBtnTxt: { fontSize: 14, fontWeight: "700", color: "#fff" },
  // Modal
  resubmitBtn:  { borderRadius: 14, overflow: "hidden", marginTop: 8, marginBottom: 8, shadowColor: "#16A34A", shadowOpacity: 0.40, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  resubmitGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 16, borderRadius: 14 },
  resubmitTxt:  { fontSize: 16, fontWeight: "800", color: "#fff", letterSpacing: 0.3 },
  modalBg:      { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", alignItems: "center" },
  modalBox:     { backgroundColor: "#FFFFFF", borderRadius: 20, padding: 24, width: "80%", alignItems: "center", shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 20, elevation: 12 },
  modalTitle:   { fontSize: 17, fontWeight: "800", color: "#0D1B3E", marginBottom: 20 },
  modalBtn:     { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, width: "100%", justifyContent: "center" },
  modalBtnTxt:  { fontSize: 15, color: "#0D1B3E", fontWeight: "600" },
  // Preview modal
  previewLarge:    { width: "100%", height: 240, borderRadius: 14, marginBottom: 10 },
  previewHint:     { fontSize: 12, color: "#4A6A8E", textAlign: "center", marginBottom: 14 },
  previewBtnRow:   { flexDirection: "row", gap: 10, width: "100%" },
  previewBtn:      { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 13, borderRadius: 12, borderWidth: 1 },
  previewBtnSave:  { backgroundColor: "#16A34A", borderColor: "#14532D" },
  previewBtnCrop:  { backgroundColor: "rgba(21,101,192,0.08)", borderColor: "rgba(21,101,192,0.35)" },
  previewBtnTxt:   { fontSize: 14, fontWeight: "700", color: "#fff" },
});

export default EditDriverPhotosScreen;
