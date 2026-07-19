'use client';

import React, { useEffect, useState } from 'react';
import { Send, Loader2, CheckCircle2, ChevronDown } from 'lucide-react';
import { loadTelegramConfig, saveTelegramConfig, testTelegram, listTelegramChats, type TelegramChat } from '@/app/actions/telegram';

export default function TelegramAgentConfig() {
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [chats, setChats] = useState<TelegramChat[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    loadTelegramConfig().then(c => { setEnabled(c.enabled); setBotToken(c.botToken); setChatId(c.chatId); setLoaded(true); }).catch(() => setLoaded(true));
  }, []);

  const save = async (nextEnabled?: boolean) => {
    setSaving(true);
    const cfg = { enabled: nextEnabled ?? enabled, botToken: botToken.trim(), chatId: chatId.trim() };
    await saveTelegramConfig(cfg);
    setEnabled(cfg.enabled);
    setSaving(false);
    setMsg({ ok: true, text: 'Impostazioni salvate' });
    setTimeout(() => setMsg(null), 3000);
  };

  const doTest = async () => {
    setTesting(true);
    await save();
    const res = await testTelegram();
    setTesting(false);
    setMsg(res.ok ? { ok: true, text: 'Messaggio di prova inviato! Controlla Telegram.' } : { ok: false, text: res.error || 'Invio fallito' });
    setTimeout(() => setMsg(null), 5000);
  };

  const status = enabled && botToken && chatId
    ? { label: 'Attivo', cls: 'bg-success/10 text-success' }
    : { label: 'Da configurare', cls: 'bg-warning/10 text-warning' };

  return (
    <div className="rounded-xl bg-bg-tertiary/50 border border-border/30 overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-4 p-4 text-left">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#229ED915' }}>
          <Send className="w-5 h-5" style={{ color: '#229ED9' }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-text-primary">Notifiche Incassi su Telegram</p>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${status.cls}`}>{status.label}</span>
          </div>
          <p className="text-xs text-text-muted mt-0.5">Manda un messaggio Telegram ad ogni incasso (vendite, pacchetti, cassa).</p>
        </div>
        <ChevronDown className={`w-4 h-4 text-text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-border/30 pt-3">
          {/* Attivo */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-bg-secondary border border-border/50">
            <span className="text-sm font-medium text-text-primary">Notifiche attive</span>
            <button onClick={() => save(!enabled)} disabled={!loaded || saving}
              className={`relative w-12 h-6 rounded-full transition-colors ${enabled ? 'bg-success' : 'bg-bg-hover'}`}>
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${enabled ? 'left-7' : 'left-1'}`} />
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Bot Token</label>
            <input type="text" value={botToken} onChange={e => setBotToken(e.target.value)} placeholder="123456789:AA..."
              className="w-full px-3 py-2.5 rounded-xl bg-bg-secondary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 font-mono" />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Dove ricevere le notifiche</label>
            <button onClick={async () => {
              setDetecting(true);
              const r = await listTelegramChats(botToken);
              setDetecting(false);
              if (r.ok && r.chats) { setChats(r.chats); setMsg(null); }
              else { setChats([]); setMsg({ ok: false, text: r.error || 'Non trovato' }); setTimeout(() => setMsg(null), 7000); }
            }} disabled={detecting || !botToken}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-accent/15 text-accent text-sm font-medium hover:bg-accent/25 disabled:opacity-50">
              {detecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Trova le mie chat Telegram
            </button>

            {chats.length > 0 && (
              <div className="mt-2 space-y-1.5">
                <p className="text-[11px] text-text-muted">Tocca dove vuoi ricevere gli incassi:</p>
                {chats.map(c => (
                  <button key={c.id} onClick={() => { setChatId(c.id); setMsg({ ok: true, text: `Selezionato: ${c.name}` }); setTimeout(() => setMsg(null), 4000); }}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border text-left transition-colors ${chatId === c.id ? 'bg-accent/15 border-accent/40' : 'bg-bg-secondary border-border hover:border-border-light'}`}>
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium text-text-primary truncate">{c.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-bg-tertiary text-text-muted flex-shrink-0">{c.type}</span>
                    </span>
                    {chatId === c.id && <CheckCircle2 className="w-4 h-4 text-accent flex-shrink-0" />}
                  </button>
                ))}
              </div>
            )}

            <div className="mt-2">
              <input type="text" value={chatId} onChange={e => setChatId(e.target.value)} placeholder="Chat ID (compilato automaticamente)"
                className="w-full px-3 py-2 rounded-xl bg-bg-secondary border border-border text-xs text-text-muted placeholder-text-muted focus:outline-none focus:border-accent/50 font-mono" />
            </div>
            <p className="text-[11px] text-text-muted mt-1">Per un <b>gruppo</b>: scrivi <code>/id</code> nel gruppo, poi premi &quot;Trova le mie chat&quot;.</p>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => save()} disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-xl gradient-accent text-white text-sm font-medium disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Salva
            </button>
            <button onClick={doTest} disabled={testing || !botToken || !chatId} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-bg-secondary border border-border text-text-primary text-sm font-medium hover:bg-bg-hover disabled:opacity-50">
              {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Invia prova
            </button>
            {msg && <span className={`text-xs font-medium ${msg.ok ? 'text-success' : 'text-error'}`}>{msg.text}</span>}
          </div>

          <div className="text-[11px] text-text-muted leading-relaxed p-3 rounded-xl bg-bg-secondary/50 border border-border/30">
            <p className="font-semibold text-text-secondary mb-1">Come ottenere Bot Token e Chat ID:</p>
            1. Su Telegram cerca <b>@BotFather</b> → <code>/newbot</code> → segui le istruzioni: ti dà il <b>Bot Token</b>.<br/>
            2. Apri una chat col tuo bot e scrivigli qualcosa.<br/>
            3. Per il <b>Chat ID</b>: cerca <b>@userinfobot</b> su Telegram, ti dà il tuo ID numerico (oppure usa l&apos;ID di un gruppo dove hai aggiunto il bot).
          </div>
        </div>
      )}
    </div>
  );
}
