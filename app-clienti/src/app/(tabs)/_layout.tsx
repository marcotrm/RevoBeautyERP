/**
 * Le cinque schede dell'app.
 *
 * Cinque è il massimo che resta leggibile in fondo a uno schermo di telefono.
 * L'ordine segue quello che si fa più spesso: si apre per vedere cosa c'è
 * (Home), si prenota, si guardano le occasioni, i premi, e in fondo il resto.
 */
import { Tabs } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { IconaScheda } from '@/components/ui/Icona';
import { PallinoChat } from '@/components/ui/PallinoChat';
import { useAuth } from '@/hooks/useAuth';
import { aggiornaNonLetti, ascoltaNonLetti } from '@/lib/chatBadge';
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
  const { token } = useAuth();
  const [nonLetti, setNonLetti] = useState(0);

  // Il campanello della chat: primo controllo subito, poi ogni 20 secondi.
  // La schermata Chat lo azzera da sola quando viene aperta.
  useEffect(() => ascoltaNonLetti(setNonLetti), []);
  useEffect(() => {
    if (!token) return;
    void aggiornaNonLetti(token);
    const giro = setInterval(() => void aggiornaNonLetti(token), 20000);
    return () => clearInterval(giro);
  }, [token]);

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
            tabBarIcon: ({ focused }) => (
              <View>
                <IconaScheda nome={s.icona} attiva={focused} />
                {s.name === 'chat' && nonLetti > 0 ? <PallinoChat /> : null}
              </View>
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
