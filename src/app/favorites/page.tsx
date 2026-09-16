import { SoundLibrary } from '@/components/sound-library';
export const metadata = { title: 'Your favorites' };
export default function Favorites() {
  return (
    <div className="page">
      <div className="page-heading">
        <p className="eyebrow">THE PERSONAL COLLECTION</p>
        <h1>Only your favorites.</h1>
        <p>The sounds you keep coming back to, all in one happy place.</p>
      </div>
      <SoundLibrary favoritesOnly />
    </div>
  );
}
