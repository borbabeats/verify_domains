const Queue = require("bull");
const redisClient = require("../../config/redis");
const GTMParser = require("./gtmChecker");
const DomainService = require("./domainService");

const MAX_CONCURRENT_JOBS = 10;

class QueueService {
  static async initialize() {
    this.domainQueue = new Queue("domain processing", {
      redis: {
        host: "redis",
        port: 6379,
      },
      limiter: {
        max: MAX_CONCURRENT_JOBS,
        duration: 1000,
      },
    });

    // Limpa a fila ao iniciar (para desenvolvimento)
    if (process.env.NODE_ENV !== 'production') {
      await this.domainQueue.empty();
      console.log('Queue cleared (development mode)');
    }

    // Registra o process handler aqui mesmo
    this.domainQueue.process(MAX_CONCURRENT_JOBS, async (job) => {
      const { domain } = job.data;

      try {
        // Verifica se já está no cache
        const cachedResult = await redisClient.get(`gtm:${domain}`);

        if (cachedResult !== null) {
          const { hasGTM, gtmCode } = JSON.parse(cachedResult);
          console.log(`Cache hit for ${domain}`);
          await DomainService.createOrUpdateDomain(domain, hasGTM, gtmCode);
          return { domain, hasGTM, gtmCode, fromCache: true };
        }

        // Se não estiver no cache, verifica via Puppeteer
        const { hasGTM, gtmCode } = await GTMParser.checkGTM(domain);

        // Salva no cache por 24h
        await redisClient.set(
          `gtm:${domain}`,
          JSON.stringify({ hasGTM, gtmCode }),
          { EX: 86400 }
        );

        // Salva no banco
        await DomainService.createOrUpdateDomain(domain, hasGTM, gtmCode);

        return { domain, hasGTM, gtmCode, fromCache: false };
      } catch (error) {
        console.error(`Error processing domain ${domain}:`, error);
        await DomainService.createOrUpdateDomain(domain, false, null);
        throw error;
      }
    });

    // Eventos da fila
    this.domainQueue.on("completed", (job, result) => {
      console.log(
        `✅ Job completed for ${result.domain}: GTM ${result.hasGTM ? "found" : "not found"}${result.gtmCode ? ` (${result.gtmCode})` : ""} (${result.fromCache ? "cache" : "fresh"})`
      );
    });

    this.domainQueue.on("failed", (job, error) => {
      console.error(`❌ Job failed for ${job.data.domain}:`, error.message);
    });
  }

  static async addDomainsToQueue(domains) {
    try {
      const jobs = domains.map((domain) => ({
        data: { domain },
        opts: {
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 5000,
          },
        },
      }));

      await this.domainQueue.addBulk(jobs);
      console.log(`Added ${domains.length} domains to the queue`);
    } catch (error) {
      console.error("Error adding domains to queue:", error);
      throw error;
    }
  }
}

module.exports = QueueService;
