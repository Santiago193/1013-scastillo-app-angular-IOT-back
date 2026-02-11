const TelegramBot = require("node-telegram-bot-api");

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, {
  polling: true,
});

// Función para enviar mensajes
const sendTelegramMessage = async (chatId, message) => {
  try {
    await bot.sendMessage(chatId, message);
  } catch (error) {
    console.error("Error enviando mensaje a Telegram:", error.message);
  }
};

// Comando /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;

  bot.sendMessage(
    chatId,
    `Bienvenido 🚨

Este chat servirá para enviar alertas de emergencia.

Comandos disponibles:
/id - Muestra el ID de este chat`
  );
});

// Comando /id
bot.onText(/\/id/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `ID de este chat:\n${chatId}`);
});

module.exports = { sendTelegramMessage };
