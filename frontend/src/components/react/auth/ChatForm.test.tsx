/**
 * Pruebas de ChatForm: carga de la conversación, envío de mensajes y
 * errores. La red se simula con `spyOn`.
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
import { resetSesion } from '../../../../test-setup';
import * as api from '../../../lib/usuarios-api';
import ChatForm from './ChatForm';

const mensaje = (id: string, contenido: string): api.MensajeApi => ({
  id,
  remitente_id: 'u1',
  destinatario_id: 'u2',
  contenido,
  creado_en: '2026-03-05T12:00:00Z',
});

beforeEach(resetSesion);

afterEach(() => {
  cleanup();
  spyOn(api, 'listarConversacion').mockRestore();
  spyOn(api, 'enviarMensaje').mockRestore();
});

const escribirDestinatario = (id: string) =>
  fireEvent.change(screen.getByPlaceholderText('ID del destinatario'), {
    target: { value: id },
  });

const escribirMensaje = (texto: string) =>
  fireEvent.change(screen.getByPlaceholderText('Mensaje'), {
    target: { value: texto },
  });

const enviar = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));

describe('ChatForm', () => {
  test('sin destinatario no pide la conversación', () => {
    // Given: un chat sin destinatario elegido
    const listar = spyOn(api, 'listarConversacion');
    // When: se renderiza
    render(<ChatForm />);
    // Then: no llama al backend
    expect(listar).not.toHaveBeenCalled();
  });

  test('al elegir destinatario carga y muestra la conversación', async () => {
    // Given: una conversación con dos mensajes
    const listar = spyOn(api, 'listarConversacion').mockResolvedValue([
      mensaje('m1', 'Hola'),
      mensaje('m2', 'Buenas'),
    ]);
    render(<ChatForm />);
    // When: se escribe el destinatario
    escribirDestinatario('u2');
    // Then: pide la conversación con el token y la muestra
    expect(await screen.findByText('Hola')).toBeTruthy();
    expect(screen.getByText('Buenas')).toBeTruthy();
    expect(listar).toHaveBeenCalledWith({
      token: 'token-falso',
      usuarioId: 'u2',
    });
  });

  test('sin token no carga ni envía', async () => {
    // Given: una sesión sin token
    localStorage.removeItem('ch-token');
    const listar = spyOn(api, 'listarConversacion');
    const enviarApi = spyOn(api, 'enviarMensaje');
    render(<ChatForm />);
    // When: se elige destinatario y se intenta enviar un mensaje
    escribirDestinatario('u2');
    escribirMensaje('Hola');
    enviar();
    // Then: no hay llamadas al backend
    expect(listar).not.toHaveBeenCalled();
    expect(enviarApi).not.toHaveBeenCalled();
  });

  test('enviar un mensaje vacío o sin destinatario no hace nada', () => {
    // Given: un chat sin destinatario ni texto
    const enviarApi = spyOn(api, 'enviarMensaje');
    render(<ChatForm />);
    // When: se intenta enviar sin destinatario
    escribirMensaje('Hola');
    enviar();
    // Then: no se envía
    expect(enviarApi).not.toHaveBeenCalled();
    // When: hay destinatario pero el mensaje son solo espacios
    spyOn(api, 'listarConversacion').mockResolvedValue([]);
    escribirDestinatario('u2');
    escribirMensaje('   ');
    enviar();
    // Then: tampoco se envía
    expect(enviarApi).not.toHaveBeenCalled();
  });

  test('envía el mensaje recortado, limpia el campo y recarga', async () => {
    // Given: un chat con destinatario y un backend que acepta el envío
    const listar = spyOn(api, 'listarConversacion').mockResolvedValue([]);
    const enviarApi = spyOn(api, 'enviarMensaje').mockResolvedValue(
      mensaje('m3', 'Nuevo')
    );
    render(<ChatForm />);
    escribirDestinatario('u2');
    await waitFor(() => expect(listar).toHaveBeenCalledTimes(1));
    // When: se envía un mensaje con espacios alrededor
    escribirMensaje('  Nuevo  ');
    enviar();
    // Then: se envía recortado, se limpia el campo y se recarga la conversación
    await waitFor(() => expect(listar).toHaveBeenCalledTimes(2));
    expect(enviarApi).toHaveBeenCalledWith({
      token: 'token-falso',
      destinatarioId: 'u2',
      contenido: 'Nuevo',
    });
    expect(
      (screen.getByPlaceholderText('Mensaje') as HTMLInputElement).value
    ).toBe('');
  });

  test('errores al cargar o enviar se muestran', async () => {
    // Given: un backend que falla al cargar con Error
    const listar = spyOn(api, 'listarConversacion').mockRejectedValue(
      new Error('Sin servidor')
    );
    render(<ChatForm />);
    // When: se elige destinatario
    escribirDestinatario('u2');
    // Then: muestra el mensaje del error
    expect(await screen.findByText('Sin servidor')).toBeTruthy();

    // Given: ahora un rechazo que no es Error al cargar
    listar.mockRejectedValue('boom');
    // When: se cambia de destinatario
    escribirDestinatario('u3');
    // Then: muestra el mensaje genérico
    expect(await screen.findByText('Error')).toBeTruthy();

    // Given: y un fallo al enviar
    spyOn(api, 'enviarMensaje').mockRejectedValue(new Error('No se envió'));
    // When: se envía un mensaje
    escribirMensaje('Hola');
    enviar();
    // Then: muestra el error del envío
    expect(await screen.findByText('No se envió')).toBeTruthy();

    // Given: y un fallo al enviar que no es Error
    spyOn(api, 'enviarMensaje').mockRejectedValue('boom');
    // When: se vuelve a enviar
    escribirMensaje('Otra vez');
    enviar();
    // Then: muestra el mensaje genérico
    await waitFor(() => expect(screen.getByText('Error')).toBeTruthy());
  });
});
