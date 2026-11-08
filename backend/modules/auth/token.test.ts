/**
 * Pruebas de los helpers de token: lectura del Bearer y resolución del
 * usuario de la sesión.
 */
import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test';
import type { Usuario } from '../usuarios/entities/usuario.entity';
import { authService } from './services/auth.service';
import { tokenDesdeHeaders, usuarioDesdeHeaders } from './token';

afterEach(() => {
  mock.restore();
});

describe('tokenDesdeHeaders', () => {
  test('extrae el token de Authorization (minúscula o mayúscula)', () => {
    // Given: cabeceras con Bearer en ambas formas
    // When: se lee el token
    // Then: devuelve el token sin espacios
    expect(tokenDesdeHeaders({ authorization: 'Bearer abc ' })).toBe('abc');
    expect(tokenDesdeHeaders({ Authorization: 'Bearer xyz' })).toBe('xyz');
  });

  test('sin cabecera o con otro esquema devuelve cadena vacía', () => {
    // Given: cabeceras ausentes o con un esquema distinto
    // When: se lee el token
    // Then: devuelve ''
    expect(tokenDesdeHeaders({})).toBe('');
    expect(tokenDesdeHeaders({ authorization: 'Basic abc' })).toBe('');
    expect(tokenDesdeHeaders({ authorization: undefined })).toBe('');
  });
});

describe('usuarioDesdeHeaders', () => {
  test('resuelve el usuario con el token de la cabecera', async () => {
    // Given: un servicio que resuelve el token 'abc'
    const resolver = spyOn(authService, 'resolverUsuario').mockResolvedValue({
      id: 'u-1',
    } as Usuario);
    // When: se resuelve desde las cabeceras
    const usuario = await usuarioDesdeHeaders({ authorization: 'Bearer abc' });
    // Then: usa ese token y devuelve el usuario
    expect(resolver).toHaveBeenCalledWith('abc');
    expect(usuario.id).toBe('u-1');
  });
});
