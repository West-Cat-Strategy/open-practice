import type {
  RecoveryCodeRecord,
  User,
  WebAuthnChallengeRecord,
  WebAuthnCredentialRecord,
} from "@open-practice/domain";
import type {
  AuthRepository,
  AuthAccountRecord,
  AuthPasswordSetupTokenRecord,
  AuthSessionRecord,
} from "../auth-contracts.js";
import { clone } from "../contracts.js";

export interface MemoryAuthStore {
  users: User[];
  authAccounts: AuthAccountRecord[];
  authSessions: AuthSessionRecord[];
  passwordSetupTokens: AuthPasswordSetupTokenRecord[];
  authChallenges: WebAuthnChallengeRecord[];
  webAuthnCredentials: WebAuthnCredentialRecord[];
  recoveryCodes: RecoveryCodeRecord[];
}

export function getMemoryUser(
  store: MemoryAuthStore,
  firmId: string,
  userId: string,
): User | undefined {
  return clone(store.users.find((user) => user.firmId === firmId && user.id === userId));
}

export function createMemoryUser(store: MemoryAuthStore, user: User): User {
  store.users = [...store.users, clone(user)];
  return clone(user);
}

export function getMemoryUserByEmail(
  store: MemoryAuthStore,
  firmId: string,
  email: string,
): User | undefined {
  const normalized = email.trim().toLowerCase();
  return clone(
    store.users.find(
      (user) => user.firmId === firmId && user.email.trim().toLowerCase() === normalized,
    ),
  );
}

export function getMemoryAuthAccount(
  store: MemoryAuthStore,
  firmId: string,
  userId: string,
): AuthAccountRecord | undefined {
  return clone(
    store.authAccounts.find((account) => account.firmId === firmId && account.userId === userId),
  );
}

export function setMemoryAuthPassword(
  store: MemoryAuthStore,
  input: {
    firmId: string;
    userId: string;
    passwordHash: string;
    passwordUpdatedAt: string;
  },
): AuthAccountRecord {
  const account: AuthAccountRecord = { ...input };
  store.authAccounts = [
    ...store.authAccounts.filter(
      (candidate) => candidate.firmId !== input.firmId || candidate.userId !== input.userId,
    ),
    account,
  ];
  return clone(account);
}

export function createMemoryAuthSession(
  store: MemoryAuthStore,
  session: AuthSessionRecord,
): AuthSessionRecord {
  store.authSessions = [...store.authSessions, clone(session)];
  return clone(session);
}

export function getMemoryAuthSessionByTokenHash(
  store: MemoryAuthStore,
  tokenHash: string,
): AuthSessionRecord | undefined {
  return clone(store.authSessions.find((session) => session.tokenHash === tokenHash));
}

export function touchMemoryAuthSession(
  store: MemoryAuthStore,
  tokenHash: string,
  seenAt: string,
): void {
  store.authSessions = store.authSessions.map((session) =>
    session.tokenHash === tokenHash ? { ...session, lastSeenAt: seenAt } : session,
  );
}

export function markMemoryAuthSessionFresh(
  store: MemoryAuthStore,
  tokenHash: string,
  freshAuthenticatedAt: string,
): void {
  store.authSessions = store.authSessions.map((session) =>
    session.tokenHash === tokenHash ? { ...session, freshAuthenticatedAt } : session,
  );
}

export function revokeMemoryAuthSession(
  store: MemoryAuthStore,
  tokenHash: string,
  revokedAt: string,
): void {
  store.authSessions = store.authSessions.map((session) =>
    session.tokenHash === tokenHash ? { ...session, revokedAt } : session,
  );
}

export function createMemoryPasswordSetupToken(
  store: MemoryAuthStore,
  token: AuthPasswordSetupTokenRecord,
): AuthPasswordSetupTokenRecord {
  store.passwordSetupTokens = [...store.passwordSetupTokens, clone(token)];
  return clone(token);
}

