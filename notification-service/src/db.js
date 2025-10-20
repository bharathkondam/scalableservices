const path = require('path');
const fs = require('fs-extra');

const dbFile = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'notifications.json');

fs.ensureDirSync(path.dirname(dbFile));

function loadState() {
  try {
    return fs.readJsonSync(dbFile);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.warn('Failed to read notification DB, starting fresh', err.message);
    }
    return { notifications: [] };
  }
}

let state = loadState();

function persist() {
  fs.writeJsonSync(dbFile, state, { spaces: 2 });
}

function createNotification(notification) {
  state.notifications.push(notification);
  if (state.notifications.length > 1000) {
    state.notifications = state.notifications.slice(-1000);
  }
  persist();
  return notification;
}

function getNotification(id) {
  return state.notifications.find((n) => n.id === id) || null;
}

function listNotifications(filters = {}) {
  return state.notifications.filter((notification) => {
    if (filters.type && notification.type !== filters.type) {
      return false;
    }
    if (filters.recipient && notification.recipient !== filters.recipient) {
      return false;
    }
    if (filters.status && notification.status !== filters.status) {
      return false;
    }
    return true;
  });
}

module.exports = {
  createNotification,
  getNotification,
  listNotifications
};
