'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Sparkles, Mail, Lock, ArrowRight } from 'lucide-react';
import { useAuthStore } from '@/stores/useAuthStore';

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore(s => s.login);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return setError('Compila tutti i campi');
    
    setLoading(true);
    setError('');
    
    // Simulate network delay
    setTimeout(async () => {
      const success = await login(email, password);
      if (success) {
        router.push('/dashboard');
      } else {
        setError('Email o password errati');
        setLoading(false);
      }
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-bg-main flex items-center justify-center p-4 overflow-hidden relative">
      {/* Decorative background */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-accent/10 rounded-full blur-[120px] pointer-events-none" />
      
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="w-full max-w-md relative z-10">
        
        {/* Logo */}
        <div className="flex flex-col items-center justify-center mb-8">
          <div className="w-16 h-16 rounded-2xl gradient-accent flex items-center justify-center text-white mb-4 shadow-xl shadow-accent/20">
            <Sparkles className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-display font-bold text-text-primary text-center">Bentornato</h1>
          <p className="text-text-secondary mt-2 text-center">Accedi al gestionale RevoBeauty</p>
        </div>

        {/* Form */}
        <div className="bg-bg-secondary/80 backdrop-blur-xl border border-border rounded-3xl p-8 shadow-2xl">
          {error && (
            <div className="mb-6 p-3 rounded-xl bg-error/10 border border-error/20 text-error text-sm text-center font-medium">
              {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                <input 
                  type="email" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  placeholder="admin@revobeauty.it"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/50 transition-all" 
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-text-secondary">Password</label>
                <a href="#" className="text-xs font-medium text-accent hover:underline">Password dimenticata?</a>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                <input 
                  type="password" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/50 transition-all" 
                />
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl gradient-accent text-white font-bold text-sm shadow-lg shadow-accent/20 hover:shadow-accent/40 hover:scale-[1.02] transition-all disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100">
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>Accedi <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-text-secondary mt-8">
            Non hai un account? <Link href="/register" className="font-bold text-accent hover:underline">Registrati ora</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
