/**
 * Pruebas de la lógica pura del dashboard. Sin Clerk ni red: solo
 * `dashboard.stats.ts` con perfiles y tareas de juguete.
 */
import { describe, expect, test } from 'bun:test';
import { contarAbiertas, etiquetaRol, resumenPerfil } from './dashboard.stats';
import type { TareaTablero, UsuarioPublico } from '../../../lib/usuarios-api';

function perfilBase(cambios: Partial<UsuarioPublico> = {}): UsuarioPublico {
  return {
    id: 'u-1',
    nombre: 'Ana',
    email: 'ana@ejemplo.com',
    rol: 'cliente',
    fotoUrl: null,
    descripcion: null,
    ubicacion: null,
    creadoEn: '2026-01-01T00:00:00.000Z',
    ...cambios,
  };
}

function tareaBase(cambios: Partial<TareaTablero> = {}): TareaTablero {
  return {
    id: 't-1',
    titulo: 'Pintar sala',
    descripcion: 'Dos manos de pintura blanca',
    categoria: 'Pintura',
    estado: 'abierta',
    ubicacion: 'Chapinero',
    autorNombre: 'Ana',
    creadoEn: '2026-02-01T00:00:00.000Z',
    ...cambios,
  };
}

describe('resumenPerfil', () => {
  test('perfil vacío: 0% y tres pendientes', () => {
    expect(resumenPerfil(perfilBase())).toEqual({
      completados: 0,
      total: 3,
      porcentaje: 0,
      pendientes: ['Foto', 'Descripción', 'Ubicación'],
    });
  });

  test('perfil completo: 100% sin pendientes', () => {
    const resumen = resumenPerfil(
      perfilBase({
        fotoUrl: '/uploads/foto.jpg',
        descripcion: 'Plomera con 5 años',
        ubicacion: 'Chapinero',
      })
    );
    expect(resumen).toEqual({
      completados: 3,
      total: 3,
      porcentaje: 100,
      pendientes: [],
    });
  });

  test('texto solo con espacios no cuenta como lleno', () => {
    const resumen = resumenPerfil(
      perfilBase({ descripcion: '   ', ubicacion: ' Chapinero ' })
    );
    expect(resumen.completados).toBe(1);
    expect(resumen.porcentaje).toBe(33);
    expect(resumen.pendientes).toEqual(['Foto', 'Descripción']);
  });
});

describe('contarAbiertas', () => {
  test('solo cuenta estado abierta', () => {
    const tareas = [
      tareaBase({ id: 't-1', estado: 'abierta' }),
      tareaBase({ id: 't-2', estado: 'abierta' }),
      tareaBase({ id: 't-3', estado: 'cerrada' }),
    ];
    expect(contarAbiertas(tareas)).toBe(2);
  });

  test('lista vacía: cero', () => {
    expect(contarAbiertas([])).toBe(0);
  });
});

describe('etiquetaRol', () => {
  test('afiliado se presenta como Clic-Worker', () => {
    expect(etiquetaRol('afiliado')).toBe('Clic-Worker');
  });

  test('cliente se presenta como Cliente', () => {
    expect(etiquetaRol('cliente')).toBe('Cliente');
  });
});
