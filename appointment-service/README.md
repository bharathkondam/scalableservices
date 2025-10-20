# CareConnect Appointment Service

Manages the lifecycle of patient appointments, including creation, lookup, and status transitions. Emits domain events to downstream services via the Notification Service.

## Local Development

```bash
cd appointment-service
npm install
NOTIFICATION_SERVICE_URL=http://localhost:3000 npm start
```

- `PORT` defaults to `3100`; override only if you need a different HTTP port.
- Persistence: lightweight JSON file (`data/appointments.json`). Override location with `DB_PATH`.
- Emits notifications via `POST {NOTIFICATION_SERVICE_URL}/notifications`.

## HTTP API

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/health` | Liveness probe. |
| `POST` | `/appointments` | Create appointment – body `{ patientId, providerId, scheduledFor, reason? }`. |
| `GET` | `/appointments/:id` | Fetch single appointment. |
| `GET` | `/appointments?patientId=...&providerId=...&status=...` | Filtered list (max 50). |
| `PATCH` | `/appointments/:id/status` | Update status – body `{ status, reason? }`. |

Statuses: `CONFIRMED`, `CANCELLED`, `COMPLETED`, `NO_SHOW`.
