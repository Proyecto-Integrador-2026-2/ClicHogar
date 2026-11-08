/**
 * Pruebas de "Olvidé mi contraseña": validación del correo, envío (red
 * simulada), mensaje genérico, errores y guarda contra doble clic.
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
import * as api from '../../../lib/usuarios-api';
import OlvideContrasenaForm from './OlvideContrasenaForm';

afterEach(() => {
  cleanup();
  spyOn(api, 'solicitarRecuperacion').mockRestore();
});

const MENSAJE = 'Si el correo está registrado, te enviamos un enlace.';

function escribir(email: string) {
  fireEvent.change(screen.getByLabelText(/Correo electrónico/), {
    target: { value: email },
  });
}

function enviar() {
  fireEvent.submit(
    screen
      .getByRole('button', { name: /Enviar enlace|Enviando/ })
      .closest('form')!
  );
}

describe('OlvideContrasenaForm', () => {
  test('un correo vacío o inválido muestra el error y no llama al backend', async () => {
    // Given: el formulario vacío
    const solicitar = spyOn(api, 'solicitarRecuperacion');
    render(<OlvideContrasenaForm />);
    // When: se envía vacío
    enviar();
    // Then: error de campo obligatorio
    expect(await screen.findByText('Este campo es obligatorio')).toBeTruthy();
    // When: se escribe un correo mal formado
    escribir('sin-arroba');
    // Then: error de formato y ninguna petición
    expect(
      await screen.findByText('Por favor, ingresa un correo electrónico válido')
    ).toBeTruthy();
    expect(solicitar).not.toHaveBeenCalled();
  });

  test('envía el correo saneado y muestra el mensaje genérico', async () => {
    // Given: un backend que acepta la solicitud
    const solicitar = spyOn(api, 'solicitarRecuperacion').mockResolvedValue({
      mensaje: MENSAJE,
    });
    render(<OlvideContrasenaForm />);
    // When: escribe el correo con mayúsculas y espacios y envía
    escribir('  ANA@Ejemplo.com ');
    enviar();
    // Then: pide el enlace con el correo saneado y muestra el aviso
    expect((await screen.findByRole('status')).textContent).toBe(MENSAJE);
    expect(solicitar).toHaveBeenCalledWith('ana@ejemplo.com');
    expect(screen.queryByRole('button', { name: /Enviar enlace/ })).toBeNull();
    expect(
      screen.getByRole('link', { name: 'Volver a iniciar sesión' })
    ).toBeTruthy();
  });

  test('un error de red o del backend se muestra y permite reintentar', async () => {
    // Given: primero un fallo con mensaje y luego uno que no es Error
    const solicitar = spyOn(api, 'solicitarRecuperacion')
      .mockRejectedValueOnce(new Error('Sin conexión.'))
      .mockRejectedValueOnce('algo raro');
    render(<OlvideContrasenaForm />);
    escribir('ana@ejemplo.com');
    // When / Then: el primer envío muestra el mensaje del error
    enviar();
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Sin conexión.'
    );
    // When / Then: el segundo cae al mensaje genérico
    enviar();
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe(
        'No se pudo enviar el enlace.'
      )
    );
    expect(solicitar).toHaveBeenCalledTimes(2);
  });

  test('un doble envío seguido hace una sola petición', async () => {
    // Given: una petición que tarda
    let resolver: (v: { mensaje: string }) => void = () => {};
    const solicitar = spyOn(api, 'solicitarRecuperacion').mockReturnValue(
      new Promise((r) => {
        resolver = r;
      })
    );
    render(<OlvideContrasenaForm />);
    escribir('ana@ejemplo.com');
    // When: se envía dos veces antes de que responda
    const form = screen
      .getByRole('button', { name: /Enviar enlace/ })
      .closest('form')!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    // Then: solo una petición
    expect(solicitar).toHaveBeenCalledTimes(1);
    resolver({ mensaje: MENSAJE });
    expect((await screen.findByRole('status')).textContent).toBe(MENSAJE);
  });
});
