import { Link } from 'react-router-dom';
import { Instagram } from 'lucide-react';
import { useApp } from '../contexts/AppContext';

export default function Navbar() {
  const { config } = useApp();

  return (
    <nav className="h-16 px-6 lg:px-12 border-b border-white/10 bg-bg-dark/80 backdrop-blur-xl sticky top-0 z-50 flex items-center justify-between">
      <Link to="/" className="flex items-center gap-3.5 group">
        {config?.logoUrl ? (
          <img src={config.logoUrl} alt="Logo" className="h-10 lg:h-12 w-auto object-contain transition-transform group-hover:scale-105" />
        ) : (
          <svg className="h-10 lg:h-12 w-auto transition-transform group-hover:scale-105 aspect-square shrink-0" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="gold-grad-nav" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fff4cc" />
                <stop offset="30%" stopColor="#e1ba42" />
                <stop offset="70%" stopColor="#b88314" />
                <stop offset="100%" stopColor="#fff4cc" />
              </linearGradient>
            </defs>
            <circle cx="50" cy="50" r="45" stroke="url(#gold-grad-nav)" strokeWidth="1.2" />
            <circle cx="50" cy="50" r="41.5" stroke="url(#gold-grad-nav)" strokeWidth="0.6" strokeDasharray="1 1" opacity="0.8" />
            <g transform="translate(41, 18) scale(0.4)">
              <path d="M 6 14 A 5 5 0 0 1 15 9 A 7 7 0 0 1 31 11 A 5 5 0 0 1 34 19 A 3 3 0 0 1 31 22 L 9 22 A 3 3 0 0 1 6 14 Z" fill="none" stroke="url(#gold-grad-nav)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M 33,5 L 34.5,8 L 37.5,8.3 L 35.2,10.6 L 36,13.8 L 33,12.2 L 30,13.8 L 30.8,10.6 L 28.5,8.3 L 31.5,8 Z" fill="url(#gold-grad-nav)" />
            </g>
            <text x="50" y="52" fill="url(#gold-grad-nav)" fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" fontWeight="900" fontSize="11" letterSpacing="0.18em" textAnchor="middle">SKY</text>
            <text x="50" y="65" fill="url(#gold-grad-nav)" fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" fontWeight="900" fontSize="11" letterSpacing="0.14em" textAnchor="middle">PARTY</text>
          </svg>
        )}
        <span className="font-black text-xl lg:text-2xl tracking-[0.2em] transition-colors group-hover:text-neon-purple whitespace-nowrap">
          {config?.bannerTitle || 'SKY PARTY'}
        </span>
      </Link>
      
      <div className="flex items-center gap-4">
        {config?.instagramUrl && (
          <a 
            href={config.instagramUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="p-2 rounded-full border border-white/10 hover:bg-white/5 transition-all text-white/50 hover:text-white"
            title="Instagram"
          >
            <Instagram size={20} />
          </a>
        )}
      </div>
    </nav>
  );
}
