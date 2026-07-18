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
import { Instagram, Mail, MapPin, X, Check, Download, Send, AlertTriangle, RefreshCw } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { getFbFirestore } from './lib/firebase';
import { Order, Event } from './types';
import axios from 'axios';

function Home() {
  const { events, rawEvents, config, isInitialized, privateSettings, loadChartElements, showAbout, setShowAbout } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const [paidOrder, setPaidOrder] = React.useState<{order: Order, event: Event} | null>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = React.useState(false);
  const [paidOrderIdToProcess, setPaidOrderIdToProcess] = React.useState<string | null>(null);
  const [isCheckingPayment, setIsCheckingPayment] = React.useState(false);
  const [isCheckingMinimized, setIsCheckingMinimized] = React.useState(false);
  const [paymentCheckError, setPaymentCheckError] = React.useState<string | null>(null);
  const [failedOrderId, setFailedOrderId] = React.useState<string | null>(null);
  const [currentAttempt, setCurrentAttempt] = React.useState<number>(1);
  const [checkingOrderId, setCheckingOrderId] = React.useState<string | null>(null);
  const isCheckingCancelled = React.useRef(false);

  const [isResending, setIsResending] = React.useState(false);
  const [resendSuccess, setResendSuccess] = React.useState(false);
  const [resendError, setResendError] = React.useState<string | null>(null);
  const [customResendEmail, setCustomResendEmail] = React.useState('');

  const sendTicketWithAutoRetries = async (targetEmail: string) => {
    if (!paidOrder) return;
    setIsResending(true);
    setResendSuccess(false);
    setResendError(null);

    // 1. Update Firestore if email has been edited by the user
    try {
      const db = getFbFirestore();
      if (db && targetEmail !== paidOrder.order.email) {
        await updateDoc(doc(db, 'orders', paidOrder.order.id), {
          email: targetEmail
        });
        // Mutate paidOrder in state to sync it
        setPaidOrder(prev => {
          if (!prev) return null;
          return {
            ...prev,
            order: {
              ...prev.order,
              email: targetEmail
            }
          };
        });
      }
    } catch (dbErr) {
      console.error("Failed to update email in firestore:", dbErr);
    }

    // 2. Perform sending try-loop with auto-retries on failure
    let attempt = 1;
    let succeeded = false;
    let lastErrorMsg = '';

    while (attempt <= 3 && !succeeded) {
      try {
        if (attempt > 1) {
          setResendError(`⚠ Спроба ${attempt} з 3... Перепідключення...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

        const { sendTicketEmail } = await import('./services/emailService');
        await sendTicketEmail(
          paidOrder.order.id,
          targetEmail,
          paidOrder.order.name,
          paidOrder.order.surname,
          paidOrder.event,
          paidOrder.order.ticketType,
          privateSettings,
          undefined, // selectedSeat
          paidOrder.order.quantity,
          config
        );
        succeeded = true;
        setResendSuccess(true);
        setResendError(null);
        console.log(`Ticket email successfully sent to ${targetEmail} on attempt ${attempt}`);
      } catch (err: any) {
        console.error(`Email sending failed on attempt ${attempt}:`, err);
        lastErrorMsg = err.message || 'Не вдалося надіслати квиток. Будь ласка, перевірте налаштування SMTP у панелі адміністратора.';
        attempt++;
      }
    }

    if (!succeeded) {
      setResendError(lastErrorMsg);
    }
    setIsResending(false);
  };

  // 0. Auto-backup mail forwarder on successful checkout screen engagement (fully synchronized with UI states)
  React.useEffect(() => {
    if (paidOrder) {
      const initialEmail = paidOrder.order.email || '';
      setCustomResendEmail(initialEmail);
      setResendSuccess(false);
      setResendError(null);
      
      const triggerAutoBackupDelivery = () => {
        sendTicketWithAutoRetries(initialEmail);
      };
      
      // Give small timing gap so components load fully first
      const timeoutId = setTimeout(triggerAutoBackupDelivery, 1500);
      return () => clearTimeout(timeoutId);
    }
  }, [paidOrder?.order?.id, privateSettings, config]);

  // 1. Instantly parse and stash the query parameter and clean the address bar to prevent duplicate executions
  React.useEffect(() => {
    const orderId = searchParams.get('paid');
    if (orderId) {
      setPaidOrderIdToProcess(orderId);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams]);

  // 2. Process order verification securely by calling our backend status check ONLY when core app state is initialized
  React.useEffect(() => {
    if (!paidOrderIdToProcess || !isInitialized) return;

    // Reset it immediately so it executes exactly once
    const orderId = paidOrderIdToProcess;
    setPaidOrderIdToProcess(null);
    setFailedOrderId(null);
    isCheckingCancelled.current = false;
    setCheckingOrderId(orderId);

    const db = getFbFirestore();
    if (!db) return;
    
    const fetchOrder = async () => {
      setIsCheckingPayment(true);
      setIsCheckingMinimized(false);
      setPaymentCheckError(null);
      
      const maxAttempts = 15;
      let orderToUse: Order | null = null;
      let verifiedPaid = false;
      let sparkLimitFound = false;
      let invalidTokenFound = false;
      let paymentCancelledFound = false;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        if (isCheckingCancelled.current) {
          console.log("Checking cancelled by user");
          break;
        }
        setCurrentAttempt(attempt);
        console.log(`Checking payment status securely (Attempt ${attempt}/${maxAttempts}) for Order: ${orderId}`);
        
        try {
          // 1. Always look up the Firestore document first (completely free & allowed on standard Spark plan!)
          const orderSnap = await getDoc(doc(db, 'orders', orderId));
          if (orderSnap.exists()) {
            const order = orderSnap.data() as Order;
            order.id = orderSnap.id;

            if (order.status === 'paid') {
              orderToUse = order;
              verifiedPaid = true;
              break;
            }

            if (order.status === 'cancelled') {
              console.warn('Order is already marked as cancelled in Firestore.');
              paymentCancelledFound = true;
              break;
            }

            // 2. Query our secure server API, which triggers Monobank API status check
            try {
              const checkRes = await axios.post('/api/monobank/check-status', {
                orderId: order.id
              });
              
              if (checkRes.data && checkRes.data.status === 'paid') {
                order.status = 'paid';
                orderToUse = order;
                verifiedPaid = true;
                break;
              } else if (checkRes.data && (checkRes.data.status === 'cancelled' || checkRes.data.status === 'failure')) {
                console.warn('Payment failed/cancelled according to Monobank API.');
                paymentCancelledFound = true;
                break;
              } else {
                if (checkRes.data && checkRes.data.sparkLimitDetected) {
                  sparkLimitFound = true;
                  console.warn('Backend reported Firebase Spark Plan limits detected.');
                }
                if (checkRes.data && checkRes.data.invalidTokenDetected) {
                  invalidTokenFound = true;
                  console.warn('Backend reported invalid Monobank API Token configuration.');
                }
              }
            } catch (apiErr: any) {
              console.error('Secure check status API error:', apiErr);
              if (apiErr.response?.data?.invalidTokenDetected) {
                invalidTokenFound = true;
              }
              if (apiErr.response?.data?.sparkLimitDetected) {
                sparkLimitFound = true;
              }
              // Handle free tickets
              if (order.ticketType === 'free' || order.price === 0) {
                try {
                  await updateDoc(doc(db, 'orders', orderId), { status: 'paid' });
                  order.status = 'paid';
                  orderToUse = order;
                  verifiedPaid = true;
                  break;
                } catch (clientErr) {
                  console.error('Local update to paid failed:', clientErr);
                }
              }
            }
          }
        } catch (err) {
          console.error(`Error during attempt ${attempt}:`, err);
        }

        // Wait 1.2 seconds before retrying (with fine-grained checks for cancellation)
        if (attempt < maxAttempts) {
          await new Promise(resolve => {
            let elapsed = 0;
            const interval = setInterval(() => {
              elapsed += 150;
              if (isCheckingCancelled.current || elapsed >= 1200) {
                clearInterval(interval);
                resolve(null);
              }
            }, 150);
          });
        }
      }

      setIsCheckingPayment(false);
      setIsCheckingMinimized(false);
      setCheckingOrderId(null);

      if (verifiedPaid && orderToUse) {
        // Search inside both rawEvents and events to find the bought event
        let event = (rawEvents || events || []).find(e => e.id === orderToUse!.eventId);

        // As a robust database fallback, fetch from firestore directly if memory state has not loaded
        if (!event) {
          try {
            const eventSnap = await getDoc(doc(db, 'events', orderToUse!.eventId));
            if (eventSnap.exists()) {
              event = { id: eventSnap.id, ...eventSnap.data() } as Event;
            }
          } catch (fetchErr) {
            console.error('Error fetching event directly:', fetchErr);
          }
        }

        if (event) {
          setPaidOrder({ order: orderToUse!, event });
        } else {
          console.warn('Could not find event for paid order.');
          // Instantiate placeholder event so checkout can always render or download successfully
          const placeholderEvent: Event = {
            id: orderToUse!.eventId,
            title: 'Подія',
            description: '',
            date: new Date(Date.now() + 86400000).toISOString(),
            location: 'Головний зал',
            price: String(orderToUse!.price),
            vipPrice: String(orderToUse!.price),
            imageUrl: '',
            ticketLink: '',
            isActive: true,
            createdAt: Date.now()
          };
          setPaidOrder({ order: orderToUse!, event: placeholderEvent });
        }
      } else {
        // Automatically mark the order as 'cancelled' in Firestore if it was not paid and attempts are exhausted
        try {
          await updateDoc(doc(db, 'orders', orderId), { status: 'cancelled' });
          console.log(`Order ${orderId} automatically updated to 'cancelled' in Firestore because no payment was detected after all attempts.`);
        } catch (dbErr) {
          console.error("Error setting order to cancelled in Firestore:", dbErr);
        }

        setFailedOrderId(orderId);
        if (invalidTokenFound) {
          setPaymentCheckError('Помилка авторизації з сервером Monobank. Схоже, вказано некоректний або застарілий API токен у приватних налаштуваннях адмін-панелі. Будь ласка, перевірте його.');
        } else if (paymentCancelledFound) {
          setPaymentCheckError('Спроба оплати була скасована, відхилена банком або термін дії інвойсу минув. Будь ласка, спробуйте ще раз.');
        } else if (sparkLimitFound) {
          setPaymentCheckError('Помилка мережі (Firebase Spark Plan limit). Ваш сервер не зміг підключитися з базою Monobank. Перейдіть на платний план Blaze (Pay-as-you-go) у Firebase Console, щоб зняти обмеження на зовнішні запити.');
        } else {
          setPaymentCheckError('Оплата замовлення ще очікує підтвердження банком або відхилена. Будь ласка, спробуйте ще раз через кілька секунд, якщо оплата точно успішна.');
        }
      }
    };
    fetchOrder();
  }, [paidOrderIdToProcess, isInitialized, events, rawEvents, loadChartElements]);

  if (!isInitialized) {
    return <div className="min-h-screen bg-black" />;
  }

  const activeEvent = events.find(e => e.isActive);

  const handleBypassPayment = async () => {
    if (!checkingOrderId) return;
    const db = getFbFirestore();
    if (!db) return;
    try {
      await updateDoc(doc(db, 'orders', checkingOrderId), { status: 'paid' });
      console.log("Order status successfully updated to paid in Firestore for bypass!");
    } catch (err) {
      console.error("Error bypassing payment status:", err);
    }
  };

  const handleCancelChecking = async () => {
    isCheckingCancelled.current = true;
    setIsCheckingPayment(false);
    setIsCheckingMinimized(false);
    if (checkingOrderId) {
      const db = getFbFirestore();
      if (db) {
        try {
          await updateDoc(doc(db, 'orders', checkingOrderId), { status: 'cancelled' });
          console.log(`Order ${checkingOrderId} updated to 'cancelled' in Firestore.`);
        } catch (err) {
          console.error("Error setting order status to cancelled:", err);
        }
      }
    }
    setCheckingOrderId(null);
  };

  const handleClosePaymentCheckError = () => {
    setPaymentCheckError(null);
    setFailedOrderId(null);
    setCheckingOrderId(null);
    setIsCheckingPayment(false);
    setIsCheckingMinimized(false);
    setPaidOrderIdToProcess(null);
    setSearchParams({}, { replace: true });
  };

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

      {/* Payment Checking Modal overlay */}
      <AnimatePresence>
        {isCheckingPayment && !isCheckingMinimized && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-zinc-900 border border-white/10 p-8 rounded-[32px] text-center space-y-6 shadow-2xl"
            >
              <div className="w-16 h-16 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin mx-auto" />
              
              <div className="space-y-2">
                <h3 className="text-xl font-bold uppercase text-white tracking-tight">Перевірка оплати</h3>
                <p className="text-sm font-medium text-zinc-400">З'єднуємося з платіжною системою Monobank...</p>
                <p className="text-xs text-zinc-500 font-mono">Спроба {currentAttempt} з 15. Автоперевірка триває...</p>
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <button 
                  onClick={handleBypassPayment}
                  className="w-full py-3.5 bg-green-600 hover:bg-green-500 text-white font-black uppercase tracking-widest text-xs rounded-2xl transition-all shadow-lg hover:shadow-green-600/10 cursor-pointer"
                >
                  ⚡ Оплатити тестово (Bypass)
                </button>
                <button 
                  onClick={() => setIsCheckingMinimized(true)}
                  className="w-full py-3.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold uppercase tracking-widest text-xs rounded-2xl transition-all cursor-pointer"
                >
                  Скасувати (перевіряти у фоні)
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating background checking bar */}
      <AnimatePresence>
        {isCheckingPayment && isCheckingMinimized && (
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className="fixed bottom-6 right-6 z-[110] bg-zinc-900 border border-white/10 p-5 rounded-2xl shadow-2xl flex items-center gap-4 max-w-sm"
          >
            <div className="w-8 h-8 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin flex-shrink-0" />
            <div className="flex-1 text-left min-w-[140px]">
              <p className="text-xs font-black uppercase tracking-wider text-white">Перевірка оплати</p>
              <p className="text-[10px] text-zinc-400 font-mono">Спроба {currentAttempt} з 15. У фоні...</p>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setIsCheckingMinimized(false)}
                className="px-2.5 py-1.5 bg-zinc-850 hover:bg-zinc-800 text-[10px] font-bold text-white rounded-xl transition-all uppercase tracking-wider cursor-pointer"
              >
                Розгорнути
              </button>
              <button 
                onClick={handleCancelChecking}
                className="px-2.5 py-1.5 bg-red-950/45 hover:bg-red-900/45 text-red-400 text-[10px] font-bold rounded-xl transition-all uppercase tracking-wider cursor-pointer"
              >
                Скасувати
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Payment Check Error Modal overlay */}
      <AnimatePresence>
        {paymentCheckError && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/95 backdrop-blur-md" onClick={handleClosePaymentCheckError} />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative w-full max-w-md bg-zinc-900 border border-white/10 p-8 rounded-[32px] text-center space-y-6"
            >
              <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto border border-red-500/20">
                <X size={28} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold uppercase text-white">Статус оплати</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{paymentCheckError}</p>
              </div>
              <div className="flex flex-col gap-2">
                {failedOrderId && (
                  <button 
                    onClick={() => {
                      setPaymentCheckError(null);
                      setPaidOrderIdToProcess(failedOrderId);
                    }}
                    className="w-full h-12 bg-purple-600 text-white font-bold rounded-2xl hover:bg-purple-700 transition-colors uppercase text-xs tracking-wider"
                  >
                    Повторити перевірку
                  </button>
                )}
                <button 
                  onClick={handleClosePaymentCheckError}
                  className="w-full h-12 bg-white/5 text-zinc-300 hover:text-white font-bold rounded-2xl hover:bg-white/10 transition-colors uppercase text-xs tracking-wider"
                >
                  Повернутися на сайт
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
              {isResending ? (
                <>
                  <div className="w-20 h-20 bg-purple-500/10 rounded-full flex items-center justify-center mx-auto mb-8 border border-purple-500/20 relative">
                    <div className="absolute inset-0 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
                    <Mail size={32} className="text-purple-500 animate-pulse" />
                  </div>
                  
                  <h2 className="text-2xl font-black uppercase text-white mb-2 tracking-tight animate-pulse">
                    Відправляємо квитки...
                  </h2>
                  <p className="text-zinc-400 mb-6 font-medium text-sm">
                    Надсилаємо квитки на пошту <span className="text-purple-400 font-bold">{customResendEmail}</span>.
                  </p>
                  
                  {resendError && resendError.includes('Спроба') && (
                    <div className="mb-6 bg-purple-500/10 border border-purple-500/20 py-2 px-4 rounded-xl inline-block text-purple-400 text-xs font-mono">
                      {resendError}
                    </div>
                  )}
                </>
              ) : resendSuccess ? (
                <>
                  <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-8 shadow-[0_0_30px_rgba(34,197,94,0.3)]">
                    <Check size={40} className="text-black" />
                  </div>
                  
                  <h2 className="text-3xl font-black uppercase text-white mb-2 tracking-tight">
                    Дякуємо!
                  </h2>
                  <p className="text-green-400 mb-6 font-medium text-sm">
                    ✓ Квитки успішно надіслано на <span className="font-bold underline">{customResendEmail}</span>!
                  </p>
                </>
              ) : (
                <>
                  <div className="w-20 h-20 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-8 border border-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.1)]">
                    <AlertTriangle size={36} />
                  </div>
                  
                  <h2 className="text-2xl font-black uppercase text-red-500 mb-2 tracking-tight">
                    Помилка відправки!
                  </h2>
                  <p className="text-zinc-400 mb-6 font-medium text-sm">
                    Автоматичні спроби відправки на пошту вичерпані.
                  </p>
                  
                  {resendError && (
                    <div className="mb-6 bg-red-500/10 border border-red-500/25 p-4 rounded-2xl text-left text-xs text-red-400 leading-relaxed font-mono">
                      {resendError}
                    </div>
                  )}
                </>
              )}

              {/* Email Input Field block located in the main visible area */}
              <div className="bg-zinc-900/40 p-6 rounded-3xl border border-white/5 space-y-3 mb-8">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 text-left">
                  Email для отримання квитків (можна змінити):
                </p>
                <div className="flex gap-2">
                  <input 
                    type="email"
                    disabled={isResending}
                    value={customResendEmail}
                    onChange={e => setCustomResendEmail(e.target.value)}
                    placeholder="example@gmail.com"
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 text-xs outline-none focus:border-purple-500 font-mono text-white h-11 disabled:opacity-50"
                  />
                  <button
                    onClick={() => {
                      if (isResending || !customResendEmail.includes('@')) return;
                      sendTicketWithAutoRetries(customResendEmail);
                    }}
                    disabled={isResending || !customResendEmail.includes('@')}
                    className="bg-purple-600 hover:bg-purple-500 disabled:bg-zinc-800 disabled:opacity-40 text-white text-[10px] font-bold uppercase tracking-widest px-4 rounded-xl transition-all h-11 shrink-0 flex items-center justify-center gap-1.5"
                  >
                    {isResending ? (
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : resendSuccess ? (
                      <>
                        <RefreshCw size={12} /> Надіслати ще раз
                      </>
                    ) : (
                      <>
                        <Send size={12} /> Надіслати
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* QR Codes Preview */}
              <div className="max-h-[300px] overflow-y-auto mb-8 pr-2 space-y-4 text-left">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Ваші QR-квитки для входу:</p>
                {Array.from({ length: paidOrder.order.quantity || 1 }).map((_, i) => (
                  <div key={i} className="bg-zinc-900/30 p-4 rounded-3xl border border-white/5 flex items-center gap-4">
                    <div className="bg-white p-2 rounded-xl shrink-0">
                      <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${paidOrder.order.id}:${i + 1}`} 
                        alt={`QR ${i + 1}`}
                        className="w-16 h-16"
                      />
                    </div>
                    <div className="text-left">
                      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-650">Квиток {i + 1}</p>
                      <p className="text-white font-bold">{paidOrder.order.id}-{i + 1}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <button 
                  onClick={async () => {
                    if (isDownloadingPdf) return;
                    setIsDownloadingPdf(true);
                    try {
                      const { getBase64ImageSafe, generateQRCodeBase64 } = await import('./services/pdfService');
                      let eventBase64Img = '';
                      if (paidOrder.event.imageUrl) {
                        eventBase64Img = await getBase64ImageSafe(paidOrder.event.imageUrl);
                      }

                      const qrCount = paidOrder.order.quantity || 1;
                      const qrsBase64: string[] = [];
                      for (let i = 0; i < qrCount; i++) {
                        const qrBase64 = await generateQRCodeBase64(`${paidOrder.order.id}:${i + 1}`);
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
                  className="w-full bg-white text-black py-4 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-neon-purple hover:text-white disabled:bg-zinc-800 disabled:text-zinc-600 transition-all shadow-lg cursor-pointer"
                >
                  <Download size={18} className={isDownloadingPdf ? "animate-spin" : ""} />
                  {isDownloadingPdf ? 'Генерація PDF...' : 'Завантажити квиток (PDF)'}
                </button>
                <button 
                  onClick={() => {
                    setPaidOrder(null);
                    setSearchParams({});
                  }}
                  className="w-full bg-zinc-900 text-zinc-500 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-zinc-800 transition-all cursor-pointer"
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
