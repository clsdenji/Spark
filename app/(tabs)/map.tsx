// app/(tabs)/map.tsx
import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function MapScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Map</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  text: {
    fontSize: 40,
    color: "#7ED957", // same green accent
    fontWeight: "bold",
  },
});
