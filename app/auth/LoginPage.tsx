// app/auth/LoginPage.tsx
import React, { useState, useRef, useEffect } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Alert,
  ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useFonts } from "expo-font";
import { Poppins_700Bold } from "@expo-google-fonts/poppins";
import { Roboto_400Regular } from "@expo-google-fonts/roboto";
import { useRouter } from "expo-router";
import { supabase } from "../services/supabaseClient";

const GOLD = "#FFDE59";
const GREEN = "#7ED957";
const AMBER = "#FFB84D";

export default function LoginPage() {
  const router = useRouter();

  // form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rePassword, setRePassword] = useState("");
  const [isLogin, setIsLogin] = useState(true);

  const [passwordError, setPasswordError] = useState("");
  const [rePasswordError, setRePasswordError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [focusedInput, setFocusedInput] = useState<string | null>(null);

  // animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-50)).current;
  const scaleAnim = useRef(new Animated.Value(0.98)).current;
  const glowAnim = useRef(new Animated.Value(0.9)).current;
  const heartbeat = useRef(new Animated.Value(1)).current;
  const errorFade = useRef(new Animated.Value(0)).current;

  const [fontsLoaded] = useFonts({ Poppins_700Bold, Roboto_400Regular });

  // Heartbeat animation
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(heartbeat, { toValue: 1.25, duration: 400, useNativeDriver: true }),
        Animated.timing(heartbeat, { toValue: 1, duration: 400, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [heartbeat]);

  // Glow animation (shadowOpacity can't use native driver)
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 2000, useNativeDriver: false }),
        Animated.timing(glowAnim, { toValue: 0.9, duration: 2000, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [glowAnim]);

  // Animate entry
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 700, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim, scaleAnim]);

  // Error fade
  useEffect(() => {
    const hasError = !!(emailError || passwordError || rePasswordError);
    Animated.timing(errorFade, {
      toValue: hasError ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [emailError, passwordError, rePasswordError, errorFade]);

  // Validation
  const ZW_SPACES = /[\s\u200B\u200C\u200D\uFEFF]/g; // invisible chars
  function normalizeEmail(value: string) {
    return value.normalize("NFKC").replace(ZW_SPACES, "").trim().toLowerCase();
  }
  const EMAIL_REGEX =
    /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/;

  const validateEmail = (v: string) => {
    const cleaned = normalizeEmail(v);
    setEmail(cleaned);
    setEmailError(EMAIL_REGEX.test(cleaned) ? "" : "Please enter a valid email address.");
  };

  const validatePassword = (v: string) => {
    const regex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    setPasswordError(
      regex.test(v) ? "" : "Password must be 8+ chars, include upper, lower, number & special char."
    );
    setPassword(v);
  };
  const validateRePassword = (v: string) => {
    setRePassword(v);
    setRePasswordError(v === password ? "" : "Passwords do not match.");
  };

  const toggleMode = () => {
    setIsLogin((s) => !s);
    setName("");
    setEmail("");
    setPassword("");
    setRePassword("");
    setPasswordError("");
    setRePasswordError("");
    setEmailError("");
  };

  const handleSubmit = async () => {
    if (!email || !password || (!isLogin && (!name.trim() || !rePassword))) {
      Alert.alert("Incomplete", "Please fill all required fields.");
      return;
    }
    if (emailError || passwordError || rePasswordError) {
      Alert.alert("Fix errors", "Please fix the errors before proceeding.");
      return;
    }

    const sanitizedEmail = normalizeEmail(email);
    const sanitizedName = name.trim();

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({
        email: sanitizedEmail,
        password,
      });
      if (error) {
        Alert.alert("Login failed", error.message);
      } else {
        // ✅ AFTER LOGIN → GO TO TABS/MAP
        router.replace("/(tabs)/map");
      }
    } else {
      const { data, error } = await supabase.auth.signUp({
        email: sanitizedEmail,
        password,
      });
      if (error) {
        Alert.alert("Sign-up failed", error.message);
        return;
      }
      const userId = data.user?.id;
      const { error: insertError } = await supabase
        .from("users")
        .insert([{ user_id: userId, full_name: sanitizedName, email: sanitizedEmail }]);
      if (insertError) {
        Alert.alert("Error saving profile", insertError.message);
      } else {
        Alert.alert("Account Created", "Your account has been created. Please log in.", [
          { text: "OK", onPress: () => setIsLogin(true) },
        ]);
      }
    }
  };

  // Loading gate — fonts only (location permission was handled earlier)
  if (!fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <Animated.Text style={[styles.loadingBolt, { transform: [{ scale: heartbeat }] }]}>
          ⚡
        </Animated.Text>
      </View>
    );
  }

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
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            bounces={false}
          >
            <Animated.View
              style={[
                styles.glowWrap,
                {
                  transform: [
                    { scale: glowAnim.interpolate({ inputRange: [0.9, 1], outputRange: [1, 1.015] }) },
                  ],
                  shadowOpacity: glowAnim as unknown as number,
                },
              ]}
            >
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
                  <View style={{ alignItems: "center", marginBottom: 26 }}>
                    <Text style={styles.welcomeText}>Welcome to</Text>
                    <Text style={styles.sparkTitle}>Spark</Text>
                  </View>

                  {!isLogin && (
                    <TextInput
                      style={[styles.input, focusedInput === "name" && styles.inputFocused]}
                      onFocus={() => setFocusedInput("name")}
                      onBlur={() => setFocusedInput(null)}
                      placeholder="Full Name"
                      placeholderTextColor="#888"
                      autoCapitalize="words"
                      value={name}
                      onChangeText={setName}
                    />
                  )}

                  <TextInput
                    style={[styles.input, focusedInput === "email" && styles.inputFocused]}
                    onFocus={() => setFocusedInput("email")}
                    onBlur={() => setFocusedInput(null)}
                    placeholder="Email"
                    placeholderTextColor="#888"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={email}
                    onChangeText={validateEmail}
                  />
                  {!!emailError && (
                    <Animated.Text style={[styles.errorText, { opacity: errorFade }]}>{emailError}</Animated.Text>
                  )}

                  <TextInput
                    style={[styles.input, focusedInput === "password" && styles.inputFocused]}
                    onFocus={() => setFocusedInput("password")}
                    onBlur={() => setFocusedInput(null)}
                    placeholder="Password"
                    placeholderTextColor="#888"
                    secureTextEntry
                    value={password}
                    onChangeText={validatePassword}
                  />
                  {!!passwordError && (
                    <Animated.Text style={[styles.errorText, { opacity: errorFade }]}>{passwordError}</Animated.Text>
                  )}

                  {!isLogin && (
                    <>
                      <TextInput
                        style={[styles.input, focusedInput === "repassword" && styles.inputFocused]}
                        onFocus={() => setFocusedInput("repassword")}
                        onBlur={() => setFocusedInput(null)}
                        placeholder="Re-enter Password"
                        placeholderTextColor="#888"
                        secureTextEntry
                        value={rePassword}
                        onChangeText={validateRePassword}
                      />
                      {!!rePasswordError && (
                        <Animated.Text style={[styles.errorText, { opacity: errorFade }]}>{rePasswordError}</Animated.Text>
                      )}
                    </>
                  )}

                  <TouchableOpacity onPress={handleSubmit} activeOpacity={0.9} style={{ width: "100%" }}>
                    <LinearGradient
                      colors={[GOLD, GREEN]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.mainButton}
                    >
                      <Text style={styles.mainButtonText}>{isLogin ? "Log in" : "Sign Up"}</Text>
                    </LinearGradient>
                  </TouchableOpacity>

                  {/* Single-line adaptive footer */}
                  <TouchableOpacity onPress={toggleMode} style={styles.outlineButton}>
                    <Text
                      style={styles.outlineButtonText}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.85}
                    >
                      {isLogin ? "Create new account" : "Already have an account? "}
                      {!isLogin && <Text style={styles.linkText}>Log in</Text>}
                    </Text>
                  </TouchableOpacity>

                  {isLogin && (
                    <TouchableOpacity
                      onPress={() => router.push("/auth/ForgotPassword")}
                    >
                      <Text style={styles.forgotText}>Forgot Password?</Text>
                    </TouchableOpacity>
                  )}
                </Animated.View>
              </LinearGradient>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: "#000" },
  overlay: { ...StyleSheet.absoluteFillObject },
  container: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },

  glowWrap: {
    width: "92%",
    alignSelf: "center",
    borderRadius: 50,
    shadowColor: GREEN,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 0 },
  },
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
  welcomeText: {
    fontSize: 20,
    color: GOLD,
    fontFamily: "Poppins_700Bold",
    textShadowColor: "rgba(255, 222, 89, 0.45)",
    textShadowRadius: 10,
    marginBottom: -4,
  },
  sparkTitle: {
    fontSize: 38,
    color: GREEN,
    fontFamily: "Poppins_700Bold",
    textShadowColor: "rgba(126, 217, 87, 0.45)",
    textShadowRadius: 14,
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
  inputFocused: {
    borderColor: GREEN,
    shadowColor: GREEN,
    shadowOpacity: 0.6,
    shadowRadius: 10,
  },
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
  forgotText: { color: GOLD, marginTop: 10, fontSize: 15, textDecorationLine: "underline" },
  errorText: { color: AMBER, fontSize: 13, marginBottom: 8 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#000" },
  loadingText: { marginTop: 15, color: GOLD, fontSize: 16 },
  loadingBolt: { fontSize: 60, color: GOLD, textShadowColor: "rgba(255, 222, 89, 0.6)", textShadowRadius: 25 },
});
