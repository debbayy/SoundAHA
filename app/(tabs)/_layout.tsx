import { Tabs } from 'expo-router';
import { GlassTabBar } from '../../src/components/GlassTabBar';

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <GlassTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: 'transparent' },
        // Tabs out of view stop re-rendering (e.g. every list row when the song changes); a big
        // saving on slow phones.
        freezeOnBlur: true,
        // No tab animation: with 'fade', a tab opened for the first time could stay at opacity 0 (blank)
        // when the switch was interrupted or the JS thread was busy rendering its list.
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="search" options={{ title: 'Search' }} />
      <Tabs.Screen name="favorites" options={{ title: 'Saved' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
