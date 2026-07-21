const aiHandler = require("./ai");
const { getKnowledge } = require("./knowledge");

const {
  getSession,
  saveSession,
  clearSession,
} = require("./memory");

/**
 * Makes text easier to compare.
 */
function normalizeText(text) {
  return text
    .toLowerCase()
    .replace(
      /[.,!?;:()[\]{}"'`]/g,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Detects program names and aliases in a message.
 */
function detectPrograms(
  message,
  knowledge
) {
  const normalizedMessage =
    normalizeText(message);

  const detectedPrograms = [];

  for (
    const program of knowledge.programs || []
  ) {
    const possibleNames = [
      program.name,
      program.id,
      ...(program.aliases || []),
    ];

    const matched = possibleNames.some(
      (name) => {
        const normalizedName =
          normalizeText(name);

        if (!normalizedName) {
          return false;
        }

        return normalizedMessage.includes(
          normalizedName
        );
      }
    );

    if (matched) {
      detectedPrograms.push(program);
    }
  }

  return detectedPrograms;
}

/**
 * Stores conversation history.
 *
 * Keeps the last five user and bot exchanges,
 * meaning ten total history entries.
 */
function pushHistory(
  session,
  userText,
  botText
) {
  session.history = Array.isArray(
    session.history
  )
    ? session.history
    : [];

  session.history.push({
    role: "user",
    text: userText,
  });

  session.history.push({
    role: "model",
    text: botText,
  });

  session.history =
    session.history.slice(-10);
}

/**
 * Matches only messages that contain a greeting
 * and nothing else.
 */
const GREETING_ONLY_REGEX =
  /^(сайн байна уу|сайн уу|сайн|мэнд байна уу|мэнд|hi|hello|hey)[\s!.,😊🙂👋]*$/i;

async function router(userId, text) {
  const message = text.trim();
  const msg = normalizeText(message);

  const knowledge = getKnowledge();

  const session =
    (await getSession(userId)) || {};

  const detectedPrograms =
    detectPrograms(message, knowledge);

  const hasRecognizedProgram =
    detectedPrograms.length > 0;

  const hasMongolianCyrillic =
    /[А-Яа-яӨөҮүЁё]/.test(message);

  const isNumberOnly =
    /^\d+$/.test(message);

  /**
   * Ask the user to use Mongolian Cyrillic when:
   * - the message contains no Mongolian Cyrillic;
   * - it is not just a number;
   * - it does not contain a recognized program name.
   */
  if (
    !hasMongolianCyrillic &&
    !isNumberOnly &&
    !hasRecognizedProgram
  ) {
    return "Уучлаарай, асуултаа монгол кириллээр дахин бичнэ үү.";
  }

  const closingMessages = [
    "баярлалаа",
    "баярлалаа боллоо",
    "за баярлалаа",
    "үгүй баярлалаа",
    "боллоо",
    "ойлголоо",
    "за ойлголоо",
  ];

  /**
   * End the conversation and clear its memory.
   */
  if (closingMessages.includes(msg)) {
    await clearSession(userId);

    return "Баярлалаа. Танд амжилт хүсье! 😊";
  }

  /**
   * Reply directly when the message is only a greeting.
   *
   * Greeting plus a question will go to Gemini.
   */
  if (GREETING_ONLY_REGEX.test(msg)) {
    const reply =
      `Сайн байна уу! AI Academy Asia-д тавтай морилно уу. 😊\n\n` +
      "Та аль сургалтын хөтөлбөрийн талаар мэдээлэл авахыг хүсэж байна вэ?";

    pushHistory(
      session,
      message,
      reply
    );

    await saveSession(
      userId,
      session
    );

    return reply;
  }

  /**
   * Save one detected program as the selected program.
   */
  if (detectedPrograms.length === 1) {
    const selectedProgram =
      detectedPrograms[0];

    if (
      session.selectedProgram &&
      session.selectedProgram !==
        selectedProgram.id
    ) {
      session.lastTopic = null;
      session.answered = [];
    }

    session.selectedProgram =
      selectedProgram.id;
  }

  /**
   * Save multiple mentioned programs for comparison questions.
   */
  if (detectedPrograms.length > 1) {
    session.mentionedPrograms =
      detectedPrograms.map(
        (program) => program.id
      );
  } else {
    session.mentionedPrograms = [];
  }

  /**
   * Detect requests to speak with a human.
   */
  const wantsHuman =
    msg.includes("хүнтэй ярих") ||
    msg.includes("зөвлөхтэй ярих") ||
    msg.includes("оператортой ярих") ||
    msg.includes("менежертэй ярих") ||
    msg.includes("холбогдох хүн") ||
    msg.includes("утсаар ярих");

  if (wantsHuman) {
    session.lastTopic =
      "human_support";

    if (
      !session.answered?.includes(
        "human_support"
      )
    ) {
      session.answered = [
        ...(session.answered || []),
        "human_support",
      ];
    }

    const reply =
      `Манай элсэлтийн зөвлөхтэй ` +
      `${knowledge.contact.phone} ` +
      "дугаараар холбогдоно уу.";

    pushHistory(
      session,
      message,
      reply
    );

    await saveSession(
      userId,
      session
    );

    return reply;
  }

  /**
   * Send all other messages to Gemini.
   */
  const reply = await aiHandler(
    message,
    knowledge,
    session
  );

  pushHistory(
    session,
    message,
    reply
  );

  await saveSession(
    userId,
    session
  );

  return reply;
}

module.exports = {
  router,
  detectPrograms,
  normalizeText,
};