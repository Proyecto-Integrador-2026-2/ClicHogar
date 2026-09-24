import { SQL } from 'bun';
import { env } from '../config/env';

/**
 * Cliente SQL nativo de Bun (pool de conexiones incluido). Sin ORM: todas
 * las queries se escriben a mano con tagged templates parametrizadas
 * (protegen contra SQL injection igual que un prepared statement).
 */
export const sql = new SQL(env.DATABASE_URL);
