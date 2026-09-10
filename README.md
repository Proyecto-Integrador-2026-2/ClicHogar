# Clic Hogar 🛠️

## Descripción del Proyecto

**Clic Hogar** es el desarrollo de un prototipo funcional de una plataforma digital (App web) de uso gratuito, orientada a centralizar, agilizar y asegurar la localización y contratación de servicios de mantenimiento residencial y microtrabajos bajo el modelo de economía _gig_[cite: 1, 2].

El objetivo principal de la plataforma es conectar de manera eficiente a usuarios con necesidades cotidianas o de mantenimiento con trabajadores independientes ("Clic-Workers") y profesionales de oficios, optimizando el tiempo y generando oportunidades de ingresos complementarios para la comunidad[cite: 1, 2].

## Alcance Operativo (Categorías de Servicio)

El proyecto se enfoca en resolver la dispersión de la oferta en las siguientes categorías[cite: 2]:

- **Servicios del Hogar (Especializados):** Limpieza, empleadas domésticas, plomería, electricidad, reparación de techos, pintura, carpintería y albañilería[cite: 1, 4].
- **Microtrabajos (Asistencia Rápida):** Logística menor (ayuda en mudanzas, cargar muebles), gestión de tiempo (hacer filas, compras urgentes) y asistencia general (armar muebles, pasear mascotas, jardinería)[cite: 1, 4].

## Funcionalidades Clave (MVP)

Para el desarrollo del Producto Mínimo Viable, Clic Hogar contempla[cite: 1]:

- **Motor de Geolocalización:** Implementación de servicios basados en ubicación (LBS) para mostrar a los usuarios la oferta más cercana.
- **Gestión de Perfiles Duales:** Sistema que permite operar fluidamente como "Cliente" (demandante) y "Afiliado/Prestador de servicio" (oferente) desde una única cuenta[cite: 1, 4].
- **Sistema Bidireccional de Calificaciones:** Módulo de reseñas para establecer un ecosistema basado en la confianza y mitigar la incertidumbre del mercado informal[cite: 1, 2].
- **Chat Interno Integrado:** Canal de mensajería segura para la negociación de condiciones previo a la confirmación de la orden[cite: 1].

## Arquitectura y Stack Tecnológico

Este proyecto utiliza una arquitectura de Islas (híbrida) y un entorno de Monorepo:

- **Frontend:** Astro, React, TypeScript[cite: 4, 5].
- **Backend:** Node.js, TypeScript[cite: 4, 5].
- **Base de Datos:** PostgreSQL[cite: 4, 5].
- **Gestor de Paquetes y Runtime:** Bun.

## Configuración del Entorno Local

1. Clona el repositorio: `git clone https://github.com/tu-usuario/ClicHogar.git`
2. Instala las dependencias ultrarrápidas con Bun:
   ```bash
   cd frontend && bun install
   cd ../backend && bun install
   ```
