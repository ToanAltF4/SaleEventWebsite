module.exports = {
  apps: [
    {
      name: "kimngan-sale",
      script: ".next/standalone/server.js",
      cwd: "/root/SaleEventWebsite",
      env: {
        NODE_ENV: "production",
        PORT: 3838,
        HOSTNAME: "0.0.0.0",
      },
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "200M",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
  ],
};
