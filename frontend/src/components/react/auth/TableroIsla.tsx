import React from 'react';
import ClerkRoot from './ClerkRoot';
import TableroTareas from './TableroTareas';

/**
 * Isla del tablero de tareas (US-008): provider Clerk + listado.
 * Usar con `client:only="react"` para evitar el render en servidor.
 */
export default function TableroIsla({
  publishableKey,
}: {
  publishableKey: string;
}) {
  return (
    <ClerkRoot publishableKey={publishableKey}>
      <TableroTareas />
    </ClerkRoot>
  );
}
