// app/services/parkingApi.ts
import { Platform } from "react-native";
// Fallback to app.json extra if env is not inlined
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - expo-constants may be auto-resolved in Expo projects
import Constants from "expo-constants";

// Prefer an environment override for real devices: set EXPO_PUBLIC_API_URL in app.json
const ENV_URL = process.env.EXPO_PUBLIC_API_URL || Constants?.expoConfig?.extra?.EXPO_PUBLIC_API_URL;
// Use deployed Render URL as the default for local/dev when no env override is present
const DEV_BASE_URL = ENV_URL || "https://spark-e73i.onrender.com";
const PROD_BASE_URL = DEV_BASE_URL;

const API_BASE_URL = __DEV__ ? DEV_BASE_URL : PROD_BASE_URL;

export type ParkingRecommendation = {
  index: number;
  name: string | null;
  details?: string | null;
  address?: string | null;
  link?: string | null;
  city?: string | null;
  lat: number;
  lng: number;
  distance_km: number;
  open_now: boolean;
  opening?: string | null;
  closing?: string | null;
  guards: number;
  cctvs: number;
  initial_rate: number;
  pwd_discount: number;
  street_parking: number;
  score: number;
};

type RecommendResponse = {
  user_location: {
    lat: number;
    lng: number;
    time_of_day: number;
  };
  recommendations: ParkingRecommendation[];
};

export async function getParkingRecommendations(
  userLat: number,
  userLng: number
): Promise<ParkingRecommendation[]> {
  const now = new Date();
  const timeOfDay = now.getHours(); // 0–23

  const res = await fetch(`${API_BASE_URL}/recommend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_lat: userLat,
      user_lng: userLng,
      time_of_day: timeOfDay,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.warn("❌ API error:", res.status, text);
    throw new Error(`API error ${res.status}`);
  }

  const data = (await res.json()) as RecommendResponse;
  return data.recommendations;
}
