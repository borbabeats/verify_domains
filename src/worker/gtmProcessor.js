const puppeteer = require('puppeteer');
const knex = require('../db/knex');
const winston = require('winston'); // Para logging

// Configuração básica do Winston (pode ser melhorada)
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console(),
        // new winston.transports.File({ filename: 'worker.log' }) // Opcional: logar para arquivo
    ],
});

const GTM_TABLE = 'domains_gtm_status';
// Regex mais flexível: Procura pelo padrão GTM-XXXXXX em qualquer lugar do HTML
const GTM_REGEX = /(GTM-[A-Z0-9]{6,})/i; // Procura por GTM- seguido por 6 ou mais caracteres alfanuméricos

/**
 * Processa um job da fila, verificando o GTM em um domínio.
 * @param {import('bull').Job} job - O job do Bull contendo o dom
 */
const processGtmCheck = async (job) => {
    const { domain } = job.data;
    logger.info(`Processing domain: ${domain}`);

    let browser = null;
    let gtmInstalled = false;
    let gtmCode = null;

    try {
        // Opções para Puppeteer (ajustar conforme necessário, especialmente no Docker)
        const launchOptions = {
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu'
            ]
        };
        // Descomente a linha abaixo se precisar especificar o path do Chrome (veja .env.example)
        // if (process.env.CHROME_EXECUTABLE_PATH) {
        //     launchOptions.executablePath = process.env.CHROME_EXECUTABLE_PATH;
        // }

        browser = await puppeteer.launch(launchOptions);
        const page = await browser.newPage();

        // Aumentar timeout e configurar user-agent
        await page.setDefaultNavigationTimeout(60000); // 60 segundos
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.51 Safari/537.36 GTM-Checker/1.0');

        logger.info(`Navigating to https://${domain}`);
        const response = await page.goto(`https://${domain}`, { waitUntil: 'networkidle2' });

        if (response && response.ok()) {
            logger.info(`Navigation successful for ${domain}. Status: ${response.status()}`);
            const content = await page.content();

            // Procurar pelo padrão GTM ID
            const match = content.match(GTM_REGEX);
            if (match && match[1]) { // match[1] contém o ID capturado
                gtmInstalled = true;
                gtmCode = match[1].toUpperCase(); // Usa o ID encontrado
                logger.info(`GTM Pattern Found for ${domain}: ${gtmCode}`);
            } else {
                logger.info(`GTM Not Found for ${domain}`);
            }
        } else {
            logger.warn(`Failed to navigate to ${domain}. Status: ${response ? response.status() : 'N/A'}`);
            // Considerar salvar um status de erro no DB?
        }

    } catch (error) {
        logger.error(`Error processing domain ${domain}: ${error.message}`);
        // Aqui você pode querer salvar um status de erro no banco de dados
        // Ex: gtmInstalled = false, gtmCode = null, error_message = error.message
        // Por simplicidade, apenas logamos o erro.

    } finally {
        if (browser) {
            await browser.close();
            logger.info(`Browser closed for ${domain}`);
        }

        // Salvar ou atualizar no banco de dados
        try {
            logger.info(`Saving results for ${domain} to database...`);
            await knex(GTM_TABLE)
                .insert({
                    domain: domain,
                    gtm_installed: gtmInstalled,
                    gtm_code: gtmCode
                })
                .onConflict('domain') // Se o domínio já existe...
                .merge({ // ...atualiza os campos
                    gtm_installed: gtmInstalled,
                    gtm_code: gtmCode,
                    updated_at: knex.fn.now() // Atualiza explicitamente o updated_at
                });
            logger.info(`Database update complete for ${domain}`);
        } catch (dbError) {
            logger.error(`Database error for domain ${domain}: ${dbError.message}`);
        }
    }
};

module.exports = processGtmCheck;