const aiHandler = require("./ai");
const { getKnowledge } = require("./knowledge");
const {
  getSession,
  saveSession,
  clearSession,
} = require("./memory");

/**
 * Normalize text so program matching is not affected by:
 * - uppercase/lowercase
 * - commas and punctuation
 * - repeated spaces
 */
function normalizeText(text) {
  return text
    .toLowerCase()
    .replace(/[.,!?;:()[\]{}"'`]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Finds all programs mentioned in the user's message.
 *
 * Returns:
 * []                    → no program detected
 * [program]             → one program detected
 * [program1, program2]  → multiple programs detected
 */
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

      if (!normalizedName) {
        return false;
      }

      return normalizedMessage.includes(normalizedName);
    });

    if (matched) {
      detectedPrograms.push(program);
    }
  }

  return detectedPrograms;
}

async function router(userId, text) {
  const message = text.trim();
  const msg = normalizeText(message);
  const knowledge = getKnowledge();

  // Load this Messenger user's existing memory.
  const session = await getSession(userId);

  // Detect programs before language validation.
  // This allows official names such as "Junior" and "AI 101".
  const detectedPrograms = detectPrograms(message, knowledge);
  const hasRecognizedProgram = detectedPrograms.length > 0;

  const hasMongolianCyrillic = /[А-Яа-яӨөҮүЁё]/.test(message);
  const isNumberOnly = /^\d+$/.test(message);

  if (
    !hasMongolianCyrillic &&
    !isNumberOnly &&
    !hasRecognizedProgram
  ) {
    return "Уучлаарай, асуултаа монгол кириллээр дахин бичнэ үү.";
  }

  // End the conversation and remove its old context.
  const closingMessages = [
    "баярлалаа",
    "баярлалаа боллоо",
    "за баярлалаа",
    "үгүй баярлалаа",
    "боллоо",
    "ойлголоо",
    "за ойлголоо",
  ];

  if (closingMessages.includes(msg)) {
    await clearSession(userId);

    return "Баярлалаа. Танд амжилт хүсье! 😊";
  }

  // Handle messages containing only a greeting.
  const greetings = [
    "сайн байна уу",
    "сайн уу",
    "сайн",
    "мэнд",
    "мэнд байна уу",
  ];

  if (greetings.includes(msg)) {
    // Refresh the session expiration without changing its content.
    await saveSession(userId, session);

    return `Сайн байна уу! AI Academy Asia-д тавтай морилно уу. 😊

Та аль сургалтын хөтөлбөрийн талаар мэдээлэл авахыг хүсэж байна вэ?`;
  }

  /**
   * Update selectedProgram only when exactly one program is mentioned.
   *
   * If multiple programs are mentioned, the user may be comparing them.
   * In that case, we should not randomly select one.
   */
  if (detectedPrograms.length === 1) {
    const selectedProgram = detectedPrograms[0];

    // Clear topic history when the user changes to another program.
    if (
      session.selectedProgram &&
      session.selectedProgram !== selectedProgram.id
    ) {
      session.lastTopic = null;
      session.answered = [];
    }

    session.selectedProgram = selectedProgram.id;
  }

  /**
   * When multiple programs are mentioned, remember them temporarily
   * for the AI to understand that this is likely a comparison.
   */
  if (detectedPrograms.length > 1) {
    session.mentionedPrograms = detectedPrograms.map(
      (program) => program.id
    );
  } else {
    session.mentionedPrograms = [];
  }

  // Handle only explicit requests to speak with a real person.
  const wantsHuman =
    msg.includes("хүнтэй ярих") ||
    msg.includes("зөвлөхтэй ярих") ||
    msg.includes("оператортой ярих") ||
    msg.includes("менежертэй ярих") ||
    msg.includes("холбогдох хүн") ||
    msg.includes("утсаар ярих");

  if (wantsHuman) {
    session.lastTopic = "human_support";

    if (!session.answered.includes("human_support")) {
      session.answered.push("human_support");
    }

    await saveSession(userId, session);

    return `Манай элсэлтийн зөвлөхтэй ${knowledge.contact.phone} дугаараар холбогдоно уу.`;
  }

  // Save the detected program before calling the AI.
  await saveSession(userId, session);

  // The third parameter will be used after we update ai.js.
  const reply = await aiHandler(message, knowledge, session);

  // Refresh the one-hour Redis expiration after the response.
  await saveSession(userId, session);

  return reply;
}

module.exports = {
  router,
  detectPrograms,
  normalizeText,
};