/**
 * Pruebas del puntaje en estrellas (US-012, Escenario 5).
 */
import { afterEach, describe, expect, test } from 'bun:test';
import { cleanup, render, screen } from '@testing-library/react';
import React from 'react';
import Estrellas, { formatearPromedio } from './Estrellas';

afterEach(cleanup);

describe('Estrellas', () => {
  test('sin promedio dice "Sin calificaciones"', () => {
    // Given: un afiliado sin calificaciones
    // When: se renderiza
    render(<Estrellas promedio={null} total={0} />);
    // Then: no dibuja estrellas
    expect(screen.getByText('Sin calificaciones')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
  });

  test('dibuja las estrellas redondeadas y describe el puntaje para lectores', () => {
    // Given: un promedio de 4,3 con 2 calificaciones
    // When: se renderiza
    const { container } = render(<Estrellas promedio={4.3} total={2} />);
    // Then: 4 llenas y 1 vacía, con el promedio y su descripción accesible
    expect(container.textContent).toContain('★★★★☆');
    expect(container.textContent).toContain('4,3 (2)');
    expect(
      screen.getByRole('img', { name: '4,3 de 5 estrellas, 2 calificaciones' })
    ).toBeTruthy();
  });

  test('una sola calificación va en singular y 5 llena todas', () => {
    // Given: un promedio de 5 con una calificación
    // When: se renderiza
    const { container } = render(<Estrellas promedio={5} total={1} />);
    // Then: 5 estrellas llenas y "calificación" en singular
    expect(container.textContent).toContain('★★★★★');
    expect(
      screen.getByRole('img', { name: '5,0 de 5 estrellas, 1 calificación' })
    ).toBeTruthy();
  });

  test('formatearPromedio usa coma y un decimal', () => {
    // Given: promedios con y sin decimales
    // When: se formatean
    // Then: siempre un decimal con coma
    expect(formatearPromedio(4)).toBe('4,0');
    expect(formatearPromedio(3.75)).toBe('3,8');
  });
});
