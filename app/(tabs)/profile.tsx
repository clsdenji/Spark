// app/(tabs)/profile.tsx
import React, { useEffect, useState } from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { supabase } from "../services/supabaseClient";
import { useRouter } from "expo-router";


const GOLD = "#FFDE59";
const GREEN = "#7ED957";

const AVATARS = [
  { key: "avatar1", url: "https://fakqwgyvbqhonwfufhxg.supabase.co/storage/v1/object/sign/avatars/avatar1.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9hYWZlNGUwNi0zNTA1LTQ2YmUtYTgzZi1jMzAzY2Q4MzE2YjMiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJhdmF0YXJzL2F2YXRhcjEucG5nIiwiaWF0IjoxNzYyODgzODQ5LCJleHAiOjE3OTQ0MTk4NDl9.ibrb-VmSpLWCl3jrS-nrcRbSleVS3tiSPtdOJCfWkCg" },
  { key: "avatar2", url: "https://fakqwgyvbqhonwfufhxg.supabase.co/storage/v1/object/sign/avatars/avatar2.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9hYWZlNGUwNi0zNTA1LTQ2YmUtYTgzZi1jMzAzY2Q4MzE2YjMiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJhdmF0YXJzL2F2YXRhcjIucG5nIiwiaWF0IjoxNzYyODgzOTM3LCJleHAiOjE3OTQ0MTk5Mzd9.KRhdNjsVDZQYNBZfghT4iRD2_nHgddIzPwnPl7Geuc0" },
  { key: "avatar3", url: "https://fakqwgyvbqhonwfufhxg.supabase.co/storage/v1/object/sign/avatars/avatar3.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9hYWZlNGUwNi0zNTA1LTQ2YmUtYTgzZi1jMzAzY2Q4MzE2YjMiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJhdmF0YXJzL2F2YXRhcjMucG5nIiwiaWF0IjoxNzYyODgzOTU5LCJleHAiOjE3OTQ0MTk5NTl9.Nr3naZS4nRkp7Vno-nXv4rLalPw3LLZMXYQkV_U5Gnk" },
];

