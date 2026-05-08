import type { FastifyInstance } from "fastify";
import type { OpenPracticeRepository } from "@open-practice/database";
import type { User } from "@open-practice/domain";
import { requireAccess } from "../http/auth-guards.js";

interface RegisterAuthExtensionRouteOptions {
  repository: OpenPracticeRepository;
  jwtSecret?: string;
  webAuthn?: {
    rpID: string;
    origin: string;
  };
}

interface BuildAuthExtensionStatusOptions extends RegisterAuthExtensionRouteOptions {
  firmId: string;
  user: User;
}

function statusReason(status: string, reason?: string): { status: string; reason?: string } {
  return reason ? { status, reason } : { status };
}

export async function buildAuthExtensionStatus(options: BuildAuthExtensionStatusOptions) {
  const [account, credentials, recoveryCodes, currentUser] = await Promise.all([
    options.repository.getAuthAccount(options.firmId, options.user.id),
    options.repository.listWebAuthnCredentials(options.firmId, options.user.id),
    options.repository.listRecoveryCodes(options.firmId, options.user.id),
    options.repository.getUser(options.firmId, options.user.id),
  ]);

  const user = currentUser ?? options.user;
  const activePasskeyCount = credentials.filter((credential) => !credential.disabledAt).length;
  const disabledPasskeyCount = credentials.length - activePasskeyCount;
  const unusedRecoveryCodeCount = recoveryCodes.filter((code) => !code.usedAt).length;
  const webAuthnConfigured = Boolean(options.webAuthn?.rpID && options.webAuthn.origin);
  const sessionConfigured = Boolean(options.jwtSecret);
  const localPasswordStatus = account ? "configured" : "not_configured";
  const embeddedAuthStatus = !sessionConfigured
    ? statusReason("disabled", "session_auth_not_configured")
    : account
      ? statusReason("enabled")
      : statusReason("needs_password_setup", "local_password_not_configured");
  const passkeyStatus = !webAuthnConfigured
    ? statusReason("disabled", "webauthn_not_configured")
    : activePasskeyCount > 0
      ? statusReason("configured")
      : statusReason("available", "no_registered_passkeys");
  const mfaStatus = user.mfaEnabled
    ? activePasskeyCount > 0
      ? statusReason("enabled")
      : statusReason("misconfigured", "mfa_enabled_without_active_passkey")
    : activePasskeyCount > 0
      ? statusReason("available")
      : statusReason("not_configured", "no_registered_passkeys");
  const recoveryStatus =
    unusedRecoveryCodeCount > 0
      ? statusReason("configured")
      : recoveryCodes.length > 0
        ? statusReason("depleted", "no_unused_recovery_codes")
        : statusReason("not_configured", "no_recovery_codes");

  return {
    embeddedAuth: {
      ...embeddedAuthStatus,
      session: sessionConfigured ? "configured" : "not_configured",
    },
    localPassword: {
      status: localPasswordStatus,
      updatedAt: account?.passwordUpdatedAt,
    },
    passwordSetup: sessionConfigured
      ? { status: "available" }
      : { status: "disabled", reason: "session_auth_not_configured" },
    passkeys: {
      ...passkeyStatus,
      registeredCount: credentials.length,
      activeCount: activePasskeyCount,
      disabledCount: disabledPasskeyCount,
    },
    recoveryCodes: {
      ...recoveryStatus,
      totalCount: recoveryCodes.length,
      unusedCount: unusedRecoveryCodeCount,
      usedCount: recoveryCodes.length - unusedRecoveryCodeCount,
    },
    oidc: {
      status: "deprecated",
      reason: "embedded_auth_is_current_runtime",
    },
    saml: {
      status: "deprecated",
      reason: "embedded_auth_is_current_runtime",
    },
    mfaPolicy: {
      ...mfaStatus,
      requiredForCurrentUser: user.mfaEnabled,
    },
  };
}

export function registerAuthExtensionRoutes(
  server: FastifyInstance,
  options: RegisterAuthExtensionRouteOptions,
): void {
  server.get("/api/auth/extensions", async (request) => {
    const access = requireAccess(request.auth, { resource: "firm", action: "read" });
    if (!access.ok) throw access.error;

    return buildAuthExtensionStatus({
      ...options,
      firmId: request.auth.firmId,
      user: request.auth.user,
    });
  });
}
