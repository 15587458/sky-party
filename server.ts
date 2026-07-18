import express from "express";
import path from "path";
import axios from "axios";
import nodemailer from "nodemailer";
import { onRequest } from "firebase-functions/v2/https";
import admin from "firebase-admin";
import firebaseConfig from "./firebase-applet-config.json";

const app = express();
const PORT = 3000;

let dbAdmin: admin.firestore.Firestore;

if (admin.apps.length === 0) {
  admin.initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

const adminDatabaseId = (!firebaseConfig.firestoreDatabaseId || firebaseConfig.firestoreDatabaseId === "(default)")
  ? "(default)"
  : firebaseConfig.firestoreDatabaseId;

dbAdmin = new admin.firestore.Firestore({
  projectId: firebaseConfig.projectId,
  databaseId: adminDatabaseId
});

async function ensureDefaultDatabaseSeeded() {
  console.log(`Checking database '${adminDatabaseId}' for automatic seeding...`);
  try {
    const eventsSnap = await dbAdmin.collection('events').limit(1).get();
    if (eventsSnap.empty) {
      console.log("Database is empty. Initiating automatic seeding...");

      // 1. Config settings
      const defaultConfig = {
        logoUrl: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 500 500' width='500' height='500'%3E%3Cdefs%3E%3ClinearGradient id='gold' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%23FFE082' /%3E%3Cstop offset='30%25' stop-color='%23FFB300' /%3E%3Cstop offset='50%25' stop-color='%23FFF8E1' /%3E%3Cstop offset='70%25' stop-color='%23FFC107' /%3E%3Cstop offset='100%25' stop-color='%23B78A02' /%3E%3C/linearGradient%3E%3C/defs%3E%3Ccircle cx='250' cy='250' r='195' fill='none' stroke='url(%23gold)' stroke-width='4.5' /%3E%3Ccircle cx='250' cy='250' r='181' fill='none' stroke='url(%23gold)' stroke-width='1.5' /%3E%3Cg transform='translate(0, -5)'%3E%3Cpath d='M 226 185 a 14 14 0 0 1 18 -11 a 20 20 0 0 1 27 -4 a 18 18 0 0 1 11 19 a 13 13 0 0 1 -3 9 l -50 0 a 14 14 0 0 1 -3 -13 Z' fill='white' opacity='0.95' /%3E%3Cpath d='M 283 162 L 284.5 166 L 288.5 166 L 285.3 168.5 L 286.5 172.5 L 283 170 L 279.5 172.5 L 280.7 168.5 L 277.5 166 L 281.5 166 Z' fill='url(%23gold)' /%3E%3C/g%3E%3Ctext x='250' y='278' font-family='sans-serif' font-size='68' font-weight='900' fill='url(%23gold)' text-anchor='middle' letter-spacing='12'%3ESKY%3C/text%3E%3Ctext x='250' y='348' font-family='sans-serif' font-size='62' font-weight='900' fill='url(%23gold)' text-anchor='middle' letter-spacing='10'%3EPARTY%3C/text%3E%3C/svg%3E",
        instagramUrl: 'https://instagram.com/sky_party_kyiv',
        telegramUrl: 'https://t.me/sky_party_kyiv',
        facebookUrl: 'https://facebook.com/skypartykyiv',
        bannerTitle: 'SKY PARTY',
        footerText: 'SKY PARTY — ТВОЄ НЕБО, ТВОЯ ВЕЧІРКА.',
        noEventsMessage: 'Зараз немає актуальних подій',
        aboutText: `Sky Party — це не просто серія вечірок, а новий рівень нічного життя та твій унікальний вимір нічних івентів. Ми об'єднуємо кращих артистів, сучасне світлове шоу та неповторну атмосферу, щоб створити незабутні спогади, що залишаються назавжди.\n\nНаша місія — дарувати емоції через преміальний звук та візуальне мистецтво. Кожна подія продумана до найдрібніших деталей, від вибору унікальної локації до коктейльної карти.`,
        contactEmail: 'info@skyparty.ua',
        contactAddress: 'м. Київ, вул. Паркова, 12',
        primaryColor: '#a855f7'
      };
      await dbAdmin.collection('config').doc('settings').set(defaultConfig);
      console.log("Seeded config/settings.");

      // 2. Private Settings
      const defaultPrivateSettings = {
        monobankToken: "",
        smtpUser: "",
        smtpPass: "",
        telegramBotToken: "",
        telegramChatId: ""
      };
      await dbAdmin.collection('settings').doc('private').set(defaultPrivateSettings);
      console.log("Seeded settings/private.");

      // 3. Create default seating chart
      const chartId = 'default-chart-1';
      const defaultChart = {
        name: 'SKY GARDEN Seating Chart',
        backgroundImage: '',
        elementsCount: 6,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      await dbAdmin.collection('charts').doc(chartId).set(defaultChart);
      console.log("Seeded default chart.");

      // 4. Create default seating elements
      const elements = [
        { id: 'seat-1', type: 'seat', x: 200, y: 150, label: 'Стіл 1, Місце A', priceType: 'standard', parentId: '' },
        { id: 'seat-2', type: 'seat', x: 200, y: 220, label: 'Стіл 1, Місце B', priceType: 'standard', parentId: '' },
        { id: 'seat-3', type: 'seat', x: 400, y: 150, label: 'Стіл 2, Місце A', priceType: 'standard', parentId: '' },
        { id: 'seat-4', type: 'seat', x: 400, y: 220, label: 'Стіл 2, Місце B', priceType: 'standard', parentId: '' },
        { id: 'seat-5', type: 'seat', x: 600, y: 150, label: 'VIP Стіл 3, Місце A', priceType: 'vip', parentId: '' },
        { id: 'seat-6', type: 'seat', x: 600, y: 220, label: 'VIP Стіл 3, Місце B', priceType: 'vip', parentId: '' }
      ];
      const elementsCol = dbAdmin.collection('charts').doc(chartId).collection('elements');
      for (const el of elements) {
        await elementsCol.doc(el.id).set(el);
      }
      console.log("Seeded default chart elements.");

      // 5. Create default active event
      const defaultEvent = {
        title: 'SKY PARTY: OPEN AIR',
        description: 'Найкраща вечірка літа. Танці під відкритим небом, коктейлі та неймовірна атмосфера.',
        date: '2026-08-15T20:00', // Future date
        location: 'Київ, SKY GARDEN',
        price: '500',
        vipPrice: '1500',
        imageUrl: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&q=80',
        ticketLink: '#',
        isActive: true,
        chartId: chartId,
        hasSeatingChart: true,
        createdAt: Date.now()
      };
      await dbAdmin.collection('events').add(defaultEvent);
      console.log("Seeded default active event.");

      console.log("Database automatic seeding completed successfully!");
    } else {
      console.log("Database contains existing events. Skipping seeding.");
    }
  } catch (err) {
    console.error("Error during automatic database seeding:", err);
  }
}

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

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
      return res.status(400).json({ error: "X-Token Monobank є обов'язковим для створення інвойсу" });
    }

    try {
      const response = await axios.post(
        "https://api.monobank.ua/api/merchant/invoice/create",
        { amount, ccy, reference, merchantPaymInfo, redirectUrl, webHookUrl },
        { headers: { "X-Token": token } }
      );
      console.log("Monobank Invoice Created Successfully:", response.data);
      res.json(response.data);
    } catch (error: any) {
      const errorData = error.response?.data || error.message;
      console.error("Monobank Invoice Creation API Error:", errorData);
      
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
          errText: `Помилка мережі (Код: ${error.code || 'TIMEOUT'}, Опис: ${error.message}). Якщо ви виявили це на Firebase hosting, переконайтеся, що ви вже підключили тариф Blaze і повторно розгорнули (deploy) проєкт. Spark-план повністю блокує будь-які запити до зовнішніх сайтів. Деталі помилки: ${rawDetail}`
        };
      }
      res.status(500).json({ error: friendlyError || "Internal Server Error" });
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
      const orderRef = dbAdmin.collection('orders').doc(orderId);
      const isAlreadySentSnap = await orderRef.get();
      if (!isAlreadySentSnap.exists) {
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
        dbAdmin.collection('settings').doc('private').get(),
        dbAdmin.collection('config').doc('settings').get(),
        dbAdmin.collection('events').doc(orderData.eventId).get()
      ]);

      const privateSettings = privateSnap.exists ? privateSnap.data() : null;
      const config = configSnap.exists ? configSnap.data() : null;
      const event = eventSnap.exists ? eventSnap.data() : null;

      // Load seating label if applicable
      let selectedSeat: any = null;
      if (orderData.elementId && event && event.chartId) {
        try {
          const elementSnap = await dbAdmin.collection('charts').doc(event.chartId).collection('elements').doc(orderData.elementId).get();
          if (elementSnap.exists) {
            selectedSeat = elementSnap.data();
          }
        } catch (seatErr) {
          console.error("Purchase Notification -> Error loading seat info:", seatErr);
        }
      }

      // Build dynamic ticket text
      const quantity = orderData.quantity || 1;
      const ticketType = orderData.ticketType || 'standard';
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
      await orderRef.update({ notificationsSent: true });
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
        const privateSnap = await dbAdmin.collection('settings').doc('private').get();
        if (privateSnap.exists) {
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
      const orderRef = dbAdmin.collection('orders').doc(orderId);
      const orderSnap = await orderRef.get();

      if (!orderSnap.exists) {
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
        await orderRef.update({ status: 'paid' });
        console.log(`Status Check Secure -> Order ${orderId} is paid successfully!`);
        sendNotificationsForPaidOrder(orderId, { ...order, status: 'paid' });
        return res.json({ status: 'paid', order: { ...order, status: 'paid' } });
      } else if (monobankStatus === "reversed" && order.status !== "reversed" && order.status !== "cancelled") {
        await orderRef.update({ status: "cancelled" });
        return res.json({ status: 'cancelled', order: { ...order, status: 'cancelled' } });
      } else if ((monobankStatus === "failure" || monobankStatus === "expired") && order.status === "pending") {
        await orderRef.update({ status: "cancelled" });
        return res.json({ status: 'cancelled', order: { ...order, status: 'cancelled' } });
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
          const orderRef = dbAdmin.collection('orders').doc(orderId);
          const orderSnap = await orderRef.get();
          if (orderSnap.exists) {
            orderDoc = orderSnap;
          }
        }

        // 2. Fallback: Search by monobankInvoiceId in orders collection
        if (!orderDoc && invoiceId) {
          console.log(`Webhook -> Order not found by reference ID. Searching orders by monobankInvoiceId = ${invoiceId}`);
          const querySnap = await dbAdmin.collection('orders').where('monobankInvoiceId', '==', invoiceId).limit(1).get();
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
              const privateSnap = await dbAdmin.collection('settings').doc('private').get();
              if (privateSnap.exists) {
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
            try {
              const checkResponse = await axios.get(
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

            const orderRef = dbAdmin.collection('orders').doc(orderId);
            // Secure update: Mark order as paid
            const updateFields: any = { status: 'paid' };
            if (targetInvoiceId && !order.monobankInvoiceId) {
              updateFields.monobankInvoiceId = targetInvoiceId;
            }
            await orderRef.update(updateFields);
            console.log(`Webhook secure check -> Order ${orderId} successfully validated and marked as paid.`);

            // Send notification triggers asynchronously
            sendNotificationsForPaidOrder(orderId, { ...order, status: 'paid' });
            
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
          const orderRef = dbAdmin.collection('orders').doc(orderId);
          const orderSnap = await orderRef.get();
          if (orderSnap.exists) {
            orderDoc = orderSnap;
          }
        }

        if (!orderDoc && invoiceId) {
          const querySnap = await dbAdmin.collection('orders').where('monobankInvoiceId', '==', invoiceId).limit(1).get();
          if (!querySnap.empty) {
            orderDoc = querySnap.docs[0];
            orderId = orderDoc.id;
          }
        }

        if (orderDoc) {
          const order = orderDoc.data() as any;
          if (order.status === 'pending') {
            const orderRef = dbAdmin.collection('orders').doc(orderId);
            await orderRef.update({ status: 'cancelled' });
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
        const privateSnap = await dbAdmin.collection('settings').doc('private').get();
        if (privateSnap.exists) {
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
          const privateSnap = await dbAdmin.collection('settings').doc('private').get();
          if (privateSnap.exists) {
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

  // Register development Vite middleware or production static site loader
  async function startServer() {
    await ensureDefaultDatabaseSeeded();
    if (process.env.NODE_ENV !== "production") {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), "dist");
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }

    if (!process.env.FUNCTION_TARGET) {
      app.listen(PORT, "0.0.0.0", () => {
        console.log(`Server running on http://localhost:${PORT}`);
      });
    }
  }

  startServer().catch(console.error);

  // Export the Firebase function
  export const api = onRequest({
    cors: true,
    maxInstances: 10,
    memory: "256MiB",
    invoker: "public"
  }, app);
