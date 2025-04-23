module.exports = {
    apps: [
        {
            name: "gtm-worker",
            script: "./src/worker.js",
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: "1G",
            env: {
                NODE_ENV: "development",
            },
            env_production: {
                NODE_ENV: "production",
            },
        },
        {
            name: "gtm-scheduler-setup",
            script: "./src/producer/addJobs.js",
            instances: 1,
            autorestart: false,
            watch: false,
            max_memory_restart: "256M",
            restart_delay: 10000,
            max_restarts: 0,
            env: {
                NODE_ENV: "development",
            },
            env_production: {
                NODE_ENV: "production",
            },
        },
    ],
};