/**
 * Pruebas de publicación de tareas (US-006, Esc 3-5).
 * Puras y sin BD: validan que lo corrupto se rechaza y lo válido se
 * normaliza (el INSERT se verifica en E2E contra Neon).
 */
import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test';
import {
  GoneError,
  NotFoundError,
  ValidationError,
} from '../../../shared/errors/app-error';
import { ESTADO_INICIAL_TAREA } from '../categorias';
import type { Tarea } from '../entities/tarea.entity';
import { usuariosRepository } from '../../usuarios/repositories/usuarios.repository';
import type { Usuario } from '../../usuarios/entities/usuario.entity';
import { tareasRepository } from '../repositories/tareas.repository';
import { normalizarTarea } from '../validators/tarea.validator';
import { tareasService } from './tareas.service';

const VALIDA = {
  titulo: 'Arreglar grifo que gotea',
  descripcion: 'El grifo de la cocina gotea día y noche y ya manchó el mueble.',
  categoria: 'Plomería',
  ubicacion: 'Belén, Medellín',
};

describe('normalizarTarea', () => {
  test('acepta una solicitud válida y recorta espacios', () => {
    // Given: una solicitud válida con el título rodeado de espacios
    // When: se normaliza
    // Then: el título queda recortado y las coordenadas en null
    expect(
      normalizarTarea({ ...VALIDA, titulo: '  Arreglar grifo  ' })
    ).toEqual({
      titulo: 'Arreglar grifo',
      descripcion: VALIDA.descripcion,
      categoria: 'Plomería',
      ubicacion: 'Belén, Medellín',
      latitud: null,
      longitud: null,
    });
  });

  test('rechaza título vacío (Escenario 3)', () => {
    // Given: un título compuesto solo de espacios
    // When: se normaliza la solicitud
    // Then: lanza ValidationError
    expect(() => normalizarTarea({ ...VALIDA, titulo: '   ' })).toThrow(
      ValidationError
    );
  });

  test('rechaza descripción corta o larga (Escenario 5)', () => {
    // Given: una descripción de 9 caracteres y otra de 1001
    // When: se normaliza cada una
    // Then: ambas se rechazan con ValidationError
    expect(() =>
      normalizarTarea({ ...VALIDA, descripcion: 'Muy corta' })
    ).toThrow('Por favor, proporciona más detalles (mínimo 20 caracteres)...');
    expect(() =>
      normalizarTarea({ ...VALIDA, descripcion: 'x'.repeat(1001) })
    ).toThrow(ValidationError);
  });

  test('rechaza categoría fuera del vocabulario', () => {
    // Given: una categoría que no existe en el vocabulario
    // When: se normaliza la solicitud
    // Then: lanza el mensaje de categoría no válida
    expect(() =>
      normalizarTarea({ ...VALIDA, categoria: 'Astronauta' })
    ).toThrow('La categoría no es válida.');
  });

  test('rechaza ubicación vacía (Escenario 3)', () => {
    // Given: una ubicación vacía
    // When: se normaliza la solicitud
    // Then: lanza ValidationError
    expect(() => normalizarTarea({ ...VALIDA, ubicacion: '' })).toThrow(
      ValidationError
    );
  });

  test('acepta coordenadas válidas y rechaza fuera de rango', () => {
    // Given: coordenadas válidas y otras fuera de rango
    // When: se normaliza cada solicitud
    // Then: las válidas se aceptan y las fuera de rango lanzan ValidationError
    expect(
      normalizarTarea({ ...VALIDA, latitud: 6.25, longitud: -75.59 })
    ).toMatchObject({ latitud: 6.25, longitud: -75.59 });
    expect(() =>
      normalizarTarea({ ...VALIDA, latitud: 200, longitud: 0 })
    ).toThrow(ValidationError);
  });

  test('el estado inicial es abierta (#118)', () => {
    // Given: la constante del estado inicial de una tarea
    // When: se lee su valor
    // Then: es 'abierta'
    expect(ESTADO_INICIAL_TAREA).toBe('abierta');
  });
});

