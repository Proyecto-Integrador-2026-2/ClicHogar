## Resumen de la fase completada

### Backend
- **Tipos nuevos** en `entities/oferta.entity.ts`:
  - `TareaResumenOferta`, `OfertaAceptada`, `TareaConOfertas`, `MisOfertas`
- **Repositorio** (`repositories/ofertas.repository.ts`):
  - `listarAceptadas(usuarioId)` → solo tareas con `estado='asignada'` y `afiliado_asignado_id = usuario.id`, con la oferta aceptada. Tope 100, más recientes primero. Si devuelve vacío, el frontend oculta el contenedor superior.
  - `listarCreadas(usuarioId)` → todas las tareas del usuario con sus ofertas (afiliado, mensaje, estado, fecha, reputación). Una sola consulta sin N+1.
- **Servicio** (`services/ofertas.service.ts`):
  - `listarMias(usuario)` → `{ aceptadas, creadas }`, promedios redondeados a 1 decimal.
- **Controlador** (`controllers/ofertas.controller.ts`):
  - Nuevo `GET /api/ofertas/mias` (protegido por sesión). Se mantiene intacto `GET /api/tareas/:id/ofertas`.
- **app.ts**: Se registra el nuevo controlador antes de `ofertasController`.

### Frontend
- **API** (`lib/usuarios-api.ts`): tipos `MisOfertasApi`, `OfertaRecibidaApi`, etc.; función `listarMisOfertas(token)`.
- **Componentes**:
  - `components/react/auth/MisOfertas.tsx`: pantalla con dos bloques verticales reutilizando `useCargaConSesion`, `PantallaCargando`, `PantallaSinSesion`, `AlertaConReintento`, `hrefPerfil`, `urlPublica`, `Estrellas`.
    - Bloque superior: "Tareas aceptadas" — solo si hay tareas activas asignadas. Tarjeta con título, ubicación, estado, cliente y enlace al detalle.
    - Bloque inferior: "Mis tareas publicadas" — sección por tarea creada, cada una con su lista completa de ofertas recibidas (foto, nombre, reputación, mensaje, estado, fecha). Enlaces al perfil público del afiliado y a la tarea.
  - `components/react/auth/MisOfertasIsla.tsx`: isla `client:only="react"`.
- **Página**: `pages/dashboard/ofertas/mias.astro` → protegida por `/dashboard`, muestra `<MisOfertasIsla />`.
- **Dashboard**: Nuevo módulo "Ver todas mis ofertas" en `/dashboard`, sin clase de rol (visible para cliente y afiliado), enlazando a `/dashboard/ofertas/mias`.

### Decisiones adoptadas
- Ofertas enviadas pendientes o rechazadas: **fuera** (solo los dos contenedores acordados).
- Afiliados ven ambos bloques (aceptadas si tiene asignación, y sus tareas con ofertas).
- Tope de 100 ofertas/tareas, sin paginación en esta fase.
- El endpoint por tarea `GET /api/tareas/:id/ofertas` sigue existiendo sin cambios.
- El detalle de tarea propia ya mostraba ofertas y perfil del afiliado; esto se mantiene.

### Pruebas ejecutadas
| Herramienta | Resultado |
|---|---|
| `npx tsc --noEmit` | OK |
| `bun run lint` | OK |
| `bun test` | 376 pass, 0 fail (38 archivos) |
| E2e Playwright | 23 passed (6 proyectos) |

### Próximo paso recomendado (tras salir del modo Plan)
No aplicar cambios automáticos. Si el usuario cambia a agente de implementación, se pueden validar integraciones adicionales o iterar sobre el feedback. Pero la fase está completa y verificada.