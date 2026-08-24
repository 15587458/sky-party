import express from "express";
import path from "path";
import axios from "axios";
import nodemailer from "nodemailer";
import { onRequest } from "firebase-functions/v2/https";
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  initializeFirestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  updateDoc,
  collection,
  query,
  where,
  limit,
  getDocs,
} from "firebase/firestore";
import firebaseConfig from "./firebase-applet-config.json";

const app = express();
const PORT = 3000;

// Universal Firestore initialization (works on Render, Railway, Vercel, GCP, Localhost)
const fbApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const db = initializeFirestore(fbApp, {
  experimentalForceLongPolling: true,
}, firebaseConfig?.firestoreDatabaseId);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Helper: Get or Create User Account with temporary or existing custom password
async function getOrCreateUserForOrder(email: string, phone?: string, name?: string, surname?: string) {
  if (!email || typeof email !== 'string') return { user: null, tempPassword: null, hasCustomPassword: false };
  const normalizedEmail = email.toLowerCase().trim();
  const userRef = doc(db, 'users', normalizedEmail);
  
  try {
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const userData = userSnap.data() as any;
      if (userData.hasCustomPassword) {
        // User already has a custom password, DO NOT show temp password in emails
        const updates: any = { updatedAt: Date.now() };
        if (phone && !userData.phone) updates.phone = phone;
        if (name && !userData.name) updates.name = name;
        if (surname && !userData.surname) updates.surname = surname;
        await updateDoc(userRef, updates);
        return { user: { ...userData, ...updates }, tempPassword: null, hasCustomPassword: true };
      } else {
        // User has not set custom password yet. Reuse or create temporary password
        let tempPassword = userData.tempPassword;
        if (!tempPassword) {
          tempPassword = `SKY-${Math.floor(100000 + Math.random() * 900000)}`;
        }
        const updates: any = {
          tempPassword,
          hasCustomPassword: false,
          updatedAt: Date.now()
        };
        if (phone) updates.phone = phone;
        if (name) updates.name = name;
        if (surname) updates.surname = surname;
        await updateDoc(userRef, updates);
        return { user: { ...userData, ...updates }, tempPassword, hasCustomPassword: false };
      }
    } else {
      // Create new user account with temporary password
      const tempPassword = `SKY-${Math.floor(100000 + Math.random() * 900000)}`;
      const newUser = {
        email: normalizedEmail,
        phone: phone || '',
        name: name || '',
        surname: surname || '',
        tempPassword,
        hasCustomPassword: false,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      await setDoc(userRef, newUser);
      return { user: newUser, tempPassword, hasCustomPassword: false };
    }
  } catch (err: any) {
    console.error("Error in getOrCreateUserForOrder:", err.message);
    return { user: null, tempPassword: null, hasCustomPassword: false };
  }
}

