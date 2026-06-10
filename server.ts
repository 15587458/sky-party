import express from "express";
import path from "path";
import axios from "axios";
import nodemailer from "nodemailer";
import { fileURLToPath } from "url";
import { onRequest } from "firebase-functions/v2/https";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// API Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

  // Monobank Create Invoice
  app.post("/api/monobank/invoice", async (req, res) => {
    const { amount, ccy, merchantPaymInfo, redirectUrl, webHookUrl, token } = req.body;
    
    try {
      const response = await axios.post(
        "https://api.monobank.ua/api/merchant/invoice/create",
        { amount, ccy, merchantPaymInfo, redirectUrl, webHookUrl },
        { headers: { "X-Token": token } }
      );
      res.json(response.data);
    } catch (error: any) {
      console.error("Monobank Error:", error.response?.data || error.message);
      res.status(500).json({ error: error.response?.data || "Internal Server Error" });
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

    try {
      const payload: any = { invoiceId };
      if (amount && amount > 0) {
        payload.amount = Math.ceil(amount); // in kopecks
      }

      console.log("Sending Monobank Refund Payload:", payload);

      const response = await axios.post(
        "https://api.monobank.ua/api/merchant/invoice/cancel",
        payload,
        { headers: { "X-Token": token } }
      );
      res.json(response.data);
    } catch (error: any) {
      console.error("Monobank Refund Error:", error.response?.data || error.message);
      res.status(500).json({ error: error.response?.data || "Internal Server Error" });
    }
  });
  
  // Monobank Webhook
  app.post("/api/monobank/webhook", async (req, res) => {
    const { status, reference } = req.body;
    console.log("Monobank Webhook Received:", { status, reference });

    // Note: In a real production app, you should verify the signature 
    // and use Firebase Admin SDK to update the database securely.
    // For this prototype, we'll assume the webhook is genuine if it has a reference.
    
    if (status === "success" && reference) {
      // The reference should be the order ID
      console.log(`Payment success for order: ${reference}`);
      // The actual Firestore update will happen via the 'paid' URL parameter in the frontend
      // or we would need Firebase Admin SDK here.
    }
    
    res.json({ status: "ok" });
  });

  // Send Email Ticket
  app.post("/api/email/ticket", async (req, res) => {
    const { email, subject, html, smtpUser, smtpPass, orderDetails, pdfAttachments } = req.body;
    
    if (!smtpUser || !smtpPass) {
      return res.status(400).json({ error: "SMTP credentials missing" });
    }

    try {
      const transporter = nodemailer.createTransport({
        host: "smtp.ukr.net",
        port: 465,
        secure: true,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
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
          to: "sky.patry@ukr.net",
          subject: `⚡ [${quantity} шт] ${name} -> ${eventTitle}`,
          html: staffHtml,
        });

        // 3. Telegram Notification
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        const chatId = process.env.TELEGRAM_CHAT_ID;

        if (botToken && chatId) {
          const telegramMessage = 
            `🔥 <b>НОВЕ ЗАМОВЛЕННЯ</b>\n\n` +
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
            console.log("Telegram notification sent");
          } catch (tgError: any) {
            console.error("Telegram Error:", tgError.response?.data || tgError.message);
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
    memory: "256MiB"
  }, app);
