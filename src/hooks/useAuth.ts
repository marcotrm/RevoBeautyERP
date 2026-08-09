/**
 * Hook di accesso al contesto di autenticazione.
 * Lancia un errore esplicito se usato fuori da <AuthProvider>.
 */
import { useContext } from 'react';

import { AuthContext, AuthContextValue } from '@/context/AuthContext';

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve essere usato dentro <AuthProvider>');
  }
  return context;
}
