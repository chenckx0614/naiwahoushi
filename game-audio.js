import ambientUrl from './audio/ambient.ogg';
import step1Url from './audio/step-1.ogg';
import step2Url from './audio/step-2.ogg';
import step3Url from './audio/step-3.ogg';
import splash1Url from './audio/splash-1.ogg';
import splash2Url from './audio/splash-2.ogg';
import growl1Url from './audio/growl-1.mp3';
import growl2Url from './audio/growl-2.mp3';
import rescueUrl from './audio/rescue.wav';
import endingUrl from './bgm/end.mp3';

const urls={ambient:[ambientUrl],step:[step1Url,step2Url,step3Url],
  splash:[splash1Url,splash2Url],growl:[growl1Url,growl2Url],rescue:[rescueUrl],ending:[endingUrl]};

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
  function playEnding() {
    if(!music || !context || context.state!=='running' || !buffers.ending?.[0]) return 0;
    if(ambientSource) {ambientSource.stop();ambientSource.disconnect();ambientSource=null;}
    ambientGain?.disconnect();ambientGain=null;
    const source=context.createBufferSource(),gain=context.createGain();
    source.buffer=buffers.ending[0];gain.gain.value=.8;
    source.connect(gain);gain.connect(context.destination);source.start();
    return source.buffer.duration;
  }
  function cue(name) {
    if(!sfx || !context || context.state!=='running') return;
    const now=context.currentTime;
    const oscillator=context.createOscillator(),gain=context.createGain();
    oscillator.type=name==='squeak'?'sine':'sawtooth';
    const start=name==='squeak'?760:90;
    oscillator.frequency.setValueAtTime(start,now);
    oscillator.frequency.exponentialRampToValueAtTime(name==='squeak'?1350:45,now+.11);
    oscillator.frequency.exponentialRampToValueAtTime(name==='squeak'?610:80,now+.22);
    gain.gain.setValueAtTime(.0001,now);
    gain.gain.exponentialRampToValueAtTime(name==='squeak'?.055:.025,now+.025);
    gain.gain.exponentialRampToValueAtTime(.0001,now+.25);
    oscillator.connect(gain);gain.connect(context.destination);
    oscillator.start(now);oscillator.stop(now+.27);
    oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
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
  return {prepare,start,pause,stop,play,playEnding,cue,setPreferences};
}
