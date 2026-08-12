const aiHandler = require("./ai");
const { getKnowledge } = require("./knowledge");
const { detectIntent } = require("./intent_regex");
const { classifySemanticIntent } = require("./semantic");
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

// Fast exact-pattern check first. Doesn't catch dropped-letter typos
// (e.g. "bayrlla" missing a/l vs "bayarlal") — those fall through to the
// semantic fallback in router() below rather than being patched here
// one variant at a time.
function isClosingMessage(normalizedMsg) {
  return CLOSING_PATTERNS.some((pattern) => pattern.test(normalizedMsg));
}

// Compositional instead of enumerated: an optional "за"/"za" prefix plus one
// affirmation word, so multi-token replies like "za tegi" match without
// needing every za+word combo spelled out individually. Run through
// collapseRepeatedLetters at the call site so doubled-letter typos are
// tolerated the same way greetings already are.
const AFFIRMATION_ONLY_REGEX =
  /^(за\s+|za\s+)?(тийм|тиймээ|тэгье|яахав|болно|ок|tiim|tiimee|za|bolno|ok|yes|tegi|tegii|tegiy)$/;

const REGISTRATION_QUESTION_MARKER = "бүртгүүлэх хүсэлтэй байна уу";

const AFFIRMATION_REPLY =
  "Танд тус болж чадсандаа баяртай байна 😊 . Утасны дугаараа бичээд илгээгээрэй, манай элсэлтийн зөвлөх тантай холбогдох болно 📞";

// Shared by both the regex-closing path and the semantic-closing fallback,
// so the two paths can never drift out of sync with each other.
async function handleClosing(userId, session, message) {
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

  // Uses collapseRepeatedLetters so typo/elongation variants of "za tegi"
  // ("za tegii", "zaaa tegi", etc.) match the same way greetings already do.
  if (
    session.awaitingRegistrationConfirmation &&
    AFFIRMATION_ONLY_REGEX.test(collapseRepeatedLetters(msg))
  ) {
    session.awaitingRegistrationConfirmation = false;
    session.awaitingPhone = true;

    pushHistory(session, message, AFFIRMATION_REPLY);
    await saveSession(userId, session);
    return { reply: AFFIRMATION_REPLY, truncated: false };
  }

  const detectedPrograms = detectPrograms(message, knowledge);
  const hasRecognizedProgram = detectedPrograms.length > 0;
  const isGreetingOnly = matchesGreetingOnly(msg);
  const intentResult = await detectIntent(msg, knowledge, session, hasRecognizedProgram, detectedPrograms);
  if (intentResult) {
    Object.assign(session, intentResult.sessionPatch);
    pushHistory(session, message, intentResult.reply);
    await saveSession(userId, session);
    return { reply: intentResult.reply, truncated: false };
  }

  const normalizedClosingCheck = collapseRepeatedLetters(msg);

  if (isClosingMessage(normalizedClosingCheck)) {
    return await handleClosing(userId, session, message);
  }

  // Fallback for closing phrases the fixed regex can't catch — dropped-letter
  // typos ("bayrlla"), casual slang, unseen phrasings. Only runs when regex
  // already missed and detectIntent's own semantic pass already found nothing
  // (detectIntent returned null above), so this is the last free check before
  // the message would otherwise cost a full Gemini generation.
  const semanticFallback = await classifySemanticIntent(msg);
  if (semanticFallback === "closing") {
    console.log("🎯 Matched by: semantic-closing");
    return await handleClosing(userId, session, message);
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