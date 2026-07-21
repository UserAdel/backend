module.exports = {
  apps: [
    {
      name: "hurghada-backend",
      script: "./dist/index.js",
      cwd: "./",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: 5000,
        MONGODB_URI: "mongodb+srv://adile:adilelove1@cluster0.nkexinn.mongodb.net/Hurghada?appName=Cluster0",
        JWT_SECRET: "nasu_backend_secret_key_2026",
        CLIENT_URL: "http://localhost:5173",
        WAPILOT_INSTANCE: "instance3322",
        WAPILOT_TOKEN: "zNgzkd9gmIJ1CMbvxNlyBaA0XEAFFpxk6HK35RLv7q",
        ADMIN_PHONE: "01273809805",
        BASE_URL: "http://187.124.13.247:5000",
        FRONTEND_URL: "http://187.124.13.247:5173"
      },
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      error_file: "./logs/pm2-error.log",
      out_file: "./logs/pm2-out.log",
      merge_logs: true
    }
  ]
};
