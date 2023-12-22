'use strict';

const dotenv = require("dotenv");

// Add env variables from file
dotenv.config();

module.exports = {
  "node-option": [
    "experimental-specifier-resolution=node",
    "loader=ts-node/esm",
  ],
};