// intents/pricing.js

function pricingHandler(text, memory, knowledge) {
  const lang = memory.language === "mn" ? "mn" : "en";
  const msg = text.toLowerCase();
  const programs = knowledge.programs || [];

  const selectedProgram = findProgram(msg, programs);

  if (selectedProgram) {
    memory.currentProgram = selectedProgram.id;

    return lang === "mn"
      ? `${selectedProgram.name.mn} сургалтын төлбөр: ${selectedProgram.price}.
${selectedProgram.price_note?.mn || ""}
Хугацаа: ${selectedProgram.duration.mn}
Хэлбэр: ${selectedProgram.format.mn}

Дэлгэрэнгүй мэдээлэл авах бол ${knowledge.contact.phone} дугаараар холбогдоорой.`
      : `${selectedProgram.name.en} tuition: ${selectedProgram.price}.
${selectedProgram.price_note?.en || ""}
Duration: ${selectedProgram.duration.en}
Format: ${selectedProgram.format.en}

For more details, please contact ${knowledge.contact.phone}.`;
  }

  return lang === "mn"
    ? `Сургалтын төлбөр хөтөлбөрөөс хамаарна. Та аль сургалтын үнийг сонирхож байна вэ?

• ${programs.map(p => p.name.mn).join("\n• ")}`
    : `Tuition depends on the program. Which program are you interested in?

• ${programs.map(p => p.name.en).join("\n• ")}`;
}

function findProgram(msg, programs) {
  if (
    msg.includes("junior") ||
    msg.includes("kids") ||
    msg.includes("child") ||
    msg.includes("huuh") ||
    msg.includes("хүүх") ||
    msg.includes("summer")
  ) {
    return programs.find(p => p.id === "summer_bootcamp");
  }

  if (
    msg.includes("101") ||
    msg.includes("online") ||
    msg.includes("онлайн")
  ) {
    return programs.find(p => p.id === "ai_101_online");
  }

  if (
    msg.includes("engineer") ||
    msg.includes("инженер") ||
    msg.includes("adult") ||
    msg.includes("насанд")
  ) {
    return programs.find(p => p.id === "ai_engineer");
  }

  if (
    msg.includes("company") ||
    msg.includes("corporate") ||
    msg.includes("business") ||
    msg.includes("байгуул") ||
    msg.includes("компани")
  ) {
    return programs.find(p => p.id === "corporate_leaders");
  }

  return null;
}

module.exports = pricingHandler;