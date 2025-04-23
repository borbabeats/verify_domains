/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.table('domains_gtm_status', function(table) {
    table.boolean('converteai_installed').defaultTo(false).comment('Indicates if ConverteAI script was detected');
    table.text('converteai_pv_url').nullable().comment('URL of ConverteAI script detected on /pv');
    table.text('converteai_pve_url').nullable().comment('URL of ConverteAI script detected on /pve');
    table.text('converteai_pva_url').nullable().comment('URL of ConverteAI script detected on /pva');
    table.text('converteai_pvb_url').nullable().comment('URL of ConverteAI script detected on /pvb');
    table.string('converteai_ab_test_status', 50).nullable().comment('Status of A/B test (Em Execução, Problema nas rotas, Parado, Not Checked, Error Processing)');
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