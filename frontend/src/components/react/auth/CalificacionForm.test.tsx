/**
 * Pruebas de CalificacionForm: envío de la calificación y sus mensajes.
 */
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { resetSesion, simularNavegacion } from '../../../../test-setup';
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
      tareaId: null,
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

describe('CalificacionForm: precarga desde la finalización (US-014)', () => {
  test('toma el afiliado y la tarea de la URL y los envía', async () => {
    // Given: la URL que deja la finalización de una tarea
    const nav = simularNavegacion('?usuario=a-1&tarea=t-1');
    const crear = spyOn(api, 'crearCalificacion').mockResolvedValue(
      {} as api.CalificacionApi
    );
    try {
      render(<CalificacionForm />);
      // Then: el afiliado llega precargado
      expect(
        (screen.getByPlaceholderText('ID del usuario') as HTMLInputElement)
          .value
      ).toBe('a-1');
      // When: se envía la calificación
      enviar();
      // Then: viaja con el afiliado y la tarea
      expect(await screen.findByText('Calificación enviada.')).toBeTruthy();
      expect(crear).toHaveBeenCalledWith(
        expect.objectContaining({ destinatarioId: 'a-1', tareaId: 't-1' })
      );
    } finally {
      nav.restaurar();
    }
  });

  test('sin parámetros, o si no se puede leer la URL, arranca vacío', () => {
    // Given: una URL sin parámetros
    const nav = simularNavegacion('');
    try {
      const { unmount } = render(<CalificacionForm />);
      // Then: el campo está vacío
      expect(
        (screen.getByPlaceholderText('ID del usuario') as HTMLInputElement)
          .value
      ).toBe('');
      unmount();
    } finally {
      nav.restaurar();
    }
    // Given: una página cuya URL no se puede leer
    const original = Object.getOwnPropertyDescriptor(window, 'location');
    Object.defineProperty(window, 'location', {
      configurable: true,
      get() {
        throw new Error('sin acceso');
      },
    });
    try {
      // When: se renderiza
      render(<CalificacionForm />);
      // Then: también arranca vacío
      expect(
        (screen.getByPlaceholderText('ID del usuario') as HTMLInputElement)
          .value
      ).toBe('');
    } finally {
      if (original) Object.defineProperty(window, 'location', original);
    }
  });
});
