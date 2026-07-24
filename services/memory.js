const { createClient } = require("redis");

const redisClient = createClient({
  url: process.env.REDIS_URL,
});

redisClient.on("error", (error) => {
  console.error("Redis error:", error);
});

async function connectRedis() {
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

    // True after Gemini asks:
    // “Та бүртгүүлэх хүсэлтэй байна уу?”
    awaitingRegistrationConfirmation: false,

    // True after the customer answers yes
    // and the bot asks for their phone number.
    awaitingPhone: false,
  };
}

async function getSession(senderId) {
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
  const key = getSessionKey(senderId);

  await redisClient.set(key, JSON.stringify(session), {
    EX: 60 * 60,
  });
}

async function clearSession(senderId) {
  const key = getSessionKey(senderId);
  await redisClient.del(key);
}

/**
 * Leads are stored separately from the session, in a permanent Redis
 * list (no expiration), so a customer's contact info survives even
 * after their 1-hour session expires or gets cleared.
 */
const LEADS_KEY = "bot:leads";

async function saveLead(senderId, phone, selectedProgram) {
  const lead = {
    senderId,
    phone,
    selectedProgram: selectedProgram || null,
    capturedAt: new Date().toISOString(),
  };

  await redisClient.rPush(LEADS_KEY, JSON.stringify(lead));
  console.log("📞 New lead captured:", JSON.stringify(lead));
}

async function getLeads() {
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