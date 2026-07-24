const aiHandler = require("./ai");
const { getKnowledge } = require("./knowledge");
const {
  getSession,
  saveSession,
  clearSession,
  saveLead,
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

// Mongolian mobile numbers are 8 digits. Matches "99112233", "9911-2233",
// "+976 99112233", etc. — anywhere inside a longer message.
const PHONE_REGEX = /\b\d{2}[\s-]?\d{2}[\s-]?\d{2}[\s-]?\d{2}\b/;

function extractPhoneNumber(message) {
  const match = message.match(PHONE_REGEX);
  if (!match) return null;
  const digitsOnly = match[0].replace(/[\s-]/g, "");
  return digitsOnly.length === 8 ? digitsOnly : null;
}

const GREETING_ONLY_REGEX =
  /^(сайн байна уу|сайн уу|сайн|мэнд байна уу|мэнд|hi|hello|hey)[\s!.,😊🙂👋]*$/i;

const CLOSING_MESSAGES = [
  "баярлалаа",
  "баярлалаа боллоо",
  "за баярлалаа",
  "үгүй баярлалаа",
  "боллоо",
  "ойлголоо",
  "за ойлголоо",
];

async function router(userId, text) {
  const message = text.trim();
  const msg = normalizeText(message);
  const knowledge = await getKnowledge();

  const session = await getSession(userId);

  // Check for a phone number anywhere in the message, before any other
  // logic — a customer might just type it in, with or without extra text.
  const capturedPhone = extractPhoneNumber(message);

  if (capturedPhone && !session.phone) {
    session.phone = capturedPhone;
    await saveLead(userId, capturedPhone, session.selectedProgram);

    const wasClosingUp = session.awaitingPhoneForClose;

    const reply = wasClosingUp
      ? `Баярлалаа! ✅ Танай дугаарыг хүлээн авлаа. Манай элсэлтийн зөвлөх тантай удахгүй холбогдох болно. Амжилт хүсье! 😊`
      : `Баярлалаа! ✅ Танай дугаарыг хүлээн авлаа. Манай элсэлтийн зөвлөх тантай удахгүй холбогдох болно.`;

    pushHistory(session, message, reply);

    if (wasClosingUp) {
      await clearSession(userId);
    } else {
      session.awaitingPhoneForClose = false;
      await saveSession(userId, session);
    }

    return reply;
  }

  const detectedPrograms = detectPrograms(message, knowledge);
  const hasRecognizedProgram = detectedPrograms.length > 0;

  const hasMongolianCyrillic = /[А-Яа-яӨөҮүЁё]/.test(message);
  const isNumberOnly = /^\d+$/.test(message);

  if (!hasMongolianCyrillic && !isNumberOnly && !hasRecognizedProgram) {
    return "Уучлаарай, асуултаа монгол кириллээр дахин бичнэ үү.";
  }

  if (CLOSING_MESSAGES.includes(msg)) {
    if (session.phone) {
      await clearSession(userId);
      return "Баярлалаа. Танд амжилт хүсье! 😊";
    }

    if (!session.phoneRequested) {
      session.phoneRequested = true;
      session.awaitingPhoneForClose = true;

      const reply = `Танд туслахад таатай байлаа! 😊 Манай элсэлтийн зөвлөх тантай холбогдож, нэмэлт мэдээлэл өгөхийг хүсвэл утасны дугаараа үлдээгээрэй 📞`;

      pushHistory(session, message, reply);
      await saveSession(userId, session);
      return reply;
    }

    await clearSession(userId);
    return "Баярлалаа. Танд амжилт хүсье! 😊";
  }

  if (GREETING_ONLY_REGEX.test(msg)) {
    const reply = `Сайн байна уу! AI Academy Asia-д тавтай морилно уу. 😊

Танд ямар мэдээлэл хэрэгтэй байна вэ?`;

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
    msg.includes("хүнтэй холбогдох") ||
    msg.includes("хүнтэй холбогдмоор") ||
    msg.includes("ярих хүнтэй") ||
    msg.includes("зөвлөхтэй ярих") ||
    msg.includes("зөвлөхтэй холбогдох") ||
    msg.includes("зөвлөхтэй холбогдмоор") ||
    msg.includes("оператортой ярих") ||
    msg.includes("менежертэй ярих") ||
    msg.includes("холбогдох хүн") ||
    msg.includes("утсаар ярих") ||
    msg.includes("утсаар холбогдох") ||
    msg.includes("залгаж") ||
    msg.includes("бодит хүнтэй") ||
    msg.includes("жинхэнэ хүнтэй");

  if (wantsHuman) {
    session.lastTopic = "human_support";
    if (!session.answered?.includes("human_support")) {
      session.answered = [...(session.answered || []), "human_support"];
    }

    const reply = `Мэдээж! Манай элсэлтийн зөвлөхтэй ${knowledge.contact.phone} дугаараар холбогдож болно. Эсвэл өөрийн утасны дугаараа 📞 үлдээвэл манай зөвлөх танд эргэж холбогдох болно`;

    pushHistory(session, message, reply);
    await saveSession(userId, session);
    return reply;
  }

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