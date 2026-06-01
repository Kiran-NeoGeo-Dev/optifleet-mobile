import { useEffect, useState } from "react";
import { View, Text, Image, ScrollView, StyleSheet, ActivityIndicator, StatusBar } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { MainStackParamList } from "../../navigation/MainNavigator";
import { fetchDriverPhotos } from "../../services/driverService";
import { DriverPhoto } from "../../types/DriverPhoto";
import { TouchableOpacity } from "react-native";

type Props = NativeStackScreenProps<MainStackParamList, "ViewDriverPhotos">;

const ViewDriverPhotosScreen = ({ route, navigation }: Props) => {
  const { driverId } = route.params;
  const [photos, setPhotos] = useState<DriverPhoto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDriverPhotos(driverId).then(setPhotos).finally(() => setLoading(false));
  }, [driverId]);

  const PhotoCard = ({ title, photo }: { title: string; photo?: string | null }) => (
    <View style={s.card}>
      <View style={s.cardHeader}>
        <View style={s.cardIconWrap}>
          <Ionicons name="person-outline" size={16} color="#1565C0" />
        </View>
        <Text style={s.cardTitle}>{title}</Text>
        <View style={[s.badge, photo ? s.badgeUploaded : s.badgePending]}>
          <View style={[s.badgeDot, { backgroundColor: photo ? "#22C55E" : "#F59E0B" }]} />
          <Text style={[s.badgeTxt, { color: photo ? "#16A34A" : "#B45309" }]}>
            {photo ? "Uploaded" : "Pending"}
          </Text>
        </View>
      </View>
      <View style={s.imgWrap}>
        {photo
          ? <Image source={{ uri: `data:image/jpeg;base64,${photo}` }} style={s.photo} />
          : <View style={s.noPhoto}>
              <Ionicons name="person-outline" size={40} color="#9CA3AF" />
              <Text style={s.noPhotoTxt}>No photo available</Text>
            </View>
        }
      </View>
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
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={s.headerTitle}>Driver Photos</Text>
            <Text style={s.headerSub}>Face verification images</Text>
          </View>
          <View style={{ width: 42 }} />
        </View>

        {loading
          ? <View style={s.loader}><ActivityIndicator size="large" color="#fff" /></View>
          : <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
              <PhotoCard title="Front Face Image"   photo={photos?.frontFaceImage} />
              <PhotoCard title="Left Face Profile"  photo={photos?.leftFaceImage} />
              <PhotoCard title="Right Face Profile" photo={photos?.rightFaceImage} />
            </ScrollView>
        }
      </SafeAreaView>
    </View>
  );
};

const s = StyleSheet.create({
  header:       { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12 },
  backBtn:      { width: 42, height: 42, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.12)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  headerTitle:  { fontSize: 20, fontWeight: "800", color: "#fff" },
  headerSub:    { fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 2 },
  loader:       { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll:       { padding: 16, paddingBottom: 40 },
  // White card
  card:         { backgroundColor: "#FFFFFF", borderRadius: 20, padding: 16, marginBottom: 16, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  cardHeader:   { flexDirection: "row", alignItems: "center", marginBottom: 14, gap: 10 },
  cardIconWrap: { width: 34, height: 34, borderRadius: 10, backgroundColor: "rgba(21,101,192,0.10)", borderWidth: 1, borderColor: "rgba(21,101,192,0.25)", alignItems: "center", justifyContent: "center" },
  cardTitle:    { flex: 1, fontSize: 15, fontWeight: "700", color: "#0D1B3E" },
  badge:        { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1 },
  badgeUploaded:{ backgroundColor: "rgba(34,197,94,0.10)", borderColor: "rgba(34,197,94,0.35)" },
  badgePending: { backgroundColor: "rgba(245,158,11,0.10)", borderColor: "rgba(245,158,11,0.35)" },
  badgeDot:     { width: 6, height: 6, borderRadius: 3 },
  badgeTxt:     { fontSize: 11, fontWeight: "700" },
  imgWrap:      { alignItems: "center" },
  photo:        { width: "100%", height: 220, borderRadius: 14 },
  noPhoto:      { width: "100%", height: 180, borderRadius: 14, backgroundColor: "#F3F4F6", borderWidth: 1, borderColor: "rgba(0,0,0,0.06)", alignItems: "center", justifyContent: "center", gap: 10 },
  noPhotoTxt:   { fontSize: 13, color: "#6B7280" },
});

export default ViewDriverPhotosScreen;
