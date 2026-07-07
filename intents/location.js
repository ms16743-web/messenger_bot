function locationHandler(memory, knowledge) {
  const lang = memory.language === "mn" ? "mn" : "en";
  const location = knowledge.location?.[lang] || "ITC Tower, 11th floor";

  if (lang === "mn") {
    return `${location}. Дэлгэрэнгүй мэдээлэл авах бол ${knowledge.contact.phone} дугаараар холбогдоорой.`;
  }

  return `${location}. For more details, please contact ${knowledge.contact.phone}.`;
}

module.exports = locationHandler;