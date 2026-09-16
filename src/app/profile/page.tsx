import { ProfilePanel } from '@/components/profile';
export const metadata = { title: 'MyDreamy' };
export default function Profile() {
  return (
    <div className="page">
      <div className="page-heading">
        <p className="eyebrow">A SPACE THAT’S ALL YOURS</p>
        <h1>Hey, main character.</h1>
        <p>Your favorite sounds, personal bests, and a little piece of the Ambatuverse.</p>
      </div>
      <ProfilePanel />
    </div>
  );
}
