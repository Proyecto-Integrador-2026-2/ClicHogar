/**
 * Preload de `bun test` (ver `bunfig.toml`): registra happy-dom como DOM
 * global, deja un token de sesión falso en `localStorage` y ofrece
 * `simularNavegacion` para capturar redirecciones.
 */
import { GlobalRegistrator } from '@happy-dom/global-registrator';

GlobalRegistrator.register({ url: 'http://localhost:4321/' });
localStorage.setItem('ch-token', 'token-falso');
(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Sustituye `window.location` por un objeto simple para capturar
 * redirecciones (`location.href = ...`). Devuelve el destino capturado y
 * cómo restaurar el original. `search` simula el query string de la página.
 */
export function simularNavegacion(search = '') {
  const original = Object.getOwnPropertyDescriptor(window, 'location');
  let destino = '';
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      search,
      set href(valor: string) {
        destino = valor;
      },
      get href() {
        return destino;
      },
    },
  });
  return {
    destino: () => destino,
    restaurar: () => {
      if (original) Object.defineProperty(window, 'location', original);
    },
  };
}

/** Restaura el token de sesión falso (llamar en `beforeEach`). */
export function resetSesion(): void {
  localStorage.setItem('ch-token', 'token-falso');
}
