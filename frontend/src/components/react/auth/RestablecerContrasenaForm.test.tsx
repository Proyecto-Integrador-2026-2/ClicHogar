/**
 * Pruebas de "Restablecer contraseña": token de la URL, validación, envío
 * (red simulada), enlace inválido y guarda contra doble clic.
 */
import { afterEach, describe, expect, spyOn, test } from 'bun:test';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import React from 'react';
import { simularNavegacion } from '../../../../test-setup';
import * as api from '../../../lib/usuarios-api';
import RestablecerContrasenaForm, {
  MENSAJE_SIN_ENLACE,
} from './RestablecerContrasenaForm';

let nav: ReturnType<typeof simularNavegacion> | undefined;

afterEach(() => {
  cleanup();
  nav?.restaurar();
  nav = undefined;
  spyOn(api, 'restablecerContrasena').mockRestore();
});

function llenar(password: string, confirmacion = password) {
  fireEvent.change(screen.getByLabelText(/^Contraseña nueva/), {
    target: { value: password },
  });
  fireEvent.change(screen.getByLabelText(/^Confirmar contraseña nueva/), {
    target: { value: confirmacion },
  });
}

function formulario() {
  return screen
    .getByRole('button', { name: /Cambiar contraseña|Guardando/ })
    .closest('form')!;
}

describe('RestablecerContrasenaForm', () => {
  test('sin token en la URL invita a pedir un enlace nuevo', () => {
    // Given: una URL sin ?token=
    nav = simularNavegacion('');
    // When: se abre
    render(<RestablecerContrasenaForm />);
    // Then: aviso y enlace para solicitar otro, sin formulario
    expect(screen.getByRole('alert').textContent).toBe(MENSAJE_SIN_ENLACE);
    expect(
      screen.getByRole('link', { name: 'Solicitar un enlace nuevo' })
    ).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  test('si la URL no se puede leer, trata el enlace como inválido', () => {
    // Given: una página cuya URL lanza al leerse
    const original = Object.getOwnPropertyDescriptor(window, 'location');
    Object.defineProperty(window, 'location', {
      configurable: true,
      get() {
        throw new Error('sin acceso');
      },
    });
    try {
      // When: se abre
      render(<RestablecerContrasenaForm />);
      // Then: enlace inválido
      expect(screen.getByRole('alert').textContent).toBe(MENSAJE_SIN_ENLACE);
    } finally {
      if (original) Object.defineProperty(window, 'location', original);
    }
  });

  test('valida la contraseña nueva y su confirmación antes de enviar', async () => {
    // Given: un token en la URL y el formulario vacío
    nav = simularNavegacion('?token=tok-1');
    const cambiar = spyOn(api, 'restablecerContrasena');
    render(<RestablecerContrasenaForm />);
    // When: se envía vacío
    fireEvent.submit(formulario());
    // Then: errores de campo obligatorio y ninguna petición
    expect(
      (await screen.findAllByText('Este campo es obligatorio')).length
    ).toBe(2);
    // When: clave débil y confirmación distinta
    llenar('corta', 'otra');
    // Then: ambos errores
    expect(await screen.findByText(/al menos 8 caracteres/)).toBeTruthy();
    expect(screen.getByText('Las contraseñas no coinciden')).toBeTruthy();
    fireEvent.submit(formulario());
    expect(cambiar).not.toHaveBeenCalled();
  });

  test('al salir de un campo vacío muestra su error en línea', async () => {
    // Given: un token y el formulario sin tocar
    nav = simularNavegacion('?token=tok-1');
    render(<RestablecerContrasenaForm />);
    expect(screen.queryByText('Este campo es obligatorio')).toBeNull();
    // When: se sale del campo de contraseña dos veces
    const campo = screen.getByLabelText(/^Contraseña nueva/);
    fireEvent.blur(campo);
    fireEvent.blur(campo);
    // Then: solo ese campo muestra el error
    expect(
      await screen.findAllByText('Este campo es obligatorio')
    ).toHaveLength(1);
  });

  test('cambia la contraseña con el token y ofrece iniciar sesión', async () => {
    // Given: un token y un backend que acepta
    nav = simularNavegacion('?token=tok-1');
    const cambiar = spyOn(api, 'restablecerContrasena').mockResolvedValue({
      mensaje: 'Tu contraseña se actualizó. Ya puedes iniciar sesión.',
    });
    render(<RestablecerContrasenaForm />);
    // When: escribe una clave válida y envía
    llenar('NuevaClave1');
    fireEvent.submit(formulario());
    // Then: llama con token y clave, y muestra el éxito con enlace al login
    expect((await screen.findByRole('status')).textContent).toContain(
      'Tu contraseña se actualizó'
    );
    expect(cambiar).toHaveBeenCalledWith('tok-1', 'NuevaClave1');
    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toBeTruthy();
  });

  test('un enlace vencido muestra el error con la opción de pedir otro', async () => {
    // Given: un backend que rechaza el enlace y luego falla sin mensaje
    nav = simularNavegacion('?token=viejo');
    spyOn(api, 'restablecerContrasena')
      .mockRejectedValueOnce(new Error('El enlace no es válido o ya expiró.'))
      .mockRejectedValueOnce(42);
    render(<RestablecerContrasenaForm />);
    llenar('NuevaClave1');
    // When: envía
    fireEvent.submit(formulario());
    // Then: muestra el mensaje y el enlace para solicitar otro
    const alerta = await screen.findByRole('alert');
    expect(alerta.textContent).toContain('ya expiró');
    expect(
      screen.getByRole('link', { name: 'Solicitar un enlace nuevo' })
    ).toBeTruthy();
    // When: reintenta y falla con algo que no es Error
    fireEvent.submit(formulario());
    // Then: mensaje genérico
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain(
        'No se pudo cambiar la contraseña.'
      )
    );
  });

  test('un doble envío seguido hace una sola petición', async () => {
    // Given: una petición que tarda
    nav = simularNavegacion('?token=tok-1');
    let resolver: (v: { mensaje: string }) => void = () => {};
    const cambiar = spyOn(api, 'restablecerContrasena').mockReturnValue(
      new Promise((r) => {
        resolver = r;
      })
    );
    render(<RestablecerContrasenaForm />);
    llenar('NuevaClave1');
    // When: se envía dos veces antes de que responda
    const form = formulario();
    fireEvent.submit(form);
    fireEvent.submit(form);
    // Then: una sola petición
    expect(cambiar).toHaveBeenCalledTimes(1);
    resolver({ mensaje: 'Listo.' });
    expect((await screen.findByRole('status')).textContent).toBe('Listo.');
  });
});
