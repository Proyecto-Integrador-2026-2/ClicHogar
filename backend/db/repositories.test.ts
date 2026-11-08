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
          autor_email: 'ana@ejemplo.com',
          ya_postulado: true,
          asignado_id: 'a1',
          asignado_nombre: 'José',
          asignado_email: 'jose@ejemplo.com',
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
    expect(resultado?.autorEmail).toBe('ana@ejemplo.com');
    expect(resultado?.asignado).toEqual({
      id: 'a1',
      nombre: 'José',
      email: 'jose@ejemplo.com',
    });
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

describe('calificacionesRepository (US-016)', () => {
  const FILA = {
    id: 'c1',
    tarea_id: 't1',
    autor_id: 'u1',
    destinatario_id: 'u2',
    puntuacion: 5,
    comentario: 'Muy bien',
    creado_en: FECHA,
  };
  const DATOS = {
    tareaId: 't1',
    autorId: 'u1',
    puntuacion: 5,
    comentario: 'Muy bien',
  };

  test('crearParaTarea inserta solo si la tarea es del autor y está finalizada', async () => {
    // Given: un INSERT que sí inserta la fila
    respuestas = [[FILA]];
    // When: se califica la tarea
    const resultado = await calificacionesRepository.crearParaTarea(DATOS);
    // Then: devuelve la calificación y la sentencia exige tarea propia, finalizada y con afiliado
    expect(resultado).toEqual({ tipo: 'creada', calificacion: FILA });
    expect(llamadas[0]?.texto).toContain("estado = 'finalizada'");
    expect(llamadas[0]?.texto).toContain('afiliado_asignado_id IS NOT NULL');
    expect(llamadas[0]?.texto).toContain(
      'ON CONFLICT (tarea_id, autor_id) DO NOTHING'
    );
    expect(llamadas[0]?.valores).toEqual([5, 'Muy bien', 't1', 'u1']);
    expect(llamadas).toHaveLength(1);
  });

  test('si no inserta y ya había una calificación, es duplicada', async () => {
    // Given: un INSERT sin fila y una calificación previa
    respuestas = [[], [{ existe: true }]];
    // When / Then: 'duplicada'
    expect(await calificacionesRepository.crearParaTarea(DATOS)).toEqual({
      tipo: 'duplicada',
    });
  });

  test('si no inserta y no había calificación, la tarea no es elegible', async () => {
    // Given: un INSERT sin fila y sin calificación previa
    respuestas = [[], [{ existe: false }]];
    // When / Then: 'no-elegible'
    expect(await calificacionesRepository.crearParaTarea(DATOS)).toEqual({
      tipo: 'no-elegible',
    });
  });

  test('existe devuelve false si la consulta no trae fila', async () => {
    // Given: una consulta sin filas
    // When / Then: false
    expect(await calificacionesRepository.existe('t1', 'u1')).toBe(false);
    // Given: una consulta con existencia
    respuestas = [[{ existe: true }]];
    // When / Then: true y consulta por tarea y autor
    expect(await calificacionesRepository.existe('t1', 'u1')).toBe(true);
    expect(llamadas[1]?.valores).toEqual(['t1', 'u1']);
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

describe('ofertasRepository.listarPorTarea (US-012)', () => {
  const FILA = {
    id: 'o1',
    tarea_id: 't1',
    afiliado_id: 'a1',
    mensaje: 'Tengo experiencia',
    estado: 'pendiente',
    creado_en: FECHA,
    afiliado_nombre: 'José',
    afiliado_foto_url: '/f.jpg',
    afiliado_descripcion: 'Plomero',
    afiliado_ubicacion: 'Envigado',
    promedio: 4.5,
    total_calificaciones: 2,
  };

  test('devuelve las ofertas con el afiliado y su reputación', async () => {
    // Given: una fila con el afiliado y su promedio
    respuestas = [[FILA]];
    // When: se listan las ofertas de la tarea
    const lista = await ofertasRepository.listarPorTarea('t1');
    // Then: mapea la oferta y el afiliado, y consulta con orden por reputación
    expect(lista).toEqual([
      {
        id: 'o1',
        mensaje: 'Tengo experiencia',
        estado: 'pendiente',
        creadoEn: FECHA,
        afiliado: {
          id: 'a1',
          nombre: 'José',
          fotoUrl: '/f.jpg',
          descripcion: 'Plomero',
          ubicacion: 'Envigado',
          promedio: 4.5,
          totalCalificaciones: 2,
        },
      },
    ]);
    expect(llamadas[0]?.texto).toContain('NULLS LAST');
    expect(llamadas[0]?.valores).toEqual(['t1']);
  });

  test('un afiliado sin calificaciones llega con promedio null', async () => {
    // Given: una fila sin promedio
    respuestas = [[{ ...FILA, promedio: null, total_calificaciones: 0 }]];
    // When: se listan
    const [oferta] = await ofertasRepository.listarPorTarea('t1');
    // Then: promedio null y 0 calificaciones
    expect(oferta?.afiliado.promedio).toBeNull();
    expect(oferta?.afiliado.totalCalificaciones).toBe(0);
  });
});

describe('tareasRepository.listarPorAutor (US-012)', () => {
  test('devuelve las tareas del usuario con su número de ofertas', async () => {
    // Given: una fila de tarea con 3 ofertas
    respuestas = [
      [
        {
          ...FILA_TAREA,
          autor_nombre: 'Ana',
          total_ofertas: 3,
          calificacion_pendiente: true,
        },
      ],
    ];
    // When: se listan las del usuario
    const lista = await tareasRepository.listarPorAutor('u1');
    // Then: mapea tarea, autor y total, y filtra por el usuario
    expect(lista).toHaveLength(1);
    expect(lista[0]?.tarea.id).toBe('t1');
    expect(lista[0]?.autorNombre).toBe('Ana');
    expect(lista[0]?.totalOfertas).toBe(3);
    expect(lista[0]?.calificacionPendiente).toBe(true);
    expect(llamadas[0]?.valores).toEqual(['u1']);
  });
});

describe('listados de chat y calificaciones devuelven arrays planos', () => {
  /** Imita el resultado de Bun SQL: una subclase de Array con filas dentro. */
  class ResultadoSql<T> extends Array<T> {}
  const comoResultadoSql = <T>(filas: T[]) => ResultadoSql.from(filas);

  test('listarConversacion y listarPorDestinatario no filtran la subclase de SQL', async () => {
    // Given: consultas que devuelven la subclase de Array de Bun SQL
    respuestas = [
      comoResultadoSql([
        {
          id: 'm1',
          remitente_id: 'u1',
          destinatario_id: 'u2',
          contenido: 'Hola',
          creado_en: FECHA,
        },
      ]),
      comoResultadoSql([
        {
          id: 'c1',
          tarea_id: null,
          autor_id: 'u1',
          destinatario_id: 'u2',
          puntuacion: 5,
          comentario: null,
          creado_en: FECHA,
        },
      ]),
    ];
    // When: se listan la conversación y las calificaciones
    const mensajes = await chatRepository.listarConversacion('u1', 'u2');
    const calificaciones =
      await calificacionesRepository.listarPorDestinatario('u2');
    // Then: son arrays planos (Elysia solo añade CORS a respuestas JSON normales)
    expect(Object.getPrototypeOf(mensajes)).toBe(Array.prototype);
    expect(Object.getPrototypeOf(calificaciones)).toBe(Array.prototype);
    expect(mensajes).toHaveLength(1);
    expect(calificaciones).toHaveLength(1);
  });
});

describe('tareasRepository.buscarPorId: sin afiliado asignado', () => {
  test('asignado es null cuando la tarea no tiene afiliado', async () => {
    // Given: una fila sin las columnas del afiliado asignado
    respuestas = [
      [
        {
          ...FILA_TAREA,
          autor_nombre: 'Ana',
          autor_email: 'ana@ejemplo.com',
          autor_descripcion: null,
          autor_ubicacion: null,
          autor_foto_url: null,
          ya_postulado: false,
          asignado_id: null,
          asignado_nombre: null,
          asignado_email: null,
        },
      ],
    ];
    // When: se busca por id
    const resultado = await tareasRepository.buscarPorId('t1', 'v1');
    // Then: asignado es null
    expect(resultado?.asignado).toBeNull();
  });
});

describe('tareasRepository.asignar (US-013)', () => {
  const DATOS = { tareaId: 't1', autorId: 'u1', ofertaId: 'o1' };

  test('asigna en una transacción: tarea, oferta aceptada, afiliado y rechazo del resto', async () => {
    // Given: la tarea se actualiza, la oferta devuelve su afiliado y las demás consultas no devuelven nada
    respuestas = [[{ id: 't1' }], [{ afiliado_id: 'a1' }], [], []];
    // When: se asigna
    const resultado = await tareasRepository.asignar(DATOS);
    // Then: devuelve el afiliado y ejecutó las 4 sentencias en orden
    expect(resultado).toEqual({ tipo: 'asignada', afiliadoId: 'a1' });
    expect(llamadas).toHaveLength(4);
    expect(llamadas[0]?.texto).toContain("SET estado = 'asignada'");
    expect(llamadas[0]?.texto).toContain("estado = 'abierta'");
    expect(llamadas[1]?.texto).toContain("SET estado = 'aceptada'");
    expect(llamadas[2]?.texto).toContain('afiliado_asignado_id');
    expect(llamadas[3]?.texto).toContain("SET estado = 'rechazada'");
    expect(llamadas[3]?.valores).toEqual(['t1', 'o1']);
  });

  test('si la tarea ya no está abierta no toca las ofertas', async () => {
    // Given: el UPDATE de la tarea no encuentra fila
    respuestas = [[]];
    // When: se asigna
    // Then: 'no-abierta' tras una sola sentencia
    expect(await tareasRepository.asignar(DATOS)).toEqual({
      tipo: 'no-abierta',
    });
    expect(llamadas).toHaveLength(1);
  });

  test('si la oferta no es válida revierte y lo informa', async () => {
    // Given: la tarea se actualiza pero la oferta no existe o no está pendiente
    respuestas = [[{ id: 't1' }], []];
    // When: se asigna
    // Then: 'oferta-invalida' y no se vincula ningún afiliado
    expect(await tareasRepository.asignar(DATOS)).toEqual({
      tipo: 'oferta-invalida',
    });
    expect(llamadas).toHaveLength(2);
  });

  test('un error inesperado de la base se propaga', async () => {
    // Given: una base que falla
    const original = sqlFalso.begin;
    sqlFalso.begin = async () => {
      throw new Error('caída de BD');
    };
    try {
      // When / Then: el error no se traga
      await expect(tareasRepository.asignar(DATOS)).rejects.toThrow(
        'caída de BD'
      );
    } finally {
      sqlFalso.begin = original;
    }
  });
});

describe('tareasRepository.finalizar (US-014)', () => {
  test('cierra la tarea asignada y devuelve el afiliado y la fecha', async () => {
    // Given: el UPDATE encuentra la tarea asignada
    respuestas = [[{ afiliado_asignado_id: 'a1', finalizada_en: FECHA }]];
    // When: se finaliza
    const r = await tareasRepository.finalizar({
      tareaId: 't1',
      autorId: 'u1',
    });
    // Then: finalizada, solo si estaba asignada y era del autor
    expect(r).toEqual({
      tipo: 'finalizada',
      afiliadoId: 'a1',
      finalizadaEn: FECHA,
    });
    expect(llamadas[0]?.texto).toContain("SET estado = 'finalizada'");
    expect(llamadas[0]?.texto).toContain("estado = 'asignada'");
    expect(llamadas[0]?.valores).toEqual(['t1', 'u1']);
  });

  test('sin fila, la tarea no estaba asignada (o ya se cerró)', async () => {
    // Given: el UPDATE no encuentra fila
    // When / Then: 'no-asignada'
    expect(
      await tareasRepository.finalizar({ tareaId: 't1', autorId: 'u1' })
    ).toEqual({ tipo: 'no-asignada' });
  });
});
