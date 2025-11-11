import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function SavedScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Saved</Text>
      <Text style={styles.sub}>Your saved parking spots will appear here.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000", justifyContent: "center", alignItems: "center", padding: 20 },
  text: { color: "#7ED957", fontSize: 24, fontWeight: "700", marginBottom: 8 },
  sub: { color: "#ccc", textAlign: "center" },
});
