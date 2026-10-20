/**
 * Pruebas de PerfilForm: carga y pre-relleno, perfil inexistente, diff
 * parcial al guardar, foto con vista previa, errores y guardia de salida.
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
import { clerkFalso, resetClerkFalso } from '../../../../test-setup';
import * as api from '../../../lib/usuarios-api';
import PerfilForm from './PerfilForm';

const PERFIL: api.UsuarioPublico = {
  id: 'u1',
  nombre: 'Ana',
  email: 'ana@ejemplo.com',
  rol: 'afiliado',
  fotoUrl: '/uploads/perfiles/a.jpg',
  descripcion: 'Plomera',
  ubicacion: 'Envigado',
  creadoEn: '2026-01-01T00:00:00Z',
};

const urlOriginal = { c: URL.createObjectURL, r: URL.revokeObjectURL };
const revocadas: string[] = [];

beforeEach(() => {
  resetClerkFalso();
  revocadas.length = 0;
  URL.createObjectURL = () => 'blob:preview';
  URL.revokeObjectURL = (u: string) => {
    revocadas.push(u);
  };
});

afterEach(() => {
  cleanup();
  URL.createObjectURL = urlOriginal.c;
  URL.revokeObjectURL = urlOriginal.r;
  spyOn(api, 'obtenerPerfil').mockRestore();
  spyOn(api, 'actualizarPerfil').mockRestore();
});

const descripcion = () =>
  screen.getByLabelText('Descripción') as HTMLTextAreaElement;
const ubicacion = () => screen.getByLabelText(/Ubicación aproximada/);
const guardar = () =>
  screen.getByRole('button', { name: /Guardar perfil|Guardando/ });

async function cargado(perfil: Partial<api.UsuarioPublico> = {}) {
  spyOn(api, 'obtenerPerfil').mockResolvedValue({ ...PERFIL, ...perfil });
  render(<PerfilForm />);
  await screen.findByText(
    'Una foto, una descripción y tu zona generan confianza'
  );
}

describe('PerfilForm: carga', () => {
  test('pre-rellena con el perfil y muestra la foto actual', async () => {
    await cargado();
    expect(descripcion().value).toBe('Plomera');
    expect((ubicacion() as HTMLInputElement).value).toBe('Envigado');
    expect(screen.getByAltText(/Vista previa/)).toBeTruthy();
    expect((guardar() as HTMLButtonElement).disabled).toBe(true);
  });

  test('perfil sin datos opcionales queda vacío y sin foto', async () => {
    await cargado({ fotoUrl: null, descripcion: null, ubicacion: null });
    expect(descripcion().value).toBe('');
    expect(screen.queryByAltText(/Vista previa/)).toBeNull();
  });

  test('muestra "Cargando" al inicio', () => {
    spyOn(api, 'obtenerPerfil').mockReturnValue(new Promise(() => {}));
    render(<PerfilForm />);
    expect(screen.getByRole('status').textContent).toContain('Cargando');
  });

  test('sin perfil local invita a registrarse', async () => {
    spyOn(api, 'obtenerPerfil').mockRejectedValue(
      new Error('No existe tu perfil local')
    );
    render(<PerfilForm />);
    expect(await screen.findByText('Crea tu cuenta primero')).toBeTruthy();
  });

  test('un 404 también cuenta como sin perfil', async () => {
    spyOn(api, 'obtenerPerfil').mockRejectedValue(
      new Error('El backend respondió 404.')
    );
    render(<PerfilForm />);
    expect(await screen.findByText('Crea tu cuenta primero')).toBeTruthy();
  });

  test('otros errores de carga se muestran tal cual o con mensaje genérico', async () => {
    spyOn(api, 'obtenerPerfil').mockRejectedValue(new Error('Servidor caído'));
    const { unmount } = render(<PerfilForm />);
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Servidor caído'
    );
    unmount();

    spyOn(api, 'obtenerPerfil').mockRejectedValue('boom');
    render(<PerfilForm />);
    expect((await screen.findByRole('alert')).textContent).toContain(
      'No se pudo cargar tu perfil.'
    );
  });

  test('sin token de sesión muestra error', async () => {
    clerkFalso.getToken = async () => null;
    render(<PerfilForm />);
    expect((await screen.findByRole('alert')).textContent).toContain(
      'No se pudo obtener la sesión'
    );
  });

  test('si se desmonta antes de cargar no actualiza el estado', async () => {
    let resolver: (p: api.UsuarioPublico) => void = () => {};
    spyOn(api, 'obtenerPerfil').mockReturnValue(
      new Promise((r) => {
        resolver = r;
      })
    );
    const { unmount } = render(<PerfilForm />);
    unmount();
    resolver(PERFIL);
    await new Promise((r) => setTimeout(r, 0));

    spyOn(api, 'obtenerPerfil').mockRejectedValue(new Error('x'));
    const segundo = render(<PerfilForm />);
    segundo.unmount();
    await new Promise((r) => setTimeout(r, 0));
  });
});

describe('PerfilForm: edición', () => {
  test('al editar habilita guardar, avisa y registra beforeunload', async () => {
    await cargado();
    fireEvent.change(descripcion(), { target: { value: 'Plomera experta' } });
    expect(screen.getByText('Tienes cambios sin guardar.')).toBeTruthy();
    expect((guardar() as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByText('15/500')).toBeTruthy();

    const evento = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(evento);
    expect(evento.defaultPrevented).toBe(true);
  });

  test('guarda solo lo modificado y celebra el éxito', async () => {
    await cargado();
    const actualizar = spyOn(api, 'actualizarPerfil').mockResolvedValue({
      ...PERFIL,
      descripcion: 'Nueva',
    });
    fireEvent.change(descripcion(), { target: { value: 'Nueva' } });
    fireEvent.submit(guardar().closest('form')!);
    expect(
      await screen.findByText('Perfil actualizado correctamente.')
    ).toBeTruthy();
    expect(actualizar).toHaveBeenCalledWith({
      token: 'token-falso',
      descripcion: 'Nueva',
    });
  });

  test('la ubicación y la foto nuevas viajan y se limpia la selección', async () => {
    await cargado();
    const actualizar = spyOn(api, 'actualizarPerfil').mockResolvedValue({
      ...PERFIL,
      fotoUrl: null,
      descripcion: null,
      ubicacion: 'Sabaneta',
    });
    fireEvent.change(ubicacion(), { target: { value: 'Sabaneta' } });
    const archivo = new File([new Uint8Array([1])], 'a.png', {
      type: 'image/png',
    });
    fireEvent.change(screen.getByLabelText('Foto de perfil'), {
      target: { files: [archivo] },
    });
    expect(screen.getByAltText(/Vista previa/).getAttribute('src')).toBe(
      'blob:preview'
    );
    fireEvent.submit(guardar().closest('form')!);
    await screen.findByText('Perfil actualizado correctamente.');
    expect(actualizar).toHaveBeenCalledWith({
      token: 'token-falso',
      foto: archivo,
      ubicacion: 'Sabaneta',
    });
    expect(revocadas).toContain('blob:preview');
    expect(screen.queryByAltText(/Vista previa/)).toBeNull();
  });

  test('conserva los datos y muestra el error si guardar falla', async () => {
    await cargado();
    spyOn(api, 'actualizarPerfil').mockRejectedValue(new Error('Sin red'));
    fireEvent.change(descripcion(), { target: { value: 'Cambio' } });
    fireEvent.submit(guardar().closest('form')!);
    expect((await screen.findByRole('alert')).textContent).toContain('Sin red');
    expect(descripcion().value).toBe('Cambio');
  });

  test('error que no es Error usa el mensaje genérico', async () => {
    await cargado();
    spyOn(api, 'actualizarPerfil').mockRejectedValue('boom');
    fireEvent.change(descripcion(), { target: { value: 'Cambio' } });
    fireEvent.submit(guardar().closest('form')!);
    expect((await screen.findByRole('alert')).textContent).toContain(
      'No se pudo guardar tu perfil'
    );
  });

  test('sin token al guardar muestra el error de sesión', async () => {
    await cargado();
    clerkFalso.getToken = async () => null;
    fireEvent.change(descripcion(), { target: { value: 'Cambio' } });
    fireEvent.submit(guardar().closest('form')!);
    expect((await screen.findByRole('alert')).textContent).toContain(
      'No se pudo obtener la sesión'
    );
  });

  test('enviar sin cambios no llama al backend', async () => {
    await cargado();
    const actualizar = spyOn(api, 'actualizarPerfil');
    fireEvent.submit(guardar().closest('form')!);
    expect(actualizar).not.toHaveBeenCalled();
  });

  test('una foto inválida bloquea el envío y muestra el resumen', async () => {
    await cargado();
    const actualizar = spyOn(api, 'actualizarPerfil');
    const pdf = new File(['x'], 'a.pdf', { type: 'application/pdf' });
    const input = screen.getByLabelText('Foto de perfil');
    fireEvent.change(input, { target: { files: [pdf] } });
    fireEvent.blur(input);
    fireEvent.blur(input);
    fireEvent.submit(guardar().closest('form')!);
    await waitFor(() =>
      expect(screen.getByText(/Hay un problema con tu perfil/)).toBeTruthy()
    );
    expect(actualizar).not.toHaveBeenCalled();
  });

  test('blur de descripción y ubicación marca los campos como tocados', async () => {
    await cargado();
    fireEvent.blur(descripcion());
    fireEvent.blur(ubicacion());
    expect(ubicacion().getAttribute('aria-invalid')).toBeNull();
  });
});
