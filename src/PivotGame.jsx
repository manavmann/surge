import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ChevronRight, Send, Undo2, Loader2, Trophy, Target, Zap, Award, BookOpen } from 'lucide-react';

const wordCache = new Map();
const definitionCache = new Map();
const synonymCache = new Map();

/* -------------------- utility helpers for random puzzles -------------------- */
function alpha(word) {
  return /^[a-z]+$/.test(word);
}
function randInt(n) {
  return Math.floor(Math.random() * n);
}

// words of exact length, biased to common everyday vocabulary using Zipf frequency
async function randomWordOfLength(len) {
    try {
      // md=f gives a frequency tag like "f:5.12" (Zipf scale ~1–7)
      const resp = await fetch(
        `https://api.datamuse.com/words?sp=${encodeURIComponent('?'.repeat(len))}&md=f&max=1000`
      );
      const data = await resp.json();
  
      const common = [];
      const backup = [];
      for (const x of data) {
        const w = (x.word || '').toLowerCase();
        if (!/^[a-z]+$/.test(w)) continue;
  
        const freqTag = (x.tags || []).find(t => t.startsWith('f:'));
        const zipf = freqTag ? parseFloat(freqTag.slice(2)) : 0;
  
        // everyday-ish words first
        if (zipf >= 4.5) common.push(w);
        else backup.push(w);
      }
  
      if (common.length) return common[Math.floor(Math.random() * common.length)];
      if (backup.length) return backup[Math.floor(Math.random() * backup.length)];
      return null;
    } catch {
      return null;
    }
  }
  



/* --------------------------------------------------------------------------- */

async function isValidWord(word) {
  const normalized = word.toLowerCase().trim();
  if (wordCache.has(normalized)) return wordCache.get(normalized);
  
  try {
    const dictResponse = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${normalized}`);
    if (dictResponse.ok) {
      wordCache.set(normalized, true);
      return true;
    }
    
    const datamuseResponse = await fetch(`https://api.datamuse.com/words?sp=${normalized}&max=1`);
    const datamuseData = await datamuseResponse.json();
    if (datamuseData.length > 0 && datamuseData[0].word === normalized) {
      wordCache.set(normalized, true);
      return true;
    }
    
    wordCache.set(normalized, false);
    return false;
  } catch {
    wordCache.set(normalized, true);
    return true;
  }
}

async function getWordDefinition(word) {
  const normalized = word.toLowerCase().trim();
  if (definitionCache.has(normalized)) return definitionCache.get(normalized);
  
  try {
    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${normalized}`);
    
    if (response.ok) {
      const data = await response.json();
      const wordData = data[0];
      const definition = {
        word: wordData.word,
        phonetic: wordData.phonetic || '',
        meanings: wordData.meanings.map(m => ({
          partOfSpeech: m.partOfSpeech,
          definitions: m.definitions.slice(0, 2).map(d => ({
            definition: d.definition,
            example: d.example
          }))
        }))
      };
      definitionCache.set(normalized, definition);
      return definition;
    }
    
    const datamuseResponse = await fetch(`https://api.datamuse.com/words?sp=${normalized}&md=d&max=1`);
    const datamuseData = await datamuseResponse.json();
    
    if (Array.isArray(datamuseData) && datamuseData.length > 0 && datamuseData[0].defs) {
      const defs = datamuseData[0].defs;
      const definition = {
        word: normalized,
        phonetic: '',
        meanings: defs.map(def => {
          const parts = def.split('\t');
          return {
            partOfSpeech: parts[0] || 'word',
            definitions: [{
              definition: parts[1] || `A form of the word "${normalized}"`,
              example: null
            }]
          };
        })
      };
      definitionCache.set(normalized, definition);
      return definition;
    }
    
    const fallbackDef = {
      word: normalized,
      phonetic: '',
      meanings: [{
        partOfSpeech: 'word',
        definitions: [{
          definition: `An English word spelled "${normalized}"`,
          example: null
        }]
      }]
    };
    definitionCache.set(normalized, fallbackDef);
    return fallbackDef;
    
  } catch (error) {
    const fallbackDef = {
      word: normalized,
      phonetic: '',
      meanings: [{
        partOfSpeech: 'word',
        definitions: [{
          definition: `Word: ${normalized}`,
          example: null
        }]
      }]
    };
    definitionCache.set(normalized, fallbackDef);
    return fallbackDef;
  }
}

