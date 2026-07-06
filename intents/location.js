// intents/location.js

function locationHandler(memory, knowledge) {
  const location = knowledge.location || {};
  const contacts = knowledge.contacts || {};

  if (memory.language === "mn") {
    return `AI Academy Asia Монголд байрладаг.

Одоогоор яг дэлгэрэнгүй хаягийг knowledge base-д бүрэн оруулаагүй байна.

Илүү тодорхой хаяг авах бол:
📞 ${contacts.phone || location.phone || "+976 75051055"}`;
  }

  return `AI Academy Asia is located in Mongolia.

The exact classroom address is not fully added to the knowledge base yet.

For the exact location, please contact:
📞 ${contacts.phone || location.phone || "+976 75051055"}`;
}

module.exports = locationHandler;