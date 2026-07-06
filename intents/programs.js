// intents/programs.js

function programsHandler(memory, knowledge) {
  const academyPrograms = knowledge.academy?.programs || [];

  if (memory.language === "mn") {
    return `AI Academy Asia дараах үндсэн хөтөлбөрүүдтэй:

${academyPrograms.map(p => `• ${p.name} — ${p.age_range}: ${p.focus}`).join("\n")}

Та өөртөө, хүүхэддээ, эсвэл байгууллагадаа сургалт хайж байна уу?`;
  }

  return `AI Academy Asia offers these main programs:

${academyPrograms.map(p => `• ${p.name} — ${p.age_range}: ${p.focus}`).join("\n")}

Are you looking for a course for yourself, your child, or your company?`;
}

module.exports = programsHandler;