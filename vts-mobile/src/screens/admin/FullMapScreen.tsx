import { useRef, useState, useEffect, useCallback } from "react";
import { View, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { WebView } from "react-native-webview";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AdminStackParamList } from "../../navigation/AdminNavigator";
import { fetchLiveVehicles } from "../../services/dashboardService";
import type { LiveVehicle } from "../../types/Dashboard";

type Props = NativeStackScreenProps<AdminStackParamList, "FullMap">;

// ── Live Map HTML with dynamic vehicle support ───────────────────────────────────
const buildMapHtml = (vehicles: LiveVehicle[]) => {
  const vJson = JSON.stringify(vehicles.map(v => ({
    lat: v.lat, lng: v.lng,
    id: v.vehicleId,
    regNo: v.vehicleId,
    status: v.tripStatus || "Idle",
    driver: v.driverName || "—",
    speed: v.speed || 0,
    overspeed: v.overspeed || "No",
    smoking: v.smoking || "No",
    mobileUsage: v.mobileUsage || "No",
    drowsiness: v.drowsiness || "Normal",
    routeDeviation: v.routeDeviation || "No",
    address: v.address || "",
    coordinates: v.coordinates || "",
    lastUpdateTime: v.lastUpdateTime || "",
    lastUpdateDate: v.lastUpdateDate || "",
  })));
  return `<!DOCTYPE html><html><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin=""/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""><\/script>
<style>
*{margin:0;padding:0;box-sizing:border-box}html,body,#map{width:100%;height:100%;overflow:hidden}
.pc{font-family:sans-serif;font-size:12px;min-width:200px;max-width:240px}
.pt{font-weight:800;font-size:13px;color:#0D1B3E;margin-bottom:6px;border-bottom:2px solid #1A3CC8;padding-bottom:4px}
.pr{display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid #f0f0f0}
.pk{color:#6B7280;font-size:11px}.pv{font-weight:700;color:#0D1B3E;font-size:11px}
.pv.yes{color:#EF4444}.pv.no{color:#22C55E}.pv.moving{color:#22C55E}.pv.idle{color:#F59E0B}.pv.parked{color:#EF4444}
.pa{font-weight:600;color:#0D1B3E;font-size:11px;display:block;margin-top:2px;line-height:15px;word-break:break-word}
<\/style>
</head><body><div id="map"></div>
<script>
var vehicles=${vJson};
var map,markers={};
function statusClass(v){return v?v.toLowerCase():''}
function buildPopup(x){
  var sc=statusClass(x.status);
  return '<div class="pc"><div class="pt">'+x.regNo+'<\/div>'+
    '<div class="pr"><span class="pk">Trip Status<\/span><span class="pv '+sc+'">'+x.status+'<\/span><\/div>'+
    '<div class="pr"><span class="pk">Driver<\/span><span class="pv">'+(x.driver||'—')+'<\/span><\/div>'+
    '<div class="pr"><span class="pk">Speed<\/span><span class="pv">'+x.speed+' km/h<\/span><\/div>'+
    (x.address?'<div style="padding:3px 0;border-bottom:1px solid #f0f0f0"><span class="pk">Address<\/span><span class="pa">'+x.address+'<\/span><\/div>':'')+
    (x.coordinates?'<div class="pr"><span class="pk">Coordinates<\/span><span class="pv">'+x.coordinates+'<\/span><\/div>':'')+
    (x.lastUpdateTime||x.lastUpdateDate?'<div class="pr"><span class="pk">Last Update<\/span><span class="pv">'+(x.lastUpdateTime||'')+(x.lastUpdateDate?' · '+x.lastUpdateDate:'')+'<\/span><\/div>':'')+
    '<div class="pr"><span class="pk">Overspeed<\/span><span class="pv '+(x.overspeed==='Yes'?'yes':'no')+'">'+x.overspeed+'<\/span><\/div>'+
    '<div class="pr"><span class="pk">Smoking<\/span><span class="pv '+(x.smoking==='Yes'?'yes':'no')+'">'+x.smoking+'<\/span><\/div>'+
    '<div class="pr"><span class="pk">Mobile Usage<\/span><span class="pv '+(x.mobileUsage==='Yes'?'yes':'no')+'">'+x.mobileUsage+'<\/span><\/div>'+
    '<div class="pr"><span class="pk">Drowsiness<\/span><span class="pv '+(x.drowsiness==='Fatigue'?'yes':'no')+'">'+x.drowsiness+'<\/span><\/div>'+
    '<div class="pr"><span class="pk">Route Deviation<\/span><span class="pv '+(x.routeDeviation==='Yes'?'yes':'no')+'">'+x.routeDeviation+'<\/span><\/div>'+
    '<\/div>';
}
function makeIcon(status){
  var col={Moving:'#22C55E',Idle:'#F59E0B',Parked:'#EF4444'}[status]||'#3B82F6';
  return L.divIcon({className:'',html:'<div style="width:34px;height:34px;border-radius:50%;background:'+col+';border:3px solid #fff;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.35);font-size:16px;">🚛<\/div>',iconSize:[34,34],iconAnchor:[17,17]});
}
window.onload=function(){
  var c=vehicles.length>0?[vehicles[0].lat,vehicles[0].lng]:[17.3850,78.4867];
  map=L.map('map',{center:c,zoom:12,zoomControl:false,attributionControl:false});
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,subdomains:['a','b','c']}).addTo(map);
  vehicles.forEach(function(x){
    var m=L.marker([x.lat,x.lng],{icon:makeIcon(x.status)}).bindPopup(buildPopup(x)).addTo(map);
    markers[x.id]=m;
  });
};
window.updateVehicles=function(newData){
  newData.forEach(function(x){
    if(markers[x.id]){
      markers[x.id].setLatLng([x.lat,x.lng]);
      markers[x.id].setIcon(makeIcon(x.status));
      markers[x.id].setPopupContent(buildPopup(x));
    } else {
      var m=L.marker([x.lat,x.lng],{icon:makeIcon(x.status)}).bindPopup(buildPopup(x)).addTo(map);
      markers[x.id]=m;
    }
  });
};
window.zoomIn=function(){map.zoomIn();};
window.zoomOut=function(){map.zoomOut();};
<\/script></body></html>`;
};

