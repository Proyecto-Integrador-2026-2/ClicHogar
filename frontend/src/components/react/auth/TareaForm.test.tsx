/**
 * Pruebas de TareaForm: validación, publicación, sesión expirada,
 * errores que conservan los valores, guardia de salida y "publicar otra".
 */
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import {
  clerkFalso,
  resetClerkFalso,
  simularNavegacion,
} from '../../../../test-setup';
import * as api from '../../../lib/usuarios-api';
import TareaForm from './TareaForm';

let nav: ReturnType<typeof simularNavegacion>;

beforeEach(() => {
  resetClerkFalso();
  nav = simularNavegacion();
});

afterEach(() => {
  cleanup();
  nav.restaurar();
  spyOn(api, 'crearTarea').mockRestore();
});

const DESCRIPCION = 'El grifo de la cocina gotea desde hace una semana.';

function llenar() {
  fireEvent.change(screen.getByLabelText(/Título/), {
    target: { value: '  Arreglar grifo  ' },
  });
  fireEvent.change(screen.getByLabelText(/Descripción/), {
    target: { value: DESCRIPCION },
  });
  fireEvent.change(screen.getByLabelText(/Categoría/), {
    target: { value: 'Plomería' },
  });
  fireEvent.change(screen.getByLabelText(/Ubicación aproximada/), {
    target: { value: ' Envigado ' },
  });
}

const enviar = () =>
  fireEvent.submit(
    screen
      .getByRole('button', { name: /Publicar tarea|Publicando/ })
      .closest('form')!
  );

describe('TareaForm', () => {
  test('envío vacío muestra el resumen y errores inline', async () => {
    // Given: un formulario de tarea vacío
    render(<TareaForm />);
    // When: se envía
    enviar();
    // Then: muestra el resumen y los errores inline
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Hay un problema con tu publicación'
    );
    expect(
      screen.getByLabelText(/Descripción/).getAttribute('aria-invalid')
    ).toBe('true');
  });

  test('el blur marca los campos como tocados', () => {
    // Given: un formulario de tarea vacío
    render(<TareaForm />);
    const titulo = screen.getByLabelText(/Título/);
    // When: se pierde el foco del título y la descripción
    fireEvent.blur(titulo);
    fireEvent.blur(titulo);
    fireEvent.blur(screen.getByLabelText(/Descripción/));
    // Then: los campos muestran su error
    expect(titulo.getAttribute('aria-invalid')).toBe('true');
  });

  test('publica con los valores recortados y ofrece publicar otra', async () => {
    // Given: un backend que acepta la publicación
    const crear = spyOn(api, 'crearTarea').mockResolvedValue({} as never);
    render(<TareaForm />);
    // When: se llena el formulario con espacios sobrantes
    llenar();
    // Then: el formulario avisa que hay cambios sin publicar
    expect(screen.getByText('Tienes cambios sin publicar.')).toBeTruthy();
    // When: se envía
    enviar();
    // Then: se celebra la publicación
    expect(
      await screen.findByText(
        '¡Tarea publicada! Los afiliados ya pueden verla.'
      )
    ).toBeTruthy();
    // Then: viaja con los valores recortados
    expect(crear).toHaveBeenCalledWith({
      token: 'token-falso',
      titulo: 'Arreglar grifo',
      descripcion: DESCRIPCION,
      categoria: 'Plomería',
      ubicacion: 'Envigado',
    });

    // When: se pulsa Publicar otra tarea
    fireEvent.click(screen.getByText('Publicar otra tarea'));
    expect((screen.getByLabelText(/Título/) as HTMLInputElement).value).toBe(
      ''
    );
    // Then: el formulario queda limpio
    expect(screen.queryByText(/Tarea publicada/)).toBeNull();
  });

  test('la guardia beforeunload solo actúa con cambios sin publicar', () => {
    // Given: un formulario limpio
    render(<TareaForm />);
    const limpio = new Event('beforeunload', { cancelable: true });
    // When: se dispara beforeunload
    window.dispatchEvent(limpio);
    // Then: no se pide confirmación
    expect(limpio.defaultPrevented).toBe(false);

    // Given: ahora con un título escrito
    fireEvent.change(screen.getByLabelText(/Título/), {
      target: { value: 'Algo' },
    });
    const sucio = new Event('beforeunload', { cancelable: true });
    // When: se dispara beforeunload
    window.dispatchEvent(sucio);
    // Then: se pide confirmación
    expect(sucio.defaultPrevented).toBe(true);
  });

  test('sesión expirada redirige al login con aviso', async () => {
    // Given: un backend que responde sesión expirada
    spyOn(api, 'crearTarea').mockRejectedValue(new api.ErrorSesionExpirada());
    render(<TareaForm />);
    // When: se llena el formulario y se envía
    llenar();
    enviar();
    await new Promise((r) => setTimeout(r, 20));
    // Then: redirige al login con el aviso
    expect(nav.destino()).toBe('/login?expirada=1');
  });

  test('error del backend conserva los valores', async () => {
    // Given: un backend que falla
    spyOn(api, 'crearTarea').mockRejectedValue(new Error('Sin red'));
    render(<TareaForm />);
    // When: se llena el formulario y se envía
    llenar();
    enviar();
    // Then: muestra el error y conserva los valores
    expect((await screen.findByRole('alert')).textContent).toContain('Sin red');
    expect(
      (screen.getByLabelText(/Ubicación aproximada/) as HTMLInputElement).value
    ).toBe(' Envigado ');
  });

  test('error que no es Error usa el mensaje genérico', async () => {
    // Given: un backend que rechaza con un valor que no es Error
    spyOn(api, 'crearTarea').mockRejectedValue('boom');
    render(<TareaForm />);
    // When: se llena el formulario y se envía
    llenar();
    enviar();
    // Then: muestra el mensaje genérico
    expect((await screen.findByRole('alert')).textContent).toContain(
      'No se pudo publicar tu tarea'
    );
  });

  test('sin token de sesión muestra el error', async () => {
    // Given: una sesión sin token
    clerkFalso.getToken = async () => null;
    render(<TareaForm />);
    // When: se llena el formulario y se envía
    llenar();
    enviar();
    // Then: muestra el error de sesión
    expect((await screen.findByRole('alert')).textContent).toContain(
      'No se pudo obtener la sesión'
    );
  });
});
