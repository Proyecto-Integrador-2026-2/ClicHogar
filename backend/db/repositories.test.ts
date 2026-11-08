/**
 * Pruebas de los repositorios con un `sql` falso (sin Postgres): verifican
 * el mapeo snake_case -> camelCase, las ramas "no encontrado" y que las
 * escrituras viajen como parámetros.
 */
import { beforeEach, describe, expect, mock, test } from 'bun:test';

process.env.DATABASE_URL ??= 'postgres://test';

type Llamada = { texto: string; valores: unknown[] };
let llamadas: Llamada[] = [];
let respuestas: unknown[][] = [];

function responder() {
  return Promise.resolve(respuestas.shift() ?? []);
}

const sqlFalso = Object.assign(
  (strings: TemplateStringsArray, ...valores: unknown[]) => {
    llamadas.push({ texto: strings.join('?'), valores });
    return responder();
  },
  {
    begin: async (fn: (tx: unknown) => Promise<void>) => fn(sqlFalso),
    unsafe: (texto: string, valores: unknown[]) => {
      llamadas.push({ texto, valores });
      return responder();
    },
  }
);

mock.module('./client', () => ({ sql: sqlFalso }));

const { tareasRepository } =
  await import('../modules/tareas/repositories/tareas.repository');
const { usuariosRepository } =
  await import('../modules/usuarios/repositories/usuarios.repository');
const { disponibilidadRepository } =
  await import('../modules/usuarios/repositories/disponibilidad.repository');
const { sesionesRepository } =
  await import('../modules/auth/repositories/sesiones.repository');
const { ofertasRepository } =
  await import('../modules/ofertas/repositories/ofertas.repository');
const { chatRepository } =
  await import('../modules/chat/repositories/chat.repository');
const { calificacionesRepository } =
  await import('../modules/calificaciones/repositories/calificaciones.repository');

const FECHA = new Date('2026-01-01T00:00:00Z');

const FILA_USUARIO = {
  id: 'u1',
  nombre: 'Ana',
  email: 'ana@ejemplo.com',
  password_hash: null,
  rol: 'cliente',
  foto_url: null,
  descripcion: null,
  ubicacion: null,
  activo: true,
  creado_en: FECHA,
  actualizado_en: FECHA,
};

const FILA_TAREA = {
  id: 't1',
  usuario_id: 'u1',
  titulo: 'Arreglar grifo',
  descripcion: 'Gotea',
  categoria: 'plomeria',
  estado: 'abierta',
  ubicacion: 'Envigado',
  latitud: 6.1,
  longitud: -75.5,
  creado_en: FECHA,
  actualizado_en: FECHA,
};

beforeEach(() => {
  llamadas = [];
  respuestas = [];
});

describe('tareasRepository', () => {
  const nueva = {
    usuarioId: 'u1',
    titulo: 'Arreglar grifo',
    descripcion: 'Gotea',
    categoria: 'plomeria',
    estado: 'abierta',
    ubicacion: 'Envigado',
    latitud: 6.1,
    longitud: -75.5,
  } as never;

  test('crear mapea la fila insertada', async () => {
    // Given: un INSERT que devuelve la fila creada
    respuestas = [[FILA_TAREA]];
    // When: se crea la tarea
    const tarea = await tareasRepository.crear(nueva);
    // Then: la fila se mapea a camelCase y los valores viajan como parámetros
    expect(tarea.usuarioId).toBe('u1');
    expect(tarea.creadoEn).toBe(FECHA);
    expect(llamadas[0]?.valores).toContain('Arreglar grifo');
  });

  test('crear falla si el INSERT no devuelve fila', async () => {
    // Given: un INSERT que no devuelve fila
    respuestas = [[]];
    // When: se crea la tarea
    // Then: falla con 'No se pudo crear la tarea.'
    await expect(tareasRepository.crear(nueva)).rejects.toThrow(
      'No se pudo crear la tarea.'
    );
  });

  test('listarAbiertas incluye el nombre del autor', async () => {
    // Given: una fila de tarea con el nombre del autor
    respuestas = [[{ ...FILA_TAREA, autor_nombre: 'Ana' }]];
    // When: se listan las abiertas
    const lista = await tareasRepository.listarAbiertas({
      limite: 12,
      desplazamiento: 0,
    });
    // Then: llega la tarea con su autorNombre
    expect(lista).toHaveLength(1);
    expect(lista[0]?.autorNombre).toBe('Ana');
    expect(lista[0]?.tarea.id).toBe('t1');
  });

  test('listarAbiertas acepta filtro de cercanía', async () => {
    // Given: una fila de tarea con el nombre del autor
    respuestas = [[{ ...FILA_TAREA, autor_nombre: 'Ana' }]];
    // When: se listan las abiertas cerca de un punto
    const lista = await tareasRepository.listarAbiertas({
      limite: 12,
      desplazamiento: 12,
      cerca: { lat: 6.2, lng: -75.5, radio: 5 },
    });
    // Then: devuelve las filas de la consulta
    expect(lista).toHaveLength(1);
  });
});

