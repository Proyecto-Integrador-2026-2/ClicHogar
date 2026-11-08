import React from 'react';
import DashboardPanel from './DashboardPanel';

/**
 * Isla del panel principal (dashboard): resumen.
 * Usar con `client:only="react"` para evitar el render en servidor.
 */
export default function DashboardIsla() {
  return <DashboardPanel />;
}