export function consumeMemoryPasswordSetupToken(
  store: MemoryAuthStore,
  tokenHash: string,
  usedAt: string,
): AuthPasswordSetupTokenRecord | undefined {
  const token = store.passwordSetupTokens.find((candidate) => candidate.tokenHash === tokenHash);
  if (!token || token.usedAt || Date.parse(token.expiresAt) <= Date.parse(usedAt)) {
    return undefined;
  }
  token.usedAt = usedAt;
  return clone(token);
}

export function createMemoryWebAuthnChallenge(
  store: MemoryAuthStore,
  challenge: WebAuthnChallengeRecord,
): WebAuthnChallengeRecord {
  store.authChallenges = [...store.authChallenges, clone(challenge)];
  return clone(challenge);
}

export function getMemoryWebAuthnChallenge(
  store: MemoryAuthStore,
  challengeHash: string,
): WebAuthnChallengeRecord | undefined {
  return clone(store.authChallenges.find((challenge) => challenge.challengeHash === challengeHash));
}

export function consumeMemoryWebAuthnChallenge(
  store: MemoryAuthStore,
  challengeHash: string,
  consumedAt: string,
): boolean {
  const challenge = store.authChallenges.find(
    (candidate) => candidate.challengeHash === challengeHash && !candidate.consumedAt,
  );
  if (!challenge) return false;
  challenge.consumedAt = consumedAt;
  return true;
}

export function registerMemoryWebAuthnCredential(
  store: MemoryAuthStore,
  credential: WebAuthnCredentialRecord,
): WebAuthnCredentialRecord {
  store.webAuthnCredentials = [...store.webAuthnCredentials, clone(credential)];
  return clone(credential);
}

export function listMemoryWebAuthnCredentials(
  store: MemoryAuthStore,
  firmId: string,
  userId: string,
): WebAuthnCredentialRecord[] {
  return clone(
    store.webAuthnCredentials.filter(
      (credential) => credential.firmId === firmId && credential.userId === userId,
    ),
  );
}

export function getMemoryWebAuthnCredential(
  store: MemoryAuthStore,
  credentialId: string,
): WebAuthnCredentialRecord | undefined {
  return clone(
    store.webAuthnCredentials.find((credential) => credential.credentialId === credentialId),
  );
}

export function getMemoryWebAuthnCredentialForFirm(
  store: MemoryAuthStore,
  firmId: string,
  credentialId: string,
): WebAuthnCredentialRecord | undefined {
  return clone(
    store.webAuthnCredentials.find(
      (credential) => credential.firmId === firmId && credential.credentialId === credentialId,
    ),
  );
}

export function updateMemoryWebAuthnCredentialCounter(
  store: MemoryAuthStore,
  id: string,
  counter: number,
): void {
  const credential = store.webAuthnCredentials.find((candidate) => candidate.id === id);
  if (credential) {
    credential.counter = counter;
    credential.lastUsedAt = new Date().toISOString();
  }
}

export function deleteMemoryWebAuthnCredential(
  store: MemoryAuthStore,
  firmId: string,
  userId: string,
  id: string,
): void {
  store.webAuthnCredentials = store.webAuthnCredentials.filter(
    (credential) =>
      !(credential.firmId === firmId && credential.userId === userId && credential.id === id),
  );
}

export function updateMemoryUserMfaStatus(
  store: MemoryAuthStore,
  firmId: string,
  userId: string,
  mfaEnabled: boolean,
): void {
  const user = store.users.find(
    (candidate) => candidate.firmId === firmId && candidate.id === userId,
  );
  if (user) {
    user.mfaEnabled = mfaEnabled;
  }
}

export function createMemoryRecoveryCodes(
  store: MemoryAuthStore,
  firmId: string,
  userId: string,
  codes: RecoveryCodeRecord[],
): void {
  store.recoveryCodes = store.recoveryCodes.filter(
    (code) => !(code.firmId === firmId && code.userId === userId),
  );
  store.recoveryCodes = [...store.recoveryCodes, ...clone(codes)];
}

