/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('domains_gtm_status', function(table) {
    table.increments('id').primary();
    table.integer('domain_id').unsigned().notNullable();
    table.foreign('domain_id').references('id').inTable('domains');
    table.boolean('has_gtm').defaultTo(false);
    table.string('gtm_code', 45).nullable();
    table.string('gtm_script', 2000).nullable();
    table.boolean('converteai_ab_test_status').defaultTo(false);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('domains_gtm_status');
};
