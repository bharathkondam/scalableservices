const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const Joi = require('joi');
const { randomUUID } = require('crypto');
const db = require('./db');
const swaggerUi = require('swagger-ui-express');

const app = express();

app.use(helmet());
app.use(express.json());
app.use(
  morgan('combined', {
    skip: () => process.env.NODE_ENV === 'test'
  })
);

const PORT = process.env.PORT || 3000;

// OpenAPI (Swagger) setup
const openApiSpec = {
  openapi: '3.0.0',
  info: {
    title: 'CareConnect Notification Service',
    version: '1.0.0',
    description: 'API for recording and simulating notifications.'
  },
  servers: [
    { url: process.env.SWAGGER_SERVER_URL || `http://localhost:${PORT}` }
  ],
  components: {
    schemas: {
      Notification: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          type: { type: 'string' },
          channel: { type: 'string', enum: ['EMAIL', 'SMS', 'PUSH'] },
          recipient: { type: 'string' },
          payload: { type: 'object' },
          source: { type: 'string' },
          status: { type: 'string', enum: ['QUEUED', 'SENT', 'FAILED'] },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
          lastError: { type: 'string', nullable: true }
        }
      },
      NotificationCreateRequest: {
        type: 'object',
        required: ['type', 'payload', 'source'],
        properties: {
          type: { type: 'string' },
          channel: { type: 'string', enum: ['EMAIL', 'SMS', 'PUSH'], default: 'EMAIL' },
          recipient: { type: 'string' },
          payload: { type: 'object' },
          source: { type: 'string' },
          overwriteStatus: { type: 'string', enum: ['QUEUED', 'SENT', 'FAILED'] }
        }
      }
    }
  },
  paths: {
    '/health': {
      get: { summary: 'Health check', responses: { 200: { description: 'OK' } } }
    },
    '/notifications': {
      post: {
        summary: 'Create/record a notification',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/NotificationCreateRequest' } } }
        },
        responses: { 202: { description: 'Accepted' }, 400: { description: 'Validation error' } }
      },
      get: {
        summary: 'List notifications',
        parameters: [
          { name: 'type', in: 'query', schema: { type: 'string' } },
          { name: 'recipient', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['QUEUED', 'SENT', 'FAILED'] } }
        ],
        responses: {
          200: { description: 'List of notifications', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Notification' } } } } }
        }
      }
    },
    '/notifications/{id}': {
      get: {
        summary: 'Get notification by id',
        parameters: [ { name: 'id', in: 'path', required: true, schema: { type: 'string' } } ],
        responses: {
          200: { description: 'Notification', content: { 'application/json': { schema: { $ref: '#/components/schemas/Notification' } } } },
          404: { description: 'Not found' }
        }
      }
    }
  }
};

app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec, { explorer: true }));
app.get('/openapi.json', (_req, res) => res.json(openApiSpec));

const createSchema = Joi.object({
  type: Joi.string().trim().max(64).required(),
  channel: Joi.string()
    .trim()
    .uppercase()
    .valid('EMAIL', 'SMS', 'PUSH')
    .default('EMAIL'),
  recipient: Joi.string().trim().max(256).optional(),
  payload: Joi.object().required(),
  source: Joi.string().trim().max(64).required(),
  overwriteStatus: Joi.string()
    .trim()
    .uppercase()
    .valid('QUEUED', 'SENT', 'FAILED')
    .optional()
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'notification-service' });
});

app.post('/notifications', async (req, res) => {
  try {
    const payload = await createSchema.validateAsync(req.body, { abortEarly: false });

    const id = randomUUID();
    const now = new Date().toISOString();
    const inferredRecipient =
      payload.recipient ||
      payload.payload?.patientId ||
      payload.payload?.providerId ||
      'unknown';

    const status = payload.overwriteStatus || 'SENT';

    const record = {
      id,
      type: payload.type,
      channel: payload.channel,
      recipient: inferredRecipient,
      payload: payload.payload,
      source: payload.source,
      status,
      createdAt: now,
      updatedAt: now,
      lastError: null
    };

    db.createNotification(record);

    simulateDispatch(record.type, record.recipient, record.channel, record.payload);

    res.status(202).json({ id, status });
  } catch (err) {
    if (err.isJoi) {
      res
        .status(400)
        .json({ message: 'Validation failed', details: err.details.map((d) => d.message) });
      return;
    }
    console.error('Failed to persist notification', err);
    res.status(500).json({ message: 'Unable to queue notification' });
  }
});

app.get('/notifications/:id', (req, res) => {
  const notification = db.getNotification(req.params.id);

  if (!notification) {
    res.status(404).json({ message: 'Notification not found' });
    return;
  }

  res.json(notification);
});

app.get('/notifications', (req, res) => {
  const filters = {
    type: req.query.type,
    recipient: req.query.recipient,
    status: req.query.status ? req.query.status.toUpperCase() : undefined
  };

  const notifications = db
    .listNotifications(filters)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 100);

  res.json(notifications);
});

function simulateDispatch(type, recipient, channel, payload) {
  const message = `[notification] type=${type} channel=${channel} recipient=${recipient} payload=${JSON.stringify(
    payload
  )}`;
  console.log(message);
}

app.use((err, req, res, _next) => {
  console.error('Unexpected error', err);
  res.status(500).json({ message: 'Internal server error' });
});

let server;

if (process.env.NODE_ENV !== 'test') {
  server = app.listen(PORT, () => {
    console.log(`Notification service listening on port ${PORT}`);
  });
}

module.exports = { app, server };
