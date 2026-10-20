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
    render(<TareaForm />);
    enviar();
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Hay un problema con tu publicación'
    );
    expect(
      screen.getByLabelText(/Descripción/).getAttribute('aria-invalid')
    ).toBe('true');
  });

  test('el blur marca los campos como tocados', () => {
    render(<TareaForm />);
    const titulo = screen.getByLabelText(/Título/);
    fireEvent.blur(titulo);
    fireEvent.blur(titulo);
    fireEvent.blur(screen.getByLabelText(/Descripción/));
    expect(titulo.getAttribute('aria-invalid')).toBe('true');
  });

  test('publica con los valores recortados y ofrece publicar otra', async () => {
    const crear = spyOn(api, 'crearTarea').mockResolvedValue({} as never);
    render(<TareaForm />);
    llenar();
    expect(screen.getByText('Tienes cambios sin publicar.')).toBeTruthy();
    enviar();
    expect(
      await screen.findByText(
        '¡Tarea publicada! Los afiliados ya pueden verla.'
      )
    ).toBeTruthy();
    expect(crear).toHaveBeenCalledWith({
      token: 'token-falso',
      titulo: 'Arreglar grifo',
      descripcion: DESCRIPCION,
      categoria: 'Plomería',
      ubicacion: 'Envigado',
    });

    fireEvent.click(screen.getByText('Publicar otra tarea'));
    expect((screen.getByLabelText(/Título/) as HTMLInputElement).value).toBe(
      ''
    );
    expect(screen.queryByText(/Tarea publicada/)).toBeNull();
  });

  test('la guardia beforeunload solo actúa con cambios sin publicar', () => {
    render(<TareaForm />);
    const limpio = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(limpio);
    expect(limpio.defaultPrevented).toBe(false);

    fireEvent.change(screen.getByLabelText(/Título/), {
      target: { value: 'Algo' },
    });
    const sucio = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(sucio);
    expect(sucio.defaultPrevented).toBe(true);
  });

  test('sesión expirada redirige al login con aviso', async () => {
    spyOn(api, 'crearTarea').mockRejectedValue(new api.ErrorSesionExpirada());
    render(<TareaForm />);
    llenar();
    enviar();
    await new Promise((r) => setTimeout(r, 20));
    expect(nav.destino()).toBe('/login?expirada=1');
  });

  test('error del backend conserva los valores', async () => {
    spyOn(api, 'crearTarea').mockRejectedValue(new Error('Sin red'));
    render(<TareaForm />);
    llenar();
    enviar();
    expect((await screen.findByRole('alert')).textContent).toContain('Sin red');
    expect(
      (screen.getByLabelText(/Ubicación aproximada/) as HTMLInputElement).value
    ).toBe(' Envigado ');
  });

  test('error que no es Error usa el mensaje genérico', async () => {
    spyOn(api, 'crearTarea').mockRejectedValue('boom');
    render(<TareaForm />);
    llenar();
    enviar();
    expect((await screen.findByRole('alert')).textContent).toContain(
      'No se pudo publicar tu tarea'
    );
  });

  test('sin token de sesión muestra el error', async () => {
    clerkFalso.getToken = async () => null;
    render(<TareaForm />);
    llenar();
    enviar();
    expect((await screen.findByRole('alert')).textContent).toContain(
      'No se pudo obtener la sesión'
    );
  });
});
