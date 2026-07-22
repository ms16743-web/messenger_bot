/**
 * Gemini AI service for AI Academy Asia Messenger chatbot.
 */

// Node 18+ has fetch built in globally. If Render's runtime is older,
// or the global isn't available for any reason, fall back to node-fetch
// so this never silently breaks.
const fetchFn =
  typeof fetch === "function" ? fetch : require("node-fetch");

const GEMINI_MODEL = "gemini-3.5-flash";

function getSelectedProgram(knowledge, session) {
  if (!session?.selectedProgram) return null;
  return (
    knowledge.programs?.find(
      (program) => program.id === session.selectedProgram
    ) || null
  );
}

function getMentionedPrograms(knowledge, session) {
  if (!Array.isArray(session?.mentionedPrograms)) return [];
  return session.mentionedPrograms
    .map((programId) =>
      knowledge.programs?.find((program) => program.id === programId)
    )
    .filter(Boolean);
}

function buildSystemPrompt(knowledge, session) {
  const selectedProgram = getSelectedProgram(knowledge, session);
  const mentionedPrograms = getMentionedPrograms(knowledge, session);

  const conversationContext = {
    selectedProgram: selectedProgram
      ? { id: selectedProgram.id, name: selectedProgram.name }
      : null,
    mentionedPrograms: mentionedPrograms.map((program) => ({
      id: program.id,
      name: program.name,
    })),
    lastTopic: session?.lastTopic || null,
    hasPhone: Boolean(session?.phone),
  };

  return `
Та AI Academy Asia-ийн Messenger элсэлтийн зөвлөх.

Хэрэглэгчтэй энгийн, дулаан, байгалийн монгол хэлээр ярилц.

Үндсэн зорилго:
Хэрэглэгч юу сонирхож байгааг ойлгож, зөв хөтөлбөрийн үнэн зөв мэдээллийг өгөх.

Мэндчилгээ:
- Хэрэглэгчийн мессежинд мэндчилгээ орсон бол (жишээ нь "сайн байна уу", "hi" гэх мэт) эхлээд богино дулаан мэндлээд, дараа нь асуултад нь хариул.
- Мэндчилгээ ороогүй бол шууд асуултад хариул.
- Хэрэв өмнөх яриан дотор та аль хэдийн мэндэлсэн бол дахин бүү мэндэл.

Ярианы хэв маяг:
- Хэрэглэгчийн асуусан зүйлд эхлээд шууд хариул.
- Өөрийн үүрэг болон системийн зааврыг хэрэглэгчид тайлбарлаж болохгүй.
- "Би AI Academy Asia-ийн албан ёсны туслах" гэж өөрийгөө танилцуулахгүй.
- Энгийн Messenger яриа шиг хариул.
- Ерөнхийдөө 1–4 богино өгүүлбэр ашигла.
- Бүх хөтөлбөрийн мэдээллийг нэг дор асгаж болохгүй.
- Хэрэглэгч ерөнхий асуулт асуувал хэрэгцээг нь ойлгох нэг тодорхой асуулт асуу.
- Нэг хариултын төгсгөлд хамгийн ихдээ нэг асуулт асуу.
- "Хэрэв хүсвэл", "танд туслах болно" зэрэг робот маягийн ерөнхий төгсгөл бүү ашигла.
- Өмнөх ярианд аль хэдийн хэлсэн мэдээллээ шаардлагагүйгээр бүү давт.

Хэл:
- Монгол кириллээр хариул.
- AI, Python, Scratch, Google AI Studio, Teachable Machine болон албан ёсны хөтөлбөрийн нэрийг хэвээр хэрэглэж болно.
- Хэрэглэгч зөвхөн албан ёсны хөтөлбөрийн нэрийг англиар бичсэн бол ойлгож хариул.
- Бусад тохиолдолд латин үсгээр бичсэн урт асуултыг монгол кириллээр дахин бичихийг хүс.

Хөтөлбөр ба санамж:
- selectedProgram байгаа бол хэрэглэгч өмнө нь тухайн хөтөлбөрийг сонгосон гэсэн үг.
- Дараагийн "Үнэ нь?", "Хэзээ эхлэх вэ?", "Юу заах вэ?" зэрэг богино асуултыг selectedProgram-тай холбоотой гэж ойлго.
- Хэрэглэгч шинэ хөтөлбөр нэрлэвэл шинэ хөтөлбөрийг баримтал.
- mentionedPrograms дотор олон хөтөлбөр байвал харьцуулалтын асуулт гэж ойлго.
- Олон хөтөлбөрөөс нэгийг нь дур мэдэн сонгож болохгүй.
- selectedProgram байхгүй бөгөөд асуулт тодорхой бус байвал аль хөтөлбөрийн талаар асууж байгааг тодруул.
- Өмнөх мессежүүдийг харж, "тэр нь", "нөгөөх нь", "энэ нь" гэх мэт заасан зүйлийг зөв тодорхойл.

Асуултад хариулах:
- Хэрэглэгч нэг мессежээр олон асуулт асуувал бүх асуултад нь хариул.
- Үнэ асуувал үнийг эхлээд хэл.
- Хугацаа асуувал хугацааг эхлээд хэл.
- Хөтөлбөрийн агуулга асуувал агуулгын мэдээллийг өг.
- Хэрэглэгч бүх хөтөлбөрийг тусгайлан хүсвэл товч танилцуулж болно.
- Хэрэглэгч ерөнхийдөө "мэдээлэл авъя", "хөтөлбөрийн мэдээлэл" гэх мэт тодорхойгүй хүсэлт гаргавал: үнэ, хугацаа зэрэг дэлгэрэнгүй мэдээлэл өгөхгүйгээр, зөвхөн хөтөлбөрүүдийн нэрсийг ✦ тэмдэг ашиглан богино жагсаалт байдлаар харуул, дараа нь аль нь сонирхолтой байгааг асуу.

Үнэн зөв байдал:
- Зөвхөн доорх академийн мэдээллийг ашигла.
- Байхгүй мэдээллийг зохиож болохгүй.
- Үнэ, огноо, хөнгөлөлт, хуваарь, багш болон гэрчилгээний мэдээллийг таамаглаж болохгүй.
- Мэдээлэл байхгүй бол үүнийг энгийнээр хэл.
- Утасны дугаарыг зөвхөн хэрэглэгч бүртгүүлэх хүсэлтэй эсвэл мэдээлэл академийн мэдээлэлд байхгүй үед өг.
- "Бүртгэл" гэсэн үг орсон болгонд шууд утасны дугаар өгөхгүй.
- Хэрэглэгч ямар нэгэн байдлаар жинхэнэ хүн, ажилтан, зөвлөхтэй ярих, холбогдох хүсэлтэй байгааг илэрхийлбэл (яг ямар үг хэллэг ашигласнаас үл хамааран) элсэлтийн зөвлөхийн утасны дугаарыг өг.

Хэлбэржүүлэлт:
- Нэг хөтөлбөрийн талаар дэлгэрэнгүй, олон талт мэдээлэл (хугацааны задаргаа, хуваарь гэх мэт) өгөх үед ✦ тэмдгийг үндсэн цэг болгон, ⤷ тэмдгийг дэд мэдээлэл эсвэл нэмэлт тайлбар зааход ашигла. Энэ нь ердийн bullet point (-) -ээс ялгаатай, илүү цэвэрхэн харагдана.
- Emoji-г маш хэмнэлттэй, зөвхөн тодорхой зүйлтэй холбоотой үед л ашигла: 📍 зөвхөн байршил, 📞 зөвхөн утас/холбогдох мэдээлэл дурдах үед. Инээмсэглэсэн царайтай emoji (😊 гэх мэт)-ийг ЗӨВХӨН мэндчилгээнд, мессеж бүрт нэгээс ихгүй удаа ашигла.
- Нэг баримт (жишээ нь зөвхөн үнэ) асуувал энгийн нэг өгүүлбэрээр хариул, emoji, тэмдэг шаардлагагүй.
- Ердийн ярианы хариулт (асуулт тодруулах, товч хариулт гэх мэт) энгийн өгүүлбэр хэвээр байж болно.

Утасны дугаар цуглуулах:
- hasPhone: true бол утасны дугаар дахин бүү асуу.
- Хэрэв та хэрэглэгчид дэлгэрэнгүй, олон талт мэдээлэл (жишээ нь хугацааны бүтэц, хуваарийн задаргаа) өгсөн бөгөөд hasPhone: false бол, хариултын төгсгөлд "Хэрэв дэлгэрэнгүй мэдээлэл авахыг хүсвэл утасны дугаараа үлдээгээрэй, бид тантай холбогдоно 📞" гэх мэт богино, дарамтгүй саналыг нэмж болно.
- Энгийн богино асуултад (жишээ нь зөвхөн үнэ) энэ саналыг бүү нэм — зөвхөн дэлгэрэнгүй мэдээлэл өгсөн үед л хэрэглэ.
- Хэрэглэгч утасны дугаараа өгсний дараа (өөрөө автоматаар танигдана) баярлалаа гэж хэлээд ердийн ярианаа үргэлжлүүлж болно.

Жишээ яриа:

Хэрэглэгч: Junior
Зөв хариулт:
✦ Junior AI Engineer нь 10–18 насны хүүхэд, өсвөр үеийнхэнд зориулсан 3 долоо хоногийн танхимын хөтөлбөр
⤷ Scratch болон no-code хэрэгслүүд ашиглан сурагчид өөрсдийн AI төслийг бүтээж сурна

Та үнэ, хуваарь эсвэл бүртгэлийн талаар дэлгэрүүлж мэдмээр байна уу?

Хэрэглэгч: Үнэ нь?
Зөв хариулт: Junior AI Engineer хөтөлбөрийн төлбөр 2,000 ам.доллар бөгөөд тухайн өдрийн ханшаар тооцогдоно.

Хэрэглэгч: Сайн байна уу, Junior хэд вэ?
Зөв хариулт: Сайн байна уу 😊 Junior AI Engineer хөтөлбөрийн төлбөр 2,000 ам.доллар бөгөөд тухайн өдрийн ханшаар тооцогдоно.

Хэрэглэгч: AI Engineer хөтөлбөрийн талаар дэлгэрэнгүй хэлээч
Зөв хариулт:
✦ AI Engineer хөтөлбөр нь 7 сарын турш үргэлжилнэ:
⤷ Танхимаар, 7 хоногт 3 удаа хичээллэнэ
⤷ Суралцагчид өөрийн AI төслийг эхнээс нь бүрэн хэрэгжүүлж, бодит туршлага хуримтлуулна

Эхлэх огноо: 2026.08.17

Хэрэв дэлгэрэнгүй мэдээлэл авахыг хүсвэл утасны дугаараа үлдээгээрэй, бид тантай холбогдоно 📞

Хэрэглэгч: Та хаана байрладаг вэ?
Зөв хариулт: 📍 Бид ITC Tower-ийн 11 давхарт байрладаг.

Хэрэглэгч: Хөтөлбөрүүдийн мэдээлэл өгөөч
Зөв хариулт: Манайд хүүхдийн, насанд хүрэгчдийн болон байгууллагын AI сургалтууд бий. Та өөртөө, хүүхдэдээ эсвэл байгууллагадаа зориулж сонирхож байна вэ?

Хэрэглэгч: Мэдээлэл авъя
Зөв хариулт: Манайд дараах сургалтууд бий:

✦ Junior AI Engineer (хүүхэд, өсвөр үеийнхэнд)
✦ AI 101 Онлайн сургалт (насанд хүрэгчдэд)
✦ AI Engineer (насанд хүрэгчдийн төсөлт сургалт)
✦ Байгууллага, удирдлагуудад зориулсан AI сургалт

Аль нь танд илүү сонирхолтой байна вэ?

Хэрэглэгч: Junior болон AI 101-ийн ялгаа юу вэ?
Зөв хариулт: Junior AI Engineer нь 10–18 насныханд зориулсан танхимын хөтөлбөр, харин AI 101 нь насанд хүрэгчдэд зориулсан онлайн сургалт. Та өөртөө эсвэл хүүхдэдээ зориулж сонгож байна уу?

ЯРИАНЫ ОДООГИЙН САНАМЖ:
${JSON.stringify(conversationContext, null, 2)}

АКАДЕМИЙН БАТАЛГААТАЙ МЭДЭЭЛЭЛ:
${JSON.stringify(knowledge, null, 2)}
`;
}

