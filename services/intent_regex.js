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

// Whether they ask location or hours, give both — someone asking one
// almost always needs the other too if they're planning to visit.
function formatLocationAndHoursReply(knowledge) {
  const locationLine = `📍 ${knowledge.location}`;
  const h = knowledge.office_hours;
  if (!h) return locationLine;
  return `${locationLine}\n\n${formatHoursReply(h)}`;
}

// --- Intent: location / office hours (static facts) ---

// Widened with bair\s*h[ae]n? / bair\s*haa to catch "bair han ve" / "bair haa"
// style typos that were previously missing regex and falling to semantic,
// where they sometimes lost the scoring race to an unrelated intent.
const LOCATION_REGEX =
  /(байршил|хаяг|хаана байр|хаана орш|та нар хаана|энэ хаана|bairsh|bayrsh|brshil|brshl|hayg|hayag|hayig|haan[a]?\s*bai|haana\s*bai|hana\s*bai|haanve|haan\s*bdg|hana\s*bdg|address|location|where.*(you|located)|where\s+is|bair\s*h[ae]n?|bair\s*haa)/i;

const HOURS_TIME_WORD = /(tsag|цаг)/i;
const HOURS_CONTEXT_WORD =
  /(huviar|huvira|huvari|huvaari|хуваарь|ажиллах|ажлын|ajillah|ajlin|ajliin|hed(ees)?|hze|hz|хэд|open|hours|walk\s*in|ирж бол|irj\s*bol)/i;

function isHoursQuestion(msg) {
  return HOURS_TIME_WORD.test(msg) && HOURS_CONTEXT_WORD.test(msg);
}

