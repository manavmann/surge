// src/App.jsx
import React, { useState } from "react";
import HomePage from "./HomePage.jsx";
import PivotGame from "./PivotGame.jsx";

export default function App() {
  const [gameStarted, setGameStarted] = useState(false);

  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-br from-zinc-50 via-white to-zinc-100">
      <main className="mx-auto max-w-6xl px-4 py-10 md:py-14">
        {gameStarted ? (
          <PivotGame onExit={() => setGameStarted(false)} />
        ) : (
          <HomePage onStartGame={() => setGameStarted(true)} />
        )}
      </main>

      <footer className="mx-auto max-w-6xl px-4 pb-10">
        <div className="rounded-2xl border border-zinc-200 bg-white/70 p-4 text-center text-sm text-zinc-600 backdrop-blur">
          Made by Manav, Armaan and Aarmen, share your chain with friends
        </div>
      </footer>
    </div>
  );
}
