// intents/greeting.js

function greetingHandler(memory) {
  if (memory.language === "mn") {
    return "Сайн байна уу! 😊 AI Academy Asia-д тавтай морил. Танд юугаар туслах вэ?";
  }// intents/location.js

function locationHandler(memory, knowledge) {
  const location = knowledge.location || {};
  const contacts = knowledge.contacts || {};

  if (memory.language === "mn") {
    return `📍 AI Academy Asia Монголд байрладаг.

📍 Хаяг:
${location.address}

📞 Утас: ${contacts.phone}
📧 И-мэйл: ${contacts.email}

Хэрэв ирж үзэхийг хүсвэл байршлыг мөн илгээж болно. 😊`;
  }

  return `📍 AI Academy Asia is located in Mongolia.

📍 Address:
${location.address}

📞 Phone: ${contacts.phone}
📧 Email: ${contacts.email}

If you'd like, I can also help you find the exact location. 😊`;
}

module.exports = locationHandler;

  return "Hello! 😊 Welcome to AI Academy Asia. How can I help you?";
}

module.exports = greetingHandler;