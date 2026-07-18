import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, User, Phone, Mail, CreditCard, X, Ticket, Plus, Minus } from 'lucide-react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getFbFirestore } from '../lib/firebase';
import { Event, Order, PrivateSettings, ChartElement } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { sendTicketEmail } from '../services/emailService';
import { useApp } from '../contexts/AppContext';
import axios from 'axios';

// Reusable Monobank Paw Icon component
const MonobankPawIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 inline-block text-[#ff5a5f] select-none align-middle" style={{ minWidth: '16px' }}>
    <circle cx="12" cy="14" r="4" />
    <circle cx="7" cy="8.5" r="2.2" />
    <circle cx="10.5" cy="5.5" r="2.2" />
    <circle cx="14.5" cy="5.5" r="2.2" />
    <circle cx="17.3" cy="8.5" r="2.2" />
  </svg>
);

interface CheckoutModalProps {
  event: Event;
  ticketType: 'standard' | 'vip' | 'free';
  selectedSeat?: ChartElement;
  initialQuantity?: number;
  onClose: () => void;
  privateSettings: PrivateSettings | null;
}

export default function CheckoutModal({ event, ticketType, selectedSeat, initialQuantity = 1, onClose, privateSettings }: CheckoutModalProps) {
  const { config } = useApp();
  const [formData, setFormData] = useState({
    name: '',
    surname: '',
    phone: '',
    email: '',
  });
  const [quantity, setQuantity] = useState(initialQuantity);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Scroll Lock
  React.useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  const currentTicketType = ticketType;
  
  const getCalculatedPrice = () => {
    if (currentTicketType === 'free') return 0;
    let basePrice = currentTicketType === 'vip' ? Number(event.vipPrice || 0) : Number(event.price || 0);
    
    // If it's a table sold as whole, quantity refers to the table itself?
    // User request: "добав можливість купівлі декількох квитків" (add possibility to buy multiple tickets)
    // Usually means quantity for standard/vip tickets.
    // For tables, if sold as whole, it's already a multiplier.
    
    let subtotal = basePrice * quantity;
    if (selectedSeat && selectedSeat.type === 'table' && selectedSeat.sellAsWhole && selectedSeat.seatsCount) {
        subtotal = basePrice * selectedSeat.seatsCount * quantity;
    }
    
    const commission = config?.commissionPercentage || 0;
    const total = subtotal + (subtotal * commission / 100);
    
    return Math.ceil(total);
  };

  const totalPrice = getCalculatedPrice();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const db = getFbFirestore();
    if (!db) return;

    try {
      const orderId = `SKY-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
      
      const orderData: Partial<Order> = {
        id: orderId,
        eventId: event.id,
        elementId: selectedSeat?.id || null,
        name: formData.name,
        surname: formData.surname,
        email: formData.email,
        phone: formData.phone,
        status: currentTicketType === 'free' || totalPrice === 0 ? 'paid' : 'pending',
        price: totalPrice,
        quantity: quantity,
        ticketType: currentTicketType as any,
        scannedCount: 0,
        createdAt: Date.now(),
      };

      await setDoc(doc(db, 'orders', orderId), orderData);

      if (orderData.status === 'paid') {
        sendTicketEmail(orderId, formData.email, formData.name, formData.surname, event, ticketType, privateSettings, selectedSeat, quantity, config)
          .catch(err => console.error('Background sendTicketEmail error:', err));
      }

      if (ticketType === 'free' || totalPrice === 0) {
        alert('Квиток надіслано на пошту.');
        onClose();
        return;
      }

      // Handle Monobank Payment
      if (privateSettings?.monobankToken) {
        let baseDomain = window.location.origin;
        if (config?.siteUrl && config.siteUrl.trim() !== '') {
          let cleanUrl = config.siteUrl.trim();
          if (!cleanUrl.toLowerCase().startsWith('http://') && !cleanUrl.toLowerCase().startsWith('https://')) {
            cleanUrl = 'https://' + cleanUrl;
          }
          baseDomain = cleanUrl.replace(/\/+$/, '');
        }

        const payload: any = {
          amount: totalPrice * 100, // in kopecks
          ccy: 980, // UAH
          reference: orderId, // Top-level reference for tracking
          merchantPaymInfo: {
            destination: `${quantity} квитків на ${event.title}`,
            comment: `Order: ${orderId}`,
          },
          redirectUrl: `${baseDomain}/?paid=${orderId}`,
          token: privateSettings.monobankToken
        };

        // Monobank webhooks strictly require a public HTTPS URL. Skip for localhost or non-https.
        if (baseDomain.startsWith('https://') && !baseDomain.includes('localhost') && !baseDomain.includes('127.0.0.1')) {
          payload.webHookUrl = `${baseDomain}/api/monobank/webhook`;
        }

        const response = await axios.post('/api/monobank/invoice', payload);
        if (response.data.pageUrl) {
          if (response.data.invoiceId) {
            await setDoc(doc(db, 'orders', orderId), {
              ...orderData,
              status: 'pending', // Order starts as pending until payment is verified by webhook/callback status check
              monobankInvoiceId: response.data.invoiceId
            });
          }
          window.location.href = response.data.pageUrl;
        } else {
          throw new Error('Помилка створення інвойсу');
        }
      } else {
        setError('Система оплати не налаштована. Зверніться до адміністратора.');
      }
    } catch (err: any) {
      console.error(err);
      let errorMessage = '';
      if (err.response?.data?.error) {
        const errData = err.response.data.error;
        if (typeof errData === 'object') {
          errorMessage = errData.errText || errData.message || JSON.stringify(errData);
        } else {
          errorMessage = errData;
        }
      } else if (err.response?.data) {
        const responseData = err.response.data;
        if (typeof responseData === 'object') {
          errorMessage = responseData.error || responseData.errText || responseData.message || JSON.stringify(responseData);
        } else {
          errorMessage = responseData;
        }
      } else {
        errorMessage = err.message || 'Помилка мережі чи сервера';
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-lg bg-zinc-900 border border-white/10 rounded-[32px] overflow-hidden shadow-2xl relative"
      >
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-full hover:bg-white/10 text-white/40 hover:text-white transition-all z-10"
        >
          <X size={24} />
        </button>

        <div className="p-8 space-y-6">
          <div className="space-y-1">
            <h3 className="text-2xl font-black uppercase tracking-tight">
              Оформлення квитка
            </h3>
            <p className="text-white/40 text-sm font-medium">
              {event.title} • {ticketType === 'vip' ? 'VIP' : (ticketType === 'free' ? 'БЕЗКОШТОВНО' : 'Standard')}
              {selectedSeat && ` • Місце ${selectedSeat.label}`}
            </p>
          </div>

          <div className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-2xl">
            <div className="flex flex-col">
               <span className="text-[10px] font-black uppercase text-zinc-500">Кількість квитків</span>
               <span className="text-sm font-bold">Оберіть потрібну кількість</span>
            </div>
            <div className="flex items-center gap-4 bg-black/40 p-2 rounded-xl border border-white/5">
              <button 
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-white transition-all"
              >
                <Minus size={16} />
              </button>
              <span className="text-lg font-black w-6 text-center">{quantity}</span>
              <button 
                onClick={() => setQuantity(quantity + 1)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-white transition-all"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          {selectedSeat && (
            <div className="p-4 bg-white/5 border border-white/5 rounded-2xl flex items-center justify-between">
              <div className="flex flex-col">
                 <span className="text-[9px] font-black uppercase text-zinc-500">Обране місце</span>
                 <span className="text-sm font-bold">{selectedSeat.label || 'Без назви'} ({selectedSeat.type === 'seat' ? 'Місце' : 'Елемент'})</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-neon-purple/10 flex items-center justify-center text-neon-purple border border-neon-purple/20">
                {selectedSeat.type === 'seat' ? <User size={18} /> : <Ticket size={18} />}
              </div>
            </div>
          )}

          <AnimatePresence mode="wait">
            <motion.div 
              key="form"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              {error && (
                <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm font-medium animate-in slide-in-from-top-2">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-1">Ім'я</label>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
                        <input 
                          type="text" 
                          required
                          value={formData.name}
                          onChange={e => setFormData({...formData, name: e.target.value})}
                          placeholder="Іван"
                          className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 focus:ring-2 focus:ring-purple-500 outline-none transition-all placeholder:text-white/10"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-1">Прізвище</label>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
                        <input 
                          type="text" 
                          required
                          value={formData.surname}
                          onChange={e => setFormData({...formData, surname: e.target.value})}
                          placeholder="Іванов"
                          className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 focus:ring-2 focus:ring-purple-500 outline-none transition-all placeholder:text-white/10"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-1">Номер телефону</label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
                      <input 
                        type="tel" 
                        required
                        value={formData.phone}
                        onChange={e => setFormData({...formData, phone: e.target.value})}
                        placeholder="+380"
                        className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 focus:ring-2 focus:ring-purple-500 outline-none transition-all placeholder:text-white/10"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-1">Email (для квитка)</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
                      <input 
                        type="email" 
                        required
                        value={formData.email}
                        onChange={e => setFormData({...formData, email: e.target.value})}
                        placeholder="example@gmail.com"
                        className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 focus:ring-2 focus:ring-purple-500 outline-none transition-all placeholder:text-white/10"
                      />
                    </div>
                  </div>

                  <div className="pt-6">
                    <button 
                      type="submit"
                      disabled={loading}
                      className="w-full h-16 bg-white text-black font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-neon-purple hover:text-white transition-all disabled:opacity-50 flex items-center justify-center gap-3 active:scale-95"
                    >
                      {loading ? (
                        <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <CreditCard size={20} />
                          {ticketType === 'free' ? 'Отримати безкоштовно' : (
                            <span className="flex items-center gap-1.5">
                              Оплатити {totalPrice} грн
                              {privateSettings?.monobankToken && <MonobankPawIcon />}
                            </span>
                          )}
                        </>
                      )}
                    </button>
                    {config?.commissionPercentage && config.commissionPercentage > 0 && (
                      <p className="text-[9px] text-center mt-2 text-white/20 uppercase tracking-widest">
                        Включаючи комісію платіжної системи {config.commissionPercentage}%
                      </p>
                    )}
                  </div>
              </form>
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
