function programsHandler(memory, knowledge) {
  const lang = memory.language === "mn" ? "mn" : "en";
  const programs = knowledge.programs || [];

  if (lang === "mn") {
    return `AI Academy Asia дараах сургалтуудыг санал болгож байна:

${programs
  .map(
    p => `• ${p.name.mn}
  Нас: ${p.age_range.mn}
  ${p.description.mn}`
  )
  .join("\n\n")}

Та аль сургалтын талаар илүү дэлгэрэнгүй мэдээлэл авахыг хүсэж байна вэ?`;
  }

  return `AI Academy Asia offers the following programs:

${programs
  .map(
    p => `• ${p.name.en}
  Age: ${p.age_range.en}
  ${p.description.en}`
  )
  .join("\n\n")}

Which program would you like to learn more about?`;
}

module.exports = programsHandler;