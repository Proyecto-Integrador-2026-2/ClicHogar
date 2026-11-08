import { estaFirmado } from '../lib/auth';

/** Páginas protegidas: sin token guardado se manda al login. */
export function initAuthGuard(): void {
  if (!estaFirmado()) {
    window.location.href = '/login';
  }
}
