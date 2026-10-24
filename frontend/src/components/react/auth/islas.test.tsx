/**
 * Pruebas de ClerkRoot y de las islas (provider + formulario/panel):
 * verifican el cableado con una clave y el mensaje sin ella.
 */
import { afterEach, describe, expect, test } from 'bun:test';
import { cleanup, render, screen } from '@testing-library/react';
import React from 'react';
import ClerkRoot from './ClerkRoot';
import DashboardIsla from './DashboardIsla';
import DisponibilidadIsla from './DisponibilidadIsla';
import LoginIsla from './LoginIsla';
import PerfilIsla from './PerfilIsla';
import RegisterIsla from './RegisterIsla';
import TableroIsla from './TableroIsla';
import TareaIsla from './TareaIsla';

afterEach(cleanup);

describe('ClerkRoot', () => {
  test('sin clave muestra la alerta de configuración', () => {
    // Given: un ClerkRoot sin publishableKey
    // When: se renderiza
    render(
      <ClerkRoot publishableKey="">
        <p>hijo</p>
      </ClerkRoot>
    );
    // Then: muestra la alerta de configuración y no los hijos
    expect(screen.getByRole('alert').textContent).toContain(
      'PUBLIC_CLERK_PUBLISHABLE_KEY'
    );
    expect(screen.queryByText('hijo')).toBeNull();
  });

  test('con clave envuelve a los hijos en el provider', () => {
    // Given: un ClerkRoot con una clave
    // When: se renderiza
    render(
      <ClerkRoot publishableKey="pk_test_1">
        <p>hijo</p>
      </ClerkRoot>
    );
    // Then: envuelve a los hijos en el provider
    expect(screen.getByTestId('clerk-provider').dataset.key).toBe('pk_test_1');
    expect(screen.getByText('hijo')).toBeTruthy();
  });
});

describe('islas', () => {
  const islas = {
    DashboardIsla,
    DisponibilidadIsla,
    LoginIsla,
    PerfilIsla,
    RegisterIsla,
    TableroIsla,
    TareaIsla,
  };

  for (const [nombre, Isla] of Object.entries(islas)) {
    test(`${nombre} pasa la clave al provider`, () => {
      // Given: cada una de las siete islas (el test se repite por isla)
      // When: se renderiza con una clave
      render(<Isla publishableKey="pk_test_2" />);
      // Then: pasa la clave al provider
      expect(screen.getByTestId('clerk-provider').dataset.key).toBe(
        'pk_test_2'
      );
    });
  }
});
