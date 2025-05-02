const fs = require('fs');
const path = require('path');
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
const initDomainProcessing = require('./producer/addJobs');

// Função para inicializar o processamento de domínios
const setupDomainProcessing = async () => {
    try {
        await initDomainProcessing();
    } catch (error) {
        logger.error('Error setting up domain processing:', error);
    }
};

setupDomainProcessing();

logger.info(`Worker started. Waiting for jobs on queue '${gtmQueue.name}' with concurrency ${CONCURRENCY}...`);

// Define o processador para a fila
// O primeiro argumento é a concorrência (quantos jobs processar em paralelo)
gtmQueue.process(CONCURRENCY, processGtmCheck);

// --- Processador para o JOB REPETÍVEL que dispara a re-verificação ---
// Usar um nome específico no processador para o job repetível
gtmQueue.process(REPEATABLE_JOB_NAME, 1, async (job) => {
    logger.info(`'${REPEATABLE_JOB_NAME}' job received. Triggering domain recheck...`);
    try {
        await addDomainsFromJSON();
        logger.info(`Domain recheck triggered successfully by job ${job.id}.`);
    } catch (error) {
        logger.error(`Error processing '${REPEATABLE_JOB_NAME}' job ${job.id}:`, error);
        // Lançar o erro novamente para que o Bull o marque como falho
        throw error;
    }
});

// Adiciona listeners para eventos da fila (opcional, mas útil para logging)
gtmQueue.on('completed', (job, result) => {
    // Distinguir log se for o job de agendamento ou de domínio?
    if (job.name === REPEATABLE_JOB_NAME) {
        logger.info(`Scheduled trigger job '${job.name}' (ID: ${job.id}) completed.`);
    } else {
        logger.info(`Domain check job ${job.id} (domain: ${job.data.domain}) completed successfully.`);
    }
});

gtmQueue.on('failed', (job, err) => {
     if (job.name === REPEATABLE_JOB_NAME) {
        logger.error(`Scheduled trigger job '${job.name}' (ID: ${job.id}) failed: ${err.message}`, { stack: err.stack });
     } else {
        logger.error(`Domain check job ${job.id} (domain: ${job.data.domain}) failed: ${err.message}`, { stack: err.stack });
     }
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