// src/models/Member.js - Organization member schema
const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'inactive', 'removed'],
    default: 'pending',
  },
  joinedAt: {
    type: Date,
    default: Date.now,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Compound unique index for user-organization relationship
memberSchema.index({ userId: 1, organizationId: 1 }, { unique: true });

// Keep membership timestamps current.
memberSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Member', memberSchema);
