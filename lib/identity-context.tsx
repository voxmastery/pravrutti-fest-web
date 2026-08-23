"use client";

import { createContext, useContext } from "react";

export type Identity = {
  ready: boolean;
  /** A sign-in mechanism is configured; the email fallback is off. */
  authEnabled: boolean;
  signedIn: boolean;
  name: string | null;
  email: string | null;
  image: string | null;
  signIn: () => void;
  signOut: () => void;
};

export const EMPTY_IDENTITY: Identity = {
  ready: false,
  authEnabled: false,
  signedIn: false,
  name: null,
  email: null,
  image: null,
  signIn: () => {},
  signOut: () => {},
};

export const IdentityContext = createContext<Identity>(EMPTY_IDENTITY);

/**
 * One hook for the whole app, regardless of which auth backend is live.
 * Components never import Clerk or NextAuth directly, so swapping backends
 * touches only the providers below.
 */
export const useIdentity = () => useContext(IdentityContext);
