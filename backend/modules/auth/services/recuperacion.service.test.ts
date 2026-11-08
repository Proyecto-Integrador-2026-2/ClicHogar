/**
 * Pruebas de la recuperación de contraseña: solicitud (siempre la misma
 * respuesta, enlace de un solo uso con hash, espera entre correos) y
 * restablecimiento. Repositorios y correo simulados; el hash es real.
 */
import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test';
import { correo } from '../../../shared/correo/correo';
import { ValidationError } from '../../../shared/errors/app-error';
import type { Usuario } from '../../usuarios/entities/usuario.entity';
import { usuariosRepository } from '../../usuarios/repositories/usuarios.repository';
import { recuperacionesRepository } from '../repositories/recuperaciones.repository';
import {
  ENLACE_TTL_MS,
  ESPERA_ENTRE_CORREOS_SEG,
  MENSAJE_CONTRASENA_ACTUALIZADA,
  MENSAJE_ENLACE_ENVIADO,
  MENSAJE_ENLACE_INVALIDO,
  hashToken,
  recuperacionService,
} from './recuperacion.service';

afterEach(() => {
  mock.restore();
});

const FECHA = new Date('2026-01-01T00:00:00.000Z');

const USUARIO: Usuario = {
  id: 'u-1',
  nombre: 'Ana',
  email: 'ana@ejemplo.com',
  passwordHash: 'hash',
  rol: 'cliente',
  fotoUrl: null,
  descripcion: null,
  ubicacion: null,
  activo: true,
  creadoEn: FECHA,
  actualizadoEn: FECHA,
};

function escenario(
  opciones: {
    sinUsuario?: boolean;
    reciente?: boolean;
    correoFalla?: boolean;
  } = {}
) {
  spyOn(usuariosRepository, 'buscarPorEmail').mockResolvedValue(
    opciones.sinUsuario ? undefined : USUARIO
  );
  const reciente = spyOn(
    recuperacionesRepository,
    'existeReciente'
  ).mockResolvedValue(opciones.reciente ?? false);
  const crear = spyOn(recuperacionesRepository, 'crear').mockResolvedValue();
  const enviar = spyOn(correo, 'enviar').mockImplementation(async () => {
    if (opciones.correoFalla) throw new Error('sin servicio');
  });
  return { reciente, crear, enviar };
}

describe('hashToken', () => {
  test('es un SHA-256 hexadecimal estable', () => {
    // Given / When / Then: 64 hex, igual para el mismo token y distinto para otro
    expect(hashToken('abc')).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken('abc')).toBe(hashToken('abc'));
    expect(hashToken('abc')).not.toBe(hashToken('abd'));
  });
});

