module.exports = {
  apps: [{
    name: "neohub",
    script: "./server.js",
    instances: 1,
    exec_mode: "cluster",
    env: {
      NODE_ENV: "production",
      PORT: 3020,
      DB_HOST: "localhost",
      DB_PORT: 5432,
      DB_NAME: "neohub",
      DB_USER: "postgres",
      DB_PASSWORD: "sua_senha"
    },
    env_production: {
      NODE_ENV: "production"
    }
  }]
} 