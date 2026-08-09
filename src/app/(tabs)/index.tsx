/**
 * Tab Home — qui andrà la fidelity card digitale.
 * Include il logout (temporaneo, per testare il flusso di autenticazione).
 */
import { PlaceholderScreen } from '@/components/PlaceholderScreen';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';

export default function HomeScreen() {
  const { user, signOut } = useAuth();

  return (
    <PlaceholderScreen
      title={`Ciao${user ? ` ${user.nome}` : ''}!`}
      description="Qui troverai la tua fidelity card digitale RevoBeauty."
    >
      <Button title="Esci" variant="secondary" onPress={() => void signOut()} />
    </PlaceholderScreen>
  );
}
