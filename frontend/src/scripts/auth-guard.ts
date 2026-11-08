export function initAuthGuard(): void {
  if (!localStorage.getItem('ch-token')) {
    window.location.href = '/login';
  }
}