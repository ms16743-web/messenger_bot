function formatDuration(program) {
  return program.duration || "";
}

function formatFormat(program) {
  return program.format || "";
}

// Emoji per program — matches the branding already established in ai.js's
// [ NEW ADMISSION ] examples. Update this if a new program is added.
const PROGRAM_EMOJI = {
  junior_ai_engineer: "🚀",
  ai_101_online: "💻",
  ai_engineer: "⚡",
  corporate_ai: "💼",
};

function formatProgramLine(program) {
  const emoji = PROGRAM_EMOJI[program.id] || "✦";
  const name = program.display_label || program.name;
  // tagline is a short one-line blurb — see note below on adding this field
  const tagline = program.tagline || program.category;
  return `${emoji} ${name.toUpperCase()} (${formatDuration(program)}) | ${formatFormat(program)} | ${tagline}`;
}

function formatProgramList(programs) {
  return programs.map(formatProgramLine).join("\n");
}

function isKidProgram(program) {
  return (program.category || "").includes("Хүүхэд");
}
function isCompanyProgram(program) {
  return (program.category || "").includes("байгууллага");
}
function isAdultPersonalProgram(program) {
  return (program.category || "").includes("Насанд хүрэгч") && !isCompanyProgram(program);
}

// --- Intent 1: single, static facts — no ambiguity possible ---

const LOCATION_REGEX = /(байршил|хаана байр|хаана орш|address|location)/i;
const HOURS_REGEX = /(ажиллах цаг|цагийн хуваарь|хэдээс хэд|opening hours|working hours|цаг хэд)/i;

function detectStaticFactIntent(msg, knowledge) {
  if (LOCATION_REGEX.test(msg)) {
    return `📍 ${knowledge.location}`;
  }
  if (HOURS_REGEX.test(msg)) {
    const h = knowledge.office_hours;
    if (!h) return null;
    return `Бид ${h.working_hours.opens}-${h.working_hours.closes} цагийн хооронд ажилладаг. Үдийн цай: ${h.lunch_break.starts}-${h.lunch_break.ends}.`;
  }
  return null;
}

// --- Intent 2: vague "tell me about your programs" request ---

const VAGUE_REQUEST_REGEX =
  /(мэдээлэл авъя|мэдээлэл өгөөч|хөтөлбөрийн мэдээлэл|программ.*байг|сургалт.*байг|program info|tell me about|what programs|medeelel avii|hutulbriin medeel)/i;

function detectVagueRequestIntent(msg, knowledge) {
  if (!VAGUE_REQUEST_REGEX.test(msg)) return null;

  const reply =
    `[ NEW ADMISSION ] 🚀🔥\n` +
    `AI Academy Asia-ийн шинэ элсэлтүүд албан ёсоор эхэллээ.\n\n` +
    formatProgramList(knowledge.programs) +
    `\n\n📍 Байршил: ${knowledge.location}.\n` +
    `Та хэнд зориулж сургалт хайж байна вэ? (өөртөө / хүүхдэдээ / байгууллагадаа)`;

  return { reply, sessionPatch: { pendingWhoFor: true } };
}

// --- Intent 3: answering "who is this for?" ---

const KID_ANSWER_REGEX = /(хүүхэд|хүүхдэдээ|10.?18|өсвөр|kid|child)/i;
const COMPANY_ANSWER_REGEX = /(байгууллага|компани|company|corporate)/i;
const ADULT_ANSWER_REGEX = /(өөртөө|намайг|би өөрөө|adult|myself|for me)/i;

function detectWhoForAnswerIntent(msg, knowledge, session) {
  if (!session?.pendingWhoFor) return null;

  let filtered = null;
  if (KID_ANSWER_REGEX.test(msg)) filtered = knowledge.programs.filter(isKidProgram);
  else if (COMPANY_ANSWER_REGEX.test(msg)) filtered = knowledge.programs.filter(isCompanyProgram);
  else if (ADULT_ANSWER_REGEX.test(msg)) filtered = knowledge.programs.filter(isAdultPersonalProgram);

  if (!filtered || filtered.length === 0) {
    // Unclear answer — don't guess. Fall through to AI, leave pendingWhoFor
    // as-is so a later clear answer can still be caught.
    return null;
  }

  const reply =
    formatProgramList(filtered) +
    `\n\nТа эдгээрээс аль нь сонирхолтой байгаагаа хэлээрэй, дэлгэрэнгүй мэдээлэл өгье.`;

  return { reply, sessionPatch: { pendingWhoFor: false } };
}

// --- Public entry point ---
// Returns null (no match — fall through to AI) or { reply, sessionPatch }

function detectIntent(msg, knowledge, session) {
  const whoForAnswer = detectWhoForAnswerIntent(msg, knowledge, session);
  if (whoForAnswer) return whoForAnswer;

  const staticFact = detectStaticFactIntent(msg, knowledge);
  if (staticFact) return { reply: staticFact, sessionPatch: {} };

  const vagueRequest = detectVagueRequestIntent(msg, knowledge);
  if (vagueRequest) return vagueRequest;

  return null;
}

module.exports = { detectIntent };