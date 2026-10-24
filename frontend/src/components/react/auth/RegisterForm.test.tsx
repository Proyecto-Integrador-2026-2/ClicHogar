/**
 * Pruebas de RegisterForm: validación, alta en Clerk simulado, verificación
 * por código y sincronización del perfil con el backend.
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
import RegisterForm from './RegisterForm';

let nav: ReturnType<typeof simularNavegacion>;

type Llamadas = { creado?: unknown; preparado?: unknown };
let llamadas: Llamadas;

beforeEach(() => {
  resetClerkFalso();
  nav = simularNavegacion();
  llamadas = {};
});

afterEach(() => {
  cleanup();
  nav.restaurar();
  spyOn(api, 'sincronizarUsuarioConBackend').mockRestore();
});

function configurarSignUp(extra: Record<string, unknown> = {}) {
  clerkFalso.signUp = {
    isLoaded: true,
    signUp: {
      create: async (datos: unknown) => {
        llamadas.creado = datos;
      },
      prepareEmailAddressVerification: async (datos: unknown) => {
        llamadas.preparado = datos;
      },
      attemptEmailAddressVerification: async () => ({
        status: 'complete',
        createdSessionId: 's1',
      }),
      ...extra,
    },
    setActive: async () => {},
  };
}

/** Cambia en caliente la verificación del `signUp` que ya usa el componente. */
function verificacionDevuelve(fn: () => Promise<unknown>) {
  (
    clerkFalso.signUp.signUp as Record<string, unknown>
  ).attemptEmailAddressVerification = fn;
}

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

async function hastaVerificacion(rol = 'Afiliado') {
  configurarSignUp();
  render(<RegisterForm />);
  llenar(rol);
  enviar();
  await screen.findByText('Verifica tu correo');
}

function verificar(codigo = '123456') {
  fireEvent.change(screen.getByLabelText(/Código de verificación/), {
    target: { value: codigo },
  });
  fireEvent.submit(
    screen.getByRole('button', { name: /Verificar cuenta/ }).closest('form')!
  );
}

describe('RegisterForm: alta', () => {
  test('envío vacío muestra resumen de errores y blur marca campos', async () => {
    // Given: un formulario de registro vacío
    configurarSignUp();
    render(<RegisterForm />);
    const nombre = screen.getByLabelText(/Nombre completo/);
    // When: se pierde el foco del nombre
    fireEvent.blur(nombre);
    fireEvent.blur(nombre);
    // When: se envía
    enviar();
    // Then: muestra el resumen de errores
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Hay un problema con tu registro'
    );
  });

  test('un rol inválido se normaliza a vacío', () => {
    // Given: un formulario de registro
    configurarSignUp();
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

  test('con Clerk sin cargar no envía', () => {
    // Given: un Clerk que aún no cargó
    clerkFalso.signUp = { isLoaded: false };
    render(<RegisterForm />);
    llenar();
    // When: se llena el formulario y se envía
    enviar();
    // Then: no se crea ninguna cuenta
    expect(llamadas.creado).toBeUndefined();
  });

  test('registro válido crea la cuenta y pasa a verificación', async () => {
    // Given: un registro válido de afiliado
    // When: se llena y se envía el formulario
    await hastaVerificacion();
    // Then: se crea la cuenta con el rol en la metadata y se pasa a verificación
    expect(llamadas.creado).toMatchObject({
      firstName: 'Ana Pérez',
      emailAddress: 'ana@ejemplo.com',
      unsafeMetadata: { rol: 'Afiliado' },
    });
    expect(llamadas.preparado).toEqual({ strategy: 'email_code' });
    expect(
      screen.getByText(/enviado un código a ana@ejemplo.com/)
    ).toBeTruthy();
  });

  test('correo ya registrado', async () => {
    // Given: un Clerk que rechaza con form_identifier_exists
    configurarSignUp({
      create: async () => {
        throw { errors: [{ code: 'form_identifier_exists' }] };
      },
    });
    render(<RegisterForm />);
    llenar();
    // When: se llena y se envía el formulario
    enviar();
    // Then: avisa que el correo ya existe
    expect((await screen.findByRole('alert')).textContent).toContain(
      'ya está asociado a una cuenta'
    );
  });

  test('otro error de Clerk usa su mensaje; uno desconocido, el genérico', async () => {
    // Given: un Clerk que rechaza con un mensaje propio
    configurarSignUp({
      create: async () => {
        throw { errors: [{ code: 'x', message: 'Contraseña filtrada' }] };
      },
    });
    const { unmount } = render(<RegisterForm />);
    llenar();
    // When: se llena y se envía el formulario
    enviar();
    // Then: muestra el mensaje de Clerk
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Contraseña filtrada'
    );
    unmount();

    // Given: ahora un Clerk que lanza un Error plano
    configurarSignUp({
      create: async () => {
        throw new Error('red');
      },
    });
    render(<RegisterForm />);
    llenar();
    // When: se llena y se envía el formulario
    enviar();
    // Then: muestra el mensaje genérico
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Ocurrió un error en el registro.'
    );
  });
});

