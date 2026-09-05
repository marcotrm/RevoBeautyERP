/**
 * La splash animata: il respiro d'apertura dell'app.
 *
 * Non un file video — un'animazione in codice: il logo oro che entra con
 * un respiro, il nome in serif, e la dissolvenza verso l'app. Rende come
 * un video ma pesa zero, parte istantanea anche offline, e si ritocca
 * cambiando quattro numeri invece di rimontare un filmato.
 *
 * Copre tutto (anche il caricamento sessione/font sotto) e si congeda da
 * sola dopo ~2,5 secondi. Un tocco la salta: chi apre l'app venti volte
 * al giorno non deve guardarla venti volte.
 */
import { useCallback, useEffect, useState } from 'react';
import { Animated, Easing, Image, Pressable, StyleSheet, Text, useAnimatedValue } from 'react-native';

import { colors, fonts } from '@/theme';

const DURATA_ENTRATA = 700;
const DURATA_RESPIRO = 900;
const DURATA_USCITA = 450;

export function SplashAnimata({ onFine }: { onFine: () => void }) {
  const logoOpacita = useAnimatedValue(0);
  const logoScala = useAnimatedValue(0.82);
  const nomeOpacita = useAnimatedValue(0);
  const nomeSalita = useAnimatedValue(10);
  const velo = useAnimatedValue(1);
  const veloScala = useAnimatedValue(1);
  const [finita, setFinita] = useState(false);

  const chiudi = useCallback(() => {
    Animated.parallel([
      Animated.timing(velo, { toValue: 0, duration: DURATA_USCITA, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      Animated.timing(veloScala, { toValue: 1.05, duration: DURATA_USCITA, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]).start(() => setFinita(true));
  }, [velo, veloScala]);

  useEffect(() => {
    const sequenza = Animated.sequence([
      // Il logo entra: dissolvenza + respiro di scala
      Animated.parallel([
        Animated.timing(logoOpacita, { toValue: 1, duration: DURATA_ENTRATA, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(logoScala, { toValue: 1, duration: DURATA_ENTRATA, easing: Easing.out(Easing.back(1.2)), useNativeDriver: true }),
      ]),
      // Il nome sale da sotto
      Animated.parallel([
        Animated.timing(nomeOpacita, { toValue: 1, duration: 450, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(nomeSalita, { toValue: 0, duration: 450, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]),
      // Un battito del logo, come un respiro
      Animated.sequence([
        Animated.timing(logoScala, { toValue: 1.045, duration: DURATA_RESPIRO / 2, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(logoScala, { toValue: 1, duration: DURATA_RESPIRO / 2, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    ]);
    sequenza.start(() => chiudi());
    return () => sequenza.stop();
  }, [logoOpacita, logoScala, nomeOpacita, nomeSalita, chiudi]);

  // Quando il velo è sparito, il componente esce davvero dall'albero
  useEffect(() => {
    if (finita) onFine();
  }, [finita, onFine]);

  if (finita) return null;

  return (
    <Animated.View style={[styles.velo, { opacity: velo, transform: [{ scale: veloScala }] }]}>
      <Pressable style={styles.tocco} onPress={chiudi}>
        <Animated.View style={{ opacity: logoOpacita, transform: [{ scale: logoScala }] }}>
          <Image source={require('../../assets/images/logo-oro.png')} style={styles.logo} resizeMode="contain" />
        </Animated.View>
        <Animated.View style={{ opacity: nomeOpacita, transform: [{ translateY: nomeSalita }] }}>
          <Text style={styles.motto}>Il tuo percorso di bellezza</Text>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  velo: {
    position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
    zIndex: 100,
    backgroundColor: colors.background,
  },
  tocco: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 22,
  },
  logo: {
    width: 240,
    height: 96,
  },
  motto: {
    fontFamily: fonts.w400,
    fontSize: 13,
    letterSpacing: 0.5,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
});
