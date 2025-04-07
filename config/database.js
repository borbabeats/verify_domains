require('dotenv').config();

module.exports = {
  development: {
    client: 'mysql2',
    connection: {
      host: 'gtm-checker-mysql',
      port: 3306,
      user: 'gtmuser',
      password: 'gtmpassword',
      database: 'gtm_checker',
    },
    migrations: {
      tableName: 'knex_migrations',
      directory: './migrations',
    },
  },
};