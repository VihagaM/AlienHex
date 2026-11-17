import { useEffect, useRef, useState } from 'react';
import { Terminal, Trash2 } from 'lucide-react';

const LEVEL_STYLES = {
  info: 'text-sky-400',
  success: 'text-emerald-400',
  warn: 'text-amber-400',
  error: 'text-rose-400',
  message: 'text-slate-500',
  command: 'text-fuchsia-400',
};

const FILTERS = ['all', 'command', 'message', 'error'];

export default function LogsTerminal({ logs, onClear }) {
  const [filter, setFilter] = useState('all');
  const [stick, setStick] = useState(true);
  const boxRef = useRef(null);

  const visible = filter === 'all' ? logs : logs.filter((l) => l.level === filter || (filter === 'error' && l.level === 'warn'));

  useEffect(() => {
    if (stick && boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight;
  }, [visible, stick]);

  const onScroll = () => {
    const el = boxRef.current;
    setStick(el.scrollHeight - el.scrollTop - el.clientHeight < 40);
  };

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60">
      <header className="flex flex-wrap items-center gap-3 border-b border-slate-800 px-4 py-3">
        <Terminal size={16} className="text-emerald-400" />
        <h2 className="text-sm font-semibold text-white">Live logs</h2>
        <div className="ml-auto flex items-center gap-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-md px-2 py-1 text-xs capitalize transition ${
                filter === f ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {f}
            </button>
          ))}
          <button onClick={onClear} title="Clear logs" className="ml-2 rounded-md p-1.5 text-slate-500 hover:bg-slate-800 hover:text-rose-400">
            <Trash2 size={14} />
          </button>
        </div>
      </header>

      <div ref={boxRef} onScroll={onScroll} className="scroll-thin h-80 overflow-y-auto bg-black/40 p-4 font-mono text-xs leading-relaxed">
        {visible.length === 0 ? (
          <p className="text-slate-600">Waiting for events…</p>
        ) : (
          visible.map((l) => (
            <div key={l.id} className="flex gap-3">
              <span className="shrink-0 text-slate-600">{new Date(l.ts).toLocaleTimeString([], { hour12: false })}</span>
              <span className={`w-14 shrink-0 uppercase ${LEVEL_STYLES[l.level] ?? 'text-slate-400'}`}>{l.level}</span>
              <span className="break-words text-slate-300">{l.message}</span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
