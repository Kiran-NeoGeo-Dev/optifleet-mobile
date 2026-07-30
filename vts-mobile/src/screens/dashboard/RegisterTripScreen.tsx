import { useEffect, useRef, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Modal, FlatList, ActivityIndicator, StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { WebView } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import * as Speech from "expo-speech";
import * as Location from "expo-location";
import { COLORS, SHADOWS } from "../../components/ScreenBg";
import { Toast, useToast } from "../../components/Toast";
import { fetchVehiclesForTrip, createTrip, TripVehicleOption } from "../../services/tripService";
import { api } from "../../services/api";
import { ENDPOINTS } from "../../config/apiConfig";
import { useAlertNotifications } from "../../hooks/useAlertNotifications";
import AlertNotifications from "../../components/AlertNotifications";
import { calculateOsrmRoute, calculateOsrmRouteMulti } from "../../utils/osrmRoute";

const genTripId = () => {
  const now = new Date();
  const pad = (n: number, l = 2) => String(n).padStart(l, "0");
  return `TRIP-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
};

type Coords = { lat: number; lng: number };
type Suggestion = { display_name: string; lat: string; lon: string };

interface Props { navigation: any; }

const RegisterTripScreen = ({ navigation }: Props) => {
  const [tripId]                              = useState(genTripId());
  const [vehicles, setVehicles]               = useState<TripVehicleOption[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<TripVehicleOption | null>(null);
  const [showVehiclePicker, setShowVehiclePicker] = useState(false);
  const [vehicleSearch, setVehicleSearch]     = useState("");

  const [startPlace, setStartPlace]           = useState("");
  const [endPlace, setEndPlace]               = useState("");
  const [startCoords, setStartCoords]         = useState<Coords | null>(null);
  const [endCoords, setEndCoords]             = useState<Coords | null>(null);
  const [distanceKm, setDistanceKm]           = useState<number | null>(null);
  const [durationStr, setDurationStr]         = useState<string | null>(null);
  const [polylineCoords, setPolylineCoords]   = useState<string | null>(null);

  // Trip Stops
  type TripStop = { id: string; place: string; coords: Coords | null };
  const [tripStops, setTripStops]               = useState<TripStop[]>([]);
  const [stopSuggestions, setStopSuggestions]   = useState<{ [id: string]: Suggestion[] }>({});
  const [activeStopId, setActiveStopId]         = useState<string | null>(null);

  // Autocomplete
  const [startSuggestions, setStartSuggestions] = useState<Suggestion[]>([]);
  const [endSuggestions, setEndSuggestions]     = useState<Suggestion[]>([]);
  const [activeSuggestField, setActiveSuggestField] = useState<"start" | "end" | null>(null);

  // Map click target: which field gets the map-click result
  const [mapClickTarget, setMapClickTarget]   = useState<"start" | "end" | string | null>(null);

  // Full screen map
  const [fullScreen, setFullScreen]           = useState(false);

  // User location — drives initial map center
  const [userLocation, setUserLocation]       = useState<{ lat: number; lng: number; acc: number } | null>(null);
  const [mapReady, setMapReady]               = useState(false);

  const [loading, setLoading]                 = useState(false);
  const webViewRef                            = useRef<any>(null);
  const fullScreenWebViewRef                  = useRef<any>(null);
  const debounceRef                           = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { toast, showToast, hideToast }       = useToast();
  const routeAnnouncedRef                     = useRef(false);

  useEffect(() => {
    fetchVehiclesForTrip()
      .then(setVehicles)
      .catch(() => showToast("Failed to load vehicles.", "error"));
  }, []);

  // ── Reverse geocode via Nominatim with Accept-Language header ──────────────
  const reverseGeocodeCoords = async (lat: number, lng: number): Promise<string> => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=jsonv2&zoom=18&addressdetails=1`,
        { headers: { "User-Agent": "OptiFleet-VTS/1.0 (contact@optifleet.in)", "Accept-Language": "en" } }
      );
      const d = await res.json();
      if (d?.display_name) return d.display_name;
      return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    } catch {
      return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }
  };

  // ── Detect GPS → auto-fill From + set map center ───────────────────────────
  const mapReadyRef = useRef(false);

  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") { setMapReady(true); mapReadyRef.current = true; return; }

        sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 0, timeInterval: 0 },
          async (loc) => {
            sub?.remove();
            const { latitude: lat, longitude: lng, accuracy } = loc.coords;
            setUserLocation({ lat, lng, acc: accuracy ?? 30 });
            setMapReady(true);
            mapReadyRef.current = true;
            const name = await reverseGeocodeCoords(lat, lng);
            setStartPlace(name);
            setStartCoords({ lat, lng });
          }
        );

        setTimeout(() => {
          if (!mapReadyRef.current) { setMapReady(true); mapReadyRef.current = true; }
        }, 8000);

      } catch {
        setMapReady(true);
        mapReadyRef.current = true;
      }
    })();
    return () => { sub?.remove(); };
  }, []);

  // ── Nominatim autocomplete ──────────────────────────────────────────────────
  const fetchSuggestions = useCallback(async (text: string, field: "start" | "end") => {
    if (text.length < 3) {
      field === "start" ? setStartSuggestions([]) : setEndSuggestions([]);
      return;
    }
    try {
      // addressdetails=1 + limit=8 gives village/hamlet level results
      const res  = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text)}&format=json&addressdetails=1&namedetails=1&limit=8&countrycodes=in`,
        { headers: { "User-Agent": "OptiFleet-VTS/1.0 (contact@optifleet.in)", "Accept-Language": "en" } }
      );
      const data: Suggestion[] = await res.json();
      field === "start" ? setStartSuggestions(data) : setEndSuggestions(data);
    } catch { /* silent */ }
  }, []);

  const onChangeLocation = (text: string, field: "start" | "end") => {
    if (field === "start") { setStartPlace(text); setStartCoords(null); }
    else                   { setEndPlace(text);   setEndCoords(null);   }
    setActiveSuggestField(field);
    routeAnnouncedRef.current = false;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(text, field), 400);
  };

  const onChangeStopLocation = (text: string, stopId: string) => {
    setTripStops(prev => prev.map(s => s.id === stopId ? { ...s, place: text, coords: null } : s));
    setActiveStopId(stopId);
    routeAnnouncedRef.current = false;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (text.length < 3) { setStopSuggestions(prev => ({ ...prev, [stopId]: [] })); return; }
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text)}&format=json&addressdetails=1&limit=8&countrycodes=in`,
          { headers: { "User-Agent": "OptiFleet-VTS/1.0 (contact@optifleet.in)", "Accept-Language": "en" } }
        );
        const data: Suggestion[] = await res.json();
        setStopSuggestions(prev => ({ ...prev, [stopId]: data }));
      } catch { /* silent */ }
    }, 400);
  };

  const selectStopSuggestion = (item: Suggestion, stopId: string) => {
    setTripStops(prev => prev.map(s => s.id === stopId
      ? { ...s, place: item.display_name, coords: { lat: Number.parseFloat(item.lat), lng: Number.parseFloat(item.lon) } }
      : s
    ));
    setStopSuggestions(prev => ({ ...prev, [stopId]: [] }));
    setActiveStopId(null);
  };

  const addStop = () => {
    setTripStops(prev => [...prev, { id: `stop-${Date.now()}`, place: "", coords: null }]);
  };

  const removeStop = (stopId: string) => {
    setTripStops(prev => prev.filter(s => s.id !== stopId));
    setStopSuggestions(prev => { const n = { ...prev }; delete n[stopId]; return n; });
    routeAnnouncedRef.current = false;
  };

  const moveStop = (index: number, dir: -1 | 1) => {
    setTripStops(prev => {
      const arr = [...prev];
      const target = index + dir;
      if (target < 0 || target >= arr.length) return arr;
      [arr[index], arr[target]] = [arr[target], arr[index]];
      return arr;
    });
    routeAnnouncedRef.current = false;
  };

  const selectSuggestion = (item: Suggestion, field: "start" | "end") => {
    const coords = { lat: Number.parseFloat(item.lat), lng: Number.parseFloat(item.lon) };
    if (field === "start") {
      setStartPlace(item.display_name);
      setStartCoords(coords);
      setStartSuggestions([]);
    } else {
      setEndPlace(item.display_name);
      setEndCoords(coords);
      setEndSuggestions([]);
    }
    setActiveSuggestField(null);
  };

  // ── Reverse geocode (map click) ─────────────────────────────────────────────
  const reverseGeocode = async (lat: number, lng: number, target: string) => {
    const name = await reverseGeocodeCoords(lat, lng);
    if (target === "start")      { setStartPlace(name); setStartCoords({ lat, lng }); }
    else if (target === "end")   { setEndPlace(name);   setEndCoords({ lat, lng });   }
    else {
      // stop id
      setTripStops(prev => prev.map(s => s.id === target ? { ...s, place: name, coords: { lat, lng } } : s));
    }
  };

  const onWebViewMessage = (e: any) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.type === "geolocate") {
        setUserLocation({ lat: msg.lat, lng: msg.lng, acc: 30 });
        reverseGeocodeCoords(msg.lat, msg.lng).then(name => {
          setStartPlace(name);
          setStartCoords({ lat: msg.lat, lng: msg.lng });
        });
      } else if (msg.lat && msg.lng && mapClickTarget) {
        reverseGeocode(msg.lat, msg.lng, mapClickTarget);
        setMapClickTarget(null);
      }
    } catch { /* silent */ }
  };

  // ── OSRM route + voice ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!startCoords || !endCoords) return;
    routeAnnouncedRef.current = false;
    (async () => {
      const validStops = tripStops.filter(s => s.coords);
      const waypoints = [
        startCoords,
        ...validStops.map(s => s.coords!),
        endCoords,
      ];
      const result = waypoints.length > 2
        ? await calculateOsrmRouteMulti(waypoints)
        : await calculateOsrmRoute(startCoords.lat, startCoords.lng, endCoords.lat, endCoords.lng);
      if (result) {
        setDistanceKm(result.distanceKm);
        setDurationStr(result.durationStr);
        setPolylineCoords(result.polylineCoords);
        const stopMarkers = validStops.map((s, i) =>
          `addStopMarker(${s.coords!.lat},${s.coords!.lng},${i + 1},${JSON.stringify(s.place)});`
        ).join("");
        const js = `clearStopMarkers();drawRoute(${JSON.stringify(result.latlngs)},${startCoords.lat},${startCoords.lng},${endCoords.lat},${endCoords.lng});${stopMarkers} true;`;
        webViewRef.current?.injectJavaScript(js);
        fullScreenWebViewRef.current?.injectJavaScript(js);
        if (!routeAnnouncedRef.current) {
          routeAnnouncedRef.current = true;
          const stopsText = validStops.length > 0 ? ` via ${validStops.length} stop${validStops.length > 1 ? "s" : ""},` : "";
          Speech.speak(
            `Route selected from ${startPlace.split(",")[0]}${stopsText} to ${endPlace.split(",")[0]}. Total distance is ${result.distanceKm} kilometers and estimated duration is ${result.durationStr}.`,
            { language: "en-IN" }
          );
        }
      } else {
        showToast("Failed to calculate route.", "error");
      }
    })();
  }, [startCoords, endCoords, tripStops]);

  // Trip confirmed — open fullscreen map with route
  const [tripConfirmed, setTripConfirmed]     = useState(false);

  // Live tracking state (admin/client monitoring)
  const [liveRemainingKm, setLiveRemainingKm] = useState<number | null>(null);
  const [liveEtaMin, setLiveEtaMin]           = useState<number | null>(null);
  const [liveProgress, setLiveProgress]       = useState(0);
  const [liveSpeed, setLiveSpeed]             = useState(0);
  const [liveDeviating, setLiveDeviating]     = useState(false);
  const [livePopup, setLivePopup]             = useState<any>(null);
  const [showLivePopup, setShowLivePopup]     = useState(false);
  const livePollRef                           = useRef<ReturnType<typeof setInterval> | null>(null);
  const fsMapReadyRef                         = useRef(false);
  const { toasts, bellHistory, unreadCount, processPopup, dismissToast, markAllRead, clearAll } = useAlertNotifications();

  // Start polling live tracking after trip confirmed
  useEffect(() => {
    if (!tripConfirmed || !selectedVehicle) return;
    const poll = async () => {
      try {
        const res = await api.get<any>(`${ENDPOINTS.LIVE_TRACKING_STATE}/${selectedVehicle.registration_no}`);
        const u = res.data;
        if (!u) return;
        setLiveRemainingKm(Number.parseFloat(u.remainingDistanceKm.toFixed(1)));
        setLiveEtaMin(Math.round(u.etaMinutes));
        setLiveProgress(Number.parseFloat(u.progressPercentage.toFixed(1)));
        setLiveSpeed(u.speed);
        setLiveDeviating(u.isDeviating);
        if (u.popupData) { setLivePopup(u.popupData); processPopup(u.popupData); }
        if (fsMapReadyRef.current && u.remainingRoute?.length > 0) {
          const latlngs = u.remainingRoute.map((p: any) => [p.lat, p.lng]);
          const js = `updateLiveTracking(${u.lat},${u.lng},${JSON.stringify(latlngs)},"${selectedVehicle.registration_no}"); true;`;
          fullScreenWebViewRef.current?.injectJavaScript(js);
        }
      } catch { /* silent */ }
    };
    livePollRef.current = setInterval(poll, 5000);
    poll();
    return () => { if (livePollRef.current) clearInterval(livePollRef.current); };
  }, [tripConfirmed, selectedVehicle]);

  const onConfirm = async () => {
    if (!selectedVehicle)                       { showToast("Please select a vehicle.", "warning"); return; }
    if (!startPlace.trim() || !endPlace.trim()) { showToast("Please enter start and destination.", "warning"); return; }
    if (!startCoords || !endCoords)             { showToast("Please select both points on the map.", "warning"); return; }
    setLoading(true);
    try {
      const validStops = tripStops.filter(s => s.coords && s.place.trim());
      await createTrip({
        tripId,
        tripName:        tripId,
        vehicleId:       selectedVehicle.registration_no,
        driverName:      selectedVehicle.driver_name,
        driverId:        selectedVehicle.driver_id,
        startPlace:      startPlace.trim(),
        endPlace:        endPlace.trim(),
        startLat:        startCoords.lat,
        startLng:        startCoords.lng,
        endLat:          endCoords.lat,
        endLng:          endCoords.lng,
        distanceKm:      distanceKm ?? undefined,
        duration:        durationStr ?? undefined,
        customPolyline:  polylineCoords ?? undefined,
        tripStops:       validStops.length > 0
          ? validStops.map((s, i) => ({ place: s.place, lat: s.coords!.lat, lng: s.coords!.lng }))
          : undefined,
      });
      showToast("Trip registered successfully!", "success");
      setTimeout(() => {
        setTripConfirmed(true);
        setFullScreen(true);
      }, 800);
    } catch (e: any) {
      const serverMsg = e?.response?.data?.message;
      const status    = e?.response?.status;
      if (status === 409 && serverMsg) {
        showToast(serverMsg, "error");
      } else {
        showToast("Failed to create trip. Please try again.", "error");
      }
    } finally {
      setLoading(false);
    }
  };

  const filteredVehicles = vehicles.filter(v =>
    v.registration_no.toLowerCase().includes(vehicleSearch.toLowerCase())
  );

  // ── Leaflet HTML — no pin bar, map click sends coords to RN ─────────────────
  const buildMapHtml = (initLat: number, initLng: number, initAcc: number, includeControls: boolean = true) => `
<!DOCTYPE html><html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}html,body,#map{width:100%;height:100%}
    .leaflet-control-zoom{display:none!important}
    #tapHint{
      position:absolute;top:10px;left:50%;transform:translateX(-50%);
      background:rgba(14,165,233,0.92);color:#fff;font-size:12px;font-weight:600;
      padding:6px 14px;border-radius:20px;z-index:1000;pointer-events:none;
      white-space:nowrap;display:none;
    }
    ${includeControls ? `
    .map-controls{
      position:absolute;top:10px;left:10px;z-index:1000;
      display:flex;flex-direction:column;gap:8px;
    }
    .map-control-btn{
      width:40px;height:40px;border-radius:10px;
      background:rgba(0,0,0,0.7);color:#fff;
      border:2px solid rgba(255,255,255,0.3);
      font-size:20px;font-weight:bold;
      display:flex;align-items:center;justify-content:center;
      cursor:pointer;user-select:none;
      box-shadow:0 2px 8px rgba(0,0,0,0.3);
    }
    .map-control-btn:active{
      background:rgba(0,0,0,0.85);
      transform:scale(0.95);
    }
    ` : ''}
  </style>
</head>
<body>
<div id="map"></div>
<div id="tapHint">Tap map to set location</div>
${includeControls ? `
<div class="map-controls">
  <div class="map-control-btn" id="zoomIn">+</div>
  <div class="map-control-btn" id="zoomOut">−</div>