async function getSynonyms(word) {
  const normalized = word.toLowerCase().trim();
  if (synonymCache.has(normalized)) return synonymCache.get(normalized);

  try {
    const [synRes, mlRes] = await Promise.all([
      fetch(`https://api.datamuse.com/words?rel_syn=${encodeURIComponent(normalized)}&max=200`),
      fetch(`https://api.datamuse.com/words?ml=${encodeURIComponent(normalized)}&max=200`),
    ]);

    const [synData, mlData] = await Promise.all([synRes.json(), mlRes.json()]);

    const list = [...synData, ...mlData]
      .map(item => (item.word || '').toLowerCase())
      .filter(w => w && w !== normalized && /^[a-z]+$/.test(w));

    const unique = Array.from(new Set(list));
    synonymCache.set(normalized, unique);
    return unique;
  } catch (err) {
    console.error('getSynonyms error:', err);
    synonymCache.set(normalized, []);
    return [];
  }
}

function differsByOneLetter(word1, word2) {
  if (word1.length !== word2.length) return false;
  let diffs = 0;
  for (let i = 0; i < word1.length; i++) {
    if (word1[i] !== word2[i]) diffs++;
    if (diffs > 1) return false;
  }
  return diffs === 1;
}

// --- Wordle-like scoring helpers ---
const MAX_MOVES = 5; // you already use 5
function unusedMovesBonus(movesLeft) {
  // steeper reward for finishing earlier
  // 4 left => 25, 3 => 16, 2 => 9, 1 => 4, 0 => 1
  return (movesLeft + 1) * (movesLeft + 1);
}
const CLEAR_BONUS = 5; // keep your existing clear bonus

/* ------------------------------ difficulty rules --------------------------- */
// removed the “must add N steps” rule
/* -------------------------------------------------------------------------- */

// allow finishing target at any time; still validate letter/synonym rules
async function validateMove(prevWord, nextWord, chain, targetWord) {
  const prev = prevWord.toLowerCase().trim();
  const next = nextWord.toLowerCase().trim();

  if (prev === next) {
    return { ok: false, reason: 'Same word, try something different!' };
  }

  if (chain.map(w => w.toLowerCase()).includes(next)) {
    return { ok: false, reason: 'You already used that word!' };
  }

  if (!/^[a-z]+$/.test(next)) {
    return { ok: false, reason: 'Only letters allowed, no spaces or symbols' };
  }

  const isValid = await isValidWord(next);
  if (!isValid) {
    return { ok: false, reason: `"${next}" does not seem to be a valid English word` };
  }

  if (differsByOneLetter(prev, next)) {
    return { ok: true, kind: 'letter' };
  }

  const synonyms = await getSynonyms(prev);
  if (synonyms.includes(next)) {
    return { ok: true, kind: 'synonym', gloss: `synonym of ${prev}` };
  }

  // reverse synonym check helps with asymmetry
  const reverseSyns = await getSynonyms(next);
  if (reverseSyns.includes(prev)) {
    return { ok: true, kind: 'synonym', gloss: `synonym of ${prev}` };
  }

  return { ok: false, reason: 'Not a valid letter change or synonym swap' };
}

