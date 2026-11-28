import React, { useEffect, useId, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useFocusTrap } from '../lib/useFocusTrap';

export default function ProfileDialog({
  onClose,
  notify,
}: {
  onClose: () => void;
  notify: (message: string, type?: 'ok' | 'err') => void;
}) {
  const [number, setNumber] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const inputId = useId();
  const headingId = useId();
  const panelRef = useFocusTrap<HTMLDivElement>(true);

  useEffect(() => {
    apiFetch('/profile')
      .then(async (res) => {
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Gagal memuat profil');
        setNumber(json.data.whatsapp_number || '');
        setEnabled(json.data.notifications_enabled !== false);
      })
      .catch((err: any) => setMessage(err?.message || 'Gagal memuat profil'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const res = await apiFetch('/profile', {
        method: 'PATCH',
        body: JSON.stringify({ whatsapp_number: number, notifications_enabled: enabled }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Gagal menyimpan');
      notify('Nomor WhatsApp tersimpan');
      onClose();
    } catch (err: any) {
      setMessage(err?.message || 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4 backdrop-blur-sm">
      <button type="button" aria-label="Tutup pengaturan" onClick={onClose} className="absolute inset-0 cursor-default" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="relative z-10 w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <Bell className="h-4 w-4" />
            </div>
            <div>
              <h2 id={headingId} className="text-base font-semibold text-slate-900">Pengaturan notifikasi</h2>
              <p className="mt-0.5 text-xs text-slate-500">Pengingat deadline dikirim ke nomor ini.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup pengaturan"
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="mt-5 space-y-4">
          <div>
            <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-slate-600">
              Nomor WhatsApp
            </label>
            <input
              id={inputId}
              type="tel"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="628xxxxxxxxxx"
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 transition placeholder-slate-500 focus:border-slate-400"
            />
            <p className="mt-1.5 text-xs text-slate-500">Gunakan format 628 di awal, tanpa tanda plus.</p>
          </div>

          <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-4 w-4 accent-indigo-600"
            />
            Kirim pengingat otomatis
          </label>

          {message && (
            <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
              {message}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-200 bg-white py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving || loading}
              className="flex-1 rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
