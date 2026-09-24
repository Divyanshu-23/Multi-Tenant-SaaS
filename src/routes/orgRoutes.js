// src/routes/orgRoutes.js - Organization management endpoints
const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const { Organization, Member, User } = require('../models');
const { auth } = require('../middleware/auth');

const router = express.Router();

const isValidOrgId = (id) => id && mongoose.Types.ObjectId.isValid(String(id));

// @route   POST /api/orgs - Create organization
// @access  Private
router.post('/', auth, [
  body('name').notEmpty().trim().isLength({ min: 2, max: 100 }).withMessage('Organization name must be 2-100 characters'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { name, description } = req.body;
    const userId = req.user.id;

    const slugify = (str) =>
      String(str).toLowerCase().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '') || 'org';

    let slug = slugify(name);
    let slugCount = 0;
    while (await Organization.exists({ slug })) {
      slugCount += 1;
      slug = `${slugify(name)}-${slugCount}`;
    }

    const organization = await Organization.create({
      name,
      slug,
      description,
      createdBy: userId,
    });

    // Create the creator's active membership.
    await Member.create({
      userId,
      organizationId: organization._id,
      status: 'active',
    });

    res.status(201).json({
      success: true,
      message: 'Organization created successfully',
      data: {
        organization,
        isOwner: true,
      },
    });
  } catch (error) {
    console.error('Create organization error:', error);
    res.status(500).json({ success: false, error: 'Server error creating organization' });
  }
});

// @route   GET /api/orgs - List user's organizations
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const memberships = await Member.find({ userId, status: 'active' })
      .populate('organizationId', 'name slug description tier status branding settings createdAt');

    const organizations = memberships
      .filter((m) => m.organizationId)
      .map((m) => ({
        ...m.organizationId.toObject(),
        memberId: m._id,
      }));

    res.json({
      success: true,
      data: { organizations },
    });
  } catch (error) {
    console.error('List organizations error:', error);
    res.status(500).json({ success: false, error: 'Server error listing organizations' });
  }
});

// @route   GET /api/orgs/:orgId - Get organization details
// @access  Private (members only)
router.get('/:orgId', auth, async (req, res) => {
  try {
    const { orgId } = req.params;
    const userId = req.user.id;

    if (!isValidOrgId(orgId)) {
      return res.status(404).json({ success: false, error: 'Organization not found' });
    }

    const organization = await Organization.findById(orgId);
    if (!organization) {
      return res.status(404).json({ success: false, error: 'Organization not found' });
    }

    // Check membership
    const member = await Member.findOne({ userId, organizationId: orgId, status: 'active' });
    if (!member) {
      return res.status(403).json({ success: false, error: 'You do not have access to this organization' });
    }

    const memberCount = await Member.countDocuments({ organizationId: orgId, status: 'active' });

    res.json({
      success: true,
      data: {
        organization: {
          ...organization.toObject(),
          memberCount,
        },
        isOwner: String(organization.createdBy) === userId,
      },
    });
  } catch (error) {
    console.error('Get organization error:', error);
    res.status(500).json({ success: false, error: 'Server error fetching organization' });
  }
});

// @route   PUT /api/orgs/:orgId - Update organization
// @access  Private (members only)
router.put('/:orgId', auth, [
  body('name').optional().trim().isLength({ min: 2, max: 100 }),
  body('description').optional().trim(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { orgId } = req.params;
    const userId = req.user.id;

    if (!isValidOrgId(orgId)) {
      return res.status(404).json({ success: false, error: 'Organization not found' });
    }

    const organization = await Organization.findById(orgId);
    if (!organization) {
      return res.status(404).json({ success: false, error: 'Organization not found' });
    }

    // Check membership
    const member = await Member.findOne({ userId, organizationId: orgId, status: 'active' });
    if (!member) {
      return res.status(403).json({ success: false, error: 'You do not have access to this organization' });
    }

    const allowed = ['name', 'description', 'settings', 'branding'];
    Object.keys(req.body).forEach((key) => {
      if (allowed.includes(key)) organization[key] = req.body[key];
    });

    await organization.save();

    res.json({
      success: true,
      message: 'Organization updated successfully',
      data: { organization },
    });
  } catch (error) {
    console.error('Update organization error:', error);
    res.status(500).json({ success: false, error: 'Server error updating organization' });
  }
});

