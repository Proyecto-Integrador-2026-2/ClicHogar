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
    // Given: un perfil con foto, descripción y ubicación
    // When: se carga el formulario
    await cargado();
    // Then: se pre-rellena y muestra la foto actual con guardar deshabilitado
    expect(descripcion().value).toBe('Plomera');
    expect((ubicacion() as HTMLInputElement).value).toBe('Envigado');
    expect(screen.getByAltText(/Vista previa/)).toBeTruthy();
    expect((guardar() as HTMLButtonElement).disabled).toBe(true);
  });

  test('perfil sin datos opcionales queda vacío y sin foto', async () => {
    // Given: un perfil sin foto, descripción ni ubicación
    // When: se carga el formulario
    await cargado({ fotoUrl: null, descripcion: null, ubicacion: null });
    // Then: queda vacío y sin foto
    expect(descripcion().value).toBe('');
    expect(screen.queryByAltText(/Vista previa/)).toBeNull();
  });

  test('muestra "Cargando" al inicio', () => {
    // Given: un backend que nunca responde
    spyOn(api, 'obtenerPerfil').mockReturnValue(new Promise(() => {}));
    // When: se renderiza el formulario
    render(<PerfilForm />);
    // Then: muestra 'Cargando'
    expect(screen.getByRole('status').textContent).toContain('Cargando');
  });

  test('sin perfil local invita a registrarse', async () => {
    // Given: un backend que dice que no existe el perfil local
    spyOn(api, 'obtenerPerfil').mockRejectedValue(
      new Error('No existe tu perfil local')
    );
    // When: se renderiza el formulario
    render(<PerfilForm />);
    // Then: invita a registrarse
    expect(await screen.findByText('Crea tu cuenta primero')).toBeTruthy();
  });

  test('un 404 también cuenta como sin perfil', async () => {
    // Given: un backend que responde 404
    spyOn(api, 'obtenerPerfil').mockRejectedValue(
      new Error('El backend respondió 404.')
    );
    // When: se renderiza el formulario
    render(<PerfilForm />);
    // Then: también invita a registrarse
    expect(await screen.findByText('Crea tu cuenta primero')).toBeTruthy();
  });

  test('otros errores de carga se muestran tal cual o con mensaje genérico', async () => {
    // Given: un backend caído
    spyOn(api, 'obtenerPerfil').mockRejectedValue(new Error('Servidor caído'));
    // When: se renderiza el formulario
    const { unmount } = render(<PerfilForm />);
    // Then: muestra ese mensaje
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Servidor caído'
    );
    unmount();

    // Given: ahora un error que no es Error
    spyOn(api, 'obtenerPerfil').mockRejectedValue('boom');
    // When: se renderiza el formulario
    render(<PerfilForm />);
    // Then: muestra el mensaje genérico
    expect((await screen.findByRole('alert')).textContent).toContain(
      'No se pudo cargar tu perfil.'
    );
  });

  test('sin token de sesión muestra error', async () => {
    // Given: una sesión sin token
    clerkFalso.getToken = async () => null;
    // When: se renderiza el formulario
    render(<PerfilForm />);
    // Then: muestra el error de sesión
    expect((await screen.findByRole('alert')).textContent).toContain(
      'No se pudo obtener la sesión'
    );
  });

  test('si se desmonta antes de cargar no actualiza el estado', async () => {
    // Given: un backend lento que responde después de desmontar
    let resolver: (p: api.UsuarioPublico) => void = () => {};
    spyOn(api, 'obtenerPerfil').mockReturnValue(
      new Promise((r) => {
        resolver = r;
      })
    );
    const { unmount } = render(<PerfilForm />);
    // When: se desmonta antes de que responda
    unmount();
    // Then: al responder tarde no se actualiza el estado ni hay errores
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
    // Given: un perfil cargado
    await cargado();
    // When: se edita la descripción
    fireEvent.change(descripcion(), { target: { value: 'Plomera experta' } });
    // Then: se habilita guardar, se avisa y el contador se actualiza
    expect(screen.getByText('Tienes cambios sin guardar.')).toBeTruthy();
    expect((guardar() as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByText('15/500')).toBeTruthy();

    const evento = new Event('beforeunload', { cancelable: true });
    // When: se dispara beforeunload
    window.dispatchEvent(evento);
    // Then: el navegador pide confirmar la salida
    expect(evento.defaultPrevented).toBe(true);
  });

  test('guarda solo lo modificado y celebra el éxito', async () => {
    await cargado();
    // Given: un perfil cargado y un backend que acepta la actualización
    const actualizar = spyOn(api, 'actualizarPerfil').mockResolvedValue({
      ...PERFIL,
      descripcion: 'Nueva',
    });
    // When: se edita solo la descripción
    fireEvent.change(descripcion(), { target: { value: 'Nueva' } });
    // When: se envía el formulario
    fireEvent.submit(guardar().closest('form')!);
    // Then: se celebra el éxito
    expect(
      await screen.findByText('Perfil actualizado correctamente.')
    ).toBeTruthy();
    // Then: viaja solo la descripción modificada
    expect(actualizar).toHaveBeenCalledWith({
      token: 'token-falso',
      descripcion: 'Nueva',
    });
  });

  test('la ubicación y la foto nuevas viajan y se limpia la selección', async () => {
    await cargado();
    // Given: un perfil cargado y un backend que acepta la actualización
    const actualizar = spyOn(api, 'actualizarPerfil').mockResolvedValue({
      ...PERFIL,
      fotoUrl: null,
      descripcion: null,
      ubicacion: 'Sabaneta',
    });
    // When: se cambia la ubicación y se elige una foto nueva
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
    // When: se envía el formulario
    fireEvent.submit(guardar().closest('form')!);
    // Then: se celebra el éxito
    await screen.findByText('Perfil actualizado correctamente.');
    expect(actualizar).toHaveBeenCalledWith({
      token: 'token-falso',
      foto: archivo,
      ubicacion: 'Sabaneta',
    });
    // Then: viajan ubicación y foto, se libera la vista previa y se limpia la selección
    expect(revocadas).toContain('blob:preview');
    expect(screen.queryByAltText(/Vista previa/)).toBeNull();
  });

  test('conserva los datos y muestra el error si guardar falla', async () => {
    await cargado();
    // Given: un backend que falla al guardar
    spyOn(api, 'actualizarPerfil').mockRejectedValue(new Error('Sin red'));
    // When: se edita la descripción
    fireEvent.change(descripcion(), { target: { value: 'Cambio' } });
    // When: se envía el formulario
    fireEvent.submit(guardar().closest('form')!);
    // Then: muestra el error y conserva lo escrito
    expect((await screen.findByRole('alert')).textContent).toContain('Sin red');
    expect(descripcion().value).toBe('Cambio');
  });

  test('error que no es Error usa el mensaje genérico', async () => {
    await cargado();
    // Given: un backend que rechaza con un valor que no es Error
    spyOn(api, 'actualizarPerfil').mockRejectedValue('boom');
    // When: se edita la descripción
    fireEvent.change(descripcion(), { target: { value: 'Cambio' } });
    // When: se envía el formulario
    fireEvent.submit(guardar().closest('form')!);
    // Then: muestra el mensaje genérico
    expect((await screen.findByRole('alert')).textContent).toContain(
      'No se pudo guardar tu perfil'
    );
  });

  test('sin token al guardar muestra el error de sesión', async () => {
    await cargado();
    // Given: un perfil cargado y una sesión que pierde el token
    clerkFalso.getToken = async () => null;
    // When: se edita la descripción
    fireEvent.change(descripcion(), { target: { value: 'Cambio' } });
    // When: se envía el formulario
    fireEvent.submit(guardar().closest('form')!);
    // Then: muestra el error de sesión
    expect((await screen.findByRole('alert')).textContent).toContain(
      'No se pudo obtener la sesión'
    );
  });

  test('enviar sin cambios no llama al backend', async () => {
    await cargado();
    // Given: un perfil cargado sin cambios
    const actualizar = spyOn(api, 'actualizarPerfil');
    // When: se envía el formulario
    fireEvent.submit(guardar().closest('form')!);
    // Then: no se llama al backend
    expect(actualizar).not.toHaveBeenCalled();
  });

  test('una foto inválida bloquea el envío y muestra el resumen', async () => {
    await cargado();
    const actualizar = spyOn(api, 'actualizarPerfil');
    // Given: un PDF elegido como foto
    const pdf = new File(['x'], 'a.pdf', { type: 'application/pdf' });
    const input = screen.getByLabelText('Foto de perfil');
    // When: se elige el archivo y se envía el formulario
    fireEvent.change(input, { target: { files: [pdf] } });
    fireEvent.blur(input);
    fireEvent.blur(input);
    // When: se envía el formulario
    fireEvent.submit(guardar().closest('form')!);
    // Then: muestra el resumen de errores
    await waitFor(() =>
      expect(screen.getByText(/Hay un problema con tu perfil/)).toBeTruthy()
    );
    // Then: no se llama al backend
    expect(actualizar).not.toHaveBeenCalled();
  });

  test('blur de descripción y ubicación marca los campos como tocados', async () => {
    // Given: un perfil cargado
    await cargado();
    // When: se pierde el foco de descripción y ubicación
    fireEvent.blur(descripcion());
    fireEvent.blur(ubicacion());
    // Then: los campos de texto no muestran error
    expect(ubicacion().getAttribute('aria-invalid')).toBeNull();
  });
});
