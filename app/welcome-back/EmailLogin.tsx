"use client";

import { useActionState } from "react";
import { loginWithEmailAndPin, type LoginState } from "./actions";

const initialState: LoginState = {};

export function EmailLogin() {
  const [state, action, pending] = useActionState(
    loginWithEmailAndPin,
    initialState,
  );

  return (
    <form action={action} className="email-login-form">
      {state.error && <p role="alert">{state.error}</p>}
      <label htmlFor="account-email">Email</label>
      <input
        id="account-email"
        name="email"
        type="email"
        required
        autoComplete="email"
        placeholder="you@example.com"
      />
      <label htmlFor="account-pin">PIN</label>
      <input
        id="account-pin"
        name="pin"
        type="password"
        inputMode="numeric"
        pattern="[0-9]{4,8}"
        minLength={4}
        maxLength={8}
        required
        autoComplete="current-password"
      />
      <button type="submit" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
