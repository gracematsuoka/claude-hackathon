# Expo + Express Monorepo

This project contains:

- `apps/mobile`: the Expo app
- `apps/api`: the Express.js backend

## Prerequisites

- Node.js LTS installed
- npm installed
- Expo Go on your phone, or an iOS simulator / Android emulator

## Project Setup After Cloning

Clone the repo, then install dependencies for each app:

```bash
git clone <your-repo-url>
cd claude-hackathon

cd apps/api
npm install

cd ../mobile
npm install
```

## Environment Files

Create local `.env` files from the committed examples:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/mobile/.env.example apps/mobile/.env
```

### `apps/api/.env`

```env
PORT=4000
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

### `apps/mobile/.env`

```env
EXPO_PUBLIC_API_URL=http://YOUR_LOCAL_IP:4000
```

If you are testing the Expo app on a physical phone, do not use `localhost`. Use your computer's LAN IP instead.

On macOS you can usually get it with:

```bash
ipconfig getifaddr en0
```

If that does not return an address, try:

```bash
ipconfig getifaddr en1
```

Then set:

```env
EXPO_PUBLIC_API_URL=http://<your-lan-ip>:4000
```

## Running the Backend

From the repo root:

```bash
cd apps/api
npm run dev
```

The API starts on `http://localhost:4000` by default.

### Test the backend

Health check:

```bash
curl http://localhost:4000/health
```

Sample API response:

```bash
curl http://localhost:4000/api/message
```

Google Places lookup:

```bash
curl "http://localhost:4000/api/places?latitude=40.7128&longitude=-74.0060&radius=1500&filter=housing"
```

You can also use `filter=food%20shelter` or `filter=food_shelter`.

## Running the Expo App

Open a second terminal from the repo root:

```bash
cd apps/mobile
npm start
```

Then choose one of the Expo options in the terminal:

- press `i` for the iOS simulator
- press `a` for the Android emulator
- scan the QR code with Expo Go
- press `w` to open the web version

## Running Both Together

Use two terminals:

Terminal 1:

```bash
cd apps/api
npm run dev
```

Terminal 2:

```bash
cd apps/mobile
npm start
```

## Important Notes

- Start the Express API before testing anything in the mobile app that depends on backend data.
- `apps/mobile/.env` is intentionally ignored by Git because it contains your machine-specific API URL.
- `apps/api/.env` is intentionally ignored by Git because backend environment settings should stay local.
- Right now the backend is ready and exposes `/health` and `/api/message`.
- The Expo app template is still mostly starter UI. If you want, the next step is wiring `EXPO_PUBLIC_API_URL` into `apps/mobile/src/app/index.tsx` so the app fetches data from Express.

## Useful Commands

Backend:

```bash
cd apps/api
npm run dev
npm start
```

Mobile:

```bash
cd apps/mobile
npm start
npm run ios
npm run android
npm run web
```
