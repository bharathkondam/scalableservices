# CareConnect Telehealth Microservices Prototype

This repository demonstrates a scalable microservices design for **CareConnect**, a telehealth consultation platform. It contains:

- **Part 1 – Design**: Domain-driven architecture, command/query catalog, and service collaboration model.
- **Part 2 – Implementation**: Two independently deployable services (`appointment-service`, `notification-service`) with REST APIs, validation, and persistence.
- **Part 3 – Deployment**: Containerization and Kubernetes manifests ready for Minikube.

## Contents
- `docs/architecture.md` – Business capabilities, system operations, interaction patterns, scalability tactics.
- `docs/implementation.md` – Technology decisions, local workflow, and communication approach.
- `appointment-service/` – Appointment lifecycle management microservice.
- `notification-service/` – Notification capture & dispatch microservice.
- `docker-compose.yaml` – Run both services locally as containers.
- `k8s/` – Namespace, deployments, and services for Kubernetes.

## Local Development
```bash
# Terminal 1
cd notification-service
npm install
npm start

# Terminal 2
cd appointment-service
npm install
NOTIFICATION_SERVICE_URL=http://localhost:3000 npm start
```

## Docker Workflow
```bash
docker compose up --build
```
- Appointment API: http://localhost:3100/appointments
- Notification API: http://localhost:3000/notifications

## Kubernetes (Minikube)
Follow `k8s/README.md` to:
1. Build images in the Minikube daemon.
2. Apply manifests to the `careconnect` namespace.
3. Inspect deployments via `kubectl` or the Minikube dashboard.

## Optional CI/CD Ideas
1. **GitHub Actions** for lint/test/build per service (matrix strategy).
2. **Artifact registry** (e.g., GHCR/ECR) pushes versioned images.
3. **Argo CD** or **Flux** to reconcile Kubernetes manifests.
4. Canary or blue/green strategies using service mesh traffic shifting.
