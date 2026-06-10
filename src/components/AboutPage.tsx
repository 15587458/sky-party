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
          className="space-y-4"
        >
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/15 py-1.5 px-4 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-neon-purple animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest text-purple-400">ПРО НАС / ABOUT</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black uppercase text-gradient tracking-tight leading-tight">
            {config?.bannerTitle || 'SKY PARTY'}
          </h1>
          <div className="h-[2px] w-32 bg-linear-to-r from-purple-600 to-blue-500" />
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
