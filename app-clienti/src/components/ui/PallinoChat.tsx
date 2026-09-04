/**
 * Il pallino rosso che lampeggia sull'icona della Chat quando il centro
 * ha risposto. Pulsa piano — deve chiamare l'occhio, non fare l'allarme.
 */
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';

import { colors } from '@/theme';

export function PallinoChat() {
  const battito = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const ciclo = Animated.loop(
      Animated.sequence([
        Animated.timing(battito, { toValue: 0.35, duration: 650, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(battito, { toValue: 1, duration: 650, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    ciclo.start();
    return () => ciclo.stop();
  }, [battito]);

  return <Animated.View style={[styles.pallino, { opacity: battito }]} />;
}

const styles = StyleSheet.create({
  pallino: {
    position: 'absolute',
    top: -2,
    right: -4,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.error,
    // Il bordino color sfondo lo stacca dall'icona invece di toccarla
    borderWidth: 1.5,
    borderColor: colors.background,
  },
});
