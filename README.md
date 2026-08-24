# RevoBeauty ERP

Gestionale del centro estetico RevoBeauty (Next.js + Prisma + PostgreSQL su Railway).

Questo repository contiene **due applicazioni**:

| Cartella | Cosa è |
|---|---|
| `/` (radice) | **Gestionale web** (ERP): agenda, clienti, cassa, listino, chat operatrici. Deploy automatico su Railway a ogni push su `main`. |
| [`app-clienti/`](app-clienti/) | **App mobile clienti** (iOS + Android, Expo/React Native): accesso con OTP, listino con prezzi personalizzati, appuntamenti con disdetta entro 24h, chat con il centro. Parla con l'ERP tramite le route `/api/mobile/*`. |

## Gestionale — avvio

```bash
npm install
npm run dev        # http://localhost:3000
```

## App clienti — avvio

```bash
cd app-clienti
npm install
npx expo start     # "i" per iOS, "a" per Android, QR per Expo Go
```

Vedi [app-clienti/README.md](app-clienti/README.md) per i dettagli (configurazione server, TestFlight, ecc.).

## Note

- Il deploy Railway builda solo il gestionale: `app-clienti` è esclusa da typecheck e lint dell'ERP (ha i suoi).
- Le API per l'app mobile sono in `src/app/api/mobile/` e usano la tabella `mobile_accounts`.
