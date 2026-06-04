import { randomUUID } from "node:crypto";
import type { AuthSessionRecord, OpenPracticeRepository } from "@open-practice/database";
import type { Firm, User } from "@open-practice/domain";
import {
  createSessionToken,
  hashPassword,
  hashToken,
  verifyPassword,
} from "../http/auth-helpers.js";

export interface AuthSessionResult {
  user: User;
  session: Pick<AuthSessionRecord, "id" | "expiresAt">;
  token: string;
}

export interface EmbeddedAuthServiceOptions {
  repository: OpenPracticeRepository;
  jwtSecret?: string;
  sessionTtlHours?: number;
}

function statusError(message: string, statusCode: number): Error {
  return Object.assign(new Error(message), { statusCode });
}

function invalidCredentials(): Error {
  return statusError("Invalid email or password", 401);
}

function invalidPasswordSetupToken(): Error {
  return statusError("Password setup token is invalid or expired", 401);
}

function invalidRecoveryCode(): Error {
  return statusError("Invalid recovery code", 401);
}

export function recoveryCodeHash(code: string, secret: string): string {
  return hashToken(`recovery-code:${code}`, secret);
}

export class EmbeddedAuthService {
  constructor(private readonly options: EmbeddedAuthServiceOptions) {}

  private requireJwtSecret(message: string): string {
    if (!this.options.jwtSecret) {
      throw statusError(message, 503);
    }
    return this.options.jwtSecret;
  }

  async resolveConfiguredFirm(): Promise<Firm> {
    const resolution = await this.options.repository.resolveConfiguredFirm();
    if (resolution.status === "ready") {
      return resolution.firm;
    }
    if (resolution.status === "setup_required") {
      throw statusError("First-run setup is required before sign in.", 409);
    }
    throw statusError(resolution.reason || "Practice configuration requires operator review.", 409);
  }

  async getSingleTenantUserByEmail(email: string): Promise<User | undefined> {
    const firm = await this.resolveConfiguredFirm();
    return this.options.repository.getUserByEmail(firm.id, email);
  }

  async createSession(user: User, now = new Date()): Promise<AuthSessionResult> {
    const secret = this.requireJwtSecret("Session authentication is not configured");
    const token = createSessionToken();
    const expiresAt = new Date(
      now.getTime() + (this.options.sessionTtlHours ?? 12) * 60 * 60 * 1000,
    ).toISOString();
    const session = await this.options.repository.createAuthSession({
      id: randomUUID(),
      firmId: user.firmId,
      userId: user.id,
      tokenHash: hashToken(token, secret),
      createdAt: now.toISOString(),
      expiresAt,
      freshAuthenticatedAt: now.toISOString(),
    });
    return { user, session: { id: session.id, expiresAt: session.expiresAt }, token };
  }

  async loginWithPassword(input: {
    email: string;
    password: string;
  }): Promise<AuthSessionResult | { status: "mfa_required"; mfaOptions: { webauthn: true } }> {
    this.requireJwtSecret("Session authentication is not configured");
    const user = await this.getSingleTenantUserByEmail(input.email);
    const account = user
      ? await this.options.repository.getAuthAccount(user.firmId, user.id)
      : undefined;
    if (!user || !account || !verifyPassword(input.password, account.passwordHash)) {
      throw invalidCredentials();
    }
    if (user.mfaEnabled) {
      return { status: "mfa_required", mfaOptions: { webauthn: true } };
    }
    return this.createSession(user);
  }

  async completePasswordSetup(input: {
    userId: string;
    token: string;
    password: string;
  }): Promise<{ user: User }> {
    const secret = this.requireJwtSecret("Password setup is not configured");
    const firm = await this.resolveConfiguredFirm();
    const now = new Date().toISOString();
    const token = await this.options.repository.consumePasswordSetupToken(
      hashToken(input.token, secret),
      now,
    );
    if (!token || token.firmId !== firm.id || token.userId !== input.userId) {
      throw invalidPasswordSetupToken();
    }
    const user = await this.options.repository.getUser(token.firmId, token.userId);
    if (!user) throw statusError("User was not found", 404);
    await this.options.repository.setAuthPassword({
      firmId: token.firmId,
      userId: token.userId,
      passwordHash: hashPassword(input.password),
      passwordUpdatedAt: now,
    });
    return { user };
  }

  async verifyRecoveryCode(input: { email: string; code: string }): Promise<AuthSessionResult> {
    const secret = this.requireJwtSecret("Session authentication is not configured");
    const user = await this.getSingleTenantUserByEmail(input.email);
    if (!user) throw invalidRecoveryCode();

    const recoveryCodes = await this.options.repository.listRecoveryCodes(user.firmId, user.id);
    const newCodeHash = recoveryCodeHash(input.code, secret);
    const validCode = recoveryCodes.find((code) => {
      if (code.usedAt) return false;
      if (code.codeHash === newCodeHash) return true;
      return code.codeHash.startsWith("pbkdf2:") && verifyPassword(input.code, code.codeHash);
    });

    if (!validCode) throw invalidRecoveryCode();

    await this.options.repository.useRecoveryCode(
      user.firmId,
      user.id,
      validCode.codeHash,
      new Date().toISOString(),
    );

    return this.createSession(user);
  }
}

export function createEmbeddedAuthService(
  options: EmbeddedAuthServiceOptions,
): EmbeddedAuthService {
  return new EmbeddedAuthService(options);
}
