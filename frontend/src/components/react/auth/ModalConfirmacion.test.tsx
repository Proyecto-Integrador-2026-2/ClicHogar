/**
 * Pruebas de la ventana de confirmación reutilizable (US-013 y US-014).
 */
import { afterEach, describe, expect, test } from 'bun:test';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import ModalConfirmacion from './ModalConfirmacion';

afterEach(cleanup);

function montar(
  props: Partial<React.ComponentProps<typeof ModalConfirmacion>> = {}
) {
  const llamadas = { confirmar: 0, cancelar: 0 };
  render(
    <ModalConfirmacion
      titulo="Confirmar algo"
      textoConfirmar="Sí, confirmar"
      enviando={false}
      onConfirmar={() => llamadas.confirmar++}
      onCancelar={() => llamadas.cancelar++}
      {...props}
    >
      <p>Contenido del diálogo</p>
    </ModalConfirmacion>
  );
  return llamadas;
}

describe('ModalConfirmacion', () => {
  test('muestra título, contenido y los botones', () => {
    // Given / When: el diálogo montado
    montar();
    // Then: es un diálogo accesible con su contenido y botones
    expect(screen.getByRole('dialog', { name: 'Confirmar algo' })).toBeTruthy();
    expect(screen.getByText('Contenido del diálogo')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sí, confirmar' })).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  test('confirmar y cancelar llaman a sus manejadores', () => {
    // Given: un diálogo abierto
    const llamadas = montar();
    // When: se confirma y se cancela
    fireEvent.click(screen.getByRole('button', { name: 'Sí, confirmar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    // Then: cada manejador se llamó una vez
    expect(llamadas).toEqual({ confirmar: 1, cancelar: 1 });
  });

  test('Escape cancela, salvo mientras se envía', () => {
    // Given: un diálogo abierto
    const llamadas = montar();
    // When: se pulsa Escape (y otra tecla)
    fireEvent.keyDown(window, { key: 'Enter' });
    fireEvent.keyDown(window, { key: 'Escape' });
    // Then: solo Escape cancela
    expect(llamadas.cancelar).toBe(1);
    cleanup();
    // Given: un diálogo enviando
    const enviando = montar({ enviando: true });
    // When: se pulsa Escape
    fireEvent.keyDown(window, { key: 'Escape' });
    // Then: no se cancela
    expect(enviando.cancelar).toBe(0);
  });

  test('mientras se envía bloquea los botones y muestra el texto de envío', () => {
    // Given: un diálogo enviando con texto personalizado
    montar({ enviando: true, textoEnviando: 'Procesando…' });
    // Then: ambos botones deshabilitados
    expect(
      (screen.getByRole('button', { name: 'Procesando…' }) as HTMLButtonElement)
        .disabled
    ).toBe(true);
    expect(
      (screen.getByRole('button', { name: 'Cancelar' }) as HTMLButtonElement)
        .disabled
    ).toBe(true);
    cleanup();
    // Given: sin texto personalizado
    montar({ enviando: true });
    // Then: usa el texto por defecto
    expect(screen.getByRole('button', { name: 'Enviando…' })).toBeTruthy();
  });

  test('muestra el error dentro del diálogo', () => {
    // Given: un diálogo con error
    montar({ error: 'Algo falló' });
    // Then: lo anuncia como alerta
    expect(screen.getByRole('alert').textContent).toBe('Algo falló');
  });
});
