const environment = process.env.NODE_ENV || "development";
const config = require("../../config/database")[environment];
const knex = require("knex")(config);

class DomainService {
  static async initialize() {
    try {
      const hasTable = await knex.schema.hasTable("domains");

      if (!hasTable) {
        await knex.schema.createTable("domains", (table) => {
          table.increments("id").primary();
          table.string("name", 45).notNullable().unique();
          table.boolean("has_gtm").defaultTo(false);
          table.string("gtm_code", 20); // Novo campo
          table.timestamp("created_at").defaultTo(knex.fn.now());
          table.timestamp("updated_at").defaultTo(knex.fn.now());
        });
        console.log("Domains table created");
      } else {
        const hasColumn = await knex.schema.hasColumn("domains", "gtm_code");
        if (!hasColumn) {
          await knex.schema.alterTable("domains", (table) => {
            table.string("gtm_code", 20);
          });
          console.log("gtm_code column added to domains table");
        }
      }
    } catch (error) {
      console.error("Error initializing DomainService:", error);
      throw error;
    }
  }

  static async createOrUpdateDomain(domainName, hasGtm, gtmCode = null) {
    try {
      const existing = await knex("domains")
        .where({ name: domainName })
        .first();

      if (existing) {
        await knex("domains")
          .where({ id: existing.id })
          .update({
            has_gtm: hasGtm,
            gtm_code: gtmCode,
            updated_at: knex.fn.now(),
          });
        console.log(`Domain ${domainName} updated`);
      } else {
        await knex("domains").insert({
          name: domainName,
          has_gtm: hasGtm,
          gtm_code: gtmCode,
        });
        console.log(`Domain ${domainName} created`);
      }
    } catch (error) {
      console.error(`Error saving domain ${domainName}:`, error);
      throw error;
    }
  }

  static async getAllDomains() {
    try {
      return await knex("domains").select("*").orderBy("id", "desc");
    } catch (error) {
      console.error("Error fetching domains:", error);
      throw error;
    }
  }

  static async findByName(domainName) {
    return await knex("domains").where({ name: domainName }).first();
  }
}

module.exports = DomainService;
