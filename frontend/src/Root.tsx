import React, { useState } from 'react';
import { KeyRound, Lock } from 'lucide-react';
import App from './App';

export default function Root() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('auth_token') === 'authenticated';
  });
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const defaultPassword = import.meta.env.VITE_APP_PASSWORD || 'admin123';
    if (password === defaultPassword) {
      localStorage.setItem('auth_token', 'authenticated');
      setIsAuthenticated(true);
      setError(false);
    } else {
      setError(true);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8">
          <div className="mb-6 flex justify-center">
            <div className="rounded-lg bg-indigo-50 p-3 text-indigo-600">
              <Lock className="h-6 w-6" />
            </div>
          </div>
          <h1 className="mb-1 text-center text-xl font-semibold tracking-tight text-slate-900">StudyDesk</h1>
          <p className="mb-6 text-center text-sm text-slate-500">Masuk untuk mengelola tugas dan materi kuliahmu</p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="login-password" className="mb-1.5 block text-sm font-medium text-slate-600">
                Password
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                  <KeyRound className="h-5 w-5" />
                </span>
                <input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(false);
                  }}
                  placeholder="Masukkan password"
                  autoComplete="current-password"
                  aria-invalid={error}
                  aria-describedby={error ? 'login-error' : undefined}
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm text-slate-900 transition placeholder-slate-500 focus:border-slate-400"
                  autoFocus
                />
              </div>
              {error && (
                <p id="login-error" role="alert" className="mt-2 pl-1 text-xs text-rose-600">
                  Password salah. Coba lagi.
                </p>
              )}
            </div>

            <button
              type="submit"
              className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700"
            >
              Masuk Sistem
            </button>
          </form>
        </div>
      </main>
    );
  }

  return <App onLogout={handleLogout} />;
}
