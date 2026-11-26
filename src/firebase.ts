import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  User,
  getAuth,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  getDocFromServer,
  getFirestore,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { PlayerProfile, ThemeId } from './types/game';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration (Firestore offline).');
    }
  }
}

void testConnection();

export const BOOTSTRAPPED_DEV_EMAIL = 'studiosmobile092@gmail.com';

export async function signInWithGooglePopup(): Promise<User> {
  const cred = await signInWithPopup(auth, googleProvider);
  return cred.user;
}

export async function signOutAccount(): Promise<void> {
  await signOut(auth);
}

export async function checkUserDeveloperRole(user: User): Promise<boolean> {
  if (!user.emailVerified) return false;
  if (user.email?.toLowerCase() === BOOTSTRAPPED_DEV_EMAIL.toLowerCase()) {
    return true;
  }
  const rolePath = `dev_roles/${user.uid}`;
  try {
    const snap = await getDoc(doc(db, 'dev_roles', user.uid));
    if (!snap.exists()) return false;
    const data = snap.data() as { role?: string };
    return data.role === 'developer' || data.role === 'admin';
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, rolePath);
  }
}

export interface CloudProfileSnapshot {
  theme?: ThemeId;
  unlockedThemes?: ThemeId[];
  bestScore?: number;
  bestStreak?: number;
  totalOrbsEarned?: number;
  tutorialSongCompleted?: boolean;
}

export async function fetchUserCloudProfile(user: User): Promise<CloudProfileSnapshot | null> {
  if (!user.emailVerified) return null;
  const profilePath = `user_profiles/${user.uid}`;
  try {
    const snap = await getDoc(doc(db, 'user_profiles', user.uid));
    if (!snap.exists()) return null;
    return snap.data() as CloudProfileSnapshot;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, profilePath);
  }
}

export async function syncUserProfileToCloud(user: User, profile: PlayerProfile): Promise<void> {
  if (!user.emailVerified) return;
  const profilePath = `user_profiles/${user.uid}`;
  const docRef = doc(db, 'user_profiles', user.uid);

  const sanitizedThemes = Array.from(
    new Set(
      (profile.unlockedThemes.length > 0 ? profile.unlockedThemes : ['tokyo_pink']).map((t) =>
        String(t).slice(0, 32),
      ),
    ),
  ).slice(0, 20);

  const sharedPayload = {
    displayName: (user.displayName || 'Orbit Player').slice(0, 80),
    email: (user.email || '').slice(0, 180),
    theme: String(profile.theme || 'tokyo_pink').slice(0, 32),
    unlockedThemes: sanitizedThemes,
    bestScore: Math.max(0, Math.floor(profile.bestScore || 0)),
    bestStreak: Math.max(0, Math.floor(profile.bestStreak || 0)),
    totalOrbsEarned: Math.max(0, Math.floor(profile.totalOrbsEarned || 0)),
    tutorialSongCompleted: Boolean(profile.tutorialSongCompleted),
    updatedAt: serverTimestamp(),
  };

  try {
    const existingSnap = await getDoc(docRef);
    if (!existingSnap.exists()) {
      await setDoc(docRef, {
        uid: user.uid.slice(0, 128),
        ...sharedPayload,
        createdAt: serverTimestamp(),
      });
    } else {
      await updateDoc(docRef, sharedPayload);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, profilePath);
  }
}
