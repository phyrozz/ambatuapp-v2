import { NativeDetail } from '@/components/native-detail';
import { Suspense } from 'react';
export function generateStaticParams() { return process.env.NATIVE_BUILD === '1' ? [{ id: 'native' }] : []; }
export default async function LorePage({params}:{params:Promise<{id:string}>}){const{id}=await params;return <Suspense><NativeDetail kind="lores" id={id}/></Suspense>}
