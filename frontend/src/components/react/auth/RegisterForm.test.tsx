/**
 * Pruebas de RegisterForm: validación, alta contra el backend (simulado),
 * guardado del token y redirección según el rol.
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
import RegisterForm from './RegisterForm';

let nav: ReturnType<typeof simularNavegacion>;

const respuesta = (rol: api.RolBackend): api.RespuestaAuth => ({
  token: 'token-nuevo',
  usuario: { id: 'u1', rol } as api.UsuarioPublico,
});

beforeEach(() => {
  localStorage.removeItem('ch-token');
  nav = simularNavegacion();
});

afterEach(() => {
  cleanup();
  nav.restaurar();
  spyOn(api, 'registrar').mockRestore();
  resetSesion();
});

function llenar(rol = 'Afiliado') {
  const campo = (re: RegExp, valor: string) =>
    fireEvent.change(screen.getByLabelText(re, { selector: 'input' }), {
      target: { value: valor },
    });
  campo(/Nombre completo/, 'Ana Pérez');
  fireEvent.change(screen.getByLabelText(/¿Cómo quieres usar/), {
    target: { value: rol },
  });
  campo(/Correo electrónico/, 'ana@ejemplo.com');
  campo(/^Contraseña/, 'Secreta123');
  campo(/Confirmar contraseña/, 'Secreta123');
  fireEvent.click(screen.getByLabelText(/Acepto los Términos/));
}

function enviar() {
  fireEvent.submit(
    screen.getByRole('button', { name: /Crear cuenta/ }).closest('form')!
  );
}

describe('RegisterForm', () => {
  test('envío vacío muestra el resumen de errores y blur marca campos', async () => {
    // Given: un formulario de registro vacío
    const registrar = spyOn(api, 'registrar');
    render(<RegisterForm />);
    const nombre = screen.getByLabelText(/Nombre completo/);
    // When: se pierde el foco del nombre (dos veces) y se envía
    fireEvent.blur(nombre);
    fireEvent.blur(nombre);
    enviar();
    // Then: muestra el resumen de errores sin llamar al backend
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Hay un problema con tu registro'
    );
    expect(registrar).not.toHaveBeenCalled();
    // (el foco al resumen corre en el siguiente frame)
    await new Promise((r) => setTimeout(r, 30));
  });

  test('un rol inválido se normaliza a vacío', () => {
    // Given: un formulario de registro
    render(<RegisterForm />);
    const rol = screen.getByLabelText(
      /¿Cómo quieres usar/
    ) as HTMLSelectElement;
    // When: se elige el rol 'Afiliado'
    fireEvent.change(rol, { target: { value: 'Afiliado' } });
    // Then: el rol queda seleccionado
    expect(rol.value).toBe('Afiliado');
    // When: se fuerza un valor desconocido
    fireEvent.change(rol, { target: { value: 'Otro' } });
    // Then: vuelve a vacío
    expect(rol.value).toBe('');
  });

  test('afiliado: registra, guarda el token y va a configurar el perfil', async () => {
    // Given: un backend que crea la cuenta de un afiliado
    const registrar = spyOn(api, 'registrar').mockResolvedValue(
      respuesta('afiliado')
    );
    render(<RegisterForm />);
    llenar('Afiliado');
    // When: se envía
    enviar();
    // Then: guarda el token y redirige a configurar el perfil
    await waitFor(() => expect(nav.destino()).toBe('/perfil/configurar'));
    expect(localStorage.getItem('ch-token')).toBe('token-nuevo');
    expect(registrar).toHaveBeenCalledWith({
      nombre: 'Ana Pérez',
      email: 'ana@ejemplo.com',
      password: 'Secreta123',
      rol: 'Afiliado',
    });
  });

  test('usuario: registra y va al dashboard', async () => {
    // Given: un backend que crea la cuenta de un cliente
    spyOn(api, 'registrar').mockResolvedValue(respuesta('cliente'));
    render(<RegisterForm />);
    llenar('Usuario');
    // When: se envía
    enviar();
    // Then: redirige al dashboard
    await waitFor(() => expect(nav.destino()).toBe('/dashboard'));
  });

  test('error del backend: muestra su mensaje; otro valor, el genérico', async () => {
    // Given: un backend que rechaza por correo repetido
    const registrar = spyOn(api, 'registrar').mockRejectedValue(
      new Error('Ya existe una cuenta con ese email.')
    );
    const { unmount } = render(<RegisterForm />);
    llenar();
    // When: se envía
    enviar();
    // Then: muestra el mensaje del backend y no guarda token
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Ya existe una cuenta con ese email.'
    );
    expect(localStorage.getItem('ch-token')).toBeNull();
    unmount();

    // Given: ahora un rechazo que no es Error
    registrar.mockRejectedValue('boom');
    render(<RegisterForm />);
    llenar();
    // When: se envía
    enviar();
    // Then: muestra el mensaje genérico
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Ocurrió un error en el registro.'
    );
  });

  test('mientras registra deshabilita el formulario y avisa', async () => {
    // Given: un backend que tarda en responder
    spyOn(api, 'registrar').mockReturnValue(new Promise(() => {}));
    render(<RegisterForm />);
    llenar();
    // When: se envía
    enviar();
    // Then: el botón cambia de texto y se informa el estado
    expect(await screen.findByText('Creando tu cuenta...')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('Contactando');
  });
});
