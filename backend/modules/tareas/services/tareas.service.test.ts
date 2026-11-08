/**
 * Pruebas de publicación de tareas (US-006, Esc 3-5).
 * Puras y sin BD: validan que lo corrupto se rechaza y lo válido se
 * normaliza (el INSERT se verifica en E2E contra Neon).
 */
import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test';
import {
  ConflictError,
  ForbiddenError,
  GoneError,
  NotFoundError,
  ValidationError,
} from '../../../shared/errors/app-error';
import { ESTADO_INICIAL_TAREA } from '../categorias';
import type { Tarea, UsuarioContacto } from '../entities/tarea.entity';
import { usuariosRepository } from '../../usuarios/repositories/usuarios.repository';
import type { Usuario } from '../../usuarios/entities/usuario.entity';
import { tareasRepository } from '../repositories/tareas.repository';
import { normalizarTarea } from '../validators/tarea.validator';
import {
  MENSAJE_NO_ASIGNADA,
  MENSAJE_PAGO_REQUERIDO,
  MENSAJE_SOLO_CREADOR_ASIGNA,
  MENSAJE_SOLO_CREADOR_FINALIZA,
  MENSAJE_YA_ASIGNADA,
  tareasService,
} from './tareas.service';

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
  const encontrada = (
    cambios: Partial<Tarea> = {},
    yaPostulado = false,
    asignado: UsuarioContacto | null = null
  ) =>
    spyOn(tareasRepository, 'buscarPorId').mockResolvedValue({
      tarea: tarea(cambios),
      autor: AUTOR,
      autorEmail: 'ana@ejemplo.com',
      yaPostulado,
      asignado,
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

  test('US-011 Esc 3: si ya se postuló, queda marcado y no puede ofertar de nuevo', async () => {
    // Given: una tarea abierta ajena a la que el afiliado ya se postuló
    const buscar = encontrada({}, true);
    // When: el afiliado pide el detalle
    const detalle = await tareasService.obtenerDetalle(AFILIADO, 't-1');
    // Then: yaPostulado y sin oferta; el repositorio recibió al visitante
    expect(detalle).toMatchObject({ yaPostulado: true, puedeOfertar: false });
    expect(buscar).toHaveBeenCalledWith('t-1', AFILIADO.id);
  });
});

describe('tareasService.listarPropias (US-012)', () => {
  afterEach(() => {
    mock.restore();
  });

  test('mapea las tareas del usuario con su número de ofertas', async () => {
    // Given: un repositorio con una tarea del usuario con 2 ofertas
    const listar = spyOn(tareasRepository, 'listarPorAutor').mockResolvedValue([
      {
        tarea: {
          id: 't-1',
          usuarioId: 'u-1',
          titulo: 'Arreglar grifo',
          descripcion:
            'El grifo de la cocina gotea día y noche, hay que repararlo.',
          categoria: 'Plomería',
          estado: 'abierta',
          ubicacion: 'Belén',
          latitud: null,
          longitud: null,
          creadoEn: new Date('2026-02-01T00:00:00.000Z'),
          actualizadoEn: new Date('2026-02-01T00:00:00.000Z'),
        },
        autorNombre: 'Ana',
        totalOfertas: 2,
      },
    ]);
    // When: se listan sus solicitudes
    const resultado = await tareasService.listarPropias('u-1');
    // Then: llegan en forma pública con el total de ofertas
    expect(listar).toHaveBeenCalledWith('u-1');
    expect(resultado).toHaveLength(1);
    expect(resultado[0]).toMatchObject({
      id: 't-1',
      autorNombre: 'Ana',
      totalOfertas: 2,
    });
  });
});

