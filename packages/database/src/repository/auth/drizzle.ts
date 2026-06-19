import type {
  RecoveryCodeRecord,
  User,
  WebAuthnChallengeRecord,
  WebAuthnCredentialRecord,
} from "@open-practice/domain";
import { and, eq, inArray, isNull } from "drizzle-orm";
import type { OpenPracticeDatabase } from "../../runtime.js";
import * as schema from "../../schema.js";
import type {
  AuthRepository,
  AuthAccountRecord,
  AuthPasswordSetupTokenRecord,
  AuthSessionRecord,
} from "../auth-contracts.js";
import {
  mapAuthAccountRow,
  mapAuthChallengeRow,
  mapAuthSessionRow,
  mapPasswordSetupTokenRow,
  mapRecoveryCodeRow,
  mapWebAuthnCredentialRow,
} from "../drizzle-mappers.js";

function mapUserRow(row: typeof schema.users.$inferSelect, assignedMatterIds: string[]): User {
  return {
    id: row.id,
    firmId: row.firmId,
    displayName: row.displayName,
    email: row.email,
    role: row.role,
    assignedMatterIds,
    mfaEnabled: row.mfaEnabled,
    practitionerProfile: row.practitionerProfile ?? undefined,
  };
}

async function listDrizzleAssignmentMatterIdsByUserId(
  db: OpenPracticeDatabase,
  firmId: string,
  userIds: string[],
): Promise<Map<string, string[]>> {
  const uniqueUserIds = [...new Set(userIds)];
  if (uniqueUserIds.length === 0) return new Map();
  const assignments = await db
    .select({
      userId: schema.matterAssignments.userId,
      matterId: schema.matterAssignments.matterId,
    })
    .from(schema.matterAssignments)
    .innerJoin(
      schema.matters,
      and(
        eq(schema.matters.id, schema.matterAssignments.matterId),
        eq(schema.matters.firmId, firmId),
      ),
    )
    .where(inArray(schema.matterAssignments.userId, uniqueUserIds));
  const matterIdsByUserId = new Map<string, string[]>();
  for (const assignment of assignments) {
    const matterIds = matterIdsByUserId.get(assignment.userId) ?? [];
    matterIds.push(assignment.matterId);
    matterIdsByUserId.set(assignment.userId, matterIds);
  }
  return matterIdsByUserId;
}

export async function getDrizzleUser(
  db: OpenPracticeDatabase,
  firmId: string,
  userId: string,
): Promise<User | undefined> {
  const [row] = await db
    .select()
    .from(schema.users)
    .where(and(eq(schema.users.firmId, firmId), eq(schema.users.id, userId)));
  if (!row) return undefined;
  const assignmentsByUserId = await listDrizzleAssignmentMatterIdsByUserId(db, firmId, [userId]);
  return mapUserRow(row, assignmentsByUserId.get(row.id) ?? []);
}

export async function createDrizzleUser(db: OpenPracticeDatabase, user: User): Promise<User> {
  const [row] = await db
    .insert(schema.users)
    .values({
      id: user.id,
      firmId: user.firmId,
      displayName: user.displayName,
      email: user.email,
      role: user.role,
      mfaEnabled: user.mfaEnabled,
      practitionerProfile: user.practitionerProfile,
    })
    .returning();
  return {
    ...user,
    id: row.id,
  };
}

export async function getDrizzleUserByEmail(
  db: OpenPracticeDatabase,
  firmId: string,
  email: string,
): Promise<User | undefined> {
  const normalized = email.trim().toLowerCase();
  const [row] = await db
    .select()
    .from(schema.users)
    .where(and(eq(schema.users.firmId, firmId), eq(schema.users.email, normalized)))
    .limit(1);
  if (!row) return undefined;
  const assignmentsByUserId = await listDrizzleAssignmentMatterIdsByUserId(db, firmId, [row.id]);
  return mapUserRow(row, assignmentsByUserId.get(row.id) ?? []);
}

export async function getDrizzleAuthAccount(
  db: OpenPracticeDatabase,
  firmId: string,
  userId: string,
): Promise<AuthAccountRecord | undefined> {
  const [row] = await db
    .select()
    .from(schema.authAccounts)
    .where(and(eq(schema.authAccounts.firmId, firmId), eq(schema.authAccounts.userId, userId)));
  return row ? mapAuthAccountRow(row) : undefined;
}

