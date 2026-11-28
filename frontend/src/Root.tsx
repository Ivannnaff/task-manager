import React, { useEffect, useState } from 'react';
import { Bell, BookOpen, Columns3, GraduationCap, KeyRound, Mail } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import App from './App';
import { supabase } from './lib/supabase';

function authErrorMessage(message: string) {
  const text = message.toLowerCase();
  if (text.includes('invalid login credentials')) return 'Email atau password salah. Coba lagi.';
  if (text.includes('email not confirmed')) return 'Email belum diverifikasi. Cek inbox kamu.';
  if (text.includes('already registered') || text.includes('user already')) return 'Email sudah terdaftar. Silakan masuk.';
  if (text.includes('password should be at least')) return 'Password minimal 6 karakter.';
  if (text.includes('unable to validate email') || text.includes('invalid email')) return 'Format email tidak valid.';
  if (text.includes('too many requests')) return 'Terlalu banyak percobaan. Tunggu sebentar.';
  return 'Gagal memproses. Coba lagi.';
}

const FEATURES = [
  { icon: Columns3, label: 'Papan Kanban', subtitle: 'Belum, sedang dikerjakan, selesai.' },
  { icon: BookOpen, label: 'Asisten belajar dari materi', subtitle: 'Penjelasan, kunci jawaban, dan post-test dari AI.' },
  { icon: Bell, label: 'Pengingat deadline via WhatsApp', subtitle: 'Otomatis pagi dan malam.' },
];

export default function Root() {
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setChecking(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setChecking(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (!data.session) {
          setMessage('Akun dibuat. Cek email kamu untuk konfirmasi, lalu masuk.');
        }
      }
    } catch (err: any) {
      setMessage(authErrorMessage(err?.message || ''));
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setEmail('');
    setPassword('');
  };

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">Menyiapkan sesi...</p>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="font-geometric min-h-screen bg-[#F8F9FC] lg:grid lg:grid-cols-[minmax(0,1fr)_560px]">
        <section className="relative flex min-w-0 flex-col overflow-hidden px-6 py-6 sm:px-12 sm:py-8 lg:px-16">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 top-10 h-64 w-64 rounded-full bg-indigo-200/25 blur-3xl"
          />

          <div className="relative flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white">
              <GraduationCap className="h-5 w-5" />
            </div>
            <span className="text-base font-bold tracking-tight text-slate-900">StudyDesk</span>
          </div>

          <div className="relative flex flex-1 items-center py-6 sm:py-12">
            <div className="max-w-4xl">
              <h1 className="text-3xl font-bold leading-[1.08] tracking-[-0.04em] text-slate-900 sm:text-4xl lg:text-[3.25rem]">
                Kelola Tugas, Pahami Materi, Anti Telat Deadline.
              </h1>

              <p className="mt-6 hidden max-w-2xl text-base leading-relaxed text-slate-600 sm:block sm:text-lg">
                Satu ruang kerja praktis untuk menyusun papan tugas, merangkum catatan kuliah dengan AI, dan dapat pengingat otomatis di WhatsApp.
              </p>

              <div className="mt-10 hidden gap-3 sm:grid sm:grid-cols-3">
                {FEATURES.map(({ icon: Icon, label, subtitle }) => (
                  <div key={label} className="rounded-lg border border-slate-200 bg-white/80 p-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                      <Icon className="h-4 w-4" />
                    </div>
                    <p className="mt-3 text-sm font-bold text-slate-900">{label}</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">{subtitle}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="flex min-w-0 items-center justify-center border-t border-slate-200 bg-white px-6 py-10 sm:px-12 lg:border-l lg:border-t-0 lg:px-8">
          <div className="w-full max-w-md">
            <h2 className="mb-8 text-2xl font-bold tracking-tight text-slate-900">
              {mode === 'login' ? 'Masuk ke StudyDesk' : 'Buat akun StudyDesk'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="auth-email" className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Email
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                    <Mail className="h-5 w-5" />
                  </span>
                  <input
                    id="auth-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@email.com"
                    autoComplete="email"
                    className="w-full rounded-lg border border-slate-200 bg-white py-3.5 pl-11 pr-4 text-sm text-slate-900 transition placeholder-slate-400 hover:border-slate-300 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="auth-password" className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Password
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                    <KeyRound className="h-5 w-5" />
                  </span>
                  <input
                    id="auth-password"
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimal 6 karakter"
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    className="w-full rounded-lg border border-slate-200 bg-white py-3.5 pl-11 pr-4 text-sm text-slate-900 transition placeholder-slate-400 hover:border-slate-300 focus:border-indigo-500"
                  />
                </div>
              </div>

              {message && (
                <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                  {message}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-indigo-600 px-4 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Menunggu...' : mode === 'login' ? 'Masuk' : 'Buat Akun'}
              </button>
            </form>

            <p className="mt-6 text-sm text-slate-500">
              {mode === 'login' ? 'Belum punya akun?' : 'Sudah punya akun?'}{' '}
              <button
                type="button"
                onClick={() => {
                  setMode(mode === 'login' ? 'register' : 'login');
                  setMessage('');
                }}
                className="py-2 font-bold text-indigo-600 hover:text-indigo-700"
              >
                {mode === 'login' ? 'Daftar' : 'Masuk'}
              </button>
            </p>
          </div>
        </section>
      </main>
    );
  }

  return <App onLogout={handleLogout} />;
}
