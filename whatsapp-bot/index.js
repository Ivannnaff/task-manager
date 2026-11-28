require('dotenv').config();
process.env.TZ = process.env.CRON_TZ || 'Asia/Jakarta';
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const {
  default: makeWASocket,
  DisconnectReason,
  fetchLatestBaileysVersion,
  initAuthCreds,
} = require('@whiskeysockets/baileys');
const { loadSession, saveSession, clearSession } = require('./store');
const cron = require('node-cron');
const qrcode = require('qrcode-terminal');
const { createClient } = require('@supabase/supabase-js');
const pino = require('pino');

const API_URL = process.env.API_URL || 'http://localhost:3000/api';
const API_KEY = process.env.BACKEND_API_KEY || '';
const PAIRING_NUMBER = (process.env.WA_PAIRING_NUMBER || '').replace(/\D/g, '');
const CRON_MORNING = process.env.CRON_MORNING || '0 7 * * *';
const CRON_EVENING = process.env.CRON_EVENING || '0 20 * * *';
const CRON_TZ = process.env.CRON_TZ || 'Asia/Jakarta';
const URGENT_THRESHOLD = Number(process.env.URGENT_THRESHOLD || 2);
const ANTI_SPAM = (process.env.ANTI_SPAM || 'true').toLowerCase() !== 'false';
const DIGEST = (process.env.DIGEST || 'true').toLowerCase() !== 'false';
const RESEND = (process.env.RESEND || 'false').toLowerCase() === 'true';
const MAX_SENDS_PER_DAY = Number(process.env.MAX_SENDS_PER_DAY || 0);
const TEST = process.argv.includes('--test');
const ONCE = process.argv.includes('--once');
const slotIndex = process.argv.indexOf('--slot');
const SLOT = ((slotIndex >= 0 && process.argv[slotIndex + 1]) || process.env.WA_SLOT || 'TEST').toUpperCase();
const ONCE_TIMEOUT_MS = Number(process.env.ONCE_TIMEOUT_MS || 60000);

const COUNT_FILE = path.join(__dirname, '.send-count.json');
function getTodayCount(today) {
  try {
    const c = JSON.parse(fs.readFileSync(COUNT_FILE, 'utf8'));
    return c.date === today ? Number(c.count) || 0 : 0;
  } catch {
    return 0;
  }
}
function bumpTodayCount(today, n = 1) {
  const count = getTodayCount(today) + n;
  try {
    fs.writeFileSync(COUNT_FILE, JSON.stringify({ date: today, count }));
  } catch (e) {
    console.warn('Gagal simpan hitungan kirim:', e.message);
  }
  return count;
}

const supabase =
  process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

if (!supabase) console.warn('SUPABASE_URL/ANON_KEY belum diset — log anti-spam (wa_logs) tidak aktif.');

let sock;
let cronScheduled = false;
let pairingRequested = false;
let isStarting = false;
let lastRunFailed = false;
let onceFinished = false;
let onceTimeout;

