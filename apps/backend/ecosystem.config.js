module.exports = {
  apps: [{
    name: 'tastefun-backend',
    script: './src/index.ts',
    interpreter: 'node',
    interpreter_args: '--loader ts-node/esm',
    instances: 1,
    exec_mode: 'fork',
    env_production: {
      NODE_ENV: 'production',
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    max_memory_restart: '1G',
    autorestart: true,
    watch: false,
  }]
};