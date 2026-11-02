'use client';
import {useEffect,useState} from 'react';
import {Download,X} from 'lucide-react';
export default function Pwa(){const [prompt,setPrompt]=useState<any>(null);useEffect(()=>{if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});const handler=(e:Event)=>{e.preventDefault();setPrompt(e)};window.addEventListener('beforeinstallprompt',handler);return()=>window.removeEventListener('beforeinstallprompt',handler)},[]);if(!prompt)return null;return <div className="install-pwa"><button onClick={async()=>{await prompt.prompt();setPrompt(null)}}><Download size={15}/>Install Muthi</button><button aria-label="Dismiss install prompt" onClick={()=>setPrompt(null)}><X size={14}/></button></div>}
