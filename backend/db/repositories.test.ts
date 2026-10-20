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
    respuestas = [[FILA_TAREA]];
    const tarea = await tareasRepository.crear(nueva);
    expect(tarea.usuarioId).toBe('u1');
    expect(tarea.creadoEn).toBe(FECHA);
    expect(llamadas[0]?.valores).toContain('Arreglar grifo');
  });

  test('crear falla si el INSERT no devuelve fila', async () => {
    respuestas = [[]];
    await expect(tareasRepository.crear(nueva)).rejects.toThrow(
      'No se pudo crear la tarea.'
    );
  });

  test('listarAbiertas incluye el nombre del autor', async () => {
    respuestas = [[{ ...FILA_TAREA, autor_nombre: 'Ana' }]];
    const lista = await tareasRepository.listarAbiertas();
    expect(lista).toHaveLength(1);
    expect(lista[0]?.autorNombre).toBe('Ana');
    expect(lista[0]?.tarea.id).toBe('t1');
  });
});

describe('usuariosRepository', () => {
  test('buscarPorEmail / ClerkId / Id devuelven el usuario mapeado', async () => {
    respuestas = [[FILA_USUARIO], [FILA_USUARIO], [FILA_USUARIO]];
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
    expect(await usuariosRepository.buscarPorEmail('x')).toBeUndefined();
    expect(await usuariosRepository.buscarPorClerkId('x')).toBeUndefined();
    expect(await usuariosRepository.buscarPorId('x')).toBeUndefined();
  });

  test('crear inserta (con y sin clerkId/passwordHash) y mapea', async () => {
    respuestas = [[FILA_USUARIO], [FILA_USUARIO]];
    await usuariosRepository.crear({
      clerkId: 'c1',
      nombre: 'Ana',
      email: 'ana@ejemplo.com',
      passwordHash: 'h',
      rol: 'cliente',
    } as never);
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
    await expect(
      usuariosRepository.crear({
        nombre: 'A',
        email: 'a',
        rol: 'cliente',
      } as never)
    ).rejects.toThrow('No se pudo crear el usuario.');
  });

  test('actualizarParcial arma el UPDATE solo con los campos del patch', async () => {
    respuestas = [[{ ...FILA_USUARIO, foto_url: '/f.jpg' }]];
    const usuario = await usuariosRepository.actualizarParcial('u1', {
      fotoUrl: '/f.jpg',
      descripcion: 'Hola',
      ubicacion: 'Envigado',
    });
    expect(usuario.fotoUrl).toBe('/f.jpg');
    expect(llamadas[0]?.texto).toContain('"foto_url" = $1');
    expect(llamadas[0]?.texto).toContain('"descripcion" = $2');
    expect(llamadas[0]?.texto).toContain('"ubicacion" = $3');
    expect(llamadas[0]?.valores).toEqual(['/f.jpg', 'Hola', 'Envigado', 'u1']);
  });

  test('actualizarParcial sin campos devuelve el usuario intacto', async () => {
    respuestas = [[FILA_USUARIO]];
    const usuario = await usuariosRepository.actualizarParcial('u1', {});
    expect(usuario.id).toBe('u1');
  });

  test('actualizarParcial sin campos y sin usuario -> NotFound', async () => {
    await expect(
      usuariosRepository.actualizarParcial('nope', {})
    ).rejects.toThrow('Usuario no encontrado.');
  });

  test('actualizarParcial con campos y sin fila -> NotFound', async () => {
    await expect(
      usuariosRepository.actualizarParcial('nope', { ubicacion: 'x' })
    ).rejects.toThrow('Usuario no encontrado.');
  });
});

describe('disponibilidadRepository', () => {
  test('listarPorUsuarioId mapea las franjas', async () => {
    respuestas = [[{ dia_semana: 1, franja_horaria: 'manana' }]];
    expect(await disponibilidadRepository.listarPorUsuarioId('u1')).toEqual([
      { diaSemana: 1, franjaHoraria: 'manana' },
    ]);
  });

  test('reemplazar borra, inserta cada slot y relee', async () => {
    respuestas = [[], [], [], [{ dia_semana: 2, franja_horaria: 'tarde' }]];
    const resultado = await disponibilidadRepository.reemplazar('u1', [
      { diaSemana: 2, franjaHoraria: 'tarde' },
      { diaSemana: 3, franjaHoraria: 'noche' },
    ]);
    expect(llamadas[0]?.texto).toContain('DELETE FROM disponibilidad');
    expect(llamadas.filter((l) => l.texto.includes('INSERT'))).toHaveLength(2);
    expect(resultado).toEqual([{ diaSemana: 2, franjaHoraria: 'tarde' }]);
  });

  test('reemplazar con arreglo vacío solo borra', async () => {
    await disponibilidadRepository.reemplazar('u1', []);
    expect(llamadas.filter((l) => l.texto.includes('INSERT'))).toHaveLength(0);
  });
});
