/**
 * Pruebas de LoginForm: validación, autenticación con Clerk simulado,
 * redirección, errores genéricos y aviso de sesión expirada.
 */
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import React from 'react';
import {
  clerkFalso,
  resetClerkFalso,
  simularNavegacion,
} from '../../../../test-setup';
import * as api from '../../../lib/usuarios-api';
import LoginForm from './LoginForm';

let nav: ReturnType<typeof simularNavegacion>;

beforeEach(() => {
  resetClerkFalso();
  nav = simularNavegacion();
});

afterEach(() => {
  cleanup();
  nav.restaurar();
  spyOn(api, 'obtenerPerfil').mockRestore();
});

function llenar(email = 'ana@ejemplo.com', password = 'Secreta123') {
  fireEvent.change(screen.getByLabelText(/Correo electrónico/), {
    target: { value: email },
  });
  fireEvent.change(screen.getByLabelText(/Contraseña/, { selector: 'input' }), {
    target: { value: password },
  });
}

function enviar() {
  fireEvent.submit(
    screen.getByRole('button', { name: /Iniciar sesión/ }).closest('form')!
  );
}

function clerkConResultado(resultado: Record<string, unknown>) {
  const setActive = async () => {};
  clerkFalso.signIn = {
    isLoaded: true,
    signIn: { create: async () => resultado },
    setActive,
  };
}

describe('LoginForm', () => {
  test('envío vacío muestra el resumen de errores', async () => {
    render(<LoginForm />);
    enviar();
    const alerta = await screen.findByRole('alert');
    expect(alerta.textContent).toContain('Hay un problema');
  });

  test('el blur de un campo vacío muestra su error inline', () => {
    render(<LoginForm />);
    const email = screen.getByLabelText(/Correo electrónico/);
    fireEvent.blur(email);
    fireEvent.blur(email);
    expect(email.getAttribute('aria-invalid')).toBe('true');
  });

  test('con Clerk sin cargar el botón está deshabilitado y no envía', () => {
    clerkFalso.signIn = { isLoaded: false };
    render(<LoginForm />);
    llenar();
    expect(
      (
        screen.getByRole('button', {
          name: /Iniciar sesión/,
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true);
    enviar();
    expect(nav.destino()).toBe('');
  });

  test('login completo: crea sesión, valida perfil y va al dashboard', async () => {
    clerkConResultado({ status: 'complete', createdSessionId: 's1' });
    spyOn(api, 'obtenerPerfil').mockResolvedValue({} as never);
    render(<LoginForm />);
    llenar(' ANA@Ejemplo.com ');
    enviar();
    await waitFor(() => expect(nav.destino()).toBe('/dashboard'));
  });

  test('estado distinto de complete informa en vez de quedarse mudo', async () => {
    clerkConResultado({ status: 'needs_second_factor' });
    render(<LoginForm />);
    llenar();
    enviar();
    expect((await screen.findByRole('alert')).textContent).toContain(
      'No se pudo completar el inicio de sesión'
    );
  });

  test('sin token tras iniciar sesión muestra error', async () => {
    clerkConResultado({ status: 'complete', createdSessionId: 's1' });
    clerkFalso.getToken = async () => null;
    render(<LoginForm />);
    llenar();
    enviar();
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Ocurrió un error al iniciar sesión.'
    );
  });

  test('credenciales incorrectas: mensaje genérico', async () => {
    clerkFalso.signIn = {
      isLoaded: true,
      signIn: {
        create: async () => {
          throw { errors: [{ code: 'form_password_incorrect' }] };
        },
      },
      setActive: async () => {},
    };
    render(<LoginForm />);
    llenar();
    enviar();
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Correo o contraseña incorrectos.'
    );
  });

  test('aviso de sesión expirada con ?expirada=1', () => {
    nav.restaurar();
    nav = simularNavegacion('?expirada=1');
    render(<LoginForm />);
    expect(screen.getByRole('alert').textContent).toContain(
      'Tu sesión ha expirado'
    );
  });

  test('si leer la URL falla, no hay aviso', () => {
    nav.restaurar();
    Object.defineProperty(window, 'location', {
      configurable: true,
      get() {
        throw new Error('sin acceso');
      },
    });
    render(<LoginForm />);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  test('el aviso de expirada cede ante un error de login', async () => {
    nav.restaurar();
    nav = simularNavegacion('?expirada=1');
    clerkFalso.signIn = {
      isLoaded: true,
      signIn: {
        create: async () => {
          throw { errors: [{ code: 'form_identifier_not_found' }] };
        },
      },
      setActive: async () => {},
    };
    render(<LoginForm />);
    llenar();
    enviar();
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe(
        'Correo o contraseña incorrectos.'
      )
    );
  });
});