async function startBot() {
  if (isStarting) return;
  isStarting = true;

  try {
    let saved = await loadSession();
    let creds = saved && saved.creds ? saved.creds : initAuthCreds();
    let keys = saved && saved.keys ? saved.keys : {};
    pairingRequested = false;

    const state = {
      creds,
      keys: {
        get: (type, ids) => {
          const keyType = keys[type] || {};
          return ids.reduce((dict, id) => {
            let value = keyType[id];
            if (value) {
              dict[id] = value;
            }
            return dict;
          }, {});
        },
        set: (data) => {
          for (const type of Object.keys(data)) {
            keys[type] = keys[type] || {};
            for (const id of Object.keys(data[type])) {
              keys[type][id] = data[type][id];
            }
          }
          saveSession({ creds: state.creds, keys });
        },
      },
    };

    const saveCreds = () => {
      saveSession({ creds: state.creds, keys });
    };

    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
      version,
      auth: state,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      browser: ['Ubuntu', 'Chrome', '20.0.04'],
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(qr)}`;
        console.log('\nScan QR WhatsApp:');
        console.log('   (1) Buka link ini di browser laptop, lalu scan dengan HP:');
        console.log(`\n   ${qrUrl}\n`);
        console.log('   (2) Atau scan QR di bawah ini:\n');
        qrcode.generate(qr, { small: true });

        if (ONCE) {
          console.error('Mode --once butuh session yang sudah terpasang. Pairing ulang secara lokal, lalu simpan session ke Supabase.');
          process.exit(1);
        }
      }

      if (!ONCE && !sock.authState.creds.registered && PAIRING_NUMBER && !pairingRequested) {
        pairingRequested = true;
        try {
          setTimeout(async () => {
            const code = await sock.requestPairingCode(PAIRING_NUMBER);
            console.log(`\nKODE PAIRING WHATSAPP ANDA: ${code}\n`);
            console.log('   Buka WhatsApp → Perangkat Tertaut → Tautkan Perangkat → Tautkan dengan nomor telepon, lalu masukkan kode di atas.\n');
          }, 4000);
        } catch (err) {
          console.error('Gagal minta pairing code:', err.message);
        }
      }

      if (connection === 'open') {
        isStarting = false;
        clearTimeout(onceTimeout);
        console.log('Bot WhatsApp siap berjalan dengan Baileys!');

        if (ONCE) {
          console.log(`Mode sekali jalan: slot [${SLOT}]\n`);
          await notifyDeadline(SLOT);
          await new Promise((resolve) => setTimeout(resolve, 1500));
          onceFinished = true;
          console.log(lastRunFailed ? 'Selesai dengan error. Keluar...' : 'Selesai. Keluar...');
          process.exit(lastRunFailed ? 1 : 0);
          return;
        }

        console.log(`   Jadwal: pagi [${CRON_MORNING}] & malam [${CRON_EVENING}]`);
        console.log(`   Deadline mepet: H-${URGENT_THRESHOLD} / H-1 / hari ini / terlambat`);
        console.log(`   Mode: ${DIGEST ? 'DIGEST (gabung 1 pesan)' : 'per-tugas (1 pesan/tugas)'}`);
        console.log(`   Anti-spam: ${ANTI_SPAM ? 'AKTIF' : 'NONAKTIF (selalu kirim)'}`);
        console.log(`   Kirim ulang: ${RESEND ? 'AKTIF' : 'NONAKTIF (1 pesan per slot per hari)'}`);
        console.log(`   Batas harian: ${MAX_SENDS_PER_DAY > 0 ? MAX_SENDS_PER_DAY + ' pesan/hari' : 'tanpa batas'}\n`);

        if (!cronScheduled) {
          cron.schedule(CRON_MORNING, () => notifyDeadline('AM'));
          cron.schedule(CRON_EVENING, () => notifyDeadline('PM'));
          cronScheduled = true;
        }

        if (TEST) {
          console.log('MODE TEST: memicu pengecekan deadline sekarang...\n');
          await notifyDeadline('TEST');
          console.log('\nMode test selesai. Bot tetap jalan (Ctrl+C untuk stop).\n');
        }

        if (process.stdin.isTTY) {
          const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
          console.log('Perintah: ketik "test" lalu Enter untuk cek & kirim sekarang, "q" lalu Enter untuk keluar.\n');
          rl.on('line', async (line) => {
            const cmd = line.trim().toLowerCase();
            if (cmd === 'test' || cmd === 'trigger') {
              await notifyDeadline('TEST');
            } else if (cmd === 'q' || cmd === 'quit' || cmd === 'exit') {
              console.log('Keluar...');
              process.exit(0);
            } else if (cmd) {
              console.log('Perintah tidak dikenal. Ketik "test" untuk memicu, "q" untuk keluar.');
            }
          });
        }
      }

      if (connection === 'close') {
        isStarting = false;
        clearTimeout(onceTimeout);
        const statusCode = lastDisconnect?.error?.output?.statusCode;

        if (ONCE) {
          if (onceFinished) process.exit(0);
          console.error(`Mode --once: koneksi terputus sebelum selesai (status: ${statusCode}).`);
          if (statusCode === DisconnectReason.loggedOut) {
            await clearSession();
            console.error('Session logout dihapus dari Supabase. Lakukan pairing ulang secara lokal.');
          }
          process.exit(1);
          return;
        }

        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        console.log(`Koneksi terputus (status: ${statusCode}). Reconnecting: ${shouldReconnect}...`);

        if (shouldReconnect) {
          console.log('Menunggu 5 detik sebelum mencoba reconnect...');
          setTimeout(() => {
            startBot();
          }, 5000);
        } else {
          console.log('Bot logout terdeteksi. Menghapus session lama dari Supabase secara otomatis...');
          await clearSession();
          console.log('Session dibersihkan. Silakan restart bot untuk scan/pairing ulang.');
          process.exit(0);
        }
      }
    });
  } catch (e) {
    isStarting = false;
    console.error('startBot error:', e.message);
    if (ONCE) {
      process.exit(1);
      return;
    }
    setTimeout(() => {
      startBot();
    }, 5000);
  }
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr);
  due.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

function labelType(d) {
  if (d < 0) return 'overdue';
  if (d === 0) return 'today';
  if (d === 1) return 'H1';
  if (d === 2) return 'H2';
  return null;
}

function urgencyText(d) {
  if (d < 0) return `TERLAMBAT ${Math.abs(d)} HARI`;
  if (d === 0) return 'DEADLINE HARI INI';
  if (d === 1) return 'DEADLINE BESOK (H-1)';
  return `${d} HARI LAGI (H-${d})`;
}

function buildMessage(task, d, sent = false) {
  const due = new Date(task.deadline);
  let dateLabel = due.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  if (String(task.deadline).includes('T')) {
    dateLabel += ` pukul ${due.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
  }

  const desc = task.description ? `${task.description}\n\n` : '';
  const note = sent ? '\n_(sudah pernah dikirim hari ini)_' : '';

  return (
    `*${urgencyText(d)}*\n\n` +
    `*${task.title}*${note}\n` +
    desc +
    `Deadline: ${dateLabel}\n\n` +
    `Selesaikan sekarang, jangan ditunda.`
  );
}

