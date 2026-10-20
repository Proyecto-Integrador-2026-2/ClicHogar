/**
 * Preload de `bun test` (ver `bunfig.toml`): registra happy-dom como DOM
 * global y sustituye `@clerk/clerk-react` por un doble controlable desde
 * los tests (`clerkFalso`), de modo que los componentes se prueban sin red
 * ni cuenta de Clerk.
 */
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import { mock } from 'bun:test';
import { createElement, type ReactNode } from 'react';

GlobalRegistrator.register({ url: 'http://localhost:4321/' });
(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

type Fn = (...args: never[]) => unknown;

export const clerkFalso: {
  isLoaded: boolean;
  isSignedIn: boolean;
  user: Record<string, unknown> | null;
  getToken: () => Promise<string | null>;
  signIn: Record<string, unknown>;
  signUp: Record<string, unknown>;
} = {
  isLoaded: true,
  isSignedIn: true,
  user: { firstName: 'Ana' },
  getToken: async () => 'token-falso',
  signIn: { isLoaded: true },
  signUp: { isLoaded: true },
};

/** Vuelve el doble de Clerk a su estado inicial (llamar en `beforeEach`). */
export function resetClerkFalso(): void {
  clerkFalso.isLoaded = true;
  clerkFalso.isSignedIn = true;
  clerkFalso.user = { firstName: 'Ana' };
  clerkFalso.getToken = async () => 'token-falso';
  clerkFalso.signIn = { isLoaded: true };
  clerkFalso.signUp = { isLoaded: true };
}

// Referencia estable, igual que el `getToken` real de Clerk: los
// componentes la usan como dependencia de efectos.
const getTokenEstable = (...args: unknown[]) =>
  (clerkFalso.getToken as Fn)(...(args as never[]));

mock.module('@clerk/clerk-react', () => ({
  ClerkProvider: ({
    publishableKey,
    children,
  }: {
    publishableKey: string;
    children: ReactNode;
  }) =>
    createElement(
      'div',
      { 'data-testid': 'clerk-provider', 'data-key': publishableKey },
      children
    ),
  useAuth: () => ({
    getToken: getTokenEstable,
    isLoaded: clerkFalso.isLoaded,
    isSignedIn: clerkFalso.isSignedIn,
  }),
  useUser: () => ({
    isLoaded: clerkFalso.isLoaded,
    isSignedIn: clerkFalso.isSignedIn,
    user: clerkFalso.user,
  }),
  useSignIn: () => clerkFalso.signIn,
  useSignUp: () => clerkFalso.signUp,
}));

/**
 * Sustituye `window.location` por un objeto simple para capturar
 * redirecciones (`location.href = ...`). Devuelve el destino capturado y
 * cómo restaurar el original. `search` simula el query string de la página.
 */
export function simularNavegacion(search = '') {
  const original = Object.getOwnPropertyDescriptor(window, 'location');
  let destino = '';
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      search,
      set href(valor: string) {
        destino = valor;
      },
      get href() {
        return destino;
      },
    },
  });
  return {
    destino: () => destino,
    restaurar: () => {
      if (original) Object.defineProperty(window, 'location', original);
    },
  };
}
