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
    spyOn(api, 'obtenerPerfil').mockReturnValue(new Promise(() => {}));
    render(<DisponibilidadForm />);
    expect(screen.getByRole('status').textContent).toContain('Cargando');
  });

  test('un cliente ve la alerta de exclusividad sin matriz', async () => {
    spyOn(api, 'obtenerPerfil').mockResolvedValue({
      rol: 'cliente',
    } as api.UsuarioPublico);
    render(<DisponibilidadForm />);
    expect((await screen.findByRole('alert')).textContent).toContain(
      'exclusiva para perfiles de Afiliados'
    );
    expect(screen.queryByRole('group')).toBeNull();
  });

  test('pre-rellena la matriz y avisa cuando está vacía', async () => {
    await cargado([{ diaSemana: 1, franjaHoraria: 'manana' }]);
    expect(slot('Lun', 'Mañana', true)).toBeTruthy();
    expect(screen.queryByText(/Sin disponibilidad definida/)).toBeNull();
    cleanup();

    await cargado([]);
    expect(screen.getByText(/Sin disponibilidad definida/)).toBeTruthy();
  });

  test('errores de carga: mensaje propio, genérico y sin token', async () => {
    spyOn(api, 'obtenerPerfil').mockRejectedValue(new Error('Caído'));
    const a = render(<DisponibilidadForm />);
    expect((await screen.findByRole('alert')).textContent).toContain('Caído');
    a.unmount();

    spyOn(api, 'obtenerPerfil').mockRejectedValue('boom');
    const b = render(<DisponibilidadForm />);
    expect((await screen.findByRole('alert')).textContent).toContain(
      'No se pudo cargar tu horario.'
    );
    b.unmount();

    clerkFalso.getToken = async () => null;
    render(<DisponibilidadForm />);
    expect((await screen.findByRole('alert')).textContent).toContain(
      'No se pudo obtener la sesión'
    );
  });

  test('desmontar antes de que termine la carga no rompe nada', async () => {
    let resolver: (p: api.UsuarioPublico) => void = () => {};
    spyOn(api, 'obtenerPerfil').mockReturnValue(
      new Promise((r) => {
        resolver = r;
      })
    );
    const a = render(<DisponibilidadForm />);
    a.unmount();
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
    const guardar = spyOn(api, 'guardarDisponibilidad').mockResolvedValue([
      { diaSemana: 1, franjaHoraria: 'manana' },
      { diaSemana: 0, franjaHoraria: 'noche' },
    ]);
    fireEvent.click(slot('Lun', 'Mañana', false));
    fireEvent.click(slot('Dom', 'Noche', false));
    fireEvent.click(slot('Dom', 'Noche', true));
    fireEvent.click(slot('Dom', 'Noche', false));
    fireEvent.submit(
      screen.getByRole('button', { name: /Guardar horario/ }).closest('form')!
    );
    expect(
      await screen.findByText('Disponibilidad guardada. (2 franjas)')
    ).toBeTruthy();
    expect(guardar).toHaveBeenCalledTimes(1);
    expect(guardar.mock.calls[0]![0].slots).toHaveLength(2);
  });

  test('vaciar la matriz envía arreglo vacío y lo informa', async () => {
    await cargado([{ diaSemana: 1, franjaHoraria: 'manana' }]);
    const guardar = spyOn(api, 'guardarDisponibilidad').mockResolvedValue([]);
    fireEvent.click(slot('Lun', 'Mañana', true));
    fireEvent.submit(
      screen.getByRole('button', { name: /Guardar horario/ }).closest('form')!
    );
    expect(
      await screen.findByText('Disponibilidad eliminada. (0 franjas)')
    ).toBeTruthy();
    expect(guardar.mock.calls[0]![0].slots).toEqual([]);
  });

  test('si falla conserva la selección y muestra el error', async () => {
    await cargado();
    spyOn(api, 'guardarDisponibilidad').mockRejectedValue(new Error('Sin red'));
    fireEvent.click(slot('Mar', 'Tarde', false));
    fireEvent.submit(
      screen.getByRole('button', { name: /Guardar horario/ }).closest('form')!
    );
    expect((await screen.findByRole('alert')).textContent).toContain('Sin red');
    expect(slot('Mar', 'Tarde', true)).toBeTruthy();
  });

  test('error que no es Error usa el mensaje genérico', async () => {
    await cargado();
    spyOn(api, 'guardarDisponibilidad').mockRejectedValue('boom');
    fireEvent.submit(
      screen.getByRole('button', { name: /Guardar horario/ }).closest('form')!
    );
    expect((await screen.findByRole('alert')).textContent).toContain(
      'No se pudo guardar tu horario'
    );
  });

  test('sin token al guardar muestra el error de sesión', async () => {
    await cargado();
    clerkFalso.getToken = async () => null;
    fireEvent.submit(
      screen.getByRole('button', { name: /Guardar horario/ }).closest('form')!
    );
    expect((await screen.findByRole('alert')).textContent).toContain(
      'No se pudo obtener la sesión'
    );
  });
});