/* ------------------- random puzzle generator, no hard coding ---------------- */
// build a start and target that are not trivial
// Build a start/target pair using only common words of the same length.
// Avoid trivial pairs: not identical, not one-letter-away, not direct synonyms.
async function generateRandomPair() {
    // choose playable lengths 4–6 (kid-friendly)
    const len = 4 + Math.floor(Math.random() * 3);
  
    // pick a common start word
    let start = await randomWordOfLength(len);
    if (!start) start = 'love'; // last-resort fallback
  
    // gather a pool of other common words of same length
    const pool = new Set();
    for (let i = 0; i < 60; i++) {
      const w = await randomWordOfLength(len);
      if (w && w !== start) pool.add(w);
      if (pool.size >= 40) break;
    }
    let candidates = [...pool];
  
    // filter out too-easy targets
    const synsOfStart = await getSynonyms(start);
    const filtered = [];
    for (const t of candidates) {
      if (t === start) continue;
      if (differsByOneLetter(start, t)) continue;
  
      // avoid direct synonyms (either direction)
      const synsOfT = await getSynonyms(t);
      const directSyn = synsOfStart.includes(t) || synsOfT.includes(start);
      if (directSyn) continue;
  
      filtered.push(t);
      if (filtered.length >= 20) break;
    }
  
    const targetPool = filtered.length ? filtered : candidates;
    let target = targetPool.length
      ? targetPool[Math.floor(Math.random() * targetPool.length)]
      : null;
  
    if (!target || target === start) {
      // final safety fallback to another very common word of same len
      const safety = await randomWordOfLength(len);
      target = safety && safety !== start ? safety : (start === 'love' ? 'time' : 'love');
    }
  
    return { start, target };
  }
  
/* --------------------------------------------------------------------------- */

function WordCard({ word, definition, label, isTarget }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative overflow-hidden rounded-3xl border-2 p-6 ${
        isTarget
          ? 'bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200'
          : 'bg-gradient-to-br from-slate-50 to-gray-50 border-gray-200'
      }`}
    >
      <div className="text-xs font-semibold tracking-wider uppercase text-gray-500 mb-2">
        {label}
      </div>
      <div className={`text-5xl font-bold mb-3 ${isTarget ? 'text-emerald-900' : 'text-gray-900'}`}>
        {word.toUpperCase()}
      </div>
      {definition?.phonetic && (
        <div className="text-sm text-gray-500 italic mb-3">
          {definition.phonetic}
        </div>
      )}
      {definition?.meanings?.[0]?.definitions?.[0] && (
        <div className="space-y-2">
          <div className="text-sm text-gray-700 leading-relaxed">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-gray-200 text-gray-800 mr-2">
              {definition.meanings[0].partOfSpeech}
            </span>
            <span className="font-medium">
              {definition.meanings[0].definitions[0].definition}
            </span>
          </div>
          {definition.meanings[0].definitions[0].example && (
            <div className="text-sm text-gray-600 italic pl-3 border-l-2 border-gray-300">
              "{definition.meanings[0].definitions[0].example}"
            </div>
          )}
        </div>
      )}
      {!definition && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading definition...
        </div>
      )}
      <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-20 ${
        isTarget ? 'bg-emerald-400' : 'bg-gray-400'
      }`} />
    </motion.div>
  );
}

function ProgressBeads({ total, used }) {
  return (
    <div className="flex items-center justify-center gap-3">
      {Array.from({ length: total }).map((_, i) => {
        const isUsed = i < used;
        return (
          <motion.div
            key={i}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: i * 0.05 }}
          >
            <motion.div
              animate={isUsed ? { scale: [1, 1.15, 1] } : {}}
              transition={{ duration: 0.3 }}
              className={`w-3 h-3 rounded-full transition-all duration-300 ${
                isUsed ? 'bg-gray-900 shadow-lg' : 'bg-gray-200'
              }`}
            />
          </motion.div>
        );
      })}
    </div>
  );
}

