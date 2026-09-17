export type CognitoUser = {
  id: string;
  email: string;
  name: string;
};

type TokenSet = {
  accessToken: string;
  idToken: string;
  expiresAt: number;
};

const domain = process.env.NEXT_PUBLIC_COGNITO_DOMAIN?.replace(/^https?:\/\//, '').replace(/\/$/, '');
const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;
const callbackUrl = process.env.NEXT_PUBLIC_COGNITO_CALLBACK_URL;
const storageKey = 'ambatuapp-cognito-session';
const verifierKey = 'ambatuapp-cognito-verifier';
const stateKey = 'ambatuapp-cognito-state';

export const cognitoConfigured = Boolean(domain && clientId && callbackUrl);

function encodeBase64Url(bytes: Uint8Array) {
  let binary = '';
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeJwt(token: string): Record<string, unknown> {
  const payload = token.split('.')[1];
  if (!payload) throw new Error('The sign-in response was invalid.');
  return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
}

function userFromIdToken(idToken: string): CognitoUser {
  const claims = decodeJwt(idToken);
  const id = typeof claims.sub === 'string' ? claims.sub : '';
  const email = typeof claims.email === 'string' ? claims.email : '';
  const name = typeof claims.name === 'string' ? claims.name : email.split('@')[0] || 'Player';
  if (!id || !email) throw new Error('Google did not return the required account details.');
  return { id, email, name };
}

export function getStoredSession(): { user: CognitoUser; tokens: TokenSet } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) return null;
    const tokens = JSON.parse(raw) as TokenSet;
    if (!tokens.idToken || !tokens.accessToken || tokens.expiresAt <= Date.now()) {
      sessionStorage.removeItem(storageKey);
      return null;
    }
    return { user: userFromIdToken(tokens.idToken), tokens };
  } catch {
    sessionStorage.removeItem(storageKey);
    return null;
  }
}

export async function beginGoogleSignIn() {
  if (!cognitoConfigured || !domain || !clientId || !callbackUrl) {
    throw new Error('Google sign-in has not been configured yet.');
  }
  const verifier = encodeBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const challenge = encodeBase64Url(new Uint8Array(digest));
  const state = encodeBase64Url(crypto.getRandomValues(new Uint8Array(24)));
  sessionStorage.setItem(verifierKey, verifier);
  sessionStorage.setItem(stateKey, state);
  const url = new URL(`https://${domain}/oauth2/authorize`);
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: callbackUrl,
    scope: 'openid email',
    identity_provider: 'Google',
    code_challenge_method: 'S256',
    code_challenge: challenge,
    state,
  }).toString();
  window.location.assign(url.toString());
}

export async function completeGoogleSignIn(code: string, state: string | null) {
  if (!cognitoConfigured || !domain || !clientId || !callbackUrl) throw new Error('Google sign-in has not been configured yet.');
  const expectedState = sessionStorage.getItem(stateKey);
  const verifier = sessionStorage.getItem(verifierKey);
  sessionStorage.removeItem(stateKey);
  sessionStorage.removeItem(verifierKey);
  if (!state || !expectedState || state !== expectedState || !verifier) throw new Error('Your sign-in session expired. Please try again.');
  const response = await fetch(`https://${domain}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code', code, client_id: clientId, redirect_uri: callbackUrl, code_verifier: verifier,
    }),
  });
  const result = (await response.json()) as { access_token?: string; id_token?: string; expires_in?: number; error_description?: string };
  if (!response.ok || !result.access_token || !result.id_token) throw new Error(result.error_description || 'Could not finish Google sign-in.');
  const tokens: TokenSet = { accessToken: result.access_token, idToken: result.id_token, expiresAt: Date.now() + (result.expires_in ?? 3600) * 1000 };
  const user = userFromIdToken(tokens.idToken);
  sessionStorage.setItem(storageKey, JSON.stringify(tokens));
  return { user, tokens };
}

export function clearStoredSession() {
  if (typeof window !== 'undefined') sessionStorage.removeItem(storageKey);
}
