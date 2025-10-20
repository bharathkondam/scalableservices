const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const Joi = require('joi');
const { randomUUID } = require('crypto');
const db = require('./db');

const app = express();

app.use(helmet());
app.use(express.json());
app.use(
  morgan('combined', {
    skip: () => process.env.NODE_ENV === 'test'
  })
);

const PORT = process.env.PORT || 3000;

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

app.listen(PORT, () => {
  console.log(`Notification service listening on port ${PORT}`);
});
