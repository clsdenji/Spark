// app/(tabs)/components/SmoothScreen.tsx
import React, { PropsWithChildren } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  FadeInDown,
  FadeOutUp,
  Layout,
  ZoomIn,
  ZoomOut,
} from "react-native-reanimated";
import { useIsFocused } from "@react-navigation/native";

export default function SmoothScreen({ children }: PropsWithChildren) {
  const focused = useIsFocused();

  return (
    <Animated.View
      key={focused ? "focused" : "blurred"}
      // handles the fade/translate
      entering={FadeInDown.duration(240)}
      exiting={FadeOutUp.duration(180)}
      layout={Layout.springify().damping(14).stiffness(160)}
      style={styles.root}
    >
      {/* inner layer handles the zoom */}
      <Animated.View
        entering={ZoomIn.duration(200).springify().damping(16).stiffness(140)}
        exiting={ZoomOut.duration(180).springify().damping(18).stiffness(160)}
        style={styles.content}
      >
        {children}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  content: { flex: 1 },
});