const FullMapScreen = ({ navigation }: Props) => {
  const webViewRef = useRef<any>(null);
  const [liveVehicles, setLiveVehicles] = useState<LiveVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const mapInitRef = useRef(false);

  const loadLiveVehicles = useCallback(async () => {
    try {
      const vehicles = await fetchLiveVehicles();
      setLiveVehicles(vehicles);
      setLoading(false);

      // Update map markers live without full reload
      if (mapInitRef.current && webViewRef.current && vehicles.length > 0) {
        const vJson = JSON.stringify(vehicles.map(v => ({
          lat: v.lat, lng: v.lng, id: v.vehicleId, regNo: v.vehicleId,
          status: v.tripStatus || "Idle", driver: v.driverName || "—",
          speed: v.speed || 0, overspeed: v.overspeed || "No",
          smoking: v.smoking || "No", mobileUsage: v.mobileUsage || "No",
          drowsiness: v.drowsiness || "Normal", routeDeviation: v.routeDeviation || "No",
          address: v.address || "", coordinates: v.coordinates || "",
          lastUpdateTime: v.lastUpdateTime || "", lastUpdateDate: v.lastUpdateDate || "",
        })));
      }
    } catch (error) {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLiveVehicles();
    const interval = setInterval(loadLiveVehicles, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, [loadLiveVehicles]);

  const handleZoomIn = () => {
    webViewRef.current?.injectJavaScript("window.zoomIn(); true;");
  };

  const handleZoomOut = () => {
    webViewRef.current?.injectJavaScript("window.zoomOut(); true;");
  };

  return (
    <View style={s.root}>
      {loading && liveVehicles.length === 0 ? (
        <View style={s.loadingContainer}>
          <ActivityIndicator size="large" color="#1565C0" />
        </View>
      ) : (
        <WebView
          ref={webViewRef}
          source={{ html: buildMapHtml(liveVehicles) }}
          style={s.map}
          javaScriptEnabled
          domStorageEnabled
          mixedContentMode="always"
          allowUniversalAccessFromFileURLs
          originWhitelist={["*"]}
          onLoadEnd={() => { mapInitRef.current = true; }}
        />
      )}
      <SafeAreaView style={s.overlay} pointerEvents="box-none">
        {/* Back Button - Top Left */}
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.85}>
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>

        {/* Zoom Controls - Top Right */}
        <View style={s.zoomControls}>
          <TouchableOpacity style={s.zoomBtn} onPress={handleZoomIn} activeOpacity={0.85}>
            <Ionicons name="add" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={s.zoomBtn} onPress={handleZoomOut} activeOpacity={0.85}>
            <Ionicons name="remove" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
};

const s = StyleSheet.create({
  root:              { flex: 1 },
  map:               { flex: 1 },
  overlay:           { position: "absolute", top: 0, left: 0, right: 0 },
  backBtn:           { margin: 14, width: 44, height: 44, borderRadius: 12, backgroundColor: "#1565C0", alignItems: "center", justifyContent: "center", shadowColor: "#1565C0", shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 6 },
  zoomControls:      { position: "absolute", top: 14, right: 14, flexDirection: "column", gap: 8 },
  zoomBtn:           { width: 44, height: 44, borderRadius: 12, backgroundColor: "#1565C0", alignItems: "center", justifyContent: "center", shadowColor: "#1565C0", shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 6 },
  loadingContainer:  { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F0F4FF" },
});

export default FullMapScreen;
