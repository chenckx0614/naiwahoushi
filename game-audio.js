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

  function prepare() {
    if(loading) return loading;
    try { context ??= new (window.AudioContext||window.webkitAudioContext)(); }
    catch { return Promise.resolve(); }
    loading=Promise.all(Object.entries(urls).flatMap(([name,files])=>files.map(async (url,index)=>{
      try {
        const response=await fetch(url);
        if(!response.ok) throw new Error(`HTTP ${response.status}`);
        const buffer=await context.decodeAudioData(await response.arrayBuffer());
        (buffers[name] ??= [])[index]=buffer;
      } catch(error) { console.warn('[audio] failed to load',name,error); }
    }))).then(()=>startAmbient());
    return loading;
  }

  function startAmbient() {
    if(!context || ambientSource || !music || context.state!=='running' || !buffers.ambient?.[0]) return;
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
    prepare();
    context?.resume().then(startAmbient).catch(()=>{});
  }
  function pause() { context?.suspend().catch(()=>{}); }
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
