import React, { useEffect, useState, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { getFbFirestore } from '../lib/firebase';
import { CheckCircle2, AlertCircle, RefreshCw, XCircle, Maximize, Calendar, Ticket, ChevronRight, Lock } from 'lucide-react';
import { Order, ChartElement } from '../types';
import { cn } from '../lib/utils';
import { useApp } from '../contexts/AppContext';

export default function QRScanner() {
  const { events, loadChartElements, privateSettings } = useApp();
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [typedEventId, setTypedEventId] = useState<string>('');
  const [scanResult, setScanResult] = useState<{ 
    status: 'success' | 'error' | 'duplicate'; 
    message: string; 
    order?: Order;
    vipTableDetails?: {
      isVipTable: boolean;
      seatsCount: number;
      label: string;
    };
  } | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualId, setManualId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const stopScanner = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
      } catch (err) {
        console.warn('Failed to stop scanner:', err);
      }
    }
  };

  const startScanner = async () => {
    setError(null);
    setScanResult(null);
    
    await stopScanner();

    if (!scannerRef.current) {
      scannerRef.current = new Html5Qrcode("reader");
    }

    setIsScanning(true);

    try {
      try {
        await scannerRef.current.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          async (decodedText) => {
            handleScan(decodedText);
            await stopScanner();
            setIsScanning(false);
          },
          () => {
            // silent error for frame fail
          }
        );
      } catch (firstErr: any) {
        console.warn('Could not start with environment facing mode, trying user camera...', firstErr);
        try {
          await scannerRef.current.start(
            { facingMode: "user" },
            {
              fps: 10,
              qrbox: { width: 250, height: 250 },
            },
            async (decodedText) => {
              handleScan(decodedText);
              await stopScanner();
              setIsScanning(false);
            },
            () => {}
          );
        } catch (secondErr: any) {
          console.warn('Could not start with user facing mode, trying first available device...', secondErr);
          let devices: any[] = [];
          try {
            devices = await Html5Qrcode.getCameras();
          } catch (camErr) {
            console.warn('getCameras error:', camErr);
          }
          if (devices && devices.length > 0) {
            await scannerRef.current.start(
              devices[0].id,
              {
                fps: 10,
                qrbox: { width: 250, height: 250 },
              },
              async (decodedText) => {
                handleScan(decodedText);
                await stopScanner();
                setIsScanning(false);
              },
              () => {}
            );
          } else {
            throw new Error('Камери не знайдено на вашому пристрої. Будь ласка, введіть код вручну.');
          }
        }
      }
    } catch (err: any) {
      console.error(err);
      let errMsg = err.message || 'Не вдалося отримати доступ до камери. Перевірте дозволи.';
      if (errMsg.includes('Requested device not found') || errMsg.includes('NotFoundError')) {
        errMsg = 'На вашому пристрої не виявлено активної камери або веб-камери. Будь ласка, введіть код квитка вручну.';
      }
      setError(errMsg);
      setIsScanning(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualId.trim()) return;
    setIsSubmitting(true);
    await stopScanner();
    setIsScanning(false);
    await handleScan(manualId.trim());
    setIsSubmitting(false);
    setManualId('');
  };

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  const normalizeTicketCode = (input: string): { orderId: string; subTicketStr: string } => {
    let cleaned = input.trim();

    // 1. Strip leading '#' if present (often copied from admin panel)
    if (cleaned.startsWith('#')) {
      cleaned = cleaned.substring(1).trim();
    }

    // 2. Handle Ukrainian / Cyrillic layout prefixes
    const upperCleaned = cleaned.toUpperCase();
    if (upperCleaned.startsWith('СКУ-')) {
      cleaned = 'SKY-' + cleaned.substring(4);
    } else if (upperCleaned.startsWith('СКУ')) {
      cleaned = 'SKY' + cleaned.substring(3);
    } else if (upperCleaned.startsWith('СКИ-')) {
      cleaned = 'SKY-' + cleaned.substring(4);
    } else if (upperCleaned.startsWith('СКИ')) {
      cleaned = 'SKY' + cleaned.substring(3);
    }

    // 3. Normalize general Cyrillic homoglyphs to Latin equivalents
    const homoglyphs: { [key: string]: string } = {
      'А': 'A', 'а': 'A',
      'В': 'B', 'в': 'B',
      'С': 'C', 'с': 'C', // maps to Latin C for random strings
      'Е': 'E', 'е': 'E',
      'Н': 'H', 'н': 'H',
      'І': 'I', 'і': 'I',
      'М': 'M', 'м': 'M',
      'О': 'O', 'о': 'O',
      'Р': 'P', 'р': 'P',
      'Т': 'T', 'т': 'T',
      'У': 'Y', 'у': 'Y', // maps to Latin Y
      'Х': 'X', 'х': 'X',
      'К': 'K', 'к': 'K',
    };

    let normalized = '';
    for (let i = 0; i < cleaned.length; i++) {
      const char = cleaned[i];
      normalized += homoglyphs[char] || char;
    }
    cleaned = normalized;

    // 4. Parse orderId and subticket fields
    let orderId = cleaned;
    let subTicketStr = '1';

    if (cleaned.includes(':')) {
      const parts = cleaned.split(':');
      orderId = parts[0].trim();
      subTicketStr = parts[1]?.trim() || '1';
    } else {
      const lastHyphenIndex = cleaned.lastIndexOf('-');
      if (lastHyphenIndex !== -1) {
        const lastPart = cleaned.substring(lastHyphenIndex + 1).trim();
        if (/^\d+$/.test(lastPart)) {
          orderId = cleaned.substring(0, lastHyphenIndex).trim();
          subTicketStr = lastPart;
        }
      }
    }

    return {
      orderId: orderId.toUpperCase(),
      subTicketStr
    };
  };

  const handleScan = async (rawCode: string) => {
    const db = getFbFirestore();
    if (!db) return;

    try {
      const { orderId, subTicketStr } = normalizeTicketCode(rawCode);

      const orderDoc = await getDoc(doc(db, 'orders', orderId));
      if (!orderDoc.exists()) {
        setScanResult({ status: 'error', message: `Квиток ${orderId} не знайдено!` });
        return;
      }

      const orderData = { id: orderDoc.id, ...orderDoc.data() } as Order;

      // Ensure ticket belongs to the active locked event
      if (orderData.eventId !== selectedEventId) {
        const expectedEvent = events.find(e => e.id === orderData.eventId);
        const expectedTitle = expectedEvent ? expectedEvent.title : `ID: ${orderData.eventId}`;
        const targetEvent = events.find(e => e.id === selectedEventId);
        const targetTitle = targetEvent ? targetEvent.title : `ID: ${selectedEventId}`;
        const errorMsg = `Цей квиток від іншого заходу! (Квиток на: "${expectedTitle}", а Ви скануєте для: "${targetTitle}")`;
        setScanResult({ status: 'error', message: errorMsg, order: orderData });
        return;
      }
      
      const subTicketId = parseInt(subTicketStr, 10);
      if (orderData.returnedCount && orderData.returnedCount > 0 && subTicketId > (orderData.quantity - orderData.returnedCount)) {
        const errorMsg = 'Квиток повернуто (кошти відшкодовано)!';
        setScanResult({ status: 'error', message: errorMsg, order: orderData });
        
        // Notify Telegram
        try {
          const event = events.find(e => e.id === orderData.eventId);
          if (event) {
            const { notifyTicketScanned } = await import('../services/telegramService');
            await notifyTicketScanned(orderData, event, privateSettings, `${orderId}-${subTicketStr}`, false, errorMsg);
          }
        } catch (tgErr) {
          console.error('Telegram notification scan error:', tgErr);
        }
        return;
      }

      if (orderData.status !== 'paid' && orderData.status !== 'used') {
        const errorMsg = orderData.status === 'cancelled' ? 'Квиток скасовано!' : 'Квиток не оплачено!';
        setScanResult({ status: 'error', message: errorMsg, order: orderData });
        
        // Notify Telegram
        try {
          const event = events.find(e => e.id === orderData.eventId);
          if (event) {
            const { notifyTicketScanned } = await import('../services/telegramService');
            await notifyTicketScanned(orderData, event, privateSettings, `${orderId}-${subTicketStr}`, false, errorMsg);
          }
        } catch (tgErr) {
          console.error('Telegram notification scan error:', tgErr);
        }
        return;
      }

      // Check if this specific subticket has been scanned before
      const scannedList = orderData.scannedTickets || [];
      const isAlreadyScanned = scannedList.includes(subTicketStr);

      // Look up seat details to check if it's a VIP Table
      const event = events.find(e => e.id === orderData.eventId);
      let element: ChartElement | undefined = undefined;
      if (event && event.chartId && orderData.elementId) {
        try {
          const elements = await loadChartElements(event.chartId);
          element = elements.find(el => el.id === orderData.elementId);
        } catch (elErr) {
          console.error('Error loading chart element inside scanner:', elErr);
        }
      }

      const isVipTable = element?.type === 'table';
      const seatsCount = element?.seatsCount || 0;

      if (isAlreadyScanned) {
        let duplicateMsg = `ВХІД ЗАБОРОНЕНО: Квиток ${subTicketStr} вже був використаний!`;
        if (isVipTable) {
          duplicateMsg = `ВХІД ЗАБОРОНЕНО: VIP Стіл ${element?.label || ''} вже зареєстрований на вході!`;
        }
        
        setScanResult({ 
          status: 'duplicate', 
          message: duplicateMsg, 
          order: orderData,
          vipTableDetails: isVipTable ? {
            isVipTable: true,
            seatsCount,
            label: element?.label || ''
          } : undefined
        });

        // Notify Telegram
        try {
          if (event) {
            const { notifyTicketScanned } = await import('../services/telegramService');
            await notifyTicketScanned(orderData, event, privateSettings, `${orderId}-${subTicketStr}`, false, isVipTable ? `ПОВТОРНЕ СКАНИ СТОЛУ` : `ПОВТОРНЕ СКАН КВИТКА`);
          }
        } catch (tgErr) {
          console.error('Telegram notification duplicate error:', tgErr);
        }
        return;
      }

      // Successful scanning
      const newScannedList = [...scannedList, subTicketStr];
      const newCount = (orderData.scannedCount || 0) + 1;
      const isCompletelyUsed = newScannedList.length >= (orderData.quantity || 1);
      const nowISO = new Date().toISOString();
      const currentTimes = orderData.scannedAtTimes || {};
      const newTimes = { ...currentTimes, [subTicketStr]: nowISO };

      await updateDoc(doc(db, 'orders', orderId), {
        scannedCount: newCount,
        scannedTickets: newScannedList,
        scannedAtTimes: newTimes,
        status: isCompletelyUsed ? 'used' : orderData.status,
        scannedAt: nowISO
      });

      let successMsg = `ДОЗВОЛЕНО`;
      if (isVipTable) {
        successMsg = `ДОЗВОЛЕНО ВХІД • VIP СТІЛ (${element?.label || ''}) на ${seatsCount} осіб`;
      } else {
        successMsg = `ДОЗВОЛЕНО (Квиток ${subTicketStr} з ${orderData.quantity || 1})`;
      }

      if (isVipTable) {
        setScanResult({ 
          status: 'success', 
          message: successMsg, 
          order: { 
            ...orderData, 
            scannedCount: newCount,
            scannedTickets: newScannedList,
            status: isCompletelyUsed ? 'used' : orderData.status
          },
          vipTableDetails: {
            isVipTable: true,
            seatsCount,
            label: element?.label || ''
          }
        });
      } else {
        setScanResult({ 
          status: 'success', 
          message: successMsg, 
          order: { 
            ...orderData, 
            scannedCount: newCount,
            scannedTickets: newScannedList,
            status: isCompletelyUsed ? 'used' : orderData.status
          } 
        });
      }

      // Notify Telegram
      try {
        if (event) {
          const { notifyTicketScanned } = await import('../services/telegramService');
          await notifyTicketScanned(orderData, event, privateSettings, `${orderId}-${subTicketStr}`, true);
        }
      } catch (tgErr) {
        console.error('Telegram notification scan success error:', tgErr);
      }

    } catch (err) {
      console.error(err);
      setScanResult({ status: 'error', message: 'Помилка бази даних' });
    }
  };

  if (!selectedEventId) {
    return (
      <div className="w-full bg-black flex flex-col items-center justify-center p-6 space-y-8 rounded-[38px] max-w-sm mx-auto relative overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-purple-900/10 blur-3xl pointer-events-none" />
        
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 bg-purple-600/10 border border-purple-500/20 px-3 py-1 rounded-full mb-1">
            <Lock size={12} className="text-purple-400" />
            <span className="text-[9px] font-black tracking-widest uppercase text-purple-400">Авторизований Сканер</span>
          </div>
          <h1 className="text-3xl font-black uppercase tracking-widest text-gradient">ОБЕРІТЬ ЗАХІД</h1>
          <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest leading-relaxed">
            Вкажіть захід, квитки якого Ви перевірятимете у цій сесії
          </p>
        </div>

        <div className="w-full bg-zinc-950/40 border border-white/5 p-6 rounded-[28px] space-y-6 backdrop-blur-sm relative z-10">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider flex items-center gap-1.5 ml-1">
                <Calendar size={12} className="text-purple-500/80" /> Обрати зі списку створених
              </label>
              <select
                value={typedEventId}
                onChange={(e) => setTypedEventId(e.target.value)}
                className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3.5 text-xs text-zinc-200 focus:outline-none focus:border-neon-purple focus:ring-1 focus:ring-neon-purple/50 transition-all cursor-pointer font-medium"
              >
                <option value="" className="text-zinc-500">-- Оберіть захід зі списку --</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id} className="bg-zinc-950 text-zinc-200">
                    {ev.title} (ID: {ev.id})
                  </option>
                ))}
              </select>
            </div>

            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-white/5"></div>
              <span className="flex-shrink mx-4 text-[9px] font-bold text-zinc-600 uppercase tracking-widest">або</span>
              <div className="flex-grow border-t border-white/5"></div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider flex items-center gap-1.5 ml-1">
                <Ticket size={12} className="text-purple-500/80" /> Ввести ID заходу вручну
              </label>
              <input
                type="text"
                placeholder="Введіть або вставте ID заходу..."
                value={typedEventId}
                onChange={(e) => setTypedEventId(e.target.value.trim())}
                className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3.5 text-xs text-zinc-200 placeholder-white/20 focus:outline-none focus:border-neon-purple focus:ring-1 focus:ring-neon-purple/50 transition-all font-mono"
              />
              <p className="text-[9px] text-zinc-500 italic ml-1">
                * Валідуються тільки квитки для цього коду/заходу.
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              if (typedEventId.trim()) {
                setSelectedEventId(typedEventId.trim());
              }
            }}
            disabled={!typedEventId.trim()}
            className="w-full bg-neon-purple hover:bg-neon-purple/90 text-white font-black py-4 rounded-xl text-xs uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(168,85,247,0.3)] cursor-pointer"
          >
            <span>Запустити сканування</span>
            <ChevronRight size={14} />
          </button>
        </div>

        <div className="text-center text-[10px] text-zinc-600 uppercase tracking-widest font-semibold flex items-center gap-2">
          <span>Спільний простір валідації</span>
          <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-black flex flex-col items-center justify-center p-6 space-y-8 rounded-[38px] max-w-sm mx-auto">
      <div className="text-center space-y-3">
        <h1 className="text-3xl font-black uppercase tracking-widest text-gradient">SCANNER</h1>
        
        {/* Selected Event Details Banner */}
        <div className="flex flex-col items-center gap-2">
          <div className="inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 px-3 py-1.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest text-purple-400 max-w-[250px] truncate">
              {events.find(e => e.id === selectedEventId)?.title || `ID: ${selectedEventId}`}
            </span>
          </div>
          <button
            onClick={async () => {
              setSelectedEventId('');
              await stopScanner();
              setIsScanning(false);
              setScanResult(null);
            }}
            className="text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white transition-colors border-b border-white/10 pb-0.5 cursor-pointer"
          >
            Змінити захід
          </button>
        </div>
      </div>

      <div className="w-full max-w-sm aspect-square bg-zinc-900 rounded-[32px] overflow-hidden border border-white/10 relative shadow-2xl">
        <div id="reader" className={cn("w-full h-full", !isScanning && "hidden")} />
        
        {!isScanning && !scanResult && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center space-y-4">
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center border border-white/10 mb-4 animate-pulse">
               <Maximize size={40} className="text-white/20" />
            </div>
            {error ? (
              <p className="text-red-500 text-sm font-bold">{error}</p>
            ) : (
              <p className="text-white/40 text-sm font-medium">Натисніть кнопку нижче, щоб активувати камеру</p>
            )}
            <button 
              onClick={startScanner}
              className="bg-neon-purple text-white px-8 py-4 rounded-full font-black uppercase tracking-widest text-xs hover:scale-105 transition-all shadow-[0_0_20px_rgba(168,85,247,0.4)]"
            >
              Увімкнути камеру
            </button>
          </div>
        )}

        {!isScanning && scanResult && (
          <div className={cn(
            "w-full h-full flex flex-col items-center justify-center p-8 text-center space-y-6",
            scanResult?.status === 'success' ? "bg-green-500/20" : 
            scanResult?.status === 'duplicate' ? "bg-yellow-500/20" : "bg-red-500/20"
          )}>
            {scanResult?.status === 'success' ? (
              <CheckCircle2 size={80} className="text-green-500 animate-bounce" />
            ) : scanResult?.status === 'duplicate' ? (
              <XCircle size={80} className="text-yellow-500" />
            ) : (
              <AlertCircle size={80} className="text-red-500" />
            )}
            
            <div className="space-y-2">
              <h2 className={cn(
                "text-2xl font-black uppercase tracking-tighter",
                scanResult?.status === 'success' ? "text-green-400" : 
                scanResult?.status === 'duplicate' ? "text-yellow-400" : "text-red-400"
              )}>
                {scanResult?.message}
              </h2>
              {scanResult?.order && (
                <div className="space-y-1">
                  <p className="text-sm font-bold text-white/60">
                    {scanResult.order.name} {scanResult.order.surname}
                  </p>
                  {scanResult.vipTableDetails?.isVipTable && (
                    <div className="mt-2 inline-block px-3 py-1 bg-yellow-500/20 border border-yellow-500/30 rounded-xl text-yellow-400 text-xs font-bold uppercase tracking-wider animate-pulse">
                      👑 VIP Стіл {scanResult.vipTableDetails.label} • {scanResult.vipTableDetails.seatsCount} осіб
                    </div>
                  )}
                </div>
              )}
            </div>

            <button 
              onClick={startScanner}
              className="flex items-center gap-2 bg-white text-black px-6 py-3 rounded-full font-bold hover:scale-105 transition-all"
            >
              <RefreshCw size={18} />
              Сканувати наступний
            </button>
          </div>
        )}
      </div>

      {/* Manual Code Input Fallback */}
      <div className="w-full max-w-sm bg-white/5 border border-white/10 p-5 rounded-[24px] space-y-4">
        <div className="text-center">
          <p className="text-xs font-black uppercase tracking-wider text-white/80">Введіть код вручну</p>
          <p className="text-[10px] text-white/40 uppercase tracking-wide">Якщо веб-камера не працює</p>
        </div>
        <form onSubmit={handleManualSubmit} className="flex gap-2">
          <input
            type="text"
            placeholder="Введіть ID замовлення..."
            value={manualId}
            onChange={(e) => setManualId(e.target.value)}
            disabled={isSubmitting}
            className="flex-1 bg-zinc-950 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-neon-purple focus:ring-1 focus:ring-neon-purple/50 transition-all font-mono"
          />
          <button
            type="submit"
            disabled={isSubmitting || !manualId.trim()}
            className="bg-neon-purple text-white px-5 py-3 rounded-xl font-black text-xs uppercase tracking-wider hover:bg-neon-purple/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? '...' : 'ОК'}
          </button>
        </form>
      </div>

      <div className="flex gap-4">
        <div className="bg-white/5 border border-white/10 px-4 py-2 rounded-xl">
           <p className="text-[10px] text-white/30 uppercase font-black tracking-widest">Камера</p>
           <p className="text-xs font-bold">{isScanning ? "Активна" : "Очікування"}</p>
        </div>
        <div className="bg-white/5 border border-white/10 px-4 py-2 rounded-xl">
           <p className="text-[10px] text-white/30 uppercase font-black tracking-widest">Сервер</p>
           <p className="text-xs font-bold text-green-500">Online</p>
        </div>
      </div>
    </div>
  );
}
