/**
 * Pruebas del detalle de una tarea (US-009). `obtenerTarea` y la red se
 * simulan; cada prueba mapea a un escenario de aceptación.
 */
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import React from 'react';
import { resetSesion, simularNavegacion } from '../../../../test-setup';
import * as api from '../../../lib/usuarios-api';
import DetalleTarea, {
  MENSAJE_AFILIADO_SELECCIONADO,
  MENSAJE_ERROR_DETALLE,
  MENSAJE_ESPERANDO_CIERRE,
  MENSAJE_YA_ASIGNADA,
  MENSAJE_NO_DISPONIBLE,
  MENSAJE_NO_ACEPTA_OFERTAS,
  MENSAJE_OFERTA_ENVIADA,
  MENSAJE_YA_POSTULADO,
  REDIRECCION_MS,
} from './DetalleTarea';

const ID = '33333333-3333-4333-8333-333333333333';

const detalle = (
  cambios: Partial<api.DetalleTareaApi> = {}
): api.DetalleTareaApi => ({
  id: ID,
  titulo: 'Arreglar grifo',
  descripcion:
    'El grifo de la cocina gotea día y noche. Incluye cambiar el empaque.',
  categoria: 'Plomería',
  estado: 'abierta',
  ubicacion: 'Belén, Medellín',
  latitud: null,
  longitud: null,
  autorId: 'u-1',
  autorNombre: 'Ana Pérez',
  creadoEn: '2026-03-15T12:00:00.000Z',
  autor: {
    id: 'u-1',
    nombre: 'Ana Pérez',
    descripcion: 'Vivo en Belén desde hace años.',
    ubicacion: 'Medellín',
    fotoUrl: '/uploads/perfiles/ana.jpg',
  },
  esPropia: false,
  puedeOfertar: true,
  yaPostulado: false,
  esAsignado: false,
  puedeFinalizar: false,
  contacto: null,
  afiliadoAsignado: null,
  ...cambios,
});

let nav: ReturnType<typeof simularNavegacion>;

/** Simula la página `/tareas/detalle` con la query dada. */
function conId(id: string | null = ID) {
  nav.restaurar();
  nav = simularNavegacion(id === null ? '' : `?id=${id}`);
}

beforeEach(() => {
  resetSesion();
  spyOn(api, 'listarOfertasRecibidas').mockResolvedValue([]);
  process.env.PUBLIC_API_URL = 'http://api.test';
  nav = simularNavegacion(`?id=${ID}`);
});

afterEach(() => {
  cleanup();
  nav.restaurar();
  spyOn(api, 'obtenerTarea').mockRestore();
  spyOn(api, 'enviarOferta').mockRestore();
  spyOn(api, 'listarOfertasRecibidas').mockRestore();
  spyOn(api, 'asignarTarea').mockRestore();
  spyOn(api, 'finalizarTarea').mockRestore();
});

