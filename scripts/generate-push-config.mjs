import { writeFile } from 'node:fs/promises';
import nextEnv from '@next/env';

const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());
const names = {
  apiKey: 'NEXT_PUBLIC_FIREBASE_API_KEY',
  authDomain: 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  projectId: 'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  storageBucket: 'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  messagingSenderId: 'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  appId: 'NEXT_PUBLIC_FIREBASE_APP_ID',
};
const config = Object.fromEntries(Object.entries(names).map(([key, env]) => [key, process.env[env] ?? '']));
await writeFile('public/firebase-push-config.js', `self.ambatuFirebaseConfig=${JSON.stringify(config)};\n`, 'utf8');
