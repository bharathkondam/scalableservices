import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.NOTIFICATION_BASE_URL || 'http://localhost:3000';
const CHANNELS = ['EMAIL', 'SMS', 'PUSH'];

export const options = {
  scenarios: {
    spike: {
      executor: 'ramping-arrival-rate',
      startRate: 20,
      timeUnit: '1s',
      preAllocatedVUs: 20,
      stages: [
        { duration: '20s', target: 50 },
        { duration: '1m', target: 200 },
        { duration: '30s', target: 10 }
      ]
    }
  },
  thresholds: {
    http_req_duration: ['p(95)<400', 'avg<150'],
    checks: ['rate>0.97']
  },
  summaryTrendStats: ['avg', 'p(90)', 'p(95)', 'p(99)', 'min', 'max']
};

export default function () {
  const channel = CHANNELS[Math.floor(Math.random() * CHANNELS.length)];
  const notificationPayload = {
    type: `appointment.${Math.random() < 0.5 ? 'reminder' : 'update'}`,
    channel,
    recipient: `${channel.toLowerCase()}-user-${Math.floor(Math.random() * 1000)}`,
    payload: {
      patientId: `patient-${Math.floor(Math.random() * 1000)}`,
      providerId: `provider-${Math.floor(Math.random() * 100)}`,
      scheduledFor: new Date(Date.now() + 5 * 60_000).toISOString()
    },
    source: 'perf-test-suite'
  };

  const createRes = http.post(
    `${BASE_URL}/notifications`,
    JSON.stringify(notificationPayload),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { endpoint: 'create', method: 'POST' }
    }
  );

  check(createRes, {
    'notification accepted': (r) => r.status === 202,
    'notification id present': (r) => !!(r.json() || {}).id
  });

  if (createRes.status !== 202) {
    sleep(0.5);
    return;
  }

  const notificationId = createRes.json().id;

  const fetchRes = http.get(`${BASE_URL}/notifications/${notificationId}`, {
    tags: { endpoint: 'getById', method: 'GET' }
  });

  check(fetchRes, {
    'fetch status 200': (r) => r.status === 200
  });

  const listRes = http.get(`${BASE_URL}/notifications?status=SENT&type=${notificationPayload.type}`, {
    tags: { endpoint: 'list', method: 'GET' }
  });

  check(listRes, {
    'list status 200': (r) => r.status === 200
  });

  sleep(0.5);
}
