import { buildApp } from './app';
import { env } from './config/env';

buildApp().listen(env.PORT);

console.log(`🚀 ClicHogar backend corriendo en http://localhost:${env.PORT}`);
