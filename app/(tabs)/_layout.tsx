// app/(tabs)/_layout.tsx
import React, { useEffect, useRef } from "react";
import { Tabs } from "expo-router";
import { View, StyleSheet, Animated, Easing } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

const GREEN = "#7ED957";
const GOLD = "#FFDE59";
const INACTIVE = "#808080";

export default function TabsLayout() {
  return (
    <Tabs
      initialRouteName="map"
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          position: "absolute",
          bottom: 20,
          left: 20,
          right: 20,
          height: 70,
          borderRadius: 36,
          backgroundColor: "#0b0b0b",
          borderTopWidth: 0,
          elevation: 12,
          shadowColor: "#000",
          shadowOpacity: 0.4,
          shadowRadius: 12,
        },
      }}
    >
      <Tabs.Screen
        name="map"
        options={{
          title: "Map",
          tabBarIcon: ({ focused }) => (
            <NeonTabIcon
              focused={focused}
              inactive={<Ionicons name="navigate-outline" size={26} color={INACTIVE} />}
              activeIcon={<Ionicons name="navigate" size={26} color="#0b0b0b" />}
              bubbleGradient={[GREEN, GOLD]}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: "Saved",
          tabBarIcon: ({ focused }) => (
            <NeonTabIcon
              focused={focused}
              inactive={<Ionicons name="bookmark-outline" size={26} color={INACTIVE} />}
              activeIcon={<Ionicons name="bookmark" size={26} color="#0b0b0b" />}
              bubbleGradient={[GOLD, GREEN]}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "History",
          tabBarIcon: ({ focused }) => (
            <NeonTabIcon
              focused={focused}
              inactive={<Ionicons name="time-outline" size={26} color={INACTIVE} />}
              activeIcon={<Ionicons name="time" size={26} color="#0b0b0b" />}
              bubbleGradient={[GREEN, GOLD]}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ focused }) => (
            <NeonTabIcon
              focused={focused}
              inactive={<Ionicons name="person-circle-outline" size={26} color={INACTIVE} />}
              activeIcon={<Ionicons name="person-circle" size={26} color="#0b0b0b" />}
              bubbleGradient={[GOLD, GREEN]}
            />
          ),
        }}
      />
    </Tabs>
  );
}

/* Animated bubble icon */
function NeonTabIcon({ focused, inactive, activeIcon, bubbleGradient }) {
  const scale = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const loopRef = useRef(null);

  useEffect(() => {
    if (focused) {
      Animated.spring(scale, {
        toValue: 1.18,
        friction: 5,
      }).start();

      loopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(glow, {
            toValue: 1,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
          }),
          Animated.timing(glow, {
            toValue: 0.35,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
          }),
        ])
      );
      loopRef.current.start();
    } else {
      loopRef.current?.stop?.();
      glow.stopAnimation();
      glow.setValue(0);
      Animated.spring(scale, { toValue: 1 }).start();
    }
  }, [focused]);

  if (!focused) return <View style={styles.plainIcon}>{inactive}</View>;

  const shadowOpacity = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [0.25, 0.55],
  });

  return (
    <Animated.View
      style={[
        styles.bubbleWrap,
        { transform: [{ scale }], shadowOpacity: shadowOpacity },
      ]}
    >
      <LinearGradient
        colors={bubbleGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.bubble}
      >
        {activeIcon}
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  plainIcon: {
    justifyContent: "center",
    alignItems: "center",
    width: 46,
    height: 46,
  },
  bubbleWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: GOLD,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  bubble: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
  },
});
