import React from 'react';
import PivotGame from './PivotGame';

export default function App() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-br from-zinc-50 via-white to-zinc-100">
      <main className="mx-auto max-w-6xl px-4 py-10 md:py-14">
        <PivotGame />
      </main>

      <footer className="mx-auto max-w-6xl px-4 pb-10">
        <div className="rounded-2xl border border-zinc-200 bg-white/70 p-4 text-center text-sm text-zinc-600 backdrop-blur">
          Made by Manav, Armaan and Aarmen, share your chain with friends
        </div>
      </footer>
    </div>
  );
}
