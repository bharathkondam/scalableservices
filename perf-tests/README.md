# Performance Test Suite

This folder contains [k6](https://k6.io/) scripts that generate load against the CareConnect services.

## Prerequisites

- k6 v0.45+ installed locally (`brew install k6` on macOS).
- The services you want to test must be running and reachable. For local docker-compose:
  ```shell
  docker-compose up --build
  ```

## Appointment Service Load Test

Runs create, fetch, status update, and list flows while ramping virtual users.

```shell
APPOINTMENT_BASE_URL=http://localhost:3100 k6 run perf-tests/appointment-service.k6.js
```

## Notification Service Load Test

Exercises notification creation and retrieval with a ramping arrival rate.

```shell
NOTIFICATION_BASE_URL=http://localhost:3000 k6 run perf-tests/notification-service.k6.js
```

## Tips

- Override the default durations or thresholds by cloning the scripts and adjusting the exported `options`.
- Use `k6 run --vus 1 --duration 10s` for smoke checks before full runs.
- Capture results with `k6 run --summary-export=summary.json …` to compare executions.
