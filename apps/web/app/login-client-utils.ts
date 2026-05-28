export interface LoginFormState {
  email: string;
  password: string;
}

export function canSubmitLogin(state: LoginFormState): boolean {
  return Boolean(state.email.trim() && state.password);
}

export function buildLoginPayload(state: LoginFormState): LoginFormState {
  return {
    email: state.email.trim(),
    password: state.password,
  };
}
