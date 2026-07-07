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
const monglishWords = [
  "sain", "sn", "bnu", "baina", "bn", "uu", "u",
  "bi", "minii", "manai", "tanai", "tanii",
  "medeelel", "avmaar", "asuumaar", "sonirhoj", "sonirhood",
  "surgalt", "surgaltiin", "course", "hicheel",
  "huuhdiin", "huuhed", "nas", "nastai",
  "une", "tolbor", "hed", "ymar",
  "hayag", "haana", "bdg", "baidag",
  "burtguuleh", "herhen", "yaaj",
  "huvaari", "tsag", "udur",
  "sertifikat", "certificate", "olgoj", "ogdog", "avii", "awii", "avya", "awya", "avah", "avmaar",
"medeelel", "medeelliin", "delgerengui"
];

const hasCyrillic = /[а-яөүА-ЯӨҮ]/.test(text);

const monglishCount = monglishWords.filter(word =>
  msg.includes(word)
).length;

if (hasCyrillic || monglishCount >= 2) {
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