# Implementation Notes

## Technology Selections
- **Language & Framework**: Node.js 20 with Express – fast to bootstrap, broad ecosystem, native async support.
- **Persistence**: Lightweight JSON file store keeps each service self-contained without native bindings (suited for constrained environments). In production the Appointment Service would use PostgreSQL for transactional guarantees, and the Notification Service would use a dedicated store (e.g., PostgreSQL or DynamoDB).
- **Validation**: Joi schemas enforce payload integrity at the service boundary.
- **Inter-service communication**:
  - REST over HTTP for synchronous interactions. Appointment Service calls the Notification Service when new events occur.
  - Asynchronous, event-driven expansion path via a message broker (Kafka/RabbitMQ) described in `docs/architecture.md`. The HTTP call simulates the event emission for the prototype.
- **Security & Observability considerations**: Helmet for basic HTTP hardening, morgan for access logging. Production guidance includes service mesh, centralized telemetry, and secrets management.

## Repository Layout
- `appointment-service/` – Self-contained microservice with its own dependency manifest, database, Dockerfile, and deployment descriptors.
- `notification-service/` – Independent microservice with equivalent scaffolding.
- `docs/` – Architecture and implementation notes.
- `k8s/` – Kubernetes manifests defined in Part 3.

Each service can be copy-extracted into its own Git repository; no cross-directory dependencies exist.

## Running Locally (quickstart)
1. Start Notification Service: `cd notification-service && npm install && npm start` (defaults to port 3000).
2. Start Appointment Service: `cd appointment-service && npm install && NOTIFICATION_SERVICE_URL=http://localhost:3000 npm start`.
3. Create an appointment:
   ```bash
   curl -X POST http://localhost:3100/appointments \
     -H "Content-Type: application/json" \
     -d '{"patientId":"patient-1","providerId":"provider-42","scheduledFor":"2024-12-01T10:30:00.000Z"}'
   ```
4. Inspect generated notification:
   ```bash
   curl http://localhost:3000/notifications
   ```

The Notification Service logs simulated dispatches to stdout.