describe('tareasService: asignación, contacto y finalización (US-013 y US-014)', () => {
  afterEach(() => {
    mock.restore();
  });

  const AUTOR = { id: 'u-autor', rol: 'cliente' as const };
  const ELEGIDO = { id: 'u-elegido', rol: 'afiliado' as const };
  const OTRO = { id: 'u-otro', rol: 'afiliado' as const };
  const CONTACTO_ELEGIDO: UsuarioContacto = {
    id: ELEGIDO.id,
    nombre: 'José',
    email: 'jose@ejemplo.com',
  };

  const tarea = (cambios: Partial<Tarea> = {}): Tarea => ({
    id: 't-1',
    usuarioId: AUTOR.id,
    titulo: 'Arreglar grifo',
    descripcion: 'El grifo de la cocina gotea día y noche, hay que repararlo.',
    categoria: 'Plomería',
    estado: 'abierta',
    ubicacion: 'Belén',
    latitud: null,
    longitud: null,
    creadoEn: new Date('2026-02-01T00:00:00.000Z'),
    actualizadoEn: new Date('2026-02-01T00:00:00.000Z'),
    ...cambios,
  });
  const encontrada = (
    cambios: Partial<Tarea> = {},
    asignado: UsuarioContacto | null = null
  ) =>
    spyOn(tareasRepository, 'buscarPorId').mockResolvedValue({
      tarea: tarea(cambios),
      autor: {
        id: AUTOR.id,
        nombre: 'Ana',
        descripcion: null,
        ubicacion: null,
        fotoUrl: null,
      },
      autorEmail: 'ana@ejemplo.com',
      yaPostulado: false,
      asignado,
    });

  describe('obtenerDetalle: afiliado elegido y contacto', () => {
    test('Esc 2: asignada, el creador ve el contacto del afiliado y puede finalizar', async () => {
      // Given: una tarea asignada vista por su creador
      encontrada({ estado: 'asignada' }, CONTACTO_ELEGIDO);
      // When: pide el detalle
      const d = await tareasService.obtenerDetalle(AUTOR, 't-1');
      // Then: ve el contacto del afiliado, quién es y puede finalizar
      expect(d).toMatchObject({
        esPropia: true,
        esAsignado: false,
        puedeFinalizar: true,
        puedeOfertar: false,
        contacto: { nombre: 'José', email: 'jose@ejemplo.com' },
        afiliadoAsignado: { id: ELEGIDO.id, nombre: 'José' },
      });
    });

    test('Esc 2: el afiliado elegido sigue viendo la tarea con el contacto del creador y no puede finalizar', async () => {
      // Given: una tarea asignada vista por el afiliado elegido
      encontrada({ estado: 'asignada' }, CONTACTO_ELEGIDO);
      // When: pide el detalle
      const d = await tareasService.obtenerDetalle(ELEGIDO, 't-1');
      // Then: la ve (ya no está abierta) con el contacto del creador
      expect(d).toMatchObject({
        esAsignado: true,
        esPropia: false,
        puedeFinalizar: false,
        puedeOfertar: false,
        contacto: { nombre: 'Ana', email: 'ana@ejemplo.com' },
        afiliadoAsignado: null,
      });
    });

    test('un tercero no ve una tarea asignada ni su contacto', async () => {
      // Given: una tarea asignada a otra persona
      encontrada({ estado: 'asignada' }, CONTACTO_ELEGIDO);
      // When / Then: un afiliado ajeno recibe 410
      await expect(
        tareasService.obtenerDetalle(OTRO, 't-1')
      ).rejects.toBeInstanceOf(GoneError);
    });

    test('abierta o finalizada no revelan contacto', async () => {
      // Given / When / Then: abierta
      encontrada({ estado: 'abierta' });
      expect(
        (await tareasService.obtenerDetalle(AUTOR, 't-1')).contacto
      ).toBeNull();
      // Given / When / Then: finalizada (el creador la ve, sin contacto ni cierre)
      encontrada({ estado: 'finalizada' }, CONTACTO_ELEGIDO);
      const d = await tareasService.obtenerDetalle(AUTOR, 't-1');
      expect(d.contacto).toBeNull();
      expect(d.puedeFinalizar).toBe(false);
    });

    test('Esc 2 de la US-014: una tarea abierta no se puede finalizar desde el detalle', async () => {
      // Given: una tarea abierta propia
      encontrada({ estado: 'abierta' });
      // When: su creador pide el detalle
      const d = await tareasService.obtenerDetalle(AUTOR, 't-1');
      // Then: no se ofrece finalizar
      expect(d.puedeFinalizar).toBe(false);
    });
  });

  describe('asignar (US-013)', () => {
    test('Esc 1: el creador asigna una tarea abierta a la oferta elegida', async () => {
      // Given: una tarea abierta y un repositorio que asigna
      encontrada();
      const asignar = spyOn(tareasRepository, 'asignar').mockResolvedValue({
        tipo: 'asignada',
        afiliadoId: ELEGIDO.id,
      });
      // When: el creador elige la oferta
      const r = await tareasService.asignar(AUTOR, 't-1', 'o-1');
      // Then: queda asignada al afiliado de esa oferta
      expect(r).toEqual({
        tareaId: 't-1',
        estado: 'asignada',
        afiliadoId: ELEGIDO.id,
      });
      expect(asignar).toHaveBeenCalledWith({
        tareaId: 't-1',
        autorId: AUTOR.id,
        ofertaId: 'o-1',
      });
    });

    test('solo el creador asigna (403) y la tarea debe existir (404)', async () => {
      const asignar = spyOn(tareasRepository, 'asignar');
      // Given: una tarea de otra persona
      encontrada();
      // When / Then: 403
      await expect(tareasService.asignar(OTRO, 't-1', 'o-1')).rejects.toThrow(
        MENSAJE_SOLO_CREADOR_ASIGNA
      );
      // Given: una tarea inexistente
      spyOn(tareasRepository, 'buscarPorId').mockResolvedValue(undefined);
      // When / Then: 404
      await expect(
        tareasService.asignar(AUTOR, 'x', 'o-1')
      ).rejects.toBeInstanceOf(NotFoundError);
      expect(asignar).not.toHaveBeenCalled();
    });

    test('Esc 5: una tarea ya asignada responde 409 con el mensaje de la historia', async () => {
      // Given: una tarea que ya tiene afiliado
      encontrada({ estado: 'asignada' }, CONTACTO_ELEGIDO);
      const asignar = spyOn(tareasRepository, 'asignar');
      // When / Then: 409 sin tocar la escritura
      await expect(tareasService.asignar(AUTOR, 't-1', 'o-1')).rejects.toThrow(
        MENSAJE_YA_ASIGNADA
      );
      expect(asignar).not.toHaveBeenCalled();
    });

    test('Esc 5 en la escritura atómica: la carrera pierde y la oferta ajena no vale', async () => {
      // Given: una tarea que parecía abierta al leerla
      encontrada();
      const asignar = spyOn(tareasRepository, 'asignar');
      // When: otra sesión la asignó justo antes
      asignar.mockResolvedValue({ tipo: 'no-abierta' });
      // Then: 409
      await expect(
        tareasService.asignar(AUTOR, 't-1', 'o-1')
      ).rejects.toBeInstanceOf(ConflictError);
      // When: la oferta no es de esa tarea o ya no está pendiente
      asignar.mockResolvedValue({ tipo: 'oferta-invalida' });
      // Then: 404
      await expect(tareasService.asignar(AUTOR, 't-1', 'o-1')).rejects.toThrow(
        'Oferta no encontrada.'
      );
    });
  });

  describe('finalizar (US-014)', () => {
    test('Esc 1: el creador finaliza una tarea asignada confirmando el pago', async () => {
      // Given: una tarea asignada
      encontrada({ estado: 'asignada' }, CONTACTO_ELEGIDO);
      const fecha = new Date('2026-03-01T00:00:00.000Z');
      const finalizar = spyOn(tareasRepository, 'finalizar').mockResolvedValue({
        tipo: 'finalizada',
        afiliadoId: ELEGIDO.id,
        finalizadaEn: fecha,
      });
      // When: confirma el pago y finaliza
      const r = await tareasService.finalizar(AUTOR, 't-1', true);
      // Then: queda finalizada y devuelve el afiliado para calificarlo
      expect(r).toEqual({
        tareaId: 't-1',
        estado: 'finalizada',
        afiliadoId: ELEGIDO.id,
        finalizadaEn: fecha,
      });
      expect(finalizar).toHaveBeenCalledWith({
        tareaId: 't-1',
        autorId: AUTOR.id,
      });
    });

    test('exige confirmar el pago (400)', async () => {
      const buscar = spyOn(tareasRepository, 'buscarPorId');
      // Given / When / Then: sin confirmar el pago
      await expect(
        tareasService.finalizar(AUTOR, 't-1', false)
      ).rejects.toThrow(MENSAJE_PAGO_REQUERIDO);
      await expect(
        tareasService.finalizar(AUTOR, 't-1', false)
      ).rejects.toBeInstanceOf(ValidationError);
      expect(buscar).not.toHaveBeenCalled();
    });

    test('Esc 3: el afiliado asignado (o cualquiera) no puede finalizar (403)', async () => {
      // Given: una tarea asignada
      encontrada({ estado: 'asignada' }, CONTACTO_ELEGIDO);
      const finalizar = spyOn(tareasRepository, 'finalizar');
      // When / Then: el afiliado elegido recibe 403
      await expect(
        tareasService.finalizar(ELEGIDO, 't-1', true)
      ).rejects.toThrow(MENSAJE_SOLO_CREADOR_FINALIZA);
      await expect(
        tareasService.finalizar(OTRO, 't-1', true)
      ).rejects.toBeInstanceOf(ForbiddenError);
      expect(finalizar).not.toHaveBeenCalled();
    });

    test('Esc 2: una tarea abierta o ya finalizada no se puede finalizar (409)', async () => {
      const finalizar = spyOn(tareasRepository, 'finalizar');
      // Given / When / Then: abierta, finalizada y asignada-pero-cerrada
      for (const estado of ['abierta', 'finalizada', 'cancelada']) {
        encontrada({ estado });
        await expect(
          tareasService.finalizar(AUTOR, 't-1', true)
        ).rejects.toThrow(MENSAJE_NO_ASIGNADA);
      }
      expect(finalizar).not.toHaveBeenCalled();
    });

    test('una tarea inexistente da 404 y la escritura atómica evita el doble cierre', async () => {
      // Given: una tarea inexistente
      spyOn(tareasRepository, 'buscarPorId').mockResolvedValue(undefined);
      // When / Then: 404
      await expect(
        tareasService.finalizar(AUTOR, 'x', true)
      ).rejects.toBeInstanceOf(NotFoundError);
      // Given: una tarea que parecía asignada pero otra sesión la cerró antes
      encontrada({ estado: 'asignada' }, CONTACTO_ELEGIDO);
      spyOn(tareasRepository, 'finalizar').mockResolvedValue({
        tipo: 'no-asignada',
      });
      // When / Then: 409
      await expect(tareasService.finalizar(AUTOR, 't-1', true)).rejects.toThrow(
        MENSAJE_NO_ASIGNADA
      );
    });
  });
});