// API Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

  // Monobank Create Invoice
  app.post("/api/monobank/invoice", async (req, res) => {
    const { amount, ccy, reference, merchantPaymInfo, redirectUrl, webHookUrl, token } = req.body;
    
    console.log("Monobank Invoice Request received:", {
      amount,
      ccy,
      reference,
      merchantPaymInfo,
      redirectUrl,
      webHookUrl,
      hasToken: !!token
    });

    if (!token) {
      console.warn("Monobank Invoice Error: Token is missing from the request.");
      return res.status(400).json({ error: "X-Token Monobank є обов'язковим для створення інвойсу. Вкажіть його в налаштуваннях адмін-панелі." });
    }

    const trimmedToken = String(token).trim();

    try {
      const monobankPayload: any = {
        amount: Math.round(Number(amount)),
        ccy: Number(ccy) || 980,
      };

      if (merchantPaymInfo) {
        monobankPayload.merchantPaymInfo = {
          reference: String(merchantPaymInfo.reference || reference || "").slice(0, 100),
          destination: String(merchantPaymInfo.destination || "Оплата замовлення").slice(0, 100),
          comment: merchantPaymInfo.comment ? String(merchantPaymInfo.comment).slice(0, 100) : undefined,
        };
      }

      if (redirectUrl) {
        monobankPayload.redirectUrl = redirectUrl;
      }

      if (webHookUrl && String(webHookUrl).startsWith("https://") && !String(webHookUrl).includes("localhost")) {
        monobankPayload.webHookUrl = webHookUrl;
      }

      console.log("Sending payload to Monobank:", JSON.stringify(monobankPayload));

      const response = await axios.post(
        "https://api.monobank.ua/api/merchant/invoice/create",
        monobankPayload,
        { 
          headers: { 
            "X-Token": trimmedToken,
            "Content-Type": "application/json"
          },
          timeout: 15000
        }
      );
      
      console.log("Monobank Invoice Created Successfully:", response.data);
      res.json(response.data);
    } catch (error: any) {
      const errorData = error.response?.data || error.message;
      const statusCode = error.response?.status || 500;
      console.error("Monobank Invoice Creation API Error:", statusCode, errorData);
      
      let friendlyError = "Не вдалося створити рахунок в Monobank";
      
      if (errorData) {
        if (typeof errorData === "object") {
          if (errorData.errText) {
            friendlyError = `Monobank помилка: ${errorData.errText} (${errorData.errCode || 'ERROR'})`;
          } else if (errorData.message) {
            friendlyError = `Помилка: ${errorData.message}`;
          } else if (errorData.error) {
            friendlyError = typeof errorData.error === "string" ? errorData.error : (errorData.error.errText || JSON.stringify(errorData.error));
          } else {
            friendlyError = JSON.stringify(errorData);
          }
        } else if (typeof errorData === "string") {
          friendlyError = errorData;
        }
      }
      
      const isNetworkError = error.code === "ENOTFOUND" || error.code === "ETIMEDOUT" || error.message?.includes("ENOTFOUND") || error.message?.includes("ETIMEDOUT") || error.message?.includes("timeout");
      
      if (isNetworkError) {
        friendlyError = `Помилка зв'язку з Monobank API (${error.code || 'TIMEOUT'}). Переконайтеся, що на Firebase підключено план Blaze і є доступ до Інтернету.`;
      }
      
      res.status(statusCode).json({ error: friendlyError });
    }
  });

  // Monobank Refund / Cancel Invoice
  app.post("/api/monobank/refund", async (req, res) => {
    const { invoiceId, amount, token } = req.body;
    
    if (!invoiceId) {
      return res.status(400).json({ error: "Не вказано ID інвойсу" });
    }
    if (!token) {
      return res.status(400).json({ error: "Не налаштовано токен Monobank" });
    }

    const trimmedToken = String(token).trim();

    try {
      const payload: any = { invoiceId };
      if (amount && amount > 0) {
        payload.amount = Math.ceil(amount); // in kopecks
      }

      console.log("Sending Monobank Refund Payload:", payload);

      const response = await axios.post(
        "https://api.monobank.ua/api/merchant/invoice/cancel",
        payload,
        { headers: { "X-Token": trimmedToken } }
      );
      res.json(response.data);
    } catch (error: any) {
      console.error("Monobank Refund Error:", error.response?.data || error.message);
      const errorData = error.response?.data || error.message;
      
      let friendlyError = errorData;
      const isNetworkError = error.code === "ENOTFOUND" || error.code === "ETIMEDOUT" || error.message?.includes("ENOTFOUND") || error.message?.includes("ETIMEDOUT") || error.message?.includes("timeout");
      
      if (isNetworkError) {
        let rawDetail = "";
        if (typeof errorData === "object") {
          rawDetail = JSON.stringify(errorData);
        } else {
          rawDetail = String(errorData);
        }
        
        friendlyError = {
          errText: `Помилка мережі при поверненні коштів (Код: ${error.code || 'TIMEOUT'}, Опис: ${error.message}). Якщо ви виявили це на Firebase hosting, переконайтеся, що ви вже підключили тариф Blaze і повторно розгорнули (deploy) проєкт. Spark-план повністю блокує будь-які запити до зовнішніх сайтів. Деталі помилки: ${rawDetail}`
        };
      }
      res.status(500).json({ error: friendlyError || "Internal Server Error" });
    }
  });
  
  const inFlightNotifications = new Set<string>();

  // Send notifications for a paid order (E-mail and Telegram alerts)
  async function sendNotificationsForPaidOrder(orderId: string, order: any) {
    if (inFlightNotifications.has(orderId)) {
      console.log(`Purchase Notification -> Notifications in flight for order ${orderId}, skipping duplicate call.`);
      return;
    }

    try {
      const orderRef = doc(db, 'orders', orderId);
      const isAlreadySentSnap = await getDoc(orderRef);
      if (!isAlreadySentSnap.exists()) {
        console.warn(`Purchase Notification -> Order ${orderId} not found, skipping notifications.`);
        return;
      }

      const orderData = isAlreadySentSnap.data() as any;
      if (orderData.notificationsSent) {
        console.log(`Purchase Notification -> Notifications already processed for order ${orderId}, skipping duplicate call.`);
        return;
      }

      inFlightNotifications.add(orderId);

      // Fetch configurations and metadata to send the receipt
      const [privateSnap, configSnap, eventSnap] = await Promise.all([
        getDoc(doc(db, 'settings', 'private')),
        getDoc(doc(db, 'config', 'settings')),
        getDoc(doc(db, 'events', orderData.eventId))
      ]);

      const privateSettings = privateSnap.exists() ? privateSnap.data() : null;
      const config = configSnap.exists() ? configSnap.data() : null;
      const event = eventSnap.exists() ? eventSnap.data() : null;

      // Load seating label if applicable
      let selectedSeat: any = null;
      if (orderData.elementId && event && event.chartId) {
        try {
          const elementSnap = await getDoc(doc(db, 'charts', event.chartId, 'elements', orderData.elementId));
          if (elementSnap.exists()) {
            selectedSeat = elementSnap.data();
          }
        } catch (seatErr) {
          console.error("Purchase Notification -> Error loading seat info:", seatErr);
        }
      }

      // Build dynamic ticket text
      const quantity = orderData.quantity || 1;
      const ticketType = orderData.ticketType || 'standard';

      // Create or retrieve user account info & temporary password
      let tempPassword: string | null = null;
      let hasCustomPassword = false;
      try {
        const userRes = await getOrCreateUserForOrder(orderData.email, orderData.phone, orderData.name, orderData.surname);
        tempPassword = userRes.tempPassword;
        hasCustomPassword = userRes.hasCustomPassword;
      } catch (uErr) {
        console.error("Purchase Notification -> User Account error:", uErr);
      }

      const qrCodesHtml = Array.from({ length: quantity }).map((_, i) => `
        <div style="background: #111115; padding: 25px; border-radius: 24px; margin-bottom: 20px; border: 1px solid #222226; text-align: center;">
          <p style="font-size: 10px; color: #71717a; margin: 0 0 12px 0; text-transform: uppercase; font-weight: 900; letter-spacing: 1px;">КВИТОК ${i + 1} З ${quantity}</p>
          <div style="background: white; padding: 15px; border-radius: 18px; display: inline-block;">
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${orderId}:${i + 1}" alt="QR Code ${i + 1}" style="display: block; width: 180px; height: 180px;" />
          </div>
          <p style="font-size: 12px; color: #a1a1aa; margin: 12px 0 0 0; font-family: monospace; font-weight: bold;">ID: ${orderId}-${i + 1}</p>
        </div>
      `).join('');

      const htmlBody = `
        <div style="font-family: -apple-system, system-ui, sans-serif; background: #050505; color: #ffffff; padding: 40px 20px; text-align: center;">
          <div style="max-width: 540px; margin: 0 auto; background: #0a0a0c; border-radius: 36px; border: 1px solid #1a1a1f; overflow: hidden; box-shadow: 0 25px 60px rgba(0,0,0,0.65);">
            
            <!-- Header Banner -->
            <div style="background: linear-gradient(135deg, ${config?.primaryColor || '#7c3aed'}, #4c1d95); padding: 40px 20px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 30px; font-weight: 950; letter-spacing: 1.5px; text-transform: uppercase;">SKY PARTY</h1>
              <p style="color: rgba(255,255,255,0.7); margin: 8px 0 0 0; font-size: 12px; font-weight: bold; letter-spacing: 2px;">ТВОЄ НЕБО. ТВОЯ ВЕЧІРКА.</p>
            </div>

            <div style="padding: 40px 30px; text-align: left;">
              <div style="text-align: center; margin-bottom: 30px;">
                <h2 style="color: #ffffff; margin: 0 0 8px 0; font-size: 24px; font-weight: 950; letter-spacing: -0.5px; text-transform: uppercase;">Ваші квитки готові!</h2>
                <p style="font-size: 15px; color: #a1a1aa; margin: 0;">Дякуємо за покупку. Електронні квитки готові та відображаються нижче.</p>
              </div>

              <!-- Cabinet & Temporary Password Box -->
              ${tempPassword ? `
                <div style="background: rgba(168, 85, 247, 0.08); border: 1px solid rgba(168, 85, 247, 0.25); border-radius: 24px; padding: 22px; margin-bottom: 25px; text-align: left;">
                  <p style="font-size: 11px; font-weight: 900; color: #c084fc; text-transform: uppercase; letter-spacing: 1.5px; margin: 0 0 8px 0;">🔐 ВАШ ОСОБИСТИЙ КАБІНЕТ</p>
                  <p style="font-size: 13px; color: #e4e4e7; margin: 0 0 12px 0; line-height: 1.4;">
                    Усі ваші квитки та історія замовлень доступні у вашому особистому кабінеті.
                  </p>
                  <div style="background: #000000; border-radius: 14px; padding: 12px 16px; border: 1px solid rgba(255,255,255,0.1); margin-bottom: 12px;">
                    <p style="margin: 0 0 6px 0; font-size: 12px; color: #a1a1aa;">Логін: <b style="color: #ffffff; font-family: monospace;">${orderData.email}</b></p>
                    <p style="margin: 0; font-size: 12px; color: #a1a1aa;">Тимчасовий пароль: <b style="color: #c084fc; font-family: monospace; font-size: 15px; letter-spacing: 1px;">${tempPassword}</b></p>
                  </div>
                  <p style="font-size: 11px; color: #71717a; margin: 0; line-height: 1.4;">
                    *Ви можете змінити цей пароль на власний у кабінеті. Після зміни пароль більше ніколи не буде відображатися в листах.
                  </p>
                </div>
              ` : `
                <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 20px; padding: 16px 20px; margin-bottom: 25px; text-align: left;">
                  <p style="font-size: 11px; font-weight: 900; color: #a1a1aa; text-transform: uppercase; letter-spacing: 1.5px; margin: 0 0 4px 0;">🔐 ОСОБИСТИЙ КАБІНЕТ</p>
                  <p style="font-size: 12px; color: #71717a; margin: 0;">
                    Квитки завжди доступні в кабінеті (вхід за вашим постійним паролем).
                  </p>
                </div>
              `}
              
              <!-- Event Info -->
              <div style="background: #111115; padding: 25px; border-radius: 24px; border: 1px solid #222226; margin-bottom: 30px;">
                <div style="margin-bottom: 20px; border-bottom: 1px dashed #222226; padding-bottom: 15px;">
                  <p style="font-size: 10px; color: #71717a; margin: 0; text-transform: uppercase; font-weight: 900; letter-spacing: 1px;">ЗАХІД</p>
                  <p style="font-size: 18px; font-weight: 900; margin: 6px 0; color: ${config?.primaryColor || '#a855f7'}; text-transform: uppercase;">${event ? event.title : 'Подія'}</p>
                  <p style="font-size: 13px; color: #e4e4e7; margin: 0; font-weight: bold;">
                    ${event ? new Date(event.date).toLocaleString('uk-UA') : ''}
                  </p>
                </div>

                <div style="display: flex; gap: 15px;">
                  <div style="width: 50%;">
                    <p style="font-size: 10px; color: #71717a; margin: 0; text-transform: uppercase; font-weight: 900; letter-spacing: 1px;">КЛІЄНТ</p>
                    <p style="font-size: 14px; font-weight: 800; margin: 5px 0; color: #ffffff;">${orderData.name} ${orderData.surname}</p>
                    <p style="font-size: 11px; color: #71717a; margin: 0;">${orderData.email}</p>
                  </div>
                  <div style="width: 50%; text-align: right;">
                    <p style="font-size: 10px; color: #71717a; margin: 0; text-transform: uppercase; font-weight: 900; letter-spacing: 1px;">ТИП КВИТКА</p>
                    <p style="font-size: 14px; font-weight: 800; margin: 5px 0; color: #ffffff; text-transform: uppercase;">${ticketType}</p>
                    <p style="font-size: 11px; color: ${config?.primaryColor || '#a855f7'}; margin: 0; font-weight: bold;">
                      ${selectedSeat ? selectedSeat.label : 'ВХІДНИЙ КВИТОК'}
                    </p>
                  </div>
                </div>
              </div>

              <!-- Header of QR Codes -->
              <h3 style="font-size: 12px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; color: #71717a; margin: 0 0 15px 10px;">ШВИДКЕ СКАНУВАННЯ</h3>
              <!-- QR Codes -->
              <div>
                ${qrCodesHtml}
              </div>

              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #222226; text-align: center;">
                <p style="font-size: 11px; color: #52525b; margin: 0;">ІДЕНТИФІКАТОР ЗАМОВЛЕННЯ: <span style="font-family: monospace; font-weight: bold; color: #a1a1aa;">${orderId}</span></p>
              </div>
            </div>

            <div style="background: #050505; padding: 25px; font-size: 10px; color: #52525b; text-transform: uppercase; letter-spacing: 3px; border-top: 1px solid #1a1a1f; text-align: center;">
              ${config?.footerText || 'SKY PARTY • PRIVATE EVENTS ONLY'}
            </div>
          </div>
          
          <p style="margin-top: 30px; font-size: 11px; color: #27272a; text-align: center;">
            Цей лист згенеровано автоматично з любов'ю від Sky Garden.
          </p>
        </div>
      `;

      const smtpUser = privateSettings?.smtpUser || "sky.party@ukr.net";
      const smtpPass = privateSettings?.smtpPass;

      let smtpHost = privateSettings?.smtpHost || "smtp.ukr.net";
      let smtpPort = privateSettings?.smtpPort ? Number(privateSettings.smtpPort) : 465;

      const userLower = smtpUser.toLowerCase().trim();
      if (!privateSettings?.smtpHost) {
        if (userLower.endsWith("@gmail.com")) {
          smtpHost = "smtp.gmail.com";
          smtpPort = 465;
        } else if (userLower.endsWith("@yahoo.com")) {
          smtpHost = "smtp.mail.yahoo.com";
          smtpPort = 465;
        } else if (userLower.endsWith("@outlook.com") || userLower.endsWith("@hotmail.com")) {
          smtpHost = "smtp.office365.com";
          smtpPort = 587;
        }
      }

      // 1. Send Guest and Staff Emails safely in isolated try-catch
      if (smtpPass) {
        try {
          const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: smtpPort === 465,
            auth: {
              user: smtpUser,
              pass: smtpPass,
            },
            tls: {
              rejectUnauthorized: false
            }
          });

          // Send Guest Email
          await transporter.sendMail({
            from: smtpUser,
            to: orderData.email,
            subject: `Ваш квиток на ${event ? event.title : 'Захід'}`,
            html: htmlBody,
          });
          console.log("Purchase Notification -> Guest email sent successfully!");

          // Send Staff Email Notifier
          const staffHtml = `
            <div style="font-family: sans-serif; padding: 30px; border: 1px solid #e2e8f0; border-radius: 20px; max-width: 500px; margin: 0 auto; background: #ffffff;">
              <div style="background: #10b981; color: white; padding: 15px; border-radius: 12px; text-align: center; margin-bottom: 25px;">
                <h2 style="margin: 0; font-size: 18px; letter-spacing: 1px;">🔥 АВТООПЛАТА MONOBANK</h2>
              </div>
              
              <div style="margin-bottom: 20px; border-bottom: 1px solid #f1f5f9; padding-bottom: 15px;">
                <p style="font-size: 11px; color: #64748b; margin: 0; text-transform: uppercase; font-weight: 800;">Подія</p>
                <p style="font-size: 18px; font-weight: 800; margin: 5px 0; color: #0f172a;">${event ? event.title : 'Захід'}</p>
              </div>

              <div style="display: flex; gap: 20px; margin-bottom: 20px;">
                <div style="flex: 1;">
                  <p style="font-size: 11px; color: #64748b; margin: 0; text-transform: uppercase; font-weight: 800;">Клієнт</p>
                  <p style="font-size: 15px; font-weight: 700; margin: 5px 0; color: #334155;">${orderData.name} ${orderData.surname}</p>
                  <p style="font-size: 12px; color: #94a3b8; margin: 0;">${orderData.email}</p>
                </div>
                <div style="text-align: right; background: #f8fafc; padding: 10px; border-radius: 10px; min-width: 80px;">
                  <p style="font-size: 10px; color: #64748b; margin: 0; text-transform: uppercase;">Кількість</p>
                  <p style="font-size: 20px; font-weight: 900; margin: 0; color: #10b981;">x${quantity}</p>
                </div>
              </div>

              <div style="margin-bottom: 20px; background: #ecfdf5; padding: 12px; border-radius: 10px; border: 1px solid #a7f3d0;">
                <p style="font-size: 11px; color: #065f46; margin: 0; text-transform: uppercase; font-weight: 800;">Квиток</p>
                <p style="font-size: 14px; font-weight: 700; margin: 5px 0; color: #047857;">${ticketType.toUpperCase()} ${selectedSeat?.label ? `(${selectedSeat.label})` : ''}</p>
              </div>

              <div style="font-size: 10px; color: #cbd5e1; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 15px;">
                ID: ${orderId} • MONOBANK WEBHOOK SYSTEM
              </div>
            </div>
          `;

          await transporter.sendMail({
            from: smtpUser,
            to: smtpUser,
            subject: `⚡ [${quantity} шт] ${orderData.name} (Автосплата Monobank) -> ${event ? event.title : 'Захід'}`,
            html: staffHtml,
          });
          console.log("Purchase Notification -> Staff notification email sent!");
        } catch (emailErr: any) {
          console.error("Purchase Notification -> Email delivery failed:", emailErr.message || emailErr);
        }
      } else {
        console.warn("Purchase Notification -> SMTP Credentials missing, skipping email delivery.");
      }

      // 2. Send Telegram notification safely in isolated try-catch
      const botToken = privateSettings?.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN;
      const chatId = privateSettings?.telegramChatId || process.env.TELEGRAM_CHAT_ID;

      if (botToken && chatId) {
        try {
          const telegramMessage = 
            `🟢 <b>АВТООПЛАТА MONOBANK</b>\n\n` +
            `📍 <b>Подія:</b> ${event ? event.title : 'Захід'}\n` +
            `👤 <b>Клієнт:</b> ${orderData.name} ${orderData.surname}\n` +
            `📧 <b>Email:</b> ${orderData.email}\n` +
            `🎫 <b>Тип:</b> ${ticketType.toUpperCase()} ${selectedSeat?.label ? `(${selectedSeat.label})` : ''}\n` +
            `🔢 <b>Кількість:</b> ${quantity}\n\n` +
            `💸 <b>Сумма:</b> ${orderData.price} UAH\n` +
            `🆔 <code>${orderId}</code>`;

          await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            chat_id: chatId,
            text: telegramMessage,
            parse_mode: 'HTML',
          });
          console.log("Purchase Notification -> Telegram notification sent successfully!");
        } catch (tgError: any) {
          console.error("Purchase Notification -> Telegram API error:", tgError.response?.data || tgError.message);
        }
      }

      // All channels attempted. Now mark as completed in DB so we never infinite-loop
      await updateDoc(orderRef, { notificationsSent: true });
      console.log(`Purchase Notification -> Saved status 'notificationsSent: true' in database for order: ${orderId}`);
    } catch (bgError: any) {
      console.error("Purchase Notification Processing Error:", bgError);
    } finally {
      inFlightNotifications.delete(orderId);
    }
  }

  // Monobank Check Status Fallback API
  app.post("/api/monobank/check-status", async (req, res) => {
    const { orderId, token } = req.body;

    if (!orderId) {
      return res.status(400).json({ error: "Не вказано ID замовлення" });
    }

    let activeToken = token;
    if (!activeToken) {
      try {
        const privateSnap = await getDoc(doc(db, 'settings', 'private'));
        if (privateSnap.exists()) {
          activeToken = privateSnap.data()?.monobankToken;
        }
      } catch (err) {
        console.error("Failed to load monobankToken from settings/private:", err);
      }
    }

    if (activeToken) {
      activeToken = String(activeToken).trim();
    }

    if (!activeToken) {
      return res.status(400).json({ error: "Не вказано monobank API token" });
    }

    try {
      const orderRef = doc(db, 'orders', orderId);
      const orderSnap = await getDoc(orderRef);

      if (!orderSnap.exists()) {
        return res.status(404).json({ error: "Замовлення не знайдено" });
      }

      const order = orderSnap.data() as any;

      if (order.status === 'paid') {
        // Run asynchronously to trigger emailing and Telegram alerts if they haven't been sent yet
        sendNotificationsForPaidOrder(orderId, order);
        return res.json({ status: 'paid', order });
      }

      const invoiceId = order.monobankInvoiceId;
      if (!invoiceId) {
        return res.status(400).json({ error: "Для цього замовлення не знайдено створеного інвойсу monobank" });
      }

      console.log(`Checking Monobank invoice status securely for order: ${orderId}, Invoice ID: ${invoiceId}.`);

      let monobankStatus = "created";
      let invalidTokenDetected = false;
      try {
        const checkResponse = await axios.get(
          `https://api.monobank.ua/api/merchant/invoice/status?invoiceId=${invoiceId}`,
          { headers: { "X-Token": activeToken } }
        );
        monobankStatus = checkResponse.data.status;
        console.log(`Real Monobank Status checked for order ${orderId}: ${monobankStatus}`);
      } catch (checkErr: any) {
        console.error("Failed to fetch Monobank status API, returning database status as fallback:", checkErr.response?.data || checkErr.message);
        const isTokenErr = checkErr.response?.status === 401 || checkErr.response?.status === 403 || checkErr.message?.includes("401") || checkErr.message?.includes("403");
        const isNetworkErr = checkErr.code === "ENOTFOUND" || checkErr.code === "ETIMEDOUT" || checkErr.message?.includes("ENOTFOUND") || checkErr.message?.includes("ETIMEDOUT") || checkErr.message?.includes("timeout");
        return res.json({ 
          status: order.status, 
          order, 
          sparkLimitDetected: isNetworkErr,
          invalidTokenDetected: isTokenErr,
          errorDetail: checkErr.message 
        });
      }

      const isPaid = monobankStatus === "success" || monobankStatus === "hold";

      if (isPaid && order.status !== 'paid') {
        const updateFields: any = {
          status: 'paid',
          paidAt: order.paidAt || new Date().toISOString(),
          monobankStatus,
          ticketSent: true,
        };
        await updateDoc(orderRef, updateFields);
        console.log(`Status Check Secure -> Order ${orderId} is paid successfully!`);
        const updatedOrder = { ...order, ...updateFields };
        sendNotificationsForPaidOrder(orderId, updatedOrder);
        return res.json({ status: 'paid', order: updatedOrder });
      } else if (monobankStatus === "reversed" && order.status !== "reversed" && order.status !== "cancelled") {
        await updateDoc(orderRef, { status: "cancelled", monobankStatus });
        return res.json({ status: 'cancelled', order: { ...order, status: 'cancelled', monobankStatus } });
      } else if ((monobankStatus === "failure" || monobankStatus === "expired") && order.status === "pending") {
        await updateDoc(orderRef, { status: "cancelled", monobankStatus });
        return res.json({ status: 'cancelled', order: { ...order, status: 'cancelled', monobankStatus } });
      }

      const currentStatus = isPaid ? 'paid' : order.status;
      return res.json({ status: currentStatus, order: { ...order, status: currentStatus } });
    } catch (error: any) {
      const errorData = error.response?.data || error.message;
      console.error("Monobank Check Status Error:", errorData);
      res.status(500).json({ error: errorData || "Internal Server Error" });
    }
  });

  // HTTP GET Webhook verification (Monobank server tests if the URL is reachable)
  app.get("/api/monobank/webhook", (req, res) => {
    console.log("Monobank Webhook GET Probe received and answered successfully.");
    return res.status(200).json({ status: "ok" });
  });

  // HTTP POST Webhook callback for real payment notifications
  app.post("/api/monobank/webhook", async (req: any, res: any) => {
    const rawBody = req.body || {};
    console.log("Monobank Webhook POST callback received:", JSON.stringify(rawBody));

    // Monobank server sends POST with status, reference (order ID) and invoiceId at the root level
    const status = String(rawBody.status || "").toLowerCase().trim();
    const reference = String(rawBody.reference || "").trim();
    const invoiceId = String(rawBody.invoiceId || "").trim();

    console.log("Monobank Webhook POST Resolved -> Status:", status, "Reference:", reference, "InvoiceId:", invoiceId);

    const isSuccess = status === "success" || status === "hold" || status === "paid" || status === "completed" || status === "approved";
    const isCancelled = status === "failure" || status === "expired" || status === "reversed";

    if (isSuccess) {
      try {
        let orderDoc: any = null;
        let orderId = reference;

        // 1. Try finding order by reference (directly matching doc ID)
        if (orderId) {
          const orderRef = doc(db, 'orders', orderId);
          const orderSnap = await getDoc(orderRef);
          if (orderSnap.exists()) {
            orderDoc = orderSnap;
          }
        }

        // 2. Fallback: Search by monobankInvoiceId in orders collection
        if (!orderDoc && invoiceId) {
          console.log(`Webhook -> Order not found by reference ID. Searching orders by monobankInvoiceId = ${invoiceId}`);
          const querySnap = await getDocs(query(collection(db, 'orders'), where('monobankInvoiceId', '==', invoiceId), limit(1)));
          if (!querySnap.empty) {
            orderDoc = querySnap.docs[0];
            orderId = orderDoc.id;
          }
        }

        if (orderDoc) {
          const order = orderDoc.data() as any;
          console.log(`Webhook -> Order found! Email: ${order.email}, Current status: ${order.status}, OrderId: ${orderId}`);
          
          if (order.status === 'pending') {
            // SECURE ROUND-CHECKING: Fetch private Monobank merchant API token to confirm the invoice status from Monobank's official API directly
            let activeToken = "";
            try {
              const privateSnap = await getDoc(doc(db, 'settings', 'private'));
              if (privateSnap.exists()) {
                activeToken = privateSnap.data()?.monobankToken;
              }
            } catch (err) {
              console.error("Webhook secure check -> Failed to load monobankToken from settings/private:", err);
            }

            if (activeToken) {
              activeToken = String(activeToken).trim();
            }

            if (!activeToken) {
              console.error("Webhook secure check -> No Monobank token found. Callback processing aborted.");
              return res.status(400).json({ error: "X-Token is missing in server settings config" });
            }

            const targetInvoiceId = invoiceId || order.monobankInvoiceId;
            if (!targetInvoiceId) {
              console.error("Webhook secure check -> No targetInvoiceId found.");
              return res.status(400).json({ error: "invoiceId is missing" });
            }

            // Perform direct status verification call to Monobank
            let realMonobankStatus = "created";
            let checkResponse: any = null;
            try {
              checkResponse = await axios.get(
                `https://api.monobank.ua/api/merchant/invoice/status?invoiceId=${targetInvoiceId}`,
                { headers: { "X-Token": activeToken } }
              );
              realMonobankStatus = checkResponse.data.status;
              console.log(`Webhook secure check -> Confirmed real Monobank status is: ${realMonobankStatus}`);
            } catch (checkErr: any) {
              console.error("Webhook secure check -> Monobank verification API request failed:", checkErr.response?.data || checkErr.message);
              return res.status(500).json({ error: "Failed to verify payment with Monobank server" });
            }

            const isReallyPaid = realMonobankStatus === "success" || realMonobankStatus === "hold";
            if (!isReallyPaid) {
              console.warn(`Webhook secure check ALERT -> Webhook claimed status '${status}' but Monobank API says '${realMonobankStatus}'! Spoofing attempt blocked.`);
              return res.status(400).json({ error: "Invoice is not paid" });
            }

            // Verify paid amount matches the order price in kopecks
            const expectedAmountKopecks = Math.round(Number(order.price || 0) * 100);
            const actualAmountKopecks = Number(rawBody.amount || checkResponse.data?.amount || 0);
            if (expectedAmountKopecks > 0 && actualAmountKopecks > 0 && actualAmountKopecks < expectedAmountKopecks) {
              console.error(`Webhook security ALERT -> Amount mismatch for order ${orderId}: Expected ${expectedAmountKopecks} kopecks, but received ${actualAmountKopecks} kopecks.`);
              return res.status(400).json({ error: "Paid amount mismatch" });
            }

            const orderRef = doc(db, 'orders', orderId);
            // Secure update: Mark order as paid with timestamp
            const updateFields: any = { 
              status: 'paid',
              paidAt: new Date().toISOString(),
              monobankStatus: realMonobankStatus,
              ticketSent: true,
            };
            if (targetInvoiceId && !order.monobankInvoiceId) {
              updateFields.monobankInvoiceId = targetInvoiceId;
            }
            await updateDoc(orderRef, updateFields);
            console.log(`Webhook secure check -> Order ${orderId} successfully validated and marked as paid.`);

            // Send notification triggers asynchronously (Email with QR codes + Telegram alert)
            sendNotificationsForPaidOrder(orderId, { ...order, ...updateFields });
            
            return res.json({ status: "ok" });
          } else {
            console.log(`Webhook -> Order is already in status '${order.status}', ignoring callback.`);
            return res.json({ status: "ok" });
          }
        } else {
          console.warn(`Webhook -> Order for reference ID '${reference}' or Invoice '${invoiceId}' was not found in the database.`);
          return res.status(404).json({ error: "Order not found" });
        }
      } catch (err: any) {
        console.error("Webhook -> Error processing callback:", err.message);
        return res.status(500).json({ error: err.message });
      }
    } else if (isCancelled) {
      try {
        let orderDoc: any = null;
        let orderId = reference;

        if (orderId) {
          const orderRef = doc(db, 'orders', orderId);
          const orderSnap = await getDoc(orderRef);
          if (orderSnap.exists()) {
            orderDoc = orderSnap;
          }
        }

        if (!orderDoc && invoiceId) {
          const querySnap = await getDocs(query(collection(db, 'orders'), where('monobankInvoiceId', '==', invoiceId), limit(1)));
          if (!querySnap.empty) {
            orderDoc = querySnap.docs[0];
            orderId = orderDoc.id;
          }
        }

        if (orderDoc) {
          const order = orderDoc.data() as any;
          if (order.status === 'pending') {
            const orderRef = doc(db, 'orders', orderId);
            await updateDoc(orderRef, { status: 'cancelled' });
            console.log(`Webhook -> Successfully updated status of order ${orderId} to 'cancelled' upon failed/cancelled notice.`);
          }
        }
      } catch (err: any) {
        console.error("Webhook Cancel Notice -> Error occurred:", err.message);
      }
    }

    return res.json({ status: "ok" });
  });

  // Send Email Ticket
  app.post("/api/email/ticket", async (req, res) => {
    let { email, subject, html, smtpUser, smtpPass, smtpHost: bodyHost, smtpPort: bodyPort, orderDetails, pdfAttachments } = req.body;
    
    // Server-side secure fallback for SMTP credentials if client didn't supply them
    if (!smtpUser || !smtpPass) {
      try {
        const privateSnap = await getDoc(doc(db, 'settings', 'private'));
        if (privateSnap.exists()) {
          const pData = privateSnap.data();
          if (!smtpUser && pData?.smtpUser) smtpUser = pData.smtpUser;
          if (!smtpPass && pData?.smtpPass) smtpPass = pData.smtpPass;
          if (!bodyHost && pData?.smtpHost) bodyHost = pData.smtpHost;
          if (!bodyPort && pData?.smtpPort) bodyPort = pData.smtpPort;
        }
      } catch (dbErr) {
        console.error("Error reading server-side SMTP settings inside /api/email/ticket:", dbErr);
      }
    }

    // Try environment variables fallback
    if (!smtpUser) smtpUser = process.env.SMTP_USER || "sky.party@ukr.net";
    if (!smtpPass) smtpPass = process.env.SMTP_PASS;

    if (!smtpUser || !smtpPass) {
      return res.status(400).json({ error: "SMTP credentials missing. Please configure them in the Admin Settings panel." });
    }

    try {
      let smtpHost = bodyHost || "smtp.ukr.net";
      let smtpPort = bodyPort ? Number(bodyPort) : 465;

      const userLower = smtpUser.toLowerCase().trim();
      if (!bodyHost) {
        if (userLower.endsWith("@gmail.com")) {
          smtpHost = "smtp.gmail.com";
          smtpPort = 465;
        } else if (userLower.endsWith("@yahoo.com")) {
          smtpHost = "smtp.mail.yahoo.com";
          smtpPort = 465;
        } else if (userLower.endsWith("@outlook.com") || userLower.endsWith("@hotmail.com")) {
          smtpHost = "smtp.office365.com";
          smtpPort = 587;
        }
      }

      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
        tls: {
          rejectUnauthorized: false
        }
      });

      // 1. Send to Customer
      const mailOptions: any = {
        from: smtpUser,
        to: email,
        subject,
        html,
      };

      // Bootstrap or update user account
      try {
        await getOrCreateUserForOrder(email, orderDetails?.phone, orderDetails?.name, orderDetails?.surname);
      } catch (uErr) {
        console.warn("Could not sync user in /api/email/ticket:", uErr);
      }

      if (pdfAttachments && Array.isArray(pdfAttachments)) {
        mailOptions.attachments = pdfAttachments.map((att: any) => ({
          filename: att.filename,
          content: att.base64,
          encoding: 'base64'
        }));
      }

      await transporter.sendMail(mailOptions);

      // 2. Send separate "Staff Notification"
      if (orderDetails) {
        const { name, surname, eventTitle, quantity, ticketType, ticketLabel, orderId } = orderDetails;
        
        const staffHtml = `
          <div style="font-family: sans-serif; padding: 30px; border: 1px solid #e2e8f0; border-radius: 20px; max-width: 500px; margin: 0 auto; background: #ffffff;">
            <div style="background: #7c3aed; color: white; padding: 15px; border-radius: 12px; text-align: center; margin-bottom: 25px;">
              <h2 style="margin: 0; font-size: 18px; letter-spacing: 1px;">🔥 НОВЕ ЗАМОВЛЕННЯ</h2>
            </div>
            
            <div style="margin-bottom: 20px; border-bottom: 1px solid #f1f5f9; padding-bottom: 15px;">
              <p style="font-size: 11px; color: #64748b; margin: 0; text-transform: uppercase; font-weight: 800;">Подія</p>
              <p style="font-size: 18px; font-weight: 800; margin: 5px 0; color: #0f172a;">${eventTitle}</p>
            </div>

            <div style="display: flex; gap: 20px; margin-bottom: 20px;">
              <div style="flex: 1;">
                <p style="font-size: 11px; color: #64748b; margin: 0; text-transform: uppercase; font-weight: 800;">Клієнт</p>
                <p style="font-size: 15px; font-weight: 700; margin: 5px 0; color: #334155;">${name} ${surname}</p>
                <p style="font-size: 12px; color: #94a3b8; margin: 0;">${email}</p>
              </div>
              <div style="text-align: right; background: #f8fafc; padding: 10px; border-radius: 10px; min-width: 80px;">
                <p style="font-size: 10px; color: #64748b; margin: 0; text-transform: uppercase;">Кількість</p>
                <p style="font-size: 20px; font-weight: 900; margin: 0; color: #7c3aed;">x${quantity}</p>
              </div>
            </div>

            <div style="margin-bottom: 20px; background: #fdf2ff; padding: 12px; border-radius: 10px; border: 1px solid #fae8ff;">
              <p style="font-size: 11px; color: #64748b; margin: 0; text-transform: uppercase; font-weight: 800;">Квиток</p>
              <p style="font-size: 14px; font-weight: 700; margin: 5px 0; color: #a855f7;">${ticketType.toUpperCase()} ${ticketLabel ? `(${ticketLabel})` : ''}</p>
            </div>

            <div style="font-size: 10px; color: #cbd5e1; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 15px;">
              ID: ${orderId} • SKY GARDEN SYSTEM
            </div>
          </div>
        `;

        await transporter.sendMail({
          from: smtpUser,
          to: "sky.party@ukr.net",
          subject: `⚡ [${quantity} шт] ${name} -> ${eventTitle}`,
          html: staffHtml,
        });

        // 3. Telegram Notification
        let botToken = process.env.TELEGRAM_BOT_TOKEN;
        let chatId = process.env.TELEGRAM_CHAT_ID;

        try {
          const privateSnap = await getDoc(doc(db, 'settings', 'private'));
          if (privateSnap.exists()) {
            const pData = privateSnap.data();
            if (pData?.telegramBotToken) botToken = String(pData.telegramBotToken).trim();
            if (pData?.telegramChatId) chatId = String(pData.telegramChatId).trim();
          }
        } catch (dbErr) {
          console.error("Error loading Telegram credentials from settings/private inside /api/email/ticket:", dbErr);
        }

        if (botToken && chatId) {
          const telegramMessage = 
            `🟢 <b>НОВЕ ЗАМОВЛЕННЯ (ОПЛАЧЕНО)</b>\n\n` +
            `📍 <b>Подія:</b> ${eventTitle}\n` +
            `👤 <b>Клієнт:</b> ${name} ${surname}\n` +
            `📧 <b>Email:</b> ${email}\n` +
            `🎫 <b>Тип:</b> ${ticketType.toUpperCase()} ${ticketLabel ? `(${ticketLabel})` : ''}\n` +
            `🔢 <b>Кількість:</b> ${quantity}\n\n` +
            `🆔 <code>${orderId}</code>`;

          try {
            await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              chat_id: chatId,
              text: telegramMessage,
              parse_mode: 'HTML',
            });
            console.log("Telegram notification sent successfully via manual/auto backend trigger.");
          } catch (tgError: any) {
            console.error("Telegram Error in /api/email/ticket:", tgError.response?.data || tgError.message);
          }
        }
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error("Email Error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Test SMTP connection and send a test email
  app.post("/api/email/test", async (req: any, res: any) => {
    try {
      let { testEmail, smtpUser, smtpPass, smtpHost: bodyHost, smtpPort: bodyPort } = req.body || {};

      // Fallback to settings/private if not supplied in body
      if (!smtpUser || !smtpPass) {
        try {
          const privateSnap = await getDoc(doc(db, 'settings', 'private'));
          if (privateSnap.exists()) {
            const pData = privateSnap.data();
            if (!smtpUser && pData?.smtpUser) smtpUser = pData.smtpUser;
            if (!smtpPass && pData?.smtpPass) smtpPass = pData.smtpPass;
            if (!bodyHost && pData?.smtpHost) bodyHost = pData.smtpHost;
            if (!bodyPort && pData?.smtpPort) bodyPort = pData.smtpPort;
          }
        } catch (dbErr) {
          console.error("Error reading settings/private inside /api/email/test:", dbErr);
        }
      }

      if (!smtpUser) smtpUser = process.env.SMTP_USER;
      if (!smtpPass) smtpPass = process.env.SMTP_PASS;

      if (!smtpUser || !smtpPass) {
        return res.status(400).json({
          success: false,
          error: "Не вказано SMTP Email або пароль додатку (App Password). Будь ласка, заповніть їх у налаштуваннях."
        });
      }

      const targetEmail = testEmail ? String(testEmail).trim() : smtpUser;

      let smtpHost = bodyHost || "smtp.ukr.net";
      let smtpPort = bodyPort ? Number(bodyPort) : 465;

      const userLower = smtpUser.toLowerCase().trim();
      if (!bodyHost) {
        if (userLower.endsWith("@gmail.com")) {
          smtpHost = "smtp.gmail.com";
          smtpPort = 465;
        } else if (userLower.endsWith("@yahoo.com")) {
          smtpHost = "smtp.mail.yahoo.com";
          smtpPort = 465;
        } else if (userLower.endsWith("@outlook.com") || userLower.endsWith("@hotmail.com")) {
          smtpHost = "smtp.office365.com";
          smtpPort = 587;
        }
      }

      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
        tls: {
          rejectUnauthorized: false
        }
      });

      // Verify connection configuration
      await transporter.verify();

      // Send a rich test message
      const info = await transporter.sendMail({
        from: `Sky Garden <${smtpUser}>`,
        to: targetEmail,
        subject: "🚀 Тестовий лист від Sky Garden | SMTP перевірка",
        html: `
          <div style="font-family: -apple-system, system-ui, sans-serif; background: #09090b; color: #ffffff; padding: 40px 20px; text-align: center;">
            <div style="max-width: 500px; margin: 0 auto; background: #18181b; border-radius: 28px; border: 1px solid #27272a; overflow: hidden; padding: 35px 25px; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
              <div style="width: 56px; height: 56px; background: #10b981; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px auto; line-height: 56px; font-size: 28px;">
                ✓
              </div>
              <h2 style="margin: 0 0 10px 0; font-size: 22px; font-weight: 900; color: #ffffff; text-transform: uppercase; letter-spacing: 1px;">SMTP Працює Відмінно!</h2>
              <p style="font-size: 14px; color: #a1a1aa; line-height: 1.6; margin: 0 0 25px 0;">
                Вітаємо! Ваші налаштування поштового сервера підключені успішно. Тепер покупці отримуватимуть квитки та коди відновлення на свої електронні адреси без затримок.
              </p>
              <div style="background: #09090b; border: 1px solid #27272a; border-radius: 16px; padding: 16px; text-align: left; font-size: 12px; color: #71717a; font-family: monospace;">
                <p style="margin: 0 0 4px 0;"><b>Сервер (Host):</b> ${smtpHost}</p>
                <p style="margin: 0 0 4px 0;"><b>Порт:</b> ${smtpPort}</p>
                <p style="margin: 0 0 4px 0;"><b>Відправник:</b> ${smtpUser}</p>
                <p style="margin: 0;"><b>Отримувач тесту:</b> ${targetEmail}</p>
              </div>
              <p style="margin-top: 25px; font-size: 11px; color: #52525b; text-transform: uppercase; letter-spacing: 2px;">
                SKY GARDEN • СИСТЕМА ЕЛЕКТРОННИХ КВИТКІВ
              </p>
            </div>
          </div>
        `
      });

      return res.json({
        success: true,
        message: `Тестовий лист успішно надіслано на ${targetEmail}!`,
        messageId: info.messageId
      });
    } catch (err: any) {
      console.error("SMTP Test Error:", err);
      let errorHint = err.message || "Невідома помилка підключення до SMTP";
      if (errorHint.includes("535") || errorHint.includes("BadCredentials") || errorHint.includes("Username and Password not accepted") || errorHint.includes("Invalid login")) {
        errorHint = "Помилка авторизації (535): Невірний логін або пароль. Для Ukr.net чи Gmail потрібно створити спеціальний «Пароль для зовнішніх програм» у налаштуваннях пошти, а не вводити звичайний пароль від акаунту.";
      } else if (errorHint.includes("ETIMEDOUT") || errorHint.includes("ECONNREFUSED") || errorHint.includes("ENOTFOUND")) {
        errorHint = `Помилка з'єднання з поштовим сервером (${err.code || 'Мережева помилка'}). Перевірте правильність SMTP Host та порту (зазвичай 465 з SSL).`;
      }
      return res.status(400).json({
        success: false,
        error: errorHint
      });
    }
  });

  // ==========================================
  // USER CABINET & AUTHENTICATION ENDPOINTS
  // ==========================================

  // Cabinet: User Registration
  app.post("/api/cabinet/register", async (req: any, res: any) => {
    try {
      const { email, password, name, surname, phone } = req.body || {};
      if (!email || !password) {
        return res.status(400).json({ error: "Email та пароль є обов'язковими для реєстрації" });
      }
      const rawEmail = String(email).trim().toLowerCase();
      if (!rawEmail.includes("@")) {
        return res.status(400).json({ error: "Вкажіть коректну адресу електронної пошти" });
      }
      const passTrimmed = String(password).trim();
      if (passTrimmed.length < 4) {
        return res.status(400).json({ error: "Пароль повинен містити щонайменше 4 символи" });
      }

      const userRef = doc(db, 'users', rawEmail);
      const snap = await getDoc(userRef);

      if (snap.exists()) {
        const existing = snap.data();
        if (existing.hasCustomPassword) {
          return res.status(400).json({ error: "Акаунт з таким email вже існує. Будь ласка, увійдіть або відновіть пароль." });
        } else {
          // Upgrade user with custom password
          const updatedUser: any = {
            ...existing,
            name: name ? String(name).trim() : (existing.name || ''),
            surname: surname ? String(surname).trim() : (existing.surname || ''),
            phone: phone ? String(phone).trim() : (existing.phone || ''),
            password: passTrimmed,
            hasCustomPassword: true,
            tempPassword: null,
            updatedAt: Date.now()
          };
          await setDoc(userRef, updatedUser, { merge: true });
          return res.json({
            success: true,
            user: {
              id: rawEmail,
              email: rawEmail,
              phone: updatedUser.phone,
              name: updatedUser.name,
              surname: updatedUser.surname,
              hasCustomPassword: true,
              createdAt: updatedUser.createdAt || Date.now()
            }
          });
        }
      }

      // Check if there are past orders with this email to pre-fill name/phone
      let initialName = name ? String(name).trim() : '';
      let initialSurname = surname ? String(surname).trim() : '';
      let initialPhone = phone ? String(phone).trim() : '';

      if (!initialName || !initialPhone) {
        try {
          const ordersSnap = await getDocs(collection(db, 'orders'));
          ordersSnap.forEach(d => {
            const ord = d.data();
            if (String(ord.email || '').toLowerCase().trim() === rawEmail) {
              if (!initialName && ord.name) initialName = ord.name;
              if (!initialSurname && ord.surname) initialSurname = ord.surname;
              if (!initialPhone && ord.phone) initialPhone = ord.phone;
            }
          });
        } catch (e) {
          console.warn("Could not check past orders on registration:", e);
        }
      }

      const newUser = {
        email: rawEmail,
        name: initialName,
        surname: initialSurname,
        phone: initialPhone,
        password: passTrimmed,
        hasCustomPassword: true,
        tempPassword: null,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await setDoc(userRef, newUser);

      return res.json({
        success: true,
        user: {
          id: rawEmail,
          email: rawEmail,
          phone: newUser.phone,
          name: newUser.name,
          surname: newUser.surname,
          hasCustomPassword: true,
          createdAt: newUser.createdAt
        }
      });
    } catch (err: any) {
      console.error("Cabinet Register Error:", err.message);
      return res.status(500).json({ error: err.message || "Помилка при реєстрації" });
    }
  });

  // Cabinet: User Login (by email or phone + temporary or custom password)
  app.post("/api/cabinet/login", async (req: any, res: any) => {
    try {
      const { identifier, password } = req.body || {};
      if (!identifier || !password) {
        return res.status(400).json({ error: "Вкажіть логін (email або телефон) та пароль" });
      }
      const raw = String(identifier).trim();
      const isEmail = raw.includes("@");
      const normalizedDigits = raw.replace(/[^\d]/g, '');

      let userDoc: any = null;
      let userId: string = '';

      if (isEmail) {
        const userRef = doc(db, 'users', raw.toLowerCase());
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          userDoc = snap.data();
          userId = snap.id;
        } else {
          // Also search users collection by field
          const usersSnap = await getDocs(collection(db, 'users'));
          usersSnap.forEach(d => {
            const u = d.data();
            if (String(u.email || '').toLowerCase().trim() === raw.toLowerCase()) {
              userDoc = u;
              userId = d.id;
            }
          });
        }
      } else if (normalizedDigits.length >= 6) {
        // Look up by phone in users collection
        const usersSnap = await getDocs(collection(db, 'users'));
        usersSnap.forEach(d => {
          const u = d.data();
          const uPhoneDigits = String(u.phone || '').replace(/[^\d]/g, '');
          if (
            (uPhoneDigits && uPhoneDigits.includes(normalizedDigits)) || 
            (normalizedDigits && normalizedDigits.includes(uPhoneDigits)) || 
            (normalizedDigits.length >= 9 && uPhoneDigits.slice(-9) === normalizedDigits.slice(-9))
          ) {
            userDoc = u;
            userId = d.id;
          }
        });
      }

      // If user doesn't exist in 'users' collection yet, check existing orders to bootstrap account
      if (!userDoc) {
        const ordersSnap = await getDocs(collection(db, 'orders'));
        let foundOrder: any = null;
        ordersSnap.forEach(d => {
          const ord = d.data();
          if (isEmail && String(ord.email || '').toLowerCase().trim() === raw.toLowerCase()) {
            foundOrder = ord;
          } else if (!isEmail && normalizedDigits.length >= 6) {
            const ordDigits = String(ord.phone || '').replace(/[^\d]/g, '');
            if (ordDigits.includes(normalizedDigits) || normalizedDigits.includes(ordDigits)) {
              foundOrder = ord;
            }
          }
        });

        if (foundOrder && foundOrder.email) {
          const resInfo = await getOrCreateUserForOrder(foundOrder.email, foundOrder.phone, foundOrder.name, foundOrder.surname);
          userDoc = resInfo.user;
          userId = foundOrder.email.toLowerCase().trim();
        }
      }

      if (!userDoc) {
        return res.status(404).json({ error: "Користувача з такими даними не знайдено. Якщо ви ще не створили акаунт, оберіть «Реєстрація» нижче." });
      }

      const passTrimmed = String(password).trim();
      const matchesCustom = userDoc.hasCustomPassword && (userDoc.password === passTrimmed || userDoc.tempPassword === passTrimmed);
      const matchesTemp = !userDoc.hasCustomPassword && (userDoc.tempPassword === passTrimmed || userDoc.password === passTrimmed);

      if (!matchesCustom && !matchesTemp) {
        return res.status(401).json({ 
          error: "Невірний пароль. Якщо ви ще не змінювали пароль, скористайтеся тимчасовим паролем з листа або натисніть «Забули пароль?»." 
        });
      }

      return res.json({
        success: true,
        user: {
          id: userId || userDoc.email,
          email: userDoc.email,
          phone: userDoc.phone || '',
          name: userDoc.name || '',
          surname: userDoc.surname || '',
          hasCustomPassword: !!userDoc.hasCustomPassword,
          createdAt: userDoc.createdAt || Date.now()
        }
      });
    } catch (err: any) {
      console.error("Cabinet Login Error:", err.message);
      return res.status(500).json({ error: err.message });
    }
  });

  // Cabinet: Request Password Reset Code (sent to email)
  app.post("/api/cabinet/forgot-password", async (req: any, res: any) => {
    try {
      const { identifier } = req.body || {};
      if (!identifier || typeof identifier !== 'string') {
        return res.status(400).json({ error: "Вкажіть ваш email або номер телефону" });
      }
      const raw = identifier.trim();
      const isEmail = raw.includes("@");
      const normalizedDigits = raw.replace(/[^\d]/g, '');

      let targetEmail = '';
      let targetName = 'Клієнт';

      if (isEmail) {
        targetEmail = raw.toLowerCase();
        const uSnap = await getDoc(doc(db, 'users', targetEmail));
        if (uSnap.exists()) {
          targetName = uSnap.data().name || targetName;
        }
      } else if (normalizedDigits.length >= 6) {
        // Find email by phone from users collection
        const usersSnap = await getDocs(collection(db, 'users'));
        usersSnap.forEach(d => {
          const u = d.data();
          const uDigits = String(u.phone || '').replace(/[^\d]/g, '');
          if (uDigits.includes(normalizedDigits) || normalizedDigits.includes(uDigits)) {
            targetEmail = u.email;
            targetName = u.name || targetName;
          }
        });

        // Or fallback to orders
        if (!targetEmail) {
          const ordersSnap = await getDocs(collection(db, 'orders'));
          ordersSnap.forEach(d => {
            const ord = d.data();
            const ordDigits = String(ord.phone || '').replace(/[^\d]/g, '');
            if (ordDigits.includes(normalizedDigits) || normalizedDigits.includes(ordDigits)) {
              targetEmail = ord.email;
              targetName = ord.name || targetName;
            }
          });
        }
      }

      if (!targetEmail) {
        return res.status(404).json({ error: "Акаунт з такими даними не знайдено." });
      }

      // Generate 6-digit verification code
      const resetCode = String(Math.floor(100000 + Math.random() * 900000));
      const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes

      await setDoc(doc(db, 'password_resets', targetEmail), {
        code: resetCode,
        email: targetEmail,
        expiresAt,
        createdAt: Date.now()
      });

      // Send email
      const privateSnap = await getDoc(doc(db, 'settings', 'private'));
      const pData = privateSnap.exists() ? privateSnap.data() : null;
      const smtpUser = pData?.smtpUser || process.env.SMTP_USER || "sky.party@ukr.net";
      const smtpPass = pData?.smtpPass || process.env.SMTP_PASS;
      let smtpHost = pData?.smtpHost || "smtp.ukr.net";
      let smtpPort = pData?.smtpPort ? Number(pData.smtpPort) : 465;

      if (smtpPass) {
        const userLower = smtpUser.toLowerCase().trim();
        if (!pData?.smtpHost) {
          if (userLower.endsWith("@gmail.com")) {
            smtpHost = "smtp.gmail.com";
            smtpPort = 465;
          } else if (userLower.endsWith("@yahoo.com")) {
            smtpHost = "smtp.mail.yahoo.com";
            smtpPort = 465;
          } else if (userLower.endsWith("@outlook.com") || userLower.endsWith("@hotmail.com")) {
            smtpHost = "smtp.office365.com";
            smtpPort = 587;
          }
        }

        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpPort === 465,
          auth: { user: smtpUser, pass: smtpPass },
          tls: { rejectUnauthorized: false }
        });

        const resetHtml = `
          <div style="font-family: -apple-system, system-ui, sans-serif; background: #050505; color: #ffffff; padding: 40px 20px; text-align: center;">
            <div style="max-width: 480px; margin: 0 auto; background: #0a0a0c; border-radius: 32px; border: 1px solid #1a1a1f; overflow: hidden; box-shadow: 0 25px 50px rgba(0,0,0,0.5);">
              <div style="background: linear-gradient(135deg, #7c3aed, #4c1d95); padding: 30px 20px; text-align: center;">
                <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 900; letter-spacing: 1px; text-transform: uppercase;">SKY PARTY</h1>
                <p style="color: rgba(255,255,255,0.7); margin: 6px 0 0 0; font-size: 11px; font-weight: bold; letter-spacing: 2px;">ВІДНОВЛЕННЯ ПАРОЛЮ</p>
              </div>
              <div style="padding: 35px 30px; text-align: center;">
                <p style="font-size: 15px; color: #d4d4d8; margin: 0 0 20px 0;">
                  Вітаємо${targetName ? `, <b>${targetName}</b>` : ''}! Отримано запит на зміну паролю для вашого особистого кабінету.
                </p>
                <div style="background: #111115; border: 1px solid #27272a; border-radius: 20px; padding: 25px; margin: 0 0 25px 0;">
                  <p style="font-size: 11px; color: #71717a; text-transform: uppercase; font-weight: 800; letter-spacing: 1.5px; margin: 0 0 10px 0;">ВАШ 6-ЗНАЧНИЙ КОД ПІДТВЕРДЖЕННЯ:</p>
                  <div style="font-size: 36px; font-weight: 900; letter-spacing: 8px; color: #c084fc; font-family: monospace; padding: 10px 0;">
                    ${resetCode}
                  </div>
                  <p style="font-size: 11px; color: #a1a1aa; margin: 10px 0 0 0;">
                    ⏳ Код дійсний протягом 15 хвилин
                  </p>
                </div>
                <p style="font-size: 12px; color: #52525b; margin: 0;">
                  Якщо ви не робили цей запит, просто проігноруйте цей лист.
                </p>
              </div>
              <div style="background: #050505; padding: 15px; font-size: 10px; color: #52525b; text-transform: uppercase; letter-spacing: 2px; border-top: 1px solid #1a1a1f;">
                SKY PARTY • SECURITY SYSTEM
              </div>
            </div>
          </div>
        `;

        await transporter.sendMail({
          from: smtpUser,
          to: targetEmail,
          subject: `Код відновлення паролю: ${resetCode} | Sky Garden`,
          html: resetHtml
        });
      }

      const masked = targetEmail.replace(/(.{2})(.*)(?=@)/, (gp1, gp2, gp3) => gp2 + "*".repeat(Math.max(1, gp3.length)));
      return res.json({
        success: true,
        email: targetEmail,
        message: `Код підтвердження надіслано на ${masked}`
      });
    } catch (err: any) {
      console.error("Forgot Password Error:", err.message);
      return res.status(500).json({ error: err.message });
    }
  });

  // Cabinet: Verify Reset Code
  app.post("/api/cabinet/verify-reset-code", async (req: any, res: any) => {
    try {
      const { email, code } = req.body || {};
      if (!email || !code) {
        return res.status(400).json({ error: "Вкажіть email та код" });
      }
      const normalizedEmail = email.toLowerCase().trim();
      const resetSnap = await getDoc(doc(db, 'password_resets', normalizedEmail));
      if (!resetSnap.exists()) {
        return res.status(400).json({ error: "Запит на відновлення не знайдено або застарів. Спробуйте надіслати новий код." });
      }
      const rData = resetSnap.data() as any;
      if (Date.now() > (rData.expiresAt || 0)) {
        return res.status(400).json({ error: "Час дії коду вичерпано. Надішліть новий код." });
      }
      if (String(rData.code).trim() !== String(code).trim()) {
        return res.status(400).json({ error: "Невірний код підтвердження" });
      }
      return res.json({ valid: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Cabinet: Reset Password using verified code
  app.post("/api/cabinet/reset-password", async (req: any, res: any) => {
    try {
      const { email, code, newPassword } = req.body || {};
      if (!email || !code || !newPassword) {
        return res.status(400).json({ error: "Вкажіть email, код та новий пароль" });
      }
      if (String(newPassword).length < 4) {
        return res.status(400).json({ error: "Пароль повинен містити щонайменше 4 символи" });
      }
      const normalizedEmail = email.toLowerCase().trim();
      const resetRef = doc(db, 'password_resets', normalizedEmail);
      const resetSnap = await getDoc(resetRef);
      if (!resetSnap.exists()) {
        return res.status(400).json({ error: "Запит на відновлення застарів. Надішліть код повторно." });
      }
      const rData = resetSnap.data() as any;
      if (Date.now() > (rData.expiresAt || 0)) {
        return res.status(400).json({ error: "Час дії коду вичерпано" });
      }
      if (String(rData.code).trim() !== String(code).trim()) {
        return res.status(400).json({ error: "Невірний код підтвердження" });
      }

      const userRef = doc(db, 'users', normalizedEmail);
      const userSnap = await getDoc(userRef);
      let existingUser: any = {};
      if (userSnap.exists()) {
        existingUser = userSnap.data();
      }

      const updatedUser = {
        email: normalizedEmail,
        phone: existingUser.phone || '',
        name: existingUser.name || '',
        surname: existingUser.surname || '',
        password: String(newPassword).trim(),
        hasCustomPassword: true,
        tempPassword: null,
        updatedAt: Date.now()
      };

      await setDoc(userRef, updatedUser, { merge: true });
      await deleteDoc(resetRef);

      return res.json({
        success: true,
        user: {
          id: normalizedEmail,
          email: updatedUser.email,
          phone: updatedUser.phone,
          name: updatedUser.name,
          surname: updatedUser.surname,
          hasCustomPassword: true
        }
      });
    } catch (err: any) {
      console.error("Reset Password Error:", err.message);
      return res.status(500).json({ error: err.message });
    }
  });

  // Cabinet: Change Password in Profile
  app.post("/api/cabinet/change-password", async (req: any, res: any) => {
    try {
      const { email, oldPassword, newPassword } = req.body || {};
      if (!email || !newPassword) {
        return res.status(400).json({ error: "Вкажіть email та новий пароль" });
      }
      if (String(newPassword).length < 4) {
        return res.status(400).json({ error: "Пароль повинен містити щонайменше 4 символи" });
      }
      const normalizedEmail = email.toLowerCase().trim();
      const userRef = doc(db, 'users', normalizedEmail);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        return res.status(404).json({ error: "Користувача не знайдено" });
      }

      const userDoc = userSnap.data() as any;
      if (oldPassword) {
        const oldTrimmed = String(oldPassword).trim();
        const match = (userDoc.password && userDoc.password === oldTrimmed) || 
                      (userDoc.tempPassword && userDoc.tempPassword === oldTrimmed);
        if (!match) {
          return res.status(401).json({ error: "Поточний пароль введено невірно" });
        }
      }

      const updates = {
        password: String(newPassword).trim(),
        hasCustomPassword: true,
        tempPassword: null,
        updatedAt: Date.now()
      };

      await updateDoc(userRef, updates);

      return res.json({
        success: true,
        user: {
          id: normalizedEmail,
          email: userDoc.email,
          phone: userDoc.phone || '',
          name: userDoc.name || '',
          surname: userDoc.surname || '',
          hasCustomPassword: true
        }
      });
    } catch (err: any) {
      console.error("Change Password Error:", err.message);
      return res.status(500).json({ error: err.message });
    }
  });

  // Cabinet: Update Personal Profile (Name, Surname, Phone)
  app.post("/api/cabinet/update-profile", async (req: any, res: any) => {
    try {
      const { email, name, surname, phone } = req.body || {};
      if (!email) {
        return res.status(400).json({ error: "Email є обов'язковим" });
      }
      const normalizedEmail = email.toLowerCase().trim();
      const userRef = doc(db, 'users', normalizedEmail);
      const userSnap = await getDoc(userRef);

      let userDoc: any = {};
      if (userSnap.exists()) {
        userDoc = userSnap.data();
      }

      const updates = {
        email: normalizedEmail,
        name: typeof name === 'string' ? name.trim() : (userDoc.name || ''),
        surname: typeof surname === 'string' ? surname.trim() : (userDoc.surname || ''),
        phone: typeof phone === 'string' ? phone.trim() : (userDoc.phone || ''),
        updatedAt: Date.now()
      };

      await setDoc(userRef, updates, { merge: true });

      return res.json({
        success: true,
        user: {
          id: normalizedEmail,
          email: normalizedEmail,
          name: updates.name,
          surname: updates.surname,
          phone: updates.phone,
          hasCustomPassword: !!userDoc.hasCustomPassword
        }
      });
    } catch (err: any) {
      console.error("Update Profile Error:", err.message);
      return res.status(500).json({ error: err.message });
    }
  });

  // User Cabinet: Fetch orders by email or phone
  app.post("/api/cabinet/orders", async (req: any, res: any) => {
    try {
      const { identifier } = req.body || {};
      if (!identifier || typeof identifier !== 'string') {
        return res.status(400).json({ error: "Identifier is required" });
      }

      const raw = identifier.trim();
      const isEmail = raw.includes("@");
      const normalizedDigits = raw.replace(/[^\d]/g, '');

      const ordersSnap = await getDocs(collection(db, 'orders'));
      const matchingOrders: any[] = [];

      ordersSnap.forEach((docSnap) => {
        const data = docSnap.data() as Record<string, any>;
        const order: any = { id: docSnap.id, ...data };

        if (isEmail) {
          if (String(order.email || '').toLowerCase().trim() === raw.toLowerCase()) {
            matchingOrders.push(order);
          }
        } else if (normalizedDigits.length >= 6) {
          const orderPhoneDigits = String(order.phone || '').replace(/[^\d]/g, '');
          if (
            orderPhoneDigits.includes(normalizedDigits) || 
            normalizedDigits.includes(orderPhoneDigits) ||
            orderPhoneDigits.slice(-9) === normalizedDigits.slice(-9)
          ) {
            matchingOrders.push(order);
          }
        }
      });

      // Enrich with event data
      const eventsCache: Record<string, any> = {};
      const enrichedOrders = await Promise.all(
        matchingOrders.map(async (order) => {
          if (!order.eventId) return order;
          if (!eventsCache[order.eventId]) {
            try {
              const eventSnap = await getDoc(doc(db, 'events', order.eventId));
              if (eventSnap.exists()) {
                eventsCache[order.eventId] = { id: eventSnap.id, ...eventSnap.data() };
              }
            } catch (err) {
              console.warn("Could not fetch event for cabinet order:", order.id);
            }
          }
          return { ...order, event: eventsCache[order.eventId] };
        })
      );

      enrichedOrders.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      return res.json({ orders: enrichedOrders });
    } catch (err: any) {
      console.error("Cabinet API Error:", err.message);
      return res.status(500).json({ error: err.message });
    }
  });

  // Register development Vite middleware or production static site loader (only in standalone Node server mode)
  async function startServer() {
    if (process.env.NODE_ENV !== "production") {
      try {
        const { createServer: createViteServer } = await import("vite");
        const vite = await createViteServer({
          server: { middlewareMode: true },
          appType: "spa",
        });
        app.use(vite.middlewares);
      } catch (viteErr) {
        console.warn("Vite middleware could not be loaded, continuing without Vite middleware:", viteErr);
      }
    } else {
      const distPath = path.join(process.cwd(), "dist");
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }

  // Start server in dev/standalone mode
  if (!process.env.FUNCTION_TARGET) {
    startServer().catch(console.error);
  }

  // Export the Firebase function
  export const api = onRequest({
    cors: true,
    maxInstances: 10,
    memory: "256MiB",
    invoker: "public"
  }, app);
