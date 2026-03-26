"use client";

import { useState, useEffect, useCallback, useRef } from "react";

type Card = {
  id: number;
  fruit: string;
  isImage: boolean;
  isFlipped: boolean;
  isMatched: boolean;
  isMismatch: boolean;
};

type RankEntry = {
  name: string;
  finish: number;
};

const FRUITS = [
  { name: "strawberry", value: "/fruits/strawberry.png", isImage: true },
  { name: "banana", value: "/fruits/banana.png", isImage: true },
  { name: "grapes", value: "/fruits/grapes.png", isImage: true },
  { name: "pineapple", value: "/fruits/pineapple.png", isImage: true },
  { name: "apple", value: "/fruits/apple.png", isImage: true },
  { name: "cherry", value: "/fruits/cherry.png", isImage: true },
  { name: "kiwi", value: "🥝", isImage: false },
  { name: "watermelon", value: "🍉", isImage: false },
];

const GOOGLE_SHEET_URL = "https://script.google.com/macros/s/AKfycbxtOixVNfVAh_bGkacqUIgUtx502WfVHrTyhNusZaMZKzROSG8YgCGfsR6qWCrNqJv1/exec";

export default function MemoryGame() {
  const [screen, setScreen] = useState<"start" | "playing" | "finished">("start");
  const [username, setUsername] = useState("");
  const [cards, setCards] = useState<Card[]>([]);
  const [flippedIndices, setFlippedIndices] = useState<number[]>([]);
  const [time, setTime] = useState(0);
  const [finalScore, setFinalScore] = useState<string>("0.0"); // 최종 고정 기록용
  const [isPaused, setIsPaused] = useState(false);
  const [top3, setTop3] = useState<RankEntry[]>([]);
  const [isLoadingRank, setIsLoadingRank] = useState(false);
  
  const isSaving = useRef(false);
  const isFinished = useRef(false);

  const initGame = useCallback(() => {
    const pairedFruits = [...FRUITS, ...FRUITS];
    for (let i = pairedFruits.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pairedFruits[i], pairedFruits[j]] = [pairedFruits[j], pairedFruits[i]];
    }

    const gameCards = pairedFruits.map((fruit, index) => ({
      id: index,
      fruit: fruit.value,
      isImage: fruit.isImage,
      isFlipped: false,
      isMatched: false,
      isMismatch: false,
    }));

    setCards(gameCards);
    setFlippedIndices([]);
    setTime(0);
    setFinalScore("0.0");
    setIsPaused(false);
    isSaving.current = false;
    isFinished.current = false;
    setTop3([]);
    setScreen("playing");
  }, []);

  // 타이머 (isFinished 감지 시 절대적으로 멈춤)
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (screen === "playing" && !isPaused && !isFinished.current) {
      interval = setInterval(() => {
        setTime((prev) => prev + 100);
      }, 100);
    }
    return () => clearInterval(interval);
  }, [screen, isPaused]);

  // 구글 시트 데이터 전송 및 랭킹 조회
  const sendDataAndFetchRank = useCallback(async (userName: string, fixedTime: string) => {
    if (isSaving.current) return;
    isSaving.current = true;

    try {
      await fetch(GOOGLE_SHEET_URL, {
        method: "POST",
        mode: "no-cors",
        cache: "no-cache",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ name: userName, finish: fixedTime + "s" }),
      });
      
      const res = await fetch(GOOGLE_SHEET_URL);
      if (res.ok) {
        const data = await res.json();
        setTop3(data);
      }
    } catch (e) {
      console.error("데이터 통신 중 오류 발생:", e);
    }
  }, []);

  const handleCardClick = (index: number) => {
    if (screen !== "playing" || isPaused || isFinished.current || cards[index].isFlipped || cards[index].isMatched || flippedIndices.length >= 2) return;

    const newCards = [...cards];
    newCards[index].isFlipped = true;
    setCards(newCards);

    const newFlipped = [...flippedIndices, index];
    setFlippedIndices(newFlipped);

    if (newFlipped.length === 2) {
      const [first, second] = newFlipped;
      if (newCards[first].fruit === newCards[second].fruit) {
        
        // 매칭 성공 시, 이것이 마지막 쌍인지 즉시 체크
        const matchedSoFar = cards.filter(c => c.isMatched).length;
        if (matchedSoFar === 14) { 
          // 14개 이미 맞춤 + 지금 2개 맞춤 = 16개(전체). 즉시 시간 정지!
          isFinished.current = true; 
          const snapTime = (time / 1000).toFixed(1); // 찰나의 시간 박제
          setFinalScore(snapTime);
          
          setTimeout(() => {
            setCards(prev => {
              const nextCards = [...prev];
              nextCards[first].isMatched = true;
              nextCards[second].isMatched = true;
              return nextCards;
            });
            setScreen("finished");
            sendDataAndFetchRank(username, snapTime);
          }, 500);
        } else {
          // 마지막 쌍이 아닐 때는 일반적인 플로우
          setTimeout(() => {
            setCards(prev => {
              const nextCards = [...prev];
              nextCards[first].isMatched = true;
              nextCards[second].isMatched = true;
              return nextCards;
            });
            setFlippedIndices([]);
          }, 400);
        }
      } else {
        // 매칭 실패 시
        setTimeout(() => {
          setCards(prev => {
            const up = [...prev];
            up[first].isMismatch = true;
            up[second].isMismatch = true;
            return up;
          });
          setTimeout(() => {
            setCards(prev => {
              const up = [...prev];
              up[first].isFlipped = false;
              up[second].isFlipped = false;
              up[first].isMismatch = false;
              up[second].isMismatch = false;
              return up;
            });
            setFlippedIndices([]);
          }, 600);
        }, 400);
      }
    }
  };

  return (
    <main className="flex flex-col flex-1 items-center justify-center p-6 min-h-screen">
      
      {/* 시작 화면 */}
      {screen === "start" && (
        <div className="flex flex-col items-center gap-8 w-full max-w-sm bg-white p-12 rounded-[40px] shadow-2xl border border-gray-100 fade-in">
          <div className="text-5xl">🍋</div>
          <div className="flex flex-col gap-2 w-full text-center">
            <h1 className="text-3xl font-black text-[#fba98e] tracking-tighter uppercase italic">과일 짝 맞추기</h1>
            <input 
              type="text" 
              className="w-full px-6 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-[#fba98e] focus:outline-none text-xl text-center transition-all mb-4"
              placeholder="본인의 별명을 적어주세요!"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && username && initGame()}
            />
          </div>
          <button 
            disabled={!username}
            className="w-full py-4 bg-[#fba98e] text-white text-2xl font-black rounded-3xl shadow-lg hover:scale-105 active:scale-95 transition-all"
            onClick={initGame}
          >
            게임 시작하기
          </button>
        </div>
      )}

      {/* 게임 진행 화면 */}
      {screen === "playing" && (
        <div className="flex flex-col items-center w-full max-w-[480px] gap-6 fade-in">
          <div className="timer-box mt-4">{(time / 1000).toFixed(1)}s</div>
          <div className="relative w-full">
            {isPaused && (
              <div className="absolute inset-x-[-10px] inset-y-[-10px] z-50 rounded-[40px] bg-white/70 backdrop-blur-md flex flex-col items-center justify-center gap-6 shadow-2xl">
                 <h2 className="text-4xl font-black text-gray-700">일시 정지</h2>
                 <button className="px-12 py-4 bg-[#fba98e] text-white text-xl font-bold rounded-2xl shadow-lg" onClick={() => setIsPaused(false)}>계속하기</button>
              </div>
            )}
            <div className="card-grid">
              {cards.map((card, index) => (
                <div key={card.id} className="card-item" onClick={() => handleCardClick(index)}>
                  <div className={`card-inner ${card.isFlipped || card.isMatched ? 'is-flipped' : ''}`}>
                    <div className="card-front"><span className="opacity-30">★</span></div>
                    <div className="card-back shadow-inner">
                      {card.isImage ? <img src={card.fruit} alt="fruit" className="w-[85%] h-[85%] object-contain" /> : <span className="text-6xl">{card.fruit}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-between w-full mt-4 gap-3 px-2">
             <button className="game-btn btn-blue flex-1 py-4" onClick={() => setIsPaused(true)}>⏸️ 정지</button>
             <button className="game-btn btn-red flex-1 py-5" onClick={initGame}>🔄 재시작</button>
             <button className="game-btn btn-blue flex-1 py-4" onClick={() => setScreen("start")}>🏠 처음으로</button>
          </div>
        </div>
      )}

      {/* 완료 화면 및 명예의 전당 */}
      {screen === "finished" && (
        <div className="flex flex-col items-center gap-8 w-full max-w-md bg-white p-12 rounded-[48px] shadow-2xl border border-gray-100 fade-in text-center">
          <div className="text-6xl">✨</div>
          <div className="flex flex-col gap-1">
             <h2 className="text-3xl font-black text-gray-800 uppercase italic">SUCCESS!</h2>
             <p className="text-gray-500 font-bold">{username} 님의 기록 : <span className="text-[#fba98e]">{finalScore}s</span></p>
          </div>

          <div className="w-full bg-[#fdf2f0] p-6 rounded-[35px] border-2 border-[#fba98e]/10">
             <h3 className="text-xl font-black text-[#fba98e] mb-4 uppercase italic">🏆 명예의 전당 (Top 3)</h3>
             {top3.length === 0 ? (
               <div className="animate-pulse text-gray-400 font-bold py-4">랭킹 수집 중...</div>
             ) : (
               <div className="flex flex-col gap-3">
                 {top3.map((entry, idx) => (
                   <div key={idx} className="flex justify-between items-center bg-white px-5 py-3 rounded-2xl shadow-sm border border-[#fba98e]/10">
                     <span className={`font-black ${idx === 0 ? 'text-amber-500 text-lg' : 'text-gray-600'}`}>{idx+1}위. {entry.name}</span>
                     <span className="font-mono font-black text-gray-400">{entry.finish}s</span>
                   </div>
                 ))}
               </div>
             )}
          </div>

          <div className="flex flex-col w-full gap-3 mt-2">
            <button className="w-full py-4 bg-[#fba98e] text-white text-xl font-black rounded-2xl shadow-lg" onClick={initGame}>다시 하기</button>
            <button className="w-full py-4 bg-gray-50 text-gray-400 font-bold rounded-2xl" onClick={() => setScreen("start")}>시작 화면으로</button>
          </div>
        </div>
      )}
    </main>
  );
}
