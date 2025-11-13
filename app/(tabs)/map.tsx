import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Keyboard } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MapView, { Marker, PROVIDER_GOOGLE, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { getDistance } from 'geolib';
import { Feather, Entypo } from '@expo/vector-icons';
import { addSearch } from '../services/searchHistory';

const GOLD = '#FFDE59';
const GRAY = '#9CA3AF';

type Place = { name: string; lat: number; lon: number; distanceKm?: number };

const MANILA = { latitude: 14.5995, longitude: 120.9842 };

const MapScreen: React.FC = () => {
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [originPhrase, setOriginPhrase] = useState('');
  const [destinationPhrase, setDestinationPhrase] = useState('');
  const [activeField, setActiveField] = useState<'from' | 'to' | null>(null);
  const [searchResults, setSearchResults] = useState<Place[]>([]);
  const [originPlace, setOriginPlace] = useState<Place | null>(null);
  const [destinationPlace, setDestinationPlace] = useState<Place | null>(null);
  const [routeCoords, setRouteCoords] = useState<Array<{ latitude: number; longitude: number }>>([]);

  const mapRef = useRef<MapView | null>(null);
  const originInputRef = useRef<TextInput | null>(null);
  const destinationInputRef = useRef<TextInput | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const routeAbortRef = useRef<AbortController | null>(null);
  const ZOOM_OUT_FACTOR = 1.4; // slightly zoomed out so the path is clearly seen

  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const current = await Location.getCurrentPositionAsync({});
        setLocation({ latitude: current.coords.latitude, longitude: current.coords.longitude });
        subscription = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, distanceInterval: 10 },
          (pos) => setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude })
        );
      } catch {}
    })();
    return () => { try { subscription?.remove(); } catch {} };
  }, []);

  const currentOriginCoord = originPlace
    ? { latitude: originPlace.lat, longitude: originPlace.lon }
    : null;
  const currentDestinationCoord = destinationPlace
    ? { latitude: destinationPlace.lat, longitude: destinationPlace.lon }
    : null;

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
        return { name, lat, lon, distanceKm };
      });
      setSearchResults(mapped);
    } catch (e) {
      if ((e as any)?.name !== 'AbortError') {
        setSearchResults([]);
      }
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
    // ensure a minimum view size to avoid too-tight zooms
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

  const useCurrentAsOrigin = async () => {
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
      // do not record current location in recent searches
      setSearchResults([]);
      Keyboard.dismiss();
      const from = base ? { latitude: base.latitude, longitude: base.longitude } : null;
      const to = currentDestinationCoord;
      setTimeout(() => {
        fitCameraIfPossible(from, to);
        fetchRoute(from, to);
      }, 50);
    } catch {}
  };

  const clearOrigin = () => {
    try {
      setOriginPhrase('');
      setOriginPlace(null);
      setRouteCoords([]);
      setSearchResults([]);
      // center on destination if present
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
      // center on origin if present
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
    // record only destination searches in history
    try {
      if (activeField === 'to') {
        addSearch({ name: shortAddress(item.name), address: item.name, lat: item.lat, lng: item.lon });
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
  };

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
            <View style={styles.row}>
              <Feather name="navigation" size={18} color="#FFD166" />
              <TextInput
                ref={originInputRef}
                style={styles.input}
                placeholder="From: Your location"
                placeholderTextColor="#bdbdbd"
                value={originPhrase}
                onFocus={() => setActiveField('from')}
                onChangeText={(t) => {
                  setOriginPhrase(t);
                  setActiveField('from');
                  if (t.trim().length === 0) {
                    clearOrigin();
                  } else {
                    triggerSearch(t);
                  }
                }}
                returnKeyType="search"
                onSubmitEditing={() => doSearch(originPhrase)}
              />
              {!!originPhrase && (
                <TouchableOpacity onPress={() => { clearOrigin(); originInputRef.current?.focus?.(); }} style={styles.clearTouch}>
                  <Entypo name="cross" size={18} color="#FFD166" />
                </TouchableOpacity>
              )}
              {location && (
                <TouchableOpacity onPress={useCurrentAsOrigin} style={styles.clearTouch} accessibilityLabel="Use current location">
                  <Feather name="crosshair" size={18} color="#FFD166" />
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.divider} />
            <View style={[styles.row, activeField === 'to' ? styles.rowActive : null]}>
              <Feather name="search" size={18} color="#FFD166" />
              <TextInput
                ref={destinationInputRef}
                style={styles.input}
                placeholder="To: Search Parking Areas in Manila"
                placeholderTextColor="#bdbdbd"
                value={destinationPhrase}
                onFocus={() => setActiveField('to')}
                onChangeText={(t) => {
                  setDestinationPhrase(t);
                  setActiveField('to');
                  if (t.trim().length === 0) {
                    clearDestination();
                  } else {
                    triggerSearch(t);
                  }
                }}
                returnKeyType="search"
                onSubmitEditing={() => doSearch(destinationPhrase)}
              />
              {!!destinationPhrase && (
                <TouchableOpacity onPress={() => { clearDestination(); destinationInputRef.current?.focus?.(); }} style={styles.clearTouch}>
                  <Entypo name="cross" size={18} color="#FFD166" />
                </TouchableOpacity>
              )}
            </View>
          </View>
          <View style={styles.swapCol}>
            <TouchableOpacity accessibilityLabel="Swap origin and destination" onPress={swapFromTo} style={styles.swapBtnCircle}>
              <Entypo name="swap" size={18} color="#FFD166" />
            </TouchableOpacity>
          </View>
  </View>
  </LinearGradient>

        {searchResults.length > 0 && (
          <ScrollView style={styles.resultsContainer} keyboardShouldPersistTaps="handled">
            {searchResults.map((r, i) => (
              <TouchableOpacity key={`${r.lat}-${r.lon}-${i}`} style={styles.resultItem} onPress={() => handleSelectResult(r)}>
                <Text style={styles.resultText} numberOfLines={2}>{r.name}</Text>
                <Text style={styles.resultDistance}>{r.distanceKm != null ? `${r.distanceKm.toFixed(2)} km` : ''}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      <MapView
        ref={(r) => { mapRef.current = r; }}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={{ latitude: MANILA.latitude, longitude: MANILA.longitude, latitudeDelta: 0.0922, longitudeDelta: 0.0421 }}
      >
        {currentOriginCoord && (
          <Marker coordinate={currentOriginCoord} title={originPlace ? originPlace.name : 'Your location'} pinColor="yellow" />
        )}
        {currentDestinationCoord && (
          <Marker coordinate={currentDestinationCoord} title={destinationPlace?.name} pinColor="green" />
        )}
        {routeCoords && routeCoords.length > 1 && (
          <Polyline coordinates={routeCoords} strokeColor="#FFD166" strokeWidth={4} />
        )}
      </MapView>

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
  distanceContainer: { position: 'absolute', top: 24, left: 20, right: 20, backgroundColor: '#000', padding: 10, borderRadius: 10, zIndex: 1100, elevation: 10 },
  distanceText: { color: '#FFD166', fontSize: 16, fontWeight: '600' },
});

export default MapScreen;
