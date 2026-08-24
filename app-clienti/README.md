# RevoBeauty — App Clienti

App mobile (iOS + Android) per le clienti del centro estetico RevoBeauty.
Expo (managed) · TypeScript strict · Expo Router · React Context · react-hook-form + zod · expo-secure-store.

## Avvio

```bash
npm install        # solo la prima volta
npx expo start     # poi premi i (simulatore iOS) o a (emulatore Android)
```

Utente demo (mock): `demo@revobeauty.it` / `Demo1234`

## Struttura

- `src/app/` — route Expo Router: gruppo `(auth)` (login, signup, forgot-password) e gruppo `(tabs)` (Home, Pacchetti, Appuntamenti, Notifiche, Contatti). Redirect automatico in `src/app/_layout.tsx`.
- `src/api/` — layer API astratto: interfaccia `AuthProvider` + `MockAuthService`.
- `src/context/AuthContext.tsx` — stato di autenticazione globale (user, isLoading, signUp/signIn/signOut) con persistenza sessione in SecureStore.
- `src/theme/` — design tokens (colori/spacing/tipografia) con valori PLACEHOLDER da sostituire con la brand identity definitiva.
- `src/validation/` — schemi zod dei form.

## Collegamento al gestionale

L'app è collegata alle API reali del gestionale (`revobeauty-app`, route `/api/mobile/*`):
autenticazione, listino con prezzi personalizzati donna/uomo e appuntamenti con disdetta (fino a 24h prima).

- **In sviluppo** il gestionale deve girare sul Mac: `cd ../Revobeauty/revobeauty-app && npm run dev`.
  L'app ne ricava l'indirizzo automaticamente (stesso host del bundle Expo, porta 3000).
- **Per puntare a un altro server** (es. produzione): `EXPO_PUBLIC_API_URL=https://... npx expo start`.
- Punto di swap dei servizi: `src/api/index.ts` (auth, listino, appuntamenti). I mock restano
  disponibili in `src/api/MockAuthService.ts` per sviluppare offline.
- Recupero password: ancora simulato lato app, in attesa di un provider email nel gestionale.
