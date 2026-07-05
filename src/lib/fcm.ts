import admin from 'firebase-admin';
import { config } from '../config.js';

let fcmApp: admin.app.App | null = null;

export function getFcmApp(): admin.app.App {
  if (fcmApp) return fcmApp;

  const serviceAccount = config.FIREBASE_SERVICE_ACCOUNT
    ? JSON.parse(config.FIREBASE_SERVICE_ACCOUNT)
    : undefined;

  fcmApp = admin.initializeApp({
    credential: serviceAccount
      ? admin.credential.cert(serviceAccount as admin.ServiceAccount)
      : admin.credential.applicationDefault(),
    projectId: config.FIREBASE_PROJECT_ID,
  });

  return fcmApp;
}

export async function sendPush(
  tokens: string[],
  payload: { title: string; body: string; data?: Record<string, string> }
): Promise<{ success: number; failure: number }> {
  if (tokens.length === 0) return { success: 0, failure: 0 };

  // Mock in test/dev when no Firebase config
  if (!config.FIREBASE_PROJECT_ID || config.FIREBASE_PROJECT_ID === 'test-project') {
    console.log('[FCM Mock] Would send push:', { tokens: tokens.length, payload });
    return { success: tokens.length, failure: 0 };
  }

  try {
    const messaging = getFcmApp().messaging();
    const message: admin.messaging.MulticastMessage = {
      tokens,
      notification: { title: payload.title, body: payload.body },
      data: payload.data,
      webpush: {
        fcmOptions: { link: payload.data?.url || '/' },
      },
    };

    const response = await messaging.sendEachForMulticast(message);
    return { success: response.successCount, failure: response.failureCount };
  } catch (err) {
    console.error('[FCM] Send push failed:', err);
    return { success: 0, failure: tokens.length };
  }
}
