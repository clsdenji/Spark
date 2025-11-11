// app/AuthSplashScreen.tsx (or .tsx)
// If using .jsx, remove the `type` imports and the `: Type` annotations.

import React, { useEffect, useRef, useState, type FC } from "react";
import { View, StyleSheet, Animated, Easing, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useFonts } from "expo-font";
import { MuseoModerno_700Bold } from "@expo-google-fonts/museomoderno";
import { supabase } from "./services/supabaseClient";
import LocationPermission from "./hooks/usePermissionLocation";

// --- Types for Animated values (TS only) ---
import type { Animated as RNAnimated } from "react-native";

const GREEN = "#7ED957";
const GOLD = "#FFDE59";
const GREEN_GLOW = "rgba(126, 217, 87, 0.55)";
const GOLD_GLOW = "rgba(255, 222, 89, 0.55)";
const TRACK_WIDTH = 280;
const BUFFER = 140;
const PASS = TRACK_WIDTH + BUFFER;
const DURATION = 2600;

export default function AuthSplashScreen() {
  const router = useRouter();
  const [showPermission, setShowPermission] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);

  const inOpacity = useRef(new Animated.Value(0)).current;
  const inScale = useRef(new Animated.Value(0.96)).current;
  const contentOpacity = useRef(new Animated.Value(1)).current;
  const veilOpacity = useRef(new Animated.Value(0)).current;
  const greenX = useRef(new Animated.Value(-PASS)).current;
  const yellowX = useRef(new Animated.Value(+PASS)).current;
  const neonPulse = useRef(new Animated.Value(0.9)).current;

  const [fontsLoaded] = useFonts({ MuseoModerno_700Bold });

  // Check session before splash
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        router.replace("/(tabs)/map");
      } else {
        setSessionChecked(true);
      }
    })();
  }, []);

  // Run animation if no session
  useEffect(() => {
    if (!fontsLoaded || !sessionChecked) return;

    Animated.parallel([
      Animated.timing(inOpacity, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(inScale, {
        toValue: 1,
        friction: 7,
        tension: 60,
        useNativeDriver: true,
      }),
    ]).start();

    Animated.parallel([
      Animated.timing(greenX, {
        toValue: +PASS,
        duration: DURATION,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(yellowX, {
        toValue: -PASS,
        duration: DURATION,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(neonPulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(neonPulse, { toValue: 0.85, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    ).start();

    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(contentOpacity, {
          toValue: 0,
          duration: 500,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(veilOpacity, {
          toValue: 1,
          duration: 500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) setShowPermission(true);
      });
    }, DURATION + 400);

    return () => clearTimeout(t);
  }, [fontsLoaded, sessionChecked]);

  if (!fontsLoaded) return <View style={styles.root} />;

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={["#000000", "#07090B", "#000000"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.container}
      >
        <Animated.View style={[styles.center, { opacity: inOpacity, transform: [{ scale: inScale }] }]}>
          <Animated.View style={{ opacity: contentOpacity, alignItems: "center" }}>
            <View style={[styles.track, { width: TRACK_WIDTH }]}>
              <NeonWord text="Spark" color={GREEN} glow={GREEN_GLOW} translateX={greenX} pulse={neonPulse} top={2} />
              <NeonWord text="Spark" color={GOLD} glow={GOLD_GLOW} translateX={yellowX} pulse={neonPulse} />
              <NeonBolt pulse={neonPulse} />
            </View>
          </Animated.View>
        </Animated.View>

        <Animated.View pointerEvents="none" style={[styles.veil, { opacity: veilOpacity }]} />

        {showPermission && (
          <LocationPermission
            onPermissionGranted={() => {
              router.replace("/auth/LoginPage");
            }}
          />
        )}
      </LinearGradient>
    </View>
  );
}

/** ---------- Neon helpers with types ---------- */

// TS: use RNAnimated.Value as the type for Animated values.
// JS: delete the type annotations and the import 'type { Animated as RNAnimated }'.

type NeonWordProps = {
  text: string;
  color: string;
  glow: string;
  translateX: RNAnimated.Value;
  pulse: RNAnimated.Value;
  top?: number;
};

const NeonWord: FC<NeonWordProps> = ({ text, color, glow, translateX, pulse, top = 0 }) => {
  return (
    <Animated.View style={[styles.neonWrap, { transform: [{ translateX }] }, { top }]}>
      {/* Aura (bigger, softer) */}
      <Animated.Text
        style={[
          styles.neonAura,
          {
            color,
            textShadowColor: glow,
            opacity: pulse as any, // satisfy RN style type
          },
        ]}
      >
        {text}
      </Animated.Text>

      {/* Crisp main */}
      <Animated.Text
        style={[
          styles.neonMain,
          {
            color,
            textShadowColor: glow,
            opacity: (pulse as any).interpolate({
              inputRange: [0.85, 1],
              outputRange: [0.95, 1],
            }),
          },
        ]}
      >
        {text}
      </Animated.Text>
    </Animated.View>
  );
};

type NeonBoltProps = { pulse: RNAnimated.Value };

const NeonBolt: FC<NeonBoltProps> = ({ pulse }) => {
  return (
    <Animated.Text
      style={[
        styles.bolt,
        {
          textShadowColor: GOLD_GLOW,
          opacity: pulse as any,
        },
      ]}
    >
      ⚡
    </Animated.Text>
  );
};

/** ---------- Styles ---------- */

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  track: {
    height: 80,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },

  neonWrap: {
    position: "absolute",
    ...Platform.select({ android: { elevation: 0 } }),
  },

  neonAura: {
    position: "absolute",
    fontSize: 56,
    fontFamily: "MuseoModerno_700Bold",
    letterSpacing: 1.2,
    textShadowRadius: 26,
    textShadowOffset: { width: 0, height: 0 },
  },

  neonMain: {
    position: "absolute",
    fontSize: 54,
    fontFamily: "MuseoModerno_700Bold",
    letterSpacing: 1.2,
    textShadowRadius: 14,
    textShadowOffset: { width: 0, height: 0 },
  },

  bolt: {
    position: "absolute",
    fontSize: 30,
    color: GOLD,
    textShadowRadius: 16,
    textShadowOffset: { width: 0, height: 0 },
  },

  veil: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
  },
});
