const path = require('path');
const fs = require('fs-extra');

const dbFile =
  process.env.DB_PATH || path.join(__dirname, '..', 'data', 'appointments.json');

fs.ensureDirSync(path.dirname(dbFile));

function loadState() {
  try {
    return fs.readJsonSync(dbFile);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.warn('Failed to read DB file, starting fresh', err.message);
    }
    return { appointments: [], events: [] };
  }
}

let state = loadState();

function persist() {
  fs.writeJsonSync(dbFile, state, { spaces: 2 });
}

function createAppointment(appointment) {
  state.appointments.push(appointment);
  persist();
  return appointment;
}

function getAppointment(id) {
  return state.appointments.find((a) => a.id === id) || null;
}

function listAppointments(filters = {}) {
  return state.appointments.filter((appointment) => {
    if (filters.patientId && appointment.patientId !== filters.patientId) {
      return false;
    }
    if (filters.providerId && appointment.providerId !== filters.providerId) {
      return false;
    }
    if (filters.status && appointment.status !== filters.status) {
      return false;
    }
    return true;
  });
}

function updateAppointment(id, updates) {
  const index = state.appointments.findIndex((a) => a.id === id);
  if (index === -1) return null;

  state.appointments[index] = {
    ...state.appointments[index],
    ...updates
  };
  persist();
  return state.appointments[index];
}

function recordEvent(event) {
  state.events.push(event);
  if (state.events.length > 1000) {
    state.events = state.events.slice(-1000);
  }
  persist();
}

module.exports = {
  createAppointment,
  getAppointment,
  listAppointments,
  updateAppointment,
  recordEvent
};
