function formatDuration(program) {
  return program.duration || "";
}

function formatFormat(program) {
  return program.format || "";
}

const { classifySemanticIntent } = require("./semantic");

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

function formatHoursReply(h) {
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
    console.log("🎯 Matched by: regex-location");
    return `📍 ${knowledge.location}`;
  }

  if (isHoursQuestion(msg)) {
    console.log("🎯 Matched by: regex-hours");
    const h = knowledge.office_hours;
    if (!h) return null;
    return formatHoursReply(h);
  }

  return null;
}

// --- Intent: exact program + optional detail field (regex layer) ---
// Handles all of: "junior ai мэдээлэл өгөөч" (overview), "junior ai үнэ хэд вэ"
// (named + detail in one message), and "үнэ хэд вэ" as a bare follow-up once
// a program is already the topic of conversation (session.selectedProgram).

const FIELD_PATTERNS = {
  price: {
    regex: /(үнэ|төлбөр|хэдэн төгрөг|price|pricing|une|tulbur)/i,
    keys: ["price", "price_note"],
    label: "💰 Үнэ",
  },
  schedule: {
    regex: /(хуваарь|хэзээ эхэл|хэзээ болох|цагийн хуваарь|schedule|hezee)/i,
    keys: ["schedule", "schedule_note", "duration"],
    label: "🗓 Хуваарь",
  },
  curriculum: {
    regex: /(агуулга|сэдэв|хичээлийн төлөвлөгөө|curriculum|syllabus|юу заа|юу сурга)/i,
    keys: ["curriculum_summary", "skills"],
    label: "📚 Агуулга",
  },
  requirements: {
    regex: /(шаардлага|орох болзол|requirement|prerequisite|урьдчилсан мэдлэг)/i,
    keys: ["prerequisites", "requirements"],
    label: "✅ Шаардлага",
  },
  certificate: {
    regex: /(гэрчилгээ|сертификат|certificate|diploma)/i,
    keys: ["certificate"],
    label: "🎓 Гэрчилгээ",
  },
};

function getFirstAvailableField(program, keys) {
  for (const key of keys) {
    const value = program[key];
    if (!value) continue;
    return Array.isArray(value) ? value.join("; ") : String(value);
  }
  return null;
}

// Returns a formatted reply string for the first detail-word matched,
// or null if no detail-word matched (caller falls back to overview),
// or null if a detail-word matched but the program has no data for it
// (caller should fall through to AI/fallback rather than say nothing).
function detectProgramFieldIntent(msg, program) {
  for (const [fieldName, config] of Object.entries(FIELD_PATTERNS)) {
    if (!config.regex.test(msg)) continue;
    const value = getFirstAvailableField(program, config.keys);
    if (!value) return null;
    console.log("🎯 Matched by: regex-program-field", program.id, fieldName);
    return `${config.label} — ${program.display_label || program.name}\n${value}`;
  }
  return null;
}

function formatProgramOverview(program) {
  const emoji = PROGRAM_EMOJI[program.id] || "✦";
  const name = program.display_label || program.name;
  return (
    `${emoji} ${name.toUpperCase()}\n\n` +
    `⏱️ Хугацаа: ${program.duration || "Мэдээлэл байхгүй"}\n` +
    `💻 Формат: ${program.format || "Мэдээлэл байхгүй"}\n\n` +
    `${program.description || ""}\n\n` +
    `Үнэ, хуваарь, агуулга, шаардлага, сертификатын аль нэгийг дэлгэрэнгүй мэдмээр байна уу?`
  );
}

function detectExactProgramIntent(msg, knowledge, session, detectedPrograms) {
  const namedNow = detectedPrograms && detectedPrograms.length === 1 ? detectedPrograms[0] : null;
  const program =
    namedNow ||
    (session?.selectedProgram && knowledge.programs.find((p) => p.id === session.selectedProgram));

  if (!program) return null;

  // Detail word present → answer just that field, regardless of whether
  // the program was named just now or is being carried over from context.
  const fieldReply = detectProgramFieldIntent(msg, program);
  if (fieldReply) {
    return {
      reply: fieldReply,
      sessionPatch: { selectedProgram: program.id, pendingWhoFor: false },
    };
  }

  // No detail word. Only give the full overview when the program was
  // actually named in THIS message — otherwise an unrelated follow-up
  // ("баярлалаа" etc.) would wrongly re-dump the overview every time.
  if (!namedNow) return null;

  console.log("🎯 Matched by: regex-program-overview", program.id);
  return {
    reply: formatProgramOverview(program),
    sessionPatch: { selectedProgram: program.id, pendingWhoFor: false },
  };
}

// --- Intent: vague info request ("мэдээлэл авъя") ---

const VAGUE_REQUEST_REGEX =
  /(мэдээлэл авъя|мэдээлэл өгөөч|хөтөлбөрийн мэдээлэл|программ.*байг|сургалт.*байг|program info|tell me about|what programs|medeelel avii|medeelel uguch|hutulbriin medeel)/i;

