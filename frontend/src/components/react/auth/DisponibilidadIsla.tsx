import React from 'react';
import DisponibilidadForm from './DisponibilidadForm';

/**
 * Isla de disponibilidad semanal (US-005): formulario.
 * Usar con `client:only="react"` para evitar el render en servidor.
 */
export default function DisponibilidadIsla() {
  return <DisponibilidadForm />;
}
