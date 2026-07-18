import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import { ArrowLeft, Mail, MapPin, Instagram, Globe } from 'lucide-react';
import Navbar from './Navbar';
import { motion } from 'motion/react';

export default function AboutPage() {
  const { config } = useApp();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-black flex flex-col relative overflow-hidden selection:bg-purple-600/30 selection:text-white">
      {/* Background Decorative Rings/Glows */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-purple-900/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-900/10 blur-[100px] pointer-events-none" />
      
      {/* Embedded Navbar */}
      <Navbar />

      <main className="flex-1 py-20 px-6 max-w-4xl mx-auto w-full relative z-10 flex flex-col gap-12">
        {/* Back Link */}
        <motion.button 
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-white transition-all self-start cursor-pointer group"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          Назад на головну
        </motion.button>

        {/* Hero Title Block */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col md:flex-row md:items-center gap-6 md:gap-8"
        >
          <div className="shrink-0 self-start md:self-auto select-none">
            {config?.logoUrl ? (
              <img 
                src={config.logoUrl} 
                alt="Sky Party Logo" 
                className="h-24 w-24 md:h-28 md:w-28 object-contain drop-shadow-[0_0_20px_rgba(255,215,0,0.2)]"
              />
            ) : (
              /* Beautiful Large Concentric Golden Logo Fallback */
              <svg className="h-24 w-24 md:h-28 md:w-28 drop-shadow-[0_0_15px_rgba(225,186,66,0.15)]" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="gold-grad-about" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#fff4cc" />
                    <stop offset="30%" stopColor="#e1ba42" />
                    <stop offset="70%" stopColor="#b88314" />
                    <stop offset="100%" stopColor="#fff4cc" />
                  </linearGradient>
                </defs>
                <circle cx="50" cy="50" r="45" stroke="url(#gold-grad-about)" strokeWidth="1.2" />
                <circle cx="50" cy="50" r="41.5" stroke="url(#gold-grad-about)" strokeWidth="0.6" strokeDasharray="1 1" opacity="0.8" />
                <g transform="translate(41, 18) scale(0.4)">
                  <path d="M 6 14 A 5 5 0 0 1 15 9 A 7 7 0 0 1 31 11 A 5 5 0 0 1 34 19 A 3 3 0 0 1 31 22 L 9 22 A 3 3 0 0 1 6 14 Z" fill="none" stroke="url(#gold-grad-about)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M 33,5 L 34.5,8 L 37.5,8.3 L 35.2,10.6 L 36,13.8 L 33,12.2 L 30,13.8 L 30.8,10.6 L 28.5,8.3 L 31.5,8 Z" fill="url(#gold-grad-about)" />
                </g>
                <text x="50" y="52" fill="url(#gold-grad-about)" fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" fontWeight="900" fontSize="11" letterSpacing="0.18em" textAnchor="middle">SKY</text>
                <text x="50" y="65" fill="url(#gold-grad-about)" fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" fontWeight="900" fontSize="11" letterSpacing="0.14em" textAnchor="middle">PARTY</text>
              </svg>
            )}
          </div>
          <div className="space-y-4 flex-1">
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/15 py-1.5 px-4 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-neon-purple animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-widest text-purple-400">ПРО НАС / ABOUT</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black uppercase text-gradient tracking-tight leading-tight">
              {config?.bannerTitle || 'SKY PARTY'}
            </h1>
            <div className="h-[2px] w-32 bg-linear-to-r from-purple-600 to-blue-500" />
          </div>
        </motion.div>

        {/* Content Box */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-zinc-950/40 border border-white/5 p-8 md:p-12 rounded-[32px] glow-purple backdrop-blur-md space-y-8"
        >
          {config?.aboutText ? (
            <div 
              className="text-zinc-300 leading-relaxed font-light text-base md:text-lg rich-text-content"
              dangerouslySetInnerHTML={{ __html: config.aboutText }}
            />
          ) : (
            <p className="text-zinc-500 italic text-base">
              Інформація про проект зараз оновлюється адміністратором. Слідкуйте за анонсами!
            </p>
          )}
        </motion.div>

        {/* Contact info grid (Bento Grid Style) */}
        {config && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4"
          >
            {/* Instagram Contact Cards */}
            <a 
              href={config.instagramUrl} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="bg-zinc-900/30 border border-white/5 hover:border-purple-500/30 p-6 rounded-2xl flex items-center gap-4 transition-all hover:bg-zinc-900/50 group"
            >
              <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400 border border-white/5 group-hover:scale-110 transition-transform">
                <Instagram size={20} />
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Instagram</p>
                <p className="text-sm font-bold text-zinc-200">@{config.instagramUrl.split('/').filter(Boolean).pop() || 'sky_party_if'}</p>
              </div>
            </a>

            {/* Email Contact Card */}
            <a 
              href={`mailto:${config.contactEmail || 'skyparty@ukr.net'}`} 
              className="bg-zinc-900/30 border border-white/5 hover:border-blue-500/30 p-6 rounded-2xl flex items-center gap-4 transition-all hover:bg-zinc-900/50 group"
            >
              <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400 border border-white/5 group-hover:scale-110 transition-transform">
                <Mail size={20} />
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">E-mail</p>
                <p className="text-sm font-bold text-zinc-200 truncate">{config.contactEmail || 'skyparty@ukr.net'}</p>
              </div>
            </a>

            {/* Location Contact Card */}
            <div className="bg-zinc-900/30 border border-white/5 p-6 rounded-2xl flex items-center gap-4 md:col-span-2">
              <div className="p-3 rounded-xl bg-zinc-500/10 text-zinc-400 border border-white/5">
                <MapPin size={20} />
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Локація</p>
                <p className="text-sm font-bold text-zinc-200">{config.contactAddress || 'м. Київ, вул. Паркова, 12'}</p>
              </div>
            </div>
          </motion.div>
        )}
      </main>

      {/* Elegant Footer signature */}
      <footer className="py-8 px-6 mt-16 border-t border-white/5 bg-zinc-950/20 text-center text-zinc-600 text-[10px] uppercase tracking-widest">
        <p>© 2026 {config?.bannerTitle || 'SKY PARTY'}. ВСІ ПРАВА ЗАХИЩЕНІ.</p>
      </footer>
    </div>
  );
}
