import { LoaderCircle } from 'lucide-react';
export function ApiLoading({ label = 'Loading…' }: { label?: string }) { return <div className="api-loading" role="status"><LoaderCircle size={24}/><span>{label}</span></div>; }
