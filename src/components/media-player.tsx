'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Maximize, Minimize, Pause, Play, Volume1, Volume2, VolumeX } from 'lucide-react';
import { useI18n } from './i18n-provider';

type MediaPlayerProps = {
  src: string;
  variant?: 'watch' | 'chat';
  autoPlay?: boolean;
  playsInline?: boolean;
  onLoadedMetadata?: () => void;
  onLoadedData?: () => void;
  onError?: () => void;
};
type MediaProgressStyle = CSSProperties & { '--media-progress': string };

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const minutes = Math.floor(total % 3600 / 60);
  const clock = `${String(minutes).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  return total >= 3600 ? `${Math.floor(total / 3600)}:${clock}` : `${minutes}:${clock.slice(-2)}`;
}

export function MediaPlayer({
  src,
  variant = 'watch',
  autoPlay = false,
  playsInline = true,
  onLoadedMetadata,
  onLoadedData,
  onError,
}: MediaPlayerProps) {
  const { t } = useI18n();
  const player = useRef<HTMLDivElement>(null);
  const media = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const syncFullscreen = () => setFullscreen(document.fullscreenElement === player.current);
    document.addEventListener('fullscreenchange', syncFullscreen);
    return () => document.removeEventListener('fullscreenchange', syncFullscreen);
  }, []);

  function togglePlayback() {
    const element = media.current;
    if (!element) return;
    if (element.paused) void element.play().catch(() => setPlaying(false));
    else element.pause();
  }

  function changeVolume(value: number) {
    const element = media.current;
    if (!element) return;
    const next = Math.min(1, Math.max(0, value));
    element.volume = next;
    element.muted = next === 0;
    setVolume(next);
    setMuted(next === 0);
  }

  async function toggleFullscreen() {
    const element = player.current;
    if (!element) return;
    try {
      if (document.fullscreenElement === element) await document.exitFullscreen();
      else await element.requestFullscreen();
    } catch {
      setFullscreen(document.fullscreenElement === element);
    }
  }

  const progress = duration ? Math.min(100, currentTime / duration * 100) : 0;

  return (
    <div
      ref={player}
      className={`ambatu-video ambatu-video--${variant}`}
      data-playing={playing}
      data-message-control=""
    >
      <video
        ref={media}
        className="ambatu-video__screen"
        src={src}
        autoPlay={autoPlay}
        muted={muted}
        playsInline={playsInline}
        preload="metadata"
        tabIndex={-1}
        onClick={togglePlayback}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={event => setCurrentTime(event.currentTarget.currentTime)}
        onLoadedMetadata={event => {
          setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0);
          onLoadedMetadata?.();
        }}
        onLoadedData={onLoadedData}
        onError={onError}
      />
      {!playing && (
        <button className="ambatu-video__center-play" type="button" aria-label={t('common.play')} onClick={togglePlayback}>
          <Play size={28} fill="currentColor" />
        </button>
      )}
      <div className="ambatu-video__controls">
        <input
          className="ambatu-video__seek"
          type="range"
          min={0}
          max={duration || 1}
          step={0.1}
          value={Math.min(currentTime, duration || 0)}
          style={{ '--media-progress': `${progress}%` } as MediaProgressStyle}
          aria-label={t('media.seek')}
          aria-valuetext={`${formatTime(currentTime)} / ${formatTime(duration)}`}
          disabled={!duration}
          onChange={event => {
            const next = Number(event.currentTarget.value);
            if (media.current) media.current.currentTime = next;
            setCurrentTime(next);
          }}
        />
        <div className="ambatu-video__toolbar">
          <div className="ambatu-video__control-group">
            <button className="ambatu-video__control" type="button" aria-label={t(playing ? 'arcade.pause' : 'common.play')} onClick={togglePlayback}>
              {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
            </button>
            <span className="ambatu-video__time">{formatTime(currentTime)} <i>/</i> {formatTime(duration)}</span>
          </div>
          <div className="ambatu-video__control-group">
            <div className="ambatu-video__volume">
              <button
                className="ambatu-video__control"
                type="button"
                aria-label={t(muted ? 'media.unmute' : 'media.mute')}
                aria-pressed={muted}
                onClick={() => {
                  if (!media.current) return;
                  media.current.muted = !media.current.muted;
                  setMuted(media.current.muted);
                }}
              >
                {muted || volume === 0 ? <VolumeX size={18} /> : volume < 0.5 ? <Volume1 size={18} /> : <Volume2 size={18} />}
              </button>
              <input
                className="ambatu-video__volume-range"
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={muted ? 0 : volume}
                style={{ '--media-progress': `${(muted ? 0 : volume) * 100}%` } as MediaProgressStyle}
                aria-label={t('audio.volume')}
                onChange={event => changeVolume(Number(event.currentTarget.value))}
              />
            </div>
            <button
              className="ambatu-video__control"
              type="button"
              aria-label={t(fullscreen ? 'media.exitFullscreen' : 'media.enterFullscreen')}
              aria-pressed={fullscreen}
              onClick={() => void toggleFullscreen()}
            >
              {fullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
