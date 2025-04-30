const fs = require('fs');
const path = require('path');
// Caminho atualizado para a fila
const gtmQueue = require('../queue/gtmQueue');
const winston = require('winston');

// Caminho atualizado para o arquivo de domínios
const domainsFilePath = path.join(__dirname, '../../domains.json');

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
    transports: [new winston.transports.Console()],
});

const REPEATABLE_JOB_NAME = 'trigger-domain-recheck';
const REPEATABLE_JOB_ID = 'domain-recheck-scheduler';
const CRON_SCHEDULE = '*/60 * * * *'; // Every 20 minutes

const addDomainsToQueue = async () => {
    try {
        console.log(`Reading domains from: ${domainsFilePath}`);
        // Certificar que o arquivo exista antes de ler
        if (!fs.existsSync(domainsFilePath)) {
            console.warn(`Domains file not found at ${domainsFilePath}. Skipping job addition.`);
            // Não sair, apenas avisar e permitir que o worker inicie
            return;
        }
        const domainsData = fs.readFileSync(domainsFilePath, 'utf-8');
        const domains = JSON.parse(domainsData);

        if (!Array.isArray(domains)) {
            throw new Error('domains.json should contain an array of domain strings.');
        }

        if (domains.length === 0) {
            console.log('No domains found in domains.json. No jobs to add.');
            return;
        }

        console.log(`Found ${domains.length} domains. Adding to queue '${gtmQueue.name}'...`);

        const jobPromises = domains.map(domain => {
            if (typeof domain === 'string' && domain.trim() !== '') {
                return gtmQueue.add({ domain: domain.trim() }, { jobId: domain.trim(), removeOnComplete: true, removeOnFail: 5 });
            } else {
                console.warn(`Skipping invalid domain entry: ${domain}`);
                return null;
            }
        });

        const results = await Promise.all(jobPromises.filter(p => p !== null));
        console.log(`Added ${results.length} jobs to the queue.`);

    } catch (error) {
        console.error('Error adding domains to queue:', error);
        // Não sair com process.exit(1) para não parar o container se rodar via PM2
        // PM2 gerenciará o reinício se necessário, ou marcaremos como não reiniciável
    } finally {
        // Fecha a conexão com a fila após adicionar os jobs
        // Adicionado um pequeno atraso para garantir que os comandos sejam enviados ao Redis
        setTimeout(async () => {
           try {
               await gtmQueue.close();
               console.log('Producer queue connection closed.');
           } catch (closeError) {
               console.error('Error closing producer queue connection:', closeError);
           }
           // Se estiver rodando como um script único (não via PM2), poderíamos sair aqui.
           // Como vamos rodar via PM2, deixamos o PM2 controlar o estado do processo.
        }, 2000);
    }
};

const setupRepeatableJob = async () => {
    try {
        logger.info('Setting up repeatable job for domain recheck...');

        // Obter todos os jobs repetíveis existentes para remover o antigo (se houver)
        const repeatableJobs = await gtmQueue.getRepeatableJobs();
        for (const job of repeatableJobs) {
            if (job.id === REPEATABLE_JOB_ID || job.name === REPEATABLE_JOB_NAME) {
                logger.info(`Removing existing repeatable job with key: ${job.key}`);
                await gtmQueue.removeRepeatableByKey(job.key);
            }
        }

        // Adiciona o novo job repetível
        await gtmQueue.add(REPEATABLE_JOB_NAME, // Nome do job para o processador do worker
            {}, // Dados do job (vazio neste caso, o processador sabe o que fazer)
            {
                jobId: REPEATABLE_JOB_ID, // ID único para este job repetível
                repeat: { cron: CRON_SCHEDULE },
                removeOnComplete: true, // Remove o job da fila após a conclusão do trigger
                removeOnFail: true      // Remove se falhar
            }
        );

        logger.info(`Repeatable job '${REPEATABLE_JOB_NAME}' scheduled with cron '${CRON_SCHEDULE}'.`);

    } catch (error) {
        logger.error('Error setting up repeatable job:', error);
        // Não sair com process.exit(1) para não parar o container
    } finally {
        // Fecha a conexão com a fila após configurar o job
        setTimeout(async () => {
            try {
                await gtmQueue.close();
                logger.info('Scheduler setup queue connection closed.');
            } catch (closeError) {
                logger.error('Error closing scheduler setup queue connection:', closeError);
            }
        }, 2000);
    }
};

addDomainsToQueue();
setupRepeatableJob(); 