// @route   POST /api/orgs/:orgId/members - Invite member
// @access  Private (members only)
router.post('/:orgId/members', auth, [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { orgId } = req.params;
    const userId = req.user.id;
    const { email } = req.body;

    if (!isValidOrgId(orgId)) {
      return res.status(404).json({ success: false, error: 'Organization not found' });
    }

    // Check caller is a member
    const callerMember = await Member.findOne({ userId, organizationId: orgId, status: 'active' });
    if (!callerMember) {
      return res.status(403).json({ success: false, error: 'You do not have access to this organization' });
    }

    // Check org exists
    const organization = await Organization.findById(orgId);
    if (!organization) {
      return res.status(404).json({ success: false, error: 'Organization not found' });
    }

    // Find target user
    const targetUser = await User.findOne({ email });
    if (!targetUser) {
      return res.status(404).json({ success: false, error: 'No user found with that email' });
    }

    // Check not already a member
    const existing = await Member.findOne({ userId: targetUser._id, organizationId: orgId });
    if (existing) {
      return res.status(400).json({ success: false, error: 'User is already a member of this organization' });
    }

    const member = await Member.create({
      userId: targetUser._id,
      organizationId: orgId,
      status: 'active',
    });

    res.status(201).json({
      success: true,
      message: 'Member invited successfully',
      data: {
        member: {
          user: targetUser._id,
          email: targetUser.email,
          firstName: targetUser.firstName,
          lastName: targetUser.lastName,
          status: member.status,
          joinedAt: member.joinedAt,
        },
      },
    });
  } catch (error) {
    console.error('Invite member error:', error);
    res.status(500).json({ success: false, error: 'Server error inviting member' });
  }
});

// @route   GET /api/orgs/:orgId/members - List members
// @access  Private (members only)
router.get('/:orgId/members', auth, async (req, res) => {
  try {
    const { orgId } = req.params;
    const userId = req.user.id;

    if (!isValidOrgId(orgId)) {
      return res.status(404).json({ success: false, error: 'Organization not found' });
    }

    // Check membership
    const callerMember = await Member.findOne({ userId, organizationId: orgId, status: 'active' });
    if (!callerMember) {
      return res.status(403).json({ success: false, error: 'You do not have access to this organization' });
    }

    const members = await Member.find({ organizationId: orgId, status: { $in: ['active', 'pending'] } })
      .populate('userId', 'firstName lastName email avatar')
      .sort({ createdAt: 1 });

    res.json({
      success: true,
      data: { members },
    });
  } catch (error) {
    console.error('List members error:', error);
    res.status(500).json({ success: false, error: 'Server error listing members' });
  }
});

// @route   DELETE /api/orgs/:orgId/members/:userId - Remove member
// @access  Private (members only)
router.delete('/:orgId/members/:userId', auth, async (req, res) => {
  try {
    const { orgId, userId: targetUserId } = req.params;
    const userId = req.user.id;

    if (!isValidOrgId(orgId) || !isValidOrgId(targetUserId)) {
      return res.status(404).json({ success: false, error: 'Member not found' });
    }

    // Check caller is a member
    const callerMember = await Member.findOne({ userId, organizationId: orgId, status: 'active' });
    if (!callerMember) {
      return res.status(403).json({ success: false, error: 'You do not have access to this organization' });
    }

    // Can't remove yourself
    if (targetUserId === userId) {
      return res.status(400).json({ success: false, error: 'Cannot remove yourself from the organization' });
    }

    const member = await Member.findOne({ userId: targetUserId, organizationId: orgId });
    if (!member) {
      return res.status(404).json({ success: false, error: 'Member not found' });
    }

    member.status = 'removed';
    await member.save();

    res.json({
      success: true,
      message: 'Member removed successfully',
    });
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({ success: false, error: 'Server error removing member' });
  }
});

module.exports = router;
