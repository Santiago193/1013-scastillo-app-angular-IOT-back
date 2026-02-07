const TelegramBot = require("node-telegram-bot-api");

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, {
  polling: true,
});

// /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;

  bot.sendMessage(
    chatId,
    `👋 Bienvenido

Este chat será usado para enviar *alertas de emergencia* 🚨
en caso de que el familiar que use nuestro dispositivo
sufra un accidente o una situación de riesgo.

📌 *Comandos disponibles:*
/id → Muestra el ID de este chat

Guarda este chat, aquí llegarán las alertas.`,
    { parse_mode: "Markdown" }
  );
});

// /id
bot.onText(/\/id/, (msg) => {
  const chatId = msg.chat.id;

  bot.sendMessage(
    chatId,
    `🆔 ID de este chat:\n\n\`${chatId}\``,
    { parse_mode: "Markdown" }
  );
});

module.exports = bot;
