import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
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