function ChainDisplay({ chain, definitions, moveTypes }) {
  return (
    <div className="space-y-3">
      <AnimatePresence mode="popLayout">
        {chain.map((word, index) => {
          const def = definitions.get(word);
          const moveType = index > 0 ? moveTypes[index - 1] : null;
          
          return (
            <motion.div
              key={`${word}-${index}`}
              initial={{ opacity: 0, x: -20, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative"
            >
              {index > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-2 mb-2 ml-4"
                >
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    moveType === 'synonym'
                      ? 'bg-purple-100 text-purple-700 border border-purple-200'
                      : 'bg-blue-100 text-blue-700 border border-blue-200'
                  }`}>
                    {moveType === 'synonym' ? '🔄 Synonym swap' : '✏️ Letter change'}
                  </span>
                </motion.div>
              )}
              
              <motion.div
                whileHover={{ scale: 1.01 }}
                className="group relative bg-white border-2 border-gray-200 rounded-2xl p-5 hover:border-gray-300 hover:shadow-xl transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-900 to-gray-700 text-white flex items-center justify-center text-sm font-bold shadow-lg">
                        {index + 1}
                      </div>
                      <div className="text-3xl font-black text-gray-900 tracking-tight">
                        {word.toUpperCase()}
                      </div>
                      {def?.phonetic && (
                        <div className="text-sm text-gray-500 italic font-medium">
                          {def.phonetic}
                        </div>
                      )}
                    </div>
                    
                    {def?.meanings?.[0] ? (
                      <div className="ml-11 space-y-2">
                        <div className="flex items-start gap-2">
                          <BookOpen className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <div className="text-sm text-gray-700 leading-relaxed">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-800 mr-2">
                                {def.meanings[0].partOfSpeech}
                              </span>
                              <span className="font-medium">
                                {def.meanings[0].definitions[0].definition}
                              </span>
                            </div>
                            {def.meanings[0].definitions[0].example && (
                              <div className="text-sm text-gray-600 italic mt-2 pl-3 border-l-2 border-gray-200">
                                "{def.meanings[0].definitions[0].example}"
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="ml-11 flex items-center gap-2 text-sm text-gray-500">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading definition...
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

function GameOver({ won, score, chain, moveTypes, movesLeft, targetWord, onPlayAgain }) {
  const letterMoves = moveTypes.filter(t => t === 'letter').length;
  const synonymMoves = moveTypes.filter(t => t === 'synonym').length;
  const unusedBonus = unusedMovesBonus(movesLeft);


  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="text-center space-y-6"
    >
      {won ? (
        <>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', damping: 10, stiffness: 200, delay: 0.2 }}
            className="inline-flex w-24 h-24 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-2xl"
          >
            <Trophy className="w-12 h-12" />
          </motion.div>
          
          <div>
            <h2 className="text-5xl font-black text-gray-900 mb-2">Brilliant!</h2>
            <p className="text-xl text-gray-600 font-medium">
              You solved it in {chain.length - 1} moves
            </p>
          </div>

          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3 }}
            className="inline-block"
          >
            <div className="text-7xl font-black text-gray-900">{score}</div>
            <div className="text-sm font-bold text-gray-500 uppercase tracking-wider">
              Total Score
            </div>
          </motion.div>

          <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-6 space-y-3 border-2 border-gray-200">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-gray-700 font-medium">
                <Zap className="w-4 h-4" />
                Letter changes
              </span>
              <span className="font-bold text-gray-900">+{letterMoves}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-gray-700 font-medium">
                <Target className="w-4 h-4" />
                Synonym swaps
              </span>
              <span className="font-bold text-gray-900">+{synonymMoves * 2}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-gray-700 font-medium">
                <Award className="w-4 h-4" />
                Unused moves
              </span>
              <span className="font-bold text-gray-900">+{unusedBonus}</span>
            </div>
            <div className="pt-3 border-t-2 border-gray-200 flex items-center justify-between">
              <span className="text-sm font-bold text-gray-700">Clear bonus</span>
              <span className="font-bold text-gray-900">+5</span>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="inline-flex w-24 h-24 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white text-5xl shadow-2xl">
            💭
          </div>
          
          <div>
            <h2 className="text-5xl font-black text-gray-900 mb-2">So Close!</h2>
            <p className="text-xl text-gray-600 font-medium">
              The target was <span className="font-bold text-orange-600">{targetWord.toUpperCase()}</span>
            </p>
          </div>

          <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-6 border-2 border-gray-200">
            <div className="text-sm text-gray-600 mb-2 font-semibold">Your chain</div>
            <div className="text-lg font-bold text-gray-900">
              {chain.join(' → ').toUpperCase()}
            </div>
          </div>
        </>
      )}

      <button
        onClick={onPlayAgain}
        className="w-full px-8 py-4 bg-gradient-to-r from-gray-900 to-gray-700 text-white font-bold text-lg rounded-xl hover:from-gray-800 hover:to-gray-600 active:scale-95 transition-all shadow-lg"
      >
        Play Again
      </button>
    </motion.div>
  );
}

/* ===================== ONLY CHANGE BELOW: accept onExit prop ===================== */
// ADDED: accept an optional onExit prop
export default function PivotGame({ onExit }) {
  const [puzzle, setPuzzle] = useState(null);

  const [chain, setChain] = useState([]);
  const [definitions, setDefinitions] = useState(new Map());
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [movesLeft, setMovesLeft] = useState(5);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [score, setScore] = useState(0);
  const [moveTypes, setMoveTypes] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadDefinition = async (word) => {
    const def = await getWordDefinition(word);
    if (def) {
      setDefinitions(prev => new Map(prev).set(word, def));
    }
  };

  const loadRandomPuzzle = async () => {
    const p = await generateRandomPair();
    setPuzzle(p);
    setChain([p.start]);
    setDefinitions(new Map());
    setInput('');
    setError('');
    setMovesLeft(5);
    setGameOver(false);
    setWon(false);
    setScore(0);
    setMoveTypes([]);
    await Promise.all([loadDefinition(p.start), loadDefinition(p.target)]);
  };

  useEffect(() => {
    loadRandomPuzzle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async () => {
    if (loading || !input.trim() || gameOver) return;
    
    setLoading(true);
    setError('');
    
    const word = input.toLowerCase().trim();
    const currentWord = chain[chain.length - 1];
    
    try {
      const validation = await validateMove(currentWord, word, chain, puzzle.target);

      if (!validation.ok) {
        setError(validation.reason);
        setTimeout(() => setError(''), 3000);
        setLoading(false);
        return;
      }

      await loadDefinition(word);

      const newChain = [...chain, word];
      const newMoveTypes = [...moveTypes, validation.kind];
      setChain(newChain);
      setMoveTypes(newMoveTypes);
      setInput('');

      const newMovesLeft = movesLeft - 1;
      setMovesLeft(newMovesLeft);

      const moveScore = validation.kind === 'letter' ? 1 : 2;
      const newScore = score + moveScore;
      setScore(newScore);

      if (word === puzzle.target) {
        setWon(true);
        setGameOver(true);
      
        const base = newScore; // +1 letter, +2 synonym already added
        const bonusUnused = unusedMovesBonus(newMovesLeft);
        const finalScore = base + bonusUnused + CLEAR_BONUS;
      
        setScore(finalScore);
      } else if (newMovesLeft === 0) {
      
        setGameOver(true);
        setWon(false);
      }
    } catch (err) {
      setError('Network error, please try again');
      setTimeout(() => setError(''), 3000);
    }
    
    setLoading(false);
  };

  const handleUndo = () => {
    if (chain.length > 1 && !gameOver) {
      setChain(chain.slice(0, -1));
      setMoveTypes(moveTypes.slice(0, -1));
      setMovesLeft(movesLeft + 1);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !loading) {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      setInput('');
      setError('');
    }
  };

  if (!puzzle) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-gray-900 text-2xl font-semibold flex items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin" />
          Loading puzzle...
        </div>
      </div>
    );
  }

  const startDef = definitions.get(puzzle.start);
  const targetDef = definitions.get(puzzle.target);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">

        {/* ADDED: small Home button that calls onExit if provided */}
        <div className="flex justify-end mb-2">
          {onExit && (
            <button
              onClick={onExit}
              className="px-4 py-2 bg-white border-2 border-gray-300 text-gray-700 font-bold rounded-xl hover:border-gray-400 hover:bg-gray-50 active:scale-95 transition-all"
            >
              Home
            </button>
          )}
        </div>

        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center gap-3 mb-4">
            <Sparkles className="w-8 h-8 text-gray-900" />
            <h1 className="text-7xl font-black text-gray-900 tracking-tight">PIVOT</h1>
            <Sparkles className="w-8 h-8 text-gray-900" />
          </div>
          <p className="text-xl text-gray-600 font-semibold">
            Transform words through logic and language
          </p>
        </motion.div>

        <div className="mb-8">
          <ProgressBeads total={5} used={5 - movesLeft} />
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <WordCard word={puzzle.start} definition={startDef} label="Start Word" />
          <WordCard word={puzzle.target} definition={targetDef} label="Target Word" isTarget />
        </div>

        <div className="bg-white rounded-3xl border-2 border-gray-200 p-8 shadow-2xl mb-6">
          {!gameOver ? (
            <>
              <div className="mb-8">
                <div className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 text-center">
                  📝 Your Chain
                </div>
                <ChainDisplay chain={chain} definitions={definitions} moveTypes={moveTypes} />
              </div>

              <div className="space-y-4">
                <div className="relative">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type your next word..."
                    disabled={loading}
                    className="w-full px-6 py-4 text-lg font-semibold bg-white border-2 border-gray-300 rounded-2xl focus:outline-none focus:border-gray-900 focus:ring-4 focus:ring-gray-100 transition-all placeholder:text-gray-400 disabled:bg-gray-50"
                  />
                  {loading && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                    </div>
                  )}
                </div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-red-50 border-2 border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 font-semibold text-center"
                  >
                    ❌ {error}
                  </motion.div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={handleSubmit}
                    disabled={loading || !input.trim()}
                    className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-gray-900 to-gray-700 text-white font-bold rounded-xl hover:from-gray-800 hover:to-gray-600 active:scale-95 disabled:from-gray-300 disabled:to-gray-300 disabled:text-gray-500 transition-all shadow-lg"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Checking...
                      </>
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        Submit
                      </>
                    )}
                  </button>
                  
                  <button
                    onClick={handleUndo}
                    disabled={chain.length <= 1 || loading}
                    className="px-6 py-3 bg-white border-2 border-gray-300 text-gray-700 font-bold rounded-xl hover:border-gray-400 hover:bg-gray-50 active:scale-95 disabled:opacity-50 transition-all"
                  >
                    <Undo2 className="w-5 h-5" />
                  </button>
                </div>

                <div className="text-center text-sm text-gray-500 font-medium">
                  Press <kbd className="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-xs font-mono font-bold">Enter</kbd> to submit
                  {' · '}
                  <kbd className="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-xs font-mono font-bold">Esc</kbd> to clear
                </div>

                <div className="text-center text-sm text-gray-700 pt-4 border-t-2 border-gray-200 font-semibold">
                  🎯 Moves left: <span className="text-gray-900">{movesLeft}</span> · 
                  ⭐ Score: <span className="text-gray-900">{score}</span>
                </div>
              </div>
            </>
          ) : (
            <GameOver
              won={won}
              score={score}
              chain={chain}
              moveTypes={moveTypes}
              movesLeft={movesLeft}
              targetWord={puzzle.target}
              onPlayAgain={() => {
                if (won) {
                  // brand new random puzzle on win
                  loadRandomPuzzle();
                } else {
                  // retry same puzzle on loss
                  setChain([puzzle.start]);
                  setDefinitions(new Map());
                  setInput('');
                  setError('');
                  setMovesLeft(5);
                  setGameOver(false);
                  setWon(false);
                  setScore(0);
                  setMoveTypes([]);
                  Promise.all([loadDefinition(puzzle.start), loadDefinition(puzzle.target)]);
                }
              }}
            />
          )}
        </div>

        <div className="text-center text-sm text-gray-500 font-medium">
          <p>Change one letter OR swap to a synonym · Every step must be a real word</p>
        </div>
      </div>
    </div>
  );
}
