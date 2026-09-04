/**
 * I font dell'app, e come si caricano.
 *
 * Una famiglia sola: Urbanist, un geometrico moderno con l'eleganza da
 * rivista di moda. Il serif del sito (Cormorant) sullo schermo piccolo
 * invecchiava tutto; qui i titoli sono pesi forti della stessa famiglia —
 * il look «oro, bianco e nero» moderno, non da pergamena.
 *
 * Le chiavi storiche restano (serif500/600/700): così le schermate che
 * chiedevano «il font dei titoli» ricevono il nuovo senza cambiare una riga.
 *
 * In React Native il grassetto NON si ottiene con `fontWeight`: con una
 * famiglia caricata a mano quel valore viene ignorato su iOS e il testo resta
 * uguale a prima. Il peso è un font a sé, e si sceglie da qui: `fonts.w600`.
 */
import {
  Urbanist_300Light,
  Urbanist_400Regular,
  Urbanist_500Medium,
  Urbanist_600SemiBold,
  Urbanist_700Bold,
  Urbanist_800ExtraBold,
} from '@expo-google-fonts/urbanist';

/** I nomi con cui le famiglie vanno chiamate negli stili. */
export const fonts = {
  // «I titoli»: ieri serif, oggi i pesi forti — i nomi restano per compatibilità
  serif500: 'Urbanist_600SemiBold',
  serif600: 'Urbanist_700Bold',
  serif700: 'Urbanist_800ExtraBold',

  w300: 'Urbanist_300Light',
  w400: 'Urbanist_400Regular',
  w500: 'Urbanist_500Medium',
  w600: 'Urbanist_600SemiBold',
  w700: 'Urbanist_700Bold',
  w800: 'Urbanist_800ExtraBold',
} as const;

/** Da passare a `useFonts` all'avvio dell'app. */
export const fontAssets = {
  Urbanist_300Light,
  Urbanist_400Regular,
  Urbanist_500Medium,
  Urbanist_600SemiBold,
  Urbanist_700Bold,
  Urbanist_800ExtraBold,
};