function detectStaticFactIntent(msg, knowledge) {
  if (LOCATION_REGEX.test(msg)) {
    console.log("🎯 Matched by: regex-location");
    return formatLocationAndHoursReply(knowledge);
  }

  if (isHoursQuestion(msg)) {
    console.log("🎯 Matched by: regex-hours");
    return formatLocationAndHoursReply(knowledge);
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

// requirements/certificate intentionally NOT included here — no reliable
// data behind them in the knowledge base. REMOVED_FIELD_REGEX below still
// detects when these are asked so we can route to Gemini instead of
// silently reshowing the program overview.
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
};

// Detects requirements/certificate questions even though we don't answer
// them via regex — used to route straight to Gemini instead of falling
// through to formatProgramOverview (which looked like the bot ignored
// the question).
const REMOVED_FIELD_REGEX = buildBoundaryRegex([
  "шаардлага", "орох болзол", "requirement", "prerequisite", "урьдчилсан мэдлэг",
  "гэрчилгээ", "сертификат", "certificate", "diploma",
]);

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

// Reply format standardized to match formatProgramOverview's style
// (emoji + uppercase name header) across price/schedule/curriculum.
function detectProgramFieldIntent(msg, program) {
  const fieldName = matchFieldName(msg);
  if (!fieldName) return null;

  const config = FIELD_PATTERNS[fieldName];
  const value = getFirstAvailableField(program, config.keys);
  if (!value) return null;

  const emoji = PROGRAM_EMOJI[program.id] || "✦";
  const name = program.display_label || program.name;

  console.log("🎯 Matched by: regex-program-field", program.id, fieldName);
  return `${emoji} ${name.toUpperCase()}\n\n${config.label}: ${value}`;
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
  /^(за\s+|za\s+)?(тийм|тиймээ|тэгье|яахав|болно|ок|tiim|tiimee|za|bolno|ok|yes|tegi[a-z]{0,3})$/i;

function isAffirmation(msg) {
  return AFFIRMATION_REGEX.test(collapseRepeatedLetters(msg.trim()));
}

function detectFieldChoiceAffirmationIntent(msg, knowledge, session, detectedPrograms) {
  if (!session?.awaitingFieldChoice) return null;
  if (detectedPrograms && detectedPrograms.length > 0) return null;
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

// --- Audience-group regexes ---
const KID_ANSWER_REGEX = /(хүүхэд|хүүхдэдээ|huuhed|huuhedde|huhed|10.?18|өсвөр|kid|child)/i;
const COMPANY_ANSWER_REGEX = /(байгууллага|компани|compand|company|corporate)/i;
const EXPLICIT_ADULT_REGEX = /(насанд хүрэгч|nasand huregch|18\+|over 18)/i;
// u+rtu+ tolerates letter-order/doubling typo variants (uurtu, urtuu, uurtuu)
// instead of one fixed spelling.
const SELF_REFERENCE_REGEX = /(өөртөө|u+rtu+|намайг|би өөрөө|myself|for me)/i;
const AGE_NUMBER_REGEX = /(\d{1,2})\s*(nas|настай|nastai)/i;

function extractAge(msg) {
  const match = msg.match(AGE_NUMBER_REGEX);
  return match ? Number(match[1]) : null;
}

function programListReply(filtered) {
  return (
    formatProgramList(filtered) +
    `\n\nЭдгээрээс аль хөтөлбөрийн талаар дэлгэрэнгүй мэдээлэл авахыг хүсэж байна вэ?`
  );
}

// If there's only one program in the filtered set, there's nothing to choose
// between — go straight to its overview instead of asking "which one?" again.
function respondWithFilteredPrograms(filtered) {
  if (filtered.length === 1) {
    const program = filtered[0];
    return {
      reply: formatProgramOverview(program),
      sessionPatch: { selectedProgram: program.id, pendingWhoFor: false, awaitingFieldChoice: true },
    };
  }
  return { reply: programListReply(filtered), sessionPatch: { pendingWhoFor: false, awaitingFieldChoice: false } };
}

function looksLikeGroupRequest(msg) {
  return (
    KID_ANSWER_REGEX.test(msg) ||
    COMPANY_ANSWER_REGEX.test(msg) ||
    EXPLICIT_ADULT_REGEX.test(msg) ||
    SELF_REFERENCE_REGEX.test(msg)
  );
}

// Reused for typo-tolerant matching (audience fuzzy detection below).
function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

// Root words per audience group, checked against each token in the message
// within edit distance 2 — catches typos KID_ANSWER_REGEX etc. miss outright.
// Only used as a fallback inside the semantic group_request branch.
const AUDIENCE_FUZZY_ROOTS = {
  kid: ["хүүхэд", "хүүхдэдээ", "huuhed", "huuhedde", "huhed", "huhduuded"],
  company: ["байгууллага", "компани", "company", "corporate"],
  adult: ["насанд", "nasand", "huregch"],
};

function fuzzyDetectAudience(msg) {
  const tokens = msg.split(" ").filter((t) => t.length >= 4);
  for (const [group, roots] of Object.entries(AUDIENCE_FUZZY_ROOTS)) {
    for (const token of tokens) {
      for (const root of roots) {
        if (levenshtein(token, root) <= 2) return group;
      }
    }
  }
  return null;
}

function detectAgeClarificationAnswerIntent(msg, knowledge, session) {
  if (!session?.pendingAgeClarification) return null;

  const age = extractAge(msg);
  let filtered = null;

  if (age !== null) {
    filtered = age < 18
      ? knowledge.programs.filter(isKidProgram)
      : knowledge.programs.filter(isAdultPersonalProgram);
  } else if (KID_ANSWER_REGEX.test(msg)) {
    filtered = knowledge.programs.filter(isKidProgram);
  } else if (EXPLICIT_ADULT_REGEX.test(msg)) {
    filtered = knowledge.programs.filter(isAdultPersonalProgram);
  } else {
    return null;
  }

  console.log("🎯 Matched by: regex-age-clarification-answer");
  const result = respondWithFilteredPrograms(filtered);
  return { ...result, sessionPatch: { ...result.sessionPatch, pendingAgeClarification: false } };
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
    const fieldName = matchFieldName(msg);
    if (fieldName) {
      console.log("🎯 Matched by: regex-field-no-program →", fieldName);
      return {
        reply: "Аль хөтөлбөрийн талаар асууж байна вэ?",
        sessionPatch: { pendingFieldQuestion: fieldName },
      };
    }
    if (REMOVED_FIELD_REGEX.test(msg)) {
      console.log("🎯 Skipping regex — requirements/certificate question, no program in context, routing to Gemini");
      return null;
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

  // Asked specifically about requirements/certificate — no regex data for
  // these by design. Don't reshow the overview; let Gemini answer instead.
  if (REMOVED_FIELD_REGEX.test(msg)) {
    console.log("🎯 Skipping regex — requirements/certificate question, routing to Gemini:", program.id);
    return null;
  }

  if (!namedNow) return null;

  console.log("🎯 Matched by: regex-program-overview", program.id);
  return {
    reply: formatProgramOverview(program),
    sessionPatch: {
      selectedProgram: program.id,
      pendingWhoFor: false,
      pendingFieldQuestion: null,
      awaitingFieldChoice: true,
    },
  };
}

// Reply format standardized to match the field-question format used elsewhere.
function detectPendingFieldAnswerIntent(msg, knowledge, session, detectedPrograms) {
  if (!session?.pendingFieldQuestion) return null;
  if (!detectedPrograms || detectedPrograms.length !== 1) return null;

  const program = detectedPrograms[0];
  const config = FIELD_PATTERNS[session.pendingFieldQuestion];
  if (!config) return null;

  const value = getFirstAvailableField(program, config.keys);
  if (!value) return null;

  const emoji = PROGRAM_EMOJI[program.id] || "✦";
  const name = program.display_label || program.name;

  console.log("🎯 Matched by: regex-pending-field-answer", program.id, session.pendingFieldQuestion);
  return {
    reply: `${emoji} ${name.toUpperCase()}\n\n${config.label}: ${value}`,
    sessionPatch: { selectedProgram: program.id, pendingFieldQuestion: null },
  };
}

// --- Intent: vague info request ("мэдээлэл авъя") ---

const VAGUE_REQUEST_REGEX =
  /(мэдээлэл авъя|мэдээлэл өгөөч|хөтөлбөрийн мэдээлэл|программ.*байг|сургалт.*байг|program info|tell me about|what programs|medeelel avii|medeelel uguch|hutulbriin medeel|surgaltuud|sonirhii)/i;

function buildVagueRequestReply(knowledge) {
  const reply =
    `Сайн байна уу! 😊 AI Academy-д тавтай морил. Одоогоор бүртгэл нээлттэй байгаа сургалтууд:\n\n` +
    formatProgramList(knowledge.programs) +
    `\n\nТа хэнд зориулж сургалт хайж байна вэ? (өөртөө / хүүхдэдээ / байгууллагадаа)`;
  return { reply, sessionPatch: { pendingWhoFor: true, awaitingFieldChoice: false } };
}

function detectVagueRequestIntent(msg, knowledge, hasSpecificProgramMatch) {
  if (hasSpecificProgramMatch) return null;
  if (!VAGUE_REQUEST_REGEX.test(msg)) return null;
  return buildVagueRequestReply(knowledge);
}

// --- Intent: answering "who is this for?" / group requests ---

function detectWhoForAnswerIntent(msg, knowledge, session) {
  if (!session?.pendingWhoFor) return null;

  if (KID_ANSWER_REGEX.test(msg)) {
    const filtered = knowledge.programs.filter(isKidProgram);
    console.log("🎯 Matched by: regex-who-for-kid");
    return respondWithFilteredPrograms(filtered);
  }
  if (COMPANY_ANSWER_REGEX.test(msg)) {
    const filtered = knowledge.programs.filter(isCompanyProgram);
    console.log("🎯 Matched by: regex-who-for-company");
    return respondWithFilteredPrograms(filtered);
  }
  if (EXPLICIT_ADULT_REGEX.test(msg)) {
    const filtered = knowledge.programs.filter(isAdultPersonalProgram);
    console.log("🎯 Matched by: regex-who-for-explicit-adult");
    return respondWithFilteredPrograms(filtered);
  }
  if (SELF_REFERENCE_REGEX.test(msg)) {
    console.log("🎯 Matched by: regex-who-for-self-reference → asking age");
    return {
      reply: "Танд тохирох хөтөлбөрийг санал болгохын тулд асуумаар байна — та хэдэн настай вэ? (10–18 насныханд зориулсан тусдаа хөтөлбөр бас бий.)",
      sessionPatch: { pendingWhoFor: false, pendingAgeClarification: true },
    };
  }
  return null;
}

function detectDirectCategoryIntent(msg, knowledge, hasSpecificProgramMatch) {
  if (hasSpecificProgramMatch) return null;

  if (KID_ANSWER_REGEX.test(msg)) {
    const filtered = knowledge.programs.filter(isKidProgram);
    console.log("🎯 Matched by: regex-direct-category-kid");
    return respondWithFilteredPrograms(filtered);
  }
  if (COMPANY_ANSWER_REGEX.test(msg)) {
    const filtered = knowledge.programs.filter(isCompanyProgram);
    console.log("🎯 Matched by: regex-direct-category-company");
    return respondWithFilteredPrograms(filtered);
  }
  if (EXPLICIT_ADULT_REGEX.test(msg)) {
    const filtered = knowledge.programs.filter(isAdultPersonalProgram);
    console.log("🎯 Matched by: regex-direct-category-explicit-adult");
    return respondWithFilteredPrograms(filtered);
  }
  if (SELF_REFERENCE_REGEX.test(msg)) {
    console.log("🎯 Matched by: regex-direct-category-self-reference → asking age");
    return {
      reply: "Танд тохирох хөтөлбөрийг санал болгохын тулд асуумаар байна — та хэдэн настай вэ? (10–18 насныханд зориулсан тусдаа хөтөлбөр бас бий.)",
      sessionPatch: { pendingWhoFor: false, pendingAgeClarification: true },
    };
  }
  return null;
}

// --- Public entry point ---
// Returns null (no match — fall through to AI) or { reply, sessionPatch }

async function detectIntent(msg, knowledge, session, hasSpecificProgramMatch, detectedPrograms) {
  // Knowledge base failed to load (DB timeout etc). Don't let downstream
  // branches run on an empty programs array and produce broken replies —
  // bail to Gemini. (Also hardened in knowledge.js itself.)
  if (!knowledge?.programs || knowledge.programs.length === 0) {
    console.log("🎯 Skipping regex/semantic — knowledge base unavailable, routing to Gemini");
    return null;
  }

  // Multiple programs named in one message = comparison/reasoning territory.
  // No regex or semantic branch should touch this — send straight to Gemini.
  if (detectedPrograms && detectedPrograms.length > 1) {
    console.log("🎯 Skipping regex/semantic — multi-program message, routing to Gemini:",
      detectedPrograms.map((p) => p.id));
    return null;
  }

  const pendingField = detectPendingFieldAnswerIntent(msg, knowledge, session, detectedPrograms);
  if (pendingField) return pendingField;

  const ageClarification = detectAgeClarificationAnswerIntent(msg, knowledge, session);
  if (ageClarification) return ageClarification;

  const fieldChoiceAffirmation = detectFieldChoiceAffirmationIntent(msg, knowledge, session, detectedPrograms);
  if (fieldChoiceAffirmation) return fieldChoiceAffirmation;

  const whoForAnswer = detectWhoForAnswerIntent(msg, knowledge, session);
  if (whoForAnswer) return whoForAnswer;

  const staticFact = detectStaticFactIntent(msg, knowledge);
  if (staticFact) return { reply: staticFact, sessionPatch: {} };

  const exactProgram = detectExactProgramIntent(msg, knowledge, session, detectedPrograms);
  if (exactProgram) return exactProgram;

  const directCategory = detectDirectCategoryIntent(msg, knowledge, hasSpecificProgramMatch);
  if (directCategory) return directCategory;

  const vagueRequest = detectVagueRequestIntent(msg, knowledge, hasSpecificProgramMatch);
  if (vagueRequest) return vagueRequest;

  const semanticIntent = await classifySemanticIntent(msg);

  if (semanticIntent === "location") {
    console.log("🎯 Matched by: semantic-location");
    return { reply: formatLocationAndHoursReply(knowledge), sessionPatch: {} };
  }

  if (semanticIntent === "hours") {
    console.log("🎯 Matched by: semantic-hours");
    return { reply: formatLocationAndHoursReply(knowledge), sessionPatch: {} };
  }

  if (semanticIntent === "vague_request") {
    console.log("🎯 Matched by: semantic-vague_request");
    return buildVagueRequestReply(knowledge);
  }

  if (semanticIntent === "group_request") {
    const fuzzyGroup = fuzzyDetectAudience(msg);

    if (fuzzyGroup === "kid") {
      console.log("🎯 Matched by: semantic-group_request + fuzzy-kid");
      return respondWithFilteredPrograms(knowledge.programs.filter(isKidProgram));
    }
    if (fuzzyGroup === "company") {
      console.log("🎯 Matched by: semantic-group_request + fuzzy-company");
      return respondWithFilteredPrograms(knowledge.programs.filter(isCompanyProgram));
    }
    if (fuzzyGroup === "adult") {
      console.log("🎯 Matched by: semantic-group_request + fuzzy-adult");
      return respondWithFilteredPrograms(knowledge.programs.filter(isAdultPersonalProgram));
    }

    console.log("🎯 Matched by: semantic-group_request → showing full list");
    return buildVagueRequestReply(knowledge);
  }

  if (semanticIntent === "exact_request" && session?.selectedProgram) {
    const program = knowledge.programs.find((p) => p.id === session.selectedProgram);
    if (program) {
      console.log("🎯 Matched by: semantic-exact_request (clarify)");
      return {
        reply: `Үнэ, хуваарь, агуулга, шаардлага, сертификатын аль нэгийг дэлгэрэнгүй мэдмээр байна уу?`,
        sessionPatch: { awaitingFieldChoice: true },
      };
    }
  }

  return null;
}

module.exports = { detectIntent };