describe('tareasService con repositorios simulados (sin Postgres)', () => {
  afterEach(() => {
    mock.restore();
  });

  const autor: Usuario = {
    id: 'u-1',
    nombre: 'Ana',
    email: 'ana@ejemplo.com',
    passwordHash: null,
    rol: 'cliente',
    fotoUrl: null,
    descripcion: null,
    ubicacion: null,
    activo: true,
    creadoEn: new Date('2026-01-01T00:00:00.000Z'),
    actualizadoEn: new Date('2026-01-01T00:00:00.000Z'),
  };

  test('crearTarea exige perfil local (404)', async () => {
    // Given: un usuario sin perfil local en la base
    spyOn(usuariosRepository, 'buscarPorId').mockResolvedValue(undefined);
    // When: se intenta crear una tarea
    // Then: falla con NotFoundError
    await expect(
      tareasService.crearTarea('u-x', VALIDA)
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  test('crearTarea fija estado abierta y nombra al autor', async () => {
    // Given: un autor existente y un repositorio que guarda lo recibido
    spyOn(usuariosRepository, 'buscarPorId').mockResolvedValue(autor);
    const crear = spyOn(tareasRepository, 'crear');
    crear.mockImplementation(async (nueva) => ({
      id: 't-1',
      ...nueva,
      creadoEn: new Date('2026-02-01T00:00:00.000Z'),
      actualizadoEn: new Date('2026-02-01T00:00:00.000Z'),
    }));

    // When: se crea la tarea
    const resultado = await tareasService.crearTarea('u-1', VALIDA);

    // Then: se guarda con estado 'abierta' y el resultado nombra al autor
    expect(crear).toHaveBeenCalledWith({
      usuarioId: 'u-1',
      titulo: VALIDA.titulo,
      descripcion: VALIDA.descripcion,
      categoria: 'Plomería',
      ubicacion: VALIDA.ubicacion,
      latitud: null,
      longitud: null,
      estado: 'abierta',
    });
    expect(resultado.estado).toBe('abierta');
    expect(resultado.autorNombre).toBe('Ana');
  });

  test('listarAbiertas mapea filas a forma pública', async () => {
    // Given: un repositorio con una tarea abierta de Luis
    const tarea: Tarea = {
      id: 't-7',
      usuarioId: 'u-2',
      titulo: 'Pintar sala',
      descripcion: 'Dos manos de pintura blanca en sala-comedor.',
      categoria: 'Limpieza',
      estado: 'abierta',
      ubicacion: 'Chapinero',
      latitud: null,
      longitud: null,
      creadoEn: new Date('2026-02-01T00:00:00.000Z'),
      actualizadoEn: new Date('2026-02-01T00:00:00.000Z'),
    };
    spyOn(tareasRepository, 'listarAbiertas').mockResolvedValue([
      { tarea, autorNombre: 'Luis' },
    ]);

    // When: se listan las abiertas
    const resultado = await tareasService.listarAbiertas();

    // Then: llega una tarea en forma pública con su autor y sin más páginas
    expect(resultado.tareas).toHaveLength(1);
    expect(resultado.tareas[0]).toMatchObject({
      id: 't-7',
      autorNombre: 'Luis',
      estado: 'abierta',
    });
    expect(resultado).toMatchObject({ pagina: 1, limite: 12, hayMas: false });
  });

  describe('listarAbiertas: paginación y cercanía (US-008)', () => {
    const fila = (n: number) => ({
      tarea: {
        id: `t-${n}`,
        usuarioId: 'u-2',
        titulo: `Tarea ${n}`,
        descripcion: 'Descripción de la tarea de prueba.',
        categoria: 'Limpieza' as const,
        estado: 'abierta',
        ubicacion: 'Laureles',
        latitud: null,
        longitud: null,
        creadoEn: new Date('2026-02-01T00:00:00.000Z'),
        actualizadoEn: new Date('2026-02-01T00:00:00.000Z'),
      },
      autorNombre: 'Luis',
    });

    test('pide una fila extra y marca hayMas si existe', async () => {
      // Given: un repositorio con 3 filas para una página de 2
      const listar = spyOn(
        tareasRepository,
        'listarAbiertas'
      ).mockResolvedValue([fila(1), fila(2), fila(3)]);
      // When: se pide la página 2 con límite 2
      const resultado = await tareasService.listarAbiertas({
        pagina: 2,
        limite: 2,
      });
      // Then: consulta limite+1 con el desplazamiento y recorta la sobrante
      expect(listar).toHaveBeenCalledWith({
        limite: 3,
        desplazamiento: 2,
        cerca: undefined,
      });
      expect(resultado.tareas.map((t) => t.id)).toEqual(['t-1', 't-2']);
      expect(resultado).toMatchObject({ pagina: 2, limite: 2, hayMas: true });
    });

    test('limita el tamaño de página al máximo', async () => {
      // Given: un repositorio vacío
      const listar = spyOn(
        tareasRepository,
        'listarAbiertas'
      ).mockResolvedValue([]);
      // When: se pide un límite enorme
      const resultado = await tareasService.listarAbiertas({ limite: 500 });
      // Then: se recorta al máximo permitido
      expect(resultado.limite).toBe(50);
      expect(listar).toHaveBeenCalledWith(
        expect.objectContaining({ limite: 51 })
      );
    });

    test('pasa el filtro de cercanía al repositorio', async () => {
      // Given: un repositorio vacío
      const listar = spyOn(
        tareasRepository,
        'listarAbiertas'
      ).mockResolvedValue([]);
      // When: se pide con lat, lng y radio
      await tareasService.listarAbiertas({ lat: 6.2, lng: -75.5, radio: 5 });
      // Then: el repositorio recibe el filtro
      expect(listar).toHaveBeenCalledWith(
        expect.objectContaining({ cerca: { lat: 6.2, lng: -75.5, radio: 5 } })
      );
    });

    test.each([
      [{ pagina: 0 }],
      [{ pagina: 1.5 }],
      [{ limite: -1 }],
      [{ lat: 6.2 }],
      [{ lat: 6.2, lng: -75.5 }],
      [{ lat: 95, lng: 0, radio: 5 }],
      [{ lat: 0, lng: 200, radio: 5 }],
      [{ lat: 0, lng: 0, radio: 0 }],
      [{ lat: Number.NaN, lng: 0, radio: 5 }],
    ])('rechaza consultas inválidas %j', async (consulta) => {
      // Given: una consulta con paginación o cercanía inválida
      spyOn(tareasRepository, 'listarAbiertas').mockResolvedValue([]);
      // When: se intenta listar
      // Then: falla con ValidationError
      await expect(
        tareasService.listarAbiertas(consulta)
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });
});

describe('tareasService.obtenerDetalle (US-009)', () => {
  afterEach(() => {
    mock.restore();
  });

  const tarea = (cambios: Partial<Tarea> = {}): Tarea => ({
    id: 't-1',
    usuarioId: 'u-autor',
    titulo: 'Arreglar grifo',
    descripcion: 'El grifo de la cocina gotea día y noche, hay que repararlo.',
    categoria: 'Plomería',
    estado: 'abierta',
    ubicacion: 'Belén',
    latitud: 6.244203,
    longitud: -75.581211,
    creadoEn: new Date('2026-02-01T00:00:00.000Z'),
    actualizadoEn: new Date('2026-02-01T00:00:00.000Z'),
    ...cambios,
  });
  const AUTOR = {
    id: 'u-autor',
    nombre: 'Ana',
    descripcion: null,
    ubicacion: null,
    fotoUrl: null,
  };
  const encontrada = (cambios: Partial<Tarea> = {}) =>
    spyOn(tareasRepository, 'buscarPorId').mockResolvedValue({
      tarea: tarea(cambios),
      autor: AUTOR,
    });
  const AFILIADO = { id: 'u-afiliado', rol: 'afiliado' as const };
  const CLIENTE = { id: 'u-cliente', rol: 'cliente' as const };

  test('Esc 1-2: un afiliado ve el detalle de una tarea abierta y puede ofertar', async () => {
    // Given: una tarea abierta de otra persona
    encontrada();
    // When: un afiliado pide el detalle
    const detalle = await tareasService.obtenerDetalle(AFILIADO, 't-1');
    // Then: ve todo (con el autor) y puede ofertar; la ubicación va aproximada
    expect(detalle).toMatchObject({
      titulo: 'Arreglar grifo',
      autor: AUTOR,
      esPropia: false,
      puedeOfertar: true,
      latitud: 6.24,
      longitud: -75.58,
    });
  });

  test('un cliente ve el detalle pero no puede ofertar', async () => {
    // Given: una tarea abierta de otra persona
    encontrada();
    // When: un usuario con rol cliente pide el detalle
    const detalle = await tareasService.obtenerDetalle(CLIENTE, 't-1');
    // Then: la ve sin poder ofertar
    expect(detalle.puedeOfertar).toBe(false);
    expect(detalle.esPropia).toBe(false);
  });

  test('Esc 4: el autor ve su tarea completa y sin oferta, aunque sea afiliado', async () => {
    // Given: una tarea abierta publicada por un afiliado
    encontrada({ usuarioId: AFILIADO.id });
    // When: ese mismo afiliado pide el detalle
    const detalle = await tareasService.obtenerDetalle(AFILIADO, 't-1');
    // Then: la ve con el punto exacto, marcada como propia y sin oferta
    expect(detalle).toMatchObject({
      esPropia: true,
      puedeOfertar: false,
      latitud: 6.244203,
    });
  });

  test('Esc 3: una tarea asignada o finalizada ya no está disponible (410)', async () => {
    // Given / When / Then: asignada, finalizada o cancelada para un tercero
    for (const estado of ['asignada', 'finalizada', 'cancelada']) {
      encontrada({ estado });
      await expect(
        tareasService.obtenerDetalle(AFILIADO, 't-1')
      ).rejects.toBeInstanceOf(GoneError);
    }
  });

  test('el autor puede ver su tarea aunque ya no esté abierta, sin oferta', async () => {
    // Given: una tarea asignada del propio usuario
    encontrada({ estado: 'asignada', usuarioId: AFILIADO.id });
    // When: su autor pide el detalle
    const detalle = await tareasService.obtenerDetalle(AFILIADO, 't-1');
    // Then: la ve, con su estado y sin poder ofertar
    expect(detalle).toMatchObject({
      estado: 'asignada',
      esPropia: true,
      puedeOfertar: false,
    });
  });

  test('una tarea inexistente responde NotFoundError', async () => {
    // Given: un repositorio sin esa tarea
    spyOn(tareasRepository, 'buscarPorId').mockResolvedValue(undefined);
    // When: se pide el detalle
    // Then: falla con NotFoundError
    await expect(
      tareasService.obtenerDetalle(AFILIADO, 'no-existe')
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
