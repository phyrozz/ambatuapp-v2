import { SoundLibrary } from '@/components/sound-library';
export const metadata = { title: 'Soundboard' };
export default function Soundboard() {
  return (
    <div className="page">
      <div className="page-heading">
        <p className="eyebrow">TURN THE ORDINARY INTO A SOUNDBITE</p>
        <h1>Instant main character energy.</h1>
        <p>26 iconic sounds. Tap to play, tap again to stop. Mix up to ten at once.</p>
      </div>
      <SoundLibrary />
    </div>
  );
}