describe('tareasRepository.buscarPorId (US-009)', () => {
  test('devuelve la tarea con los datos públicos del autor', async () => {
    // Given: una fila de tarea con las columnas del autor
    respuestas = [
      [
        {
          ...FILA_TAREA,
          autor_nombre: 'Ana',
          autor_descripcion: 'Plomera',
          autor_ubicacion: 'Envigado',
          autor_foto_url: '/f.jpg',
          ya_postulado: true,
        },
      ],
    ];
    // When: se busca por id
    const resultado = await tareasRepository.buscarPorId('t1', 'v1');
    // Then: devuelve tarea y autor mapeados, y consulta por ese id
    expect(resultado?.tarea.id).toBe('t1');
    expect(resultado?.autor).toEqual({
      id: 'u1',
      nombre: 'Ana',
      descripcion: 'Plomera',
      ubicacion: 'Envigado',
      fotoUrl: '/f.jpg',
    });
    expect(resultado?.yaPostulado).toBe(true);
    expect(llamadas[0]?.valores).toEqual(['v1', 't1']);
  });

  test('sin fila devuelve undefined', async () => {
    // Given: un repositorio sin esa tarea
    // When: se busca
    // Then: devuelve undefined
    expect(await tareasRepository.buscarPorId('x', 'v1')).toBeUndefined();
  });
});

