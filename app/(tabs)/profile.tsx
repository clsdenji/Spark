import { View, Text, TouchableOpacity, Alert, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { supabase } from "../services/supabaseClient";

const GOLD = "#FFDE59";
const GREEN = "#7ED957";

export default function ProfileScreen() {
  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      Alert.alert("Sign out failed", error.message);
    }
    // No manual navigation needed; Index gate listener will route to Login
  };

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Profile</Text>

      <TouchableOpacity onPress={handleSignOut} activeOpacity={0.9} style={{ width: "90%" }}>
        <LinearGradient
          colors={[GOLD, GREEN]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.signoutBtn}
        >
          <Text style={styles.signoutText}>Sign Out</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center" },
  title: { color: "#fff", fontSize: 22, marginBottom: 24 },
  signoutBtn: { paddingVertical: 14, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  signoutText: { color: "#0b0b0b", fontWeight: "700", fontSize: 18 },
});
