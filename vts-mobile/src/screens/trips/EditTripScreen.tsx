import { useEffect, useRef, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, ActivityIndicator, StatusBar, Modal, FlatList,
} from "react-native";
import { WebView } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { Toast, useToast } from "../../components/Toast";
import { fetchVehiclesForTrip } from "../../services/tripService";
import { api } from "../../services/api";
import { ENDPOINTS } from "../../config/apiConfig";
import type { TripItem } from "./TripManagementScreen";
import { calculateOsrmRoute } from "../../utils/osrmRoute";

type Suggestion = { display_name: string; lat: string; lon: string };
type Coords = { lat: number; lng: number };
type TripAssociationOption = { id: number; vehicle_id: number; registration_no: string; driver_id: number; driver_name: string; };

interface Props {
  navigation: any;
  route: { params: { trip: TripItem } };
}

const EditTripScreen = ({ navigation, route }: Props) => {
  const { trip } = route.params;

  const [startPlace, setStartPlace]   = useState(trip.startPlace ?? "");
  const [endPlace, setEndPlace]       = useState(trip.endPlace ?? "");
  const [startCoords, setStartCoords] = useState<Coords>({ lat: trip.startLat, lng: trip.startLng });
  const [endCoords, setEndCoords]     = useState<Coords>({ lat: trip.endLat, lng: trip.endLng });
  const [distanceKm, setDistanceKm]   = useState<number | null>(trip.distanceKm ?? null);
  const [durationStr, setDurationStr] = useState<string | null>(trip.duration ?? null);
  const [polylineCoords, setPolylineCoords] = useState<string | null>(trip.customPolyline ?? null);
  const [vehicles, setVehicles] = useState<TripAssociationOption[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<TripAssociationOption | null>(null);
  const [showVehiclePicker, setShowVehiclePicker] = useState(false);
  const [vehicleSearch, setVehicleSearch] = useState("");

  const [startSuggestions, setStartSuggestions] = useState<Suggestion[]>([]);
  const [endSuggestions, setEndSuggestions]     = useState<Suggestion[]>([]);
  const [activeSuggestField, setActiveSuggestField] = useState<"start" | "end" | null>(null);
  const [mapClickTarget, setMapClickTarget]     = useState<"start" | "end" | null>(null);

  const [loading, setLoading]   = useState(false);
  const webViewRef              = useRef<any>(null);
  const debounceRef             = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { toast, showToast, hideToast } = useToast();


  useEffect(() => {
    fetchVehiclesForTrip(trip.id)
      .then(rows => {
        const options: TripAssociationOption[] = rows
          .filter(row => row.vehicle_id && row.registration_no && row.driver_id && row.driver_name)
          .map(row => ({
            id: Number(row.vehicle_id),
            vehicle_id: Number(row.vehicle_id),
            registration_no: String(row.registration_no),
            driver_id: Number(row.driver_id),
            driver_name: String(row.driver_name),
          }));
        // Always include the current trip's vehicle even if it has an active trip
        const currentInList = options.find(v => v.registration_no === trip.vehicleId);
        const currentFallback: TripAssociationOption | null = trip.vehicleId && trip.driverName ? {
          id: Number(trip.id),
          vehicle_id: 0,
          registration_no: trip.vehicleId,
          driver_id: Number((trip as any).driverId ?? 0),
          driver_name: trip.driverName,
        } : null;
        const allOptions = currentInList ? options : (currentFallback ? [currentFallback, ...options] : options);
        setVehicles(allOptions);
        setSelectedVehicle(currentInList ?? currentFallback);
      })
      .catch(() => showToast("Failed to load associated vehicles.", "error"));
  }, [trip.id, trip.vehicleId, trip.driverName]);
  // Draw initial route on map load
  const onMapLoad = () => {
    if (polylineCoords) {
      try {
        const latlngs = JSON.parse(polylineCoords).map((p: any) => [p.lat, p.lng]);
        const js = `drawRoute(${JSON.stringify(latlngs)},${startCoords.lat},${startCoords.lng},${endCoords.lat},${endCoords.lng}); true;`;
        setTimeout(() => webViewRef.current?.injectJavaScript(js), 400);
      } catch { /* silent */ }
    }
  };

  // Nominatim autocomplete
  const fetchSuggestions = useCallback(async (text: string, field: "start" | "end") => {
    if (text.length < 3) { field === "start" ? setStartSuggestions([]) : setEndSuggestions([]); return; }
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text)}&format=json&addressdetails=1&limit=6&countrycodes=in`,
        { headers: { "User-Agent": "OptiFleet-VTS/1.0", "Accept-Language": "en" } }
      );
      const data: Suggestion[] = await res.json();
      field === "start" ? setStartSuggestions(data) : setEndSuggestions(data);
    } catch { /* silent */ }
  }, []);

  const onChangeLocation = (text: string, field: "start" | "end") => {
    if (field === "start") { setStartPlace(text); }
    else                   { setEndPlace(text); }
    setActiveSuggestField(field);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(text, field), 400);
  };

  const selectSuggestion = (item: Suggestion, field: "start" | "end") => {
    const coords = { lat: Number.parseFloat(item.lat), lng: Number.parseFloat(item.lon) };
    if (field === "start") { setStartPlace(item.display_name); setStartCoords(coords); setStartSuggestions([]); }
    else                   { setEndPlace(item.display_name);   setEndCoords(coords);   setEndSuggestions([]); }
    setActiveSuggestField(null);
  };

  const reverseGeocode = async (lat: number, lng: number, field: "start" | "end") => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=jsonv2`,
        { headers: { "User-Agent": "OptiFleet-VTS/1.0", "Accept-Language": "en" } }
      );
      const d = await res.json();
      const name = d?.display_name ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      if (field === "start") { setStartPlace(name); setStartCoords({ lat, lng }); }
      else                   { setEndPlace(name);   setEndCoords({ lat, lng }); }
    } catch { /* silent */ }
  };

  const onWebViewMessage = (e: any) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.lat && msg.lng && mapClickTarget) {
        reverseGeocode(msg.lat, msg.lng, mapClickTarget);
        setMapClickTarget(null);
        webViewRef.current?.injectJavaScript(`window.setPickMode(false); true;`);
      }
    } catch { /* silent */ }
  };

  // Recalculate route when both coords change
  useEffect(() => {
    if (!startCoords || !endCoords) return;
    (async () => {
      const result = await calculateOsrmRoute(startCoords.lat, startCoords.lng, endCoords.lat, endCoords.lng);
      if (result) {
        setDistanceKm(result.distanceKm);
        setDurationStr(result.durationStr);
        setPolylineCoords(result.polylineCoords);
        const js = `drawRoute(${JSON.stringify(result.latlngs)},${startCoords.lat},${startCoords.lng},${endCoords.lat},${endCoords.lng}); true;`;
        webViewRef.current?.injectJavaScript(js);
      }
    })();
  }, [startCoords, endCoords]);

  const onSave = async () => {
    if (!selectedVehicle) { showToast("Please select an associated vehicle.", "warning"); return; }
    if (!startPlace.trim() || !endPlace.trim()) { showToast("Please enter start and destination.", "warning"); return; }
    setLoading(true);
    try {
      await api.put(`${ENDPOINTS.TRIPS}/${trip.id}`, {
        vehicleId:      selectedVehicle.registration_no,
        driverId:       selectedVehicle.driver_id,
        driverName:     selectedVehicle.driver_name,
        startPlace:     startPlace.trim(),
        endPlace:       endPlace.trim(),
        startLat:       startCoords.lat,
        startLng:       startCoords.lng,
        endLat:         endCoords.lat,
        endLng:         endCoords.lng,
        distanceKm:     distanceKm,
        duration:       durationStr,
        customPolyline: polylineCoords,
      });
      showToast("Trip updated successfully!", "success");
      setTimeout(() => navigation.goBack(), 900);
    } catch {
      showToast("Failed to update trip.", "error");
    } finally {
      setLoading(false);
    }
  };

  const mapHtml = `
<!DOCTYPE html><html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>*{margin:0;padding:0;box-sizing:border-box}html,body,#map{width:100%;height:100%}
  #tapHint{position:absolute;top:10px;left:50%;transform:translateX(-50%);background:rgba(14,165,233,0.92);color:#fff;font-size:12px;font-weight:600;padding:6px 14px;border-radius:20px;z-index:1000;pointer-events:none;white-space:nowrap;display:none;}</style>
</head>
<body>
<div id="map"></div><div id="tapHint">Tap map to set location</div>
<script>
  var map=L.map('map',{zoomControl:true}).setView([${trip.startLat},${trip.startLng}],12);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OSM'}).addTo(map);
  var routeLayer=null,startMarker=null,endMarker=null;
  var gIcon=L.divIcon({html:'<div style="font-size:26px">🚚</div>',className:'',iconSize:[28,28],iconAnchor:[14,28]});
  var rIcon=L.divIcon({html:'<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36"><path d="M14 0C6.27 0 0 6.27 0 14c0 9.33 14 22 14 22S28 23.33 28 14C28 6.27 21.73 0 14 0z" fill="#FF3B30"/><circle cx="14" cy="14" r="6" fill="#fff"/></svg>',className:'',iconSize:[28,36],iconAnchor:[14,36]});
  window.setPickMode=function(a){document.getElementById('tapHint').style.display=a?'block':'none';};
  window.drawRoute=function(latlngs,sLat,sLng,eLat,eLng){
    if(routeLayer)map.removeLayer(routeLayer);
    if(startMarker)map.removeLayer(startMarker);
    if(endMarker)map.removeLayer(endMarker);
    routeLayer=L.polyline(latlngs,{color:'#38BDF8',weight:4,opacity:0.85}).addTo(map);
    startMarker=L.marker([sLat,sLng],{icon:gIcon}).addTo(map);
    endMarker=L.marker([eLat,eLng],{icon:rIcon}).addTo(map);
    setTimeout(function(){map.fitBounds(routeLayer.getBounds(),{padding:[60,60],maxZoom:16});},100);
  };
  map.on('click',function(e){window.ReactNativeWebView.postMessage(JSON.stringify({lat:e.latlng.lat,lng:e.latlng.lng}));});
</script>
</body></html>`;

  const SuggestionList = ({ items, field }: { items: Suggestion[]; field: "start" | "end" }) =>
    items.length === 0 ? null : (
      <View style={styles.suggestBox}>
        {items.map((item, i) => (
          <TouchableOpacity key={i} style={styles.suggestItem} onPress={() => selectSuggestion(item, field)}>
            <Ionicons name="location-outline" size={14} color="#1565C0" style={{ marginRight: 6 }} />
            <Text style={styles.suggestText} numberOfLines={2}>{item.display_name}</Text>
          </TouchableOpacity>
        ))}
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
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {[0.12, 0.30, 0.55].map((t, i) => (
          <View key={i} style={[styles.gridH, { top: `${t * 100}%` as any }]} />
        ))}
      </View>

      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerBrand}>OptiFleet</Text>
            <Text style={styles.headerSub}>EDIT TRIP</Text>
          </View>
          <View style={{ width: 42 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
            <LinearGradient
              colors={["rgba(21,101,192,0.07)", "rgba(21,101,192,0.00)"]}
              start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
              style={styles.cardEdge}
            />

            <View style={styles.cardTitleRow}>
              <Ionicons name="create-outline" size={26} color="#1565C0" />
              <Text style={styles.cardTitle}>Edit Trip</Text>
            </View>
            <Text style={styles.cardSub}>Update route and trip details below.</Text>
            <View style={styles.divider}><View style={styles.dividerLine} /></View>

            {/* Trip ID */}
            <Text style={styles.label}>TRIP ID</Text>
            <View style={styles.inputBox}><Text style={styles.inputText}>{trip.tripId}</Text></View>

            {/* Vehicle + Driver */}
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>VEHICLE</Text>
                <TouchableOpacity style={styles.selectBox} onPress={() => setShowVehiclePicker(true)} activeOpacity={0.8}>
                  <Text style={styles.inputText} numberOfLines={2}>{selectedVehicle?.registration_no ?? "Select vehicle"}</Text>
                  <Ionicons name="chevron-down" size={16} color="#1565C0" />
                </TouchableOpacity>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>DRIVER</Text>
                <View style={[styles.inputBox, styles.readonlyBox]}><Text style={styles.inputText} numberOfLines={2}>{selectedVehicle?.driver_name ?? "-"}</Text></View>
              </View>
            </View>

            {/* Route Change */}
            <Text style={[styles.label, { color: "#1565C0", marginTop: 10 }]}>ROUTE CHANGE</Text>

            <Text style={styles.fieldLabel}>From (Start Point)</Text>
            <View style={styles.locationRow}>
              <TextInput
                style={[styles.locationInput, { flex: 1 }]}
                placeholder="Start point"
                placeholderTextColor="#9CA3AF"
                value={startPlace}
                onChangeText={t => onChangeLocation(t, "start")}
                onFocus={() => { setActiveSuggestField("start"); setMapClickTarget(null); }}
              />
              <TouchableOpacity
                style={[styles.locateBtn, mapClickTarget === "start" && styles.locateBtnActive]}
                onPress={() => {
                  const next = mapClickTarget === "start" ? null : "start";
                  setMapClickTarget(next);
                  setActiveSuggestField(null);
                  webViewRef.current?.injectJavaScript(`window.setPickMode(${next === "start"}); true;`);
                }}
              >
                <Ionicons name="locate-outline" size={20} color={mapClickTarget === "start" ? "#fff" : "#1565C0"} />
              </TouchableOpacity>
            </View>
            {activeSuggestField === "start" && <SuggestionList items={startSuggestions} field="start" />}

            <Text style={styles.fieldLabel}>To (Destination)</Text>
            <View style={styles.locationRow}>
              <TextInput
                style={[styles.locationInput, { flex: 1 }]}
                placeholder="Destination"
                placeholderTextColor="#9CA3AF"
                value={endPlace}
                onChangeText={t => onChangeLocation(t, "end")}
                onFocus={() => { setActiveSuggestField("end"); setMapClickTarget(null); }}
              />
              <TouchableOpacity
                style={[styles.locateBtn, mapClickTarget === "end" && styles.locateBtnActive]}
                onPress={() => {
                  const next = mapClickTarget === "end" ? null : "end";
                  setMapClickTarget(next);
                  setActiveSuggestField(null);
                  webViewRef.current?.injectJavaScript(`window.setPickMode(${next === "end"}); true;`);
                }}
              >
                <Ionicons name="locate-outline" size={20} color={mapClickTarget === "end" ? "#fff" : "#1565C0"} />
              </TouchableOpacity>
            </View>
            {activeSuggestField === "end" && <SuggestionList items={endSuggestions} field="end" />}

            {/* Distance + Duration */}
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>DISTANCE</Text>
                <View style={styles.inputBox}><Text style={styles.inputText}>{distanceKm != null ? `${distanceKm} km` : "—"}</Text></View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>DURATION</Text>
                <View style={styles.inputBox}><Text style={styles.inputText}>{durationStr ?? "—"}</Text></View>
              </View>
            </View>

            {/* Buttons */}
            <View style={styles.row}>
              <TouchableOpacity style={[styles.btn, styles.cancelBtn]} onPress={() => navigation.goBack()} activeOpacity={0.8}>
                <Text style={[styles.btnTxt, { color: "#fff" }]}>Cancel</Text>
              </TouchableOpacity>
              <View style={[styles.btnShadow, { flex: 1 }]}>
                <TouchableOpacity style={styles.btnOuter} onPress={onSave} disabled={loading} activeOpacity={0.85}>
                  <LinearGradient colors={["#16A34A", "#14532D"]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.btnGrad}>
                    <LinearGradient colors={["rgba(255,255,255,0.14)", "rgba(255,255,255,0.00)"]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={styles.btnGloss} />
                    {loading
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={styles.btnTxt}>Save Changes</Text>}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>

            {/* Map */}
            <View style={styles.mapContainer}>
              <WebView
                ref={webViewRef}
                style={{ flex: 1 }}
                source={{ html: mapHtml }}
                javaScriptEnabled
                originWhitelist={["*"]}
                onLoad={onMapLoad}
                onMessage={onWebViewMessage}
              />
            </View>

          </View>
        </ScrollView>
      </SafeAreaView>

      <Modal visible={showVehiclePicker} transparent animationType="slide" onRequestClose={() => setShowVehiclePicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Select Associated Vehicle</Text>
            <TextInput
              style={styles.pickerSearch}
              placeholder="Search registration no..."
              placeholderTextColor="#7A5230"
              value={vehicleSearch}
              onChangeText={setVehicleSearch}
            />
            <FlatList
              data={vehicles.filter(v => v.registration_no.toLowerCase().includes(vehicleSearch.toLowerCase()))}
              keyExtractor={item => `${item.id}-${item.vehicle_id}`}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.vehicleItem}
                  onPress={() => { setSelectedVehicle(item); setShowVehiclePicker(false); setVehicleSearch(""); }}
                >
                  <Text style={styles.vehicleReg}>{item.registration_no}</Text>
                  <Text style={styles.vehicleDriver}>{item.driver_name}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={styles.emptyPicker}>No completed associations found</Text>}
            />
            <TouchableOpacity style={styles.modalClose} onPress={() => { setShowVehiclePicker(false); setVehicleSearch(""); }}>
              <Text style={styles.modalCloseTxt}>Close</Text>
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
  safe:          { flex: 1 },
  gridH:         { position: "absolute", left: 0, right: 0, height: 1, backgroundColor: "rgba(255,255,255,0.025)" },

  header:        { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6 },
  backBtn:       { width: 36, height: 36, borderRadius: 11, backgroundColor: "rgba(255,255,255,0.12)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  headerCenter:  { flex: 1, alignItems: "center" },
  headerBrand:   { fontSize: 17, fontWeight: "800", color: "#fff" },
  headerSub:     { fontSize: 9, color: "rgba(255,255,255,0.90)", letterSpacing: 2, marginTop: 1 },

  scroll:        { paddingHorizontal: 14, paddingBottom: 32, paddingTop: 6 },

  card:          { backgroundColor: "#F6F1E9", borderRadius: 20, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16, overflow: "hidden", shadowColor: "#1A0040", shadowOpacity: 0.14, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 10 },
  cardEdge:      { position: "absolute", top: 0, left: 0, right: 0, height: 4, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  cardTitleRow:  { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  cardTitle:     { fontSize: 18, fontWeight: "800", color: "#0A1F44" },
  cardSub:       { fontSize: 12, color: "#3A5A7A", marginBottom: 10, lineHeight: 17 },
  divider:       { marginBottom: 12 },
  dividerLine:   { height: 1, backgroundColor: "rgba(21,101,192,0.12)" },

  label:         { fontSize: 10, fontWeight: "700", color: "#3A5A7A", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4, marginTop: 10 },
  fieldLabel:    { fontSize: 12, fontWeight: "600", color: "#1A2F5C", marginBottom: 4, marginTop: 8 },
  inputBox:      { backgroundColor: "rgba(21,101,192,0.06)", borderRadius: 10, borderWidth: 1, borderColor: "rgba(21,101,192,0.15)", paddingHorizontal: 12, paddingVertical: 10 },
  inputText:     { fontSize: 13, color: "#1E3A6D", fontWeight: "600", flexShrink: 1 },
  selectBox:     { backgroundColor: "rgba(21,101,192,0.06)", borderRadius: 10, borderWidth: 1, borderColor: "rgba(21,101,192,0.15)", paddingHorizontal: 12, paddingVertical: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 42, gap: 6 },
  readonlyBox:   { minHeight: 42, justifyContent: "center" },
  row:           { flexDirection: "row", gap: 8, marginTop: 4 },

  locationRow:   { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  locationInput: { backgroundColor: "rgba(21,101,192,0.06)", borderRadius: 10, borderWidth: 1, borderColor: "rgba(21,101,192,0.15)", paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: "#1E3A6D" },
  locateBtn:     { width: 40, height: 40, borderRadius: 11, backgroundColor: "rgba(21,101,192,0.10)", borderWidth: 1, borderColor: "rgba(21,101,192,0.20)", alignItems: "center", justifyContent: "center" },
  locateBtnActive: { backgroundColor: "#1565C0" },

  suggestBox:    { backgroundColor: "#fff", borderRadius: 10, borderWidth: 1, borderColor: "rgba(21,101,192,0.15)", marginBottom: 4, overflow: "hidden", shadowColor: "#0A1F44", shadowOpacity: 0.08, shadowRadius: 6, elevation: 4 },
  suggestItem:   { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(21,101,192,0.10)" },
  suggestText:   { fontSize: 12, color: "#1E3A6D", flex: 1 },

  mapContainer:  { height: 220, borderRadius: 12, overflow: "hidden", marginTop: 12, borderWidth: 1, borderColor: "rgba(21,101,192,0.18)" },

  btn:           { flex: 1, borderRadius: 11, paddingVertical: 11, alignItems: "center", justifyContent: "center", marginTop: 12 },
  cancelBtn:     { backgroundColor: "#DC2626", borderWidth: 0 },
  btnShadow:     { borderRadius: 11, marginTop: 12, shadowColor: "#14532D", shadowOpacity: 0.22, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  btnOuter:      { borderRadius: 11, overflow: "hidden" },
  btnGrad:       { height: 42, flexDirection: "row", alignItems: "center", justifyContent: "center", borderRadius: 11, overflow: "hidden" },
  btnGloss:      { position: "absolute", top: 0, left: 0, right: 0, height: 20, borderRadius: 11 },
  btnTxt:        { fontSize: 13, fontWeight: "800", color: "#fff", letterSpacing: 0.3 },
  modalOverlay:  { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  modalBox:      { backgroundColor: "#F6F1E9", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: "70%", borderWidth: 1, borderColor: "rgba(160,90,30,0.20)" },
  modalTitle:    { fontSize: 17, fontWeight: "800", color: "#0D1B3E", marginBottom: 14, textAlign: "center" },
  pickerSearch:  { backgroundColor: "#E8C9A0", borderRadius: 12, borderWidth: 1.5, borderColor: "rgba(139,79,30,0.55)", paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: "#2C1200", fontWeight: "600", marginBottom: 10 },
  vehicleItem:   { paddingVertical: 14, paddingHorizontal: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(160,90,30,0.15)" },
  vehicleReg:    { fontSize: 15, fontWeight: "800", color: "#0D1B3E" },
  vehicleDriver: { fontSize: 12, color: "#4A6A8E", marginTop: 2, fontWeight: "600" },
  emptyPicker:   { color: "#6B5A8E", textAlign: "center", padding: 20, fontWeight: "600" },
  modalClose:    { alignItems: "center", paddingVertical: 14 },
  modalCloseTxt: { color: "#EF4444", fontWeight: "700", fontSize: 15 },
});

export default EditTripScreen;
