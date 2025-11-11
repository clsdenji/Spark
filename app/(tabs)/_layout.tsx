// app/(tabs)/_layout.tsx
import { Tabs } from "expo-router";
import CustomNavBar from "./CustomNavBar";

export default function TabsLayout() {
  return (
    <Tabs
      initialRouteName="map"
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: "none" }, // hide default bar
      }}
      tabBar={(props) => <CustomNavBar {...props} />}
    >
      <Tabs.Screen name="map" options={{ headerShown: false, title: "Map" }} />
      <Tabs.Screen name="saved" options={{ headerShown: false, title: "Saved" }} />
      <Tabs.Screen name="history" options={{ headerShown: false, title: "History" }} />
      <Tabs.Screen name="profile" options={{ headerShown: false, title: "Profile" }} />
    </Tabs>
  );
}
