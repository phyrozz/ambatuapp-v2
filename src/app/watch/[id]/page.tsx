import { CommunityVideoPage } from '@/components/community-video-page';
export default async function VideoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CommunityVideoPage id={id} />;
}
