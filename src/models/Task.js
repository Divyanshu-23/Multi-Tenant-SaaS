// src/models/Task.js - Task/Lead management schema
const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  attachments: [{
    name: String,
    url: String,
    type: String,
  }],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const activitySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  action: {
    type: String,
    required: true,
    enum: [
      'created', 'updated', 'deleted', 'status_changed',
      'assigned', 'unassigned', 'commented', 'attachment_added',
      'priority_changed', 'due_date_changed', 'label_added', 'label_removed'
    ],
  },
  field: String, // Which field was changed
  oldValue: mongoose.Schema.Types.Mixed,
  newValue: mongoose.Schema.Types.Mixed,
  description: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const taskSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: false,
  },
  propertyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property',
  },
  title: {
    type: String,
    required: [true, 'Task title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters'],
  },
  description: {
    type: String,
    maxlength: [5000, 'Description cannot exceed 5000 characters'],
  },
  status: {
    type: String,
    enum: ['open', 'in_progress', 'review', 'completed', 'cancelled', 'on_hold'],
    default: 'open',
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium',
  },
  assignee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  dueDate: Date,
  labels: [{
    type: String,
    trim: true,
  }],
  comments: [commentSchema],
  attachments: [{
    name: String,
    url: String,
    type: String,
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  }],
  activityLog: [activitySchema],
  estimatedHours: Number,
  actualHours: {
    type: Number,
    default: 0,
  },
  taskType: {
    type: String,
    enum: ['lead', 'follow_up', 'site_visit', 'negotiation', 'documentation', 'maintenance', 'other'],
    default: 'lead',
  },
  source: {
    type: String,
    enum: ['website', 'phone', 'walk_in', 'referral', 'advertisement', 'social_media', 'other'],
  },
  contactInfo: {
    name: String,
    phone: String,
    email: String,
  },
  completedAt: Date,
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

// Indexes
taskSchema.index({ organizationId: 1, status: 1 });
taskSchema.index({ organizationId: 1, assignee: 1 });
taskSchema.index({ dueDate: 1 });
taskSchema.index({ priority: 1 });
taskSchema.index({ createdAt: -1 });

// Pre-save hook
taskSchema.pre('save', function (next) {
  this.updatedAt = Date.now();

  // Set completedAt when status changes to completed
  if (this.isModified('status') && this.status === 'completed' && !this.completedAt) {
    this.completedAt = new Date();
  }

  next();
});

// Method to add activity
taskSchema.methods.addActivity = function (userId, action, description, field, oldValue, newValue) {
  this.activityLog.push({
    userId,
    action,
    description,
    field,
    oldValue,
    newValue,
  });
};

module.exports = mongoose.model('Task', taskSchema);
