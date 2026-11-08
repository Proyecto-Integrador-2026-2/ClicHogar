/**
 * Pruebas de CalificacionForm: envío de la calificación y sus mensajes.
 */
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { resetSesion } from '../../../../test-setup';
import * as api from '../../../lib/usuarios-api';
import CalificacionForm from './CalificacionForm';

beforeEach(resetSesion);

afterEach(() => {
  cleanup();
  spyOn(api, 'crearCalificacion').mockRestore();
});

const enviar = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));

describe('CalificacionForm', () => {
  test('envía la calificación con los datos escritos', async () => {
    // Given: un backend que acepta la calificación
    const crear = spyOn(api, 'crearCalificacion').mockResolvedValue(
      {} as api.CalificacionApi
    );
    render(<CalificacionForm />);
    // When: se llenan los campos y se envía
    fireEvent.change(screen.getByPlaceholderText('ID del usuario'), {
      target: { value: 'u2' },
    });
    fireEvent.change(screen.getByRole('spinbutton'), {
      target: { value: '4' },
    });
    fireEvent.change(screen.getByPlaceholderText('Comentario'), {
      target: { value: 'Muy bien' },
    });
    enviar();
    // Then: llama al backend con los datos y confirma
    expect(await screen.findByText('Calificación enviada.')).toBeTruthy();
    expect(crear).toHaveBeenCalledWith({
      token: 'token-falso',
      destinatarioId: 'u2',
      puntuacion: 4,
      comentario: 'Muy bien',
    });
  });

  test('sin token no envía', () => {
    // Given: una sesión sin token
    localStorage.removeItem('ch-token');
    const crear = spyOn(api, 'crearCalificacion');
    render(<CalificacionForm />);
    // When: se intenta enviar
    enviar();
    // Then: no llama al backend
    expect(crear).not.toHaveBeenCalled();
  });

  test('un fallo muestra su mensaje o uno genérico', async () => {
    // Given: un backend que rechaza con Error
    const crear = spyOn(api, 'crearCalificacion').mockRejectedValue(
      new Error('Puntuación inválida')
    );
    render(<CalificacionForm />);
    // When: se envía
    enviar();
    // Then: muestra el mensaje del error
    expect(await screen.findByText('Puntuación inválida')).toBeTruthy();

    // Given: ahora un rechazo que no es Error
    crear.mockRejectedValue('boom');
    // When: se envía otra vez
    enviar();
    // Then: muestra el mensaje genérico
    expect(await screen.findByText('Error')).toBeTruthy();
  });
});
