// src/models/AuditLog.js - Audit logging schema
const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  action: {
    type: String,
    required: true,
    enum: [
      // Auth actions
      'user.login', 'user.logout', 'user.register', 'user.password_reset',
      'user.email_verified',

      // Organization actions
      'org.created', 'org.updated', 'org.deleted', 'org.member_added',
      'org.member_removed', 'org.member_role_changed', 'org.invitation_sent',

      // Property actions
      'property.created', 'property.updated', 'property.deleted',
      'property.status_changed', 'property.image_added', 'property.image_removed',

      // Task actions
      'task.created', 'task.updated', 'task.deleted', 'task.status_changed',
      'task.assigned', 'task.commented', 'task.attachment_added',

      // Admin actions
      'admin.user_banned', 'admin.user_unbanned', 'admin.settings_changed',
      'admin.backup_created', 'admin.backup_restored',

      // System actions
      'system.error', 'system.warning', 'system.info',
    ],
  },
  resourceType: {
    type: String,
    required: true,
    enum: ['user', 'organization', 'property', 'task', 'member', 'settings', 'system'],
  },
  resourceId: {
    type: mongoose.Schema.Types.ObjectId,
  },
  changes: {
    before: { type: mongoose.Schema.Types.Mixed },
    after: { type: mongoose.Schema.Types.Mixed },
  },
  metadata: {
    ip: String,
    userAgent: String,
    requestId: String,
    sessionId: String,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: false, // We use our own timestamp field
});

// Indexes for efficient querying
auditLogSchema.index({ organizationId: 1, timestamp: -1 });
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ resourceType: 1, resourceId: 1 });
auditLogSchema.index({ timestamp: -1 }, { expireAfterSeconds: 7776000 }); // Auto-delete after 90 days

// Static method to create log entry
auditLogSchema.statics.log = async function (data) {
  try {
    return await this.create(data);
  } catch (error) {
    console.error('Failed to create audit log:', error);
  }
};

module.exports = mongoose.model('AuditLog', auditLogSchema);