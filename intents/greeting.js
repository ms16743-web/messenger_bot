// intents/greeting.js

function greetingHandler(memory) {
  if (memory.language === "mn") {
    return "Сайн байна уу! 😊 AI Academy Asia-д тавтай морил. Та сургалт, үнэ, байршил эсвэл бүртгэлийн талаар асууж болно.";
  }

  return "Hello! 😊 Welcome to AI Academy Asia. You can ask me about programs, pricing, location, or registration.";
}

module.exports = greetingHandler;