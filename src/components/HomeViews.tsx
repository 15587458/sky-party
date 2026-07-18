import React, { useState, Suspense, lazy } from 'react';
import { motion } from 'motion/react';
import { Instagram, ArrowRight, Calendar, MapPin, Ticket } from 'lucide-react';
import { Event, SiteConfig, ChartElement } from '../types';
import CheckoutModal from './CheckoutModal';
const SeatingChartSelector = lazy(() => import('./SeatingChartSelector'));
import { useApp } from '../contexts/AppContext';
import { Link } from 'react-router-dom';

interface EventDisplayProps {
  event: Event;
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  // Check if it's ISO format from datetime-local (e.g. 2024-05-15T20:00)
  if (dateStr.includes('T') && dateStr.includes('-')) {
    try {
      const date = new Date(dateStr);
      return new Intl.DateTimeFormat('uk-UA', {
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit'
      }).format(date);
    } catch (e) {
      return dateStr;
    }
  }
  return dateStr;
};

const hexToRgba = (hex: string, alpha: number) => {
  const cleaned = hex.replace('#', '');
  if (cleaned.length === 3) {
    const r = parseInt(cleaned[0] + cleaned[0], 16);
    const g = parseInt(cleaned[1] + cleaned[1], 16);
    const b = parseInt(cleaned[2] + cleaned[2], 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  } else if (cleaned.length === 6) {
    const r = parseInt(cleaned.slice(0, 2), 16);
    const g = parseInt(cleaned.slice(2, 4), 16);
    const b = parseInt(cleaned.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return hex;
};

export function EventDisplay({ event }: EventDisplayProps) {
  const [checkoutType, setCheckoutType] = useState<'standard' | 'vip' | 'free' | null>(null);
  const [selectedSeat, setSelectedSeat] = useState<ChartElement | null>(null);
  const [initialQuantity, setInitialQuantity] = useState(1);
  const { privateSettings, setShowAbout, config } = useApp();

  const handleSeatSelect = (element: ChartElement, quantity: number = 1) => {
    setSelectedSeat(element);
    setInitialQuantity(quantity);
    if (element.priceType) {
      setCheckoutType(element.priceType as any);
    }
  };

  const bgGradient = config?.bgGradientColor || '#1a0033';
  const bgGradientOpacity = config?.bgGradientOpacity ?? 100;
  const bgGradientRgba = hexToRgba(bgGradient, bgGradientOpacity / 100);

  return (
    <div className="flex flex-col lg:flex-row min-h-[calc(100vh-4rem)] bg-bg-dark overflow-hidden">
      {/* Left Panel: Event Visual & Seating */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        style={{ backgroundImage: `linear-gradient(135deg, ${bgGradientRgba} 0%, #000000 100%)` }}
        className="w-full lg:w-[58%] relative flex flex-col items-center justify-center p-8 lg:p-20 border-r border-white/5 overflow-y-auto"
      >
        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="relative w-full aspect-[4/5] max-w-sm glow-purple border-2 border-neon-purple overflow-hidden group mb-12 shrink-0"
        >
          <img 
            src={event.imageUrl || 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&q=80'} 
            alt={event.title}
            className="w-full h-full object-contain transition-all duration-700"
          />
        </motion.div>

        {/* Removed static seating chart from here */}
      </motion.div>

      {/* Right Panel: Event Info */}
      <div className="w-full lg:w-[42%] flex flex-col">
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="flex-1 p-8 lg:p-16 flex flex-col justify-center gap-10 bg-card-bg"
        >
          <div className="space-y-6">
            <div className="inline-block px-3 py-1 bg-neon-purple rounded-[2px] text-[10px] font-bold tracking-[0.2em] uppercase">
              Активна подія
            </div>
            <h1 className="text-4xl lg:text-5xl font-black leading-tight text-gradient uppercase">
              {event.title}
            </h1>
            <p className="text-white/40 text-sm leading-loose max-w-md whitespace-pre-wrap">
              {event.description}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8">
            <div className="space-y-1">
              <span className="text-[11px] uppercase tracking-widest text-white/20 block">Дата та час</span>
              <span className="text-xl font-normal text-white">{formatDate(event.date)}</span>
            </div>
            <div className="space-y-1">
              <span className="text-[11px] uppercase tracking-widest text-white/20 block">Локація</span>
              <span className="text-xl font-normal text-white">{event.location}</span>
            </div>
          </div>
        </motion.div>

        {/* Buy Bar */}
        <div className="flex flex-col h-auto bg-white/5 border-t border-white/10 p-8 lg:p-12 mt-auto gap-10">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex gap-12 items-center text-center sm:text-left">
              <div className="flex flex-col gap-1">
                <span className="text-2xl sm:text-3xl lg:text-4xl font-bold whitespace-nowrap">
                   {event.priceMax ? `${event.price} - ${event.priceMax}` : event.price}
                   {(!isNaN(Number(event.price)) || !isNaN(Number(event.priceMax))) ? ' грн' : ''}
                </span>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold opacity-30 uppercase tracking-widest leading-none">
                    Standard
                  </span>
                  <span className="text-[8px] font-bold text-neon-purple uppercase tracking-tight mt-1">Ціна за одну людину</span>
                </div>
              </div>
              
              {event.vipPrice && (
                <div className="flex flex-col gap-1 border-l border-white/10 pl-12">
                  <span className="text-2xl sm:text-3xl lg:text-4xl font-bold text-neon-purple whitespace-nowrap">
                    від {event.vipPrice} грн
                  </span>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold opacity-30 uppercase tracking-widest leading-none text-neon-purple">
                      VIP
                    </span>
                    <span className="text-[8px] font-bold text-neon-purple uppercase tracking-tight mt-1">Ціна за одну людину</span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <button 
                onClick={() => setCheckoutType('standard')}
                className="bg-white text-black px-8 py-5 font-black text-xs uppercase tracking-widest hover:bg-neon-purple hover:text-white transition-all active:scale-95 rounded-2xl flex items-center justify-center text-center shadow-lg shadow-white/5"
              >
                Купити квиток
              </button>
            </div>
          </div>
          
          <div className="flex items-center justify-center gap-1.5 grayscale opacity-30 select-none">
             <span className="text-white text-sm font-black lowercase tracking-tighter font-sans">monobank</span>
             <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 text-[rgb(255,90,95)] inline-block align-middle select-none" style={{ minWidth: '14px' }}>
               <circle cx="12" cy="14" r="4" />
               <circle cx="7" cy="8.5" r="2.2" />
               <circle cx="10.5" cy="5.5" r="2.2" />
               <circle cx="14.5" cy="5.5" r="2.2" />
               <circle cx="17.3" cy="8.5" r="2.2" />
             </svg>
             <span className="text-[10px] font-black uppercase tracking-[0.2em] ml-1">Secure Monopay</span>
          </div>
        </div>
      </div>

      {checkoutType && event.chartId && event.hasSeatingChart !== false && !selectedSeat && (
        <Suspense fallback={
          <div className="fixed inset-0 z-[150] bg-black/95 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
               <div className="w-12 h-12 border-4 border-neon-purple border-t-transparent rounded-full animate-spin" />
               <p className="text-xs font-black uppercase tracking-widest text-zinc-500">Завантаження схеми...</p>
            </div>
          </div>
        }>
          <SeatingChartSelector 
            event={event}
            ticketType={checkoutType as 'standard' | 'vip'}
            onSelect={handleSeatSelect}
            onClose={() => setCheckoutType(null)}
          />
        </Suspense>
      )}

      {checkoutType && (event.hasSeatingChart === false || !event.chartId || selectedSeat) && (
        <CheckoutModal 
          event={event}
          ticketType={checkoutType}
          selectedSeat={selectedSeat || undefined}
          initialQuantity={initialQuantity}
          onClose={() => {
            setCheckoutType(null);
            setSelectedSeat(null);
            setInitialQuantity(1);
          }}
          privateSettings={privateSettings}
        />
      )}
    </div>
  );
}

export function NoEventsDisplay({ config }: { config: SiteConfig }) {
  const bgGradient = config?.bgGradientColor || '#1a0033';
  const bgGradientOpacity = config?.bgGradientOpacity ?? 100;
  // Default overlay is 20% opacity (0.2), scaled by our setting
  const overlayOpacity = (bgGradientOpacity / 100) * 0.2;
  const bgGradientRgba = hexToRgba(bgGradient, overlayOpacity);

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] px-4 text-center bg-bg-dark relative overflow-hidden">
      <div 
        style={{ backgroundImage: `linear-gradient(135deg, ${bgGradientRgba} 0%, #000000 100%)` }}
        className="absolute inset-0 pointer-events-none" 
      />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-2xl space-y-12 relative z-10"
      >
        {config.logoUrl ? (
          <div className="flex justify-center select-none">
            <motion.img
              initial={{ rotate: -5, scale: 0.95 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 100 }}
              src={config.logoUrl}
              alt="Sky Party Logo"
              className="w-48 h-48 md:w-56 md:h-56 object-contain drop-shadow-[0_0_35px_rgba(255,215,0,0.15)] filter"
            />
          </div>
        ) : (
          <div className="p-8 rounded-full bg-white/5 border border-white/10 inline-block glow-purple">
            <Ticket size={80} className="text-neon-purple/50" />
          </div>
        )}
        
        <div className="space-y-6">
          <h2 className="text-5xl lg:text-6xl font-black tracking-tighter text-gradient uppercase">
            {config.noEventsMessage || 'Зараз немає актуальних подій'}
          </h2>
          <p className="text-white/20 text-lg uppercase tracking-widest font-light">
            Слідкуйте за нашим інстаграмом для анонсів
          </p>
        </div>

        <div className="flex flex-col sm:flex-row justify-center gap-4 pt-8">
          <a
            href={config.instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-4 bg-white text-black px-12 py-5 rounded-[2px] font-black uppercase tracking-widest hover:bg-neon-purple hover:text-white transition-all hover:scale-105"
          >
            <Instagram size={24} />
            Instagram
          </a>
          <Link
            to="/about"
            className="flex items-center justify-center gap-4 bg-zinc-900 border border-white/10 text-white px-12 py-5 rounded-[2px] font-black uppercase tracking-widest hover:bg-neon-purple/20 hover:border-neon-purple transition-all hover:scale-105 cursor-pointer"
          >
            Про нас
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