describe('usuariosRepository', () => {
  test('buscarPorId / Id devuelven el usuario mapeado', async () => {
    // Given: una fila de usuario para cada búsqueda
    respuestas = [[FILA_USUARIO], [FILA_USUARIO]];
    // When: se busca por id dos veces
    // Then: cada búsqueda devuelve el usuario mapeado
    expect((await usuariosRepository.buscarPorId('c1'))?.nombre).toBe('Ana');
    expect((await usuariosRepository.buscarPorId('u1'))?.email).toBe(
      'ana@ejemplo.com'
    );
  });

  test('las búsquedas devuelven undefined si no hay fila', async () => {
    // Given: un repositorio sin filas
    // When: se hacen las dos búsquedas
    // Then: todas devuelven undefined
    expect(await usuariosRepository.buscarPorId('x')).toBeUndefined();
    expect(await usuariosRepository.buscarPorId('x')).toBeUndefined();
  });

  test('crear inserta (con y sin passwordHash) y mapea', async () => {
    // Given: un INSERT que devuelve la fila del usuario
    respuestas = [[FILA_USUARIO], [FILA_USUARIO]];
    // When: se crea con y sin passwordHash
    await usuariosRepository.crear({
      nombre: 'Ana',
      email: 'ana@ejemplo.com',
      passwordHash: 'h',
      rol: 'cliente',
    } as never);
    // Then: viajan como parámetros y se devuelve el usuario mapeado
    expect(llamadas[0]?.valores).toEqual([
      'Ana',
      'ana@ejemplo.com',
      'h',
      'cliente',
    ]);
    const sinOpcionales = await usuariosRepository.crear({
      nombre: 'Ana',
      email: 'ana@ejemplo.com',
      rol: 'cliente',
    } as never);
    expect(sinOpcionales.id).toBe('u1');
    expect(llamadas[1]?.valores).toContain(null);
  });

  test('crear falla si el INSERT no devuelve fila', async () => {
    // Given: un INSERT que no devuelve fila
    // When: se crea el usuario
    // Then: falla con 'No se pudo crear el usuario.'
    await expect(
      usuariosRepository.crear({
        nombre: 'A',
        email: 'a',
        rol: 'cliente',
      } as never)
    ).rejects.toThrow('No se pudo crear el usuario.');
  });

  test('actualizarParcial arma el UPDATE solo con los campos del patch', async () => {
    // Given: un patch con foto, descripción y ubicación
    respuestas = [[{ ...FILA_USUARIO, foto_url: '/f.jpg' }]];
    // When: se actualiza parcialmente
    const usuario = await usuariosRepository.actualizarParcial('u1', {
      fotoUrl: '/f.jpg',
      descripcion: 'Hola',
      ubicacion: 'Envigado',
    });
    // Then: el UPDATE solo nombra esas columnas y los valores van como parámetros
    expect(usuario.fotoUrl).toBe('/f.jpg');
    expect(llamadas[0]?.texto).toContain('"foto_url" = $1');
    expect(llamadas[0]?.texto).toContain('"descripcion" = $2');
    expect(llamadas[0]?.texto).toContain('"ubicacion" = $3');
    expect(llamadas[0]?.valores).toEqual(['/f.jpg', 'Hola', 'Envigado', 'u1']);
  });

  test('actualizarParcial sin campos devuelve el usuario intacto', async () => {
    // Given: un patch vacío y un usuario existente
    respuestas = [[FILA_USUARIO]];
    // When: se actualiza
    const usuario = await usuariosRepository.actualizarParcial('u1', {});
    // Then: devuelve el usuario intacto
    expect(usuario.id).toBe('u1');
  });

  test('actualizarParcial sin campos y sin usuario -> NotFound', async () => {
    // Given: un patch vacío y un usuario inexistente
    // When: se actualiza
    // Then: falla con 'Usuario no encontrado.'
    await expect(
      usuariosRepository.actualizarParcial('nope', {})
    ).rejects.toThrow('Usuario no encontrado.');
  });

  test('actualizarParcial con campos y sin fila -> NotFound', async () => {
    // Given: un patch con ubicación y un UPDATE que no encuentra fila
    // When: se actualiza
    // Then: falla con 'Usuario no encontrado.'
    await expect(
      usuariosRepository.actualizarParcial('nope', { ubicacion: 'x' })
    ).rejects.toThrow('Usuario no encontrado.');
  });
});

describe('disponibilidadRepository', () => {
  test('listarPorUsuarioId mapea las franjas', async () => {
    // Given: una fila de disponibilidad en snake_case
    respuestas = [[{ dia_semana: 1, franja_horaria: 'manana' }]];
    // When: se listan las franjas
    // Then: llegan en camelCase
    expect(await disponibilidadRepository.listarPorUsuarioId('u1')).toEqual([
      { diaSemana: 1, franjaHoraria: 'manana' },
    ]);
  });

  test('reemplazar borra, inserta cada slot y relee', async () => {
    // Given: dos franjas nuevas y un repositorio que relee una
    respuestas = [[], [], [], [{ dia_semana: 2, franja_horaria: 'tarde' }]];
    // When: se reemplaza la disponibilidad
    const resultado = await disponibilidadRepository.reemplazar('u1', [
      { diaSemana: 2, franjaHoraria: 'tarde' },
      { diaSemana: 3, franjaHoraria: 'noche' },
    ]);
    // Then: borra, inserta cada franja y devuelve lo releído
    expect(llamadas[0]?.texto).toContain('DELETE FROM disponibilidad');
    expect(llamadas.filter((l) => l.texto.includes('INSERT'))).toHaveLength(2);
    expect(resultado).toEqual([{ diaSemana: 2, franjaHoraria: 'tarde' }]);
  });

  test('reemplazar con arreglo vacío solo borra', async () => {
    // Given: un arreglo vacío de franjas
    // When: se reemplaza
    await disponibilidadRepository.reemplazar('u1', []);
    // Then: solo se borra, sin ningún INSERT
    expect(llamadas.filter((l) => l.texto.includes('INSERT'))).toHaveLength(0);
  });
});

