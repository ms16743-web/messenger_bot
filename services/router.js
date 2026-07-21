const aiHandler = require("./ai");
const { getKnowledge } = require("./knowledge");
const {
  getSession,
  saveSession,
  clearSession,
} = require("./memory");

function normalizeText(text) {
  return text
    .toLowerCase()
    .replace(/[.,!?;:()[\]{}"'`]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function detectPrograms(message, knowledge) {
  const normalizedMessage = normalizeText(message);
  const detectedPrograms = [];

  for (const program of knowledge.programs || []) {
    const possibleNames = [
      program.name,
      program.id,
      ...(program.aliases || []),
    ];

    const matched = possibleNames.some((name) => {
      const normalizedName = normalizeText(name);
      if (!normalizedName) return false;
      return normalizedMessage.includes(normalizedName);
    });

    if (matched) detectedPrograms.push(program);
  }

  return detectedPrograms;
}

/**
 * Appends this turn to the session's short-term history and
 * trims it so the Gemini request doesn't grow unbounded.
 * Keeps the last 5 exchanges (10 entries: user+model pairs).
 */
function pushHistory(session, userText, botText) {
  session.history = Array.isArray(session.history) ? session.history : [];
  session.history.push({ role: "user", text: userText });
  session.history.push({ role: "model", text: botText });
  session.history = session.history.slice(-10);
}

// Only matches messages that are ENTIRELY a greeting, nothing else.
// Anything longer, or a greeting combined with a question, falls
// through to the AI, which handles that case naturally.
const GREETING_ONLY_REGEX =
  /^(сайн байна уу|сайн уу|сайн|мэнд байна уу|мэнд|hi|hello|hey)[\s!.,😊🙂👋]*$/i;

async function router(userId, text) {
  const message = text.trim();
  const msg = normalizeText(message);
  const knowledge = getKnowledge();

  const session = await getSession(userId);

  const detectedPrograms = detectPrograms(message, knowledge);
  const hasRecognizedProgram = detectedPrograms.length > 0;

  const hasMongolianCyrillic = /[А-Яа-яӨөҮүЁё]/.test(message);
  const isNumberOnly = /^\d+$/.test(message);

  if (!hasMongolianCyrillic && !isNumberOnly && !hasRecognizedProgram) {
    return "Уучлаарай, асуултаа монгол кириллээр дахин бичнэ үү.";
  }

  const CLOSING_REGEX =
  /^(за\s+)?(баярлалаа|боллоо|ойлголоо)(\s+боллоо)?[\s!.,😊🙏👍]*$/i;

  if (closingMessages.includes(msg)) {
    await clearSession(userId);
    return "Баярлалаа. Танд амжилт хүсье! 😊";
  }

  // Cheap shortcut: pure greeting, nothing else in the message.
  // Everything else (including "greeting + question") goes to the AI.
  if (GREETING_ONLY_REGEX.test(msg)) {
    const reply = `Сайн байна уу! AI Academy Asia-д тавтай морилно уу. 😊

Та аль сургалтын хөтөлбөрийн талаар мэдээлэл авахыг хүсэж байна вэ?`;

    pushHistory(session, message, reply);
    await saveSession(userId, session);
    return reply;
  }

  if (detectedPrograms.length === 1) {
    const selectedProgram = detectedPrograms[0];

    if (
      session.selectedProgram &&
      session.selectedProgram !== selectedProgram.id
    ) {
      session.lastTopic = null;
      session.answered = [];
    }

    session.selectedProgram = selectedProgram.id;
  }

  if (detectedPrograms.length > 1) {
    session.mentionedPrograms = detectedPrograms.map((p) => p.id);
  } else {
    session.mentionedPrograms = [];
  }

  const wantsHuman =
    msg.includes("хүнтэй ярих") ||
    msg.includes("зөвлөхтэй ярих") ||
    msg.includes("оператортой ярих") ||
    msg.includes("менежертэй ярих") ||
    msg.includes("холбогдох хүн") ||
    msg.includes("утсаар ярих");

  if (wantsHuman) {
    session.lastTopic = "human_support";
    if (!session.answered?.includes("human_support")) {
      session.answered = [...(session.answered || []), "human_support"];
    }

    const reply = `Манай элсэлтийн зөвлөхтэй ${knowledge.contact.phone} дугаараар холбогдоно уу.`;

    pushHistory(session, message, reply);
    await saveSession(userId, session);
    return reply;
  }

  // Everything else — including greeting+question combos — goes to Gemini,
  // which now receives the real conversation history via session.history.
  const reply = await aiHandler(message, knowledge, session);

  pushHistory(session, message, reply);
  await saveSession(userId, session);

  return reply;
}

module.exports = {
  router,
  detectPrograms,
  normalizeText,
};