</div>
` : ''}
<script>
  var map=L.map('map',{zoomControl:false}).setView([${initLat},${initLng}],15);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OSM'}).addTo(map);
  var routeLayer=null,startMarker=null,endMarker=null;

  var dotIcon=L.divIcon({
    html:'<div style="width:16px;height:16px;border-radius:50%;background:#FF6B35;border:3px solid #fff;box-shadow:0 0 0 4px rgba(255,107,53,0.35)"></div>',
    className:'',iconSize:[16,16],iconAnchor:[8,8]
  });
  L.circle([${initLat},${initLng}],{radius:${initAcc},color:'#FF6B35',weight:1,fillColor:'#FF6B35',fillOpacity:0.12}).addTo(map);
  L.marker([${initLat},${initLng}],{icon:dotIcon,zIndexOffset:1000}).addTo(map);

  var gIcon=L.divIcon({html:'<div style="font-size:40px">🚚</div>',className:'',iconSize:[44,44],iconAnchor:[22,44]});
  var rIcon=L.divIcon({html:'<svg xmlns="http://www.w3.org/2000/svg" width="36" height="46" viewBox="0 0 28 36"><path d="M14 0C6.27 0 0 6.27 0 14c0 9.33 14 22 14 22S28 23.33 28 14C28 6.27 21.73 0 14 0z" fill="#FF3B30"/><circle cx="14" cy="14" r="6" fill="#fff"/></svg>',className:'',iconSize:[36,46],iconAnchor:[18,46]});

  var stopMarkers=[];
  window.clearStopMarkers=function(){
    stopMarkers.forEach(function(m){map.removeLayer(m);});
    stopMarkers=[];
  };
  window.addStopMarker=function(lat,lng,num,name){
    var sIcon=L.divIcon({html:'<div style="width:24px;height:24px;border-radius:50%;background:#F59E0B;border:3px solid #fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#fff;box-shadow:0 2px 6px rgba(0,0,0,0.4)">'+num+'</div>',className:'',iconSize:[24,24],iconAnchor:[12,12]});
    var m=L.marker([lat,lng],{icon:sIcon}).addTo(map);
    if(name){m.bindPopup('<div style="font-family:sans-serif;min-width:140px"><b style="font-size:13px">Stop '+num+'</b><br><span style="font-size:11px;color:#444">'+name+'</span></div>',{maxWidth:220});m.on('click',function(){m.openPopup();});}
    stopMarkers.push(m);
  };

  /* Show/hide tap hint banner from RN */
  window.setPickMode=function(active){
    document.getElementById('tapHint').style.display=active?'block':'none';
  };

  window.drawRoute=function(latlngs,sLat,sLng,eLat,eLng){
    if(routeLayer)map.removeLayer(routeLayer);
    if(startMarker)map.removeLayer(startMarker);
    if(endMarker)map.removeLayer(endMarker);
    routeLayer=L.polyline(latlngs,{color:'#38BDF8',weight:5,opacity:0.85}).addTo(map);
    startMarker=L.marker([sLat,sLng],{icon:gIcon}).addTo(map);
    endMarker=L.marker([eLat,eLng],{icon:rIcon}).addTo(map);
    setTimeout(function(){map.fitBounds(routeLayer.getBounds(),{padding:[60,60],maxZoom:16});},100);
  };

  var vehicleLabel=null;
  window.updateLiveTracking=function(lat,lng,remainingLatlngs,vehicleId){
    if(startMarker){ startMarker.setLatLng([lat,lng]); }
    if(vehicleLabel){ map.removeLayer(vehicleLabel); }
    var vIcon=L.divIcon({html:'<div style="background:#0EA5E9;color:#fff;font-size:13px;font-weight:700;padding:5px 10px;border-radius:8px;border:2px solid #fff;white-space:nowrap;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.5)">'+vehicleId+'</div>',className:'',iconSize:[null,null],iconAnchor:[0,44]});
    vehicleLabel=L.marker([lat,lng],{icon:vIcon,zIndexOffset:1000}).addTo(map);
    vehicleLabel.on('click',function(){window.ReactNativeWebView.postMessage(JSON.stringify({type:'vehicleClick'}));});
    startMarker.off('click').on('click',function(){window.ReactNativeWebView.postMessage(JSON.stringify({type:'vehicleClick'}));});
    if(remainingLatlngs&&remainingLatlngs.length>0){
      if(routeLayer)map.removeLayer(routeLayer);
      routeLayer=L.polyline(remainingLatlngs,{color:'#38BDF8',weight:5,opacity:0.85}).addTo(map);
    }
  };

  map.on('click',function(e){
    window.ReactNativeWebView.postMessage(JSON.stringify({lat:e.latlng.lat,lng:e.latlng.lng}));
  });

  if(document.getElementById('zoomIn')){
    document.getElementById('zoomIn').addEventListener('click',function(){map.zoomIn();});
  }
  if(document.getElementById('zoomOut')){
    document.getElementById('zoomOut').addEventListener('click',function(){map.zoomOut();});
  }

  if(navigator.geolocation){
    navigator.geolocation.getCurrentPosition(function(pos){
      var lat=pos.coords.latitude,lng=pos.coords.longitude;
      map.setView([lat,lng],15);
      window.ReactNativeWebView.postMessage(JSON.stringify({type:'geolocate',lat:lat,lng:lng}));
    },null,{enableHighAccuracy:true,timeout:10000,maximumAge:0});
  }
</script>
</body></html>`;

  const initLat  = userLocation?.lat  ?? 17.4065;  // Hyderabad fallback
  const initLng  = userLocation?.lng  ?? 78.4772;
  const initAcc  = userLocation?.acc  ?? 50;
  const mapHtml  = buildMapHtml(initLat, initLng, initAcc, true);
  const fsMapHtml = buildMapHtml(initLat, initLng, initAcc, false);

  // ── Suggestion list renderer ────────────────────────────────────────────────
  const SuggestionList = ({ items, field }: { items: Suggestion[]; field: "start" | "end" }) =>
    items.length === 0 ? null : (
      <View style={styles.suggestBox}>
        {items.map((item, i) => (
          <TouchableOpacity key={i} style={styles.suggestItem} onPress={() => selectSuggestion(item, field)}>
            <Ionicons name="location-outline" size={14} color="#1565C0" style={{ marginRight: 6, marginTop: 1 }} />
            <Text style={styles.suggestText} numberOfLines={2}>{item.display_name}</Text>
          </TouchableOpacity>
        ))}
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
      {[0.18, 0.38, 0.58, 0.78].map((t, i) => (
        <View key={`h${i}`} style={[styles.gridH, { top: `${t * 100}%` as any }]} />
      ))}
      <SafeAreaView style={{ flex: 1 }}>
      {/* Header */}
      <View style={styles.pageHeader}>
        <TouchableOpacity style={styles.pageBackBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={styles.pageTitle}>Create Trip</Text>
        </View>
        <View style={{ width: 42 }} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* Trip Name */}
        <Text style={styles.sectionLabel}>TRIP NAME</Text>
        <View style={styles.inputBox}>
          <Text style={styles.inputText}>{tripId}</Text>
        </View>
        <Text style={styles.hint}>Auto-generated unique ID</Text>

        {/* Vehicle + Driver */}
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionLabel}>VEHICLE (VID)</Text>
            <TouchableOpacity style={styles.dropdown} onPress={() => setShowVehiclePicker(true)} activeOpacity={0.8}>
              <Text style={[styles.inputText, !selectedVehicle && { color: "#5F6F8F" }]}>
                {selectedVehicle ? selectedVehicle.registration_no : "Select Vehicle"}
              </Text>
              <Ionicons name="chevron-down" size={16} color="#5F6F8F" />
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionLabel}>DRIVER NAME</Text>
            <View style={styles.inputBox}>
              <Text style={[styles.inputText, !selectedVehicle && { color: "#5F6F8F" }]}>
                {selectedVehicle ? selectedVehicle.driver_name : "—"}
              </Text>
            </View>
          </View>
        </View>

        {/* Route */}
        <Text style={[styles.sectionLabel, { color: "rgba(255,255,255,0.90)", marginTop: 8 }]}>ASSIGN TRIP ROUTE</Text>

        {/* From */}
        <Text style={styles.fieldLabel}>From (Start Point)</Text>
        <View style={styles.locationRow}>
          <TextInput
            style={[styles.locationInput, { flex: 1 }]}
            placeholder="e.g. Mumbai, Maharashtra"
            placeholderTextColor="#5F6F8F"
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
            <Ionicons name="locate-outline" size={20} color={mapClickTarget === "start" ? "#fff" : "#1A2F5C"} />
          </TouchableOpacity>
        </View>
        {activeSuggestField === "start" && <SuggestionList items={startSuggestions} field="start" />}

        {/* Trip Stops */}
        <View style={styles.stopsHeader}>
          <Text style={styles.fieldLabel}>Trip Stops</Text>
          <TouchableOpacity style={styles.addStopBtn} onPress={addStop} activeOpacity={0.8}>
            <Ionicons name="add-circle-outline" size={16} color="#38BDF8" />
            <Text style={styles.addStopTxt}>Add Stop</Text>
          </TouchableOpacity>
        </View>
        {tripStops.map((stop, index) => (
          <View key={stop.id}>
            <View style={styles.stopRow}>
              <View style={styles.stopReorder}>
                <TouchableOpacity onPress={() => moveStop(index, -1)} disabled={index === 0}>
                  <Ionicons name="chevron-up" size={16} color={index === 0 ? "#3A4A6A" : "#94A3B8"} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => moveStop(index, 1)} disabled={index === tripStops.length - 1}>
                  <Ionicons name="chevron-down" size={16} color={index === tripStops.length - 1 ? "#3A4A6A" : "#94A3B8"} />
                </TouchableOpacity>
              </View>
              <View style={styles.stopNumBadge}>
                <Text style={styles.stopNumTxt}>{index + 1}</Text>
              </View>
              <TextInput
                style={[styles.locationInput, { flex: 1 }]}
                placeholder={`Stop ${index + 1}`}
                placeholderTextColor="#5F6F8F"
                value={stop.place}
                onChangeText={t => onChangeStopLocation(t, stop.id)}
                onFocus={() => { setActiveStopId(stop.id); setActiveSuggestField(null); setMapClickTarget(null); }}
              />
              <TouchableOpacity
                style={[styles.locateBtn, mapClickTarget === stop.id && styles.locateBtnActive]}
                onPress={() => {
                  const next = mapClickTarget === stop.id ? null : stop.id;
                  setMapClickTarget(next);
                  setActiveSuggestField(null);
                  setActiveStopId(null);
                  webViewRef.current?.injectJavaScript(`window.setPickMode(${next !== null}); true;`);
                }}
              >
                <Ionicons name="locate-outline" size={20} color={mapClickTarget === stop.id ? "#fff" : "#1A2F5C"} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.removeStopBtn} onPress={() => removeStop(stop.id)}>
                <Ionicons name="close-circle" size={20} color="#EF4444" />
              </TouchableOpacity>
            </View>
            {activeStopId === stop.id && (stopSuggestions[stop.id] ?? []).length > 0 && (
              <View style={styles.suggestBox}>
                {(stopSuggestions[stop.id] ?? []).map((item, i) => (
                  <TouchableOpacity key={i} style={styles.suggestItem} onPress={() => selectStopSuggestion(item, stop.id)}>
                    <Ionicons name="location-outline" size={14} color="#1565C0" style={{ marginRight: 6, marginTop: 1 }} />
                    <Text style={styles.suggestText} numberOfLines={2}>{item.display_name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        ))}

        {/* To */}
        <Text style={styles.fieldLabel}>To (Destination)</Text>
        <View style={styles.locationRow}>
          <TextInput
            style={[styles.locationInput, { flex: 1 }]}
            placeholder="e.g. Pune, Maharashtra"
            placeholderTextColor="#5F6F8F"
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
            <Ionicons name="locate-outline" size={20} color={mapClickTarget === "end" ? "#fff" : "#1A2F5C"} />
          </TouchableOpacity>
        </View>
        {activeSuggestField === "end" && <SuggestionList items={endSuggestions} field="end" />}

        {/* Distance + Duration */}
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sectionLabel, { color: "rgba(255,255,255,0.90)" }]}>DISTANCE (AUTO KM)</Text>
            <View style={styles.inputBox}>
              <Text style={styles.inputText}>{distanceKm != null ? `${distanceKm} km` : "—"}</Text>
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sectionLabel, { color: "rgba(255,255,255,0.90)" }]}>DURATION (AUTO HOURS)</Text>
            <View style={styles.inputBox}>
              <Text style={styles.inputText}>{durationStr ?? "—"}</Text>
            </View>
          </View>
        </View>

        {/* Buttons */}
        <View style={styles.row}>
          <TouchableOpacity style={[styles.btn, styles.cancelBtn]} onPress={() => navigation.goBack()} activeOpacity={0.8}>
            <Text style={[styles.btnTxt, { color: "#fff" }]}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.confirmBtn, SHADOWS.btn]} onPress={onConfirm} disabled={loading} activeOpacity={0.85}>
            {loading
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={[styles.btnTxt, { color: "#fff" }]}>Confirm & Create Trip</Text>}
          </TouchableOpacity>
        </View>

        {/* Map with expand button */}
        <View style={styles.mapContainer}>
          {!mapReady
            ? <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#E8C9A0" }}>
                <ActivityIndicator size="small" color="#1565C0" />
                <Text style={{ color: "#3B1F0A", fontSize: 12, marginTop: 8 }}>Detecting location…</Text>
              </View>
            : <WebView
                ref={webViewRef}
                style={{ flex: 1 }}
                source={{ html: mapHtml }}
                javaScriptEnabled
                originWhitelist={["*"]}
                onMessage={onWebViewMessage}
              />
          }
          <TouchableOpacity style={styles.expandBtn} onPress={() => setFullScreen(true)}>
            <Ionicons name="expand-outline" size={18} color={COLORS.white} />
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* Fullscreen Map Modal — opens after confirm OR manual expand */}
      <Modal visible={fullScreen} animationType="fade" statusBarTranslucent>
        <View style={{ flex: 1, backgroundColor: "#000" }}>
          {mapReady && (
            <WebView
              ref={fullScreenWebViewRef}
              style={{ flex: 1 }}
              source={{ html: fsMapHtml }}
              javaScriptEnabled
              originWhitelist={["*"]}
              onMessage={(e) => {
                try {
                  const msg = JSON.parse(e.nativeEvent.data);
                  if (msg.type === "vehicleClick") setShowLivePopup(true);
                  else if (msg.lat && msg.lng && mapClickTarget) {
                    reverseGeocode(msg.lat, msg.lng, mapClickTarget);
                    setMapClickTarget(null);
                  }
                } catch { /* silent */ }
              }}
              onLoad={() => {
                fsMapReadyRef.current = true;
                if (startCoords && endCoords && polylineCoords) {
                  const latlngs = JSON.parse(polylineCoords).map((p: any) => [p.lat, p.lng]);
                  const validStops = tripStops.filter(s => s.coords);
                  const stopJs = validStops.map((s, i) =>
                    `addStopMarker(${s.coords!.lat},${s.coords!.lng},${i + 1},${JSON.stringify(s.place)});`
                  ).join("");
                  const js = `clearStopMarkers();drawRoute(${JSON.stringify(latlngs)},${startCoords.lat},${startCoords.lng},${endCoords.lat},${endCoords.lng});${stopJs} true;`;
                  setTimeout(() => fullScreenWebViewRef.current?.injectJavaScript(js), 300);
                  setTimeout(() => fullScreenWebViewRef.current?.injectJavaScript(js), 1200);
                }
              }}
            />
          )}

          {/* Live tracking stats bar — shown after trip confirmed */}
          {tripConfirmed && (
            <View style={styles.fsInfoBar}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fsInfoLabel}>REMAINING</Text>
                <Text style={styles.fsInfoValue}>
                  {liveRemainingKm != null ? `${liveRemainingKm} km` : (distanceKm != null ? `${distanceKm} km` : "—")}
                </Text>
              </View>
              <View style={styles.fsInfoDivider} />
              <View style={{ flex: 1 }}>
                <Text style={styles.fsInfoLabel}>ETA</Text>
                <Text style={styles.fsInfoValue}>
                  {liveEtaMin != null && liveEtaMin > 0
                    ? (liveEtaMin >= 60 ? `${Math.floor(liveEtaMin/60)}h ${liveEtaMin%60}min` : `${liveEtaMin}min`)
                    : (durationStr ?? "—")}
                </Text>
              </View>
              <View style={styles.fsInfoDivider} />
              <View style={{ flex: 1 }}>
                <Text style={styles.fsInfoLabel}>SPEED</Text>
                <Text style={[styles.fsInfoValue, { color: "#38BDF8" }]}>{liveSpeed} km/h</Text>
              </View>
              <View style={styles.fsInfoDivider} />
              <View style={{ flex: 1 }}>
                <Text style={styles.fsInfoLabel}>PROGRESS</Text>
                <Text style={[styles.fsInfoValue, { color: liveDeviating ? "#FF3B30" : "#4ADE80" }]}>
                  {liveDeviating ? "OFF ROUTE" : `${liveProgress.toFixed(0)}%`}
                </Text>
              </View>
            </View>
          )}

          {/* Back arrow — top-left, below info bar when trip is active */}
          <TouchableOpacity
            style={[styles.fsBackBtn, tripConfirmed && { top: 108 }]}
            onPress={() => {
              setFullScreen(false);
              fsMapReadyRef.current = false;
              if (tripConfirmed) navigation.goBack();
            }}
          >
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>

          {/* Zoom controls — top-left, below back button */}
          <View style={[styles.fsZoomControls, tripConfirmed && { top: 160 }]}>
            <TouchableOpacity style={styles.fsZoomBtn} onPress={() => fullScreenWebViewRef.current?.injectJavaScript("map.zoomIn(); true;")}>
              <Ionicons name="add" size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.fsZoomBtn} onPress={() => fullScreenWebViewRef.current?.injectJavaScript("map.zoomOut(); true;")}>
              <Ionicons name="remove" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Bell — top-right, below info bar, no overlap */}
          {tripConfirmed && (
            <TouchableOpacity
              style={styles.fsBellBtn}
              onPress={() => { markAllRead(); }}
              activeOpacity={0.75}
            >
              <Ionicons name="notifications-outline" size={22} color="#fff" />
              {unreadCount > 0 && (
                <View style={styles.fsBellBadge}>
                  <Text style={styles.fsBellBadgeTxt}>{unreadCount > 99 ? "99+" : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          )}

          {tripConfirmed && (
            <AlertNotifications
              toasts={toasts}
              bellHistory={bellHistory}
              unreadCount={unreadCount}
              onDismissToast={dismissToast}
              onMarkAllRead={markAllRead}
              onClearAll={clearAll}
              topOffset={tripConfirmed ? 90 : 0}
              hideBell
            />
          )}
        </View>

        {/* Vehicle Popup Modal */}
        <Modal visible={showLivePopup} transparent animationType="fade" onRequestClose={() => setShowLivePopup(false)}>
          <TouchableOpacity style={styles.popupOverlay} activeOpacity={1} onPress={() => setShowLivePopup(false)}>
            <View style={styles.popupBox}>
              {livePopup ? (
                <>
                  <Text style={styles.popupTitle}>{livePopup.vehicleId}</Text>
                  <Text style={styles.popupStatus}>{livePopup.status ?? "Idle"}</Text>
                  {([
                    ["Driver",          livePopup.driverName],
                    ["Speed",           livePopup.speed ? `${livePopup.speed} km/h` : "0 km/h"],
                    ["Coordinates",     livePopup.coordinates || "—"],
                    ["Last Update",     [livePopup.lastUpdateTime, livePopup.lastUpdateDate].filter(Boolean).join(" · ") || "—"],
                    ["Overspeed",       livePopup.overspeed],
                    ["Smoking",         livePopup.smoking],
                    ["Mobile Usage",    livePopup.mobileUsage],
                    ["Drowsiness",      livePopup.drowsiness],
                    ["Route Deviation", livePopup.routeDeviation],
                    ["Harsh Braking",   livePopup.harshBraking],
                    ["Harsh Acceleration", livePopup.harshAcceleration],
                    ["Rash Turning",    livePopup.rashTurning],
                  ] as [string, string][]).map(([label, value]) => (
                    <View key={label} style={styles.popupRow}>
                      <Text style={styles.popupLabel}>{label}:</Text>
                      <Text style={[styles.popupValue, (value === "Yes" || value === "Fatigue") && { color: "#FF3B30" }]}>
                        {value ?? "—"}
                      </Text>
                    </View>
                  ))}
                  {/* Address — stacked layout */}
                  <View style={styles.popupAddressRow}>
                    <Text style={styles.popupLabel}>Address:</Text>
                    <Text style={styles.popupAddressValue} numberOfLines={4}>
                      {livePopup.address || livePopup.location || "—"}
                    </Text>
                  </View>
                </>
              ) : (
                <Text style={[styles.popupStatus, { textAlign: "center", marginVertical: 16 }]}>
                  Loading vehicle data…
                </Text>
              )}
              <TouchableOpacity style={styles.popupClose} onPress={() => setShowLivePopup(false)}>
                <Text style={{ color: "#1565C0", fontWeight: "700" }}>Close</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      </Modal>

      {/* Vehicle Picker Modal */}
      <Modal visible={showVehiclePicker} transparent animationType="slide" onRequestClose={() => setShowVehiclePicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Select Vehicle</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search registration no..."
              placeholderTextColor="#5F6F8F"
              onChangeText={setVehicleSearch}
            />
            <FlatList
              data={filteredVehicles}
              keyExtractor={item => String(item.vehicle_id)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.vehicleItem}
                  onPress={() => { setSelectedVehicle(item); setShowVehiclePicker(false); setVehicleSearch(""); }}
                >
                  <Text style={styles.vehicleReg}>{item.registration_no}</Text>
                  <Text style={styles.vehicleDriver}>{item.driver_name}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={{ color: "#6B5A8E", textAlign: "center", padding: 20 }}>No vehicles found</Text>
              }
            />
            <TouchableOpacity style={styles.modalClose} onPress={() => setShowVehiclePicker(false)}>
              <Text style={{ color: "#EF4444", fontWeight: "700", fontSize: 15 }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={hideToast} />
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  gridH:           { position: "absolute", left: 0, right: 0, height: 1, backgroundColor: "rgba(255,255,255,0.025)" },
  pageHeader:      { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 },
  pageBackBtn:     { width: 36, height: 36, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.12)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  pageTitle:       { fontSize: 17, fontWeight: "800", color: "#fff", letterSpacing: -0.3 },
  pageSub:         { fontSize: 11, color: "rgba(255,255,255,0.60)", marginTop: 1 },
  scroll:          { paddingHorizontal: 14, paddingBottom: 32 },
  sectionLabel:    { fontSize: 10, fontWeight: "700", color: "rgba(255,255,255,0.75)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 5, marginTop: 10 },
  fieldLabel:      { fontSize: 12, fontWeight: "700", color: "rgba(255,255,255,0.90)", marginBottom: 5, marginTop: 8 },
  hint:            { fontSize: 10, color: "rgba(255,255,255,0.45)", marginBottom: 3, marginTop: 1 },
  inputBox:        { backgroundColor: "#F0F4FF", borderRadius: 10, borderWidth: 1.5, borderColor: "#BFDBFE", paddingHorizontal: 10, paddingVertical: 10, justifyContent: "center" },
  inputText:       { fontSize: 13, color: "#10204A", fontWeight: "600" },
  dropdown:        { backgroundColor: "#F0F4FF", borderRadius: 10, borderWidth: 1.5, borderColor: "#BFDBFE", paddingHorizontal: 10, paddingVertical: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  row:             { flexDirection: "row", gap: 8, marginTop: 3 },
  locationRow:     { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 3 },
  locationInput:   { backgroundColor: "#F0F4FF", borderRadius: 10, borderWidth: 1.5, borderColor: "#BFDBFE", paddingHorizontal: 10, paddingVertical: 10, fontSize: 13, color: "#10204A", fontWeight: "600" },
  locateBtn:       { width: 38, height: 38, borderRadius: 10, backgroundColor: "#F6F1E9", borderWidth: 1, borderColor: "rgba(160,90,30,0.30)", alignItems: "center", justifyContent: "center" },
  locateBtnActive: { backgroundColor: "#22C55E", borderColor: "#22C55E" },
  suggestBox:      { backgroundColor: "#F6F1E9", borderRadius: 8, borderWidth: 1, borderColor: "rgba(160,90,30,0.25)", marginBottom: 3, overflow: "hidden" },
  suggestItem:     { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(160,90,30,0.15)" },
  suggestText:     { fontSize: 12, color: "#3B1F0A", flex: 1 },
  mapContainer:    { height: 290, borderRadius: 12, overflow: "hidden", marginTop: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.20)" },
  expandBtn:       { position: "absolute", top: 8, right: 8, backgroundColor: "rgba(0,0,0,0.65)", padding: 6, borderRadius: 7 },
  mapControlsOverlay: { position: "absolute", top: 8, left: 8, zIndex: 10 },
  mapControlBtn:   { width: 36, height: 36, borderRadius: 9, backgroundColor: "rgba(0,0,0,0.7)", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "rgba(255,255,255,0.3)" },
  fsBackBtn:       { position: "absolute", top: 44, left: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.65)", alignItems: "center", justifyContent: "center", zIndex: 20 },
  fsZoomControls:  { position: "absolute", top: 96, left: 16, flexDirection: "column", gap: 8, zIndex: 20 },
  fsZoomBtn:       { width: 40, height: 40, borderRadius: 10, backgroundColor: "rgba(0,0,0,0.65)", alignItems: "center", justifyContent: "center" },
  fsBellBtn:       { position: "absolute", top: 108, right: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.65)", alignItems: "center", justifyContent: "center", zIndex: 20 },
  fsBellBadge:     { position: "absolute", top: -3, right: -3, backgroundColor: "#EF4444", borderRadius: 9, minWidth: 18, height: 18, alignItems: "center", justifyContent: "center", paddingHorizontal: 3, borderWidth: 2, borderColor: "#000" },
  fsBellBadgeTxt:  { fontSize: 9, fontWeight: "800", color: "#fff", lineHeight: 13 },
  fsCloseBtn:      { position: "absolute", top: 44, right: 16, backgroundColor: "rgba(0,0,0,0.7)", padding: 10, borderRadius: 8 },
  fsInfoBar:       { position: "absolute", top: 0, left: 0, right: 0, backgroundColor: "rgba(8,16,32,0.78)", flexDirection: "row", paddingTop: 44, paddingBottom: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.12)" },
  fsInfoLabel:     { fontSize: 10, fontWeight: "700", color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 0.6, textAlign: "center" },
  fsInfoValue:     { fontSize: 13, fontWeight: "800", color: "#fff", textAlign: "center", marginTop: 2 },
  fsInfoDivider:   { width: 1, backgroundColor: "rgba(255,255,255,0.15)", marginHorizontal: 8 },
  btn:             { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: "center", justifyContent: "center", marginTop: 12 },
  cancelBtn:       { backgroundColor: "#DC2626", borderWidth: 0 },
  confirmBtn:      { backgroundColor: "#16A34A" },
  btnTxt:          { fontSize: 13, fontWeight: "700", color: "#3B1F0A" },
  modalOverlay:    { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modalBox:        { backgroundColor: "#F6F1E9", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, maxHeight: "70%", borderWidth: 1, borderColor: "rgba(160,90,30,0.20)" },
  modalTitle:      { fontSize: 15, fontWeight: "800", color: "#0D1B3E", marginBottom: 10, textAlign: "center" },
  searchInput:     { backgroundColor: "#F0F4FF", borderRadius: 10, borderWidth: 1.5, borderColor: "#BFDBFE", paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: "#10204A", fontWeight: "600", marginBottom: 8 },
  vehicleItem:     { paddingVertical: 11, paddingHorizontal: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(160,90,30,0.15)" },
  vehicleReg:      { fontSize: 13, fontWeight: "700", color: "#0D1B3E" },
  vehicleDriver:   { fontSize: 11, color: "#4A6A8E", marginTop: 1 },
  modalClose:      { alignItems: "center", paddingVertical: 12 },
  popupOverlay:    { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", alignItems: "center" },
  popupBox:        { backgroundColor: "#F6F1E9", borderRadius: 16, padding: 18, width: "85%", borderWidth: 1, borderColor: "rgba(160,90,30,0.20)" },
  popupTitle:      { fontSize: 18, fontWeight: "800", color: "#0D1B3E", marginBottom: 2 },
  popupStatus:     { fontSize: 13, color: "#1565C0", fontWeight: "600", marginBottom: 12 },
  popupRow:        { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(160,90,30,0.12)" },
  popupLabel:      { fontSize: 13, color: "#6B5A8E", fontWeight: "600" },
  popupValue:      { fontSize: 13, color: "#0D1B3E", fontWeight: "700" },
  popupAddressRow: { flexDirection: "column", paddingVertical: 5, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(160,90,30,0.12)" },
  popupAddressValue: { fontSize: 12, color: "#0D1B3E", fontWeight: "600", marginTop: 2 },
  popupClose:      { alignItems: "center", marginTop: 14 },
  stopsHeader:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8, marginBottom: 4 },
  addStopBtn:      { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: "rgba(56,189,248,0.12)", borderWidth: 1, borderColor: "rgba(56,189,248,0.30)" },
  addStopTxt:      { fontSize: 12, fontWeight: "700", color: "#38BDF8" },
  stopRow:         { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 4 },
  stopReorder:     { flexDirection: "column", alignItems: "center", gap: 0 },
  stopNumBadge:    { width: 20, height: 20, borderRadius: 10, backgroundColor: "#F59E0B", alignItems: "center", justifyContent: "center" },
  stopNumTxt:      { fontSize: 10, fontWeight: "800", color: "#fff" },
  removeStopBtn:   { padding: 2 },
});

export default RegisterTripScreen;