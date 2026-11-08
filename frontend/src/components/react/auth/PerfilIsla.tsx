import React from 'react';
import PerfilForm from './PerfilForm';

/**
 * Isla de perfil público (US-004): provider Clerk + formulario.
 * Usar con `client:only="react"` para evitar el render en servidor.
 */
export default function PerfilIsla() {
  return (      <PerfilForm />
  );
}
