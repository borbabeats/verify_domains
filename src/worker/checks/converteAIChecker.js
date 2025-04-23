const { delay } = require("../../utils/utils"); // Caminho ajustado

async function checkConverteAI(page, domain) {
    let converteAIFound = false;
    let pvVSLIDFound = null;
    let pveVSLIDFound = null;
    let pvaVSLIDFound = null;
    let pvbVSLIDFound = null;
    let hasABTest = null;

    const converteAIScriptBaseUrl = "https://scripts.converteai.net/817bd58d-9ef6-4339-97a6-a374233fe748/players/";

    const responseListener = (response) => {
        const url = response.url();
        if (url.includes(converteAIScriptBaseUrl)) {
            converteAIFound = true;
            try {
                const currentPagePathname = new URL(page.url()).pathname;
                if (currentPagePathname === "/pv") pvVSLIDFound = url;
                if (currentPagePathname === "/pve") pveVSLIDFound = url;
                if (currentPagePathname === "/pva") pvaVSLIDFound = url;
                if (currentPagePathname === "/pvb") pvbVSLIDFound = url;
            } catch (e) {
                // Ignore URL parsing errors if page.url() is invalid during navigation/redirects
            }
        }
    };

    page.on("response", responseListener);

    const pathnames = ["/pv", "/pve", "/pva", "/pvb"];
    for (const pathname of pathnames) {
        try {
            // Adicionado https:// ao domain que agora é passado como `https://domain.com`
            await page.goto(domain + pathname, { waitUntil: "networkidle2", timeout: 60000 });
            // Wait a bit longer for potential script execution after network idle
            await delay(5000); // Increased delay
        } catch (navError) {
            console.warn(`Navigation error for ${domain + pathname}: ${navError.message}`);
            // Continue checking other paths even if one fails
        }
    }

    // Remover o listener após as navegações para não interferir com outras operações
    page.off("response", responseListener);

    if (pvaVSLIDFound !== null && pvbVSLIDFound !== null) {
        hasABTest = "Em Execução";
    } else if (pvaVSLIDFound !== null || pvbVSLIDFound !== null) {
        hasABTest = "Problema nas rotas";
    } else {
        hasABTest = "Parado";
    }

    // Log para depuração
    console.log(`ConverteAI Check Results for ${domain}: Found=${converteAIFound}, PV=${pvVSLIDFound}, PVE=${pveVSLIDFound}, PVA=${pvaVSLIDFound}, PVB=${pvbVSLIDFound}, ABTest=${hasABTest}`);

    return {
        converteAIInstalled: converteAIFound,
        pv: pvVSLIDFound,
        pve: pveVSLIDFound,
        pva: pvaVSLIDFound,
        pvb: pvbVSLIDFound,
        hasABTest,
    };
}

module.exports = { checkConverteAI }; 