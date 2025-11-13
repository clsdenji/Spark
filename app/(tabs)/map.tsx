import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Keyboard, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MapView, { Marker, PROVIDER_GOOGLE, Polyline, Callout } from 'react-native-maps';
import * as Location from 'expo-location';
import { getDistance } from 'geolib';
import { Feather, Entypo } from '@expo/vector-icons';
import { addSearch } from '../services/searchHistory';
import { makeParkingId, isParkingSaved, toggleParking, subscribeSavedParkings, getSavedParkings } from '../services/savedParkings';
import { useLocalSearchParams } from 'expo-router';
import { getParkingRecommendations, ParkingRecommendation } from "../services/parkingAPI";  // ⭐ NEW
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const GOLD = '#FFDE59';
const GRAY = '#9CA3AF';
// Highlight color for the chosen destination pin (distinct from gold parking pins)
const SELECTED_PIN = '#00A3FF'; // blue selected pin

type Place = {
  name: string;
  address?: string | null;
  lat: number;
  lon: number;
  distanceKm?: number;
  // optional metadata for recommended parkings
  opening?: string | null;
  closing?: string | null;
  guards?: number;
  cctvs?: number;
  initial_rate?: number;
  street_parking?: number;
  open_now?: boolean;
};

const MANILA = { latitude: 14.5995, longitude: 120.9842 };

