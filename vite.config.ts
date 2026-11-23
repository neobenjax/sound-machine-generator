import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/sound-machine-generator/',
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        'website-example': 'website-example/index.html',
      },
    },
  },
});
