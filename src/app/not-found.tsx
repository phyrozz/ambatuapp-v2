import Link from 'next/link';
export default function NotFound() {
  return (
    <div className="page empty-state">
      <p className="eyebrow">404 · A LITTLE LOST IN THE LORE</p>
      <h1>This detour ends here.</h1>
      <p>Let’s get you back to the good stuff.</p>
      <Link className="button dark" href="/">
        Back to Discover
      </Link>
    </div>
  );
}