describe('DetalleTarea', () => {
  test('Esc 1: muestra título, descripción completa, categoría, ubicación y autor', async () => {
    // Given: una tarea abierta de otra persona
    const obtener = spyOn(api, 'obtenerTarea').mockResolvedValue(detalle());
    // When: se abre el detalle
    render(<DetalleTarea />);
    // Then: se ve toda la información de la tarea y de quien la publicó
    expect(
      await screen.findByRole('heading', { name: 'Arreglar grifo' })
    ).toBeTruthy();
    expect(screen.getByText(/Incluye cambiar el empaque\./)).toBeTruthy();
    expect(screen.getByText('Plomería')).toBeTruthy();
    expect(screen.getByText(/Belén, Medellín/)).toBeTruthy();
    expect(screen.getByText(/Publicada el 15 de marzo de 2026/)).toBeTruthy();
    expect(screen.getByText('Abierta')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Ana Pérez' })).toBeTruthy();
    expect(screen.getByText('Vivo en Belén desde hace años.')).toBeTruthy();
    expect(
      (screen.getByAltText('Foto de Ana Pérez') as HTMLImageElement).src
    ).toBe('http://api.test/uploads/perfiles/ana.jpg');
    expect(obtener).toHaveBeenCalledWith('token-falso', ID);
  });

  test('Esc 2: una tarea abierta ajena ofrece "Enviar oferta"', async () => {
    // Given: una tarea abierta que el visitante puede ofertar
    spyOn(api, 'obtenerTarea').mockResolvedValue(detalle());
    render(<DetalleTarea />);
    // When: pulsa Enviar oferta
    fireEvent.click(
      await screen.findByRole('button', { name: 'Enviar oferta' })
    );
    // Then: se abre el formulario con el mensaje opcional
    expect(screen.getByLabelText(/Mensaje para el creador/)).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Confirmar postulación' })
    ).toBeTruthy();
  });

  test('US-011 Esc 1: al confirmar muestra el éxito y bloquea nuevas ofertas', async () => {
    // Given: una tarea abierta y un backend que acepta la oferta
    spyOn(api, 'obtenerTarea').mockResolvedValue(detalle());
    const enviar = spyOn(api, 'enviarOferta').mockResolvedValue(
      {} as api.OfertaApi
    );
    render(<DetalleTarea />);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Enviar oferta' })
    );
    // When: confirma la postulación
    fireEvent.click(
      screen.getByRole('button', { name: 'Confirmar postulación' })
    );
    // Then: ve el mensaje de éxito, el botón queda bloqueado y se avisa que ya se postuló
    expect((await screen.findByRole('status')).textContent).toBe(
      MENSAJE_OFERTA_ENVIADA
    );
    expect(
      (
        screen.getByRole('button', {
          name: 'Enviar oferta',
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true);
    expect(screen.getByText(MENSAJE_YA_POSTULADO)).toBeTruthy();
    expect(enviar).toHaveBeenCalledWith('token-falso', ID, '');
  });

  test('US-011 Esc 3: si ya se postuló, el envío queda bloqueado con el aviso', async () => {
    // Given: una tarea a la que el afiliado ya se postuló
    spyOn(api, 'obtenerTarea').mockResolvedValue(
      detalle({ yaPostulado: true, puedeOfertar: false })
    );
    // When: vuelve a visitar el detalle
    render(<DetalleTarea />);
    // Then: el botón está deshabilitado y aparece "Ya te has postulado a esta tarea"
    await screen.findByRole('heading', { name: 'Arreglar grifo' });
    expect(
      (
        screen.getByRole('button', {
          name: 'Enviar oferta',
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true);
    expect(screen.getByText(MENSAJE_YA_POSTULADO)).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
  });

  test('US-011 Esc 3: un 409 al confirmar también bloquea el envío', async () => {
    // Given: un backend que dice que ya existe una oferta
    spyOn(api, 'obtenerTarea').mockResolvedValue(detalle());
    spyOn(api, 'enviarOferta').mockRejectedValue(new api.ErrorYaPostulado());
    render(<DetalleTarea />);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Enviar oferta' })
    );
    // When: confirma
    fireEvent.click(
      screen.getByRole('button', { name: 'Confirmar postulación' })
    );
    // Then: queda bloqueado con el aviso y sin mensaje de éxito
    expect(await screen.findByText(MENSAJE_YA_POSTULADO)).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
  });

  test('US-011 Esc 5: si la tarea ya no acepta ofertas avisa y vuelve al tablero', async () => {
    // Given: una tarea que se cerró justo al confirmar
    spyOn(api, 'obtenerTarea').mockResolvedValue(detalle());
    spyOn(api, 'enviarOferta').mockRejectedValue(
      new api.ErrorTareaNoAceptaOfertas()
    );
    render(<DetalleTarea />);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Enviar oferta' })
    );
    // When: confirma
    fireEvent.click(
      screen.getByRole('button', { name: 'Confirmar postulación' })
    );
    // Then: alerta clara y, tras la espera, regreso al tablero
    expect((await screen.findByRole('alert')).textContent).toContain(
      MENSAJE_NO_ACEPTA_OFERTAS
    );
    await act(async () => {
      await new Promise((r) => setTimeout(r, REDIRECCION_MS + 200));
    });
    expect(nav.destino()).toBe('/tareas');
  }, 10000);

  test('un visitante que no es afiliado ve la tarea pero no puede ofertar', async () => {
    // Given: un detalle que el servidor marca como no ofertable
    spyOn(api, 'obtenerTarea').mockResolvedValue(
      detalle({ puedeOfertar: false })
    );
    // When: se abre el detalle
    render(<DetalleTarea />);
    // Then: se ve la tarea, sin botón y con la explicación
    await screen.findByRole('heading', { name: 'Arreglar grifo' });
    expect(screen.queryByRole('button', { name: 'Enviar oferta' })).toBeNull();
    expect(
      screen.getByText(/Solo los afiliados pueden enviar ofertas/)
    ).toBeTruthy();
  });

  test('Esc 4: en su propia tarea se ve todo pero no se puede ofertar', async () => {
    // Given: un detalle de una tarea propia
    spyOn(api, 'obtenerTarea').mockResolvedValue(
      detalle({ esPropia: true, puedeOfertar: false })
    );
    // When: se abre el detalle
    render(<DetalleTarea />);
    // Then: se ve la información y el botón no aparece
    await screen.findByRole('heading', { name: 'Arreglar grifo' });
    expect(screen.queryByRole('button', { name: 'Enviar oferta' })).toBeNull();
    expect(
      screen.getByText(/no puedes enviar una oferta a tu propia tarea/)
    ).toBeTruthy();
  });

  test('US-012: el creador ve las ofertas recibidas; un afiliado ajeno no', async () => {
    // Given: una tarea propia
    spyOn(api, 'obtenerTarea').mockResolvedValue(
      detalle({ esPropia: true, puedeOfertar: false })
    );
    // When: el creador abre el detalle
    const { unmount } = render(<DetalleTarea />);
    // Then: aparece la sección de ofertas recibidas y se pidió su lista
    expect(
      await screen.findByRole('region', { name: 'Ofertas recibidas' })
    ).toBeTruthy();
    expect(api.listarOfertasRecibidas).toHaveBeenCalledWith('token-falso', ID);
    unmount();
    // Given: una tarea ajena
    spyOn(api, 'obtenerTarea').mockResolvedValue(detalle());
    (
      api.listarOfertasRecibidas as unknown as ReturnType<typeof spyOn>
    ).mockClear();
    // When: un afiliado abre el detalle
    render(<DetalleTarea />);
    await screen.findByRole('heading', { name: 'Arreglar grifo' });
    // Then: no hay sección de ofertas ni se piden
    expect(
      screen.queryByRole('region', { name: 'Ofertas recibidas' })
    ).toBeNull();
    expect(api.listarOfertasRecibidas).not.toHaveBeenCalled();
  });

  test('sin foto ni datos opcionales del autor, solo muestra su nombre', async () => {
    // Given: un autor sin foto, descripción ni ubicación
    spyOn(api, 'obtenerTarea').mockResolvedValue(
      detalle({
        estado: 'asignada',
        autor: {
          id: 'u-1',
          nombre: 'Luis',
          descripcion: null,
          ubicacion: null,
          fotoUrl: null,
        },
      })
    );
    // When: se abre el detalle
    render(<DetalleTarea />);
    // Then: aparece el nombre, el estado tal cual y ninguna foto
    expect(await screen.findByRole('heading', { name: 'Luis' })).toBeTruthy();
    expect(screen.getByText('asignada')).toBeTruthy();
    expect(screen.queryByRole('img', { name: /Foto de/ })).toBeNull();
  });

  test('una fecha inválida no muestra "Publicada el"', async () => {
    // Given: una tarea con fecha ilegible
    spyOn(api, 'obtenerTarea').mockResolvedValue(
      detalle({ creadoEn: 'no-es-fecha' })
    );
    // When: se abre el detalle
    render(<DetalleTarea />);
    // Then: no inventa una fecha
    await screen.findByRole('heading', { name: 'Arreglar grifo' });
    expect(screen.queryByText(/Publicada el/)).toBeNull();
  });

  test('con coordenadas muestra el mapa; aproximado si la tarea es ajena', async () => {
    // Given: una tarea ajena con coordenadas
    spyOn(api, 'obtenerTarea').mockResolvedValue(
      detalle({ latitud: 6.24, longitud: -75.58 })
    );
    // When: se abre el detalle
    render(<DetalleTarea />);
    // Then: aparece el mapa de la zona aproximada
    const mapa = await screen.findByRole('img', {
      name: 'Mapa con la zona aproximada',
    });
    await waitFor(() =>
      expect(mapa.classList.contains('leaflet-container')).toBe(true)
    );
  });

  test('en su propia tarea el mapa es exacto', async () => {
    // Given: una tarea propia con coordenadas
    spyOn(api, 'obtenerTarea').mockResolvedValue(
      detalle({ latitud: 6.244203, longitud: -75.581211, esPropia: true })
    );
    // When: se abre el detalle
    render(<DetalleTarea />);
    // Then: el mapa indica la ubicación exacta
    expect(
      await screen.findByRole('img', { name: 'Mapa con la ubicación' })
    ).toBeTruthy();
  });
});

describe('DetalleTarea: tarea no disponible (Esc 3)', () => {
  test('muestra la alerta y vuelve al tablero tras unos segundos', async () => {
    // Given: la tarea cambió de estado: el servidor responde "no disponible"
    spyOn(api, 'obtenerTarea').mockRejectedValue(
      new api.ErrorTareaNoDisponible()
    );
    // When: se abre el detalle
    render(<DetalleTarea />);
    // Then: no se carga el detalle, se avisa y todavía no se redirige
    expect((await screen.findByRole('alert')).textContent).toContain(
      MENSAJE_NO_DISPONIBLE
    );
    expect(
      screen.queryByRole('heading', { name: 'Arreglar grifo' })
    ).toBeNull();
    expect(nav.destino()).toBe('');
    // When: pasa el tiempo de espera
    await act(async () => {
      await new Promise((r) => setTimeout(r, REDIRECCION_MS + 200));
    });
    // Then: vuelve solo al tablero
    expect(nav.destino()).toBe('/tareas');
  }, 10000);

  test('si se sale antes, no redirige después', async () => {
    // Given: el aviso de no disponible mostrándose
    spyOn(api, 'obtenerTarea').mockRejectedValue(
      new api.ErrorTareaNoDisponible()
    );
    const { unmount } = render(<DetalleTarea />);
    await screen.findByRole('alert');
    // When: se desmonta el componente antes de que venza la espera
    unmount();
    await new Promise((r) => setTimeout(r, REDIRECCION_MS + 200));
    // Then: no hubo redirección
    expect(nav.destino()).toBe('');
  }, 10000);

  test('sin id en la URL cuenta como tarea no disponible', async () => {
    // Given: una URL sin ?id=
    conId(null);
    const obtener = spyOn(api, 'obtenerTarea');
    // When: se abre el detalle
    render(<DetalleTarea />);
    // Then: avisa sin consultar el backend
    expect((await screen.findByRole('alert')).textContent).toContain(
      MENSAJE_NO_DISPONIBLE
    );
    expect(obtener).not.toHaveBeenCalled();
  });

  test('si no se puede leer la URL también cuenta como no disponible', async () => {
    // Given: una página cuya URL no se puede leer
    nav.restaurar();
    Object.defineProperty(window, 'location', {
      configurable: true,
      get() {
        throw new Error('sin acceso');
      },
    });
    // When: se abre el detalle
    render(<DetalleTarea />);
    // Then: avisa que no está disponible
    expect((await screen.findByRole('alert')).textContent).toContain(
      MENSAJE_NO_DISPONIBLE
    );
    nav = simularNavegacion();
  });
});

describe('DetalleTarea: sesión y errores', () => {
  test('sin sesión invita a iniciar sesión y no llama al backend', async () => {
    // Given: no hay token
    localStorage.removeItem('ch-token');
    const obtener = spyOn(api, 'obtenerTarea');
    // When: se abre el detalle
    render(<DetalleTarea />);
    // Then: invita a iniciar sesión
    expect(
      await screen.findByRole('link', { name: /Iniciar sesión/i })
    ).toBeTruthy();
    expect(obtener).not.toHaveBeenCalled();
  });

  test('muestra "Cargando" mientras llega la respuesta', () => {
    // Given: un backend que no responde todavía
    spyOn(api, 'obtenerTarea').mockReturnValue(new Promise(() => {}));
    // When: se abre el detalle
    render(<DetalleTarea />);
    // Then: indica que carga
    expect(screen.getByRole('status').textContent).toContain('Cargando');
  });

  test('una sesión expirada redirige al login', async () => {
    // Given: un backend que responde 401
    spyOn(api, 'obtenerTarea').mockRejectedValue(new api.ErrorSesionExpirada());
    // When: se abre el detalle
    render(<DetalleTarea />);
    // Then: redirige a /login?expirada=1
    await waitFor(() => expect(nav.destino()).toBe('/login?expirada=1'));
  });

  test('si el token desaparece antes de cargar, redirige al login', async () => {
    // Given: una primera carga fallida y luego se pierde el token
    const obtener = spyOn(api, 'obtenerTarea').mockRejectedValue(
      new Error('caída')
    );
    render(<DetalleTarea />);
    await screen.findByRole('alert');
    localStorage.removeItem('ch-token');
    obtener.mockResolvedValue(detalle());
    // When: se reintenta
    fireEvent.click(screen.getByRole('button', { name: /Reintentar/i }));
    // Then: sin token se pide iniciar sesión de nuevo
    await waitFor(() => expect(nav.destino()).toBe('/login?expirada=1'));
  });

  test('un fallo de red muestra el mensaje y permite reintentar', async () => {
    // Given: un backend que falla la primera vez
    const obtener = spyOn(api, 'obtenerTarea').mockRejectedValueOnce(
      new Error('offline')
    );
    render(<DetalleTarea />);
    // When: falla la carga
    const alerta = await screen.findByRole('alert');
    // Then: muestra el mensaje y la opción de volver al tablero
    expect(alerta.textContent).toContain(MENSAJE_ERROR_DETALLE);
    expect(
      screen
        .getByRole('link', { name: 'Volver al tablero' })
        .getAttribute('href')
    ).toBe('/tareas');
    // When: el backend se recupera y se pulsa Reintentar
    obtener.mockResolvedValue(detalle());
    fireEvent.click(screen.getByRole('button', { name: /Reintentar/i }));
    // Then: se muestra el detalle
    expect(
      await screen.findByRole('heading', { name: 'Arreglar grifo' })
    ).toBeTruthy();
  });
});

describe('DetalleTarea: selección, contacto y cierre (US-013 y US-014)', () => {
  const OFERTA_PENDIENTE: api.OfertaRecibidaApi = {
    id: 'o-1',
    mensaje: 'Tengo experiencia',
    estado: 'pendiente',
    creadoEn: '2026-03-15T12:00:00.000Z',
    afiliado: {
      id: 'a-1',
      nombre: 'José',
      fotoUrl: null,
      descripcion: null,
      ubicacion: null,
      promedio: 4.5,
      totalCalificaciones: 2,
    },
  };

  test('US-013 Esc 1: tras elegir al afiliado avisa y recarga el detalle ya asignado', async () => {
    // Given: una tarea propia abierta con una oferta y un backend que asigna
    const obtener = spyOn(api, 'obtenerTarea').mockResolvedValue(
      detalle({ esPropia: true, puedeOfertar: false })
    );
    (
      api.listarOfertasRecibidas as unknown as ReturnType<typeof spyOn>
    ).mockResolvedValue([OFERTA_PENDIENTE]);
    spyOn(api, 'asignarTarea').mockResolvedValue({
      tareaId: ID,
      estado: 'asignada',
      afiliadoId: 'a-1',
    });
    render(<DetalleTarea />);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Seleccionar afiliado' })
    );
    // When: el servidor ya devuelve la tarea asignada y se confirma
    obtener.mockResolvedValue(
      detalle({
        estado: 'asignada',
        esPropia: true,
        puedeOfertar: false,
        puedeFinalizar: true,
        contacto: { nombre: 'José', email: 'jose@ejemplo.com' },
        afiliadoAsignado: { id: 'a-1', nombre: 'José' },
      })
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Confirmar selección' })
    );
    // Then: mensaje de éxito, contacto del afiliado y opción de finalizar
    expect(
      (await screen.findByRole('status', { name: '' })).textContent
    ).toBeTruthy();
    expect(await screen.findByText(MENSAJE_AFILIADO_SELECCIONADO)).toBeTruthy();
    expect(await screen.findByText('jose@ejemplo.com')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Marcar como finalizada' })
    ).toBeTruthy();
    expect(obtener).toHaveBeenCalledTimes(2);
  });

  test('US-013 Esc 5: si ya estaba asignada avisa con la alerta de la historia', async () => {
    // Given: una tarea propia abierta y un backend que dice que ya está asignada
    spyOn(api, 'obtenerTarea').mockResolvedValue(
      detalle({ esPropia: true, puedeOfertar: false })
    );
    (
      api.listarOfertasRecibidas as unknown as ReturnType<typeof spyOn>
    ).mockResolvedValue([OFERTA_PENDIENTE]);
    spyOn(api, 'asignarTarea').mockRejectedValue(
      new api.ErrorTareaYaAsignada()
    );
    render(<DetalleTarea />);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Seleccionar afiliado' })
    );
    // When: confirma
    fireEvent.click(
      screen.getByRole('button', { name: 'Confirmar selección' })
    );
    // Then: alerta "Esta tarea ya cuenta con un afiliado asignado"
    expect((await screen.findByRole('alert')).textContent).toBe(
      MENSAJE_YA_ASIGNADA
    );
  });

  test('US-013 Esc 2 y US-014 Esc 3: el afiliado elegido ve el contacto del creador y espera el cierre', async () => {
    // Given: una tarea asignada vista por el afiliado elegido
    spyOn(api, 'obtenerTarea').mockResolvedValue(
      detalle({
        estado: 'asignada',
        esAsignado: true,
        puedeOfertar: false,
        contacto: { nombre: 'Ana Pérez', email: 'ana@ejemplo.com' },
      })
    );
    // When: abre el detalle
    render(<DetalleTarea />);
    // Then: ve el contacto, el indicador de espera y no puede finalizar
    expect(await screen.findByText('ana@ejemplo.com')).toBeTruthy();
    expect(screen.getByText(MENSAJE_ESPERANDO_CIERRE)).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'Marcar como finalizada' })
    ).toBeNull();
    expect(screen.queryByRole('button', { name: 'Enviar oferta' })).toBeNull();
  });

  test('US-014 Esc 2: una tarea abierta propia no ofrece finalizar', async () => {
    // Given: una tarea propia abierta
    spyOn(api, 'obtenerTarea').mockResolvedValue(
      detalle({ esPropia: true, puedeOfertar: false })
    );
    // When: se abre el detalle
    render(<DetalleTarea />);
    // Then: sin sección de servicio ni botón de finalizar
    await screen.findByRole('heading', { name: 'Arreglar grifo' });
    expect(
      screen.queryByRole('region', { name: 'Servicio en curso' })
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Marcar como finalizada' })
    ).toBeNull();
  });

  test('una tarea finalizada ya no muestra servicio en curso', async () => {
    // Given: una tarea propia finalizada
    spyOn(api, 'obtenerTarea').mockResolvedValue(
      detalle({ estado: 'finalizada', esPropia: true, puedeOfertar: false })
    );
    // When: se abre el detalle
    render(<DetalleTarea />);
    // Then: se ve el estado y no hay acciones de servicio
    expect(await screen.findByText('finalizada')).toBeTruthy();
    expect(
      screen.queryByRole('region', { name: 'Servicio en curso' })
    ).toBeNull();
  });

  test('un creador sin afiliado cargado no ve el botón de finalizar', async () => {
    // Given: una tarea asignada sin datos del afiliado (caso defensivo)
    spyOn(api, 'obtenerTarea').mockResolvedValue(
      detalle({
        estado: 'asignada',
        esPropia: true,
        puedeOfertar: false,
        puedeFinalizar: true,
        afiliadoAsignado: null,
      })
    );
    // When: se abre el detalle
    render(<DetalleTarea />);
    // Then: se ve el servicio en curso sin contacto ni botón
    await screen.findByRole('region', { name: 'Servicio en curso' });
    expect(
      screen.queryByRole('button', { name: 'Marcar como finalizada' })
    ).toBeNull();
  });
});
