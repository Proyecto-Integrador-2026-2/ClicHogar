import { env } from '../../config/env';

export type Correo = { para: string; asunto: string; texto: string };

/**
 * Envío de correo. Con `RESEND_API_KEY` usa la API de Resend; sin ella no
 * sale nada de la máquina y el mensaje se imprime en la consola del servidor
 * (útil en desarrollo para copiar el enlace de recuperación).
 */
export const correo = {
  async enviar({ para, asunto, texto }: Correo): Promise<void> {
    if (!env.RESEND_API_KEY) {
      console.info(`[correo] Para: ${para}\n[correo] ${asunto}\n${texto}`);
      return;
    }
    const respuesta = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.MAIL_FROM,
        to: [para],
        subject: asunto,
        text: texto,
      }),
    });
    if (!respuesta.ok) {
      throw new Error(`No se pudo enviar el correo (${respuesta.status}).`);
    }
  },
};
