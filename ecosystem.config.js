module.exports = {
  apps: [
    {
      name: "kimngan-sale",
      script: "node_modules/.bin/next",
      args: "start -p 3838",
      cwd: "/root/SaleEventWebsite",
      env: {
        NODE_ENV: "production",
        PORT: 3838,
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
  ],
};