describe('sesionesRepository', () => {
  test('crear inserta la sesión con el token y su vencimiento', async () => {
    // Given: un repositorio de sesiones
    const expira = new Date('2026-02-01T00:00:00Z');
    // When: se crea una sesión
    await sesionesRepository.crear('u1', 'tok', expira);
    // Then: usuario, token y vencimiento viajan como parámetros
    expect(llamadas[0]?.texto).toContain('INSERT INTO sesiones');
    expect(llamadas[0]?.valores).toEqual(['u1', 'tok', expira]);
  });

  test('buscarUsuarioIdPorToken devuelve el id o undefined', async () => {
    // Given: una sesión vigente y luego ninguna
    respuestas = [[{ usuario_id: 'u1' }], []];
    // When: se busca dos veces
    // Then: la primera devuelve el id y la segunda undefined
    expect(await sesionesRepository.buscarUsuarioIdPorToken('tok')).toBe('u1');
    expect(
      await sesionesRepository.buscarUsuarioIdPorToken('otro')
    ).toBeUndefined();
    expect(llamadas[0]?.texto).toContain('expira_en > now()');
  });

  test('eliminar borra por token', async () => {
    // When: se elimina una sesión
    await sesionesRepository.eliminar('tok');
    // Then: el DELETE recibe el token como parámetro
    expect(llamadas[0]?.texto).toContain('DELETE FROM sesiones');
    expect(llamadas[0]?.valores).toEqual(['tok']);
  });
});

describe('chatRepository', () => {
  const MENSAJE = {
    id: 'm1',
    remitente_id: 'u1',
    destinatario_id: 'u2',
    contenido: 'Hola',
    creado_en: FECHA,
  };

  test('crear inserta y devuelve el mensaje', async () => {
    // Given: un INSERT que devuelve la fila
    respuestas = [[MENSAJE]];
    // When: se crea un mensaje
    const mensaje = await chatRepository.crear('u1', 'u2', 'Hola');
    // Then: viaja como parámetros y devuelve la fila
    expect(llamadas[0]?.valores).toEqual(['u1', 'u2', 'Hola']);
    expect(mensaje).toEqual(MENSAJE);
  });

  test('crear falla si el INSERT no devuelve fila', async () => {
    // Given: un INSERT sin fila
    // When / Then: falla con el mensaje esperado
    await expect(chatRepository.crear('u1', 'u2', 'Hola')).rejects.toThrow(
      'No se pudo guardar el mensaje.'
    );
  });

  test('listarConversacion consulta ambos sentidos', async () => {
    // Given: una conversación con un mensaje
    respuestas = [[MENSAJE]];
    // When: se lista entre u1 y u2
    const lista = await chatRepository.listarConversacion('u1', 'u2');
    // Then: devuelve el mensaje y usa ambos ids en los dos sentidos
    expect(lista).toEqual([MENSAJE]);
    expect(llamadas[0]?.valores).toEqual(['u1', 'u2', 'u2', 'u1']);
  });
});

