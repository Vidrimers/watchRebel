import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true, // Слушать на всех интерфейсах
    allowedHosts: [
      'prosurrender-rickety-brenda.ngrok-free.dev',
      '.ngrok-free.dev', // Разрешаем все ngrok домены
      'dev.watchrebel.ru', // Cloudflare Tunnel
      '.watchrebel.ru', // Все поддомены watchrebel.ru
      '.trycloudflare.com', // Cloudflare quick tunnels
      'localhost'
    ],
    hmr: {
      host: 'dev.watchrebel.ru', // Cloudflare Tunnel домен
      clientPort: 443, // HTTPS порт
      protocol: 'wss', // WebSocket Secure для HTTPS
    },
    proxy: {
      '/api': {
        target: 'http://localhost:1313',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
});
