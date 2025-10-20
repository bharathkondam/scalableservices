const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const Joi = require('joi');
const axios = require('axios').default;
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

const PORT = process.env.PORT || 3100;
const NOTIFICATION_SERVICE_URL =
  process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3000';

const createSchema = Joi.object({
  patientId: Joi.string().trim().required(),
  providerId: Joi.string().trim().required(),
  scheduledFor: Joi.string()
    .isoDate()
    .required()
    .custom((value, helpers) => {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        return helpers.error('string.isoDate');
      }
      if (date.getTime() < Date.now() - 60_000) {
        return helpers.error('any.invalid');
      }
      return value;
    }, 'future date validation')
    .messages({
      'string.isoDate': 'scheduledFor must be a valid ISO 8601 timestamp',
      'any.invalid': 'scheduledFor must be a future datetime (60s tolerance)'
    }),
  reason: Joi.string().max(500).allow('', null)
});

const updateStatusSchema = Joi.object({
  status: Joi.string()
    .valid('CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW')
    .required(),
  reason: Joi.string().max(500).allow('', null)
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'appointment-service' });
});

app.post('/appointments', async (req, res) => {
  try {
    const payload = await createSchema.validateAsync(req.body, { abortEarly: false });
    const id = randomUUID();
    const now = new Date().toISOString();

    const appointment = {
      id,
      patientId: payload.patientId,
      providerId: payload.providerId,
      scheduledFor: payload.scheduledFor,
      status: 'CONFIRMED',
      reason: payload.reason || null,
      createdAt: now,
      updatedAt: now
    };

    db.createAppointment(appointment);

    const eventPayload = {
      appointmentId: id,
      patientId: payload.patientId,
      providerId: payload.providerId,
      scheduledFor: payload.scheduledFor
    };

    db.recordEvent({
      appointmentId: id,
      eventType: 'AppointmentConfirmed',
      payload: eventPayload,
      createdAt: now
    });

    await emitNotification('AppointmentConfirmed', eventPayload);

    res.status(201).json({ id, status: appointment.status, createdAt: now });
  } catch (err) {
    if (err.isJoi) {
      res.status(400).json({
        message: 'Validation failed',
        details: err.details.map((d) => d.message)
      });
      return;
    }
    console.error('Failed to create appointment', err);
    res.status(500).json({ message: 'Unable to create appointment' });
  }
});

app.get('/appointments/:id', (req, res) => {
  const appointment = db.getAppointment(req.params.id);

  if (!appointment) {
    res.status(404).json({ message: 'Appointment not found' });
    return;
  }

  res.json(appointment);
});

app.get('/appointments', (req, res) => {
  const filters = {
    patientId: req.query.patientId,
    providerId: req.query.providerId,
    status: req.query.status ? req.query.status.toUpperCase() : undefined
  };

  const appointments = db
    .listAppointments(filters)
    .sort((a, b) => new Date(a.scheduledFor) - new Date(b.scheduledFor))
    .slice(0, 50);

  res.json(appointments);
});

app.patch('/appointments/:id/status', async (req, res) => {
  try {
    const payload = await updateStatusSchema.validateAsync(req.body, {
      abortEarly: false
    });

    const appointment = db.getAppointment(req.params.id);

    if (!appointment) {
      res.status(404).json({ message: 'Appointment not found' });
      return;
    }

    if (appointment.status === payload.status) {
      res.json(appointment);
      return;
    }

    const now = new Date().toISOString();

    const updated = db.updateAppointment(req.params.id, {
      status: payload.status,
      reason: payload.reason || appointment.reason,
      updatedAt: now
    });

    if (!updated) {
      res.status(500).json({ message: 'Unable to update appointment' });
      return;
    }

    db.recordEvent({
      appointmentId: req.params.id,
      eventType: `Appointment${payload.status}`,
      payload: {
        appointmentId: req.params.id,
        previousStatus: appointment.status,
        newStatus: payload.status
      },
      createdAt: now
    });

    if (['CANCELLED', 'COMPLETED', 'NO_SHOW'].includes(payload.status)) {
      await emitNotification(`Appointment${payload.status}`, {
        appointmentId: req.params.id,
        patientId: appointment.patientId,
        providerId: appointment.providerId,
        scheduledFor: appointment.scheduledFor,
        previousStatus: appointment.status
      });
    }

    res.json(updated);
  } catch (err) {
    if (err.isJoi) {
      res
        .status(400)
        .json({ message: 'Validation failed', details: err.details.map((d) => d.message) });
      return;
    }
    console.error('Failed to update appointment status', err);
    res.status(500).json({ message: 'Unable to update appointment' });
  }
});

async function emitNotification(type, payload) {
  try {
    await axios.post(
      `${NOTIFICATION_SERVICE_URL}/notifications`,
      {
        type,
        payload,
        source: 'appointment-service'
      },
      {
        timeout: parseInt(process.env.NOTIFICATION_TIMEOUT_MS || '2000', 10)
      }
    );
  } catch (err) {
    console.error('Failed to emit notification', err.message);
  }
}

app.use((err, req, res, _next) => {
  console.error('Unexpected error', err);
  res.status(500).json({ message: 'Internal server error' });
});

let server;

if (process.env.NODE_ENV !== 'test') {
  server = app.listen(PORT, () => {
    console.log(`Appointment service listening on port ${PORT}`);
  });
}

module.exports = { app, emitNotification, server };
