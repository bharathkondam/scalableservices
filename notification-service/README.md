# CareConnect Notification Service

Receives domain events (currently via HTTP) and records notification delivery attempts across channels.

## Local Development

```bash
cd notification-service
npm install
PORT=3000 npm start
```

- `PORT` defaults to `3000`; override only if you need a different HTTP port.
- Persistence: lightweight JSON file (`data/notifications.json`). Override location with `DB_PATH`.
- Simulated dispatch logs output to stdout for observability.

## HTTP API

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/health` | Liveness probe. |
| `POST` | `/notifications` | Queue notification – body `{ type, payload, channel?, recipient?, source }`. |
| `GET` | `/notifications/:id` | Inspect notification envelope. |
| `GET` | `/notifications?type=...&recipient=...&status=...` | Filter notification history. |
