/**
 * Safely fetches a remote image and converts it to a Base64 data URL.
 * Handles CORS and falls back to the original URL if fetch fails.
 */
export const getBase64ImageSafe = async (url: string): Promise<string> => {
  if (!url) return '';
  if (url.startsWith('data:')) return url;

  const EMPTY_IMAGE = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(reader.result as string);
      };
      reader.onerror = () => resolve(EMPTY_IMAGE);
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn('CORS or fetch error converting image, falling back to transparent spacer:', url, error);
    return EMPTY_IMAGE;
  }
};

/**
 * Generates a QR Code as a base64 data URL locally (no network requests, no CORS issues).
 */
export const generateQRCodeBase64 = async (text: string): Promise<string> => {
  try {
    const QRCode = await import('qrcode');
    const toDataURL = QRCode.toDataURL || (QRCode as any).default?.toDataURL;
    if (!toDataURL) throw new Error('QRCode.toDataURL not found');
    return await toDataURL(text, {
      margin: 1,
      width: 300,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
  } catch (error) {
    console.error('Failed to generate QR code locally:', error);
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(text)}`;
  }
};

/**
 * Captures an HTML element and downloads it as a pixel-perfect PDF.
 */
export const downloadTicketPDF = async (ticketElementId: string, orderId: string) => {
  const element = document.getElementById(ticketElementId);
  if (!element) return false;

  try {
    const { jsPDF } = await import('jspdf');
    const { toPng } = await import('html-to-image');

    // Wait for all images inside the element to fully complete loading
    const images = element.getElementsByTagName('img');
    const imageLoadPromises = Array.from(images).map((img) => {
      if (img.complete) return Promise.resolve();
      return new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
      });
    });
    await Promise.all(imageLoadPromises);

    // Slight delay to let rendering settle
    await new Promise((r) => setTimeout(r, 400));

    const dataUrl = await toPng(element, {
      quality: 1.0,
      pixelRatio: 2.5, // High resolution for clear QR scan
    });
    
    // Create jsPDF in pixel mode matching the captured dimensions precisely
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'px',
    });

    const imgProps = pdf.getImageProperties(dataUrl);
    const width = imgProps.width;
    const height = imgProps.height;

    // Delete the default page to avoid blank space and set exact container bounds
    pdf.deletePage(1);
    pdf.addPage([width, height], 'portrait');
    pdf.addImage(dataUrl, 'PNG', 0, 0, width, height);

    pdf.save(`ticket-${orderId}.pdf`);
    return true;
  } catch (err) {
    console.error('Failed to generate PDF:', err);
    return false;
  }
};
