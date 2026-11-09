import React from 'react';
import MisOfertas from './MisOfertas';

/**
 * Isla de "Mis ofertas" (`/dashboard/ofertas/mias`).
 * Usar con `client:only="react"` para evitar el render en servidor.
 */
export default function MisOfertasIsla() {
  return <MisOfertas />;
}
