const puppeteer = require("puppeteer");

class GTMParser {
  static async checkGTM(domain) {
    let browser;
    try {
      const url = domain.startsWith("http") ? domain : `https://${domain}`;
      browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
      const page = await browser.newPage();

      let gtmLoaded = false;
      let gtmLoadType = null;

      await page.setRequestInterception(true);
      page.on("request", (request) => request.continue());
      page.on("response", (response) => {
        if (response.url().includes("googletagmanager.com/gtm.js") && response.ok()) {
          gtmLoaded = true;
        }
      });

      await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

      const gtmScriptExists = await page.evaluate(() => {
        const hasGtmScript = document.querySelectorAll('script[src*="googletagmanager.com/gtm.js"]').length > 0;
        
        const scripts = Array.from(document.getElementsByTagName('script'));
        const hasGtmInitScript = scripts.some(script => {
          const content = script.textContent || script.innerText;
          return content.includes('googletagmanager.com/gtm.js') || 
                 content.includes('GTM-') ||
                 content.includes('google_tag_manager');
        });

        const hasGtmIframe = document.querySelectorAll('iframe[src*="googletagmanager.com/ns.html"]').length > 0 ||
                            document.querySelectorAll('noscript iframe[src*="googletagmanager.com/ns.html"]').length > 0;

        return hasGtmScript || hasGtmInitScript || hasGtmIframe;
      });

      const gtmCode = await page.evaluate(() => {
        const htmlContent = document.documentElement.innerHTML;
        const matches = htmlContent.match(/GTM-[A-Z0-9]+/g) || 
                       htmlContent.match(/googletagmanager\.com\/gtm\.js\?id=GTM-[A-Z0-9]+/g)?.map(url => url.match(/GTM-[A-Z0-9]+/)[0]);
        return matches ? matches[0] : null;
      });

      if (gtmScriptExists && gtmLoaded) {
        gtmLoadType = "Encontrado no HTML e Carregado via Requisição";
      } else if (gtmScriptExists && !gtmLoaded) {
        gtmLoadType = "Encontrado no HTML (sem confirmação de carregamento)";
      } else if (!gtmScriptExists && gtmLoaded) {
        gtmLoadType = "Carregado via Requisição (não encontrado no HTML)";
      } else {
        gtmLoadType = "GTM Não Encontrado";
      }

      console.log(`[${domain}] GTM: ${gtmCode || "N/A"} - ${gtmLoadType}`);

      return {
        hasGTM: gtmScriptExists || gtmLoaded,
        gtmCode,
        gtmLoadType,
      };
    } catch (err) {
      console.error(`Erro ao verificar GTM para ${domain}:`, err);
      return { hasGTM: false, gtmCode: null };
    } finally {
      if (browser) await browser.close();
    }
  }
}

module.exports = GTMParser;
