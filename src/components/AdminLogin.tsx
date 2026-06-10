import { useState } from 'react';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import { Lock, User } from 'lucide-react';
import { motion } from 'motion/react';

export default function AdminLogin() {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { setAdmin } = useApp();
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real app, this should be handled by Firebase Auth, but as requested:
    if (login === 'admin' && password === 'admin-party-2026') {
      setAdmin(true);
      navigate('/admin/dashboard');
    } else {
      setError('Невірний логін або пароль');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black px-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-8 p-8 rounded-3xl bg-zinc-900 border border-zinc-800"
      >
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-2xl bg-purple-500/10 text-purple-400 mb-2">
            <Lock size={32} />
          </div>
          <h2 className="text-3xl font-bold tracking-tight">Вхід в адмін-панель</h2>
          <p className="text-zinc-500 text-sm">Введіть ваші дані для доступу до керування</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          {error && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-zinc-400 ml-1">Логін</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                <input
                  type="text"
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  className="w-full h-12 bg-zinc-800 border border-zinc-700 rounded-xl pl-12 pr-4 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                  placeholder="admin"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-zinc-400 ml-1">Пароль</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-12 bg-zinc-800 border border-zinc-700 rounded-xl pl-12 pr-4 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="w-full h-12 bg-white text-black font-bold rounded-xl hover:bg-zinc-200 transition-colors"
          >
            Увійти
          </button>
          
          <button
            type="button"
            onClick={() => navigate('/')}
            className="w-full h-12 bg-transparent text-zinc-400 font-medium rounded-xl hover:text-white transition-colors"
          >
            Назад на сайт
          </button>
        </form>
        
      </motion.div>
    </div>
  );
}
