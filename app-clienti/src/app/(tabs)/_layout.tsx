/**
 * Le cinque schede dell'app.
 *
 * Cinque è il massimo che resta leggibile in fondo a uno schermo di telefono.
 * L'ordine segue quello che si fa più spesso: si apre per vedere cosa c'è
 * (Home), si prenota, si guardano le occasioni, i premi, e in fondo il resto.
 */
import { Tabs } from 'expo-router';

import { IconaScheda } from '@/components/ui/Icona';
import { colors, fonts, typography } from '@/theme';

/** Le schede in ordine: il primo è quello che si apre all'avvio. */
const SCHEDE = [
  { name: 'index', title: 'Home', icona: 'home' },
  { name: 'chat', title: 'Chat', icona: 'chat' },
  { name: 'prenota', title: 'Prenota', icona: 'prenota' },
  { name: 'per-te', title: 'Per te', icona: 'perTe' },
  { name: 'premi', title: 'Premi', icona: 'premi' },
  { name: 'profilo', title: 'Profilo', icona: 'profilo' },
] as const;

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primaryDark,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          // Stesso fondo delle schermate: una barra bianca su avorio disegna
          // una riga netta in fondo allo schermo che non serve a niente.
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          height: 88,
          paddingTop: 8,
        },
        tabBarLabelStyle: { ...typography.caption, fontFamily: fonts.w600, fontSize: 10 },
      }}
    >
      {SCHEDE.map(s => (
        <Tabs.Screen
          key={s.name}
          name={s.name}
          options={{
            title: s.title,
            tabBarIcon: ({ focused }) => <IconaScheda nome={s.icona} attiva={focused} />,
          }}
        />
      ))}
    </Tabs>
  );
}