describe('calificacionesRepository', () => {
  const FILA = {
    id: 'c1',
    tarea_id: null,
    autor_id: 'u1',
    destinatario_id: 'u2',
    puntuacion: 5,
    comentario: null,
    creado_en: FECHA,
  };

  test('crear inserta y devuelve la calificación', async () => {
    // Given: un INSERT que devuelve la fila
    respuestas = [[FILA]];
    // When: se crea una calificación
    const resultado = await calificacionesRepository.crear({
      tareaId: null,
      autorId: 'u1',
      destinatarioId: 'u2',
      puntuacion: 5,
      comentario: null,
    });
    // Then: viaja como parámetros y devuelve la fila
    expect(llamadas[0]?.valores).toEqual([null, 'u1', 'u2', 5, null]);
    expect(resultado).toEqual(FILA);
  });

  test('crear falla si el INSERT no devuelve fila', async () => {
    // Given: un INSERT sin fila
    // When / Then: falla con el mensaje esperado
    await expect(
      calificacionesRepository.crear({
        tareaId: null,
        autorId: 'u1',
        destinatarioId: 'u2',
        puntuacion: 5,
        comentario: null,
      })
    ).rejects.toThrow('No se pudo guardar la calificación.');
  });

  test('listarPorDestinatario filtra por destinatario', async () => {
    // Given: una calificación recibida
    respuestas = [[FILA]];
    // When: se listan las de u2
    const lista = await calificacionesRepository.listarPorDestinatario('u2');
    // Then: devuelve la fila y consulta por u2
    expect(lista).toEqual([FILA]);
    expect(llamadas[0]?.valores).toEqual(['u2']);
  });
});

describe('ofertasRepository (US-011)', () => {
  const DATOS = {
    tareaId: 't1',
    afiliadoId: 'a1',
    mensaje: 'Tengo experiencia',
  };
  const FILA = {
    id: 'o1',
    tarea_id: 't1',
    afiliado_id: 'a1',
    mensaje: 'Tengo experiencia',
    estado: 'pendiente',
    creado_en: FECHA,
  };

  test('crear inserta con la condición de tarea abierta y devuelve la oferta', async () => {
    // Given: un INSERT que sí inserta la fila
    respuestas = [[FILA]];
    // When: se crea la oferta
    const resultado = await ofertasRepository.crear(DATOS);
    // Then: devuelve 'creada' mapeada, con el bloqueo FOR SHARE y ON CONFLICT
    expect(resultado).toEqual({
      tipo: 'creada',
      oferta: {
        id: 'o1',
        tareaId: 't1',
        afiliadoId: 'a1',
        mensaje: 'Tengo experiencia',
        estado: 'pendiente',
        creadoEn: FECHA,
      },
    });
    expect(llamadas[0]?.texto).toContain('FOR SHARE');
    expect(llamadas[0]?.texto).toContain('ON CONFLICT');
    expect(llamadas[0]?.valores).toEqual([
      't1',
      'a1',
      'Tengo experiencia',
      't1',
    ]);
    expect(llamadas).toHaveLength(1);
  });

  test('si no inserta y ya existía una oferta, es duplicada', async () => {
    // Given: un INSERT sin fila y una oferta previa del afiliado
    respuestas = [[], [{ existe: true }]];
    // When: se intenta crear
    // Then: resultado 'duplicada'
    expect(await ofertasRepository.crear(DATOS)).toEqual({
      tipo: 'duplicada',
    });
  });

  test('si no inserta y no había oferta previa, la tarea ya no está abierta', async () => {
    // Given: un INSERT sin fila y sin oferta previa
    respuestas = [[], [{ existe: false }]];
    // When: se intenta crear
    // Then: resultado 'no-abierta'
    expect(await ofertasRepository.crear(DATOS)).toEqual({
      tipo: 'no-abierta',
    });
    // Given: y si la consulta de verificación no devuelve fila
    respuestas = [[], []];
    // Then: también se trata como no abierta
    expect(await ofertasRepository.crear(DATOS)).toEqual({
      tipo: 'no-abierta',
    });
  });
});
