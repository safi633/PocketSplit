import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const frontendRoot = import.meta.dirname;

export default defineConfig({
  root: frontendRoot,
  
  build: {
    rollupOptions: {
      input: {
        main: resolve(frontendRoot, 'index.html'),
        login: resolve(frontendRoot, 'login.html'),
        signup: resolve(frontendRoot, 'signup.html'),
      },
    },
  },
});
