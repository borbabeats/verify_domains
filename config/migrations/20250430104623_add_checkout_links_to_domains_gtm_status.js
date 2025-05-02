/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.alterTable('domains_gtm_status', function(table) {
    // Add columns if not exists
    if (!table.columns.some(c => c.name === 'checkout_link_pv')) {
      table.string('checkout_link_pv', 500).nullable();
    }
    if (!table.columns.some(c => c.name === 'checkout_link_pve')) {
      table.string('checkout_link_pve', 500).nullable();
    }
    if (!table.columns.some(c => c.name === 'checkout_link_pva')) {
      table.string('checkout_link_pva', 500).nullable();
    }
    if (!table.columns.some(c => c.name === 'checkout_link_pvb')) {
      table.string('checkout_link_pvb', 500).nullable();
    }

    // Checkout Platforms for different endpoints
    if (!table.columns.some(c => c.name === 'checkout_platform_pv')) {
      table.string('checkout_platform_pv', 100).nullable();
    }
    if (!table.columns.some(c => c.name === 'checkout_platform_pve')) {
      table.string('checkout_platform_pve', 100).nullable();
    }
    if (!table.columns.some(c => c.name === 'checkout_platform_pva')) {
      table.string('checkout_platform_pva', 100).nullable();
    }
    if (!table.columns.some(c => c.name === 'checkout_platform_pvb')) {
      table.string('checkout_platform_pvb', 100).nullable();
    }

    // Flag to indicate if checkout links were found
    if (!table.columns.some(c => c.name === 'checkout_links_found')) {
      table.boolean('checkout_links_found').defaultTo(false);
    }
  }).catch(() => {});
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('domains_gtm_status', function(table) {
    // Remove added columns in case of rollback
    table.dropColumn('checkout_link_pv');
    table.dropColumn('checkout_link_pve');
    table.dropColumn('checkout_link_pva');
    table.dropColumn('checkout_link_pvb');

    table.dropColumn('checkout_platform_pv');
    table.dropColumn('checkout_platform_pve');
    table.dropColumn('checkout_platform_pva');
    table.dropColumn('checkout_platform_pvb');

    table.dropColumn('checkout_links_found');
  });
};
