/**
 * PM2 конфигурация для production развертывания watchRebel
 * 
 * Использование:
 * pm2 start ecosystem.config.js
 * pm2 save
 * pm2 startup
 */

module.exports = {
  apps: [
    {
      name: 'watchrebel-server',
      script: './server/src/index.js',
      cwd: './',
      env: {
        NODE_ENV: 'production',
        PORT: 1313
      },
      instances: 1,
      exec_mode: 'cluster',
      max_memory_restart: '500M',
      error_file: './logs/server-error.log',
      out_file: './logs/server-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      watch: false,
      max_restarts: 10,
      min_uptime: '10s'
    },
    {
      name: 'watchrebel-telegram',
      script: './telegram-bot/src/index.js',
      cwd: './',
      env: {
        NODE_ENV: 'production'
      },
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '200M',
      error_file: './logs/telegram-error.log',
      out_file: './logs/telegram-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      watch: false,
      max_restarts: 10,
      min_uptime: '10s'
    }
  ]
};
