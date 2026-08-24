/**
 * I font del marchio, e come si caricano.
 *
 * Sono gli stessi di revobeauty.it: Cormorant Garamond per i titoli,
 * Montserrat per il resto.
 *
 * In React Native il grassetto NON si ottiene con `fontWeight`: con una
 * famiglia caricata a mano quel valore viene ignorato su iOS e il testo resta
 * uguale a prima. Il peso è un font a sé, e si sceglie da qui: `fonts.w600`.
 */
import {
  CormorantGaramond_500Medium,
  CormorantGaramond_600SemiBold,
  CormorantGaramond_700Bold,
} from '@expo-google-fonts/cormorant-garamond';
import {
  Montserrat_300Light,
  Montserrat_400Regular,
  Montserrat_500Medium,
  Montserrat_600SemiBold,
  Montserrat_700Bold,
} from '@expo-google-fonts/montserrat';

/** I nomi con cui le famiglie vanno chiamate negli stili. */
export const fonts = {
  serif500: 'CormorantGaramond_500Medium',
  serif600: 'CormorantGaramond_600SemiBold',
  serif700: 'CormorantGaramond_700Bold',

  w300: 'Montserrat_300Light',
  w400: 'Montserrat_400Regular',
  w500: 'Montserrat_500Medium',
  w600: 'Montserrat_600SemiBold',
  w700: 'Montserrat_700Bold',
  /** L'800 non c'è: sopra al 700 Montserrat diventa pesante e volgare. */
  w800: 'Montserrat_700Bold',
} as const;

/** Da passare a `useFonts` all'avvio dell'app. */
export const fontAssets = {
  CormorantGaramond_500Medium,
  CormorantGaramond_600SemiBold,
  CormorantGaramond_700Bold,
  Montserrat_300Light,
  Montserrat_400Regular,
  Montserrat_500Medium,
  Montserrat_600SemiBold,
  Montserrat_700Bold,
};
