const express = require("express");
const DomainService = require("./services/domainService");
const QueueService = require("./services/queueService");
const StorageService = require("./services/storageService")


const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Configuração melhorada para carregar domínios


// Inicialização robusta
async function initialize() {
  try {
    console.log("Starting initialization...");

    // Verifica inicialização dos serviços
    //await Promise.all([DomainService.initialize(), QueueService.initialize(), QueueService.processDomains()]);
    await DomainService.initialize();
    await QueueService.initialize();


    console.log("All services initialized successfully");

    // Processa domínios do arquivo
    const domains = await StorageService.loadDomainsFromFile();
    if (domains.length > 0) {
      console.log(`Starting processing of ${domains.length} domains`);
      await QueueService.addDomainsToQueue(domains);
    } else {
      console.warn("No domains found to process");
    }

    app.get("/domains", async (req, res) => {
      try {
        const allDomains = await DomainService.getAllDomains();
        res.json(allDomains);
      } catch (error) {
        console.error("GET /domains error:", error);
        res.status(500).json({ error: "Erro ao buscar domínios" });
      }
    });

    // Inicia servidor
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log("Available endpoints:");
      console.log(`- GET /health`);
      console.log(`- POST /domains`);
      console.log(`- GET /domains`);
      console.log(`- GET /test`);
    });
  } catch (error) {
    console.error("Fatal initialization error:", error);
    process.exit(1);
  }
}

// Endpoint de teste melhorado
app.get("/test", async (req, res) => {
  try {
    console.log("Test endpoint called");
    const testDomain = "test.com";

    // Verifica se o domínio já existe
    const existing = await DomainService.findByName(testDomain);
    if (existing) {
      console.log(`Domain ${testDomain} already exists in database`);
      return res.json({
        status: "exists",
        domain: existing,
      });
    }

    // Processa o domínio de teste
    const result = await QueueService.addDomainsToQueue([testDomain]);

    res.json({
      status: "processed",
      domain: testDomain,
      result,
    });
  } catch (error) {
    console.error("Test endpoint error:", error);
    res.status(500).json({
      error: error.message,
    });
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
  });
});

// Inicia a aplicação
initialize();

// Tratamento de erros não capturados
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  process.exit(1);
});