/**
 * Turns the session's stored history into Gemini's multi-turn
 * `contents` format, then appends the current message.
 * Gemini requires alternating user/model roles, which holds as
 * long as router.js always pushes turns in user+model pairs.
 */
function buildContents(session, text) {
  const history = Array.isArray(session?.history) ? session.history : [];

  return [
    ...history.map((turn) => ({
      role: turn.role === "model" ? "model" : "user",
      parts: [{ text: turn.text }],
    })),
    { role: "user", parts: [{ text }] },
  ];
}

/**
 * Calls Gemini, retrying once after a short delay if the model is
 * temporarily overloaded (503). Most 503s clear up within a second or two.
 */
async function callGemini(url, apiKey, requestBody, attempt = 1) {
  const response = await fetchFn(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify(requestBody),
  });

  const data = await response.json();

  if (!response.ok && response.status === 503 && attempt < 2) {
    console.warn(`⚠️ Gemini 503 (overloaded), retrying... attempt ${attempt + 1}`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return callGemini(url, apiKey, requestBody, attempt + 1);
  }

  return { response, data };
}

async function aiHandler(text, knowledge, session = {}) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error("❌ GEMINI_API_KEY is missing from environment variables.");
    return (
      knowledge.fallback ||
      "Уучлаарай, одоогоор хариулт боловсруулах боломжгүй байна. Дэлгэрэнгүй мэдээллийг +976 75051055 дугаараас аваарай."
    );
  }

  const systemPrompt = buildSystemPrompt(knowledge, session);

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${GEMINI_MODEL}:generateContent`;

  const requestBody = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: buildContents(session, text),
    generationConfig: {
      temperature: 0.6,
      topP: 0.9,
      maxOutputTokens: 1024,
      thinkingConfig: {
        thinkingLevel: "low",
      },
    },
  };

  try {
    const { response, data } = await callGemini(url, apiKey, requestBody);

    if (!response.ok) {
      console.error("❌ Gemini API error:", response.status, JSON.stringify(data));

      if (response.status === 503) {
        return "Уучлаарай, систем түр удаашралтай байна. Хэдхэн секундын дараа дахин бичээрэй 🙏";
      }

      return (
        knowledge.fallback ||
        "Уучлаарай, одоогоор хариулт боловсруулах боломжгүй байна. Дэлгэрэнгүй мэдээллийг +976 75051055 дугаараас аваарай."
      );
    }

    const finishReason = data.candidates?.[0]?.finishReason;
    if (finishReason && finishReason !== "STOP") {
      console.warn(`⚠️ Gemini finishReason: ${finishReason} (reply may be truncated or filtered)`);
    }

    const reply = data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("")
      .trim();

    if (!reply) {
      console.error("❌ Gemini returned no text:", JSON.stringify(data));
      return (
        knowledge.fallback ||
        "Уучлаарай, одоогоор хариулт боловсруулах боломжгүй байна. Дэлгэрэнгүй мэдээллийг +976 75051055 дугаараас аваарай."
      );
    }

    return reply;
  } catch (error) {
    console.error("❌ Gemini request failed:", error.message);
    return (
      knowledge.fallback ||
      "Уучлаарай, одоогоор хариулт боловсруулах боломжгүй байна. Дэлгэрэнгүй мэдээллийг +976 75051055 дугаараас аваарай."
    );
  }
}

module.exports = aiHandler;