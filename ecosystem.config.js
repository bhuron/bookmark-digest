module.exports = {
  apps: [
    {
      name: 'bookmark-digest-backend',
      cwd: './backend',
      script: 'src/index.js',
      interpreter: 'node',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        // The backend also serves the built frontend, so there is no separate
        // frontend process. Run `npm run build` before `npm start`.
        NODE_ENV: 'production',
        PORT: 3001,
      },
      error_file: '../logs/backend-error.log',
      out_file: '../logs/backend-out.log',
      log_file: '../logs/backend-combined.log',
      time: true,
    },
  ],
};
