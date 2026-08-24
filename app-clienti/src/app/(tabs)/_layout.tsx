/**
 * Le cinque schede dell'app.
 *
 * Cinque è il massimo che resta leggibile in fondo a uno schermo di telefono.
 * L'ordine segue quello che si fa più spesso: si apre per vedere cosa c'è
 * (Home), si prenota, si guardano le occasioni, i premi, e in fondo il resto.
 */
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { colors, fonts, typography } from '@/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 88,
          paddingTop: 6,
        },
        tabBarLabelStyle: { ...typography.caption, fontFamily: fonts.w600 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Home', tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="prenota"
        options={{ title: 'Prenota', tabBarIcon: ({ color, size }) => <Ionicons name="add-circle" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="per-te"
        options={{ title: 'Per te', tabBarIcon: ({ color, size }) => <Ionicons name="sparkles" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="premi"
        options={{ title: 'Premi', tabBarIcon: ({ color, size }) => <Ionicons name="gift" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="profilo"
        options={{ title: 'Profilo', tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} /> }}
      />
    </Tabs>
  );
}
