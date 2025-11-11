import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Button,
  Alert,
  Animated,
  Easing,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import * as Location from "expo-location";

type Props = {
  onPermissionGranted: (location: Location.LocationObject) => void;
};

const GOLD = "#FFDE59";
const AURA = "rgba(255, 222, 89, 0.28)";
const AURA_STRONG = "rgba(255, 222, 89, 0.45)";
const DELAY_BEFORE_REQUEST_MS = 1000; // show text briefly first

const LocationPermission: React.FC<Props> = ({ onPermissionGranted }) => {
  const [visible, setVisible] = useState(true);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // adaptive sizing
  const { width, height } = useWindowDimensions();
  const scaleBase = Math.min(width / 390, height / 844);
  const size = (n: number) => Math.round(n * Math.max(0.8, scaleBase));

  // neon breathing
  const scale = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.14, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1.0,  duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(glow,  { toValue: 1,    duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(glow,  { toValue: 0.75, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [scale, glow]);

  const askLocationPermission = async () => {
    setErrorMsg(null);
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setErrorMsg("Permission to access location was denied.");
        Alert.alert("Permission denied", "Location permission is required to proceed.");
        return;
      }

      // ✅ Hide overlay immediately after success
      const location = await Location.getCurrentPositionAsync({});
      setVisible(false);
      onPermissionGranted(location);
    } catch {
      setErrorMsg("An error occurred while fetching location.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => {
      askLocationPermission();
    }, DELAY_BEFORE_REQUEST_MS);
    return () => clearTimeout(t);
  }, []);

  const Spark = () => (
    <View style={[styles.sparkWrap, { width: size(160), height: size(160), marginBottom: size(18) }]} pointerEvents="none">
      <Animated.Text
        style={{
          position: "absolute",
          fontSize: size(50),
          color: GOLD,
          textShadowColor: AURA_STRONG,
          textShadowRadius: size(30),
          textShadowOffset: { width: 0, height: 0 },
          opacity: glow as any,
          transform: [{ scale }],
        }}
      >
        ⚡
      </Animated.Text>
      <Animated.Text
        style={{
          fontSize: size(84),
          color: GOLD,
          textShadowColor: AURA,
          textShadowRadius: size(22),
          textShadowOffset: { width: 0, height: 0 },
          transform: [{ scale }],
        }}
      >
        ⚡
      </Animated.Text>
    </View>
  );

  if (!visible) return null; // ✅ removes component after success

  return (
    <View style={styles.overlay}>
      <View style={styles.centerBox}>
        <Spark />
        {loading && (
          <Text style={[styles.msg, { fontSize: size(16) }]}>
            Requesting location permission…
          </Text>
        )}
        {errorMsg && (
          <>
            <Text style={[styles.error, { fontSize: size(15), marginBottom: size(16), paddingHorizontal: size(12) }]}>
              {errorMsg}
            </Text>
            <View style={{ width: "70%" }}>
              <Button title="Try Again" onPress={askLocationPermission} />
            </View>
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
    zIndex: 9999,
    elevation: 20,
  },
  centerBox: {
    alignItems: "center",
    justifyContent: "center",
  },
  sparkWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  msg: {
    marginTop: 8,
    color: "#fff",
    opacity: 0.92,
    textAlign: "center",
  },
  error: {
    color: "#ff6b6b",
    textAlign: "center",
  },
});

export default LocationPermission;
