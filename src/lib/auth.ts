/**
 * Backoffice authentication via Cognito Backoffice Pool.
 * Used by backoffice/operator panel.
 */
import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserSession,
} from 'amazon-cognito-identity-js';

const POOL_ID = process.env.NEXT_PUBLIC_BACKOFFICE_POOL_ID || '';
const CLIENT_ID = process.env.NEXT_PUBLIC_BACKOFFICE_CLIENT_ID || '';

function getUserPool() {
  if (!POOL_ID || !CLIENT_ID) {
    throw new Error('Backoffice Cognito Pool not configured. Set NEXT_PUBLIC_BACKOFFICE_POOL_ID and NEXT_PUBLIC_BACKOFFICE_CLIENT_ID.');
  }
  return new CognitoUserPool({
    UserPoolId: POOL_ID,
    ClientId: CLIENT_ID,
  });
}

export interface BackofficeUser {
  userId: string;
  email: string;
  givenName?: string;
  familyName?: string;
  role?: string;
}

export function signIn(email: string, password: string): Promise<BackofficeUser> {
  return new Promise((resolve, reject) => {
    const pool = getUserPool();
    const cognitoUser = new CognitoUser({ Username: email, Pool: pool });
    const authDetails = new AuthenticationDetails({ Username: email, Password: password });

    cognitoUser.authenticateUser(authDetails, {
      onSuccess(session: CognitoUserSession) {
        const payload = session.getIdToken().decodePayload();
        resolve({
          userId: payload.sub,
          email: payload.email,
          givenName: payload.given_name,
          familyName: payload.family_name,
          role: payload['custom:role'],
        });
      },
      onFailure(err) {
        reject(err);
      },
      newPasswordRequired() {
        reject(new Error('NEW_PASSWORD_REQUIRED'));
      },
    });
  });
}

export function signOut(): void {
  const user = getUserPool().getCurrentUser();
  if (user) user.signOut();
}

export function getSession(): Promise<CognitoUserSession | null> {
  return new Promise((resolve) => {
    const user = getUserPool().getCurrentUser();
    if (!user) {
      resolve(null);
      return;
    }
    user.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err || !session || !session.isValid()) {
        resolve(null);
        return;
      }
      resolve(session);
    });
  });
}

export async function getIdToken(): Promise<string | null> {
  const session = await getSession();
  return session?.getIdToken().getJwtToken() ?? null;
}

export async function getCurrentBackofficeUser(): Promise<BackofficeUser | null> {
  const session = await getSession();
  if (!session) return null;
  const payload = session.getIdToken().decodePayload();
  return {
    userId: payload.sub,
    email: payload.email,
    givenName: payload.given_name,
    familyName: payload.family_name,
    role: payload['custom:role'],
  };
}
