import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Rutas relativas: el precache del service worker resuelve sin depender de la raíz.
  base: './',
});
