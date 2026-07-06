// intents/greeting.js

function greetingHandler(memory) {
  if (memory.language === "mn") {
    return "Сайн байна уу! 😊 AI Academy Asia-д тавтай морил. Танд юугаар туслах вэ?";
  }

  return "Hello! 😊 Welcome to AI Academy Asia. How can I help you?";
}

module.exports = greetingHandler;