/**
 * Pruebas de DisponibilidadForm: guardia de rol, prefill, toggles y guardado
 * por reemplazo total (incluso vacío), con errores que conservan la selección.
 */
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { clerkFalso, resetClerkFalso } from '../../../../test-setup';
import * as api from '../../../lib/usuarios-api';
import DisponibilidadForm from './DisponibilidadForm';

const AFILIADO = { rol: 'afiliado' } as api.UsuarioPublico;

beforeEach(resetClerkFalso);

afterEach(() => {
  cleanup();
  spyOn(api, 'obtenerPerfil').mockRestore();
  spyOn(api, 'obtenerDisponibilidad').mockRestore();
  spyOn(api, 'guardarDisponibilidad').mockRestore();
});

const slot = (dia: string, franja: string, activo: boolean) =>
  screen.getByLabelText(
    `${dia} ${franja}: ${activo ? 'disponible' : 'no disponible'}`
  );

async function cargado(slots: api.SlotApi[] = []) {
  spyOn(api, 'obtenerPerfil').mockResolvedValue(AFILIADO);
  spyOn(api, 'obtenerDisponibilidad').mockResolvedValue(slots);
  render(<DisponibilidadForm />);
  await screen.findByText('Mi disponibilidad');
  await screen.findByRole('group', { name: 'Días y franjas disponibles' });
}

describe('DisponibilidadForm: carga', () => {
  test('muestra carga inicial', () => {
    // Given: un backend que nunca responde
    spyOn(api, 'obtenerPerfil').mockReturnValue(new Promise(() => {}));
    // When: se renderiza el formulario
    render(<DisponibilidadForm />);
    // Then: muestra 'Cargando'
    expect(screen.getByRole('status').textContent).toContain('Cargando');
  });

  test('un cliente ve la alerta de exclusividad sin matriz', async () => {
    // Given: un perfil con rol cliente
    spyOn(api, 'obtenerPerfil').mockResolvedValue({
      rol: 'cliente',
    } as api.UsuarioPublico);
    // When: se renderiza el formulario
    render(<DisponibilidadForm />);
    // Then: muestra la alerta de exclusividad sin la matriz
    expect((await screen.findByRole('alert')).textContent).toContain(
      'exclusiva para perfiles de Afiliados'
    );
    expect(screen.queryByRole('group')).toBeNull();
  });

  test('pre-rellena la matriz y avisa cuando está vacía', async () => {
    // Given: un afiliado con una franja guardada
    // When: se carga el formulario
    await cargado([{ diaSemana: 1, franjaHoraria: 'manana' }]);
    // Then: la franja aparece marcada y no hay aviso de vacío
    expect(slot('Lun', 'Mañana', true)).toBeTruthy();
    expect(screen.queryByText(/Sin disponibilidad definida/)).toBeNull();
    cleanup();

    // Given: ahora un afiliado sin franjas
    // When: se carga el formulario
    await cargado([]);
    // Then: avisa que no hay disponibilidad
    expect(screen.getByText(/Sin disponibilidad definida/)).toBeTruthy();
  });

  test('errores de carga: mensaje propio, genérico y sin token', async () => {
    // Given: un backend caído
    spyOn(api, 'obtenerPerfil').mockRejectedValue(new Error('Caído'));
    // When: se renderiza el formulario
    const a = render(<DisponibilidadForm />);
    // Then: muestra ese mensaje
    expect((await screen.findByRole('alert')).textContent).toContain('Caído');
    a.unmount();

    // Given: ahora un error que no es Error
    spyOn(api, 'obtenerPerfil').mockRejectedValue('boom');
    // When: se renderiza el formulario
    const b = render(<DisponibilidadForm />);
    // Then: muestra el mensaje genérico
    expect((await screen.findByRole('alert')).textContent).toContain(
      'No se pudo cargar tu horario.'
    );
    b.unmount();

    // Given: y por último una sesión sin token
    clerkFalso.getToken = async () => null;
    // When: se renderiza el formulario
    render(<DisponibilidadForm />);
    // Then: muestra el error de sesión
    expect((await screen.findByRole('alert')).textContent).toContain(
      'No se pudo obtener la sesión'
    );
  });

  test('desmontar antes de que termine la carga no rompe nada', async () => {
    // Given: cargas lentas que responden después de desmontar
    let resolver: (p: api.UsuarioPublico) => void = () => {};
    spyOn(api, 'obtenerPerfil').mockReturnValue(
      new Promise((r) => {
        resolver = r;
      })
    );
    const a = render(<DisponibilidadForm />);
    // When: se desmonta antes de que responda
    a.unmount();
    // Then: al responder tarde no se actualiza nada ni hay errores
    resolver(AFILIADO);
    await new Promise((r) => setTimeout(r, 0));

    spyOn(api, 'obtenerPerfil').mockResolvedValue({
      rol: 'cliente',
    } as api.UsuarioPublico);
    const b = render(<DisponibilidadForm />);
    b.unmount();
    await new Promise((r) => setTimeout(r, 0));

    spyOn(api, 'obtenerPerfil').mockResolvedValue(AFILIADO);
    let resolverSlots: (s: api.SlotApi[]) => void = () => {};
    spyOn(api, 'obtenerDisponibilidad').mockReturnValue(
      new Promise((r) => {
        resolverSlots = r;
      })
    );
    const c = render(<DisponibilidadForm />);
    await new Promise((r) => setTimeout(r, 0));
    c.unmount();
    resolverSlots([]);
    await new Promise((r) => setTimeout(r, 0));

    spyOn(api, 'obtenerPerfil').mockRejectedValue(new Error('x'));
    const d = render(<DisponibilidadForm />);
    d.unmount();
    await new Promise((r) => setTimeout(r, 0));
  });
});

