import { LoreReader } from '@/components/lore-reader';
export default async function LorePage({params}:{params:Promise<{id:string}>}){const{id}=await params;return <LoreReader id={id}/>}