describe('RegisterForm: verificación', () => {
  test('afiliado verificado va a configurar el perfil', async () => {
    // Given: un backend que responde con rol afiliado y un registro en la vista de verificación
    const sync = spyOn(api, 'sincronizarUsuarioConBackend').mockResolvedValue({
      rol: 'afiliado',
    } as never);
    await hastaVerificacion('Afiliado');
    // When: se envía el código de verificación
    verificar();
    // Then: sincroniza el perfil y redirige a configurarlo
    await waitFor(() => expect(nav.destino()).toBe('/perfil/configurar'));
    expect(sync).toHaveBeenCalledWith({
      token: 'token-falso',
      nombre: 'Ana Pérez',
      rol: 'Afiliado',
    });
  });

  test('usuario verificado va al dashboard', async () => {
    // Given: un backend que responde con rol cliente y un registro en verificación
    spyOn(api, 'sincronizarUsuarioConBackend').mockResolvedValue({
      rol: 'cliente',
    } as never);
    await hastaVerificacion('Usuario');
    // When: se envía el código de verificación
    verificar();
    // Then: redirige al dashboard
    await waitFor(() => expect(nav.destino()).toBe('/dashboard'));
  });

  test('sin token no se puede crear el perfil', async () => {
    await hastaVerificacion();
    // Given: una verificación correcta pero sin token de sesión
    clerkFalso.getToken = async () => null;
    // When: se envía el código de verificación
    verificar();
    // Then: informa que la cuenta se verificó pero no se creó el perfil
    expect((await screen.findByRole('alert')).textContent).toContain(
      'no se pudo crear tu perfil'
    );
  });

  test('registro incompleto informa los campos faltantes o un genérico', async () => {
    await hastaVerificacion();
    // Given: un Clerk que exige campos adicionales
    verificacionDevuelve(async () => ({
      status: 'missing_requirements',
      missingFields: ['phone_number', 'username'],
    }));
    // When: se envía el código de verificación
    verificar();
    // Then: informa qué campos faltan
    expect((await screen.findByRole('alert')).textContent).toContain(
      'falta completar el registro: phone_number, username'
    );

    // Given: ahora uno sin lista de campos faltantes
    verificacionDevuelve(async () => ({
      status: 'missing_requirements',
    }));
    // When: se envía de nuevo el código
    verificar();
    // Then: muestra el mensaje genérico de registro incompleto
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain(
        'quedó incompleto'
      )
    );
  });

  test('código incorrecto: mensaje de Clerk o genérico', async () => {
    await hastaVerificacion();
    // Given: un Clerk que rechaza con 'Código vencido'
    verificacionDevuelve(async () => {
      throw { errors: [{ message: 'Código vencido' }] };
    });
    // When: se envía el código de verificación
    verificar();
    // Then: muestra el mensaje de Clerk
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Código vencido'
    );

    // Given: ahora un error sin mensaje
    verificacionDevuelve(async () => {
      throw { errors: [{}] };
    });
    // When: se envía de nuevo el código
    verificar();
    // Then: muestra el mensaje genérico
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain(
        'Código de verificación incorrecto.'
      )
    );
  });

  test('con Clerk sin cargar la verificación no hace nada', async () => {
    await hastaVerificacion();
    // Given: un registro en verificación y un Clerk que deja de estar cargado
    clerkFalso.signUp = { isLoaded: false };
    // When: se envía el código de verificación
    verificar();
    // Then: no hace nada
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