export async function setDrizzleAuthPassword(
  db: OpenPracticeDatabase,
  input: {
    firmId: string;
    userId: string;
    passwordHash: string;
    passwordUpdatedAt: string;
  },
): Promise<AuthAccountRecord> {
  const [row] = await db
    .insert(schema.authAccounts)
    .values({
      firmId: input.firmId,
      userId: input.userId,
      passwordHash: input.passwordHash,
      passwordUpdatedAt: new Date(input.passwordUpdatedAt),
    })
    .onConflictDoUpdate({
      target: [schema.authAccounts.firmId, schema.authAccounts.userId],
      set: {
        passwordHash: input.passwordHash,
        passwordUpdatedAt: new Date(input.passwordUpdatedAt),
      },
    })
    .returning();
  return mapAuthAccountRow(row);
}

export async function createDrizzleAuthSession(
  db: OpenPracticeDatabase,
  session: AuthSessionRecord,
): Promise<AuthSessionRecord> {
  await db.insert(schema.authSessions).values({
    ...session,
    createdAt: new Date(session.createdAt),
    expiresAt: new Date(session.expiresAt),
    freshAuthenticatedAt: session.freshAuthenticatedAt
      ? new Date(session.freshAuthenticatedAt)
      : null,
    revokedAt: session.revokedAt ? new Date(session.revokedAt) : null,
    lastSeenAt: session.lastSeenAt ? new Date(session.lastSeenAt) : null,
  });
  return session;
}

export async function getDrizzleAuthSessionByTokenHash(
  db: OpenPracticeDatabase,
  tokenHash: string,
): Promise<AuthSessionRecord | undefined> {
  const [row] = await db
    .select()
    .from(schema.authSessions)
    .where(eq(schema.authSessions.tokenHash, tokenHash));
  return row ? mapAuthSessionRow(row) : undefined;
}

export async function touchDrizzleAuthSession(
  db: OpenPracticeDatabase,
  tokenHash: string,
  seenAt: string,
): Promise<void> {
  await db
    .update(schema.authSessions)
    .set({ lastSeenAt: new Date(seenAt) })
    .where(eq(schema.authSessions.tokenHash, tokenHash));
}

export async function markDrizzleAuthSessionFresh(
  db: OpenPracticeDatabase,
  tokenHash: string,
  freshAuthenticatedAt: string,
): Promise<void> {
  await db
    .update(schema.authSessions)
    .set({ freshAuthenticatedAt: new Date(freshAuthenticatedAt) })
    .where(eq(schema.authSessions.tokenHash, tokenHash));
}

export async function revokeDrizzleAuthSession(
  db: OpenPracticeDatabase,
  tokenHash: string,
  revokedAt: string,
): Promise<void> {
  await db
    .update(schema.authSessions)
    .set({ revokedAt: new Date(revokedAt) })
    .where(eq(schema.authSessions.tokenHash, tokenHash));
}

export async function createDrizzlePasswordSetupToken(
  db: OpenPracticeDatabase,
  token: AuthPasswordSetupTokenRecord,
): Promise<AuthPasswordSetupTokenRecord> {
  await db.insert(schema.authPasswordSetupTokens).values({
    ...token,
    createdByUserId: token.createdByUserId ?? null,
    createdAt: new Date(token.createdAt),
    expiresAt: new Date(token.expiresAt),
    usedAt: token.usedAt ? new Date(token.usedAt) : null,
  });
  return token;
}

export async function consumeDrizzlePasswordSetupToken(
  db: OpenPracticeDatabase,
  tokenHash: string,
  usedAt: string,
): Promise<AuthPasswordSetupTokenRecord | undefined> {
  const [row] = await db
    .select()
    .from(schema.authPasswordSetupTokens)
    .where(eq(schema.authPasswordSetupTokens.tokenHash, tokenHash));
  if (!row || row.usedAt || row.expiresAt <= new Date(usedAt)) return undefined;
  const [updated] = await db
    .update(schema.authPasswordSetupTokens)
    .set({ usedAt: new Date(usedAt) })
    .where(eq(schema.authPasswordSetupTokens.tokenHash, tokenHash))
    .returning();
  return updated ? mapPasswordSetupTokenRow(updated) : undefined;
}

export async function createDrizzleWebAuthnChallenge(
  db: OpenPracticeDatabase,
  challenge: WebAuthnChallengeRecord,
): Promise<WebAuthnChallengeRecord> {
  const [row] = await db
    .insert(schema.authChallenges)
    .values({
      id: challenge.id,
      firmId: challenge.firmId,
      userId: challenge.userId,
      challengeHash: challenge.challengeHash,
      purpose: challenge.purpose,
      expiresAt: new Date(challenge.expiresAt),
      createdAt: new Date(challenge.createdAt),
    })
    .returning();
  return mapAuthChallengeRow(row);
}

