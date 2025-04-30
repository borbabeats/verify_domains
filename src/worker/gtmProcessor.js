const puppeteer = require('puppeteer');
const knex = require('../db/knex');
const winston = require('winston'); // Para logging
const { checkConverteAI } = require('./checks/converteAIChecker');
const { checkCheckoutLinks } = require('./checks/checkoutChecker');//import new function

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
const GTM_REGEX = /(GTM-[A-Z0-9]{6,})/i;

/**
 * Processa um job da fila, verificando o GTM em um domínio.
 * @param {import('bull').Job} job - O job do Bull contendo o dom
 */
const processGtmCheck = async (job) => {
    const { domain } = job.data;
    const fullDomainUrl = `https://${domain}`;
    logger.info(`Processing domain: ${domain} (URL: ${fullDomainUrl})`);

    let browser = null;
    let page = null; // Manter referência da página
    let gtmInstalled = false;
    let gtmCode = null;
    // Inicializar objeto para resultados ConverteAI com valores padrão
    let converteAIResults = {
        converteAIInstalled: false,
        pv: null,
        pve: null,
        pva: null,
        pvb: null,
        hasABTest: 'Not Checked' // Status inicial
    };

    let checkoutLinksResults = {
        checkoutLinkPV: null,
        checkoutLinkPVE: null,
        checkoutLinkPVA: null,
        checkoutLinkPVB: null,
        checkoutPlatformPV: null,
        checkoutPlatformPVE: null,
        checkoutPlatformPVA: null,
        checkoutPlatformPVB: null,
        checkoutLinkFoundFromVTurb: false
    };

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
        page = await browser.newPage();

        // Aumentar timeout e configurar user-agent
        await page.setDefaultNavigationTimeout(60000); // 60 segundos
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.51 Safari/537.36 GTM-Checker/1.0');

        logger.info(`Navigating to ${fullDomainUrl} for GTM check`);
        const response = await page.goto(fullDomainUrl, { waitUntil: 'networkidle2' });

        if (response && response.ok()) {
            logger.info(`GTM Check: Navigation successful for ${domain}. Status: ${response.status()}`);
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
            logger.warn(`GTM Check: Failed to navigate to ${domain}. Status: ${response ? response.status() : 'N/A'}`);
            // Considerar salvar um status de erro no DB?
        }

        // --- ConverteAI Check --- (reutiliza a mesma página)
        // A função checkConverteAI fará as navegações necessárias nos subdiretórios
        logger.info(`Starting ConverteAI check for ${domain}`);
        converteAIResults = await checkConverteAI(page, fullDomainUrl);
        logger.info(`ConverteAI check completed for ${domain}. Found: ${converteAIResults.converteAIInstalled}, A/B Status: ${converteAIResults.hasABTest}`);

        // --- Checkout Links Check ---
        logger.info(`Starting Checkout Links check for ${domain}`);
        checkoutLinksResults = await checkCheckoutLinks(page, fullDomainUrl);
        logger.info(`Checkout Links check completed for ${domain}. Results: ${JSON.stringify(checkoutLinksResults)}`);

    } catch (error) {
        logger.error(`Error processing domain ${domain}: ${error.message}`, { stack: error.stack });
        // No caso de erro geral, garantir que os resultados ConverteAI tenham um status de erro
        converteAIResults.hasABTest = 'Error Processing';

    } finally {
        if (browser) {
            await browser.close();
            logger.info(`Browser closed for ${domain}`);
        }

        // Salvar ou atualizar no banco de dados
        try {
            logger.info(`Data to save: ${JSON.stringify({
                domain: domain,
                gtm_installed: gtmInstalled,
                gtm_code: gtmCode,
                converteai_installed: converteAIResults.converteAIInstalled,
                converteai_pv_url: converteAIResults.pv,
                converteai_pve_url: converteAIResults.pve,
                converteai_pva_url: converteAIResults.pva,
                converteai_pvb_url: converteAIResults.pvb,
                converteai_ab_test_status: converteAIResults.hasABTest,
                converteai_ab_test_status: converteAIResults.hasABTest,
                checkout_link_pv: checkoutLinksResults.checkoutLinkPV,
                checkout_link_pve: checkoutLinksResults.checkoutLinkPVE,
                checkout_link_pva: checkoutLinksResults.checkoutLinkPVA,
                checkout_link_pvb: checkoutLinksResults.checkoutLinkPVB,
                checkout_platform_pv: checkoutLinksResults.checkoutPlatformPV,
                checkout_platform_pve: checkoutLinksResults.checkoutPlatformPVE,
                checkout_platform_pva: checkoutLinksResults.checkoutPlatformPVA,
                checkout_platform_pvb: checkoutLinksResults.checkoutPlatformPVB,
                checkout_links_found: checkoutLinksResults.checkoutLinkFoundFromVTurb,
                created_at: new Date(),
                updated_at: new Date()
            })}`);
            await knex(GTM_TABLE)
                .insert({
                    domain: domain,
                    gtm_installed: gtmInstalled,
                    gtm_code: gtmCode,
                    // Novos campos ConverteAI
                    converteai_installed: converteAIResults.converteAIInstalled,
                    converteai_pv_url: converteAIResults.pv,
                    converteai_pve_url: converteAIResults.pve,
                    converteai_pva_url: converteAIResults.pva,
                    converteai_pvb_url: converteAIResults.pvb,
                    converteai_ab_test_status: converteAIResults.hasABTest,
                    // Novos campos Checkout Links
                    checkout_link_pv: checkoutLinksResults.checkoutLinkPV,
                    checkout_link_pve: checkoutLinksResults.checkoutLinkPVE,
                    checkout_link_pva: checkoutLinksResults.checkoutLinkPVA,
                    checkout_link_pvb: checkoutLinksResults.checkoutLinkPVB,
                    checkout_platform_pv: checkoutLinksResults.checkoutPlatformPV,
                    checkout_platform_pve: checkoutLinksResults.checkoutPlatformPVE,
                    checkout_platform_pva: checkoutLinksResults.checkoutPlatformPVA,
                    checkout_platform_pvb: checkoutLinksResults.checkoutPlatformPVB,
                    checkout_links_found: checkoutLinksResults.checkoutLinkFoundFromVTurb,
                    created_at: new Date(),
                    updated_at: new Date()
                })
                .onConflict('domain') // Se o domínio já existe...
                .merge({ // ...atualiza os campos
                    gtm_installed: gtmInstalled,
                    gtm_code: gtmCode,
                    converteai_installed: converteAIResults.converteAIInstalled,
                    converteai_pv_url: converteAIResults.pv,
                    converteai_pve_url: converteAIResults.pve,
                    converteai_pva_url: converteAIResults.pva,
                    converteai_pvb_url: converteAIResults.pvb,
                    converteai_ab_test_status: converteAIResults.hasABTest,
                    // Atualizar campos de Checkout Links
                    checkout_link_pv: checkoutLinksResults.checkoutLinkPV,
                    checkout_link_pve: checkoutLinksResults.checkoutLinkPVE,
                    checkout_link_pva: checkoutLinksResults.checkoutLinkPVA,
                    checkout_link_pvb: checkoutLinksResults.checkoutLinkPVB,
                    checkout_platform_pv: checkoutLinksResults.checkoutPlatformPV,
                    checkout_platform_pve: checkoutLinksResults.checkoutPlatformPVE,
                    checkout_platform_pva: checkoutLinksResults.checkoutPlatformPVA,
                    checkout_platform_pvb: checkoutLinksResults.checkoutPlatformPVB,
                    checkout_links_found: checkoutLinksResults.checkoutLinkFoundFromVTurb,
                    updated_at: new Date() // Atualiza explicitamente o updated_at
                });
            logger.info(`Database update complete for ${domain}`);
        } catch (dbError) {
            logger.error(`Database error for domain ${domain}: ${dbError.message}`);
        }
    }
};

module.exports = processGtmCheck;