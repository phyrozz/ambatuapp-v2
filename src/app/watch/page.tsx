import { WatchFeed } from '@/components/watch-feed';
export const metadata = { title: 'AmbatuWatch' };
export default function Watch() {
  return (
    <div className="page">
      <div className="page-heading">
        <p className="eyebrow">YOUR NEXT INTERNET DETOUR</p>
        <h1>There’s always one more clip.</h1>
        <p>The originals, the remixes, the moments. Find your next favorite.</p>
      </div>
      <WatchFeed />
    </div>
  );
}
