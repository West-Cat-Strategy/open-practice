export interface PasswordSetupState {
  userId: string;
  token: string;
  password: string;
  passwordConfirmation: string;
}

export interface PasswordSetupPayload {
  userId: string;
  token: string;
  password: string;
}

export function buildPasswordSetupPayload(
  state: Pick<PasswordSetupState, "userId" | "token" | "password">,
): PasswordSetupPayload {
  return {
    userId: state.userId.trim(),
    token: state.token.trim(),
    password: state.password,
  };
}

export function passwordSetupErrors(state: PasswordSetupState): string[] {
  const errors: string[] = [];
  if (!state.userId.trim()) errors.push("User is missing.");
  if (state.token.trim().length < 32) errors.push("Setup token is missing.");
  if (state.password.length < 8) errors.push("Password must be at least 8 characters.");
  if (state.password !== state.passwordConfirmation) errors.push("Passwords must match.");
  return errors;
}

export function canSubmitPasswordSetup(state: PasswordSetupState): boolean {
  return passwordSetupErrors(state).length === 0;
}
