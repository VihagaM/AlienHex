import { useState } from 'react';
import { LogOut, Power, RefreshCw } from 'lucide-react';

function ActionButton({ icon: Icon, label, onClick, disabled, tone }) {
  const tones = {
    neutral: 'border-slate-700 bg-slate-800/60 text-slate-200 hover:bg-slate-800',
    danger: 'border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20',
    primary: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20',
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${tones[tone]}`}
    >
      <Icon size={18} />
      {label}
    </button>
  );
}

export default function Controls({ bot, onAction }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async (path, confirmText) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    setError('');
    try {
      await onAction(path);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const transitioning = bot.status === 'connecting' || bot.status === 'disconnecting';

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Bot controls</h2>
      <div className="space-y-3">
        {bot.status === 'disconnected' && (
          <ActionButton icon={Power} label="Connect" tone="primary" disabled={busy} onClick={() => run('/api/start')} />
        )}
        <ActionButton
          icon={RefreshCw}
          label="Restart bot"
          tone="neutral"
          disabled={busy || transitioning}
          onClick={() => run('/api/restart')}
        />
        <ActionButton
          icon={LogOut}
          label="Logout / unlink device"
          tone="danger"
          disabled={busy || transitioning || bot.status === 'disconnected'}
          onClick={() => run('/api/logout', 'Log out and delete the saved session? You will need to scan a new QR code.')}
        />
      </div>
      {error && <p className="mt-3 text-xs text-rose-400">{error}</p>}
    </section>
  );
}
