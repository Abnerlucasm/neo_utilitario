module.exports = {
  apps: [{
    name: "glassfish-manager",
    script: "./server.js",
    instances: 1,
    exec_mode: "cluster",
    env: {
      NODE_ENV: "production",
      PORT: 3000,
      MONGODB_URI: "mongodb://root:09042003@localhost:27017/neoutilitario?authSource=neoutilitario"
    },
    env_production: {
      NODE_ENV: "production"
    }
  }]
} 