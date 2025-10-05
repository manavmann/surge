import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ChevronRight, Send, Undo2, Loader2, Trophy, Target, Zap, Award, BookOpen } from 'lucide-react';

// ===================== HOMEPAGE COMPONENT =====================
function RulesModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border-2 border-gray-200"
        >
          <div className="sticky top-0 bg-white border-b-2 border-gray-200 p-6 rounded-t-3xl">
            <h2 className="text-3xl font-black text-gray-900">How to Play</h2>
          </div>

          <div className="p-6 space-y-6">
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Objective</h3>
              <p className="text-gray-700 leading-relaxed">
                Transform the <span className="font-bold">START</span> word into the <span className="font-bold text-emerald-600">TARGET</span> word 
                in <span className="font-bold">5 moves or less</span>.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Rules</h3>
              <div className="space-y-3">
                <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                  <div className="font-bold text-blue-900 mb-1">Letter Change</div>
                  <p className="text-blue-800 text-sm">
                    Change exactly <span className="font-bold">one letter</span> to create a new word.
                  </p>
                  <div className="mt-2 text-xs font-mono text-blue-700">
                    Example: <span className="font-bold">COLD</span> → <span className="font-bold">GOLD</span>
                  </div>
                </div>

                <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-4">
                  <div className="font-bold text-purple-900 mb-1">Synonym Swap</div>
                  <p className="text-purple-800 text-sm">
                    Replace the word with a <span className="font-bold">synonym</span>.
                  </p>
                  <div className="mt-2 text-xs font-mono text-purple-700">
                    Example: <span className="font-bold">COLD</span> → <span className="font-bold">CHILLY</span>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Scoring</h3>
              <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Letter change</span>
                  <span className="font-bold">+1</span>
                </div>
                <div className="flex justify-between">
                  <span>Synonym swap</span>
                  <span className="font-bold">+2</span>
                </div>
                <div className="flex justify-between">
                  <span>Unused moves</span>
                  <span className="font-bold">(moves+1)²</span>
                </div>
                <div className="flex justify-between border-t-2 pt-2">
                  <span className="font-semibold">Clear bonus</span>
                  <span className="font-bold">+5</span>
                </div>
              </div>
            </div>
          </div>

          <div className="sticky bottom-0 bg-white p-6 rounded-b-3xl">
            <button
              onClick={onClose}
              className="w-full px-8 py-4 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 active:scale-95 transition-all"
            >
              Got it! Let's Play
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function HomePage({ onStartGame }) {
  const [isHovering, setIsHovering] = useState(false);
  const [showRules, setShowRules] = useState(false);

  return (
    <>
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
        <div className="text-center flex-1 flex flex-col items-center justify-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="mb-12"
          >
            <p className="text-gray-400 text-lg font-medium tracking-wide">
              A word game about connections
            </p>
          </motion.div>

          <div className="relative inline-block mb-12">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="flex items-baseline cursor-pointer select-none"
              onMouseEnter={() => setIsHovering(true)}
              onMouseLeave={() => setIsHovering(false)}
              onClick={onStartGame}
            >
              <h1 className="text-8xl md:text-9xl font-black text-gray-900 tracking-tight leading-none" style={{ fontFamily: 'ui-rounded, system-ui, -apple-system, sans-serif' }}>
                PIVOT
              </h1>
              <motion.span
                animate={{
                  scale: isHovering ? 1.2 : 1,
                  y: isHovering ? -10 : 0,
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                className="text-8xl md:text-9xl font-black leading-none"
                style={{ 
                  color: isHovering ? '#7f1d1d' : '#1f2937',
                  fontFamily: 'ui-rounded, system-ui, -apple-system, sans-serif'
                }}
              >
                {isHovering ? '!' : '.'}
              </motion.span>
            </motion.div>

            <AnimatePresence>
              {isHovering && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute -bottom-20 left-1/2 -translate-x-1/2 whitespace-nowrap"
                >
                  <div className="bg-gray-900 text-white px-6 py-3 rounded-xl font-semibold shadow-2xl">
                    Click to play
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="text-center"
          >
            <div className="text-xs font-bold text-gray-400 tracking-widest mb-6">
              SINCE 2025
            </div>
            <p className="text-gray-500 text-lg font-medium mb-8">
              Transform words through letter changes and synonyms
            </p>
            <div className="flex items-center justify-center gap-8 text-sm text-gray-400">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-500 rounded-full" />
                Letter Changes
              </span>
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 bg-purple-500 rounded-full" />
                Synonym Swaps
              </span>
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 bg-emerald-500 rounded-full" />
                5 Moves Max
              </span>
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="pb-8"
        >
          <button
            onClick={() => setShowRules(true)}
            className="text-gray-400 hover:text-gray-900 font-medium underline decoration-2 underline-offset-4 transition-colors"
          >
            How to play
          </button>
        </motion.div>
      </div>

      <RulesModal isOpen={showRules} onClose={() => setShowRules(false)} />
    </>
  );
}

export default HomePage;
