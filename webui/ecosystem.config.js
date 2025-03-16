module.exports = {
  apps: [{
    name: "canvus-webui",
    script: "./server.js",
    interpreter: "authbind",
    interpreter_args: "--deep node",
    env: {
      NODE_ENV: "development",
      PORT: 3000
    },
    env_production: {
      NODE_ENV: "production",
      PORT: 3000
    }
  }]
} 