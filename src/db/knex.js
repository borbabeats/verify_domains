require('dotenv').config({ path: '../../.env' }); // Carregar .env da raiz
const knex = require('knex');
const knexConfig = require('../../config/knexfile');

const environment = process.env.NODE_ENV || 'development';
const config = knexConfig[environment];

module.exports = knex(config); 