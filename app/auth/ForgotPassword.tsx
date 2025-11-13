// app/auth/ForgotPasswordScreen.tsx
import React, { useState, useRef, useEffect } from "react";
import {
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Animated,
  SafeAreaView,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Linking from "expo-linking";
import { useFonts } from "expo-font";
import { Poppins_700Bold } from "@expo-google-fonts/poppins";
import { Roboto_400Regular } from "@expo-google-fonts/roboto";
import { supabase } from "../services/supabaseClient";

const GOLD = "#FFDE59";
const GREEN = "#7ED957";
const AMBER = "#FFB84D";

// Email helpers (kept from your version)
const ZW_SPACES = /[\s\u200B\u200C\u200D\uFEFF]/g;
const normalizeEmail = (v: string) =>
  v.normalize("NFKC").replace(ZW_SPACES, "").trim().toLowerCase();

const EMAIL_REGEX =
  /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/;

export default function ForgotPasswordScreen() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [emailErr, setEmailErr] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  // Animations (match Spark card + glow)
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-50)).current;
  const scaleAnim = useRef(new Animated.Value(0.98)).current;
  const glowOpacity = useRef(new Animated.Value(0.9)).current;

  const [fontsLoaded] = useFonts({ Poppins_700Bold, Roboto_400Regular });

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 700, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
    ]).start();

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowOpacity, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(glowOpacity, { toValue: 0.9, duration: 2000, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const onChangeEmail = (v: string) => {
    const cleaned = normalizeEmail(v);
    setEmail(cleaned);
    setEmailErr(EMAIL_REGEX.test(cleaned) ? "" : "Please enter a valid email address.");
  };

  const handleSendLink = async () => {
    if (!email || emailErr) {
      setEmailErr("Please enter a valid email address.");
      return;
    }
    setSending(true);
    try {
      await supabase.auth.resetPasswordForEmail(email, {
        // Deep link directly into the NewPassword screen
        redirectTo: Linking.createURL("/auth/NewPassword"),
      });

      // Censor email locally for UI
      const [user, domain] = email.split("@");
      const masked =
        user && domain ? `${user.slice(0, 2)}****${user.slice(-2)}@${domain}` : email;

      setSentTo(masked);
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to send reset link.");
    } finally {
      setSending(false);
    }
  };

  if (!fontsLoaded) return null;

  return (
    <SafeAreaView style={styles.background}>
      <LinearGradient
        colors={["#000000", "#0d0d0d", "#1a1a1a"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.overlay}
      >
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Animated.View
            style={[
              styles.glowWrap, // same “bubble” container as Login
              {
                transform: [
                  { scale: glowOpacity.interpolate({ inputRange: [0.9, 1], outputRange: [1, 1.015] }) },
                ],
              },
            ]}
          >
            {/* Simulated glow layer */}
            <Animated.View style={[styles.glowLayer, { opacity: glowOpacity }]} pointerEvents="none">
              <LinearGradient
                colors={[GREEN + "33", GOLD + "22", "transparent"]}
                start={{ x: 0.3, y: 0 }}
                end={{ x: 0.7, y: 1 }}
                style={styles.glowGradient}
              />
            </Animated.View>
            <LinearGradient
              colors={[GOLD, GREEN]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.cardWrapper}
            >
              <Animated.View
                style={[
                  styles.card,
                  { opacity: fadeAnim, transform: [{ translateY: slideAnim }, { scale: scaleAnim }] },
                ]}
              >
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                  <Ionicons name="arrow-back" size={26} color={GOLD} />
                </TouchableOpacity>

                <Text style={styles.title}>Forgot Password</Text>

                {!sentTo ? (
                  <>
                    <Text style={styles.subtitle}>
                      Enter your email and we’ll send a reset link.
                    </Text>

                    <TextInput
                      style={styles.input}
                      placeholder="Email"
                      placeholderTextColor="#888"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      value={email}
                      onChangeText={onChangeEmail}
                    />

                    {!!emailErr && <Text style={styles.errorText}>{emailErr}</Text>}

                    {/* Main filled button (same as Login) */}
                    <TouchableOpacity onPress={handleSendLink} activeOpacity={0.9} disabled={sending} style={{ width: "100%" }}>
                      <LinearGradient
                        colors={[GOLD, GREEN]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[styles.mainButton, sending && { opacity: 0.7 }]}
                      >
                        <Text style={styles.mainButtonText}>
                          {sending ? "Sending..." : "Send Reset Link"}
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>

                    {/* Outline button (same as Login) */}
                    <TouchableOpacity
                      style={styles.outlineButton}
                      onPress={() => router.push("/auth/LoginPage")}
                    >
                      <Text
                        style={styles.outlineButtonText}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.85}
                      >
                        Back to <Text style={styles.linkText}>Login</Text>
                      </Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <Text style={styles.subtitle}>
                      A password reset link has been sent to{"\n"}
                      <Text style={{ color: GOLD }}>{sentTo}</Text>
                      {"\n"}Please check your inbox (and spam folder).
                    </Text>

                    {/* Main filled button (same as Login) */}
                    <TouchableOpacity onPress={() => router.push("/auth/LoginPage")} activeOpacity={0.9} style={{ width: "100%" }}>
                      <LinearGradient
                        colors={[GOLD, GREEN]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.mainButton}
                      >
                        <Text style={styles.mainButtonText}>Back to Login</Text>
                      </LinearGradient>
                    </TouchableOpacity>

                    {/* Outline again, in case they want to resend */}
                    <TouchableOpacity
                      style={styles.outlineButton}
                      onPress={() => setSentTo(null)}
                    >
                      <Text
                        style={styles.outlineButtonText}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.85}
                      >
                        Didn’t get it? <Text style={styles.linkText}>Try another email</Text>
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
              </Animated.View>
            </LinearGradient>
          </Animated.View>
        </KeyboardAvoidingView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: "#000" },
  overlay: { ...StyleSheet.absoluteFillObject },
  container: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 20 },

  // === Bubble layout EXACTLY like your LoginPage ===
  glowWrap: {
    width: "92%",
    alignSelf: "center",
    borderRadius: 50,
    shadowColor: GREEN,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 0 },
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
  glowGradient: { flex: 1, borderRadius: 60 },
  cardWrapper: {
    width: "100%",
    borderRadius: 50,
    padding: 2,
  },
  card: {
    width: "100%",
    borderRadius: 50,
    overflow: "hidden",
    backgroundColor: "rgba(15,15,15,0.95)",
    paddingVertical: 45,
    paddingHorizontal: 28,
    alignItems: "center",
  },
  // ================================================

  backButton: { position: "absolute", top: 20, left: 20 },

  title: {
    fontSize: 26,
    color: GOLD,
    fontFamily: "Poppins_700Bold",
    textAlign: "center",
    marginBottom: 10,
    textShadowColor: "rgba(255, 222, 89, 0.45)",
    textShadowRadius: 10,
  },
  subtitle: {
    color: "#ccc",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 25,
    fontFamily: "Roboto_400Regular",
  },

  input: {
    width: "100%",
    height: 55,
    borderRadius: 14,
    paddingHorizontal: 20,
    marginBottom: 12,
    backgroundColor: "#101010",
    borderColor: "#303030",
    borderWidth: 1,
    fontSize: 16,
    color: "#fff",
    fontFamily: "Roboto_400Regular",
  },

  errorText: {
    color: AMBER,
    fontSize: 13,
    marginBottom: 4,
    textAlign: "center",
  },

  // === Buttons copied from your LoginPage ===
  mainButton: {
    width: "100%",
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 12,
  },
  mainButtonText: {
    color: "#0b0b0b",
    fontWeight: "700",
    fontSize: 20,
    fontFamily: "Poppins_700Bold",
  },
  outlineButton: {
    width: "100%",
    minHeight: 56,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: GREEN,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  outlineButtonText: {
    color: GREEN,
    fontWeight: "700",
    fontSize: 16,
    textAlign: "center",
  },
  linkText: { color: GREEN, textDecorationLine: "underline" },
});
