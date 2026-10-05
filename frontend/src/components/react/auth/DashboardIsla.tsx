import React from 'react';
import ClerkRoot from './ClerkRoot';
import DashboardPanel from './DashboardPanel';

/**
 * Isla del panel principal (dashboard): provider Clerk + resumen.
 * Usar con `client:only="react"` para evitar el render en servidor.
 */
export default function DashboardIsla({
  publishableKey,
}: {
  publishableKey: string;
}) {
  return (
    <ClerkRoot publishableKey={publishableKey}>
      <DashboardPanel />
    </ClerkRoot>
  );
}
