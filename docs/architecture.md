# CareConnect Telehealth Platform – Scalable Microservices Architecture

## 1. Domain Overview
CareConnect is a digital health platform that lets patients discover providers, schedule virtual appointments, attend video consultations, and manage post-visit actions such as prescriptions, billing, and follow-up notifications. The platform must scale to spikes in demand (e.g., flu season), support regional compliance constraints, and provide resilient operations across patient-facing and clinical workflows.

### Core Quality Attributes
- **Scalability** – independently scale read-heavy appointment lookups, write-heavy scheduling, and bursty notification workloads.
- **Resilience** – tolerate downstream failures via circuit breakers, retries, and asynchronous processing.
- **Security & compliance** – isolate PHI, enforce least privilege, audit access.
- **Extensibility** – add new medical specialties, integration partners, and notification channels with minimal ripple effects.

## 2. Business Capabilities → Services
| Business Capability | Service (bounded context) | Responsibilities |
| --- | --- | --- |
| Patient onboarding & profiles | `Patient Service` | Maintain patient demographics, insurance details, consent preferences. Exposes patient lookup for scheduling and billing. |
| Provider management | `Provider Service` | Manage clinician profiles, licensing, availability templates, specialties. |
| Appointment lifecycle | `Appointment Service` | Slot search, booking, rescheduling, cancellation, status transitions, availability enforcement. |
| Consultation delivery | `Consultation Service` | Generate/retrieve virtual session links, capture encounter summaries, integrate with teleconferencing provider. |
| Medical records & documents | `Records Service` | Persist visit notes, prescriptions, documents; enforce access controls and audit trails. |
| Billing & payments | `Billing Service` | Price calculation, invoicing, payment processing, refund handling. |
| Notifications & reminders | `Notification Service` | Manage communication templates, dispatch multi-channel notifications (email, SMS, push), observe delivery outcomes. |
| Authentication & access | `Identity Service` (external/managed) | User authentication, token issuance, fine-grained authorization and patient consent scopes. |
| API edge & orchestration | `API Gateway / BFF` | Single entry point for web/mobile clients, request routing, aggregation, rate limiting, observability. |

Support components: **Event Broker** (Kafka/RabbitMQ) for async workflows, **Configuration Service**, **Observability Stack** (Prometheus, OpenTelemetry, Grafana), **Secrets Manager**.

## 3. System Operations (Commands & Queries)
| Operation | Type | Description | Owning Service(s) |
| --- | --- | --- | --- |
| RegisterPatient | Command | Create patient with demographics, insurance, consent flags. | Patient Service |
| GetPatientProfile | Query | Retrieve patient profile snapshot. | Patient Service |
| RegisterProvider | Command | Onboard provider with credentials and availability templates. | Provider Service |
| SearchProviders | Query | Filter providers by specialty, location, availability. | Provider Service |
| CreateAppointment | Command | Reserve slot for patient-provider pair, emit notification/event. | Appointment Service (+ Notification Service via event) |
| GetAppointment | Query | Fetch appointment by id with status history. | Appointment Service |
| ListAppointmentsForPatient | Query | Paginate upcoming/past appointments. | Appointment Service |
| RescheduleAppointment | Command | Move appointment to a different slot, ensure conflicts-free. | Appointment Service |
| CancelAppointment | Command | Cancel appointment, enforce policy, trigger notifications/refunds. | Appointment Service, Billing Service (if prepaid) |
| StartConsultation | Command | Generate secure session link + join info. | Consultation Service |
| GetConsultationSummary | Query | Retrieve consultation notes. | Consultation Service, Records Service |
| CreateInvoice | Command | Generate invoice post-consultation. | Billing Service |
| PayInvoice | Command | Capture payment and update invoice status. | Billing Service |
| SendNotification | Command | Dispatch templated notification (internal use). | Notification Service |
| GetNotificationStatus | Query | Inspect delivery outcome. | Notification Service |

Event-driven examples: `AppointmentConfirmed`, `AppointmentCancelled`, `InvoicePaid`, `ConsultationSummaryReady`.

## 4. Service Collaboration & Interaction Patterns
1. **Client → API Gateway** – All external requests terminate at the gateway. It performs authentication via the Identity Service, rate limiting, and request routing or aggregation.
2. **Synchronous REST/gRPC** – Used for low latency reads (e.g., Appointment Service querying Provider availability) and write coordination when immediate consistency is required.
3. **Asynchronous Messaging** – Event broker decouples processes:
   - Appointment Service emits `AppointmentConfirmed` → Notification Service consumes, dispatches reminders.
   - Appointment Service emits `AppointmentCancelled` → Billing Service handles refund, Notification Service sends cancellation alert.
   - Consultation Service publishes `ConsultationSummaryReady` → Records Service persists documentation.
