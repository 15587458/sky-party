import axios from 'axios';
import { Event, Order, PrivateSettings } from '../types';

export const sendTelegramMessage = async (
  text: string,
  privateSettings: PrivateSettings | null
) => {
  if (!privateSettings?.telegramBotToken || !privateSettings?.telegramChatId) {
    console.log('Telegram Bot Token or Chat ID not configured');
    return;
  }

  const token = privateSettings.telegramBotToken;
  const chatId = privateSettings.telegramChatId;
  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  try {
    await axios.post(url, {
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML'
    });
    console.log('Telegram notification sent successfully');
  } catch (error: any) {
    console.error('Error sending Telegram message:', error.response?.data || error.message);
  }
};

export const notifyOrderPaid = async (
  order: Order,
  event: Event,
  privateSettings: PrivateSettings | null,
  seatLabel?: string
) => {
  const categoryStr = order.ticketType === 'vip' ? '👑 VIP' : (order.ticketType === 'free' ? '🎫 Безплатний' : '🎫 Standard');
  const detailsStr = seatLabel ? `\n<b>Місце/Стіл:</b> ${seatLabel}` : '';
  const priceStr = order.price > 0 ? `\n<b>Сума:</b> ${order.price} грн` : '';
  
  const text = `🎉 <b>Нове замовлення оплачено!</b>\n\n` +
    `<b>Подія:</b> ${event.title}\n` +
    `<b>Клієнт:</b> ${order.name} ${order.surname}\n` +
    `<b>Email:</b> ${order.email}\n` +
    `<b>Телефон:</b> ${order.phone || 'не вказано'}\n` +
    `<b>Категорія:</b> ${categoryStr}\n` +
    `<b>Кількість квитків:</b> ${order.quantity || 1}` +
    `${detailsStr}` +
    `${priceStr}\n\n` +
    `<b>ID замовлення:</b> <code>${order.id}</code>`;

  await sendTelegramMessage(text, privateSettings);
};

export const notifyTicketScanned = async (
  order: Order,
  event: Event,
  privateSettings: PrivateSettings | null,
  ticketId: string,
  allowed: boolean,
  reason?: string
) => {
  const statusEmoji = allowed ? '✅' : '❌';
  const statusText = allowed ? '<b>ДОЗВОЛЕНО</b>' : `<b>ВХІД ЗАБОРОНЕНО</b> (${reason})`;
  const typeStr = order.ticketType === 'vip' ? '👑 VIP' : (order.ticketType === 'free' ? '🎫 Безплатний' : '🎫 Standard');

  const text = `${statusEmoji} <b>Сканування квитка</b>\n\n` +
    `<b>Подія:</b> ${event.title}\n` +
    `<b>Квиток ID:</b> <code>${ticketId}</code>\n` +
    `<b>Категорія:</b> ${typeStr}\n` +
    `<b>Клієнт:</b> ${order.name} ${order.surname}\n` +
    `<b>Статус входу:</b> ${statusText}\n\n` +
    `<b>Час:</b> ${new Date().toLocaleTimeString('uk-UA')}`;

  await sendTelegramMessage(text, privateSettings);
};
