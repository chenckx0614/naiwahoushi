import ambientUrl from './audio/ambient.ogg';
import step1Url from './audio/step-1.ogg';
import step2Url from './audio/step-2.ogg';
import step3Url from './audio/step-3.ogg';
import splash1Url from './audio/splash-1.ogg';
import splash2Url from './audio/splash-2.ogg';
import growl1Url from './audio/growl-1.mp3';
import growl2Url from './audio/growl-2.mp3';
import rescueUrl from './audio/rescue.wav';

const urls={ambient:[ambientUrl],step:[step1Url,step2Url,step3Url],
  splash:[splash1Url,splash2Url],growl:[growl1Url,growl2Url],rescue:[rescueUrl]};

export function createGameAudio() {
  let context,loading,ambientSource,ambientGain;
  let music=true,sfx=true;
  const buffers={};
  let progress=0,playing=false;
  const progressListeners=new Set();

  function report(value) {
    progress=value;
    progressListeners.forEach(listener=>listener(value));
    if(value===1) progressListeners.clear();
  }

  function prepare(onProgress) {
    if(onProgress) {onProgress(progress);if(progress<1) progressListeners.add(onProgress);}
    if(loading) return loading;
    try { context ??= new (window.AudioContext||window.webkitAudioContext)(); }
    catch { report(1);return Promise.resolve(); }
    const files=Object.entries(urls).flatMap(([name,items])=>items.map((url,index)=>({name,url,index})));
    let completed=0;
    loading=Promise.all(files.map(async ({name,url,index})=>{
      try {
        const response=await fetch(url);
        if(!response.ok) throw new Error(`HTTP ${response.status}`);
        const buffer=await context.decodeAudioData(await response.arrayBuffer());
        (buffers[name] ??= [])[index]=buffer;
      } catch(error) { console.warn('[audio] failed to load',name,error); }
      completed++;report(completed/files.length);
    })).then(()=>report(1));
    return loading;
  }

  function startAmbient() {
    if(!playing || !context || ambientSource || !music || context.state!=='running' || !buffers.ambient?.[0]) return;
    ambientSource=context.createBufferSource();ambientSource.buffer=buffers.ambient[0];ambientSource.loop=true;
    ambientGain=context.createGain();ambientGain.gain.value=.14;
    ambientSource.connect(ambientGain);ambientGain.connect(context.destination);
    ambientSource.start();
  }

  function play(name,volume=1,rate=1) {
    if(!sfx || !context || context.state!=='running') return;
    const choices=buffers[name]?.filter(Boolean);
    if(!choices?.length) return;
    const source=context.createBufferSource(),gain=context.createGain();
    source.buffer=choices[Math.floor(Math.random()*choices.length)];
    source.playbackRate.value=rate;
    gain.gain.value=volume;
    source.connect(gain);gain.connect(context.destination);source.start();
  }

  function start() {
    playing=true;
    prepare();
    context?.resume().then(startAmbient).catch(()=>{});
  }
  function pause() { playing=false;context?.suspend().catch(()=>{}); }
  function stop() {
    if(ambientSource) {ambientSource.stop();ambientSource.disconnect();ambientSource=null;}
    ambientGain?.disconnect();ambientGain=null;
    pause();
  }
  function setPreferences(prefs) {
    music=prefs?.music!==false;sfx=prefs?.sfx!==false;
    if(ambientGain) ambientGain.gain.value=music?.14:0;
    if(music) startAmbient();
  }
  return {prepare,start,pause,stop,play,setPreferences};
}