describe('DisponibilidadForm: guardado', () => {
  test('alterna slots y guarda el conjunto', async () => {
    await cargado();
    // Given: un afiliado cargado y un backend que devuelve dos franjas
    const guardar = spyOn(api, 'guardarDisponibilidad').mockResolvedValue([
      { diaSemana: 1, franjaHoraria: 'manana' },
      { diaSemana: 0, franjaHoraria: 'noche' },
    ]);
    // When: se marcan y desmarcan franjas
    fireEvent.click(slot('Lun', 'Mañana', false));
    fireEvent.click(slot('Dom', 'Noche', false));
    fireEvent.click(slot('Dom', 'Noche', true));
    fireEvent.click(slot('Dom', 'Noche', false));
    // When: se guarda el horario
    fireEvent.submit(
      screen.getByRole('button', { name: /Guardar horario/ }).closest('form')!
    );
    // Then: se informa el éxito con el total de franjas
    expect(
      await screen.findByText('Disponibilidad guardada. (2 franjas)')
    ).toBeTruthy();
    // Then: se envía una sola vez con las dos franjas
    expect(guardar).toHaveBeenCalledTimes(1);
    expect(guardar.mock.calls[0]![0].slots).toHaveLength(2);
  });

  test('vaciar la matriz envía arreglo vacío y lo informa', async () => {
    await cargado([{ diaSemana: 1, franjaHoraria: 'manana' }]);
    // Given: un afiliado con una franja guardada
    const guardar = spyOn(api, 'guardarDisponibilidad').mockResolvedValue([]);
    // When: se desmarca la única franja
    fireEvent.click(slot('Lun', 'Mañana', true));
    // When: se guarda el horario
    fireEvent.submit(
      screen.getByRole('button', { name: /Guardar horario/ }).closest('form')!
    );
    // Then: se informa que se eliminó
    expect(
      await screen.findByText('Disponibilidad eliminada. (0 franjas)')
    ).toBeTruthy();
    // Then: se envía un arreglo vacío
    expect(guardar.mock.calls[0]![0].slots).toEqual([]);
  });

  test('si falla conserva la selección y muestra el error', async () => {
    await cargado();
    // Given: un backend que falla al guardar
    spyOn(api, 'guardarDisponibilidad').mockRejectedValue(new Error('Sin red'));
    // When: se marca una franja
    fireEvent.click(slot('Mar', 'Tarde', false));
    // When: se guarda el horario
    fireEvent.submit(
      screen.getByRole('button', { name: /Guardar horario/ }).closest('form')!
    );
    // Then: muestra el error
    expect((await screen.findByRole('alert')).textContent).toContain('Sin red');
    // Then: la selección se conserva
    expect(slot('Mar', 'Tarde', true)).toBeTruthy();
  });

  test('error que no es Error usa el mensaje genérico', async () => {
    await cargado();
    // Given: un backend que rechaza con un valor que no es Error
    spyOn(api, 'guardarDisponibilidad').mockRejectedValue('boom');
    // When: se guarda el horario
    fireEvent.submit(
      screen.getByRole('button', { name: /Guardar horario/ }).closest('form')!
    );
    // Then: muestra el mensaje genérico
    expect((await screen.findByRole('alert')).textContent).toContain(
      'No se pudo guardar tu horario'
    );
  });

  test('sin token al guardar muestra el error de sesión', async () => {
    await cargado();
    // Given: un afiliado cargado y una sesión sin token
    clerkFalso.getToken = async () => null;
    // When: se guarda el horario
    fireEvent.submit(
      screen.getByRole('button', { name: /Guardar horario/ }).closest('form')!
    );
    // Then: muestra el error de sesión
    expect((await screen.findByRole('alert')).textContent).toContain(
      'No se pudo obtener la sesión'
    );
  });
});
