function formatDuration(program) {
  return program.duration || "";
}

function formatFormat(program) {
  return program.format || "";
}

const PROGRAM_EMOJI = {
  junior_ai_engineer: "🚀",
  ai_101_online: "💻",
  ai_engineer: "⚡",
  corporate_ai: "💼",
};

function formatProgramLine(program) {
  const emoji = PROGRAM_EMOJI[program.id] || "✦";
  const name = program.display_label || program.name;
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

// --- Live office-hours calculation (Ulaanbaatar time, not server time) ---

function getUlaanbaatarMinutesNow() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ulaanbaatar",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const hour = Number(parts.find((p) => p.type === "hour").value);
  const minute = Number(parts.find((p) => p.type === "minute").value);
  return hour * 60 + minute;
}

function timeToMinutes(str) {
  const [h, m] = str.split(":").map(Number);
  return h * 60 + m;
}

function getOfficeStatus(officeHours) {
  const nowMin = getUlaanbaatarMinutesNow();
  const opens = timeToMinutes(officeHours.working_hours.opens);
  const closes = timeToMinutes(officeHours.working_hours.closes);
  const lunchStart = timeToMinutes(officeHours.lunch_break.starts);
  const lunchEnd = timeToMinutes(officeHours.lunch_break.ends);

  if (nowMin < opens || nowMin >= closes) return "closed";
  if (nowMin >= lunchStart && nowMin < lunchEnd) return "lunch";
  return "open";
}

// --- Intent: location / office hours (static facts) ---

const LOCATION_REGEX =
  /(байршил|хаяг|хаана байр|хаана орш|та нар хаана|энэ хаана|bairsh|bayrsh|brshil|brshl|hayg|hayag|hayig|haan[a]?\s*bai|haana\s*bai|hana\s*bai|haanve|haan\s*bdg|hana\s*bdg|address|location|where.*(you|located)|where\s+is)/i;

const HOURS_TIME_WORD = /(tsag|цаг)/i;
const HOURS_CONTEXT_WORD =
  /(huviar|huvira|huvari|huvaari|хуваарь|ажиллах|ажлын|ajillah|ajlin|ajliin|hed(ees)?|hze|hz|хэд|open|hours|walk\s*in|ирж бол|irj\s*bol)/i;

function isHoursQuestion(msg) {
  return HOURS_TIME_WORD.test(msg) && HOURS_CONTEXT_WORD.test(msg);
}

function detectStaticFactIntent(msg, knowledge) {
  if (LOCATION_REGEX.test(msg)) {
    return `📍 ${knowledge.location}`;
  }

  if (isHoursQuestion(msg)) {
    const h = knowledge.office_hours;
    if (!h) return null;

    const status = getOfficeStatus(h);
    const baseInfo = `Бид ${h.working_hours.opens}-${h.working_hours.closes} цагийн хооронд ажилладаг. Үдийн цай: ${h.lunch_break.starts}-${h.lunch_break.ends}.`;

    if (status === "open") {
      return `Тийм, бид яг одоо нээлттэй байгаа — тавтай морил! ${baseInfo}`;
    }
    if (status === "lunch") {
      return `Одоогоор үдийн завсарлагааны цаг байна (${h.lunch_break.starts}-${h.lunch_break.ends}), тул түр хүлээгээд ирвэл илүү тохиромжтой байх болно. ${baseInfo}`;
    }
    return `Уучлаарай, яг одоо хаалттай байна. ${baseInfo}`;
  }

  return null;
}

// --- Intent: vague "tell me about your programs" request ---

const VAGUE_REQUEST_REGEX =
  /(мэдээлэл авъя|мэдээлэл өгөөч|хөтөлбөрийн мэдээлэл|программ.*байг|сургалт.*байг|program info|tell me about|what programs|medeelel avii|medeelel uguch|hutulbriin medeel)/i;

function detectVagueRequestIntent(msg, knowledge, hasSpecificProgramMatch) {
  // If detectPrograms already found a named program in this message,
  // this is NOT a vague request — let it fall through to AI instead.
  if (hasSpecificProgramMatch) return null;
  if (!VAGUE_REQUEST_REGEX.test(msg)) return null;

  const reply =
    `Сайн байна уу! 😊 AI Academy-д тавтай морил. \nОдоогоор бүртгэл нь нээлттэй байгаа сургалтууд: \n\n` +
    formatProgramList(knowledge.programs) +
    `\n\nТа хэнд зориулж сургалт хайж байна вэ? (өөртөө / хүүхдэдээ / байгууллагадаа)`;

  return { reply, sessionPatch: { pendingWhoFor: true } };
}

// --- Intent: answering "who is this for?" ---

const KID_ANSWER_REGEX = /(хүүхэд|хүүхдэдээ|huuhed|huuhedde|huhed|10.?18|өсвөр|kid|child)/i;
const COMPANY_ANSWER_REGEX = /(байгууллага|компани|compand|company|corporate)/i;
const ADULT_ANSWER_REGEX = /(өөртөө|uurtuu|намайг|би өөрөө|adult|myself|for me)/i;

function detectWhoForAnswerIntent(msg, knowledge, session) {
  if (!session?.pendingWhoFor) return null;

  let filtered = null;
  if (KID_ANSWER_REGEX.test(msg)) filtered = knowledge.programs.filter(isKidProgram);
  else if (COMPANY_ANSWER_REGEX.test(msg)) filtered = knowledge.programs.filter(isCompanyProgram);
  else if (ADULT_ANSWER_REGEX.test(msg)) filtered = knowledge.programs.filter(isAdultPersonalProgram);

  if (!filtered || filtered.length === 0) return null;

  const reply =
    formatProgramList(filtered) +
    `\n\nЭдгээр хөтөлбөрүүдээс аль талаар нь илүү дэлгэрэнгүй мэдээлэл авахыг хүсэж байна вэ? 😊`;

  return { reply, sessionPatch: { pendingWhoFor: false } };
}

// --- Public entry point ---
// Returns null (no match — fall through to AI) or { reply, sessionPatch }

function detectIntent(msg, knowledge, session, hasSpecificProgramMatch) {
  const whoForAnswer = detectWhoForAnswerIntent(msg, knowledge, session);
  if (whoForAnswer) return whoForAnswer;

  const staticFact = detectStaticFactIntent(msg, knowledge);
  if (staticFact) return { reply: staticFact, sessionPatch: {} };

  const vagueRequest = detectVagueRequestIntent(msg, knowledge, hasSpecificProgramMatch);
  if (vagueRequest) return vagueRequest;

  return null;
}

module.exports = { detectIntent };