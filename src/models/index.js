// src/models/index.js - Export all models
const User = require('./User');
const Organization = require('./Organization');
const Member = require('./Member');
const Property = require('./Property');
const Task = require('./Task');
const AuditLog = require('./AuditLog');

module.exports = {
  User,
  Organization,
  Member,
  Property,
  Task,
  AuditLog,
};