export default function ProfileScreen() {
  const [user, setUser] = useState<any>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Load user + profile
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data?.user) {
        router.replace("/auth/LoginPage");
        return;
      }
      setUser(data.user);

      const { data: profile, error } = await supabase
        .from("users")
        .select("avatar_url, full_name")
        .eq("user_id", data.user.id)
        .single();

      if (!error && profile) {
        if (profile.avatar_url) setAvatarUrl(profile.avatar_url);
        if (profile.full_name) setFullName(profile.full_name);
      }
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    if (!selectedAvatar || !user) return;
    try {
      setSaving(true);
      const { error } = await supabase
        .from("users")
        .update({ avatar_url: selectedAvatar })
        .eq("user_id", user.id);
      if (error) throw error;

      setAvatarUrl(selectedAvatar);
      setChoosing(false);
      setSelectedAvatar(null);
      Alert.alert("Saved", "Your avatar has been updated!");
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to update avatar.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/auth/LoginPage");
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: "center" }]}>
        <ActivityIndicator size="large" color={GREEN} />
      </View>
    );
  }

  return (
    <LinearGradient colors={["#000000", "#0a0a0a", "#000000"]} style={styles.container}>
      <View style={styles.centerContent}>
        {/* Avatar bubble */}
        <TouchableOpacity onPress={() => setChoosing(true)} activeOpacity={0.8}>
          <View style={styles.avatarWrap}>
            <Image
              source={avatarUrl ? { uri: avatarUrl } : require("@/assets/images/icon.png")}
              style={styles.avatar}
            />
            <LinearGradient colors={[GOLD, GREEN]} style={styles.glow} />
          </View>
        </TouchableOpacity>

        {/* Avatar chooser (shows only when choosing) */}
        {choosing && (
          <View style={styles.avatarPicker}>
            <TouchableOpacity
              onPress={handleSave}
              disabled={!selectedAvatar || saving}
              style={[styles.primaryBtnWrap, (!selectedAvatar || saving) && { opacity: 0.6 }]}
            >
              <LinearGradient colors={[GOLD, GREEN]} style={styles.primaryBtn}>
                <Text style={styles.primaryText}>{saving ? "Saving..." : "Save"}</Text>
              </LinearGradient>
            </TouchableOpacity>

            <Text style={styles.chooseText}>
              {selectedAvatar ? "Tap Save to confirm" : "Choose your avatar"}
            </Text>

            <View style={styles.grid}>
              {AVATARS.map((a) => (
                <TouchableOpacity
                  key={a.key}
                  onPress={() => setSelectedAvatar(a.url)}
                  style={[styles.choice, selectedAvatar === a.url && styles.choiceSelected]}
                  activeOpacity={0.85}
                >
                  <Image source={{ uri: a.url }} style={styles.choiceImg} />
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              onPress={() => {
                setChoosing(false);
                setSelectedAvatar(null);
              }}
              style={styles.cancelBtn}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Hide these while choosing */}
        {!choosing && (
          <>
            <Text style={styles.name}>{fullName || "Spark User"}</Text>
            <Text style={styles.email}>{user?.email}</Text>

            {/* 🔻 Pill logout UI (your bubble-as-pill) */}
            <View style={styles.logoutBubble}>
              <LinearGradient colors={[GOLD, GREEN]} style={styles.logoutBubbleInner}>
                <TouchableOpacity onPress={handleLogout} activeOpacity={0.9} style={{ width: "100%", height: "100%", alignItems: "center", justifyContent: "center" }}>
                  <Text style={styles.logoutText}>Log Out</Text>
                </TouchableOpacity>
              </LinearGradient>
            </View>
          </>
        )}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center" },
  centerContent: { alignItems: "center", width: "100%" },

  avatarWrap: { alignItems: "center", justifyContent: "center", marginBottom: 20 },
  avatar: { width: 130, height: 130, borderRadius: 65, borderWidth: 2, borderColor: GOLD },
  glow: { position: "absolute", width: 140, height: 140, borderRadius: 70, opacity: 0.3 },

  avatarPicker: { alignItems: "center", marginBottom: 20, width: "100%" },
  primaryBtnWrap: { width: "70%", marginBottom: 12 },
  primaryBtn: { borderRadius: 30, paddingVertical: 12, alignItems: "center" },
  primaryText: { color: "#000", fontSize: 16, fontWeight: "700" },

  chooseText: { color: GOLD, fontSize: 16, fontWeight: "700", marginBottom: 10, textAlign: "center" },
  grid: { flexDirection: "row", gap: 12, justifyContent: "center", width: "100%" },
  choice: {
    width: 70,
    height: 70,
    borderRadius: 14,
    borderColor: "#333",
    borderWidth: 1,
    backgroundColor: "#0f0f0f",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  choiceSelected: {
    borderColor: GREEN,
    shadowColor: GREEN,
    shadowOpacity: 0.6,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  choiceImg: { width: "100%", height: "100%" },
  cancelBtn: { marginTop: 10, paddingVertical: 6, paddingHorizontal: 12 },
  cancelText: { color: "#aaa", textDecorationLine: "underline" },

  name: { fontSize: 22, color: GOLD, fontWeight: "700", marginTop: 10 },
  email: { fontSize: 14, color: "#aaa", marginBottom: 30 },

  // ✅ Your “bubble” turned into a pill
  logoutBubble: {
    width: "80%",
    maxWidth: 320,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    overflow: "hidden",
  },
  logoutBubbleInner: {
    width: "100%",
    height: "100%",
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#7ED957",
    shadowOpacity: 0.6,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  logoutText: { color: "#000", fontSize: 16, fontWeight: "700" },
});
