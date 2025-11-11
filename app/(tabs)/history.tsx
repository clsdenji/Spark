import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function HistoryScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>History</Text>
      <Text style={styles.sub}>Your recent visits and activity will show here.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000", justifyContent: "center", alignItems: "center", padding: 20 },
  text: { color: "#7ED957", fontSize: 24, fontWeight: "700", marginBottom: 8 },
  sub: { color: "#ccc", textAlign: "center" },
});
