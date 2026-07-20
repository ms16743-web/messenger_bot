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

async function getSession(senderId) {
  const key = getSessionKey(senderId);
  const savedSession = await redisClient.get(key);

  if (!savedSession) {
    return {
      selectedProgram: null,
      lastTopic: null,
      answered: [],
    };
  }

  try {
    return JSON.parse(savedSession);
  } catch (error) {
    console.error("Session parsing error:", error);

    return {
      selectedProgram: null,
      lastTopic: null,
      answered: [],
    };
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

module.exports = {
  redisClient,
  connectRedis,
  getSession,
  saveSession,
  clearSession,
};