export function useMemoryRecoveryCode(
  store: MemoryAuthStore,
  firmId: string,
  userId: string,
  codeHash: string,
  consumedAt: string,
): boolean {
  const code = store.recoveryCodes.find(
    (candidate) =>
      candidate.firmId === firmId &&
      candidate.userId === userId &&
      candidate.codeHash === codeHash &&
      !candidate.usedAt,
  );
  if (!code) return false;
  code.usedAt = consumedAt;
  return true;
}

export function listMemoryRecoveryCodes(
  store: MemoryAuthStore,
  firmId: string,
  userId: string,
): RecoveryCodeRecord[] {
  return clone(
    store.recoveryCodes.filter((code) => code.firmId === firmId && code.userId === userId),
  );
}

export function createMemoryAuthRepository(store: MemoryAuthStore): AuthRepository {
  return {
    getUser: async (firmId, userId) => getMemoryUser(store, firmId, userId),
    createUser: async (user) => createMemoryUser(store, user),
    getUserByEmail: async (firmId, email) => getMemoryUserByEmail(store, firmId, email),
    getAuthAccount: async (firmId, userId) => getMemoryAuthAccount(store, firmId, userId),
    setAuthPassword: async (input) => setMemoryAuthPassword(store, input),
    createAuthSession: async (session) => createMemoryAuthSession(store, session),
    getAuthSessionByTokenHash: async (tokenHash) =>
      getMemoryAuthSessionByTokenHash(store, tokenHash),
    touchAuthSession: async (tokenHash, seenAt) => {
      touchMemoryAuthSession(store, tokenHash, seenAt);
    },
    markAuthSessionFresh: async (tokenHash, freshAuthenticatedAt) => {
      markMemoryAuthSessionFresh(store, tokenHash, freshAuthenticatedAt);
    },
    revokeAuthSession: async (tokenHash, revokedAt) => {
      revokeMemoryAuthSession(store, tokenHash, revokedAt);
    },
    createPasswordSetupToken: async (token) => createMemoryPasswordSetupToken(store, token),
    consumePasswordSetupToken: async (tokenHash, usedAt) =>
      consumeMemoryPasswordSetupToken(store, tokenHash, usedAt),
    createWebAuthnChallenge: async (challenge) => createMemoryWebAuthnChallenge(store, challenge),
    getWebAuthnChallenge: async (challengeHash) => getMemoryWebAuthnChallenge(store, challengeHash),
    consumeWebAuthnChallenge: async (challengeHash, consumedAt) =>
      consumeMemoryWebAuthnChallenge(store, challengeHash, consumedAt),
    registerWebAuthnCredential: async (credential) =>
      registerMemoryWebAuthnCredential(store, credential),
    listWebAuthnCredentials: async (firmId, userId) =>
      listMemoryWebAuthnCredentials(store, firmId, userId),
    getWebAuthnCredential: async (credentialId) => getMemoryWebAuthnCredential(store, credentialId),
    getWebAuthnCredentialForFirm: async (firmId, credentialId) =>
      getMemoryWebAuthnCredentialForFirm(store, firmId, credentialId),
    updateWebAuthnCredentialCounter: async (id, counter) => {
      updateMemoryWebAuthnCredentialCounter(store, id, counter);
    },
    deleteWebAuthnCredential: async (firmId, userId, id) => {
      deleteMemoryWebAuthnCredential(store, firmId, userId, id);
    },
    updateUserMfaStatus: async (firmId, userId, mfaEnabled) => {
      updateMemoryUserMfaStatus(store, firmId, userId, mfaEnabled);
    },
    createRecoveryCodes: async (firmId, userId, codes) => {
      createMemoryRecoveryCodes(store, firmId, userId, codes);
    },
    useRecoveryCode: async (firmId, userId, codeHash, consumedAt) =>
      useMemoryRecoveryCode(store, firmId, userId, codeHash, consumedAt),
    listRecoveryCodes: async (firmId, userId) => listMemoryRecoveryCodes(store, firmId, userId),
  };
}
