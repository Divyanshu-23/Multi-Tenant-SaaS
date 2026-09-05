/**
 * Task Management API Integration Tests
 */
const request = require('supertest');
const { app } = require('../../src/index');
const User = require('../../src/models/User');
const Organization = require('../../src/models/Organization');
const Task = require('../../src/models/Task');

describe('Task Management API Integration Tests', () => {
  // Test data
  const user1Data = {
    firstName: 'TaskTest',
    lastName: 'User1',
    email: `tasktest_user1_${Date.now()}@test.com`,
    password: 'TestPassword123!',
    phone: '+1234567890'
  };

  const user2Data = {
    firstName: 'TaskTest',
    lastName: 'User2',
    email: `tasktest_user2_${Date.now()}@test.com`,
    password: 'TestPassword123!',
    phone: '+2234567890'
  };

  let user1Token = null;
  let user2Token = null;
  let user1Id = null;
  let user2Id = null;
  let orgId = null;
  let taskId = null;

  beforeAll(async () => {
    // Clean up before tests
    await User.deleteMany({ email: { $regex: /tasktest/ } });
    await Organization.deleteMany({});
    await Task.deleteMany({});
  });

  beforeEach(async () => {
    // Register users
    const user1Res = await request(app)
      .post('/api/auth/register')
      .send(user1Data);

    const user2Res = await request(app)
      .post('/api/auth/register')
      .send(user2Data);

    user1Token = user1Res.body.token;
    user2Token = user2Res.body.token;
    user1Id = user1Res.body.user.id;
    user2Id = user2Res.body.user.id;

    // Create organization for user1
    const orgRes = await request(app)
      .post('/api/orgs')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        name: 'Test Task Organization',
        description: 'Test Description'
      });

    orgId = orgRes.body.data.organization._id;

    // Invite user2 as a member
    await request(app)
      .post(`/api/orgs/${orgId}/members`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ email: user2Data.email, role: 'member' });
  });

  describe('POST /api/tasks', () => {
    const taskData = {
      title: 'Follow up with property buyer',
      description: 'Contact the interested buyer for the Mumbai property',
      priority: 'high',
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      tags: ['lead', 'buyer', 'follow-up']
    };

    test('should create a task successfully', async () => {
      const response = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${user1Token}`)
        .set('x-organization-id', orgId)
        .send(taskData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'Task created successfully');
      expect(response.body.data).toHaveProperty('task');
      expect(response.body.data.task).toHaveProperty('title', taskData.title);
      expect(response.body.data.task).toHaveProperty('priority', taskData.priority);
      expect(response.body.data.task).toHaveProperty('status', 'pending');
      expect(response.body.data.task).toHaveProperty('organization', orgId);
      expect(response.body.data.task).toHaveProperty('createdBy', user1Id);
      expect(response.body.data.task).toHaveProperty('assignedTo', user1Id);

      taskId = response.body.data.task._id;
    });

    test('should reject task creation without organization header', async () => {
      const response = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${user1Token}`)
        .send(taskData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
    });

    test('should reject task creation with invalid data', async () => {
      const response = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${user1Token}`)
        .set('x-organization-id', orgId)
        .send({ title: '' }); // Empty title

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('GET /api/tasks', () => {
    beforeEach(async () => {
      // Create multiple tasks
      const tasks = [
        { title: 'Task 1', priority: 'high', status: 'pending' },
        { title: 'Task 2', priority: 'medium', status: 'in_progress' },
        { title: 'Task 3', priority: 'low', status: 'completed' }
      ];

      for (const task of tasks) {
        await request(app)
          .post('/api/tasks')
          .set('Authorization', `Bearer ${user1Token}`)
          .set('x-organization-id', orgId)
          .send({
            ...task,
            description: `Description for ${task.title}`,
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
          });
      }
    });

    test('should list tasks with pagination', async () => {
      const response = await request(app)
        .get('/api/tasks')
        .set('Authorization', `Bearer ${user1Token}`)
        .set('x-organization-id', orgId);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('tasks');
      expect(Array.isArray(response.body.data.tasks)).toBe(true);
      expect(response.body.data.tasks).toHaveLength(3);
      expect(response.body.data).toHaveProperty('pagination');
    });

    test('should filter tasks by status', async () => {
      const response = await request(app)
        .get('/api/tasks?status=pending')
        .set('Authorization', `Bearer ${user1Token}`)
        .set('x-organization-id', orgId);

      expect(response.status).toBe(200);
      expect(response.body.data.tasks).toHaveLength(1);
      expect(response.body.data.tasks[0].status).toBe('pending');
    });

    test('should filter tasks by priority', async () => {
      const response = await request(app)
        .get('/api/tasks?priority=high')
        .set('Authorization', `Bearer ${user1Token}`)
        .set('x-organization-id', orgId);

      expect(response.status).toBe(200);
      expect(response.body.data.tasks).toHaveLength(1);
      expect(response.body.data.tasks[0].priority).toBe('high');
    });

    test('should filter tasks by assigned user', async () => {
      const response = await request(app)
        .get(`/api/tasks?assignedTo=${user1Id}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .set('x-organization-id', orgId);

      expect(response.status).toBe(200);
      expect(response.body.data.tasks).toHaveLength(3);
    });
  });

  describe('GET /api/tasks/:id', () => {
    beforeEach(async () => {
      // Create a task
      const response = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${user1Token}`)
        .set('x-organization-id', orgId)
        .send({
          title: 'Task to Get Details',
          description: 'Task Description',
          priority: 'medium',
          status: 'pending'
        });

      taskId = response.body.data.task._id;
    });

    test('should get task details successfully', async () => {
      const response = await request(app)
        .get(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .set('x-organization-id', orgId);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('task');
      expect(response.body.data.task).toHaveProperty('_id', taskId);
      expect(response.body.data.task).toHaveProperty('title', 'Task to Get Details');
    });

    test('should allow member to view task', async () => {
      const response = await request(app)
        .get(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${user2Token}`)
        .set('x-organization-id', orgId);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
    });
  });

  describe('PUT /api/tasks/:id', () => {
    beforeEach(async () => {
      // Create a task
      const response = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${user1Token}`)
        .set('x-organization-id', orgId)
        .send({
          title: 'Task to Update',
          description: 'Old Description',
          priority: 'low',
          status: 'pending'
        });

      taskId = response.body.data.task._id;
    });

    test('should update task successfully', async () => {
      const updateData = {
        title: 'Updated Task Title',
        description: 'Updated Description',
        priority: 'high',
        status: 'in_progress'
      };

      const response = await request(app)
        .put(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .set('x-organization-id', orgId)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data.task).toHaveProperty('title', updateData.title);
      expect(response.body.data.task).toHaveProperty('priority', updateData.priority);
      expect(response.body.data.task).toHaveProperty('status', updateData.status);
    });

    test('should allow updating task status only', async () => {
      const response = await request(app)
        .put(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .set('x-organization-id', orgId)
        .send({ status: 'completed' });

      expect(response.status).toBe(200);
      expect(response.body.data.task).toHaveProperty('status', 'completed');
    });

    test('should allow member to update task', async () => {
      const response = await request(app)
        .put(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${user2Token}`)
        .set('x-organization-id', orgId)
        .send({ status: 'completed' });

      expect(response.status).toBe(200);
      expect(response.body.data.task).toHaveProperty('status', 'completed');
    });
  });

  describe('DELETE /api/tasks/:id', () => {
    beforeEach(async () => {
      // Create a task
      const response = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${user1Token}`)
        .set('x-organization-id', orgId)
        .send({
          title: 'Task to Delete',
          description: 'Delete Description',
          priority: 'low'
        });

      taskId = response.body.data.task._id;
    });

    test('should delete task successfully', async () => {
      const response = await request(app)
        .delete(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .set('x-organization-id', orgId);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.message).toMatch(/deleted.*successfully/i);

      // Verify task is deleted
      const verifyResponse = await request(app)
        .get(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .set('x-organization-id', orgId);

      expect(verifyResponse.status).toBe(404);
    });

    test('should not allow member to delete task (only owner)', async () => {
      // Create a task assigned to user2
      const createResponse = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${user2Token}`)
        .set('x-organization-id', orgId)
        .send({
          title: 'User2 Task',
          description: 'Only user2 should delete this'
        });

      const user2TaskId = createResponse.body.data.task._id;

      const response = await request(app)
        .delete(`/api/tasks/${user2TaskId}`)
        .set('Authorization', `Bearer ${user1Token}`) // User1 trying to delete
        .set('x-organization-id', orgId);

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('POST /api/tasks/:id/comments', () => {
    beforeEach(async () => {
      // Create a task
      const response = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${user1Token}`)
        .set('x-organization-id', orgId)
        .send({
          title: 'Task with Comments',
          description: 'Task for testing comments'
        });

      taskId = response.body.data.task._id;
    });

    test('should add comment successfully', async () => {
      const commentData = {
        content: 'This is a test comment',
        isPrivate: false
      };

      const response = await request(app)
        .post(`/api/tasks/${taskId}/comments`)
        .set('Authorization', `Bearer ${user1Token}`)
        .set('x-organization-id', orgId)
        .send(commentData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('comment');
      expect(response.body.data.comment).toHaveProperty('content', commentData.content);
      expect(response.body.data.comment).toHaveProperty('createdBy', user1Id);
    });

    test('should allow member to add comment', async () => {
      const commentData = {
        content: 'Comment from member',
        isPrivate: false
      };

      const response = await request(app)
        .post(`/api/tasks/${taskId}/comments`)
        .set('Authorization', `Bearer ${user2Token}`)
        .set('x-organization-id', orgId)
        .send(commentData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('success', true);
    });

    test('should reject empty comment', async () => {
      const response = await request(app)
        .post(`/api/tasks/${taskId}/comments`)
        .set('Authorization', `Bearer ${user1Token}`)
        .set('x-organization-id', orgId)
        .send({ content: '' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
    });
  });

  // Clean up after all tests
  afterAll(async () => {
    await User.deleteMany({ email: { $regex: /tasktest/ } });
    await Organization.deleteMany({});
    await Task.deleteMany({});
  });
});

