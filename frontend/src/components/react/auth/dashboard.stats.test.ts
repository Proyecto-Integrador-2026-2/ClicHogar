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
    // Given: un perfil sin foto, descripción ni ubicación
    // When: se calcula el resumen
    // Then: 0 % de avance y tres pendientes
    expect(resumenPerfil(perfilBase())).toEqual({
      completados: 0,
      total: 3,
      porcentaje: 0,
      pendientes: ['Foto', 'Descripción', 'Ubicación'],
    });
  });

  test('perfil completo: 100% sin pendientes', () => {
    // Given: un perfil con foto, descripción y ubicación
    // When: se calcula el resumen
    const resumen = resumenPerfil(
      perfilBase({
        fotoUrl: '/uploads/foto.jpg',
        descripcion: 'Plomera con 5 años',
        ubicacion: 'Chapinero',
      })
    );
    // Then: 100 % de avance y sin pendientes
    expect(resumen).toEqual({
      completados: 3,
      total: 3,
      porcentaje: 100,
      pendientes: [],
    });
  });

  test('texto solo con espacios no cuenta como lleno', () => {
    // Given: una descripción en blanco y una ubicación con espacios alrededor
    // When: se calcula el resumen
    const resumen = resumenPerfil(
      perfilBase({ descripcion: '   ', ubicacion: ' Chapinero ' })
    );
    // Then: la descripción en blanco no cuenta y queda 33 %
    expect(resumen.completados).toBe(1);
    expect(resumen.porcentaje).toBe(33);
    expect(resumen.pendientes).toEqual(['Foto', 'Descripción']);
  });
});

describe('contarAbiertas', () => {
  test('solo cuenta estado abierta', () => {
    // Given: dos tareas abiertas y una cerrada
    const tareas = [
      tareaBase({ id: 't-1', estado: 'abierta' }),
      tareaBase({ id: 't-2', estado: 'abierta' }),
      tareaBase({ id: 't-3', estado: 'cerrada' }),
    ];
    // When: se cuentan las abiertas
    // Then: el resultado es 2
    expect(contarAbiertas(tareas)).toBe(2);
  });

  test('lista vacía: cero', () => {
    // Given: una lista sin tareas
    // When: se cuentan las abiertas
    // Then: el resultado es 0
    expect(contarAbiertas([])).toBe(0);
  });
});

describe('etiquetaRol', () => {
  test('afiliado se presenta como Clic-Worker', () => {
    // Given: el rol afiliado
    // When: se pide su etiqueta
    // Then: se presenta como Clic-Worker
    expect(etiquetaRol('afiliado')).toBe('Clic-Worker');
  });

  test('cliente se presenta como Cliente', () => {
    // Given: el rol cliente
    // When: se pide su etiqueta
    // Then: se presenta como Cliente
    expect(etiquetaRol('cliente')).toBe('Cliente');
  });
});
