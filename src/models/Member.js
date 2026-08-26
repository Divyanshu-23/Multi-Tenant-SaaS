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
  role: {
    type: String,
    enum: ['admin', 'manager', 'member'],
    default: 'member',
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
  permissions: {
    // Property-related permissions
    canCreateProperty: { type: Boolean, default: false },
    canEditProperty: { type: Boolean, default: false },
    canDeleteProperty: { type: Boolean, default: false },
    canViewProperty: { type: Boolean, default: true },

    // Task-related permissions
    canCreateTask: { type: Boolean, default: false },
    canEditTask: { type: Boolean, default: false },
    canDeleteTask: { type: Boolean, default: false },
    canAssignTask: { type: Boolean, default: false },

    // Member-related permissions
    canInviteMember: { type: Boolean, default: false },
    canRemoveMember: { type: Boolean, default: false },
    canUpdateMemberRole: { type: Boolean, default: false },

    // Organization-related permissions
    canUpdateOrganization: { type: Boolean, default: false },
    canDeleteOrganization: { type: Boolean, default: false },
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

// Pre-save hook for role-based permissions
memberSchema.pre('save', function (next) {
  // Set permissions based on role
  switch (this.role) {
    case 'admin':
      this.permissions = {
        canCreateProperty: true,
        canEditProperty: true,
        canDeleteProperty: true,
        canViewProperty: true,
        canCreateTask: true,
        canEditTask: true,
        canDeleteTask: true,
        canAssignTask: true,
        canInviteMember: true,
        canRemoveMember: true,
        canUpdateMemberRole: true,
        canUpdateOrganization: true,
        canDeleteOrganization: true,
      };
      break;
    case 'manager':
      this.permissions = {
        canCreateProperty: true,
        canEditProperty: true,
        canDeleteProperty: false,
        canViewProperty: true,
        canCreateTask: true,
        canEditTask: true,
        canDeleteTask: false,
        canAssignTask: true,
        canInviteMember: true,
        canRemoveMember: false,
        canUpdateMemberRole: false,
        canUpdateOrganization: false,
        canDeleteOrganization: false,
      };
      break;
    case 'member':
    default:
      this.permissions = {
        canCreateProperty: false,
        canEditProperty: false,
        canDeleteProperty: false,
        canViewProperty: true,
        canCreateTask: false,
        canEditTask: false,
        canDeleteTask: false,
        canAssignTask: false,
        canInviteMember: false,
        canRemoveMember: false,
        canUpdateMemberRole: false,
        canUpdateOrganization: false,
        canDeleteOrganization: false,
      };
  }

  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Member', memberSchema);