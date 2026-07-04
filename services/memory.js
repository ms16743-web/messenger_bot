// services/memory.js

const userMemory = {};

function createProfile() {
  return {
    language: null,
    role: null,
    age: null,
    goal: null,
    experience: null,
    currentProgram: null,
    lastIntent: null,
    conversationStage: "start"
  };
}

function getMemory(userId) {
  if (!userMemory[userId]) {
    userMemory[userId] = createProfile();
  }

  return userMemory[userId];
}

function updateMemory(userId, text) {
  const memory = getMemory(userId);
  const msg = text.toLowerCase();

  // language detection
  if (
    /[а-яөүА-ЯӨҮ]/.test(text) ||
    msg.includes("sain") ||
    msg.includes("sn uu") ||
    msg.includes("une") ||
    msg.includes("tolbor")
  ) {
    memory.language = "mn";
  } else {
    memory.language = "en";
  }

  // age detection
  const ageMatch = msg.match(/\b\d{1,2}\b/);
  if (ageMatch) {
    const age = parseInt(ageMatch[0]);

    if (age >= 5 && age <= 80) {
      memory.age = age;
    }
  }

  // goal detection
  if (msg.includes("ai") || msg.includes("хиймэл")) {
    memory.goal = "AI";
  }

  if (
    msg.includes("programming") ||
    msg.includes("code") ||
    msg.includes("код") ||
    msg.includes("программ")
  ) {
    memory.goal = "programming";
  }

  if (
    msg.includes("automation") ||
    msg.includes("автомат")
  ) {
    memory.goal = "automation";
  }

  return memory;
}

function resetMemory(userId) {
  userMemory[userId] = createProfile();
}

module.exports = {
  getMemory,
  updateMemory,
  resetMemory
};