const MapScreen: React.FC = () => {
  const params = useLocalSearchParams<{ destLat?: string; destLng?: string; destName?: string; from?: string; ts?: string }>();
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [originPhrase, setOriginPhrase] = useState('');
  const [destinationPhrase, setDestinationPhrase] = useState('');
  const [activeField, setActiveField] = useState<'from' | 'to' | null>(null);
  const [searchResults, setSearchResults] = useState<Place[]>([]);
  const [originPlace, setOriginPlace] = useState<Place | null>(null);
  const [destinationPlace, setDestinationPlace] = useState<Place | null>(null);
  const [routeCoords, setRouteCoords] = useState<Array<{ latitude: number; longitude: number }>>([]);
  const [parkings, setParkings] = useState<ParkingRecommendation[]>([]);  // ⭐ NEW
  const [loadingParkings, setLoadingParkings] = useState(false);          // ⭐ NEW (optional if you want to show a loader later)
  // ⭐ NEW: recommendations shown as suggestions when typing in the "To" field
  const [recommendedTo, setRecommendedTo] = useState<ParkingRecommendation[]>([]);
  const [loadingRecommendedTo, setLoadingRecommendedTo] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const lastRecoKeyRef = useRef<string | null>(null);
  const sortByDistanceKm = (a: ParkingRecommendation, b: ParkingRecommendation) => {
    const da = typeof a.distance_km === 'number' ? a.distance_km : Number.POSITIVE_INFINITY;
    const db = typeof b.distance_km === 'number' ? b.distance_km : Number.POSITIVE_INFINITY;
    return da - db;
  };

  const mapRef = useRef<MapView | null>(null);
  const originInputRef = useRef<TextInput | null>(null);
  const destinationInputRef = useRef<TextInput | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const routeAbortRef = useRef<AbortController | null>(null);
  const ZOOM_OUT_FACTOR = 1.4; // slightly zoomed out so the path is clearly seen
  const handledParamRef = useRef<string | null>(null);
  const insets = useSafeAreaInsets();
  // Report form state
  const [showReportForm, setShowReportForm] = useState(false);
  const [reportEmail, setReportEmail] = useState('');
  const [reportAddress, setReportAddress] = useState('');
  const [reportConcern, setReportConcern] = useState<string>('');
  const [reportDescription, setReportDescription] = useState('');
  const [attachments, setAttachments] = useState<Array<{ uri: string; name?: string; mimeType?: string }>>([]);
  const [pickingAttachment, setPickingAttachment] = useState(false);

  const concernOptions: Array<{ key: string; label: string }> = [
    { key: 'not_found', label: 'Not able to find location' },
    { key: 'suggest_area_info', label: 'Suggest area info' },
  ];

  // Stub for attachment picking (image/pdf). Real implementation would use expo-document-picker or expo-image-picker.
  const pickAttachment = async () => {
    if (pickingAttachment) return;
    setPickingAttachment(true);
    try {
      // Placeholder: push a dummy attachment. Replace with DocumentPicker.getDocumentAsync() integration.
      const dummy = { uri: 'dummy://attachment-' + (attachments.length + 1), name: 'sample.txt', mimeType: 'text/plain' };
      setAttachments((prev) => [...prev, dummy]);
    } catch (e) {
      // silent
    } finally {
      setPickingAttachment(false);
    }
  };

  const removeAttachment = (uri: string) => {
    setAttachments((prev) => prev.filter((a) => a.uri !== uri));
  };

  const submitReport = () => {
    // Basic validation
    if (!reportEmail.trim() || !reportConcern) {
      console.log('Report form: missing required fields');
      return;
    }
    const payload = {
      email: reportEmail.trim(),
      address: reportAddress.trim(),
      concern: reportConcern,
      description: reportDescription.trim(),
      attachments,
      ts: Date.now(),
    };
    console.log('Submitting report payload', payload);
    // Reset form after submit
    setShowReportForm(false);
    setReportEmail('');
    setReportAddress('');
    setReportConcern('');
    setReportDescription('');
    setAttachments([]);
  };

  useEffect(() => {
    // Do not auto-request or auto-use current location.
    // The user can opt-in by tapping the 'Use my current location' button.
    return () => {};
  }, []);

  // Subscribe to saved parkings to reflect bookmark state in the dropdown
  useEffect(() => {
    try {
      const initial = new Set<string>(getSavedParkings().map((p) => p.id));
      setSavedIds(initial);
    } catch {}
    const unsub = subscribeSavedParkings((items) => {
      try { setSavedIds(new Set(items.map((p) => p.id))); } catch {}
    });
    return () => { try { unsub(); } catch {} };
  }, []);

  const currentOriginCoord = originPlace
    ? { latitude: originPlace.lat, longitude: originPlace.lon }
    : null;
  const currentDestinationCoord = destinationPlace
    ? { latitude: destinationPlace.lat, longitude: destinationPlace.lon }
    : null;

  // ⭐ NEW: whenever destination changes, ask your FastAPI for best parkings near that point
  useEffect(() => {
    const fetchRecommendations = async () => {
      if (!destinationPlace) {
        setParkings([]);
        return;
      }
      try {
        setLoadingParkings(true);
        const recos = await getParkingRecommendations(
          destinationPlace.lat,
          destinationPlace.lon
        );
        // sort nearest -> farthest by default
        const sorted = [...recos].sort(sortByDistanceKm);
        setParkings(sorted);
        // console.log("✅ Parking recommendations:", recos.length);
      } catch (err) {
        console.error("Error fetching parking recommendations:", err);
        setParkings([]);
      } finally {
        setLoadingParkings(false);
      }
    };

    fetchRecommendations();
  }, [destinationPlace]);  // runs whenever the selected destination changes

  // ⭐ NEW: fetch recommendations to show inside the "To" suggestions based on user's origin/current location
  useEffect(() => {
    if (activeField !== 'to') return;
    const base = currentOriginCoord ?? (location ? { latitude: location.latitude, longitude: location.longitude } : null);
    // Require some base to compute recos; if none yet, fallback to Manila once
    const baseToUse = base ?? MANILA;
    const key = `${activeField}|${baseToUse.latitude.toFixed(5)},${baseToUse.longitude.toFixed(5)}`;
    if (lastRecoKeyRef.current === key) return; // avoid redundant calls when focus toggles
    lastRecoKeyRef.current = key;
    (async () => {
      try {
        setLoadingRecommendedTo(true);
        const recos = await getParkingRecommendations(baseToUse.latitude, baseToUse.longitude);
        // sort nearest -> farthest for default suggestion ranking
        setRecommendedTo([...recos].sort(sortByDistanceKm));
      } catch (e) {
        setRecommendedTo([]);
      } finally {
        setLoadingRecommendedTo(false);
      }
    })();
  }, [activeField, originPlace, location?.latitude, location?.longitude]);

  const fitCameraIfPossible = (maybeFrom: { latitude: number; longitude: number } | null, maybeTo: { latitude: number; longitude: number } | null) => {
    if (!mapRef.current) return;
    try {
      if (maybeFrom && maybeTo) {
        // Use bounds-based animation with a slight zoom-out to ensure both pins are comfortably in view
        animateToBounds([maybeFrom, maybeTo]);
      } else if (maybeFrom) {
        mapRef.current.animateToRegion(
          { latitude: maybeFrom.latitude, longitude: maybeFrom.longitude, latitudeDelta: 0.03, longitudeDelta: 0.03 },
          600
        );
      } else if (maybeTo) {
        mapRef.current.animateToRegion(
          { latitude: maybeTo.latitude, longitude: maybeTo.longitude, latitudeDelta: 0.03, longitudeDelta: 0.03 },
          600
        );
      }
    } catch {}
  };

  const doSearch = async (query: string) => {
    const q = query.trim();
    if (q.length < 2) { setSearchResults([]); return; }
    // cancel previous in-flight request
    try { abortRef.current?.abort(); } catch {}
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=8&addressdetails=1&q=${encodeURIComponent(q + ' Manila')}`;
      const res = await fetch(url, { signal: controller.signal, headers: { 'Accept-Language': 'en', 'User-Agent': 'YourApp/1.0 (expo)' } });
      const data = (await res.json()) as Array<any>;
      const base = currentOriginCoord ?? MANILA;
      const mapped: Place[] = data.map((d) => {
        const lat = parseFloat(d.lat);
        const lon = parseFloat(d.lon);
        const name = d.display_name || `${d.name || q}`;
        let distanceKm: number | undefined;
        try { distanceKm = getDistance(base, { latitude: lat, longitude: lon }) / 1000; } catch {}
        return { name, address: name, lat, lon, distanceKm };
      });
      setSearchResults(mapped);
    } catch (e) {
      if ((e as any)?.name !== 'AbortError') {
        setSearchResults([]);
      }
    }
  };

  // Fetch a single best match for a free-text query
  const fetchFirstPlace = async (query: string): Promise<Place | null> => {
    const q = query.trim();
    if (q.length < 2) return null;
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=1&q=${encodeURIComponent(q + ' Manila')}`;
      const res = await fetch(url, { headers: { 'Accept-Language': 'en', 'User-Agent': 'YourApp/1.0 (expo)' } });
      const data = (await res.json()) as Array<any>;
      const d = data?.[0];
      if (!d) return null;
      const lat = parseFloat(d.lat);
      const lon = parseFloat(d.lon);
  const name = d.display_name || `${d.name || q}`;
  return { name, address: name, lat, lon };
    } catch {
      return null;
    }
  };

  const shortAddress = (full: string, parts: number = 3, maxLen: number = 48): string => {
    try {
      const segs = full.split(',').map((s) => s.trim()).filter(Boolean);
      let s = segs.slice(0, parts).join(', ');
      if (s.length > maxLen) s = s.slice(0, maxLen - 1) + '…';
      return s || full;
    } catch {
      return full;
    }
  };

  const reverseGeocodeName = async (lat: number, lon: number): Promise<string> => {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&addressdetails=1&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`;
      const res = await fetch(url, {
        headers: { 'Accept-Language': 'en', 'User-Agent': 'YourApp/1.0 (expo)' },
      });
      const data = await res.json();
      const display = data?.display_name as string | undefined;
      if (display && display.trim().length > 0) return display;
    } catch {}
    return 'Current location';
  };

  const triggerSearch = (text: string) => {
    if (debounceRef.current) { clearTimeout(debounceRef.current as number); }
    debounceRef.current = setTimeout(() => doSearch(text), 250) as unknown as number;
  };

  // Convert ML recommendations into generic Place[] for the dropdown, filtered by user's query
  const recommendedPlaces: Place[] = (() => {
    try {
      const q = destinationPhrase.trim().toLowerCase();
      const filtered = recommendedTo.filter((p) => {
        if (!q) return true;
        const hay = `${p.name ?? ''} ${p.address ?? ''} ${p.city ?? ''}`.toLowerCase();
        return hay.includes(q);
      });
      // already sorted when set, but sort again after filtering to be safe
      const sorted = [...filtered].sort(sortByDistanceKm);
      const top = sorted.slice(0, 5).map((p) => ({
        name: p.name || p.address || 'Recommended parking',
        address: p.address || null,
        lat: p.lat,
        lon: p.lng,
        // prefer API-provided distance_km; fallback to client-computed
        distanceKm: typeof p.distance_km === 'number' ? p.distance_km : (() => {
          try {
            const base = currentOriginCoord ?? (location ? { latitude: location.latitude, longitude: location.longitude } : null);
            if (!base) return undefined;
            return getDistance(base, { latitude: p.lat, longitude: p.lng }) / 1000;
          } catch { return undefined; }
        })(),
        opening: (p as any).opening ?? null,
        closing: (p as any).closing ?? null,
        guards: (p as any).guards,
        cctvs: (p as any).cctvs,
        initial_rate: (p as any).initial_rate,
        street_parking: (p as any).street_parking,
        open_now: (p as any).open_now,
      }));
      return top;
    } catch { return []; }
  })();

  // Force re-compute and re-fit even if addresses are unchanged
  const refreshRoute = () => {
    try {
      const from = currentOriginCoord ?? (location ? { latitude: location.latitude, longitude: location.longitude } : null);
      const to = currentDestinationCoord;
      if (!to) return; // need a destination to show
      setTimeout(() => {
        fitCameraIfPossible(from, to);
        fetchRoute(from, to);
      }, 30);
    } catch {}
  };

  const setDestinationFromQuery = async (query: string) => {
    const best = await fetchFirstPlace(query);
    if (!best) return false;
    setActiveField('to');
    setDestinationPlace(best);
    try { setDestinationPhrase(shortAddress(best.name)); } catch {}
    const to = { latitude: best.lat, longitude: best.lon };
    const from = currentOriginCoord ?? (location ? { latitude: location.latitude, longitude: location.longitude } : null);
    setTimeout(() => {
      fitCameraIfPossible(from, to);
      fetchRoute(from, to);
    }, 50);
    // hide dropdown after selection
    try { setActiveField(null); Keyboard.dismiss(); setSearchResults([]); } catch {}
    return true;
  };

  const setOriginFromQuery = async (query: string) => {
    const best = await fetchFirstPlace(query);
    if (!best) return false;
    setActiveField('from');
    setOriginPlace(best);
    try { setOriginPhrase(shortAddress(best.name)); } catch {}
    const from = { latitude: best.lat, longitude: best.lon };
    const to = currentDestinationCoord;
    setTimeout(() => {
      fitCameraIfPossible(from, to);
      fetchRoute(from, to);
    }, 50);
    // hide dropdown after selection
    try { setActiveField(null); Keyboard.dismiss(); setSearchResults([]); } catch {}
    return true;
  };

  const animateToBounds = (points: Array<{ latitude: number; longitude: number }>) => {
    if (!mapRef.current || !points || points.length === 0) return;
    let minLat = Number.POSITIVE_INFINITY;
    let maxLat = Number.NEGATIVE_INFINITY;
    let minLon = Number.POSITIVE_INFINITY;
    let maxLon = Number.NEGATIVE_INFINITY;
    for (const p of points) {
      if (p.latitude < minLat) minLat = p.latitude;
      if (p.latitude > maxLat) maxLat = p.latitude;
      if (p.longitude < minLon) minLon = p.longitude;
      if (p.longitude > maxLon) maxLon = p.longitude;
    }
    if (!isFinite(minLat) || !isFinite(maxLat) || !isFinite(minLon) || !isFinite(maxLon)) return;
    const centerLat = (minLat + maxLat) / 2;
    const centerLon = (minLon + maxLon) / 2;
    let latDelta = (maxLat - minLat) * ZOOM_OUT_FACTOR || 0.02;
    let lonDelta = (maxLon - minLon) * ZOOM_OUT_FACTOR || 0.02;
    latDelta = Math.max(latDelta, 0.02);
    lonDelta = Math.max(lonDelta, 0.02);
    try {
      mapRef.current.animateToRegion({ latitude: centerLat, longitude: centerLon, latitudeDelta: latDelta, longitudeDelta: lonDelta }, 650);
    } catch {}
  };

  const fetchRoute = async (
    from: { latitude: number; longitude: number } | null,
    to: { latitude: number; longitude: number } | null
  ) => {
    if (!from || !to) { setRouteCoords([]); return; }
    try { routeAbortRef.current?.abort(); } catch {}
    const controller = new AbortController();
    routeAbortRef.current = controller;
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${from.longitude},${from.latitude};${to.longitude},${to.latitude}?overview=full&geometries=geojson`;
      const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'YourApp/1.0 (expo)' } });
      const data = await res.json();
      const coords: Array<{ latitude: number; longitude: number }> =
        data?.routes?.[0]?.geometry?.coordinates?.map((c: [number, number]) => ({ latitude: c[1], longitude: c[0] })) || [];
      setRouteCoords(coords);
      if (coords.length > 1) {
        animateToBounds(coords);
      }
    } catch (e) {
      if ((e as any)?.name !== 'AbortError') {
        setRouteCoords([]);
      }
    }
  };

  const useCurrentAsOrigin = async (toCoord?: { latitude: number; longitude: number } | null) => {
    try {
      let base = location;
      if (!base) {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const current = await Location.getCurrentPositionAsync({});
        base = { latitude: current.coords.latitude, longitude: current.coords.longitude };
        setLocation(base);
      }
      setActiveField('from');
      const addr = base ? await reverseGeocodeName(base.latitude, base.longitude) : 'Current location';
      const place = base ? { name: addr, lat: base.latitude, lon: base.longitude } : null;
      setOriginPlace(place);
      setOriginPhrase(shortAddress(addr));
      setSearchResults([]);
      Keyboard.dismiss();
      const from = base ? { latitude: base.latitude, longitude: base.longitude } : null;
      const to = toCoord ?? currentDestinationCoord;
      setTimeout(() => {
        fitCameraIfPossible(from, to);
        fetchRoute(from, to);
      }, 50);
      // also hide dropdown after choosing current location
      setActiveField(null);
    } catch {}
  };

  const clearOrigin = () => {
    try {
      setOriginPhrase('');
      setOriginPlace(null);
      setRouteCoords([]);
      setSearchResults([]);
      handledParamRef.current = null;
      const to = currentDestinationCoord;
      setTimeout(() => {
        fitCameraIfPossible(null, to);
      }, 50);
    } catch {}
  };

  const clearDestination = () => {
    try {
      setDestinationPhrase('');
      setDestinationPlace(null);
      setRouteCoords([]);
      setSearchResults([]);
      handledParamRef.current = null;
      setParkings([]);  // ⭐ NEW: clear parking markers if no destination
      const from = currentOriginCoord;
      setTimeout(() => {
        fitCameraIfPossible(from, null);
      }, 50);
    } catch {}
  };

  const handleSelectResult = (item: Place) => {
    if (activeField === 'from') {
      setOriginPlace(item);
      setOriginPhrase(shortAddress(item.name));
    } else if (activeField === 'to') {
      setDestinationPlace(item);
      setDestinationPhrase(shortAddress(item.name));
    }
    try {
      if (activeField === 'to') {
        addSearch({ name: shortAddress(item.name), address: item.address ?? item.name, lat: item.lat, lng: item.lon });
      }
    } catch {}
    setSearchResults([]);
    Keyboard.dismiss();
    const from = activeField === 'from' ? { latitude: item.lat, longitude: item.lon } : currentOriginCoord;
    const to = activeField === 'to' ? { latitude: item.lat, longitude: item.lon } : currentDestinationCoord;
    setTimeout(() => {
      fitCameraIfPossible(from ?? null, to ?? null);
      fetchRoute(from ?? null, to ?? null);
    }, 50);
    // hide dropdown after selecting a result
    setActiveField(null);
  };

  // Handle navigation params from History...
  useEffect(() => {
    const latStr = params?.destLat as string | undefined;
    const lngStr = params?.destLng as string | undefined;
    const nameStr = params?.destName as string | undefined;
    const fromFlag = params?.from as string | undefined;
    const ts = params?.ts as string | undefined;
    if (!latStr || !lngStr) return;
    const key = `${latStr}|${lngStr}|${nameStr ?? ''}|${fromFlag ?? ''}|${ts ?? ''}`;
    if (handledParamRef.current === key) return;
    handledParamRef.current = key;
    const lat = parseFloat(latStr);
    const lon = parseFloat(lngStr);
    if (!isFinite(lat) || !isFinite(lon)) return;
    const name = nameStr && nameStr.trim().length > 0 ? nameStr : `${lat.toFixed(5)}, ${lon.toFixed(5)}`;

    const dest: Place = { name, lat, lon };
    setActiveField('to');
    setDestinationPlace(dest);
    try { setDestinationPhrase(name); } catch {}

    if (fromFlag === 'me') {
      (async () => {
        try {
          await useCurrentAsOrigin({ latitude: lat, longitude: lon });
        } catch {}
      })();
    } else {
      const to = { latitude: lat, longitude: lon };
      setTimeout(() => {
        fitCameraIfPossible(currentOriginCoord, to);
        fetchRoute(currentOriginCoord, to);
      }, 80);
    }
  }, [params?.destLat, params?.destLng, params?.destName, params?.from, params?.ts]);

  const swapFromTo = () => {
    setOriginPlace(destinationPlace);
    setDestinationPlace(originPlace);
    setOriginPhrase(destinationPlace ? shortAddress(destinationPlace.name) : '');
    setDestinationPhrase(originPlace ? shortAddress(originPlace.name) : '');
    const newFrom = currentDestinationCoord ? { latitude: currentDestinationCoord.latitude, longitude: currentDestinationCoord.longitude } : null;
    const newTo = currentOriginCoord ? { latitude: currentOriginCoord.latitude, longitude: currentOriginCoord.longitude } : null;
    setTimeout(() => {
      fitCameraIfPossible(newFrom, newTo);
      fetchRoute(newFrom, newTo);
    }, 50);
  };

  const distanceToDestKm = (() => {
    try {
      if (currentOriginCoord && currentDestinationCoord) {
        return getDistance(currentOriginCoord, currentDestinationCoord) / 1000;
      }
      if (!currentOriginCoord && location && currentDestinationCoord) {
        return getDistance(location, currentDestinationCoord) / 1000;
      }
    } catch {}
    return null;
  })();
  const hasDistance = distanceToDestKm != null;

  return (
    <View style={styles.container}>
      <View style={[styles.searchContainer, { top: hasDistance ? 78 : 24 }]} pointerEvents="box-none">
        <LinearGradient colors={[GOLD, GRAY]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.searchCardBorder}>
          <View style={styles.searchCard}>
            <View style={styles.fieldsCol}>
              {/* FROM field */}
              <View style={[styles.row, activeField === 'from' && styles.rowActive]}>
                <Feather name="map-pin" size={16} color="#FFD166" />
                <TextInput
                  ref={(r) => { originInputRef.current = r; }}
                  style={styles.input}
                  placeholder="From"
                  placeholderTextColor="#8E8E93"
                  value={originPhrase}
                  onChangeText={(t) => {
                    setOriginPhrase(t);
                    setActiveField('from');
                    triggerSearch(t);
                  }}
                  onFocus={() => setActiveField('from')}
                  returnKeyType="search"
                  onSubmitEditing={() => setOriginFromQuery(originPhrase)}
                />
                {/* Crosshair button to use current location as origin */}
                <TouchableOpacity
                  accessibilityLabel="Use my current location as origin"
                  onPress={() => useCurrentAsOrigin(null)}
                  style={styles.clearTouch}
                >
                  <Feather name="crosshair" size={16} color="#FFD166" />
                </TouchableOpacity>
                {originPhrase.length > 0 && (
                  <TouchableOpacity onPress={clearOrigin} style={styles.clearTouch}>
                    <Feather name="x" size={16} color="#bdbdbd" />
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.divider} />

              {/* TO field */}
              <View style={[styles.row, activeField === 'to' && styles.rowActive]}>
                <Feather name="search" size={16} color="#FFD166" />
                <TextInput
                  ref={(r) => { destinationInputRef.current = r; }}
                  style={styles.input}
                  placeholder="To (Search for Parking Areas)"
                  placeholderTextColor="#8E8E93"
                  value={destinationPhrase}
                  onChangeText={(t) => {
                    setDestinationPhrase(t);
                    setActiveField('to');
                    triggerSearch(t);
                  }}
                  onFocus={() => setActiveField('to')}
                  returnKeyType="search"
                  onSubmitEditing={() => setDestinationFromQuery(destinationPhrase)}
                />
                {destinationPhrase.length > 0 && (
                  <TouchableOpacity onPress={clearDestination} style={styles.clearTouch}>
                    <Feather name="x" size={16} color="#bdbdbd" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Removed inline quick action; replaced by crosshair button next to From field */}
            </View>
            <View style={styles.swapCol}>
              <TouchableOpacity accessibilityLabel="Swap origin and destination" onPress={swapFromTo} style={styles.swapBtnCircle}>
                <Entypo name="swap" size={18} color="#FFD166" />
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>

        {(() => {
          const showDropdown = !!activeField && (
            searchResults.length > 0 ||
            (activeField === 'to' && (recommendedPlaces.length > 0 || loadingRecommendedTo))
          );
          return showDropdown;
        })() ? (
          <ScrollView style={styles.resultsContainer} keyboardShouldPersistTaps="handled">
            {/* Recommended header and items */}
            {activeField === 'to' && (
              <View>
                <View style={styles.recoHeaderRow}>
                  <Text style={styles.recoHeaderText}>Top parkings near you</Text>
                  {loadingRecommendedTo && <ActivityIndicator size="small" color="#FFD166" />}
                </View>
                <View style={styles.legendRow}>
                  <View style={styles.legendItemRow}>
                    <Feather name="shield" size={12} color="#8E8E93" style={styles.legendIcon} />
                    <Text style={styles.legendLabel}>Guards</Text>
                  </View>
                  <View style={styles.legendItemRow}>
                    <Feather name="video" size={12} color="#8E8E93" style={styles.legendIcon} />
                    <Text style={styles.legendLabel}>CCTV</Text>
                  </View>
                </View>
                {recommendedPlaces.map((r, i) => {
                  const id = makeParkingId(r.lat, r.lon);
                  const saved = savedIds.has(id);
                  return (
                  <TouchableOpacity key={`reco-${r.lat}-${r.lon}-${i}`} style={styles.resultItem} onPress={() => handleSelectResult(r)}>
                    <Text style={styles.resultText} numberOfLines={2}>{r.name}</Text>
                    <TouchableOpacity
                      accessibilityLabel={saved ? 'Remove bookmark' : 'Save bookmark'}
                      onPress={(e) => { e.stopPropagation?.(); toggleParking({ id, name: r.name, address: r.name, lat: r.lat, lng: r.lon }); }}
                      style={styles.bookmarkBtn}
                    >
                      <Feather name="bookmark" size={16} color={saved ? '#FFD166' : '#8E8E93'} />
                    </TouchableOpacity>
                    <View style={styles.resultDetailsRow}>
                      {r.distanceKm != null && (
                        <Text style={styles.resultDetailText}>{r.distanceKm.toFixed(2)} km</Text>
                      )}
                      {(() => {
                        const rate = typeof r.initial_rate === 'number' && isFinite(r.initial_rate) ? `~₱${r.initial_rate.toFixed(0)}` : '';
                        return rate ? (<Text style={styles.resultDetailText}>{rate}</Text>) : null;
                      })()}
                      {!!r.guards && (
                        <Feather name="shield" size={12} color="#bdbdbd" style={styles.resultDetailIcon} />
                      )}
                      {!!r.cctvs && (
                        <Feather name="video" size={12} color="#bdbdbd" style={styles.resultDetailIcon} />
                      )}
                      {!!r.street_parking && (
                        <Text style={styles.resultDetailText}>Street</Text>
                      )}
                      {(() => {
                        const hrs = (r.opening || r.closing) ? `${r.opening ?? ''}${(r.opening || r.closing) ? ' - ' : ''}${r.closing ?? ''}`.trim() : '';
                        return hrs ? (<Text style={styles.resultDetailText}>{hrs}</Text>) : null;
                      })()}
                    </View>
                  </TouchableOpacity>
                );})}
                {recommendedPlaces.length > 0 && <View style={styles.sectionDivider} />}
              </View>
            )}

            {/* Regular geocoder results */}
            {searchResults.map((r, i) => {
              const id = makeParkingId(r.lat, r.lon);
              const saved = savedIds.has(id);
              return (
              <TouchableOpacity key={`${r.lat}-${r.lon}-${i}`} style={styles.resultItem} onPress={() => handleSelectResult(r)}>
                <Text style={styles.resultText} numberOfLines={2}>{r.name}</Text>
                <TouchableOpacity
                  accessibilityLabel={saved ? 'Remove bookmark' : 'Save bookmark'}
                  onPress={(e) => { e.stopPropagation?.(); toggleParking({ id, name: r.name, address: r.name, lat: r.lat, lng: r.lon }); }}
                  style={styles.bookmarkBtn}
                >
                  <Feather name="bookmark" size={16} color={saved ? '#FFD166' : '#8E8E93'} />
                </TouchableOpacity>
                <Text style={styles.resultDistance}>{r.distanceKm != null ? `${r.distanceKm.toFixed(2)} km` : ''}</Text>
              </TouchableOpacity>
            );})}
          </ScrollView>
        ) : null}
      </View>

      <MapView
        ref={(r) => { mapRef.current = r; }}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={{ latitude: MANILA.latitude, longitude: MANILA.longitude, latitudeDelta: 0.0922, longitudeDelta: 0.0421 }}
        onPress={() => {
          try {
            setActiveField(null);
            setSearchResults([]);
            Keyboard.dismiss();
          } catch {}
        }}
      >
        {currentOriginCoord && (
          <Marker coordinate={currentOriginCoord} title={originPlace ? originPlace.name : 'Your location'} pinColor="yellow" />
        )}
        {currentDestinationCoord && (
          <Marker coordinate={currentDestinationCoord} title={destinationPlace?.name} pinColor={SELECTED_PIN} />
        )}

        {/* ⭐ NEW: parking recommendation markers */}
        {parkings.map((p) => {
          const hours = p.opening || p.closing ? `${p.opening ?? ''}${p.opening || p.closing ? ' - ' : ''}${p.closing ?? ''}`.trim() : '';
          const rateText = isFinite(p.initial_rate) ? `~₱${p.initial_rate.toFixed(0)}` : '₱—';
          // Fallback textual description for native callouts (use G/C shorthand in pins)
          const descParts: string[] = [];
          descParts.push(`${p.distance_km.toFixed(2)} km`);
          descParts.push(rateText);
          const gc = `G${p.guards ? '✓' : '✗'}/C${p.cctvs ? '✓' : '✗'}`;
          descParts.push(gc);
          if (p.street_parking) descParts.push('Street');
          if (hours) descParts.push(hours);
          const descText = descParts.join(' • ');
          return (
            <Marker
              key={`parking-${p.index}-${p.lat}-${p.lng}`}
              coordinate={{ latitude: p.lat, longitude: p.lng }}
              title={p.name || "Recommended parking"}
              description={descText}
              pinColor="#FFDE59" // golden pins for Spark parkings
            >
              <Callout tooltip>
                <View style={styles.calloutContainer}>
                  <View style={styles.callout}>
                    <Text style={styles.calloutTitle} numberOfLines={2}>{p.name || 'Recommended parking'}</Text>
                    <View style={styles.calloutRow}>
                      <Text style={styles.calloutChip}>{`${p.distance_km.toFixed(2)} km`}</Text>
                      <Text style={styles.calloutChip}>{rateText}</Text>
                      <Text style={[styles.calloutChip, p.open_now ? styles.calloutOpen : styles.calloutClosed]}>
                        {p.open_now ? 'Open' : 'Closed'}
                      </Text>
                    </View>
                    <View style={styles.calloutRow}>
                      {!!p.guards && <Feather name="shield" size={12} color="#bdbdbd" style={styles.calloutIcon} />}
                      {!!p.cctvs && <Feather name="video" size={12} color="#bdbdbd" style={styles.calloutIcon} />}
                      {!!p.street_parking && <Text style={styles.calloutChip}>Street</Text>}
                      {hours ? (
                        <View style={styles.calloutHours}>
                          <Feather name="clock" size={12} color="#bdbdbd" />
                          <Text style={styles.calloutHoursText}>{hours}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                  <View style={styles.calloutArrowBorder} />
                  <View style={styles.calloutArrow} />
                </View>
              </Callout>
            </Marker>
          );
        })}

        {routeCoords && routeCoords.length > 1 && (
          <Polyline coordinates={routeCoords} strokeColor="#34C759" strokeWidth={4} />
        )}
      </MapView>

      {/* Floating button to open report form */}
      {!showReportForm && (
        <TouchableOpacity
          accessibilityLabel="Open report form"
          onPress={() => setShowReportForm(true)}
          style={[styles.editFab, { bottom: Math.max(24, insets.bottom + 72) }]}
          activeOpacity={0.85}
        >
          <Feather name="edit-2" size={20} color="#FFD166" />
        </TouchableOpacity>
      )}

      {showReportForm && (
        <View style={[styles.reportOverlay, { paddingBottom: Math.max(insets.bottom, 12) }]}> 
          <View style={styles.reportHeaderRow}>
            <Text style={styles.reportTitle}>Report / Suggest</Text>
            <TouchableOpacity onPress={() => setShowReportForm(false)} style={styles.reportCloseBtn}>
              <Feather name="x" size={18} color="#bdbdbd" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.reportScroll} keyboardShouldPersistTaps="handled">
            <View style={styles.formGroup}>
              <Text style={styles.label}>Email *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="you@example.com"
                placeholderTextColor="#666"
                value={reportEmail}
                onChangeText={setReportEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Concerned Address</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Address or landmark"
                placeholderTextColor="#666"
                value={reportAddress}
                onChangeText={setReportAddress}
              />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Concern *</Text>
              <TouchableOpacity
                style={styles.dropdownTrigger}
                onPress={() => {
                  // cycle through options for simplicity if no dropdown expanded UI
                  const idx = concernOptions.findIndex((o) => o.key === reportConcern);
                  const next = concernOptions[(idx + 1) % concernOptions.length];
                  setReportConcern(next.key);
                }}
              >
                <Text style={styles.dropdownTriggerText}>{concernOptions.find((o) => o.key === reportConcern)?.label || 'Tap to select concern'}</Text>
                <Feather name="chevron-down" size={16} color="#FFD166" />
              </TouchableOpacity>
              <View style={styles.dropdownHintRow}>
                {concernOptions.map((o) => (
                  <TouchableOpacity
                    key={o.key}
                    style={[styles.optionChip, reportConcern === o.key && styles.optionChipActive]}
                    onPress={() => setReportConcern(o.key)}
                  >
                    <Text style={styles.optionChipText}>{o.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.formInput, styles.multilineInput]}
                placeholder="Describe the issue or suggestion"
                placeholderTextColor="#666"
                value={reportDescription}
                onChangeText={setReportDescription}
                multiline
                numberOfLines={4}
              />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Attachments (image/pdf)</Text>
              <View style={styles.attachRow}>
                <TouchableOpacity style={styles.attachBtn} onPress={pickAttachment} disabled={pickingAttachment}>
                  <Feather name="paperclip" size={16} color="#FFD166" />
                  <Text style={styles.attachBtnText}>{pickingAttachment ? 'Adding...' : 'Add'}</Text>
                </TouchableOpacity>
              </View>
              {attachments.length > 0 && (
                <View style={styles.attachmentList}>
                  {attachments.map((a) => (
                    <View key={a.uri} style={styles.attachmentItem}>
                      <Text style={styles.attachmentText} numberOfLines={1}>{a.name || a.uri}</Text>
                      <TouchableOpacity onPress={() => removeAttachment(a.uri)} style={styles.attachmentRemove}>
                        <Feather name="x" size={14} color="#bdbdbd" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>
            <View style={styles.submitRow}>
              <TouchableOpacity
                style={[styles.submitBtn, (!reportEmail.trim() || !reportConcern) && styles.submitBtnDisabled]}
                onPress={submitReport}
                disabled={!reportEmail.trim() || !reportConcern}
              >
                <Text style={styles.submitBtnText}>Submit</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowReportForm(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      )}

      {distanceToDestKm != null && (
        <View style={styles.distanceContainer}>
          <Text style={styles.distanceText}>{`Distance: ${distanceToDestKm.toFixed(2)} km way`}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  searchContainer: { position: 'absolute', top: 78, left: 20, right: 20, zIndex: 900, elevation: 5 },
  searchCardBorder: { borderRadius: 16, padding: 2 },
  searchCard: { flexDirection: 'row', backgroundColor: '#000', borderRadius: 14, paddingHorizontal: 8, paddingVertical: 6, alignItems: 'stretch' },
  fieldsCol: { flex: 1, justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 4, borderRadius: 8 },
  rowActive: { backgroundColor: '#0b0b0b' },
  divider: { height: 1, backgroundColor: '#222', marginVertical: 4 },
  input: { color: '#fff', marginLeft: 8, flex: 1 },
  clearTouch: { padding: 6 },
  swapCol: { width: 44, justifyContent: 'center', alignItems: 'center', paddingLeft: 4 },
  swapBtnCircle: { backgroundColor: '#0b0b0b', borderRadius: 16, padding: 8, borderWidth: 1, borderColor: '#222' },
  resultsContainer: { marginTop: 8, backgroundColor: '#0b0b0b', borderRadius: 10, padding: 6, maxHeight: 220, opacity: 0.75 },
  resultItem: { paddingVertical: 10, paddingHorizontal: 8, borderBottomColor: '#222', borderBottomWidth: 1 },
  resultText: { color: '#fff', fontSize: 14 },
  resultDistance: { color: '#bdbdbd', fontSize: 12, marginTop: 4 },
  bookmarkBtn: { position: 'absolute', right: 8, top: 10, padding: 6 },
  recoHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 6, paddingVertical: 4 },
  recoHeaderText: { color: '#FFD166', fontSize: 12, fontWeight: '600' },
  legendRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingBottom: 4 },
  legendItemRow: { flexDirection: 'row', alignItems: 'center', marginRight: 12 },
  legendIcon: { marginRight: 6 },
  legendLabel: { color: '#8E8E93', fontSize: 11 },
  resultDetailsRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginTop: 4 },
  resultDetailText: { color: '#bdbdbd', fontSize: 12, marginRight: 8, marginBottom: 4 },
  resultDetailIcon: { marginRight: 8, marginBottom: 4 },
  callout: { padding: 8, minWidth: 180, maxWidth: 280, backgroundColor: '#111', borderRadius: 10, borderWidth: 1, borderColor: '#222' },
  calloutTitle: { color: '#fff', fontSize: 14, fontWeight: '600', marginBottom: 6 },
  calloutRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 },
  calloutChip: { color: '#bdbdbd', fontSize: 12, marginRight: 8, marginBottom: 4 },
  calloutIcon: { marginRight: 8 },
  calloutHours: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  calloutHoursText: { color: '#bdbdbd', fontSize: 12, marginLeft: 4 },
  calloutOpen: { color: '#6EE7B7' },
  calloutClosed: { color: '#FCA5A5' },
  calloutContainer: { flexDirection: 'column', alignSelf: 'flex-start' },
  calloutArrowBorder: { alignSelf: 'center', backgroundColor: 'transparent', borderColor: 'transparent', borderTopColor: '#222', borderWidth: 8, marginTop: -1 },
  calloutArrow: { alignSelf: 'center', backgroundColor: 'transparent', borderColor: 'transparent', borderTopColor: '#111', borderWidth: 8, marginTop: -14 },
  sectionDivider: { height: 1, backgroundColor: '#222', marginVertical: 6 },
  distanceContainer: { position: 'absolute', top: 24, left: 20, right: 20, backgroundColor: '#000', padding: 10, borderRadius: 10, zIndex: 1100, elevation: 10 },
  distanceText: { color: '#FFD166', fontSize: 16, fontWeight: '600' },
  editFab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    backgroundColor: '#000',
    borderRadius: 24,
    padding: 12,
    borderWidth: 1,
    borderColor: '#222',
    zIndex: 1200,
    elevation: 12,
  },
  reportOverlay: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 0,
    backgroundColor: '#0b0b0b',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 14,
    zIndex: 1300,
    elevation: 18,
    borderWidth: 1,
    borderColor: '#222',
  },
  reportHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  reportTitle: { color: '#FFD166', fontSize: 16, fontWeight: '600' },
  reportCloseBtn: { padding: 6 },
  reportScroll: { maxHeight: 380 },
  formGroup: { marginBottom: 14 },
  label: { color: '#bdbdbd', fontSize: 12, marginBottom: 6 },
  formInput: { backgroundColor: '#111', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 10, color: '#fff', fontSize: 14, borderWidth: 1, borderColor: '#222' },
  multilineInput: { minHeight: 100, textAlignVertical: 'top' },
  dropdownTrigger: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#111', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, borderWidth: 1, borderColor: '#222' },
  dropdownTriggerText: { color: '#fff', fontSize: 14, flex: 1, marginRight: 8 },
  dropdownHintRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  optionChip: { backgroundColor: '#111', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6, marginRight: 8, marginBottom: 8, borderWidth: 1, borderColor: '#222' },
  optionChipActive: { backgroundColor: '#FFD16622', borderColor: '#FFD166' },
  optionChipText: { color: '#FFD166', fontSize: 12 },
  attachRow: { flexDirection: 'row', alignItems: 'center' },
  attachBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#222' },
  attachBtnText: { color: '#FFD166', fontSize: 14, marginLeft: 6 },
  attachmentList: { marginTop: 10 },
  attachmentItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, marginBottom: 6, borderWidth: 1, borderColor: '#222' },
  attachmentText: { flex: 1, color: '#fff', fontSize: 12, marginRight: 8 },
  attachmentRemove: { padding: 4 },
  submitRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  submitBtn: { flex: 1, backgroundColor: '#FFD166', paddingVertical: 14, borderRadius: 10, alignItems: 'center', marginRight: 10 },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnText: { color: '#000', fontWeight: '600', fontSize: 14 },
  cancelBtn: { paddingVertical: 14, paddingHorizontal: 18 },
  cancelBtnText: { color: '#FFD166', fontSize: 14 },
});

export default MapScreen;
