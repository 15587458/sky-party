import { Link } from 'react-router-dom';
import { Instagram } from 'lucide-react';
import { useApp } from '../contexts/AppContext';

export default function Navbar() {
  const { config } = useApp();

  return (
    <nav className="h-16 px-6 lg:px-12 border-b border-white/10 bg-bg-dark/80 backdrop-blur-xl sticky top-0 z-50 flex items-center justify-between">
      <Link to="/" className="flex items-center gap-4 group">
        {config?.logoUrl && (
          <img src={config.logoUrl} alt="Logo" className="h-10 lg:h-12 w-auto object-contain transition-transform group-hover:scale-105" />
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
