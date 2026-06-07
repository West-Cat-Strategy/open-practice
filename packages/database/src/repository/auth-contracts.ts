import type {
  RecoveryCodeRecord,
  User,
  WebAuthnChallengeRecord,
  WebAuthnCredentialRecord,
} from "@open-practice/domain";

export interface AuthAccountRecord {
  firmId: string;
  userId: string;
  passwordHash: string;
  passwordUpdatedAt: string;
}

export interface AuthSessionRecord {
  id: string;
  firmId: string;
  userId: string;
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
  freshAuthenticatedAt?: string;
  revokedAt?: string;
  lastSeenAt?: string;
}

export interface AuthPasswordSetupTokenRecord {
  id: string;
  firmId: string;
  userId: string;
  tokenHash: string;
  createdByUserId?: string;
  createdAt: string;
  expiresAt: string;
  usedAt?: string;
}

export interface AuthRepository {
  getUser(firmId: string, userId: string): Promise<User | undefined>;
  createUser(user: User): Promise<User>;
  getUserByEmail(firmId: string, email: string): Promise<User | undefined>;
  getAuthAccount(firmId: string, userId: string): Promise<AuthAccountRecord | undefined>;
  setAuthPassword(input: {
    firmId: string;
    userId: string;
    passwordHash: string;
    passwordUpdatedAt: string;
  }): Promise<AuthAccountRecord>;
  createAuthSession(session: AuthSessionRecord): Promise<AuthSessionRecord>;
  getAuthSessionByTokenHash(tokenHash: string): Promise<AuthSessionRecord | undefined>;
  touchAuthSession(tokenHash: string, seenAt: string): Promise<void>;
  markAuthSessionFresh(tokenHash: string, freshAuthenticatedAt: string): Promise<void>;
  revokeAuthSession(tokenHash: string, revokedAt: string): Promise<void>;
  createPasswordSetupToken(
    token: AuthPasswordSetupTokenRecord,
  ): Promise<AuthPasswordSetupTokenRecord>;
  consumePasswordSetupToken(
    tokenHash: string,
    usedAt: string,
  ): Promise<AuthPasswordSetupTokenRecord | undefined>;
  createWebAuthnChallenge(challenge: WebAuthnChallengeRecord): Promise<WebAuthnChallengeRecord>;
  getWebAuthnChallenge(challengeHash: string): Promise<WebAuthnChallengeRecord | undefined>;
  consumeWebAuthnChallenge(challengeHash: string, consumedAt: string): Promise<boolean>;
  registerWebAuthnCredential(
    credential: WebAuthnCredentialRecord,
  ): Promise<WebAuthnCredentialRecord>;
  listWebAuthnCredentials(firmId: string, userId: string): Promise<WebAuthnCredentialRecord[]>;
  getWebAuthnCredential(credentialId: string): Promise<WebAuthnCredentialRecord | undefined>;
  getWebAuthnCredentialForFirm(
    firmId: string,
    credentialId: string,
  ): Promise<WebAuthnCredentialRecord | undefined>;
  updateWebAuthnCredentialCounter(id: string, counter: number): Promise<void>;
  deleteWebAuthnCredential(firmId: string, userId: string, id: string): Promise<void>;
  updateUserMfaStatus(firmId: string, userId: string, mfaEnabled: boolean): Promise<void>;
  createRecoveryCodes(firmId: string, userId: string, codes: RecoveryCodeRecord[]): Promise<void>;
  useRecoveryCode(
    firmId: string,
    userId: string,
    codeHash: string,
    consumedAt: string,
  ): Promise<boolean>;
  listRecoveryCodes(firmId: string, userId: string): Promise<RecoveryCodeRecord[]>;
}