function detectVagueRequestIntent(msg, knowledge, hasSpecificProgramMatch) {
  // If a named program (or field detail) already matched above, this is
  // NOT a vague request — that branch already returned.
  if (hasSpecificProgramMatch) return null;
  if (!VAGUE_REQUEST_REGEX.test(msg)) return null;

  const reply = `Сайн байна уу! 😊 AI Academy-д тавтай морил. Та ямар мэдээлэл сонирхож байна вэ?`;

  return { reply, sessionPatch: { pendingWhoFor: true } };
}

// --- Intent: answering "who is this for?" / group requests ---

const KID_ANSWER_REGEX = /(хүүхэд|хүүхдэдээ|huuhed|huuhedde|huhed|10.?18|өсвөр|kid|child)/i;
const COMPANY_ANSWER_REGEX = /(байгууллага|компани|compand|company|corporate)/i;
const ADULT_ANSWER_REGEX = /(өөртөө|uurtuu|намайг|би өөрөө|adult|myself|for me|насанд хүрэгч|nasand huregch)/i;

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

function detectDirectCategoryIntent(msg, knowledge, hasSpecificProgramMatch) {
  if (hasSpecificProgramMatch) return null; // a named program takes priority, handled earlier

  let filtered = null;
  if (KID_ANSWER_REGEX.test(msg)) filtered = knowledge.programs.filter(isKidProgram);
  else if (COMPANY_ANSWER_REGEX.test(msg)) filtered = knowledge.programs.filter(isCompanyProgram);
  else if (ADULT_ANSWER_REGEX.test(msg)) filtered = knowledge.programs.filter(isAdultPersonalProgram);

  if (!filtered || filtered.length === 0) return null;

  const reply =
    `Дараах хөтөлбөрүүдийн бүртгэл нээлттэй байна:\n\n` +
    formatProgramList(filtered) +
    `\n\nЭдгээрээс аль хөтөлбөрийн талаар дэлгэрэнгүй мэдээлэл авахыг хүсэж байна вэ?`;

  return { reply, sessionPatch: { pendingWhoFor: false } };
}

// --- Public entry point ---
// Returns null (no match — fall through to AI) or { reply, sessionPatch }

async function detectIntent(msg, knowledge, session, hasSpecificProgramMatch, detectedPrograms) {
  // 1. "who is this for" answer to a pending question takes top priority
  const whoForAnswer = detectWhoForAnswerIntent(msg, knowledge, session);
  if (whoForAnswer) return whoForAnswer;

  // 2. location / hours — static facts
  const staticFact = detectStaticFactIntent(msg, knowledge);
  if (staticFact) return { reply: staticFact, sessionPatch: {} };

  // 3. exact program (named now, or carried over) ± detail field
  const exactProgram = detectExactProgramIntent(msg, knowledge, session, detectedPrograms);
  if (exactProgram) return exactProgram;

  // 4. group / category request (kids / adult / company), no program named
  const directCategory = detectDirectCategoryIntent(msg, knowledge, hasSpecificProgramMatch);
  if (directCategory) return directCategory;

  // 5. vague "give me info" request
  const vagueRequest = detectVagueRequestIntent(msg, knowledge, hasSpecificProgramMatch);
  if (vagueRequest) return vagueRequest;

  // Nothing matched by regex — try semantic matching as a fallback.
  const semanticIntent = await classifySemanticIntent(msg);

  if (semanticIntent === "location") {
    console.log("🎯 Matched by: semantic-location");
    return { reply: `📍 ${knowledge.location}`, sessionPatch: {} };
  }

  if (semanticIntent === "hours") {
    console.log("🎯 Matched by: semantic-hours");
    const h = knowledge.office_hours;
    if (h) return { reply: formatHoursReply(h), sessionPatch: {} };
  }

  if (semanticIntent === "vague_request") {
    console.log("🎯 Matched by: semantic-vague_request");
    const vague = detectVagueRequestIntent(msg, knowledge, false);
    if (vague) return vague;
  }

  if (semanticIntent === "group_request") {
    console.log("🎯 Matched by: semantic-group_request");
    const group = detectDirectCategoryIntent(msg, knowledge, false);
    if (group) return group;
  }

  if (semanticIntent === "exact_request") {
    console.log("🎯 Matched by: semantic-exact_request");
    // No program name was regex-matched, but the message is semantically
    // about a specific program. Without a named/selected program we can't
    // safely guess which one — fall through to AI, which has full context.
    if (session?.selectedProgram) {
      const program = knowledge.programs.find((p) => p.id === session.selectedProgram);
      if (program) {
        const fieldReply = detectProgramFieldIntent(msg, program);
        if (fieldReply) {
          return { reply: fieldReply, sessionPatch: { selectedProgram: program.id } };
        }
      }
    }
  }

  return null;
}

module.exports = { detectIntent };