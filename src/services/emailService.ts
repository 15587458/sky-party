import axios from 'axios';
import { Event, Order, PrivateSettings, ChartElement, SiteConfig } from '../types';

export const sendTicketEmail = async (
  orderId: string, 
  email: string, 
  name: string, 
  surname: string, 
  event: Event, 
  ticketType: string, 
  privateSettings: PrivateSettings | null,
  selectedSeat?: ChartElement,
  quantity: number = 1,
  config?: SiteConfig | null
) => {
  if (!privateSettings?.smtpPass) {
    console.warn('SMTP Password not configured client-side, proceeding to let backend use its own secure settings fallback.');
  }

  // 1. Generate PDF Attachments client-side before dispatching
  const pdfAttachments: { filename: string; base64: string }[] = [];
  try {
    const { jsPDF } = await import('jspdf');
    const { toPng } = await import('html-to-image');
    const { getBase64ImageSafe, generateQRCodeBase64 } = await import('./pdfService');

    // Resolve images safely
    let eventBase64 = '';
    if (event.imageUrl) {
      try {
        eventBase64 = await getBase64ImageSafe(event.imageUrl);
      } catch (e) {
        console.warn('Could not load base64 for event image of email PDF:', e);
      }
    }
    
    let logoBase64 = '';
    const customLogo = config?.ticketLogoUrl || config?.logoUrl || '';
    if (customLogo) {
      try {
        logoBase64 = await getBase64ImageSafe(customLogo);
      } catch (e) {
        console.warn('Could not load base64 for logo image of email PDF:', e);
      }
    }

    const tBg = config?.ticketBgColor || '#0a0a0c';
    const tText = config?.ticketTextColor || '#ffffff';
    const tAccent = config?.ticketAccentColor || '#a855f7';
    const tBorder = config?.ticketBorderColor || '#1f1f23';
    const tMsg = config?.ticketMessage || 'ПРИ ВХОДІ ПРЕД\'ЯВІТЬ ЦЕЙ QR-КОД';

    // Loop through quantity to generate accurate PDFs
    for (let i = 0; i < quantity; i++) {
      const qrBase64 = await generateQRCodeBase64(`${orderId}:${i + 1}`);

      const tempDiv = document.createElement('div');
      tempDiv.id = `temp-email-pdf-${i}`;
      tempDiv.style.position = 'fixed';
      tempDiv.style.top = '0';
      tempDiv.style.left = '0';
      tempDiv.style.width = '550px';
      tempDiv.style.zIndex = '-9999';
      tempDiv.style.pointerEvents = 'none';

      tempDiv.innerHTML = `
        <div style="font-family: system-ui, -apple-system, sans-serif; background: ${tBg}; color: ${tText}; padding: 35px; border-radius: 35px; border: 2px solid ${tBorder}; width: 550px; box-sizing: border-box; text-align: center; overflow: hidden; position: relative;">
          <!-- Ticket Header Logo -->
          <div style="margin-bottom: 20px;">
            ${logoBase64 ? `
              <img src="${logoBase64}" style="max-height: 44px; max-width: 250px; object-fit: contain; display: inline-block;" />
            ` : `
              <h2 style="margin: 0; color: ${tAccent}; font-size: 24px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase;">SKY PARTY</h2>
            `}
          </div>
          
          <!-- Event Hero Banner -->
          ${eventBase64 ? `
            <img src="${eventBase64}" style="width: 100%; height: 210px; object-fit: cover; border-radius: 20px; margin-bottom: 25px; border: 1px solid ${tBorder};" />
          ` : ''}

          <!-- Event Details -->
          <h1 style="font-size: 26px; font-weight: 950; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: -0.5px; color: ${tText}; leading: 1.1;">
            ${event.title}
          </h1>
          <p style="font-size: 13px; color: ${tAccent}; margin: 0 0 25px 0; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">
            ${new Date(event.date).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })} • ${event.location}
          </p>

          <!-- Holder Details Card -->
          <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid ${tBorder}; border-radius: 22px; padding: 20px; text-align: left; margin-bottom: 25px; box-sizing: border-box;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 15px; gap: 10px;">
              <div style="flex: 1; overflow: hidden;">
                <span style="font-size: 9px; color: #71717a; font-weight: 800; letter-spacing: 1px; display: block; text-transform: uppercase;">Власник квитка</span>
                <span style="font-size: 16px; font-weight: 800; color: ${tText}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block; margin-top: 2px;">${name} ${surname}</span>
              </div>
              <div style="text-align: right; shrink-0;">
                <span style="font-size: 9px; color: #71717a; font-weight: 800; letter-spacing: 1px; display: block; text-transform: uppercase;">Тип Квитка</span>
                <span style="font-size: 16px; font-weight: 800; color: ${tAccent}; display: block; margin-top: 2px;">${ticketType.toUpperCase()}</span>
              </div>
            </div>
            
            <div style="border-top: 1px dashed ${tBorder}; padding-top: 15px; display: flex; justify-content: space-between; align-items: center; gap: 10px;">
              <div>
                <span style="font-size: 9px; color: #71717a; font-weight: 800; letter-spacing: 1px; display: block; text-transform: uppercase;">Порядковий номер</span>
                <span style="font-size: 12px; font-family: monospace; color: #a1a1aa; font-weight: bold;">${orderId}-${i + 1}</span>
              </div>
              ${selectedSeat ? `
                <div style="text-align: right;">
                  <span style="font-size: 9px; color: #71717a; font-weight: 800; letter-spacing: 1px; display: block; text-transform: uppercase;">Місце</span>
                  <span style="font-size: 14px; font-weight: 800; color: ${tText}; margin-top: 2px; display: block;">${selectedSeat.label}</span>
                </div>
              ` : ''}
            </div>
          </div>

          <!-- Tear Line -->
          <div style="border-top: 2px dashed ${tBorder}; margin: 25px 0 25px 0;"></div>

          <!-- QR Code section -->
          <div style="background: white; padding: 18px; border-radius: 24px; display: inline-block; box-shadow: 0 10px 30px rgba(0,0,0,0.2); margin-bottom: 20px;">
            <img src="${qrBase64}" style="width: 180px; height: 180px; display: block;" />
          </div>

          <p style="font-size: 10px; color: #a1a1aa; font-weight: bold; letter-spacing: 1.5px; text-transform: uppercase; margin: 10px 0 0 0; line-height: 1.4;">
            ${tMsg}
          </p>
        </div>
      `;

      document.body.appendChild(tempDiv);
      await new Promise((r) => setTimeout(r, 300));

      const dataUrl = await toPng(tempDiv, { quality: 1.0, pixelRatio: 2.2 });
      document.body.removeChild(tempDiv);

      const pdfDoc = new jsPDF({ orientation: 'portrait', unit: 'px' });
      const imgProps = pdfDoc.getImageProperties(dataUrl);
      const w = imgProps.width;
      const h = imgProps.height;

      pdfDoc.deletePage(1);
      pdfDoc.addPage([w, h], 'portrait');
      pdfDoc.addImage(dataUrl, 'PNG', 0, 0, w, h);

      const base64PDF = pdfDoc.output('datauristring').split(',')[1];
      pdfAttachments.push({
        filename: `ticket-${orderId}-${i + 1}.pdf`,
        base64: base64PDF,
      });
    }
  } catch (pdfErr) {
    console.error('Failed to pre-compile PDF attachments for email:', pdfErr);
  }

  // 2. Build beautiful Email body
  try {
    const qrCodesHtml = Array.from({ length: quantity }).map((_, i) => `
      <div style="background: #111115; padding: 25px; border-radius: 24px; margin-bottom: 20px; border: 1px solid #222226; text-align: center;">
        <p style="font-size: 10px; color: #71717a; margin: 0 0 12px 0; text-transform: uppercase; font-weight: 900; letter-spacing: 1px;">КВИТОК ${i + 1} З ${quantity}</p>
        <div style="background: white; padding: 15px; border-radius: 18px; display: inline-block;">
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${orderId}:${i + 1}" alt="QR Code ${i + 1}" style="display: block; width: 180px; height: 180px;" />
        </div>
        <p style="font-size: 12px; color: #a1a1aa; margin: 12px 0 0 0; font-family: monospace; font-weight: bold;">ID: ${orderId}-${i + 1}</p>
      </div>
    `).join('');

    const html = `
      <div style="font-family: -apple-system, system-ui, sans-serif; background: #050505; color: #ffffff; padding: 40px 20px; text-align: center;">
        <div style="max-width: 540px; margin: 0 auto; background: #0a0a0c; border-radius: 36px; border: 1px solid #1a1a1f; overflow: hidden; box-shadow: 0 25px 60px rgba(0,0,0,0.65);">
          
          <!-- Header Banner -->
          <div style="background: linear-gradient(135deg, ${config?.primaryColor || '#7c3aed'}, #4c1d95); padding: 40px 20px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 30px; font-weight: 950; letter-spacing: 1.5px; text-transform: uppercase;">SKY PARTY</h1>
            <p style="color: rgba(255,255,255,0.7); margin: 8px 0 0 0; font-size: 12px; font-weight: bold; letter-spacing: 2px;">ТВОЄ НЕБО. ТВОЯ ВЕЧІРКА.</p>
          </div>

          <div style="padding: 40px 30px; text-align: left;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h2 style="color: #ffffff; margin: 0 0 8px 0; font-size: 24px; font-weight: 900; letter-spacing: -0.5px; text-transform: uppercase;">Ваші квитки готові!</h2>
              <p style="font-size: 15px; color: #a1a1aa; margin: 0;">Дякуємо за покупку. Електронні PDF квитки готові та прикріплені до цього листа.</p>
            </div>
            
            <!-- Event Info -->
            <div style="background: #111115; padding: 25px; border-radius: 24px; border: 1px solid #222226; margin-bottom: 30px;">
              <div style="margin-bottom: 20px; border-bottom: 1px dashed #222226; padding-bottom: 15px;">
                <p style="font-size: 10px; color: #71717a; margin: 0; text-transform: uppercase; font-weight: 900; letter-spacing: 1px;">ЗАХІД</p>
                <p style="font-size: 18px; font-weight: 900; margin: 6px 0; color: ${config?.primaryColor || '#a855f7'}; text-transform: uppercase;">${event.title}</p>
                <p style="font-size: 13px; color: #e4e4e7; margin: 0; font-weight: bold;">
                  ${new Date(event.date).toLocaleString('uk-UA')}
                </p>
              </div>

              <div style="display: flex; gap: 15px;">
                <div style="width: 50%;">
                  <p style="font-size: 10px; color: #71717a; margin: 0; text-transform: uppercase; font-weight: 900; letter-spacing: 1px;">КЛІЄНТ</p>
                  <p style="font-size: 14px; font-weight: 800; margin: 5px 0; color: #ffffff;">${name} ${surname}</p>
                  <p style="font-size: 11px; color: #71717a; margin: 0;">${email}</p>
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
            <h3 style="font-size: 12px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; color: #71717a; margin: 0 0 15px 10px;">ШВИДКЕ СКА can</h3>
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
    
    await axios.post('/api/email/ticket', {
      email,
      subject: `Ваш квиток на ${event.title}`,
      html,
      smtpUser: privateSettings?.smtpUser || '',
      smtpPass: privateSettings?.smtpPass || '',
      smtpHost: privateSettings?.smtpHost || '',
      smtpPort: privateSettings?.smtpPort || '',
      pdfAttachments, // Pass our client-side generated designer PDFs!
      orderDetails: {
        name,
        surname,
        eventTitle: event.title,
        quantity,
        ticketType,
        ticketLabel: selectedSeat?.label,
        orderId
      }
    });
    return true;
  } catch (err: any) {
    console.error('Failed to send email:', err);
    throw new Error(err.response?.data?.error || err.message || 'Помилка при з’єднанні з сервером пошти');
  }
};
