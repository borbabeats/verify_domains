require('dotenv').config({ path: '../../.env' });
const Queue = require('bull');

const redisConfig = {
  host: process.env.REDIS_HOST || 'redis',
  port: process.env.REDIS_PORT || 6379,
  // password: process.env.REDIS_PASSWORD, // Descomente se houver senha
};

const queueName = process.env.QUEUE_NAME || 'gtm_checks';

// Cria e exporta a instância da fila
const gtmQueue = new Queue(queueName, { redis: redisConfig });

console.log(`Queue '${queueName}' connected to Redis at ${redisConfig.host}:${redisConfig.port}`);

module.exports = gtmQueue; 