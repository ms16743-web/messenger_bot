const aiHandler = require("./ai");
const { getKnowledge } = require("./knowledge");
const { detectIntent } = require("./handlers/intent");
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

function pushHistory(session, userText, botText) {
  session.history = Array.isArray(session.history) ? session.history : [];
  session.history.push({ role: "user", text: userText });
  session.history.push({ role: "model", text: botText });
  session.history = session.history.slice(-10);
}

const PHONE_REGEX = /\b\d{2}[\s-]?\d{2}[\s-]?\d{2}[\s-]?\d{2}\b/;

function extractPhoneNumber(message) {
  const match = message.match(PHONE_REGEX);
  if (!match) return null;
  const digitsOnly = match[0].replace(/[\s-]/g, "");
  return digitsOnly.length === 8 ? digitsOnly : null;
}

function collapseRepeatedLetters(str) {
  return str.replace(/([a-zа-яё])\1+/gi, "$1");
}
const GREETING_ONLY_LIST = [
  "сайн байна уу", "сайн уу", "сайн", "сайна", "сайн даа",
  "мэнд байна уу", "мэнд", "мэндлээ", "менде",
  "hi", "hello", "hey",
  "sain baina uu", "sainbaina uu", "sain bna uu", "sainbna uu",
  "sain bna", "sainbna", "sain uu", "sainuu", "sain bn", "sainbn",
  "sain b", "sainb", "sain daa", "saina daa",
  "sain bnu", "sainbnu",
  "sn bnu", "snbnu", "sn bna", "snbna", "sn uu", "snuu",
  "sn u", "snu", "sn", "sbu", "sb",
  "menda", "mend", "mendlee",
];

const GREETING_ONLY_SET = new Set(
  GREETING_ONLY_LIST.map(collapseRepeatedLetters)
);

function matchesGreetingOnly(normalizedMsg) {
  return GREETING_ONLY_SET.has(collapseRepeatedLetters(normalizedMsg));
}

const CLOSING_PATTERNS = [
  /^баярлал(аа|ая)(\s.*)?$/,
  /^за\s*баярлал(аа|ая)(\s.*)?$/,
  /^үгүй\s*баярлал(аа|ая)(\s.*)?$/,
  /^боллоо$/,
  /^ойлголоо$/,
  /^за\s*ойлголоо$/,
  /^(za\s*)?bayarlal(aa|ya)(\s.*)?$/,
  /^(za\s*)?oilgoloo$/,
  /^thanks?(\syou)?$/,
];

function isClosingMessage(normalizedMsg) {
  return CLOSING_PATTERNS.some((pattern) => pattern.test(normalizedMsg));
}

const AFFIRMATION_ONLY_REGEX =
  /^(тийм|тиймээ|тэгье|за тэгье|за|за яахав|болно|за болно|ок|tiim|tiimee|za|bolno|ok|yes)$/;

const REGISTRATION_QUESTION_MARKER = "бүртгүүлэх хүсэлтэй байна уу";

const AFFIRMATION_REPLY =
  "Танд тус болж чадсандаа баяртай байна 😊 . Утасны дугаараа бичээд илгээгээрэй, манай элсэлтийн зөвлөх тантай холбогдох болно 📞";

async function router(userId, text) {
  const message = text.trim();
  const msg = normalizeText(message);
  const knowledge = await getKnowledge();

  const session = await getSession(userId);

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
      session.awaitingRegistrationConfirmation = false;
      session.awaitingPhone = false;
      await saveSession(userId, session);
    }

    return { reply, truncated: false };
  }

  if (session.awaitingRegistrationConfirmation && AFFIRMATION_ONLY_REGEX.test(msg)) {
    session.awaitingRegistrationConfirmation = false;
    session.awaitingPhone = true;

    pushHistory(session, message, AFFIRMATION_REPLY);
    await saveSession(userId, session);
    return { reply: AFFIRMATION_REPLY, truncated: false };
  }

  const detectedPrograms = detectPrograms(message, knowledge);
  const hasRecognizedProgram = detectedPrograms.length > 0;
  const isGreetingOnly = matchesGreetingOnly(msg);

  if (isClosingMessage(msg)) {
    if (session.phone) {
      await clearSession(userId);
      return {
        reply: "Танд тус болж чадсандаа баяртай байна 😊. Танд амжилт хүсье!",
        truncated: false,
      };
    }

    if (!session.phoneRequested) {
      session.phoneRequested = true;
      session.awaitingPhoneForClose = true;

      const reply = `Танд тус болж чадсандаа баяртай байна 😊 . Хэрэв манай элсэлтийн зөвлөхөөс дэлгэрэнгүй мэдээлэл авахыг хүсвэл утасны дугаараа үлдээгээрэй. Бид тантай удахгүй холбогдох болно 📞.`;

      pushHistory(session, message, reply);
      await saveSession(userId, session);
      return { reply, truncated: false };
    }

    await clearSession(userId);
    return {
      reply:
        "Танд тус болж чадсандаа баяртай байна 😊. Хэрэв AI Academy-ийн талаар дахин асуух зүйл гарвал бидэнтэй хүссэн үедээ холбогдоорой. Танд амжилт хүсье!",
      truncated: false,
    };
  }

  if (isGreetingOnly) {
    const reply = `Сайн байна уу! AI Academy Asia-д тавтай морилно уу. 😊

Танд ямар мэдээлэл хэрэгтэй байна вэ?`;

    pushHistory(session, message, reply);
    await saveSession(userId, session);
    return { reply, truncated: false };
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
const intentResult = detectIntent(msg, knowledge, session);
  if (intentResult) {
    Object.assign(session, intentResult.sessionPatch);
    pushHistory(session, message, intentResult.reply);
    await saveSession(userId, session);
    return { reply: intentResult.reply, truncated: false };
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

    const reply = `Мэдээж! Манай элсэлтийн зөвлөхтэй ${knowledge.contact.phone} дугаараар холбогдож болно. Эсвэл өөрийн утасны дугаараа үлдээвэл манай зөвлөх танд эргэж холбогдох болно 📞`;

    pushHistory(session, message, reply);
    await saveSession(userId, session);
    return { reply, truncated: false };
  }

  const { text: aiReply, truncated } = await aiHandler(message, knowledge, session);
  const reply = aiReply.replace(/<<[A-Z_]+>>/g, "").trim();

  session.awaitingRegistrationConfirmation = reply.includes(
    REGISTRATION_QUESTION_MARKER
  );

  pushHistory(session, message, reply);
  await saveSession(userId, session);

  return { reply, truncated };
}

module.exports = {
  router,
  detectPrograms,
  normalizeText,
};