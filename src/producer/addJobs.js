const fs = require('fs');
const path = require('path');
// Caminho atualizado para a fila
const gtmQueue = require('../queue/gtmQueue');

// Caminho atualizado para o arquivo de domínios
const domainsFilePath = path.join(__dirname, '../../domains.json');

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

addDomainsToQueue(); 