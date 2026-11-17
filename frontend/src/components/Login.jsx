import { useState } from 'react';
import { Lock } from 'lucide-react';

export default function Login({ onSubmit }) {
  const [value, setValue] = useState('');

  const submit = (e) => {
    e.preventDefault();
    if (value.trim()) onSubmit(value.trim());
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-400">
            <Lock size={20} />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">Dashboard locked</h1>
            <p className="text-sm text-slate-400">Enter your access token</p>
          </div>
        </div>
        <input
          type="password"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="DASHBOARD_TOKEN"
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-emerald-500"
        />
        <button
          type="submit"
          className="mt-4 w-full rounded-lg bg-emerald-600 py-2 text-sm font-medium text-white transition hover:bg-emerald-500"
        >
          Unlock
        </button>
      </form>
    </div>
  );
}
