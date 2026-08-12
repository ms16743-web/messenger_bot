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

// Builds a Unicode-boundary-safe alternation so short romanized tokens
// (e.g. "tulbur" = payment) don't accidentally match as a substring of an
// unrelated longer word (e.g. "hutulbur" = program). \p{L}/\p{N} cover both
// Cyrillic and Latin letters, unlike \b which only understands ASCII.
function buildBoundaryRegex(words) {
  const escaped = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${escaped.join("|")})(?![\\p{L}\\p{N}])`, "iu");
}

const FIELD_PATTERNS = {
  price: {
    regex: buildBoundaryRegex(["үнэ", "төлбөр", "хэдэн төгрөг", "price", "pricing", "une", "tulbur"]),
    keys: ["price", "price_note"],
    label: "💰 Үнэ",
  },
  schedule: {
    regex: buildBoundaryRegex([
      "хуваарь", "хэзээ эхэл", "хэзээ болох", "хэзээнээс", "цагийн хуваарь",
      "schedule", "hezee", "hezeenees", "hzenes", "hzee", "ehleh", "ehlene", "eхлэх",
    ]),
    keys: ["schedule", "schedule_note", "duration"],
    label: "🗓 Хуваарь",
  },
  curriculum: {
    regex: buildBoundaryRegex([
      "агуулга", "сэдэв", "хичээлийн төлөвлөгөө", "curriculum", "syllabus", "юу заа", "юу сурга",
    ]),
    keys: ["curriculum_summary", "skills"],
    label: "📚 Агуулга",
  },
  requirements: {
    regex: buildBoundaryRegex([
      "шаардлага", "орох болзол", "requirement", "prerequisite", "урьдчилсан мэдлэг",
    ]),
    keys: ["prerequisites", "requirements"],
    label: "✅ Шаардлага",
  },
  certificate: {
    regex: buildBoundaryRegex(["гэрчилгээ", "сертификат", "certificate", "diploma"]),
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

function matchFieldName(msg) {
  for (const [fieldName, config] of Object.entries(FIELD_PATTERNS)) {
    if (config.regex.test(msg)) return fieldName;
  }
  return null;
}

// Returns a formatted reply string, or null if no detail-word matched, or
// null if a detail-word matched but the program has no data for it.
function detectProgramFieldIntent(msg, program) {
  const fieldName = matchFieldName(msg);
  if (!fieldName) return null;

  const config = FIELD_PATTERNS[fieldName];
  const value = getFirstAvailableField(program, config.keys);
  if (!value) return null;

  console.log("🎯 Matched by: regex-program-field", program.id, fieldName);
  return `${config.label} — ${program.display_label || program.name}\n${value}`;
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

// Every field question ends with "аль нэгийг мэдмээр байна уу?" — if the
// customer answers with a plain "тийм/за/ok" instead of naming a field,
// that means "yes, all of them," not "which one." Give everything.
function formatAllFieldsReply(program) {
  const name = program.display_label || program.name;
  const lines = [`За, тэгвэл ${name} хөтөлбөрийн дэлгэрэнгүй мэдээллийг хүргэе:\n`];

  for (const config of Object.values(FIELD_PATTERNS)) {
    const value = getFirstAvailableField(program, config.keys);
    if (value) lines.push(`✦ ${config.label.replace(/^\S+\s/, "")}: ${value}`);
  }

  lines.push(`\nТа энэ хөтөлбөрт бүртгүүлэх хүсэлтэй байна уу?`);
  return lines.join("\n");
}

function collapseRepeatedLetters(str) {
  return str.replace(/([a-zа-яё])\1+/gi, "$1");
}

const AFFIRMATION_REGEX =
  /^(тийм|тиймээ|тэгье|за тэгье|за|за яахав|болно|за болно|ок|tiim|tiimee|za|bolno|ok|yes)$/i;

function isAffirmation(msg) {
  return AFFIRMATION_REGEX.test(collapseRepeatedLetters(msg.trim()));
}

// The overview ("Үнэ, хуваарь, ... аль нэгийг мэдмээр байна уу?") sets
// session.awaitingFieldChoice. If the very next message is a bare "yes" —
// not a named field, not a new program — answer with everything.
function detectFieldChoiceAffirmationIntent(msg, knowledge, session, detectedPrograms) {
  if (!session?.awaitingFieldChoice) return null;
  if (detectedPrograms && detectedPrograms.length > 0) return null; // new program named — let that branch handle it
  if (!isAffirmation(msg)) return null;

  const program =
    session.selectedProgram && knowledge.programs.find((p) => p.id === session.selectedProgram);
  if (!program) return null;

  console.log("🎯 Matched by: regex-field-choice-affirmation", program.id);
  return {
    reply: formatAllFieldsReply(program),
    sessionPatch: { awaitingFieldChoice: false, awaitingRegistrationConfirmation: true },
  };
}

// If the message clearly names a different audience group (kid/adult/company)
// with no program explicitly named, don't let a stale session.selectedProgram
// hijack it — let it fall through to the group/category branch instead.
function looksLikeGroupRequest(msg) {
  return (
    KID_ANSWER_REGEX.test(msg) ||
    COMPANY_ANSWER_REGEX.test(msg) ||
    ADULT_ANSWER_REGEX.test(msg)
  );
}

function detectExactProgramIntent(msg, knowledge, session, detectedPrograms) {
  const namedNow = detectedPrograms && detectedPrograms.length === 1 ? detectedPrograms[0] : null;

  const canUseStaleSession = !namedNow && !looksLikeGroupRequest(msg);
  const program =
    namedNow ||
    (canUseStaleSession && session?.selectedProgram &&
      knowledge.programs.find((p) => p.id === session.selectedProgram)) ||
    null;

  if (!program) {
    // No program named and none in context. If they clearly asked a detail
    // question anyway ("үнэ хэд вэ?" cold), don't guess and don't burn a
    // Gemini call — ask which program instead.
    const fieldName = matchFieldName(msg);
    if (fieldName) {
      console.log("🎯 Matched by: regex-field-no-program →", fieldName);
      return {
        reply: "Аль хөтөлбөрийн талаар асууж байна вэ?",
        sessionPatch: { pendingFieldQuestion: fieldName },
      };
    }
    return null;
  }

  const fieldReply = detectProgramFieldIntent(msg, program);
  if (fieldReply) {
    return {
      reply: fieldReply,
      sessionPatch: {
        selectedProgram: program.id,
        pendingWhoFor: false,
        pendingFieldQuestion: null,
        awaitingFieldChoice: false,
      },
    };
  }

  // No detail word. Only give the full overview when the program was
  // actually named in THIS message — an unrelated follow-up shouldn't
  // re-dump the overview just because selectedProgram is still set.
  if (!namedNow) return null;

  console.log("🎯 Matched by: regex-program-overview", program.id);
  return {
    reply: formatProgramOverview(program),
    sessionPatch: {
      selectedProgram: program.id,
      pendingWhoFor: false,
      pendingFieldQuestion: null,
      awaitingFieldChoice: true, // the overview ends by asking "which field?" — track it
    },
  };
}

// Answers a pending "аль хөтөлбөрийн талаар асууж байна вэ?" once the user
// names a program in their next message.
function detectPendingFieldAnswerIntent(msg, knowledge, session, detectedPrograms) {
  if (!session?.pendingFieldQuestion) return null;
  if (!detectedPrograms || detectedPrograms.length !== 1) return null;

  const program = detectedPrograms[0];
  const config = FIELD_PATTERNS[session.pendingFieldQuestion];
  if (!config) return null;

  const value = getFirstAvailableField(program, config.keys);
  if (!value) return null;

  console.log("🎯 Matched by: regex-pending-field-answer", program.id, session.pendingFieldQuestion);
  return {
    reply: `${config.label} — ${program.display_label || program.name}\n${value}`,
    sessionPatch: { selectedProgram: program.id, pendingFieldQuestion: null },
  };
}

// --- Intent: vague info request ("мэдээлэл авъя") ---

const VAGUE_REQUEST_REGEX =
  /(мэдээлэл авъя|мэдээлэл өгөөч|хөтөлбөрийн мэдээлэл|программ.*байг|сургалт.*байг|program info|tell me about|what programs|medeelel avii|medeelel uguch|hutulbriin medeel)/i;

function detectVagueRequestIntent(msg, knowledge, hasSpecificProgramMatch) {
  if (hasSpecificProgramMatch) return null;
  if (!VAGUE_REQUEST_REGEX.test(msg)) return null;

  const reply = `Сайн байна уу! 😊 AI Academy-д тавтай морил. Та ямар мэдээлэл сонирхож байна вэ?`;

  return { reply, sessionPatch: { pendingWhoFor: true, awaitingFieldChoice: false } };
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

  return { reply, sessionPatch: { pendingWhoFor: false, awaitingFieldChoice: false } };
}

function detectDirectCategoryIntent(msg, knowledge, hasSpecificProgramMatch) {
  if (hasSpecificProgramMatch) return null;

  let filtered = null;
  if (KID_ANSWER_REGEX.test(msg)) filtered = knowledge.programs.filter(isKidProgram);
  else if (COMPANY_ANSWER_REGEX.test(msg)) filtered = knowledge.programs.filter(isCompanyProgram);
  else if (ADULT_ANSWER_REGEX.test(msg)) filtered = knowledge.programs.filter(isAdultPersonalProgram);

  if (!filtered || filtered.length === 0) return null;

  const reply =
    `Дараах хөтөлбөрүүдийн бүртгэл нээлттэй байна:\n\n` +
    formatProgramList(filtered) +
    `\n\nЭдгээрээс аль хөтөлбөрийн талаар дэлгэрэнгүй мэдээлэл авахыг хүсэж байна вэ?`;

  return { reply, sessionPatch: { pendingWhoFor: false, awaitingFieldChoice: false } };
}

// --- Public entry point ---
// Returns null (no match — fall through to AI) or { reply, sessionPatch }

async function detectIntent(msg, knowledge, session, hasSpecificProgramMatch, detectedPrograms) {
  // 1. Answer to a pending clarifying question takes top priority
  const pendingField = detectPendingFieldAnswerIntent(msg, knowledge, session, detectedPrograms);
  if (pendingField) return pendingField;

  // "Yes" to "which field do you want?" means "all of them," not "which."
  const fieldChoiceAffirmation = detectFieldChoiceAffirmationIntent(msg, knowledge, session, detectedPrograms);
  if (fieldChoiceAffirmation) return fieldChoiceAffirmation;

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
    const h = knowledge.office_hours;
    if (h) {
      console.log("🎯 Matched by: semantic-hours");
      return { reply: formatHoursReply(h), sessionPatch: {} };
    }
  }

  if (semanticIntent === "vague_request") {
    const vague = detectVagueRequestIntent(msg, knowledge, false);
    if (vague) {
      console.log("🎯 Matched by: semantic-vague_request");
      return vague;
    }
  }

  if (semanticIntent === "group_request") {
    const group = detectDirectCategoryIntent(msg, knowledge, false);
    if (group) {
      console.log("🎯 Matched by: semantic-group_request");
      return group;
    }
  }

  if (semanticIntent === "exact_request" && session?.selectedProgram) {
    const program = knowledge.programs.find((p) => p.id === session.selectedProgram);
    if (program) {
      const fieldReply = detectProgramFieldIntent(msg, program);
      if (fieldReply) {
        console.log("🎯 Matched by: semantic-exact_request");
        return { reply: fieldReply, sessionPatch: { selectedProgram: program.id } };
      }
    }
  }

  return null;
}

module.exports = { detectIntent };