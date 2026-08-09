/**
 * Dialogo di conferma cross-platform:
 * Alert nativo su iOS/Android, window.confirm sul web
 * (Alert.alert sul web non mostra nulla).
 */
import { Alert, Platform } from 'react-native';

export function confirmAsync(title: string, message: string, confirmLabel: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }

  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Annulla', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}
