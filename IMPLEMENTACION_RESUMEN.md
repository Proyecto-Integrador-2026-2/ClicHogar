## Fase "Mis Ofertas" - COMPLETADA ✅

### Qué se hizo

1. **Dashboard**: Botón "Ver todas mis ofertas" con clase `ch-dash-module--soli-afiliado` → visible solo para afiliados (CSS `display: none` para clientes).

2. **Página `/dashboard/ofertas/mias`**: Dos bloques verticales:
   - **Tareas aceptadas** (solo si hay, si no, hidden)
   - **Mis tareas publicadas** — sección por tarea con todas sus ofertas recibidas, con foto/nombre/ reputación/ mensaje/ estado/ fecha. Enlaces al perfil del afiliado y a la tarea.

3. **API y tipos**: `GET /api/ofertas/mias` con respuesta `{ aceptadas, creadas }`, sin crear tabla nueva en BD (queries sobre `ofertas` + `tareas` + `usuarios`).

4. **Pruebas**: 376 unitarias + 18 E2E = todas verdes.

### Verificación
- `npx tsc --noEmit`: OK
- `bun run lint`: OK  
- `bun test`: 376 pass, 0 fail
- E2E: 18 passed, 0 fail