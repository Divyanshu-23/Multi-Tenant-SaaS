/**
 * Task API Integration Tests
 * Verifies task CRUD, comments, and role-based permissions
 * against the real API contract (admin has full permission via Member pre-save hook,
 * regular members are view-only).
 */
const request = require('supertest');
const { app } = require('../../src/index');
const User = require('../../src/models/User');
const Organization = require('../../src/models/Organization');
const Member = require('../../src/models/Member');
const Task = require('../../src/models/Task');

describe('Task API Integration Tests', () => {
  const suffix = Date.now();
  const makeUser = (n) => ({
    firstName: 'TaskTest',
    lastName: `User${n}`,
    email: `tasktest_user${n}_${suffix}@test.com`,
    password: 'TestPassword123!',
    phone: `${n}52345678${n}`,
    confirmPassword: 'TestPassword123!',
    termsAccepted: true,
    accountType: 'owner',
  });

  let adminToken;
  let adminId;
  let memberToken;
  let memberId;
  let orgId;

  beforeAll(async () => {
    await User.deleteMany({ email: { $regex: /tasktest/ } });
    await Organization.deleteMany({});
    await Member.deleteMany({});
    await Task.deleteMany({});

    const admin = await request(app).post('/api/auth/register').send(makeUser(1));
    const member = await request(app).post('/api/auth/register').send(makeUser(2));

    adminToken = admin.body.token;
    adminId = admin.body.user.id;
    memberToken = member.body.token;
    memberId = member.body.user.id;

    const orgResponse = await request(app)
      .post('/api/orgs')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'TaskTest Org' });
    orgId = orgResponse.body.data.organization._id;

    const invite = await request(app)
      .post(`/api/orgs/${orgId}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: makeUser(2).email });
    expect(invite.status).toBe(201);
  });

  afterAll(async () => {
    await User.deleteMany({ email: { $regex: /tasktest/ } });
    await Organization.deleteMany({});
    await Member.deleteMany({});
    await Task.deleteMany({});
  });

  const adminHeaders = () => ({
    Authorization: `Bearer ${adminToken}`,
    'x-organization-id': orgId,
  });
  const memberHeaders = () => ({
    Authorization: `Bearer ${memberToken}`,
    'x-organization-id': orgId,
  });

  const taskPayload = (overrides = {}) => ({
    title: 'Schedule site visit for potential buyer',
    priority: 'high',
    taskType: 'site_visit',
    dueDate: new Date(Date.now() + 86400000).toISOString(),
    assignee: adminId,
    ...overrides,
  });

  describe('POST /api/tasks - Create task', () => {
    test('should create a task successfully', async () => {
      const response = await request(app)
        .post('/api/tasks')
        .set(adminHeaders())
        .send(taskPayload({ title: 'Create Test Task' }));

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Task created successfully');
      expect(response.body.task).toBeDefined();
      expect(response.body.task._id).toBeDefined();
      expect(response.body.task.title).toBe('Create Test Task');
      expect(response.body.task.priority).toBe('high');
      expect(response.body.task.status).toBe('open');
      expect(response.body.task.organizationId).toBe(orgId);
      expect(response.body.task.creator).toBe(adminId);
    });

    test('should use default priority and status', async () => {
      const response = await request(app)
        .post('/api/tasks')
        .set(adminHeaders())
        .send(taskPayload({ title: 'Default Priority Task', priority: undefined }));

      expect(response.status).toBe(201);
      expect(response.body.task.priority).toBe('medium');
      expect(response.body.task.status).toBe('open');
    });

    test('should allow creation by any organization member', async () => {
      const response = await request(app)
        .post('/api/tasks')
        .set(memberHeaders())
        .send(taskPayload({ title: 'Member Should Fail Here' }));

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    test('should create a task without org context for the account owner', async () => {
      const response = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(taskPayload({ title: 'Direct Account Task' }));

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.task.organizationId).toBeUndefined();
      expect(String(response.body.task.creator)).toBe(adminId);

      const listed = await request(app)
        .get('/api/tasks')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(listed.body.tasks.some((task) => task.title === 'Direct Account Task')).toBe(true);
    });

    test('should reject an empty title', async () => {
      const response = await request(app)
        .post('/api/tasks')
        .set(adminHeaders())
        .send(taskPayload({ title: '' }));

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });
  });

  describe('GET /api/tasks - List tasks', () => {
    beforeEach(async () => {
      await Task.deleteMany({ organizationId: orgId });
      await request(app).post('/api/tasks').set(adminHeaders()).send(taskPayload({ title: 'List Task Open', assignee: adminId }));
      await request(app).post('/api/tasks').set(adminHeaders()).send(taskPayload({ title: 'List Task In Progress', status: 'in_progress', assignee: adminId }));
      await request(app).post('/api/tasks').set(adminHeaders()).send(taskPayload({ title: 'List Task Done', status: 'completed', priority: 'low', assignee: adminId }));
    });

    test('should list all tasks with pagination', async () => {
      const response = await request(app)
        .get('/api/tasks')
        .set(adminHeaders());

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.count).toBe(3);
      expect(response.body.pagination.total).toBe(3);
      expect(response.body.tasks).toHaveLength(3);
    });

    test('should filter by status', async () => {
      const response = await request(app)
        .get('/api/tasks?status=open')
        .set(adminHeaders());

      expect(response.status).toBe(200);
      expect(response.body.tasks).toHaveLength(1);
      expect(response.body.tasks[0].title).toBe('List Task Open');
    });

    test('should filter by priority', async () => {
      const response = await request(app)
        .get('/api/tasks?priority=low')
        .set(adminHeaders());

      expect(response.status).toBe(200);
      expect(response.body.tasks).toHaveLength(1);
      expect(response.body.tasks[0].title).toBe('List Task Done');
    });

    test('should filter by assignee=me', async () => {
      const response = await request(app)
        .get('/api/tasks?assignee=me')
        .set(adminHeaders());

      expect(response.status).toBe(200);
      expect(response.body.tasks).toHaveLength(3);
    });

    test('should allow a view-only member to list tasks', async () => {
      const response = await request(app)
        .get('/api/tasks')
        .set(memberHeaders());

      expect(response.status).toBe(200);
      expect(response.body.tasks).toHaveLength(3);
    });
  });

  describe('GET /api/tasks/:id - Get task details', () => {
    let taskId;

    beforeEach(async () => {
      await Task.deleteMany({ organizationId: orgId });
      const created = await request(app)
        .post('/api/tasks')
        .set(adminHeaders())
        .send(taskPayload({ title: 'Detail Task' }));
      taskId = created.body.task._id;
    });

    test('should return task details to an admin', async () => {
      const response = await request(app)
        .get(`/api/tasks/${taskId}`)
        .set(adminHeaders());

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.task._id).toBe(taskId);
      expect(response.body.task.title).toBe('Detail Task');
      expect(response.body.task.organizationId).toBe(orgId);
      expect(response.body.task.creator._id).toBe(adminId);
    });

    test('should allow a view-only member to read task details', async () => {
      const response = await request(app)
        .get(`/api/tasks/${taskId}`)
        .set(memberHeaders());

      expect(response.status).toBe(200);
      expect(response.body.task.title).toBe('Detail Task');
    });

    test('should return 404 for a non-existent task', async () => {
      const response = await request(app)
        .get('/api/tasks/5f8f8f8f8f8f8f8f8f8f8f8f')
        .set(adminHeaders());

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/tasks/:id - Update task', () => {
    let taskId;

    beforeEach(async () => {
      await Task.deleteMany({ organizationId: orgId });
      const created = await request(app)
        .post('/api/tasks')
        .set(adminHeaders())
        .send(taskPayload({ title: 'Update Task' }));
      taskId = created.body.task._id;
    });

    test('should update the task', async () => {
      const response = await request(app)
        .put(`/api/tasks/${taskId}`)
        .set(adminHeaders())
        .send({ title: 'Updated Task Title', status: 'in_progress', priority: 'urgent' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Task updated successfully');
      expect(response.body.task.title).toBe('Updated Task Title');
      expect(response.body.task.status).toBe('in_progress');
      expect(response.body.task.priority).toBe('urgent');
    });

    test('should allow updates by any organization member', async () => {
      const response = await request(app)
        .put(`/api/tasks/${taskId}`)
        .set(memberHeaders())
        .send({ status: 'completed' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('should return 404 for a non-existent task', async () => {
      const response = await request(app)
        .put('/api/tasks/5f8f8f8f8f8f8f8f8f8f8f8f')
        .set(adminHeaders())
        .send({ title: 'Nope' });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/tasks/:id - Delete task', () => {
    let taskId;

    beforeEach(async () => {
      await Task.deleteMany({ organizationId: orgId });
      const created = await request(app)
        .post('/api/tasks')
        .set(adminHeaders())
        .send(taskPayload({ title: 'Delete Task' }));
      taskId = created.body.task._id;
    });

    test('should delete the task', async () => {
      const response = await request(app)
        .delete(`/api/tasks/${taskId}`)
        .set(adminHeaders());

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Task deleted successfully');

      const after = await request(app)
        .get(`/api/tasks/${taskId}`)
        .set(adminHeaders());
      expect(after.status).toBe(404);
    });

    test('should allow deletion by any organization member', async () => {
      const response = await request(app)
        .delete(`/api/tasks/${taskId}`)
        .set(memberHeaders());

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/tasks/:id/comments - Task comments', () => {
    let taskId;

    beforeEach(async () => {
      await Task.deleteMany({ organizationId: orgId });
      const created = await request(app)
        .post('/api/tasks')
        .set(adminHeaders())
        .send(taskPayload({ title: 'Comment Task' }));
      taskId = created.body.task._id;
    });

    test('should add a comment to a task', async () => {
      const response = await request(app)
        .post(`/api/tasks/${taskId}/comments`)
        .set(adminHeaders())
        .send({ content: 'Buyer seems very interested, scheduling a re-visit.' });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Comment added successfully');
      expect(Array.isArray(response.body.comments)).toBe(true);
      expect(response.body.comments).toHaveLength(1);
      expect(response.body.comments[0].content).toBe('Buyer seems very interested, scheduling a re-visit.');
      expect(response.body.comments[0].userId).toBe(adminId);
    });

    test('should allow members to add comments', async () => {
      const response = await request(app)
        .post(`/api/tasks/${taskId}/comments`)
        .set(memberHeaders())
        .send({ content: 'Noted, I will follow up tomorrow.' });

      expect(response.status).toBe(201);
      expect(response.body.comments).toHaveLength(1);
      expect(response.body.comments[0].userId).toBe(memberId);
    });

    test('should reject an empty comment', async () => {
      const response = await request(app)
        .post(`/api/tasks/${taskId}/comments`)
        .set(adminHeaders())
        .send({ content: '' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });
});
