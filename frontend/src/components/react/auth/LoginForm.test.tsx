/**
 * Pruebas de LoginForm: validación, inicio de sesión contra el backend
 * (simulado), guardado del token, redirección, errores y aviso de sesión
 * expirada.
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
import { resetSesion, simularNavegacion } from '../../../../test-setup';
import * as api from '../../../lib/usuarios-api';
import LoginForm from './LoginForm';

let nav: ReturnType<typeof simularNavegacion>;

const RESPUESTA: api.RespuestaAuth = {
  token: 'token-nuevo',
  usuario: { id: 'u1', rol: 'cliente' } as api.UsuarioPublico,
};

beforeEach(() => {
  localStorage.removeItem('ch-token');
  nav = simularNavegacion();
});

afterEach(() => {
  cleanup();
  nav.restaurar();
  spyOn(api, 'iniciarSesion').mockRestore();
  resetSesion();
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

describe('LoginForm', () => {
  test('ofrece el enlace "¿Olvidaste tu contraseña?"', () => {
    // Given / When: el formulario de login
    render(<LoginForm />);
    // Then: enlaza a la página de recuperación
    expect(
      screen
        .getByRole('link', { name: '¿Olvidaste tu contraseña?' })
        .getAttribute('href')
    ).toBe('/olvide-contrasena');
  });

  test('envío vacío muestra el resumen de errores y no llama al backend', async () => {
    // Given: un formulario de login vacío
    const login = spyOn(api, 'iniciarSesion');
    render(<LoginForm />);
    // When: se envía
    enviar();
    const alerta = await screen.findByRole('alert');
    // Then: muestra el resumen de errores sin pedir nada
    expect(alerta.textContent).toContain('Hay un problema');
    // (el foco al resumen corre en el siguiente frame)
    await new Promise((r) => setTimeout(r, 30));
    expect(login).not.toHaveBeenCalled();
  });

  test('el blur de un campo vacío muestra su error inline', () => {
    // Given: un formulario de login vacío
    render(<LoginForm />);
    const email = screen.getByLabelText(/Correo electrónico/);
    // When: se pierde el foco del correo (dos veces: la segunda no repite)
    fireEvent.blur(email);
    fireEvent.blur(email);
    // Then: el campo muestra su error inline
    expect(email.getAttribute('aria-invalid')).toBe('true');
  });

  test('login correcto: guarda el token, sanea el correo y va al dashboard', async () => {
    // Given: un backend que acepta las credenciales
    const login = spyOn(api, 'iniciarSesion').mockResolvedValue(RESPUESTA);
    render(<LoginForm />);
    // When: se llena con un correo en mayúsculas con espacios y se envía
    llenar(' ANA@Ejemplo.com ');
    enviar();
    // Then: redirige al dashboard con el token guardado y el correo saneado
    await waitFor(() => expect(nav.destino()).toBe('/dashboard'));
    expect(localStorage.getItem('ch-token')).toBe('token-nuevo');
    expect(login).toHaveBeenCalledWith({
      email: 'ana@ejemplo.com',
      password: 'Secreta123',
    });
    expect(screen.getByText('Abriendo tu panel…')).toBeTruthy();
  });

  test('credenciales incorrectas: muestra el mensaje del backend', async () => {
    // Given: un backend que rechaza las credenciales
    spyOn(api, 'iniciarSesion').mockRejectedValue(
      new Error('Credenciales inválidas.')
    );
    render(<LoginForm />);
    llenar();
    // When: se envía
    enviar();
    // Then: muestra el mensaje y no guarda token ni redirige
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Credenciales inválidas.'
    );
    expect(localStorage.getItem('ch-token')).toBeNull();
    expect(nav.destino()).toBe('');
  });

  test('un error que no es Error usa el mensaje genérico', async () => {
    // Given: un backend que rechaza con un valor que no es Error
    spyOn(api, 'iniciarSesion').mockRejectedValue('boom');
    render(<LoginForm />);
    llenar();
    // When: se envía
    enviar();
    // Then: muestra el mensaje genérico
    expect((await screen.findByRole('alert')).textContent).toBe(
      'No se pudo iniciar sesión.'
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
    // Given: una URL con ?expirada=1 y un backend que rechaza el login
    nav = simularNavegacion('?expirada=1');
    spyOn(api, 'iniciarSesion').mockRejectedValue(
      new Error('Credenciales inválidas.')
    );
    render(<LoginForm />);
    llenar();
    // When: se envía
    enviar();
    // Then: el error de credenciales reemplaza el aviso
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe(
        'Credenciales inválidas.'
      )
    );
  });
});