4. **Saga/Process Manager** – For long-running flows (e.g., booking + payment + notification). Appointment Service orchestrates with compensations (cancel slot, reverse payment) if any step fails.
5. **Data Ownership** – Each service owns its persistence store (polyglot persistence): relational for transactions (PostgreSQL), document store for consultation records (MongoDB), time-series for observability (Prometheus TSDB).
6. **API Composition** – Gateway may combine patient profile, provider info, and upcoming appointments for dashboard views using BFF pattern.

### Collaboration Spotlight: Appointment Booking
1. Client calls Gateway `POST /appointments`.
2. Gateway authenticates, forwards to Appointment Service.
3. Appointment Service validates patient via Patient Service (REST read) and provider availability (cached + Provider Service).
4. Appointment reserved in Appointment DB; service emits `AppointmentConfirmed`.
5. Notification Service consumes event, sends confirmation via chosen channels.
6. Billing Service optionally starts payment flow (if prepaid).
7. Observability pipeline captures spans/metrics/logs for end-to-end traceability.

## 5. Scalability & Resilience Strategies
- **Independent scaling** – Deploy each service in its own container/Kubernetes deployment with HPA based on CPU/RPS/queue depth.
- **Caching** – Edge caching for provider search, CDN for static content, Redis for short-lived session data.
- **Resilience** – Apply circuit breakers (e.g., Resilience4j), retries with exponential backoff for cross-service calls, idempotency keys on commands.
- **Data replication & partitioning** – Shard appointments by region/tenant, maintain read replicas for query-intensive operations.
- **Infrastructure** – Kubernetes on managed cloud for orchestration, service mesh (Istio/Linkerd) for secure, observable communication.

## 6. Security & Compliance
- OAuth 2.0/OpenID Connect for user authentication via Identity Service.
- Attribute-based access control (ABAC) for service-to-service and user access.
- Encrypt PHI at rest (disk encryption, KMS) and in transit (mTLS between services).
- Auditing via append-only audit log service capturing who accessed what patient data.

## 7. Technology Stack (Reference)
- **API + Services**: Node.js (NestJS/Express), Kotlin (Spring Boot), or Go depending on team expertise.
- **Persistence**: PostgreSQL for transactional data, MongoDB for clinical documents, Redis for caching, S3/object storage for artifacts.
- **Messaging**: Apache Kafka for high-throughput events, or RabbitMQ for workflows requiring routing semantics.
- **CI/CD**: GitHub Actions / Argo Workflows for automated build-test-deploy.
- **Observability**: OpenTelemetry instrumentation, Prometheus metrics, Grafana dashboards, ELK stack for logs.

## 8. Selected Services for Implementation Prototype
- **Appointment Service** – REST API to create/query/cancel appointments, persists data in SQLite (demo) and emits events.
- **Notification Service** – REST API + async worker that consumes appointment events (HTTP simulation for prototype), records notification history.

The implementation delivers a lightweight slice of the architecture with deployable containers and Kubernetes manifests while documenting how to extend toward the full target state.

## 9. High‑Level Diagram

```mermaid
flowchart LR
  subgraph U[Users]
    C[Client / Postman / cURL]
    K6[k6 Perf Tests]
  end

  subgraph K[Minikube Kubernetes (namespace: careconnect)]
    direction LR

    subgraph A[Appointment Service]
      ADEP[Deployment: appointment-service]
      ASVC[Service: appointment-service]
      AHPA[HPA: CPU 70% (min 1, max 5)]
      ADB[(JSON Store: appointments.json)]
    end

    subgraph N[Notification Service]
      NDEP[Deployment: notification-service]
      NSVC[Service: notification-service]
      NHPA[HPA: CPU 70% (min 1, max 5)]
      NDB[(JSON Store: notifications.json)]
    end

    MS[(metrics-server)]
  end

  C -->|HTTP| ASVC
  K6 -->|Load| ASVC
  ASVC --> ADEP
  NSVC --> NDEP
  ADEP -- "POST /notifications" --> NSVC
  ADEP --> ADB
  NDEP --> NDB
  AHPA -. scales .-> ADEP
  NHPA -. scales .-> NDEP
  MS -. CPU metrics .-> AHPA
  MS -. CPU metrics .-> NHPA
```

Notes:
- Local prototype uses direct HTTP between Appointment and Notification services; event broker can be introduced later.
- HPAs rely on Metrics Server; enable via `minikube addons enable metrics-server`.
