/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  const exists = await knex.schema.hasTable('domains_gtm_status');
  if (!exists) {
    await knex.schema.createTable('domains_gtm_status', function(table) {
      table.increments('id').primary();
      table.integer('domain_id').unsigned().nullable();
      table.string('domain').nullable().unique();
      table.boolean('gtm_installed').defaultTo(false);
      table.string('gtm_code', 45).nullable();
      table.boolean('converteai_installed').defaultTo(false).comment('Indicates if ConverteAI script was detected');
      table.text('converteai_pv_url').nullable().comment('URL of ConverteAI script detected on /pv');
      table.text('converteai_pve_url').nullable().comment('URL of ConverteAI script detected on /pve');
      table.text('converteai_pva_url').nullable().comment('URL of ConverteAI script detected on /pva');
      table.text('converteai_pvb_url').nullable().comment('URL of ConverteAI script detected on /pvb');
      table.string('converteai_ab_test_status', 50).nullable().comment('Status of A/B test (Em Execução, Problema nas rotas, Parado, Not Checked, Error Processing)');
      table.boolean('checkout_links_found').defaultTo(false);
      table.string('checkout_link_pv').nullable();
      table.string('checkout_link_pve').nullable();
      table.string('checkout_link_pva').nullable();
      table.string('checkout_link_pvb').nullable();
      table.string('checkout_platform_pv').nullable();
      table.string('checkout_platform_pve').nullable();
      table.string('checkout_platform_pva').nullable();
      table.string('checkout_platform_pvb').nullable();
      table.timestamps(true, true);
    });
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('domains_gtm_status');
};
