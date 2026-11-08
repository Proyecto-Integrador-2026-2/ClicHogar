/**
 * Pruebas del selector de estrellas (US-016).
 */
import { afterEach, describe, expect, test } from 'bun:test';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import SelectorEstrellas from './SelectorEstrellas';

afterEach(cleanup);

describe('SelectorEstrellas', () => {
  test('muestra 5 opciones accesibles y marca la elegida', () => {
    // Given: 3 estrellas elegidas
    const { container } = render(
      <SelectorEstrellas valor={3} onCambio={() => {}} />
    );
    // Then: 5 radios con su etiqueta, solo el 3 marcado, 3 llenas y 2 vacías
    const opciones = screen.getAllByRole('radio');
    expect(opciones.map((o) => o.getAttribute('aria-label'))).toEqual([
      '1 estrella',
      '2 estrellas',
      '3 estrellas',
      '4 estrellas',
      '5 estrellas',
    ]);
    expect(opciones.map((o) => o.getAttribute('aria-checked'))).toEqual([
      'false',
      'false',
      'true',
      'false',
      'false',
    ]);
    expect(container.textContent).toBe('★★★☆☆');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  test('elegir una estrella avisa con su valor', () => {
    // Given: un selector sin valor
    const elegidas: number[] = [];
    render(<SelectorEstrellas valor={0} onCambio={(n) => elegidas.push(n)} />);
    // When: se elige 4 estrellas
    fireEvent.click(screen.getByRole('radio', { name: '4 estrellas' }));
    // Then: el manejador recibe 4
    expect(elegidas).toEqual([4]);
  });

  test('Esc 3: con error resalta la sección y anuncia el mensaje', () => {
    // Given: un selector con error
    render(
      <SelectorEstrellas valor={0} onCambio={() => {}} error="Falta elegir" />
    );
    // Then: el grupo queda resaltado, inválido y asociado al mensaje
    const grupo = screen.getByRole('radiogroup', {
      name: 'Calificación en estrellas',
    });
    expect(grupo.className).toContain('ch-estrellas-input--error');
    expect(grupo.getAttribute('aria-invalid')).toBe('true');
    expect(grupo.getAttribute('aria-describedby')).toBe('ch-estrellas-error');
    expect(screen.getByRole('alert').textContent).toBe('Falta elegir');
  });

  test('deshabilitado no deja elegir', () => {
    // Given: un selector deshabilitado
    render(<SelectorEstrellas valor={0} onCambio={() => {}} disabled />);
    // Then: todas las opciones están deshabilitadas
    for (const o of screen.getAllByRole('radio')) {
      expect((o as HTMLButtonElement).disabled).toBe(true);
    }
  });
});
