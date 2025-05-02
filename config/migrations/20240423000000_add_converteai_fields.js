/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTableIfNotExists('domains_gtm_status', function(table) {
    table.increments('id').primary();
    table.integer('domain_id').unsigned().nullable();
    table.string('domain').nullable();
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
    table.unique('domain');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.table('domains_gtm_status', function(table) {
    table.dropColumn('converteai_installed');
    table.dropColumn('converteai_pv_url');
    table.dropColumn('converteai_pve_url');
    table.dropColumn('converteai_pva_url');
    table.dropColumn('converteai_pvb_url');
    table.dropColumn('converteai_ab_test_status');
  });
}; 