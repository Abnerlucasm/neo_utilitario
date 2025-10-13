module.exports = {
  apps: [{
    name: 'neodeploy',
    script: 'server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'development',
      PORT: 3000,
      LOG_LEVEL: 'debug'
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000,
      LOG_LEVEL: 'error'
    },
    // Configurações de produção
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024',
    
    // Logs
    log_file: './logs/combined.log',
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    
    // Auto restart
    watch: false,
    ignore_watch: ['node_modules', 'logs', 'dist', 'dist-dev'],
    
    // Configurações de cluster
    min_uptime: '10s',
    max_restarts: 10,
    
    // Configurações de segurança
    kill_timeout: 5000,
    listen_timeout: 3000,
    
    // Configurações de performance
    increment_var: 'PORT'
  }]
};
