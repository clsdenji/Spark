import React, { useEffect, useRef, useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";

const GOLD = "#FFDE59";
const GREEN = "#7ED957";

export default function Onboarding() {
  const router = useRouter();
  const { width } = Dimensions.get("window");
  const PAGES = 3;
  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<any>(null);
  const [pageIndex, setPageIndex] = useState(0);

  // Subtle float + glow
  const floatY = useRef(new Animated.Value(0)).current;
  // Use an opacity-based glow layer that supports native driver on both platforms
  const glowOpacity = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(floatY, { toValue: -6, duration: 1200, useNativeDriver: true }),
          Animated.timing(floatY, { toValue: 0, duration: 1200, useNativeDriver: true }),
          Animated.timing(floatY, { toValue: 6, duration: 1200, useNativeDriver: true }),
          Animated.timing(floatY, { toValue: 0, duration: 1200, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(glowOpacity, { toValue: 1, duration: 1500, useNativeDriver: true }),
          Animated.timing(glowOpacity, { toValue: 0.9, duration: 1500, useNativeDriver: true }),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [floatY, glowOpacity]);

  const finish = async () => {
    try {
      await AsyncStorage.setItem("onboarding_seen_v2", "1");
    } catch {}
    router.replace("/(tabs)/map");
  };

  const onScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    { useNativeDriver: false }
  );

  const handleMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / width);
    setPageIndex(Math.max(0, Math.min(PAGES - 1, idx)));
  };

  const goNext = () => {
    if (pageIndex >= PAGES - 1) return finish();
    const nextX = (pageIndex + 1) * width;
    // Animated.ScrollView has getNode in old Animated wrapper; fallback to cast any
    (scrollRef.current as any)?.scrollTo?.({ x: nextX, animated: true });
  };

  return (
    <SafeAreaView style={styles.background}>
      <LinearGradient
        colors={["#000000", "#0d0d0d", "#1a1a1a"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.overlay}
      >
        {/* Outer wrapper to apply float animation */}
        <Animated.View style={[styles.glowWrap, { transform: [{ translateY: floatY }] }]}> 
          {/* Simulated glow layer using a gradient circle with animated opacity (native-driver friendly) */}
          <Animated.View style={[styles.glowLayer, { opacity: glowOpacity }]} pointerEvents="none">
            <LinearGradient
              colors={[GREEN + "33", GOLD + "22", "transparent"]}
              start={{ x: 0.3, y: 0 }}
              end={{ x: 0.7, y: 1 }}
              style={styles.glowGradient}
            />
          </Animated.View>
          <LinearGradient colors={[GOLD, GREEN]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cardWrapper}>
            <View style={styles.card}>
              {/* Top-right Skip */}
              <TouchableOpacity onPress={finish} style={styles.topSkip} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Text style={styles.skipText}>Skip</Text>
              </TouchableOpacity>

              {/* Pager */}
              <Animated.ScrollView
                ref={scrollRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={onScroll}
                scrollEventThrottle={16}
                onMomentumScrollEnd={handleMomentumEnd}
                contentContainerStyle={{ alignItems: "center" }}
              >
                {/* Page 1 */}
                <View style={[styles.slide, { width }]}> 
                  <View style={styles.iconWrap}>
                    <Ionicons name="map-outline" size={72} color={GREEN} />
                  </View>
                  <Text style={styles.title}>Find Parking Near You</Text>
                  <Text style={styles.subtitle}>Search parking around your origin or destination with accurate suggestions.</Text>
                </View>

                {/* Page 2 */}
                <View style={[styles.slide, { width }]}> 
                  <View style={styles.iconWrap}>
                    <Ionicons name="navigate-outline" size={72} color={GOLD} />
                  </View>
                  <Text style={styles.title}>Live Routes & Distance</Text>
                  <Text style={styles.subtitle}>Preview your route on the map and see distance updates in real-time.</Text>
                </View>

                {/* Page 3 */}
                <View style={[styles.slide, { width }]}> 
                  <View style={styles.iconWrap}>
                    <Ionicons name="bookmark-outline" size={72} color={GREEN} />
                  </View>
                  <Text style={styles.title}>Save & Revisit</Text>
                  <Text style={styles.subtitle}>Bookmark favorite spots and review your recent parking history.</Text>
                </View>
              </Animated.ScrollView>

              {/* Dots */}
              <View style={styles.dotsRow}>
                {Array.from({ length: PAGES }).map((_, i) => {
                  const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
                  const dotWidth = scrollX.interpolate({ inputRange, outputRange: [6, 18, 6], extrapolate: 'clamp' });
                  const dotOpacity = scrollX.interpolate({ inputRange, outputRange: [0.5, 1, 0.5], extrapolate: 'clamp' });
                  return (
                    <Animated.View key={i} style={[styles.dot, { width: dotWidth, opacity: dotOpacity }]} />
                  );
                })}
              </View>

              {/* Bottom controls */}
              <View style={{ width: "100%" }}>
                <TouchableOpacity onPress={goNext} activeOpacity={0.9} style={{ width: "100%" }}>
                  <LinearGradient colors={[GOLD, GREEN]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.mainButton}>
                    <Text style={styles.mainButtonText}>{pageIndex === PAGES - 1 ? "Get Started" : "Next"}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: "#000" },
  overlay: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 20 },
  glowWrap: {
    width: "92%",
    alignSelf: "center",
    borderRadius: 50,
    // Remove shadow-based glow (Android doesn't support shadow props). We'll fake it with a gradient layer.
  },
  glowLayer: {
    position: "absolute",
    top: -20,
    left: -20,
    right: -20,
    bottom: -20,
    borderRadius: 60,
    overflow: "hidden",
  },
  glowGradient: {
    flex: 1,
    borderRadius: 60,
  },
  cardWrapper: { width: "100%", borderRadius: 50, padding: 2 },
  card: {
    width: "100%",
    borderRadius: 50,
    overflow: "hidden",
    backgroundColor: "rgba(15,15,15,0.95)",
    paddingVertical: 40,
    paddingHorizontal: 28,
    alignItems: "center",
  },
  slide: { alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  title: { fontSize: 26, color: GOLD, textAlign: "center", marginBottom: 8, fontWeight: "700" },
  subtitle: { color: "#ccc", fontSize: 14, textAlign: "center", marginBottom: 18 },
  iconWrap: {
    width: 110,
    height: 110,
    borderRadius: 55,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    backgroundColor: "#0d0d0d",
    borderWidth: 2,
    borderColor: GREEN,
  },
  dotsRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  dot: { height: 6, borderRadius: 3, backgroundColor: "#e5e5e5" },
  mainButton: { width: "100%", paddingVertical: 16, borderRadius: 30, alignItems: "center", justifyContent: "center", marginTop: 16 },
  mainButtonText: { color: "#0b0b0b", fontWeight: "700", fontSize: 18 },
  topSkip: { position: "absolute", top: 12, right: 12, paddingVertical: 8, paddingHorizontal: 12, zIndex: 5 },
  skipText: { color: "#aaa", textDecorationLine: "underline" },
});