describe('recuperacionService.solicitar', () => {
  test('guarda solo el hash del token y envía el enlace por correo', async () => {
    // Given: una cuenta existente
    const { crear, enviar } = escenario();
    const antes = Date.now();
    // When: pide el enlace con el correo en mayúsculas
    const r = await recuperacionService.solicitar({
      email: ' ANA@Ejemplo.com ',
    });
    // Then: respuesta genérica y enlace vigente 1 hora
    expect(r.mensaje).toBe(MENSAJE_ENLACE_ENVIADO);
    const [usuarioId, hash, expira] = crear.mock.calls[0] as [
      string,
      string,
      Date,
    ];
    expect(usuarioId).toBe('u-1');
    expect(expira.getTime() - antes).toBeGreaterThanOrEqual(ENLACE_TTL_MS - 50);
    // Then: el correo lleva el token en claro y la base solo su hash
    const mensaje = enviar.mock.calls[0]?.[0] as {
      para: string;
      texto: string;
    };
    expect(mensaje.para).toBe('ana@ejemplo.com');
    const token = /restablecer-contrasena\?token=([0-9a-f-]+)/.exec(
      mensaje.texto
    )?.[1];
    expect(token).toBeDefined();
    expect(hashToken(token ?? '')).toBe(hash);
    expect(hash).not.toContain(token ?? '');
  });

  test('un correo sin cuenta recibe la misma respuesta y no crea nada', async () => {
    // Given: ninguna cuenta con ese correo
    const { crear, enviar } = escenario({ sinUsuario: true });
    // When: pide el enlace
    const r = await recuperacionService.solicitar({
      email: 'nadie@ejemplo.com',
    });
    // Then: mismo mensaje, sin enlace ni correo
    expect(r.mensaje).toBe(MENSAJE_ENLACE_ENVIADO);
    expect(crear).not.toHaveBeenCalled();
    expect(enviar).not.toHaveBeenCalled();
  });

  test('si ya se pidió hace poco no genera otro enlace', async () => {
    // Given: un correo enviado hace menos de un minuto
    const { crear, enviar, reciente } = escenario({ reciente: true });
    // When: vuelve a pedir
    const r = await recuperacionService.solicitar({ email: 'ana@ejemplo.com' });
    // Then: misma respuesta, consulta la ventana de espera y no envía otro
    expect(r.mensaje).toBe(MENSAJE_ENLACE_ENVIADO);
    expect(reciente).toHaveBeenCalledWith('u-1', ESPERA_ENTRE_CORREOS_SEG);
    expect(crear).not.toHaveBeenCalled();
    expect(enviar).not.toHaveBeenCalled();
  });

  test('si el correo no sale, la respuesta sigue siendo la misma', async () => {
    // Given: un servicio de correo caído
    const error = spyOn(console, 'error').mockImplementation(() => {});
    escenario({ correoFalla: true });
    // When: pide el enlace
    const r = await recuperacionService.solicitar({ email: 'ana@ejemplo.com' });
    // Then: no revela el fallo y lo deja en el log
    expect(r.mensaje).toBe(MENSAJE_ENLACE_ENVIADO);
    expect(error).toHaveBeenCalled();
  });

  test('un correo inválido responde 400', async () => {
    // Given / When / Then: sin @ o sin correo
    escenario();
    await expect(
      recuperacionService.solicitar({ email: 'sin-arroba' })
    ).rejects.toThrow(ValidationError);
    await expect(recuperacionService.solicitar({})).rejects.toThrow(
      ValidationError
    );
  });
});

describe('recuperacionService.restablecer', () => {
  test('cambia la contraseña con el hash del token y una clave hasheada', async () => {
    // Given: un enlace vigente
    const restablecer = spyOn(
      recuperacionesRepository,
      'restablecer'
    ).mockResolvedValue('u-1');
    // When: se restablece con el token con espacios
    const r = await recuperacionService.restablecer({
      token: '  tok-1  ',
      password: 'NuevaClave1',
    });
    // Then: mensaje de éxito; se busca por hash y la clave nueva va con hash
    expect(r.mensaje).toBe(MENSAJE_CONTRASENA_ACTUALIZADA);
    const [hashBuscado, claveHash] = restablecer.mock.calls[0] as [
      string,
      string,
    ];
    expect(hashBuscado).toBe(hashToken('tok-1'));
    expect(claveHash).not.toBe('NuevaClave1');
    expect(await Bun.password.verify('NuevaClave1', claveHash)).toBe(true);
  });

  test('un enlace usado, vencido o inexistente responde 400', async () => {
    // Given: un repositorio que no encuentra un enlace vigente
    spyOn(recuperacionesRepository, 'restablecer').mockResolvedValue(undefined);
    // When / Then: error con el mensaje de enlace inválido
    await expect(
      recuperacionService.restablecer({ token: 'x', password: 'NuevaClave1' })
    ).rejects.toThrow(MENSAJE_ENLACE_INVALIDO);
  });

  test('sin token o con contraseña corta no consulta la base', async () => {
    // Given: el repositorio no debe llamarse
    const restablecer = spyOn(recuperacionesRepository, 'restablecer');
    // When / Then: token vacío, ausente o clave de menos de 8 caracteres
    await expect(
      recuperacionService.restablecer({ token: '  ', password: 'NuevaClave1' })
    ).rejects.toThrow(MENSAJE_ENLACE_INVALIDO);
    await expect(
      recuperacionService.restablecer({ password: 'NuevaClave1' })
    ).rejects.toThrow(MENSAJE_ENLACE_INVALIDO);
    await expect(
      recuperacionService.restablecer({ token: 'x', password: 'corta' })
    ).rejects.toThrow('al menos 8 caracteres');
    expect(restablecer).not.toHaveBeenCalled();
  });
});
