/**
 * Pruebas de las islas: cada una monta su formulario o panel. La red se
 * simula con un `fetch` que nunca responde, así que solo se verifica el
 * cableado (qué contenido aparece).
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { cleanup, render } from '@testing-library/react';
import React from 'react';
import { resetSesion } from '../../../../test-setup';
import CalificacionIsla from './CalificacionIsla';
import ChatIsla from './ChatIsla';
import DashboardIsla from './DashboardIsla';
import DetalleTareaIsla from './DetalleTareaIsla';
import DisponibilidadIsla from './DisponibilidadIsla';
import LoginIsla from './LoginIsla';
import MisSolicitudesIsla from './MisSolicitudesIsla';
import PerfilIsla from './PerfilIsla';
import PerfilPublicoIsla from './PerfilPublicoIsla';
import RegisterIsla from './RegisterIsla';
import TableroIsla from './TableroIsla';
import TareaIsla from './TareaIsla';

const fetchOriginal = globalThis.fetch;

beforeEach(() => {
  resetSesion();
  globalThis.fetch = (() =>
    new Promise<Response>(() => {})) as unknown as typeof fetch;
});

afterEach(() => {
  cleanup();
  globalThis.fetch = fetchOriginal;
});

describe('islas', () => {
  const islas = {
    CalificacionIsla,
    ChatIsla,
    DashboardIsla,
    DetalleTareaIsla,
    DisponibilidadIsla,
    LoginIsla,
    MisSolicitudesIsla,
    PerfilIsla,
    PerfilPublicoIsla,
    RegisterIsla,
    TableroIsla,
    TareaIsla,
  };

  for (const [nombre, Isla] of Object.entries(islas)) {
    test(`${nombre} se monta y renderiza contenido`, () => {
      // Given: cada una de las islas (el test se repite por isla)
      // When: se renderiza
      const { container } = render(<Isla />);
      // Then: monta su contenido
      expect(container.firstElementChild).not.toBeNull();
    });
  }
});
