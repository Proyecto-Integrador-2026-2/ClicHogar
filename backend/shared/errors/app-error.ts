/**
 * Errores de dominio/aplicación, independientes de HTTP.
 * Los controllers (o el error handler global de Elysia) los traducen al
 * código de estado correspondiente.
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** 400 — la petición no cumple las reglas de validación del servidor. */
export class ValidationError extends AppError {
  constructor(message = 'Los datos enviados no son válidos.') {
    super(message, 400);
  }
}

/** 401 — credenciales inválidas o sesión no autenticada. */
export class UnauthorizedError extends AppError {
  constructor(message = 'No autorizado.') {
    super(message, 401);
  }
}

/** 403 — autenticado pero sin permisos sobre el recurso. */
export class ForbiddenError extends AppError {
  constructor(message = 'No tienes permisos para realizar esta acción.') {
    super(message, 403);
  }
}

/** 404 — el recurso solicitado no existe. */
export class NotFoundError extends AppError {
  constructor(message = 'Recurso no encontrado.') {
    super(message, 404);
  }
}

/** 409 — el recurso entra en conflicto con el estado actual (p. ej. duplicados). */
export class ConflictError extends AppError {
  constructor(message = 'El recurso ya existe.') {
    super(message, 409);
  }
}

/** 429 — se superó un límite de intentos (p. ej. fuerza bruta en login). */
export class TooManyRequestsError extends AppError {
  constructor(message = 'Demasiados intentos. Inténtalo más tarde.') {
    super(message, 429);
  }
}
