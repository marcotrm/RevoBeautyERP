/**
 * Il filo tra le notifiche push e l'app.
 *
 * Non disegna nulla: quando la cliente è dentro registra il telefono per
 * gli avvisi, e quando lei tocca una notifica la porta nella schermata
 * giusta (la rotta viaggia nel payload: es. { rotta: '/prenota' }).
 */
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { useAuth } from '@/hooks/useAuth';
import { aggiornaNonLetti } from '@/lib/chatBadge';
import { registraNotifichePush } from '@/lib/pushClient';

export function NotifichePush() {
  const { user, token } = useAuth();
  const router = useRouter();

  // Registrazione: dopo il login e a ogni riapertura con sessione valida
  useEffect(() => {
    if (user && token) void registraNotifichePush(token);
  }, [user, token]);

  // Notifica arrivata con l'app aperta: se è la chat, il pallino si accende subito
  useEffect(() => {
    if (!token) return;
    const sub = Notifications.addNotificationReceivedListener((n) => {
      if (n.request.content.data?.rotta === '/chat') void aggiornaNonLetti(token);
    });
    return () => sub.remove();
  }, [token]);

  // Tocco sulla notifica → schermata giusta
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((risposta) => {
      const rotta = risposta.notification.request.content.data?.rotta;
      if (typeof rotta === 'string' && rotta.startsWith('/')) {
        router.push(rotta as never);
      }
    });
    return () => sub.remove();
  }, [router]);

  return null;
}
