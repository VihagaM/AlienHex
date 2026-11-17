import { QRCodeSVG } from 'qrcode.react';
import { CheckCircle2, Loader2, Power } from 'lucide-react';

export default function QRCard({ bot, onConnect, busy }) {
  const { status, qr } = bot;

  return (
    <section className="flex flex-col rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Pair device</h2>

      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-2 text-center">
        {status === 'qr' && qr && (
          <>
            <div className="rounded-2xl bg-white p-4 shadow-lg shadow-emerald-500/10">
              <QRCodeSVG value={qr} size={216} level="M" />
            </div>
            <ol className="space-y-1 text-left text-xs text-slate-400">
              <li>1. Open WhatsApp on your phone</li>
              <li>2. Settings › Linked devices › Link a device</li>
              <li>3. Point your camera at this code</li>
            </ol>
          </>
        )}

        {(status === 'connecting' || status === 'disconnecting' || (status === 'qr' && !qr)) && (
          <div className="flex flex-col items-center gap-3 text-slate-400">
            <Loader2 size={36} className="animate-spin text-sky-400" />
            <p className="text-sm">{status === 'disconnecting' ? 'Closing session…' : 'Waiting for QR code…'}</p>
          </div>
        )}

        {status === 'connected' && (
          <div className="flex flex-col items-center gap-3 text-emerald-400">
            <CheckCircle2 size={56} />
            <p className="text-base font-medium">Bot is online</p>
            <p className="text-xs text-slate-400">Session saved — no need to scan again after a restart.</p>
          </div>
        )}

        {status === 'disconnected' && (
          <div className="flex flex-col items-center gap-4">
            <p className="text-sm text-slate-400">The bot is not running.</p>
            <button
              onClick={onConnect}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:opacity-50"
            >
              <Power size={16} /> Connect
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