export async function getDrizzleWebAuthnChallenge(
  db: OpenPracticeDatabase,
  challengeHash: string,
): Promise<WebAuthnChallengeRecord | undefined> {
  const [row] = await db
    .select()
    .from(schema.authChallenges)
    .where(eq(schema.authChallenges.challengeHash, challengeHash));
  return row ? mapAuthChallengeRow(row) : undefined;
}

export async function consumeDrizzleWebAuthnChallenge(
  db: OpenPracticeDatabase,
  challengeHash: string,
  consumedAt: string,
): Promise<boolean> {
  const [row] = await db
    .update(schema.authChallenges)
    .set({ consumedAt: new Date(consumedAt) })
    .where(
      and(
        eq(schema.authChallenges.challengeHash, challengeHash),
        isNull(schema.authChallenges.consumedAt),
      ),
    )
    .returning();
  return !!row;
}

export async function registerDrizzleWebAuthnCredential(
  db: OpenPracticeDatabase,
  credential: WebAuthnCredentialRecord,
): Promise<WebAuthnCredentialRecord> {
  const [row] = await db
    .insert(schema.webAuthnCredentials)
    .values({
      id: credential.id,
      firmId: credential.firmId,
      userId: credential.userId,
      credentialId: credential.credentialId,
      publicKey: credential.publicKey,
      counter: credential.counter,
      transports: credential.transports,
      deviceType: credential.deviceType,
      backedUp: credential.backedUp,
      createdAt: new Date(credential.createdAt),
    })
    .returning();
  return mapWebAuthnCredentialRow(row);
}

export async function listDrizzleWebAuthnCredentials(
  db: OpenPracticeDatabase,
  firmId: string,
  userId: string,
): Promise<WebAuthnCredentialRecord[]> {
  const rows = await db
    .select()
    .from(schema.webAuthnCredentials)
    .where(
      and(
        eq(schema.webAuthnCredentials.firmId, firmId),
        eq(schema.webAuthnCredentials.userId, userId),
      ),
    );
  return rows.map(mapWebAuthnCredentialRow);
}

export async function getDrizzleWebAuthnCredential(
  db: OpenPracticeDatabase,
  credentialId: string,
): Promise<WebAuthnCredentialRecord | undefined> {
  const [row] = await db
    .select()
    .from(schema.webAuthnCredentials)
    .where(eq(schema.webAuthnCredentials.credentialId, credentialId));
  return row ? mapWebAuthnCredentialRow(row) : undefined;
}

export async function getDrizzleWebAuthnCredentialForFirm(
  db: OpenPracticeDatabase,
  firmId: string,
  credentialId: string,
): Promise<WebAuthnCredentialRecord | undefined> {
  const [row] = await db
    .select()
    .from(schema.webAuthnCredentials)
    .where(
      and(
        eq(schema.webAuthnCredentials.firmId, firmId),
        eq(schema.webAuthnCredentials.credentialId, credentialId),
      ),
    );
  return row ? mapWebAuthnCredentialRow(row) : undefined;
}

export async function updateDrizzleWebAuthnCredentialCounter(
  db: OpenPracticeDatabase,
  id: string,
  counter: number,
): Promise<void> {
  await db
    .update(schema.webAuthnCredentials)
    .set({ counter, lastUsedAt: new Date() })
    .where(eq(schema.webAuthnCredentials.id, id));
}

export async function deleteDrizzleWebAuthnCredential(
  db: OpenPracticeDatabase,
  firmId: string,
  userId: string,
  id: string,
): Promise<void> {
  await db
    .delete(schema.webAuthnCredentials)
    .where(
      and(
        eq(schema.webAuthnCredentials.firmId, firmId),
        eq(schema.webAuthnCredentials.userId, userId),
        eq(schema.webAuthnCredentials.id, id),
      ),
    );
}

export async function updateDrizzleUserMfaStatus(
  db: OpenPracticeDatabase,
  firmId: string,
  userId: string,
  mfaEnabled: boolean,
): Promise<void> {
  await db
    .update(schema.users)
    .set({ mfaEnabled })
    .where(and(eq(schema.users.firmId, firmId), eq(schema.users.id, userId)));
}

export async function createDrizzleRecoveryCodes(
  db: OpenPracticeDatabase,
  firmId: string,
  userId: string,
  codes: RecoveryCodeRecord[],
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .delete(schema.recoveryCodes)
      .where(and(eq(schema.recoveryCodes.firmId, firmId), eq(schema.recoveryCodes.userId, userId)));

    if (codes.length > 0) {
      await tx.insert(schema.recoveryCodes).values(
        codes.map((code) => ({
          id: code.id,
          firmId: code.firmId,
          userId: code.userId,
          codeHash: code.codeHash,
          createdAt: new Date(code.createdAt),
        })),
      );
    }
  });
}

