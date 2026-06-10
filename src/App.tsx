/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import React from 'react';
import Navbar from './components/Navbar';
import { AppProvider, useApp } from './contexts/AppContext';
import { EventDisplay, NoEventsDisplay } from './components/HomeViews';
import AdminDashboard from './components/AdminDashboard';
import AdminLogin from './components/AdminLogin';
import QRScanner from './components/QRScanner';
import AboutPage from './components/AboutPage';

import { motion, AnimatePresence } from 'motion/react';
import { Instagram, Mail, MapPin, X, Check, Download } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { getFbFirestore } from './lib/firebase';
import { Order, Event } from './types';
import { getBase64ImageSafe } from './services/pdfService';

function Home() {
  const { events, config, isInitialized, privateSettings, loadChartElements, showAbout, setShowAbout } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const [paidOrder, setPaidOrder] = React.useState<{order: Order, event: Event} | null>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = React.useState(false);

  React.useEffect(() => {
    const orderId = searchParams.get('paid');
    if (orderId && isInitialized) {
      const db = getFbFirestore();
      if (!db) return;
      
      const fetchOrder = async () => {
        const orderSnap = await getDoc(doc(db, 'orders', orderId));
        if (orderSnap.exists()) {
          const order = orderSnap.data() as Order;
          order.id = orderSnap.id;
          const event = events.find(e => e.id === order.eventId);
          if (event) {
            if (order.status === 'pending') {
              try {
                // Instantly update status in firestore to avoid race condition/re-triggers
                await updateDoc(doc(db, 'orders', orderId), { status: 'paid' });
                order.status = 'paid';

                // Look up chart seating label if applicable
                let selectedSeat: any = undefined;
                if (order.elementId && event.chartId) {
                  try {
                    const elements = await loadChartElements(event.chartId);
                    selectedSeat = elements.find(el => el.id === order.elementId);
                  } catch (e) {
                    console.error('Error fetching elements for returning order:', e);
                  }
                }

                // Send receipt email
                const { sendTicketEmail } = await import('./services/emailService');
                await sendTicketEmail(
                  orderId,
                  order.email,
                  order.name,
                  order.surname,
                  event,
                  order.ticketType,
                  privateSettings,
                  selectedSeat,
                  order.quantity || 1
                );

                // Send Telegram Notification
                try {
                  const { notifyOrderPaid } = await import('./services/telegramService');
                  await notifyOrderPaid(order, event, privateSettings, selectedSeat?.label);
                } catch (tgErr) {
                  console.error('Telegram notification error:', tgErr);
                }
              } catch (updateErr) {
                console.error('Error auto-setting paid state:', updateErr);
              }
            }
            setPaidOrder({ order, event });
          }
        }
      };
      fetchOrder();
    }
  }, [searchParams, isInitialized, events, privateSettings, loadChartElements]);

  if (!isInitialized) {
    return <div className="min-h-screen bg-black" />;
  }

  const activeEvent = events.find(e => e.isActive);

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <Navbar />
      <main className="flex-1">
        {activeEvent ? (
          <EventDisplay event={activeEvent} />
        ) : (
          config && <NoEventsDisplay config={config} />
        )}
      </main>

      {/* Payment Success Modal */}
      <AnimatePresence>
        {paidOrder && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                 setPaidOrder(null);
                 setSearchParams({});
              }}
              className="absolute inset-0 bg-black/95 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-[#050505] border border-white/10 p-10 rounded-[40px] text-center"
            >
              <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-8 shadow-[0_0_30px_rgba(34,197,94,0.3)]">
                <Check size={40} className="text-black" />
              </div>
              
              <h2 className="text-3xl font-black uppercase text-white mb-2 tracking-tight">Дякуємо за покупку!</h2>
              <p className="text-zinc-500 mb-6 font-medium">Ваш квиток надіслано на email. Також ви можете завантажити або відсканувати його тут.</p>

              {/* QR Codes Preview */}
              <div className="max-h-[300px] overflow-y-auto mb-8 pr-2 space-y-4">
                {Array.from({ length: paidOrder.order.quantity || 1 }).map((_, i) => (
                  <div key={i} className="bg-zinc-900/50 p-4 rounded-3xl border border-white/5 flex items-center gap-4">
                    <div className="bg-white p-2 rounded-xl shrink-0">
                      <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${paidOrder.order.id}:${i + 1}`} 
                        alt={`QR ${i + 1}`}
                        className="w-16 h-16"
                      />
                    </div>
                    <div className="text-left">
                      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Квиток {i + 1}</p>
                      <p className="text-white font-bold">{paidOrder.order.id}-{i + 1}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                <button 
                  onClick={async () => {
                    if (isDownloadingPdf) return;
                    setIsDownloadingPdf(true);
                    try {
                      let eventBase64Img = '';
                      if (paidOrder.event.imageUrl) {
                        eventBase64Img = await getBase64ImageSafe(paidOrder.event.imageUrl);
                      }

                      const qrCount = paidOrder.order.quantity || 1;
                      const qrsBase64: string[] = [];
                      for (let i = 0; i < qrCount; i++) {
                        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${paidOrder.order.id}:${i + 1}`;
                        const qrBase64 = await getBase64ImageSafe(qrUrl);
                        qrsBase64.push(qrBase64);
                      }

                      const tempDiv = document.createElement('div');
                      tempDiv.id = 'temp-ticket-download';
                      tempDiv.style.position = 'fixed';
                      tempDiv.style.left = '0';
                      tempDiv.style.top = '0';
                      tempDiv.style.zIndex = '-9999';
                      tempDiv.style.pointerEvents = 'none';
                      tempDiv.style.width = '600px';

                      const tBg = config?.ticketBgColor || '#000000';
                      const tText = config?.ticketTextColor || '#ffffff';
                      const tAccent = config?.ticketAccentColor || '#a855f7';
                      const tBorder = config?.ticketBorderColor || '#27272a';
                      const tLogo = config?.ticketLogoUrl || config?.logoUrl || '';
                      const tMsg = config?.ticketMessage || '';

                      tempDiv.innerHTML = `
                        <div style="font-family: sans-serif; background: ${tBg}; color: ${tText}; padding: 40px; text-align: center; border: 2px solid ${tBorder}; border-radius: 40px; width: 600px; box-sizing: border-box;">
                          ${tLogo ? `<img src="${tLogo}" style="max-height: 60px; object-fit: contain; margin: 0 auto 20px auto; display: block;" />` : ''}
                          ${eventBase64Img ? `<img src="${eventBase64Img}" style="width: 100%; max-height: 400px; object-fit: cover; border-radius: 20px; margin-bottom: 30px;" />` : ''}
                          <h1 style="font-size: 32px; margin: 0 0 10px 0; font-weight: 900; text-transform: uppercase; color: ${tText};">${paidOrder.event.title}</h1>
                          <p style="font-size: 18px; color: ${tAccent}; margin-bottom: 30px; font-weight: bold; text-transform: uppercase;">
                            ${new Date(paidOrder.event.date).toLocaleString('uk-UA', { 
                              day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' 
                            })} | ${paidOrder.event.location}
                          </p>
                          <div style="background: rgba(255, 255, 255, 0.05); padding: 30px; border-radius: 24px; margin-bottom: 30px; text-align: left; border: 1px solid ${tBorder};">
                            <div style="margin-bottom: 20px;">
                              <p style="font-size: 10px; color: ${tText}80; margin: 0; text-transform: uppercase;">ВЛАСНИК</p>
                              <p style="font-size: 24px; font-weight: 900; margin: 5px 0; color: ${tText};">${paidOrder.order.name} ${paidOrder.order.surname}</p>
                            </div>
                            <div>
                              <p style="font-size: 10px; color: ${tText}80; margin: 0; text-transform: uppercase;">ТИП КВИТКА</p>
                              <p style="font-size: 20px; font-weight: 900; margin: 5px 0; color: ${tAccent};">${paidOrder.order.ticketType.toUpperCase()}</p>
                            </div>
                          </div>

                          <!-- Individual Ticket Sections -->
                          ${Array.from({ length: qrCount }).map((_, i) => `
                            <div style="background: rgba(255, 255, 255, 0.03); padding: 25px; border-radius: 24px; margin-bottom: 20px; border: 1px solid ${tBorder}; text-align: center;">
                              <p style="font-size: 10px; color: ${tText}80; margin: 0 0 15px 0; text-transform: uppercase; font-weight: 900; letter-spacing: 1px;">КВИТОК ${i + 1} З ${qrCount}</p>
                              <div style="background: white; padding: 15px; border-radius: 20px; display: inline-block;">
                                <img src="${qrsBase64[i]}" style="width: 200px; height: 200px; display: block;" />
                              </div>
                              <p style="font-family: monospace; font-size: 14px; font-weight: bold; margin: 15px 0 0 0; color: ${tAccent};">ID: ${paidOrder.order.id}-${i + 1}</p>
                            </div>
                          `).join('')}

                          ${tMsg ? `<p style="font-size: 12px; font-weight: bold; color: ${tText}; max-width: 80%; margin: 20px auto 0 auto; line-height: 1.4;">${tMsg}</p>` : ''}
                          <p style="font-size: 11px; color: ${tText}80; margin-top: 20px;">SKY PARTY 2026</p>
                        </div>
                      `;
                      document.body.appendChild(tempDiv);
                      const { downloadTicketPDF } = await import('./services/pdfService');
                      await downloadTicketPDF('temp-ticket-download', paidOrder.order.id);
                      document.body.removeChild(tempDiv);
                    } catch (err) {
                      console.error('Error generating PDF:', err);
                    } finally {
                      setIsDownloadingPdf(false);
                    }
                  }}
                  disabled={isDownloadingPdf}
                  className="w-full bg-white text-black py-4 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-neon-purple hover:text-white disabled:bg-zinc-800 disabled:text-zinc-600 transition-all shadow-lg"
                >
                  <Download size={18} className={isDownloadingPdf ? "animate-spin" : ""} />
                  {isDownloadingPdf ? 'Генерація PDF...' : 'Завантажити квиток (PDF)'}
                </button>
                <button 
                  onClick={() => {
                    setPaidOrder(null);
                    setSearchParams({});
                  }}
                  className="w-full bg-zinc-900 text-zinc-500 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-zinc-800 transition-all"
                >
                  Закрити
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      {config && (
        <footer className="py-12 px-6 border-t border-white/5 bg-black">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:justify-between gap-12 items-start">
            <div className="space-y-4">
              <h3 className="text-sm font-black tracking-widest uppercase text-white/45">Контакти</h3>
              <div className="space-y-2">
                <a href={config.instagramUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-white/40 hover:text-white transition-colors text-sm">
                  <Instagram size={16} /> @{config.instagramUrl.split('/').filter(Boolean).pop() || 'sky_party_if'}
                </a>
                <a href={`mailto:${config.contactEmail || 'skyparty@ukr.net'}`} className="flex items-center gap-2 text-white/40 hover:text-white transition-colors text-sm">
                  <Mail size={16} /> {config.contactEmail || 'skyparty@ukr.net'}
                </a>
                <div className="flex items-center gap-2 text-white/40 text-sm">
                  <MapPin size={16} /> {config.contactAddress || 'м. Київ, вул. Паркова, 12'}
                </div>
              </div>
            </div>

            <div className="flex flex-col items-start md:items-end text-left md:text-right gap-4">
               <Link 
                to="/about"
                className="text-sm font-black tracking-[0.3em] uppercase text-white hover:text-neon-purple transition-all border-b border-white/20 pb-1 cursor-pointer"
               >
                 Про нас
               </Link>
               <Link 
                to="/admin"
                className="hidden"
               >
               </Link>
            </div>
          </div>
          
          <div className="max-w-7xl mx-auto border-t border-white/[0.04] mt-8 pt-8 flex flex-col md:flex-row justify-between gap-4 text-white/20 text-[10px] uppercase tracking-widest leading-loose">
            <p className="whitespace-pre-wrap">{config.footerText}</p>
            <p>© 2026 SKY PARTY. ВСІ ПРАВА ЗАХИЩЕНІ.</p>
          </div>
        </footer>
      )}
    </div>
  );
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAdmin } = useApp();
  return isAdmin ? <>{children}</> : <Navigate to="/admin" />;
}

export default function App() {
  return (
    <AppProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/admin" element={<AdminLogin />} />
          <Route path="/scan" element={<QRScanner />} />
          <Route 
            path="/admin/dashboard/*" 
            element={
              <AdminRoute>
                <AdminDashboard />
              </AdminRoute>
            } 
          />
        </Routes>
      </Router>
    </AppProvider>
  );
}
