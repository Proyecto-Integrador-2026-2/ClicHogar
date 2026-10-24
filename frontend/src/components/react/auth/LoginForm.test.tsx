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
    // Given: un formulario de login vacío
    render(<LoginForm />);
    // When: se envía
    enviar();
    const alerta = await screen.findByRole('alert');
    // Then: muestra el resumen de errores
    expect(alerta.textContent).toContain('Hay un problema');
  });

  test('el blur de un campo vacío muestra su error inline', () => {
    // Given: un formulario de login vacío
    render(<LoginForm />);
    const email = screen.getByLabelText(/Correo electrónico/);
    // When: se pierde el foco del correo
    fireEvent.blur(email);
    fireEvent.blur(email);
    // Then: el campo muestra su error inline
    expect(email.getAttribute('aria-invalid')).toBe('true');
  });

  test('con Clerk sin cargar el botón está deshabilitado y no envía', () => {
    // Given: un Clerk que aún no cargó
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
    // When: se llenan los campos y se intenta enviar
    enviar();
    // Then: el botón estaba deshabilitado y no hay redirección
    expect(nav.destino()).toBe('');
  });

  test('login completo: crea sesión, valida perfil y va al dashboard', async () => {
    // Given: un Clerk que completa el inicio de sesión y un perfil existente
    clerkConResultado({ status: 'complete', createdSessionId: 's1' });
    spyOn(api, 'obtenerPerfil').mockResolvedValue({} as never);
    render(<LoginForm />);
    llenar(' ANA@Ejemplo.com ');
    // When: se llena el formulario con un correo en mayúsculas y se envía
    enviar();
    // Then: redirige al dashboard
    await waitFor(() => expect(nav.destino()).toBe('/dashboard'));
  });

  test('estado distinto de complete informa en vez de quedarse mudo', async () => {
    // Given: un Clerk que pide un segundo factor
    clerkConResultado({ status: 'needs_second_factor' });
    render(<LoginForm />);
    llenar();
    // When: se llena el formulario y se envía
    enviar();
    // Then: informa en vez de quedarse mudo
    expect((await screen.findByRole('alert')).textContent).toContain(
      'No se pudo completar el inicio de sesión'
    );
  });

  test('sin token tras iniciar sesión muestra error', async () => {
    clerkConResultado({ status: 'complete', createdSessionId: 's1' });
    // Given: un login completo pero sin token de sesión
    clerkFalso.getToken = async () => null;
    render(<LoginForm />);
    llenar();
    // When: se llena el formulario y se envía
    enviar();
    // Then: muestra el error genérico
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Ocurrió un error al iniciar sesión.'
    );
  });

  test('credenciales incorrectas: mensaje genérico', async () => {
    // Given: un Clerk que rechaza con form_password_incorrect
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
    // When: se llena el formulario y se envía
    enviar();
    // Then: muestra un mensaje que no revela qué dato falló
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Correo o contraseña incorrectos.'
    );
  });

  test('aviso de sesión expirada con ?expirada=1', () => {
    nav.restaurar();
    // Given: una URL con ?expirada=1
    nav = simularNavegacion('?expirada=1');
    // When: se renderiza el formulario
    render(<LoginForm />);
    // Then: muestra el aviso de sesión expirada
    expect(screen.getByRole('alert').textContent).toContain(
      'Tu sesión ha expirado'
    );
  });

  test('si leer la URL falla, no hay aviso', () => {
    nav.restaurar();
    // Given: una página cuya URL no se puede leer
    Object.defineProperty(window, 'location', {
      configurable: true,
      get() {
        throw new Error('sin acceso');
      },
    });
    // When: se renderiza el formulario
    render(<LoginForm />);
    // Then: no muestra ningún aviso
    expect(screen.queryByRole('alert')).toBeNull();
  });

  test('el aviso de expirada cede ante un error de login', async () => {
    nav.restaurar();
    // Given: una URL con ?expirada=1 y un Clerk que rechaza el login
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
    // When: se llena el formulario y se envía
    enviar();
    // Then: el error de credenciales reemplaza el aviso de sesión expirada
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe(
        'Correo o contraseña incorrectos.'
      )
    );
  });
});
