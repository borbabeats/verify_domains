const gtmQueue = require('./queue/gtmQueue');
const processGtmCheck = require('./worker/gtmProcessor');
const winston = require('winston'); // Reutilizar o logger ou criar um novo

// Configuração básica do Winston (pode ser a mesma do gtmProcessor ou centralizada)
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console(),
    ],
});

const CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '1', 10);

logger.info(`Worker started. Waiting for jobs on queue '${gtmQueue.name}' with concurrency ${CONCURRENCY}...`);

// Define o processador para a fila
// O primeiro argumento é a concorrência (quantos jobs processar em paralelo)
gtmQueue.process(CONCURRENCY, processGtmCheck);

// Adiciona listeners para eventos da fila (opcional, mas útil para logging)
gtmQueue.on('completed', (job, result) => {
    logger.info(`Job ${job.id} (domain: ${job.data.domain}) completed successfully.`);
});

gtmQueue.on('failed', (job, err) => {
    logger.error(`Job ${job.id} (domain: ${job.data.domain}) failed with error: ${err.message}`, { stack: err.stack });
});

gtmQueue.on('error', (error) => {
    logger.error(`Queue encountered an error: ${error.message}`, { stack: error.stack });
});

// Lidar com sinais de encerramento para fechar a conexão da fila graciosamente
const shutdown = async (signal) => {
    logger.info(`Received ${signal}. Shutting down worker gracefully...`);
    try {
        await gtmQueue.close();
        logger.info('Queue connection closed. Exiting.');
        process.exit(0);
    } catch (err) {
        logger.error('Error closing queue connection during shutdown:', err);
        process.exit(1);
    }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT')); 