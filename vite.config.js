import { defineConfig } from 'vite';

// GitHub Pages liefert die Seite unter /QuantiViz/ aus, lokal bleibt es /
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/QuantiViz/' : '/',
}));
