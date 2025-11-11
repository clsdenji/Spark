import React, { PropsWithChildren, useEffect } from "react";
import { Platform } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import Animated, {
  Easing,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";

type Props = PropsWithChildren<{
  duration?: number;      // default 220ms
  offset?: number;        // default 8px vertical slide
  easing?: (v: number) => number;
}>;

export default function SmoothScreen({
  children,
  duration = 220,
  offset = 8,
  easing = Easing.out(Easing.cubic),
}: Props) {
  const isFocused = useIsFocused();
  const progress = useSharedValue(0);

  useEffect(() => {
    // Animate to 1 when focused, to 0 when blurred
    progress.value = withTiming(isFocused ? 1 : 0, { duration, easing });
  }, [isFocused]);

  const animStyle = useAnimatedStyle(() => {
    return {
      opacity: progress.value,
      transform: [
        { translateY: withTiming((1 - progress.value) * offset, { duration }) },
      ],
    };
  });

  // On Android, keep view mounted but invisible to avoid flashing on tab change
  const pointerEvents =
    Platform.OS === "android" ? (isFocused ? "auto" : "none") : "auto";

  return (
    <Animated.View style={[{ flex: 1 }, animStyle]} pointerEvents={pointerEvents}>
      {children}
    </Animated.View>
  );
}
