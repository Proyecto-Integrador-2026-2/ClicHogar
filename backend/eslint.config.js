// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['drizzle/**', 'node_modules/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Es un servidor: loguear arranque/errores por consola es normal.
      'no-console': 'off',
      '@typescript-eslint/no-unused-vars': 'error',
    },
  }
);
