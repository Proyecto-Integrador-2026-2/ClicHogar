/**
 * Los services reciben sus repositorios por parámetro (inyección de
 * dependencias): estas pruebas usan repositorios falsos en memoria, sin
 * `spyOn` ni `mock.module`.
 */
import { describe, expect, test } from 'bun:test';

process.env.DATABASE_URL ??= 'postgres://test';
process.env.CLERK_SECRET_KEY ??= 'sk_test';

const { crearTareasService } =
  await import('../../tareas/services/tareas.service');
const { crearDisponibilidadService } = await import('./disponibilidad.service');
const { crearPerfilService } = await import('./perfil.service');
const { crearRegistroService } = await import('./registro.service');
const { NotFoundError, ForbiddenError } =
  await import('../../../shared/errors/app-error');

import type { NuevoUsuario, Usuario } from '../entities/usuario.entity';
import type { SlotDisponibilidad } from '../ports';

const FECHA = new Date('2026-01-01T00:00:00Z');

function usuario(cambios: Partial<Usuario> = {}): Usuario {
  return {
    id: 'u1',
    clerkId: 'c1',
    nombre: 'Ana',
    email: 'ana@ejemplo.com',
    passwordHash: null,
    rol: 'cliente',
    fotoUrl: null,
    descripcion: null,
    ubicacion: null,
    activo: true,
    creadoEn: FECHA,
    actualizadoEn: FECHA,
    ...cambios,
  };
}

/** Repositorio de usuarios falso: un solo usuario en memoria. */
function usuariosFalso(existente?: Usuario) {
  const creados: NuevoUsuario[] = [];
  return {
    creados,
    buscarPorEmail: async () => existente,
    buscarPorClerkId: async () => existente,
    buscarPorId: async () => existente,
    crear: async (datos: NuevoUsuario) => {
      creados.push(datos);
      return usuario({ ...datos, id: 'nuevo' });
    },
    actualizarParcial: async (_id: string, patch: object) =>
      usuario({ ...existente, ...patch }),
  };
}

describe('tareas con repositorios inyectados', () => {
  const entrada = {
    titulo: 'Arreglar grifo',
    descripcion: 'El grifo de la cocina gotea día y noche, hay que repararlo.',
    categoria: 'Plomería',
    ubicacion: 'Belén',
  };

  test('crea la tarea con el autor y estado abierta', async () => {
    const guardadas: unknown[] = [];
    const service = crearTareasService({
      usuarios: usuariosFalso(usuario()),
      tareas: {
        crear: async (datos) => {
          guardadas.push(datos);
          return { ...datos, id: 't1', creadoEn: FECHA, actualizadoEn: FECHA };
        },
        listarAbiertas: async () => [],
      },
    });
    const tarea = await service.crearTarea('c1', entrada);
    expect(tarea.autorNombre).toBe('Ana');
    expect(guardadas[0]).toMatchObject({ usuarioId: 'u1', estado: 'abierta' });
    expect(await service.listarAbiertas()).toEqual([]);
  });

  test('404 si el usuario no tiene perfil local', async () => {
    const service = crearTareasService({
      usuarios: usuariosFalso(undefined),
      tareas: {
        crear: async () => Promise.reject(),
        listarAbiertas: async () => [],
      },
    });
    await expect(service.crearTarea('c1', entrada)).rejects.toThrow(
      NotFoundError
    );
  });
});

describe('disponibilidad con repositorios inyectados', () => {
  const slots: SlotDisponibilidad[] = [
    { diaSemana: 1, franjaHoraria: 'tarde' },
  ];
  const disponibilidad = {
    listarPorUsuarioId: async () => slots,
    reemplazar: async (_id: string, nuevos: SlotDisponibilidad[]) => nuevos,
  };

  test('un afiliado guarda y lee su matriz', async () => {
    const service = crearDisponibilidadService({
      usuarios: usuariosFalso(usuario({ rol: 'afiliado' })),
      disponibilidad,
    });
    expect(await service.guardar('c1', [{ dia: 1, franja: 'tarde' }])).toEqual(
      slots
    );
    expect(await service.obtener('c1')).toEqual(slots);
  });

  test('un cliente recibe 403', async () => {
    const service = crearDisponibilidadService({
      usuarios: usuariosFalso(usuario()),
      disponibilidad,
    });
    await expect(service.guardar('c1', [])).rejects.toThrow(ForbiddenError);
  });
});

describe('perfil con repositorio inyectado', () => {
  test('actualiza solo los campos recibidos', async () => {
    const service = crearPerfilService(usuariosFalso(usuario()));
    const perfil = await service.actualizarPerfil({
      clerkId: 'c1',
      ubicacion: '  Envigado  ',
    });
    expect(perfil.ubicacion).toBe('Envigado');
  });
});

describe('registro con repositorio inyectado', () => {
  test('crea el usuario si no existe', async () => {
    const repo = usuariosFalso(undefined);
    const service = crearRegistroService(repo);
    const { creado } = await service.sincronizarDesdeClerk(
      { clerkId: 'c9', email: 'x@y.co', nombre: 'Luis', rolClerk: 'afiliado' },
      {}
    );
    expect(creado).toBe(true);
    expect(repo.creados[0]).toMatchObject({ clerkId: 'c9', rol: 'afiliado' });
  });

  test('devuelve el existente sin crear otro', async () => {
    const repo = usuariosFalso(usuario());
    const service = crearRegistroService(repo);
    const { creado } = await service.sincronizarDesdeClerk(
      {
        clerkId: 'c1',
        email: 'ana@ejemplo.com',
        nombre: 'Ana',
        rolClerk: undefined,
      },
      {}
    );
    expect(creado).toBe(false);
    expect(repo.creados).toHaveLength(0);
  });
});
