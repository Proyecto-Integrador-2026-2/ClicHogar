import React from 'react';
import { useUser } from '@clerk/clerk-react';
import ClerkRoot from './ClerkRoot';
import LogoutButton from './LogoutButton';

/**
 * Ranura de autenticación del menú (US-003, #127): con sesión muestra
 * `LogoutButton`; sin sesión, el enlace a la página auth contraria.
 * Vive dentro de `ClerkRoot` porque los hooks exigen el provider en el
 * mismo árbol React (ver ClerkRoot.tsx).
 */
function AuthSlot({
  signedOutHref,
  signedOutLabel,
}: {
  signedOutHref: string;
  signedOutLabel: string;
}) {
  const { isSignedIn, isLoaded } = useUser();
  if (!isLoaded) return null;
  if (isSignedIn) return <LogoutButton />;
  return (
    <a className="ch-nav__link" href={signedOutHref}>
      {signedOutLabel}
    </a>
  );
}

/**
 * Isla para `SiteNav.astro`: las props son solo strings (serializables).
 * Usar con `client:only="react"`.
 */
export default function NavAuthIsla({
  publishableKey,
  signedOutHref,
  signedOutLabel,
}: {
  publishableKey: string;
  signedOutHref: string;
  signedOutLabel: string;
}) {
  return (
    <ClerkRoot publishableKey={publishableKey}>
      <AuthSlot signedOutHref={signedOutHref} signedOutLabel={signedOutLabel} />
    </ClerkRoot>
  );
}
