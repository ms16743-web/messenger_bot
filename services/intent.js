function programsHandler(memory, knowledge, text = "") {
  const lang = memory.language === "mn" ? "mn" : "en";
  const programs = knowledge.programs || [];
  const msg = text.toLowerCase();

  const selectedProgram = findProgram(msg, programs);

  // If customer chose a specific program
  if (selectedProgram) {
    memory.currentProgram = selectedProgram.id;

    return lang === "mn"
      ? `${selectedProgram.name.mn}

${selectedProgram.description.mn}

Хугацаа: ${selectedProgram.duration.mn}
Хуваарь: ${selectedProgram.schedule.mn}
Хэлбэр: ${selectedProgram.format.mn}

Төлбөрийн мэдээлэл авах уу?`
      : `${selectedProgram.name.en}

${selectedProgram.description.en}

Duration: ${selectedProgram.duration.en}
Schedule: ${selectedProgram.schedule.en}
Format: ${selectedProgram.format.en}

Would you like pricing information?`;
  }

  // First general program info = brief only
  return lang === "mn"
    ? `AI Academy Asia дараах сургалтуудтай:

• ${programs.map(p => p.name.mn).join("\n• ")}

Та аль сургалтын талаар дэлгэрэнгүй мэдээлэл авах вэ?`
    : `AI Academy Asia offers these programs:

• ${programs.map(p => p.name.en).join("\n• ")}

Which program would you like to know more about?`;
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

module.exports = programsHandler;