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
const domainsFilePath = path.join(__dirname, '../domains.json'); // Caminho para domains.json
const REPEATABLE_JOB_NAME = 'trigger-domain-recheck';

// Função para ler domains.json e adicionar jobs à fila GTM
const addDomainsFromJSON = async () => {
    logger.info(`Reading domains from: ${domainsFilePath} for scheduled check.`);
    try {
        if (!fs.existsSync(domainsFilePath)) {
            logger.warn(`Domains file not found at ${domainsFilePath}. Skipping scheduled job addition.`);
            return;
        }
        const domainsData = fs.readFileSync(domainsFilePath, 'utf-8');
        const domains = JSON.parse(domainsData);

        if (!Array.isArray(domains)) {
            logger.error('domains.json should contain an array of domain strings.');
            return;
        }

        if (domains.length === 0) {
            logger.info('No domains found in domains.json. No scheduled jobs to add.');
            return;
        }

        logger.info(`Found ${domains.length} domains. Adding to queue '${gtmQueue.name}' for recheck...`);

        const jobPromises = domains.map(domain => {
            if (typeof domain === 'string' && domain.trim() !== '') {
                // Adiciona com o mesmo Job ID para possível substituição/atualização implícita
                // ou apenas adiciona como novo job
                return gtmQueue.add({ domain: domain.trim() }, {
                    jobId: domain.trim(), // Usar domínio como ID pode sobrescrever jobs pendentes (se desejado)
                    removeOnComplete: true,
                    removeOnFail: 5
                });
            } else {
                logger.warn(`Skipping invalid domain entry from domains.json: ${domain}`);
                return null;
            }
        });

        const results = await Promise.all(jobPromises.filter(p => p !== null));
        logger.info(`Added/Updated ${results.length} domain jobs to the queue from scheduled check.`);

    } catch (error) {
        logger.error('Error reading domains.json or adding scheduled jobs to queue:', error);
    }
    // Não fechar a conexão gtmQueue aqui, pois o worker precisa dela ativa
};

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