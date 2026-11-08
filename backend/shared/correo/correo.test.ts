/**
 * Pruebas del envío de correo: sin clave solo se registra en consola; con
 * clave llama a la API de Resend y falla si esta responde con error.
 */
import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test';

process.env.DATABASE_URL ??= 'postgres://test';

const { env } = await import('../../config/env');
const { correo } = await import('./correo');

const ajustable = env as { RESEND_API_KEY: string; MAIL_FROM: string };
const MENSAJE = { para: 'ana@ejemplo.com', asunto: 'Hola', texto: 'Cuerpo' };

afterEach(() => {
  ajustable.RESEND_API_KEY = '';
  mock.restore();
});

describe('correo.enviar', () => {
  test('sin RESEND_API_KEY imprime el mensaje y no llama a la red', async () => {
    // Given: sin clave del servicio de correo
    ajustable.RESEND_API_KEY = '';
    const info = spyOn(console, 'info').mockImplementation(() => {});
    const red = spyOn(globalThis, 'fetch');
    // When: se envía
    await correo.enviar(MENSAJE);
    // Then: queda en la consola y no sale a internet
    expect(String(info.mock.calls[0]?.[0])).toContain('ana@ejemplo.com');
    expect(red).not.toHaveBeenCalled();
  });

  test('con RESEND_API_KEY envía por la API con remitente y destinatario', async () => {
    // Given: una clave y una API que acepta
    ajustable.RESEND_API_KEY = 're_123';
    const red = spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{}', { status: 200 })
    );
    // When: se envía
    await correo.enviar(MENSAJE);
    // Then: POST a Resend con la clave y el cuerpo esperado
    const [url, init] = red.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer re_123'
    );
    expect(JSON.parse(init.body as string)).toEqual({
      from: ajustable.MAIL_FROM,
      to: ['ana@ejemplo.com'],
      subject: 'Hola',
      text: 'Cuerpo',
    });
  });

  test('si la API responde con error, falla', async () => {
    // Given: una API que rechaza
    ajustable.RESEND_API_KEY = 're_123';
    spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{}', { status: 422 })
    );
    // When / Then: lanza con el código
    await expect(correo.enviar(MENSAJE)).rejects.toThrow('(422)');
  });
});
