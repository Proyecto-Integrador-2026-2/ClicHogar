/**
 * Pruebas de los repositorios con un `sql` falso (sin Postgres): verifican
 * el mapeo snake_case -> camelCase, las ramas "no encontrado" y que las
 * escrituras viajen como parámetros.
 */
import { beforeEach, describe, expect, mock, test } from 'bun:test';

process.env.DATABASE_URL ??= 'postgres://test';
process.env.CLERK_SECRET_KEY ??= 'sk_test';

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

const FECHA = new Date('2026-01-01T00:00:00Z');

const FILA_USUARIO = {
  id: 'u1',
  clerk_id: 'c1',
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
    const lista = await tareasRepository.listarAbiertas();
    // Then: llega la tarea con su autorNombre
    expect(lista).toHaveLength(1);
    expect(lista[0]?.autorNombre).toBe('Ana');
    expect(lista[0]?.tarea.id).toBe('t1');
  });
});

describe('usuariosRepository', () => {
  test('buscarPorEmail / ClerkId / Id devuelven el usuario mapeado', async () => {
    // Given: una fila de usuario para cada búsqueda
    respuestas = [[FILA_USUARIO], [FILA_USUARIO], [FILA_USUARIO]];
    // When: se busca por email, por clerkId y por id
    // Then: cada búsqueda devuelve el usuario mapeado
    expect((await usuariosRepository.buscarPorEmail('a@b.c'))?.clerkId).toBe(
      'c1'
    );
    expect((await usuariosRepository.buscarPorClerkId('c1'))?.nombre).toBe(
      'Ana'
    );
    expect((await usuariosRepository.buscarPorId('u1'))?.email).toBe(
      'ana@ejemplo.com'
    );
  });

  test('las búsquedas devuelven undefined si no hay fila', async () => {
    // Given: un repositorio sin filas
    // When: se hacen las tres búsquedas
    // Then: todas devuelven undefined
    expect(await usuariosRepository.buscarPorEmail('x')).toBeUndefined();
    expect(await usuariosRepository.buscarPorClerkId('x')).toBeUndefined();
    expect(await usuariosRepository.buscarPorId('x')).toBeUndefined();
  });

  test('crear inserta (con y sin clerkId/passwordHash) y mapea', async () => {
    // Given: un INSERT que devuelve la fila del usuario
    respuestas = [[FILA_USUARIO], [FILA_USUARIO]];
    // When: se crea con y sin clerkId ni passwordHash
    await usuariosRepository.crear({
      clerkId: 'c1',
      nombre: 'Ana',
      email: 'ana@ejemplo.com',
      passwordHash: 'h',
      rol: 'cliente',
    } as never);
    // Then: viajan como parámetros y se devuelve el usuario mapeado
    expect(llamadas[0]?.valores).toContain('c1');
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
