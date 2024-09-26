// connection.js
const { Sequelize } = require('sequelize');
const dotenv = require("dotenv");

dotenv.config();
console.log('DB Config: ', process.env.DB_NAME)
console.log('DB username: ', process.env.DB_USERNAME);
console.log('DB password: ', process.env.DB_PASSWORD);


// Replace the following values with your actual database credentials
const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USERNAME, process.env.DB_PASSWORD, {
  host: 'localhost',
  dialect: 'postgres',
  logging: false,
  pool: {
    max: 10, // Maximum number of connections in the pool
    min: 0, // Minimum number of connections in the pool
    acquire: 30000, // Maximum time, in milliseconds, that a connection can be idle before being released
    idle: 10000 // Maximum time, in milliseconds, that a connection can be idle before being closed
  }
});

module.exports = sequelize;
