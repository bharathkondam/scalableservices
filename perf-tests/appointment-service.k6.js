import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.APPOINTMENT_BASE_URL || 'http://localhost:3100';

export const options = {
  scenarios: {
    ramp_load: {
      executor: 'ramping-vus',
      stages: [
        { duration: '30s', target: 10 },
        { duration: '5m', target: 80 },
        { duration: '30s', target: 0 }
      ]
    }
  },
  thresholds: {
    http_req_duration: ['p(95)<500', 'avg<200'],
    checks: ['rate>0.95']
  },
  summaryTrendStats: ['avg', 'p(90)', 'p(95)', 'p(99)', 'min', 'max']
};

export default function () {
  const appointmentPayload = {
    patientId: `patient-${Math.floor(Math.random() * 1000)}`,
    providerId: `provider-${Math.floor(Math.random() * 100)}`,
    scheduledFor: new Date(Date.now() + 10 * 60_000 + Math.floor(Math.random() * 60 * 60_000)).toISOString(),
    reason: 'load-test-run'
  };

  const createRes = http.post(
    `${BASE_URL}/appointments`,
    JSON.stringify(appointmentPayload),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { endpoint: 'create', method: 'POST' }
    }
  );

  check(createRes, {
    'create status is 201': (r) => r.status === 201,
    'create returns id': (r) => !!(r.json() || {}).id
  });

  if (createRes.status !== 201) {
    sleep(1);
    return;
  }

  const appointmentId = createRes.json().id;

  const fetchRes = http.get(`${BASE_URL}/appointments/${appointmentId}`, {
    tags: { endpoint: 'getById', method: 'GET' }
  });

  check(fetchRes, {
    'fetch status is 200': (r) => r.status === 200,
    'fetch returns matching id': (r) => (r.json() || {}).id === appointmentId
  });

  const newStatus = ['CANCELLED', 'COMPLETED', 'NO_SHOW'][Math.floor(Math.random() * 3)];
  const patchRes = http.request(
    'PATCH',
    `${BASE_URL}/appointments/${appointmentId}/status`,
    JSON.stringify({ status: newStatus, reason: 'load-test-status-update' }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { endpoint: 'updateStatus', method: 'PATCH' }
    }
  );

  check(patchRes, {
    'status update success': (r) => r.status === 200,
    'status update matches': (r) => (r.json() || {}).status === newStatus
  });

  const listRes = http.get(`${BASE_URL}/appointments?status=${newStatus}`, {
    tags: { endpoint: 'list', method: 'GET' }
  });

  check(listRes, {
    'list status is 200': (r) => r.status === 200
  });

  sleep(1);
}
