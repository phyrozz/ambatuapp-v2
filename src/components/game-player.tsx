'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Flag,
  Pause,
  Play,
  RotateCcw,
  Trophy,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { games, type GameId } from '@/lib/catalog';
import {
  makeMines,
  neighbors,
  nextSnake,
  revealCells,
  spawnFood,
  type Point,
} from '@/lib/game-engine';
import { useApp } from './app-provider';
import { haptic } from '@/lib/native';
import { useI18n } from './i18n-provider';
import { AppSelect } from './app-select';
import { Leaderboard } from './leaderboard';
import { submitLeaderboardScore } from '@/lib/leaderboard';
import { useAuth } from './auth-provider';
type Status = 'ready' | 'playing' | 'paused' | 'over' | 'won';
export function GamePlayer({ id }: { id: GameId }) {
  const { t } = useI18n();
  const game = games.find((g) => g.id === id)!;
  const { scores, saveScore, volume, stop } = useApp();
  const { user, getAccessToken } = useAuth();
  const [muted, setMuted] = useState(false);
  const [leaderboardVersion, setLeaderboardVersion] = useState(0);
  const audio = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    stop();
    return () => {
      audio.current?.pause();
    };
  }, [stop]);
  const sound = useCallback(
    (file = 'audio/tap.mp3') => {
      if (muted) return;
      audio.current?.pause();
      const a = new Audio(`/assets/${file}`);
      a.volume = volume;
      audio.current = a;
      void a.play().catch(() => {});
    },
    [muted, volume],
  );
  const pendingScore = useRef(0);
  const submitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (submitTimer.current) clearTimeout(submitTimer.current); }, []);
  const onScore = useCallback((score: number) => {
    saveScore(id, score);
    if (!user || score <= pendingScore.current) return;
    pendingScore.current = score;
    if (submitTimer.current) clearTimeout(submitTimer.current);
    submitTimer.current = setTimeout(() => {
      void submitLeaderboardScore(id, pendingScore.current, getAccessToken())
        .then(() => setLeaderboardVersion((version) => version + 1))
        .catch(() => {});
    }, 900);
  }, [getAccessToken, id, saveScore, user]);
  return (
    <div className="page game-page">
      <Link className="back-link" href="/games/">
        <ArrowLeft size={17} />
        {t('games.back')}
      </Link>
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t(`game.${game.id}.category`)} · {t('games.original')}</p>
          <h1>{game.name}</h1>
        </div>
        <div className="game-header-actions">
          <span className="best-pill">
            <Trophy size={16} />
            {t('games.best', { score: scores[id] || 0 })}
          </span>
          <button
            className="icon-button"
            aria-label={t(muted ? 'games.unmute' : 'games.mute')}
            onClick={() => {
              setMuted(!muted);
              audio.current?.pause();
            }}
          >
            {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
        </div>
      </div>
      {id === 'ambatutap' ? (
        <TapGame onScore={onScore} sound={sound} />
      ) : id === 'ambatublou' ? (
        <MinesGame onScore={onScore} sound={sound} />
      ) : (
        <ArcadeGame kind={id} onScore={onScore} sound={sound} />
      )}
      <Leaderboard gameId={id} refreshKey={leaderboardVersion} />
    </div>
  );
}
type Props = { onScore: (n: number) => void; sound: (file?: string) => void };
function TapGame({ onScore, sound }: Props) {
  const { t } = useI18n();
  const [score, setScore] = useState(0),
    [combo, setCombo] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const last = useRef(0);
  const comboRef = useRef(0);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  function tap() {
    const now = performance.now();
    if (now - last.current < 40) return;
    comboRef.current = now - last.current < 1000 ? comboRef.current + 1 : 1;
    last.current = now;
    const next = score + comboRef.current;
    setScore(next);
    setCombo(comboRef.current);
    onScore(next);
    sound();
    void haptic();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setCombo(0);
      comboRef.current = 0;
    }, 1000);
  }
  return (
    <div className="tap-arena">
      <div className="game-instructions">{t('tap.instructions')}</div>
      <p className="eyebrow">{t('tap.total')}</p>
      <strong className="big-score" aria-live="polite">
        {score.toLocaleString()}
      </strong>
      <span className="combo-pill">
        {combo ? t('tap.combo', { count: combo }) : t('tap.nextCombo')}
      </span>
      <button className="tap-target" onClick={tap} aria-label={t('tap.label')}>
        <img src="/assets/dreamy_face.jpg" alt="Dreamy" />
        <span>{t('tap.energy')}</span>
      </button>
      <p>{t('tap.controls')}</p>
      <button
        className="button secondary compact"
        onClick={() => {
          setScore(0);
          setCombo(0);
          comboRef.current = 0;
          last.current = 0;
          if (timer.current) clearTimeout(timer.current);
        }}
      >
        <RotateCcw size={16} />
        {t('tap.newRound')}
      </button>
    </div>
  );
}
function MinesGame({ onScore, sound }: Props) {
  const { t } = useI18n();
  const [difficulty, setDifficulty] = useState(0),
    [mines, setMines] = useState<Set<number>>(new Set()),
    [revealed, setRevealed] = useState<Set<number>>(new Set()),
    [flags, setFlags] = useState<Set<number>>(new Set()),
    [flagMode, setFlagMode] = useState(false),
    [status, setStatus] = useState<Status>('ready');
  const size = [8, 10, 12][difficulty],
    count = [10, 20, 30][difficulty];
  function reset(d = difficulty) {
    setDifficulty(d);
    setMines(new Set());
    setRevealed(new Set());
    setFlags(new Set());
    setStatus('ready');
    setFlagMode(false);
  }
  function flag(i: number) {
    if (revealed.has(i) || status === 'over' || status === 'won') return;
    setFlags((old) => {
      const next = new Set(old);
      if (next.has(i)) next.delete(i);
      else if (next.size < count) next.add(i);
      return next;
    });
  }
  function reveal(i: number) {
    if (status === 'over' || status === 'won' || revealed.has(i)) return;
    if (flagMode) {
      flag(i);
      return;
    }
    if (flags.has(i)) return;
    const current = status === 'ready' ? makeMines(size, count, i) : mines;
    if (status === 'ready') {
      setMines(current);
      setStatus('playing');
    }
    if (current.has(i)) {
      setStatus('over');
      sound('sounds/snake_game_over.mp3');
      return;
    }
    const next = revealCells(i, size, current, revealed, flags);
    setRevealed(next);
    onScore(next.size);
    if (next.size === size * size - count) {
      setStatus('won');
      sound('audio/score_1.mp3');
    } else sound();
  }
  return (
    <div className="mines-arena">
      <div className="game-controls">
        <div className="game-select-control">
          <span>{t('mines.difficulty')}</span>
          <AppSelect ariaLabel={t('mines.difficulty')} value={String(difficulty)} onChange={(value) => reset(+value)} options={[
            { value: '0', label: t('mines.easy') }, { value: '1', label: t('mines.medium') }, { value: '2', label: t('mines.hard') },
          ]} />
        </div>
        <button
          className={`button compact ${flagMode ? 'dark' : 'secondary'}`}
          aria-pressed={flagMode}
          onClick={() => setFlagMode(!flagMode)}
        >
          <Flag size={16} />
          {t(flagMode ? 'mines.flagOn' : 'mines.flag')}
        </button>
        <button className="icon-button" onClick={() => reset()} aria-label={t('mines.restart')}>
          <RotateCcw size={19} />
        </button>
      </div>
      <div className="mines-status">
        <span>{t('mines.remaining', { count: count - flags.size })}</span>
        <span>{t('mines.safeTiles', { count: revealed.size })}</span>
      </div>
      <div className="mines-board" style={{ gridTemplateColumns: `repeat(${size},1fr)` }}>
        {Array.from({ length: size * size }, (_, i) => {
          const open = revealed.has(i),
            mine = (status === 'over' || status === 'won') && mines.has(i),
            n = neighbors(i, size).filter((j) => mines.has(j)).length;
          return (
            <button
              key={`${difficulty}-${i}`}
              className={`mine-cell ${open ? 'revealed' : ''} ${mine ? 'exploded' : ''}`}
              onClick={() => reveal(i)}
              onContextMenu={(e) => {
                e.preventDefault();
                flag(i);
              }}
              aria-label={t('mines.cell', { row: Math.floor(i / size) + 1, column: (i % size) + 1, state: mine ? t('mines.mine') : flags.has(i) ? t('mines.flagged') : open ? t('mines.neighbors', { count: n }) : t('mines.hidden') })}
            >
              {mine ? '✹' : flags.has(i) ? '⚑' : open && n ? n : ''}
            </button>
          );
        })}
      </div>
      <div className="game-result" role="status">
        {status === 'over'
          ? t('mines.lost')
          : status === 'won'
            ? t('mines.won')
            : status === 'ready'
              ? t('mines.ready')
              : t('mines.playing')}
      </div>
      {(status === 'over' || status === 'won') && (
        <button className="button dark" onClick={() => reset()}>
          <RotateCcw size={17} />
          {t('mines.playAgain')}
        </button>
      )}
      <p className="game-instructions">
        {t('mines.controls')}
      </p>
    </div>
  );
}
type ArcadeKind = 'ambatusnake' | 'flappy-bus';
type Pipe = { x: number; gap: number; passed: boolean };
type World = {
  snake: Point[];
  food: Point;
  direction: Point;
  queued: Point;
  score: number;
  bird: number;
  velocity: number;
  pipes: Pipe[];
  ticks: number;
};
const initialWorld = (): World => ({
  snake: [
    { x: 7, y: 8 },
    { x: 6, y: 8 },
    { x: 5, y: 8 },
  ],
  food: { x: 11, y: 8 },
  direction: { x: 1, y: 0 },
  queued: { x: 1, y: 0 },
  score: 0,
  bird: 190,
  velocity: 0,
  pipes: [{ x: 430, gap: 190, passed: false }],
  ticks: 0,
});
function ArcadeGame({ kind, onScore, sound }: Props & { kind: ArcadeKind }) {
  const { t } = useI18n();
  const canvas = useRef<HTMLCanvasElement>(null),
    world = useRef(initialWorld()),
    statusRef = useRef<Status>('ready'),
    callback = useRef({ onScore, sound });
  const [status, setStatus] = useState<Status>('ready'),
    [score, setScore] = useState(0),
    [skin, setSkin] = useState('1');
  useEffect(() => {
    callback.current = { onScore, sound };
  }, [onScore, sound]);
  const changeStatus = useCallback((s: Status) => {
    statusRef.current = s;
    setStatus(s);
  }, []);
  const start = useCallback(() => {
    world.current = initialWorld();
    setScore(0);
    changeStatus('playing');
  }, [changeStatus]);
  const direction = useCallback((x: number, y: number) => {
    const w = world.current;
    if (x !== -w.direction.x || y !== -w.direction.y) w.queued = { x, y };
  }, []);
  const action = useCallback(() => {
    if (
      statusRef.current === 'ready' ||
      statusRef.current === 'over' ||
      statusRef.current === 'won'
    ) {
      start();
      return;
    }
    if (statusRef.current === 'playing' && kind === 'flappy-bus') {
      world.current.velocity = -5.1;
      callback.current.sound();
    }
  }, [kind, start]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).matches('button,input,select,a')) return;
      const dirs: Record<string, Point> = {
        ArrowUp: { x: 0, y: -1 },
        w: { x: 0, y: -1 },
        ArrowDown: { x: 0, y: 1 },
        s: { x: 0, y: 1 },
        ArrowLeft: { x: -1, y: 0 },
        a: { x: -1, y: 0 },
        ArrowRight: { x: 1, y: 0 },
        d: { x: 1, y: 0 },
      };
      if (dirs[e.key] || e.code === 'Space') {
        e.preventDefault();
        if (kind === 'ambatusnake' && dirs[e.key]) direction(dirs[e.key].x, dirs[e.key].y);
        else action();
      }
      if (e.key === 'p' && ['playing', 'paused'].includes(statusRef.current))
        changeStatus(statusRef.current === 'playing' ? 'paused' : 'playing');
    };
    const visibility = () => {
      if (document.hidden && statusRef.current === 'playing') changeStatus('paused');
    };
    window.addEventListener('keydown', key);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('keydown', key);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [action, changeStatus, direction, kind]);
  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx) return;
    const face = new Image();
    face.src =
      kind === 'ambatusnake' ? '/assets/dreamy_face.jpg' : `/assets/images/bird_${skin}.png`;
    let frame = 0,
      last = 0,
      accumulator = 0;
    const finish = (won = false) => {
      changeStatus(won ? 'won' : 'over');
      callback.current.onScore(world.current.score);
      callback.current.sound(won ? 'audio/score_1.mp3' : 'audio/death.mp3');
    };
    function update() {
      const w = world.current;
      if (kind === 'ambatusnake') {
        const next = nextSnake(w.snake, w.queued, w.food, 16);
        if (next.dead) {
          finish();
          return;
        }
        w.direction = w.queued;
        w.snake = next.snake;
        if (next.ate) {
          w.score++;
          setScore(w.score);
          callback.current.onScore(w.score);
          callback.current.sound('sounds/snake_food1.mp3');
          const food = spawnFood(w.snake, 16);
          if (!food) {
            finish(true);
            return;
          }
          w.food = food;
        }
      } else {
        w.ticks++;
        w.velocity += 0.27;
        w.bird += w.velocity;
        if (w.bird < 0 || w.bird > 376) {
          finish();
          return;
        }
        if (w.ticks % 110 === 0)
          w.pipes.push({ x: 420, gap: 110 + Math.random() * 180, passed: false });
        for (const p of w.pipes) {
          p.x -= 2.3;
          if (
            p.x < 115 &&
            p.x + 50 > 85 &&
            (w.bird - 13 < p.gap - 68 || w.bird + 13 > p.gap + 68)
          ) {
            finish();
            return;
          }
          if (!p.passed && p.x + 50 < 85) {
            p.passed = true;
            w.score++;
            setScore(w.score);
            callback.current.onScore(w.score);
            callback.current.sound('audio/score_1.mp3');
          }
        }
        w.pipes = w.pipes.filter((p) => p.x > -60);
      }
    }
    function draw() {
      const c = ctx!;
      const w = world.current;
      c.clearRect(0, 0, 400, 400);
      if (kind === 'ambatusnake') {
        c.fillStyle = '#e8efdc';
        c.fillRect(0, 0, 400, 400);
        c.strokeStyle = '#d5dfc8';
        c.lineWidth = 0.6;
        for (let i = 0; i <= 16; i++) {
          c.beginPath();
          c.moveTo(i * 25, 0);
          c.lineTo(i * 25, 400);
          c.stroke();
          c.beginPath();
          c.moveTo(0, i * 25);
          c.lineTo(400, i * 25);
          c.stroke();
        }
        c.fillStyle = '#f6542f';
        c.beginPath();
        c.arc(w.food.x * 25 + 12.5, w.food.y * 25 + 12.5, 8, 0, Math.PI * 2);
        c.fill();
        w.snake.forEach((p, i) => {
          c.fillStyle = i === 0 ? '#253e2c' : '#638559';
          c.beginPath();
          c.roundRect(p.x * 25 + 1, p.y * 25 + 1, 23, 23, 5);
          c.fill();
          if (i === 0 && face.complete && face.naturalWidth)
            c.drawImage(face, p.x * 25 + 1, p.y * 25 + 1, 23, 23);
        });
      } else {
        c.fillStyle = '#cfebef';
        c.fillRect(0, 0, 400, 400);
        c.fillStyle = '#ffffff90';
        for (let i = 0; i < 4; i++) {
          c.beginPath();
          c.ellipse(i * 125 + 20, 70 + (i % 2) * 50, 50, 16, 0, 0, Math.PI * 2);
          c.fill();
        }
        for (const p of w.pipes) {
          c.fillStyle = '#517e56';
          c.fillRect(p.x, 0, 50, p.gap - 68);
          c.fillRect(p.x, p.gap + 68, 50, 400 - p.gap - 68);
          c.fillStyle = '#325b3a';
          c.fillRect(p.x - 4, p.gap - 80, 58, 12);
          c.fillRect(p.x - 4, p.gap + 68, 58, 12);
        }
        c.fillStyle = '#bccf91';
        c.fillRect(0, 389, 400, 11);
        if (face.complete && face.naturalWidth) c.drawImage(face, 82, w.bird - 18, 36, 36);
        else {
          c.fillStyle = '#f6542f';
          c.beginPath();
          c.arc(100, w.bird, 15, 0, Math.PI * 2);
          c.fill();
        }
      }
    }
    function loop(time: number) {
      const step = kind === 'ambatusnake' ? Math.max(70, 170 - world.current.score * 4) : 1000 / 60;
      if (statusRef.current === 'playing') {
        accumulator += Math.min(time - last, 100);
        while (accumulator >= step && statusRef.current === 'playing') {
          update();
          accumulator -= step;
        }
      } else accumulator = 0;
      last = time;
      draw();
      frame = requestAnimationFrame(loop);
    }
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [kind, skin, changeStatus]);
  const swipe = useRef<Point | null>(null);
  return (
    <div className="arcade-arena">
      <div className="game-controls">
        <span className="score-pill">
          {t('arcade.score')} <b>{score}</b>
        </span>
        {kind === 'flappy-bus' && (
          <div className="game-select-control">
            <span>{t('arcade.character')}</span>
            <AppSelect ariaLabel={t('arcade.character')} value={skin} disabled={status === 'playing'} onChange={setSkin} options={[
              { value: '1', label: 'Dreamy' }, { value: '2', label: 'Kakangku' },
              { value: '3', label: 'Nissan' }, { value: '4', label: 'Bunda Rahma' },
            ]} />
          </div>
        )}
        <button
          className="button secondary compact"
          disabled={!['playing', 'paused'].includes(status)}
          onClick={() => changeStatus(status === 'playing' ? 'paused' : 'playing')}
        >
          {status === 'paused' ? <Play size={16} /> : <Pause size={16} />}{' '}
          {t(status === 'paused' ? 'arcade.resume' : 'arcade.pause')}
        </button>
      </div>
      <div className="canvas-wrap">
        <canvas
          ref={canvas}
          width={400}
          height={400}
          tabIndex={0}
          aria-label={
            kind === 'ambatusnake'
              ? t('arcade.snakeLabel')
              : t('arcade.flappyLabel')
          }
          onClick={kind === 'flappy-bus' ? action : undefined}
          onTouchStart={(e) => {
            swipe.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
          }}
          onTouchEnd={(e) => {
            if (kind !== 'ambatusnake' || !swipe.current) return;
            const dx = e.changedTouches[0].clientX - swipe.current.x,
              dy = e.changedTouches[0].clientY - swipe.current.y;
            if (Math.max(Math.abs(dx), Math.abs(dy)) > 12)
              direction(
                Math.abs(dx) > Math.abs(dy) ? Math.sign(dx) : 0,
                Math.abs(dy) >= Math.abs(dx) ? Math.sign(dy) : 0,
              );
          }}
        />
        {status !== 'playing' && (
          <div className="game-overlay">
            <span className="eyebrow">
              {status === 'over'
                ? t('arcade.tryAgain')
                : status === 'paused'
                  ? t('arcade.breather')
                  : t('arcade.highScore')}
            </span>
            <h2>
              {status === 'over'
                ? t('arcade.goodRun')
                : status === 'paused'
                  ? t('arcade.onPause')
                  : status === 'won'
                    ? t('arcade.filledBoard')
                    : t('arcade.ready')}
            </h2>
            <p>
              {status === 'over' || status === 'won'
                ? t('arcade.scored', { score })
                : kind === 'ambatusnake'
                  ? t('arcade.snakeHint')
                  : t('arcade.flappyHint')}
            </p>
            <button
              className="button dark"
              onClick={() => (status === 'paused' ? changeStatus('playing') : start())}
            >
              <Play size={17} />
              {t(status === 'paused' ? 'arcade.resume' : status === 'ready' ? 'arcade.letsPlay' : 'arcade.playAgain')}
            </button>
          </div>
        )}
      </div>
      {kind === 'ambatusnake' && (
        <div className="direction-pad" aria-label={t('arcade.directionControls')}>
          <button aria-label={t('arcade.up')} onClick={() => direction(0, -1)}>
            <ArrowUp />
          </button>
          <div>
            <button aria-label={t('arcade.left')} onClick={() => direction(-1, 0)}>
              <ArrowLeft />
            </button>
            <button aria-label={t('arcade.down')} onClick={() => direction(0, 1)}>
              <ArrowDown />
            </button>
            <button aria-label={t('arcade.right')} onClick={() => direction(1, 0)}>
              <ArrowRight />
            </button>
          </div>
        </div>
      )}
      <p className="game-instructions">
        {t(kind === 'ambatusnake' ? 'arcade.snakeControls' : 'arcade.flappyControls')}
      </p>
    </div>
  );
}
