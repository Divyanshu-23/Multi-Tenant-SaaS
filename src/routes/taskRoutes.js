// src/routes/taskRoutes.js - Task/Lead management endpoints
const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { Task, Property, User } = require('../models');
const { auth, orgContext, requireOrgContext } = require('../middleware/auth');
const { checkPermission } = require('../middleware/rbac');
const { notifyOrg } = require('../config/socket');
const { writeRateLimiter, readRateLimiter } = require('../middleware/rateLimiting');
const { cacheTasks } = require('../utils/cache');

const router = express.Router();
router.use(auth, orgContext, requireOrgContext);

// @route   POST /api/tasks - Create task/lead
router.post('/', writeRateLimiter, checkPermission('canCreateTask'), [
  body('title').notEmpty().trim().isLength({ max: 200 }).withMessage('Title is required'),
  body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
  body('taskType').optional().isIn(['lead', 'follow_up', 'site_visit', 'negotiation', 'documentation', 'maintenance', 'other']),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { organizationId, user } = req;
    const taskData = { ...req.body, organizationId, creator: user.id };

    if (taskData.propertyId) {
      const property = await Property.findOne({ _id: taskData.propertyId, organizationId });
      if (!property) return res.status(404).json({ success: false, error: 'Property not found' });
    }

    const task = await Task.create(taskData);
    task.addActivity(user.id, 'created', 'Task created');
    await task.save();

    notifyOrg(organizationId, 'task_created', { task });

    // Invalidate tasks cache
    await cacheTasks.invalidate(organizationId);

    res.status(201).json({ success: true, message: 'Task created successfully', task });
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ success: false, error: 'Server error creating task' });
  }
});

// @route   GET /api/tasks - List tasks
router.get('/', async (req, res) => {
  try {
    const { organizationId } = req;
    const page = req.query.page || 1;
    const limit = req.query.limit || 10;
    const skip = (page - 1) * limit;

    const filter = { organizationId };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.priority) filter.priority = req.query.priority;
    if (req.query.taskType) filter.taskType = req.query.taskType;
    if (req.query.assignee === 'me') filter.assignee = req.user.id;

    const sortOption = req.query.sortBy?.startsWith('-')
      ? { [req.query.sortBy.slice(1)]: -1 }
      : { [req.query.sortBy || 'createdAt']: req.query.sortBy ? 1 : -1 };

    const total = await Task.countDocuments(filter);
    const tasks = await Task.find(filter).sort(sortOption).skip(skip).limit(limit)
      .populate('assignee', 'firstName lastName email')
      .populate('creator', 'firstName lastName email')
      .populate('propertyId', 'title location price');

    res.json({ success: true, count: tasks.length, pagination: { total, page, limit, pages: Math.ceil(total / limit) }, tasks });
  } catch (error) {
    console.error('List tasks error:', error);
    res.status(500).json({ success: false, error: 'Server error listing tasks' });
  }
});

// @route   GET /api/tasks/:id - Get single task
router.get('/:id', async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, organizationId: req.organizationId })
      .populate('assignee', 'firstName lastName email')
      .populate('creator', 'firstName lastName email')
      .populate('propertyId', 'title location price')
      .populate('comments.userId', 'firstName lastName email')
      .populate('activityLog.userId', 'firstName lastName email');

    if (!task) return res.status(404).json({ success: false, error: 'Task not found' });
    res.json({ success: true, task });
  } catch (error) {
    console.error('Get task error:', error);
    res.status(500).json({ success: false, error: 'Server error fetching task' });
  }
});

// @route   PUT /api/tasks/:id - Update task
router.put('/:id', checkPermission('canEditTask'), async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, organizationId: req.organizationId });
    if (!task) return res.status(404).json({ success: false, error: 'Task not found' });

    const { user } = req;
    if (req.body.status && req.body.status !== task.status) {
      task.addActivity(user.id, 'status_changed', `Status changed to ${req.body.status}`, 'status', task.status, req.body.status);
    }

    Object.keys(req.body).forEach((key) => { task[key] = req.body[key]; });
    await task.save();

    notifyOrg(req.organizationId, 'task_updated', { taskId: task._id, updates: req.body });

    res.json({ success: true, message: 'Task updated successfully', task });
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ success: false, error: 'Server error updating task' });
  }
});

// @route   POST /api/tasks/:id/comments - Add comment
router.post('/:id/comments', [body('content').notEmpty().trim()], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const task = await Task.findOne({ _id: req.params.id, organizationId: req.organizationId });
    if (!task) return res.status(404).json({ success: false, error: 'Task not found' });

    const comment = { userId: req.user.id, content: req.body.content, createdAt: new Date() };
    task.comments.push(comment);
    task.addActivity(req.user.id, 'commented', 'Added a comment');
    await task.save();

    notifyOrg(req.organizationId, 'comment_added', { taskId: task._id, comment });

    res.status(201).json({ success: true, message: 'Comment added successfully', comments: task.comments });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ success: false, error: 'Server error adding comment' });
  }
});

// @route   DELETE /api/tasks/:id - Delete task
router.delete('/:id', checkPermission('canDeleteTask'), async (req, res) => {
  try {
    const task = await Task.findOneAndDelete({ _id: req.params.id, organizationId: req.organizationId });
    if (!task) return res.status(404).json({ success: false, error: 'Task not found' });
    notifyOrg(req.organizationId, 'task_deleted', { taskId: req.params.id });
    res.json({ success: true, message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ success: false, error: 'Server error deleting task' });
  }
});

module.exports = router;