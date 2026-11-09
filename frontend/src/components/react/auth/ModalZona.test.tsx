/**
 * Pruebas de ModalZona: portal, mapa, punto por teclado, círculo con
 * debounce, validación del radio, envío y cierre.
 */
import { afterEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import type { FiltroZona } from '../../../lib/zona';
import ModalZona from './ModalZona';

afterEach(cleanup);

async function abrir(extra: Partial<React.ComponentProps<typeof ModalZona>> = {}) {
  const onBuscar = mock<(filtro: FiltroZona) => void>(() => {});
  const onCerrar = mock(() => {});
  const resultado = render(
    <ModalZona
      filtroInicial={null}
      onBuscar={onBuscar}
      onCerrar={onCerrar}
      {...extra}
    />
  );
  const mapa = screen.getByRole('region', {
    name: 'Mapa para elegir la zona de búsqueda',
  });
  await waitFor(() =>
    expect(mapa.classList.contains('leaflet-container')).toBe(true)
  );
  return { ...resultado, onBuscar, onCerrar, mapa };
}

describe('ModalZona', () => {
  test('se monta en document.body dentro de .ch-auth y bloquea el scroll', async () => {
    // Given / When: se abre el diálogo
    await abrir();
    // Then: está en el body, con los tokens de .ch-auth y el scroll bloqueado
    const dialogo = screen.getByRole('dialog', { name: 'Buscar por zona' });
    expect(document.body.contains(dialogo)).toBe(true);
    expect(dialogo.closest('.ch-auth')).not.toBeNull();
    expect(document.body.style.overflow).toBe('hidden');
  });

  test('sin punto, "Buscar en esta zona" está deshabilitado', async () => {
    // Given: el modal recién abierto
    await abrir();
    // Then: no se puede buscar y se avisa que falta el punto
    expect(
      (
        screen.getByRole('button', {
          name: 'Buscar en esta zona',
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true);
    expect(screen.getByText('Sin punto seleccionado')).toBeTruthy();
  });

  test('Enter sobre el mapa coloca el punto y habilita la búsqueda', async () => {
    // Given: el mapa enfocado
    const { mapa } = await abrir();
    // When: se pulsa Enter
    fireEvent.keyDown(mapa, { key: 'Enter' });
    // Then: aparece el punto y se habilita el botón
    await screen.findByText(/Punto: 6\.244/);
    expect(
      (
        screen.getByRole('button', {
          name: 'Buscar en esta zona',
        }) as HTMLButtonElement
      ).disabled
    ).toBe(false);
  });

  test('el círculo rojo aparece tras 500 ms y se mantiene al cambiar el radio', async () => {
    // Given: un punto seleccionado
    const { mapa } = await abrir();
    fireEvent.keyDown(mapa, { key: 'Enter' });
    await screen.findByText(/Punto:/);
    // Then: tras la espera aparece el círculo
    await waitFor(
      () => expect(mapa.querySelector('.leaflet-overlay-pane path')).not.toBeNull(),
      { timeout: 2500 }
    );
    // When: cambia el radio
    fireEvent.change(screen.getByLabelText('Radio de búsqueda (km)'), {
      target: { value: '8' },
    });
    // Then: el marcador sigue y el círculo se redibuja
    expect(mapa.querySelector('.leaflet-marker-icon')).not.toBeNull();
    await waitFor(
      () => expect(mapa.querySelector('.leaflet-overlay-pane path')).not.toBeNull(),
      { timeout: 2500 }
    );
  });

  test('radio vacío usa 2 km al enviar', async () => {
    // Given: un punto y el radio vacío
    const { mapa, onBuscar } = await abrir();
    fireEvent.keyDown(mapa, { key: 'Enter' });
    await screen.findByText(/Punto:/);
    // When: se envía
    fireEvent.click(screen.getByRole('button', { name: 'Buscar en esta zona' }));
    // Then: se usa el valor por defecto
    expect(onBuscar).toHaveBeenCalledTimes(1);
    expect(onBuscar.mock.calls[0]![0]).toMatchObject({ radio: 2 });
  });

  test('un radio inválido muestra error y no envía', async () => {
    // Given: un punto y un radio fuera de rango
    const { mapa, onBuscar } = await abrir();
    fireEvent.keyDown(mapa, { key: 'Enter' });
    await screen.findByText(/Punto:/);
    fireEvent.change(screen.getByLabelText('Radio de búsqueda (km)'), {
      target: { value: '101' },
    });
    // When: se envía
    fireEvent.click(screen.getByRole('button', { name: 'Buscar en esta zona' }));
    // Then: alerta y sin llamada
    expect((await screen.findByRole('alert')).textContent).toContain(
      'entre 1 y 100'
    );
    expect(onBuscar).not.toHaveBeenCalled();
  });

  test('un filtro inicial precarga el punto y el radio', async () => {
    // Given: un filtro existente
    const { onBuscar } = await abrir({
      filtroInicial: { lat: 6.2, lng: -75.5, radio: 7 },
    });
    // Then: el punto y el radio se muestran
    expect(screen.getByText(/Punto: 6\.20000, -75\.50000/)).toBeTruthy();
    expect(
      (screen.getByLabelText('Radio de búsqueda (km)') as HTMLInputElement).value
    ).toBe('7');
    // When: se envía sin cambios
    fireEvent.click(screen.getByRole('button', { name: 'Buscar en esta zona' }));
    // Then: conserva los valores
    expect(onBuscar).toHaveBeenCalledWith({ lat: 6.2, lng: -75.5, radio: 7 });
  });

  test('Escape y clic en el fondo cierran el diálogo', async () => {
    // Given: el diálogo abierto
    const { onCerrar } = await abrir();
    // When: se pulsa Escape
    fireEvent.keyDown(document, { key: 'Escape' });
    // Then: cierra
    expect(onCerrar).toHaveBeenCalledTimes(1);
    // When: se hace clic en el fondo
    fireEvent.click(document.querySelector('.ch-modal--zona') as Element);
    // Then: vuelve a cerrar
    expect(onCerrar).toHaveBeenCalledTimes(2);
  });

  test('al desmontar limpia el mapa y restaura el scroll', async () => {
    // Given: el diálogo abierto
    const { unmount, mapa } = await abrir();
    expect(mapa.classList.contains('leaflet-container')).toBe(true);
    // When: se desmonta
    unmount();
    await new Promise((r) => setTimeout(r, 50));
    // Then: no queda mapa ni scroll bloqueado
    expect(document.querySelector('.leaflet-container')).toBeNull();
    expect(document.body.style.overflow).toBe('');
  });
});
