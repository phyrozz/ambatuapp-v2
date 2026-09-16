import { CharacterLibrary } from '@/components/character-library';
export const metadata = { title: 'Characters' };
export default function Characters() {
  return (
    <div className="page">
      <div className="page-heading">
        <p className="eyebrow">THE PEOPLE. THE MEMES. THE LORE.</p>
        <h1>The gang’s all here.</h1>
        <p>Meet the 13 familiar faces of the Ambatuverse.</p>
      </div>
      <CharacterLibrary />
    </div>
  );
}