function shortUrgency(d) {
  if (d < 0) return `terlambat ${Math.abs(d)} hari`;
  if (d === 0) return 'hari ini';
  if (d === 1) return 'besok (H-1)';
  return `${d} hari lagi`;
}

function clockLabel(deadline) {
  if (!String(deadline).includes('T')) return '';
  return ' • ' + new Date(deadline).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function buildDigest(items) {
  const lines = items
    .slice()
    .sort((a, b) => a.d - b.d)
    .map((it, i) => `${i + 1}. *${it.task.title}* — ${shortUrgency(it.d)}${clockLabel(it.task.deadline)}`);
  const total = items.length;
  const sentCount = items.filter((it) => it.sent).length;
  const header =
    sentCount > 0
      ? `*${total} TUGAS MENDESAK* (${sentCount} sudah dikirim)`
      : `*${total} TUGAS MENDESAK*`;
  return (
    `${header}\n\n` +
    lines.join('\n') +
    `\n\nSelesaikan sekarang, jangan ditunda.`
  );
}

async function hasLog(taskId, today) {
  if (!supabase) return false;
  const { data, error } = await supabase
    .from('wa_logs')
    .select('id')
    .eq('task_id', taskId)
    .eq('sent_on', today)
    .maybeSingle();
  if (error) console.warn('Gagal cek wa_logs:', error.message);
  return !!data;
}

async function addLog(taskId, today, type, slot) {
  if (!supabase) return;
  const { error } = await supabase.from('wa_logs').insert({
    task_id: taskId,
    sent_on: today,
    type,
    slot,
  });
  if (error) console.warn('Gagal simpan wa_logs:', error.message);
}

async function sendWAMessage(targetNumber, text) {
  const digits = targetNumber.replace(/\D/g, '');
  const jid = digits + '@s.whatsapp.net';
  await sock.sendMessage(jid, { text });
}

async function notifyDeadline(slot) {
  lastRunFailed = false;
  console.log(`
[${slot}] Pengecekan deadline...`);
  try {
    const res = await fetch(`${API_URL}/bot/digest`, {
      headers: API_KEY ? { 'x-api-key': API_KEY } : {},
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Gagal ambil data notifikasi');

    const users = json.data?.users || [];
    if (users.length === 0) {
      console.log('   Selesai. Belum ada user dengan nomor WhatsApp aktif.');
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    let remaining = MAX_SENDS_PER_DAY > 0 ? MAX_SENDS_PER_DAY - getTodayCount(today) : Infinity;
    if (MAX_SENDS_PER_DAY > 0) {
      if (remaining <= 0) {
        console.log(`   Batas harian tercapai (${MAX_SENDS_PER_DAY} pesan/hari). Tidak mengirim.`);
        return;
      }
      console.log(`   Kuota hari ini: tersisa ${remaining}/${MAX_SENDS_PER_DAY} pesan.`);
    }

    for (const user of users) {
      const target = String(user.whatsappNumber || '').replace(/D/g, '');
      if (!target) continue;

      console.log(`   User ...${target.slice(-4)}: ${user.tasks.length} tugas aktif`);
      const fresh = [];
      const resent = [];
      for (const task of user.tasks) {
        if (task.status === 'completed' || !task.deadline) continue;
        const d = daysUntil(task.deadline);
        if (d === null || d > URGENT_THRESHOLD) continue;

        const type = labelType(d);
        if (!type) continue;

        const sent = ANTI_SPAM && (await hasLog(task.id, today));
        if (sent) {
          if (RESEND) {
            console.log(`      sudah terkirim hari ini, kirim ulang: ${task.title} [${type}/${slot}]`);
            resent.push({ task, d, type, sent: true });
          } else {
            console.log(`      dilewati, sudah terkirim hari ini: ${task.title} [${type}/${slot}]`);
          }
        } else {
          fresh.push({ task, d, type, sent: false });
        }
      }

      const allItems = [...fresh, ...resent];
      if (allItems.length === 0) {
        console.log('      Tidak ada tugas mepet deadline.');
        continue;
      }

      if (DIGEST) {
        try {
          await sendWAMessage(target, buildDigest(allItems));
          bumpTodayCount(today, 1);
          console.log(`      terkirim (digest): ${fresh.length} baru, ${resent.length} kirim ulang`);
          if (ANTI_SPAM) for (const it of fresh) await addLog(it.task.id, today, it.type, slot);
        } catch (err) {
          lastRunFailed = true;
          console.error('      gagal kirim digest:', err?.message || String(err));
        }
      } else {
        let sent = 0;
        for (const { task, d, type, sent: alreadySent } of allItems) {
          if (remaining <= 0) {
            console.log(`      Batas harian tercapai (${MAX_SENDS_PER_DAY} pesan/hari). Sisa dilewati.`);
            break;
          }
          try {
            await sendWAMessage(target, buildMessage(task, d, alreadySent));
            sent++;
            remaining--;
            bumpTodayCount(today, 1);
            console.log(`      terkirim: ${task.title} [${type}/${slot}]${alreadySent ? ' (kirim ulang)' : ''}`);
            if (ANTI_SPAM && !alreadySent) await addLog(task.id, today, type, slot);
          } catch (err) {
            lastRunFailed = true;
            console.error(`      gagal kirim "${task.title}":`, err?.message || String(err));
          }
        }
        console.log(`      Selesai. ${sent} pesan terkirim.`);
      }
    }
  } catch (err) {
    lastRunFailed = true;
    console.error('notifyDeadline error:', err.message);
  }
}

if (ONCE) {
  if (MAX_SENDS_PER_DAY > 0) {
    console.warn('Mode --once: batas harian memakai file lokal dan tidak persist di GitHub Actions.');
  }
  onceTimeout = setTimeout(() => {
    console.error(`Mode --once: timeout ${ONCE_TIMEOUT_MS / 1000} detik, koneksi WhatsApp tidak open.`);
    process.exit(1);
  }, ONCE_TIMEOUT_MS);
  console.log(`Menjalankan bot WhatsApp sekali jalan (slot: ${SLOT})...`);
} else {
  console.log('Menjalankan bot WhatsApp dengan Baileys...');
}
startBot();
