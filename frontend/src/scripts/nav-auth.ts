function apiUrl(): string {
  return (
    (import.meta as any).env?.PUBLIC_API_URL ??
    (import.meta as any).env?.DEV ? 'http://localhost:3000' : ''
  );
}

export function initNavAuth(): void {
  const haySesion = !!localStorage.getItem('ch-token');
  const ranuras = document.querySelectorAll<HTMLElement>('[data-nav-auth]');
  for (const el of ranuras) {
    const quiereDentro = el.dataset.navAuth === 'in';
    el.hidden = quiereDentro ? !haySesion : haySesion;
  }
  const botones = document.querySelectorAll<HTMLButtonElement>('[data-logout]');
  for (const btn of botones) {
    btn.addEventListener('click', async () => {
      if (btn.disabled) return;
      btn.disabled = true;
      const token = localStorage.getItem('ch-token');
      try {
        const base = apiUrl();
        if (base && token) {
          await fetch(`${base}/api/auth/logout`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          }).catch(() => undefined);
        }
      } finally {
        localStorage.removeItem('ch-token');
        sessionStorage.clear();
        window.location.href = '/login';
        btn.disabled = false;
      }
    });
  }
}