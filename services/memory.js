const { createClient } = require("redis");

// Redis is optional. When REDIS_URL is not configured, the bot runs with an
// in-process memory store instead. Sessions then live only for the lifetime
// of the process (lost on restart), which is fine for a single app server.
const useRedis = Boolean(process.env.REDIS_URL);

const SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour, matching the Redis EX below.
const LEADS_KEY = "bot:leads";

let redisClient = null;

if (useRedis) {
  redisClient = createClient({ url: process.env.REDIS_URL });
  redisClient.on("error", (error) => {
    console.error("Redis error:", error);
  });
}

// ---- In-memory fallback store ----
const memSessions = new Map(); // senderId -> { session, expiresAt }
const memLeads = [];

async function connectRedis() {
  if (!useRedis) {
    console.log("ℹ️ REDIS_URL not set — using in-memory session store.");
    return;
  }
  if (!redisClient.isOpen) {
    await redisClient.connect();
    console.log("Redis connected");
  }
}

function getSessionKey(senderId) {
  return `bot:user:${senderId}:session`;
}

function defaultSession() {
  return {
    selectedProgram: null,
    lastTopic: null,
    answered: [],
    history: [],
    phone: null,
    phoneRequested: false,
    awaitingPhoneForClose: false,
  };
}

async function getSession(senderId) {
  if (!useRedis) {
    const entry = memSessions.get(senderId);
    if (!entry || entry.expiresAt < Date.now()) {
      memSessions.delete(senderId);
      return defaultSession();
    }
    return { ...defaultSession(), ...entry.session };
  }

  const key = getSessionKey(senderId);
  const savedSession = await redisClient.get(key);

  if (!savedSession) {
    return defaultSession();
  }

  try {
    return { ...defaultSession(), ...JSON.parse(savedSession) };
  } catch (error) {
    console.error("Session parsing error:", error);
    return defaultSession();
  }
}

async function saveSession(senderId, session) {
  if (!useRedis) {
    memSessions.set(senderId, {
      session,
      expiresAt: Date.now() + SESSION_TTL_MS,
    });
    return;
  }

  const key = getSessionKey(senderId);
  await redisClient.set(key, JSON.stringify(session), {
    EX: 60 * 60,
  });
}

async function clearSession(senderId) {
  if (!useRedis) {
    memSessions.delete(senderId);
    return;
  }
  const key = getSessionKey(senderId);
  await redisClient.del(key);
}

/**
 * Leads are stored separately from the session so a customer's contact info
 * survives even after their 1-hour session expires. In the in-memory store
 * they live for the process lifetime; with Redis they persist permanently.
 */
async function saveLead(senderId, phone, selectedProgram) {
  const lead = {
    senderId,
    phone,
    selectedProgram: selectedProgram || null,
    capturedAt: new Date().toISOString(),
  };

  if (!useRedis) {
    memLeads.push(lead);
    console.log("📞 New lead captured:", JSON.stringify(lead));
    return;
  }

  await redisClient.rPush(LEADS_KEY, JSON.stringify(lead));
  console.log("📞 New lead captured:", JSON.stringify(lead));
}

async function getLeads() {
  if (!useRedis) {
    return [...memLeads];
  }

  const raw = await redisClient.lRange(LEADS_KEY, 0, -1);
  return raw
    .map((entry) => {
      try {
        return JSON.parse(entry);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

module.exports = {
  redisClient,
  connectRedis,
  getSession,
  saveSession,
  clearSession,
  saveLead,
  getLeads,
};