export async function useDrizzleRecoveryCode(
  db: OpenPracticeDatabase,
  firmId: string,
  userId: string,
  codeHash: string,
  consumedAt: string,
): Promise<boolean> {
  const [updated] = await db
    .update(schema.recoveryCodes)
    .set({ usedAt: new Date(consumedAt) })
    .where(
      and(
        eq(schema.recoveryCodes.firmId, firmId),
        eq(schema.recoveryCodes.userId, userId),
        eq(schema.recoveryCodes.codeHash, codeHash),
        isNull(schema.recoveryCodes.usedAt),
      ),
    )
    .returning();
  return !!updated;
}

export async function listDrizzleRecoveryCodes(
  db: OpenPracticeDatabase,
  firmId: string,
  userId: string,
): Promise<RecoveryCodeRecord[]> {
  const rows = await db
    .select()
    .from(schema.recoveryCodes)
    .where(and(eq(schema.recoveryCodes.firmId, firmId), eq(schema.recoveryCodes.userId, userId)));
  return rows.map(mapRecoveryCodeRow);
}

export function createDrizzleAuthRepository(db: OpenPracticeDatabase): AuthRepository {
  return {
    getUser: (firmId, userId) => getDrizzleUser(db, firmId, userId),
    createUser: (user) => createDrizzleUser(db, user),
    getUserByEmail: (firmId, email) => getDrizzleUserByEmail(db, firmId, email),
    getAuthAccount: (firmId, userId) => getDrizzleAuthAccount(db, firmId, userId),
    setAuthPassword: (input) => setDrizzleAuthPassword(db, input),
    createAuthSession: (session) => createDrizzleAuthSession(db, session),
    getAuthSessionByTokenHash: (tokenHash) => getDrizzleAuthSessionByTokenHash(db, tokenHash),
    touchAuthSession: (tokenHash, seenAt) => touchDrizzleAuthSession(db, tokenHash, seenAt),
    markAuthSessionFresh: (tokenHash, freshAuthenticatedAt) =>
      markDrizzleAuthSessionFresh(db, tokenHash, freshAuthenticatedAt),
    revokeAuthSession: (tokenHash, revokedAt) => revokeDrizzleAuthSession(db, tokenHash, revokedAt),
    createPasswordSetupToken: (token) => createDrizzlePasswordSetupToken(db, token),
    consumePasswordSetupToken: (tokenHash, usedAt) =>
      consumeDrizzlePasswordSetupToken(db, tokenHash, usedAt),
    createWebAuthnChallenge: (challenge) => createDrizzleWebAuthnChallenge(db, challenge),
    getWebAuthnChallenge: (challengeHash) => getDrizzleWebAuthnChallenge(db, challengeHash),
    consumeWebAuthnChallenge: (challengeHash, consumedAt) =>
      consumeDrizzleWebAuthnChallenge(db, challengeHash, consumedAt),
    registerWebAuthnCredential: (credential) => registerDrizzleWebAuthnCredential(db, credential),
    listWebAuthnCredentials: (firmId, userId) => listDrizzleWebAuthnCredentials(db, firmId, userId),
    getWebAuthnCredential: (credentialId) => getDrizzleWebAuthnCredential(db, credentialId),
    getWebAuthnCredentialForFirm: (firmId, credentialId) =>
      getDrizzleWebAuthnCredentialForFirm(db, firmId, credentialId),
    updateWebAuthnCredentialCounter: (id, counter) =>
      updateDrizzleWebAuthnCredentialCounter(db, id, counter),
    deleteWebAuthnCredential: (firmId, userId, id) =>
      deleteDrizzleWebAuthnCredential(db, firmId, userId, id),
    updateUserMfaStatus: (firmId, userId, mfaEnabled) =>
      updateDrizzleUserMfaStatus(db, firmId, userId, mfaEnabled),
    createRecoveryCodes: (firmId, userId, codes) =>
      createDrizzleRecoveryCodes(db, firmId, userId, codes),
    useRecoveryCode: (firmId, userId, codeHash, consumedAt) =>
      useDrizzleRecoveryCode(db, firmId, userId, codeHash, consumedAt),
    listRecoveryCodes: (firmId, userId) => listDrizzleRecoveryCodes(db, firmId, userId),
  };
}
