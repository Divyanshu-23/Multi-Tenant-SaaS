// src/utils/generateToken.js - Generate JWT tokens
const jwt = require('jsonwebtoken');
const { jwt: jwtConfig } = require('../config/env');

const generateToken = (userId, expiresIn = jwtConfig.expire) => {
  return jwt.sign({ id: userId }, jwtConfig.secret, {
    expiresIn,
  });
};

const generateRefreshToken = (userId) => {
  return jwt.sign({ id: userId }, jwtConfig.refreshSecret, {
    expiresIn: jwtConfig.refreshExpire,
  });
};

const verifyToken = (token, isRefreshToken = false) => {
  const secret = isRefreshToken ? jwtConfig.refreshSecret : jwtConfig.secret;
  return jwt.verify(token, secret);
};

module.exports = {
  generateToken,
  generateRefreshToken,
  verifyToken,
};