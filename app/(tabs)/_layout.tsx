import { View } from 'react-native';
import { Tabs } from 'expo-router';
import { BottomTabBar } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../src/theme';
import { MiniPlayer } from '../../src/components/MiniPlayer';

const icon = (name: keyof typeof Ionicons.glyphMap) => ({ color, size }: { color: string; size: number }) =>
  <Ionicons name={name} size={size} color={color} />;

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      tabBar={(props) => (
        <View style={{ backgroundColor: theme.bg }}>
          <MiniPlayer />
          <BottomTabBar {...props} />
        </View>
      )}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.accent2,
        tabBarInactiveTintColor: theme.muted,
        tabBarStyle: { backgroundColor: theme.card, borderTopColor: theme.border, height: 64 + insets.bottom, paddingTop: 6, paddingBottom: insets.bottom },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', letterSpacing: 0.5 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('home') }} />
      <Tabs.Screen name="search" options={{ title: 'Search', tabBarIcon: icon('search') }} />
      <Tabs.Screen name="favorites" options={{ title: 'Saved', tabBarIcon: icon('heart') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon('person') }} />
    </Tabs>
  );
}
