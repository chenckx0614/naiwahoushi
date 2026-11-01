import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import naidanGlb from './.build/naidan.glb';
import naishuGlb from './.build/naishu.glb';
import { findShotTarget } from './shot-target.js';
import { hearNoise, stunEnemy, stepEnemy } from './enemy-ai.js';
import { createGameAudio } from './game-audio.js';

/* Level 0 is deliberately self-contained: the main match-3 game only opens/closes it. */
const screen = document.getElementById('backrooms-screen');
const canvas = document.getElementById('br-cv');
const mask = document.getElementById('br-mask');
const N = 21;
const CELL = 1.65;
const EYE = 1.18;
const PLAYER_RADIUS = 0.22;
const GOAL = 3;
const ui = {
  hp: document.getElementById('br-hp'), milk: document.getElementById('br-milk'),
  rescued: document.getElementById('br-rescued'), objective: document.getElementById('br-objective'),
  clock: document.getElementById('br-clock'), toast: document.getElementById('br-toast'),
  title: document.getElementById('br-mask-title'), message: document.getElementById('br-msg'),
  start: document.getElementById('br-start-btn'), tip: document.getElementById('br-tip'),
  load: document.getElementById('br-load'), loadFill: document.getElementById('br-load-fill'),
  loadPct: document.getElementById('br-load-pct'),
};
const copy = {
  zh: {
    back:'返回大厅', hp:'生命', milk:'牛奶', stamina:'耐力', rescued:'已救援', find:'寻找迷路的奶鼠',
    exit:'奶鼠已救齐，寻找绿色出口', intro:'救出 3 只奶鼠，再找到出口。奶蛋会巡逻，能听见奔跑和泼奶；甩开它后，它还会搜寻一阵。',
    introButton:'进入 LEVEL 0', retry:'重新进入', resume:'继续探索',
    win:'出口找到了', winMsg:'你带着所有奶鼠逃出了 Level 0。',
    lose:'信号中断', loseMsg:'奶蛋抓住了你。再试一次。',
    pause:'信号暂停', pauseMsg:'深呼吸，走廊还在等你。',
    tip:'WASD 移动 · 鼠标观察 · E 躲进柜子 · 点击泼牛奶 · Shift 奔跑',
    mobileTip:'左摇杆移动 · 右侧滑动观察 · 靠近柜子点按钮躲藏',
    save:'奶鼠救援成功：{n} / 3', ready:'出口已经开启', hit:'奶蛋暂时被击退', spotted:'奶蛋发现你了！',
    locked:'出口锁定 · 还需救出奶鼠',
    loading:'正在准备奶蛋和奶鼠模型…', modelError:'角色模型加载失败，请重新打开游戏。',
    blocked:'前方有墙，牛奶没有命中', empty:'牛奶快用完了', webglError:'无法启动 3D 画面，请检查浏览器是否支持 WebGL。',
    hide:'E · 躲进柜子',unhide:'离开柜子',hiding:'屏住呼吸，听它的脚步声',
    remembered:'奶蛋记住了这个柜子的位置',found:'柜门被拉开了！',powerOut:'灯光熄灭了',mouseCry:'远处传来奶鼠的叫声',
  },
  en: {
    back:'BACK TO LOBBY', hp:'HEALTH', milk:'MILK', stamina:'STAMINA', rescued:'RESCUED', find:'FIND THE LOST MICE',
    exit:'ALL RESCUED · FIND THE GREEN EXIT', intro:'Rescue three mice, then find the exit. The egg patrols, hears sprinting and milk, and searches after losing sight of you.',
    introButton:'ENTER LEVEL 0', retry:'TRY AGAIN', resume:'RESUME',
    win:'EXIT FOUND', winMsg:'You brought every mouse out of Level 0.',
    lose:'SIGNAL LOST', loseMsg:'The egg caught you. Try again.',
    pause:'SIGNAL PAUSED', pauseMsg:'Take a breath. The corridors will wait.',
    tip:'WASD move · mouse look · E hide in locker · click throw milk · Shift sprint',
    mobileTip:'Left stick move · swipe to look · tap Hide near a locker',
    save:'MOUSE RESCUED: {n} / 3', ready:'THE EXIT IS OPEN', hit:'EGG REPELLED FOR NOW', spotted:'THE EGG SAW YOU!',
    locked:'EXIT LOCKED · RESCUE THE MICE',
    loading:'PREPARING THE EGG AND MOUSE MODELS…', modelError:'Character models failed to load. Please reopen the game.',
    blocked:'THE WALL BLOCKED YOUR SHOT', empty:'LOW ON MILK', webglError:'The 3D scene could not start. Check WebGL support in your browser.',
    hide:'E · HIDE IN LOCKER',unhide:'LEAVE LOCKER',hiding:'Hold your breath. Listen for footsteps.',
    remembered:'The egg remembers this locker.',found:'The locker door was pulled open!',powerOut:'THE LIGHTS WENT OUT',mouseCry:'A mouse cries in the distance.',
  },
};
const text = key => copy[document.documentElement.lang.startsWith('en') ? 'en' : 'zh'][key];

let renderer, scene, camera, world, wallMesh, grid, exit, exitLight, exitMaterial, exitSignMaterial, exitDoor, torch, baseLight;
let exitIndicators=[], exitEdges=[], exitOpening=false, friends = [], enemies = [], raf = 0;
let scareModel=null, scareTime=0, scareCooldown=0;
const scareOverlay=document.getElementById('br-scare');
const endingMusic=document.getElementById('entry-music');
let fluorescents=[];
let lockers=[], hidden=false, hideSpot=null, powerClock=22, blackout=0, mouseCryClock=0;
const hideButton=document.getElementById('br-hide');
const lockerView=document.getElementById('br-locker-view');
let lockerSoundClock=0;
const gameAudio=createGameAudio();
let open = false, running = false, phase = 'intro', hadPointerLock = false;
let hp = 100, milk = 12, stamina=100, sprintExhausted=false, rescued = 0, elapsed = 0, shotFlash = 0, damageFlash = 0;
let yaw = 0, pitch = 0, px = 1, pz = 1, joyX = 0, joyY = 0, sprintTouch = false;
let lastTime = 0, stepClock = 0, toastTimer = 0, doorNoticeCooldown=0, spottedNoticeCooldown=0, threatSoundClock=0, rng = Math.random;
let audioPrefs = {music:true,sfx:true};
let lastObjective = '';
let assetPromise, models, entryId = 0, modelProgress=0;
const modelProgressListeners=new Set();
const keys = Object.create(null);

function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}
function pick(a) { return a[Math.floor(rng() * a.length)]; }
function inside(x, z) { return x >= 0 && z >= 0 && x < N && z < N; }
function floorAt(x, z) { return inside(x,z) && grid[z][x] === 0; }
function cellAt(x, z) { return floorAt(Math.floor(x + .5), Math.floor(z + .5)); }
function clearAt(x, z) {
  const r = PLAYER_RADIUS/CELL;
  return cellAt(x-r,z-r) && cellAt(x+r,z-r) && cellAt(x-r,z+r) && cellAt(x+r,z+r) &&
    (!exit || (rescued===GOAL && exitDoor?.position.y>1.8) || Math.hypot(x-exit.x,z-exit.z)>.49);
}
function distance(a,b) { return Math.hypot(a.x-b.x,a.z-b.z); }
function lineClear(x1,z1,x2,z2) {
  const n = Math.ceil(Math.hypot(x2-x1,z2-z1) * 9);
  for(let i=1;i<n;i++) {
    const t=i/n;
    if(!cellAt(x1+(x2-x1)*t,z1+(z2-z1)*t)) return false;
  }
  return true;
}
function neighbors(c,z) {
  return [[c+1,z],[c-1,z],[c,z+1],[c,z-1]].filter(([x,y])=>floorAt(x,y));
}
function distances(sx,sz) {
  const dist = Array.from({length:N},()=>Array(N).fill(-1));
  const q = [[sx,sz]]; dist[sz][sx]=0;
  for(let i=0;i<q.length;i++) {
    const [x,z]=q[i];
    for(const [nx,nz] of neighbors(x,z)) if(dist[nz][nx]<0) {
      dist[nz][nx]=dist[z][x]+1; q.push([nx,nz]);
    }
  }
  return dist;
}
function route(sx,sz,tx,tz) {
  if(sx===tx && sz===tz) return [];
  const prev = Array.from({length:N},()=>Array(N).fill(null));
  const q=[[sx,sz]]; prev[sz][sx]=[sx,sz];
  for(let i=0;i<q.length;i++) {
    const [x,z]=q[i];
    if(x===tx && z===tz) break;
    for(const [nx,nz] of neighbors(x,z)) if(!prev[nz][nx]) {
      prev[nz][nx]=[x,z]; q.push([nx,nz]);
    }
  }
  if(!prev[tz]?.[tx]) return [];
  const out=[]; let x=tx,z=tz;
  while(x!==sx || z!==sz) { out.push({x,z}); [x,z]=prev[z][x]; }
  return out.reverse();
}
function generateMap() {
  grid = Array.from({length:N},()=>Array(N).fill(1));
  const stack=[[1,1]]; grid[1][1]=0;
  while(stack.length) {
    const [x,z]=stack[stack.length-1];
    const dirs=[[2,0],[-2,0],[0,2],[0,-2]].filter(([dx,dz])=>{
      const nx=x+dx,nz=z+dz;
      return nx>0 && nz>0 && nx<N-1 && nz<N-1 && grid[nz][nx];
    });
    if(!dirs.length) { stack.pop(); continue; }
    const [dx,dz]=pick(dirs);
    grid[z+dz/2][x+dx/2]=0; grid[z+dz][x+dx]=0;
    stack.push([x+dx,z+dz]);
  }
  /* Add loops and open rooms without disconnecting the carved maze. */
  for(let z=2;z<N-2;z++) for(let x=2;x<N-2;x++) if(grid[z][x] && rng()<.18) {
    if((floorAt(x-1,z)&&floorAt(x+1,z)) || (floorAt(x,z-1)&&floorAt(x,z+1))) grid[z][x]=0;
  }
  for(let i=0;i<4;i++) {
    const cx=3+2*Math.floor(rng()*7), cz=3+2*Math.floor(rng()*7);
    for(let z=cz-1;z<=cz+1;z++) for(let x=cx-1;x<=cx+1;x++) grid[z][x]=0;
  }
  const d=distances(1,1), candidates=[];
  for(let z=1;z<N-1;z++) for(let x=1;x<N-1;x++) if(grid[z][x]===0 && d[z][x]>=0) candidates.push({x,z,d:d[z][x]});
  candidates.sort((a,b)=>b.d-a.d);
  exit=candidates.find(c=>c.d>=8 && neighbors(c.x,c.z).length===1) || candidates[0];
  const selected=[];
  for(const c of candidates) {
    if(c.d<8 || distance(c,exit)<3 || selected.some(f=>distance(c,f)<4)) continue;
    selected.push(c); if(selected.length===GOAL) break;
  }
  if(selected.length<GOAL) {
    for(const c of candidates) if(!selected.some(f=>f.x===c.x&&f.z===c.z) && distance(c,exit)>2) {
      selected.push(c); if(selected.length===GOAL) break;
    }
  }
  const enemySpots=[];
  for(const c of candidates) if(c.d>5 && distance(c,{x:1,z:1})>5 && distance(c,exit)>2 && selected.every(f=>distance(c,f)>2)) {
    if(enemySpots.every(e=>distance(e,c)>5)) enemySpots.push(c);
    if(enemySpots.length===3) break;
  }
  return { selected, enemySpots };
}
function texture(kind,seed) {
  const c=document.createElement('canvas'); c.width=c.height=128;
  const g=c.getContext('2d'), noise=seeded(seed);
  g.fillStyle=kind==='wall'?'#a99b65':kind==='floor'?'#5d5840':'#a6a38a'; g.fillRect(0,0,128,128);
  for(let i=0;i<7500;i++) {
    const n=Math.floor(noise()*255), x=noise()*128, y=noise()*128;
    g.fillStyle=`rgba(${n},${n},${n},${kind==='floor'?.055:.035})`;
    g.fillRect(x,y,kind==='floor'?2:1,1);
  }
  if(kind==='wall') {
    g.fillStyle='rgba(72,62,35,.18)';
    for(let x=0;x<128;x+=31) g.fillRect(x,0,2,128);
    g.fillStyle='#766f4b'; g.fillRect(0,108,128,7);
    g.fillStyle='#d1c18a'; g.fillRect(0,106,128,2);
  } else if(kind==='ceiling') {
    g.strokeStyle='rgba(58,59,49,.35)'; g.lineWidth=2;
    g.strokeRect(0,0,127,127);
  } else {
    g.fillStyle='rgba(27,31,22,.12)';
    for(let y=0;y<128;y+=4) g.fillRect(0,y,128,1);
  }
  const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping;
  t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=2; return t;
}
async function parseModel(url,onProgress) {
  const gltf=await new GLTFLoader().loadAsync(url,event=>{
    if(event.total) onProgress(Math.min(.95,event.loaded/event.total));
  });
  const template=gltf.scene;
  template.rotation.x=Math.PI/2; // supplied sculpts use Z as the up axis
  template.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(template);
  const size=bounds.getSize(new THREE.Vector3());
  if(!Number.isFinite(size.y)||size.y<=0) throw new Error('invalid character bounds');
  const scale=.92/size.y;
  template.scale.multiplyScalar(scale);
  template.position.set(-(bounds.min.x+bounds.max.x)*.5*scale,-bounds.min.y*scale,-(bounds.min.z+bounds.max.z)*.5*scale);
  template.traverse(o=>{if(o.isMesh) o.userData.sharedAsset=true;});
  return template;
}
function loadModels(onProgress) {
  if(onProgress) {onProgress(modelProgress);if(modelProgress<1) modelProgressListeners.add(onProgress);}
  if(!assetPromise) {
    const values=[0,0];
    const report=(index,value)=>{
      values[index]=value;modelProgress=(values[0]+values[1])/2;
      modelProgressListeners.forEach(listener=>listener(modelProgress));
      if(modelProgress===1) modelProgressListeners.clear();
    };
    assetPromise=Promise.all([
      parseModel(naidanGlb,value=>report(0,value)).then(result=>{report(0,1);return result;}),
      parseModel(naishuGlb,value=>report(1,value)).then(result=>{report(1,1);return result;}),
    ]).then(([egg,mouse])=>{models={egg,mouse};return models;})
      .catch(err=>{assetPromise=null;modelProgress=0;modelProgressListeners.clear();throw err;});
  }
  return assetPromise;
}
function character(kind) {
  const group=new THREE.Group();
  group.add(models[kind].clone(true));
  const ring=new THREE.Mesh(new THREE.RingGeometry(.32,.44,28),new THREE.MeshBasicMaterial({
    color:kind==='egg'?0xc94634:0x74efb4,transparent:true,opacity:kind==='egg'?.54:.7,side:THREE.DoubleSide,depthWrite:false,
  }));
  ring.rotation.x=-Math.PI/2;ring.position.y=.025;group.add(ring);
  return group;
}
function clearWorld() {
  if(!world) return;
  scene.remove(world);
  const geometries=new Set(), materials=new Set();
  world.traverse(o=>{ if(o.userData.sharedAsset) return; if(o.geometry) geometries.add(o.geometry); if(o.material) materials.add(o.material); });
  geometries.forEach(g=>g.dispose());
  materials.forEach(m=>{if(m.map)m.map.dispose();m.dispose();});
  world=null;wallMesh=null;exitDoor=null;exitOpening=false;exitIndicators=[];exitEdges=[];fluorescents=[];
}
function makeExit() {
  const portal=new THREE.Group();
  const frameMaterial=new THREE.MeshStandardMaterial({color:0x8d8057,metalness:.55,roughness:.5});
  for(const x of [-.55,.55]) {
    const post=new THREE.Mesh(new THREE.BoxGeometry(.13,2.5,.19),frameMaterial);
    post.position.set(x,1.25,0);portal.add(post);
  }
  const header=new THREE.Mesh(new THREE.BoxGeometry(1.22,.16,.2),frameMaterial);
  header.position.set(0,2.5,0);portal.add(header);
  const threshold=new THREE.Mesh(new THREE.BoxGeometry(1.22,.07,.34),frameMaterial);
  threshold.position.set(0,.035,.05);portal.add(threshold);
  const voidPlane=new THREE.Mesh(new THREE.PlaneGeometry(1.02,2.35),
    new THREE.MeshBasicMaterial({color:0x05120e,side:THREE.DoubleSide}));
  voidPlane.position.set(0,1.23,-.09);portal.add(voidPlane);
  exitEdges=[];
  for(const x of [-.49,.49]) {
    const material=new THREE.MeshBasicMaterial({color:0x3c4636});
    const strip=new THREE.Mesh(new THREE.BoxGeometry(.025,2.25,.025),material);
    strip.position.set(x,1.25,.105);portal.add(strip);exitEdges.push(material);
  }

  exitDoor=new THREE.Group();portal.add(exitDoor);
  exitMaterial=new THREE.MeshStandardMaterial({color:0x24271e,emissive:0x17180d,
    emissiveIntensity:.22,metalness:.25,roughness:.7,side:THREE.DoubleSide});
  const panel=new THREE.Mesh(new THREE.PlaneGeometry(.98,2.34),exitMaterial);
  panel.position.set(0,1.25,.035);exitDoor.add(panel);
  const seam=new THREE.Mesh(new THREE.BoxGeometry(.018,2.2,.025),frameMaterial);
  seam.position.set(0,1.25,.065);exitDoor.add(seam);
  const handle=new THREE.Mesh(new THREE.BoxGeometry(.08,.18,.11),frameMaterial);
  handle.position.set(.38,1.12,.13);exitDoor.add(handle);

  const signCanvas=document.createElement('canvas');signCanvas.width=256;signCanvas.height=80;
  const g=signCanvas.getContext('2d');
  g.fillStyle='#11150d';g.fillRect(0,0,256,80);
  g.fillStyle='#fff5d2';g.font='bold 54px Consolas, monospace';g.textAlign='center';
  g.fillText('EXIT',128,58);
  const signTexture=new THREE.CanvasTexture(signCanvas);
  signTexture.colorSpace=THREE.SRGBColorSpace;
  exitSignMaterial=new THREE.MeshBasicMaterial({map:signTexture,color:0xb8a66f,side:THREE.DoubleSide});
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(.9,.3),exitSignMaterial);
  sign.position.set(0,2.04,.12);exitDoor.add(sign);
  exitIndicators=[];
  for(let i=0;i<GOAL;i++) {
    const material=new THREE.MeshBasicMaterial({color:0x594b2c});
    const lamp=new THREE.Mesh(new THREE.SphereGeometry(.055,10,8),material);
    lamp.position.set((i-1)*.22,1.78,.095);exitDoor.add(lamp);
    exitIndicators.push(material);
  }
  const fromStart=distances(1,1);
  const approach=neighbors(exit.x,exit.z).sort((a,b)=>
    fromStart[a[1]][a[0]]-fromStart[b[1]][b[0]])[0];
  if(approach) {
    portal.rotation.y=Math.atan2(approach[0]-exit.x,approach[1]-exit.z);
    portal.position.set((exit.x-(approach[0]-exit.x)*.12)*CELL,0,(exit.z-(approach[1]-exit.z)*.12)*CELL);
  } else portal.position.set(exit.x*CELL,0,exit.z*CELL);
  portal.scale.x=1.2;
  world.add(portal);
  exitLight=new THREE.PointLight(0xd3a861,2.3,4,2);
  exitLight.position.set(exit.x*CELL,1.7,exit.z*CELL);world.add(exitLight);
}
function updateExit() {
  exitIndicators.forEach((material,i)=>material.color.setHex(i<rescued?0x52ffbc:0x594b2c));
  if(rescued!==GOAL) return;
  exitMaterial.color.setHex(0x1c6650);
  exitMaterial.emissive.setHex(0x26e5a4);
  exitMaterial.emissiveIntensity=.75;
  exitSignMaterial.color.setHex(0x84ffca);
  exitEdges.forEach(material=>material.color.setHex(0x4affbf));
  exitLight.color.setHex(0x38ffc1);exitLight.intensity=5;
  exitOpening=true;
  notice(text('ready'));
  gameAudio.play('rescue',.35,1.25);
}
function buildWorld() {
  clearWorld();
  const data=generateMap();
  world=new THREE.Group(); scene.add(world);
  const wallTex=texture('wall',1234), floorTex=texture('floor',5678), ceilTex=texture('ceiling',9012);
  floorTex.repeat.set(N/3,N/3); ceilTex.repeat.set(N/3,N/3);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(N*CELL,N*CELL),new THREE.MeshLambertMaterial({map:floorTex,color:0xb9b091,side:THREE.DoubleSide}));
  floor.rotation.x=-Math.PI/2; floor.position.set((N-1)*CELL/2,0,(N-1)*CELL/2); world.add(floor);
  const ceiling=new THREE.Mesh(new THREE.PlaneGeometry(N*CELL,N*CELL),new THREE.MeshLambertMaterial({map:ceilTex,color:0xbcb8a6,side:THREE.DoubleSide}));
  ceiling.rotation.x=Math.PI/2; ceiling.position.set((N-1)*CELL/2,3,(N-1)*CELL/2); world.add(ceiling);
  const wallCells=[];
  for(let z=0;z<N;z++) for(let x=0;x<N;x++) if(grid[z][x]) wallCells.push([x,z]);
  const walls=new THREE.InstancedMesh(new THREE.BoxGeometry(CELL,3,CELL),new THREE.MeshLambertMaterial({map:wallTex,color:0xc6b67e}),wallCells.length);
  const dummy=new THREE.Object3D();
  wallCells.forEach(([x,z],i)=>{dummy.position.set(x*CELL,1.5,z*CELL);dummy.updateMatrix();walls.setMatrixAt(i,dummy.matrix);});
  walls.instanceMatrix.needsUpdate=true; world.add(walls);
  wallMesh=walls;
  lockers=[];
  const spots=[];
  for(let z=2;z<N-2;z++) for(let x=2;x<N-2;x++) if(floorAt(x,z) &&
    neighbors(x,z).length<=2 && distance({x,z},{x:1,z:1})>3 && distance({x,z},exit)>2)
    spots.push({x,z});
  for(const spot of spots.sort(()=>rng()-.5).slice(0,Math.min(8,spots.length))) {
    const locker=new THREE.Group();
    const metal=new THREE.MeshStandardMaterial({color:0x515548,metalness:.55,roughness:.65});
    const body=new THREE.Mesh(new THREE.BoxGeometry(.62,1.8,.38),metal);
    body.position.y=.9;locker.add(body);
    const seam=new THREE.Mesh(new THREE.BoxGeometry(.015,1.58,.012),new THREE.MeshBasicMaterial({color:0x171a14}));
    seam.position.set(0,.9,.2);locker.add(seam);
    for(const x of [-.15,.15]) {const slit=new THREE.Mesh(new THREE.BoxGeometry(.16,.012,.014),seam.material);
      slit.position.set(x,1.35,.205);locker.add(slit);}
    locker.position.set(spot.x*CELL,0,spot.z*CELL);world.add(locker);
    lockers.push({...spot,mesh:locker,uses:0});
  }
  let fixtureCount=0, pointCount=0;
  for(let z=1;z<N-1;z++) for(let x=1;x<N-1;x++) if(!grid[z][x] && (x+z*3)%13===0 && fixtureCount<18) {
    const panel=new THREE.Mesh(new THREE.BoxGeometry(.72*CELL,.035,.2*CELL),
      new THREE.MeshBasicMaterial({color:0x8d8765}));
    panel.position.set(x*CELL,2.958,z*CELL); world.add(panel); fixtureCount++;
    if(pointCount<5 && (x+z)%3===0) {
      const light=new THREE.PointLight(0xffe3a3,5.5,7.5,2);
      light.position.set(x*CELL,2.7,z*CELL);world.add(light);
      fluorescents.push({light,panel,phase:rng()*10,faulty:pointCount%2===0});pointCount++;
    }
  }
  makeExit();
  friends=data.selected.map((p,i)=>{ const mesh=character('mouse');mesh.position.set(p.x*CELL,0,p.z*CELL);world.add(mesh);return {x:p.x,z:p.z,mesh,phase:i*2.1}; });
  enemies=data.enemySpots.map((p,i)=>{ const mesh=character('egg');mesh.scale.setScalar(1.25);mesh.position.set(p.x*CELL,0,p.z*CELL);world.add(mesh);
    const eyeMaterial=new THREE.MeshBasicMaterial({color:0xff4438});
    for(const side of [-1,1]) {
      const eye=new THREE.Mesh(new THREE.SphereGeometry(.045,8,6),eyeMaterial);
      eye.position.set(side*.14,.62,.33);mesh.add(eye);
    }
    return {x:p.x,z:p.z,mesh,path:[],think:i*.22,attack:0,phase:i*1.8,state:'patrol',
      faceX:0,faceZ:1,stun:0,wait:i*.5,memory:0,searchTime:0,lastKnown:null}; });
  px=1; pz=1;
  const first=neighbors(1,1)[0]; yaw=first?Math.atan2(-(first[0]-1),-(first[1]-1)):0; pitch=0;
  camera.position.set(px*CELL,EYE,pz*CELL); camera.rotation.set(pitch,yaw,0,'YXZ');
  scene.fog=new THREE.FogExp2(0x1b1b13,.052);
}
function init() {
  if(renderer) return true;
  try {
    renderer=new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:'high-performance'});
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure=1.22;
    scene=new THREE.Scene();scene.background=new THREE.Color(0x35321f);
    baseLight=new THREE.HemisphereLight(0xc5bd96,0x171810,.85);scene.add(baseLight);
    camera=new THREE.PerspectiveCamera(78,1,.05,55);
    torch=new THREE.SpotLight(0xffedbc,22,11,.48,.56,1.7);
    torch.position.set(0,-.1,0); torch.target.position.set(0,-.06,-1);
    camera.add(torch,torch.target);scene.add(camera);
    resize(); return true;
  } catch(err) {
    console.error('[backrooms3d] WebGL initialization failed',err);
    ui.message.textContent=text('webglError'); return false;
  }
}
function resize() {
  if(!renderer) return;
  const w=Math.max(1,canvas.clientWidth),h=Math.max(1,canvas.clientHeight);
  const touch=matchMedia('(pointer:coarse)').matches;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,touch?1.15:1.5));
  renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
}
function hud() {
  ui.hp.textContent=Math.max(0,Math.ceil(hp));ui.milk.textContent=milk;
  document.getElementById('br-stamina').textContent=Math.ceil(stamina);
  document.getElementById('br-stamina-wrap').classList.toggle('low',stamina<25);
  ui.rescued.textContent=`${rescued} / ${GOAL}`;
  objective();
  ui.clock.textContent=String(Math.floor(elapsed/60)).padStart(2,'0')+':'+String(Math.floor(elapsed%60)).padStart(2,'0');
}
function objective() {
  const targets=rescued===GOAL?[exit]:friends;
  const nearest=targets.length?Math.min(...targets.map(t=>Math.hypot(t.x-px,t.z-pz)*CELL)):0;
  const label=`${text(rescued===GOAL?'exit':'find')} · ${Math.ceil(nearest)}m`;
  if(label!==lastObjective) {ui.objective.textContent=label;lastObjective=label;}
}
function notice(message) {
  ui.toast.textContent=message;ui.toast.classList.add('show');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>ui.toast.classList.remove('show'),2200);
}
function sync() {
  document.getElementById('br-back-label').textContent=text('back');
  document.getElementById('br-hp-label').textContent=text('hp');
  document.getElementById('br-milk-label').textContent=text('milk');
  document.getElementById('br-stamina-label').textContent=text('stamina');
  document.getElementById('br-rescued-label').textContent=text('rescued');
  ui.title.textContent=phase==='intro'?(document.documentElement.lang.startsWith('en')?'NAIWA BACKROOMS':'蛙后室'):text(phase==='win'?'win':phase==='lose'?'lose':'pause');
  ui.message.textContent=text(phase==='intro'?'intro':phase==='win'?'winMsg':phase==='lose'?'loseMsg':'pauseMsg');
  ui.start.innerHTML=`${text(phase==='intro'?'introButton':phase==='paused'?'resume':'retry')} <span>→</span>`;
  ui.tip.textContent=text(matchMedia('(pointer:coarse)').matches?'mobileTip':'tip');
  hud();
}
function showMask(newPhase) { phase=newPhase;mask.classList.remove('hide');screen.classList.remove('playing');ui.load.classList.add('hide');sync(); }
function emitNoise(x,z,radius) { enemies.forEach(enemy=>hearNoise(enemy,x,z,radius/CELL)); }
function lockPointer() {
  if(!canvas.requestPointerLock) return;
  try {
    const result=canvas.requestPointerLock();
    if(result && typeof result.catch==='function') result.catch(()=>{});
  } catch(e) {}
}
function start() {
  if(!init()) {ui.start.disabled=true;ui.message.textContent=text('webglError');return;}
  if(!world || !models) {ui.message.textContent=text('loading');return;}
  if(phase!=='paused' && phase!=='intro') {
    rng=seeded((Date.now()^Math.floor(Math.random()*0xffffffff))>>>0);
    buildWorld();hp=100;milk=12;stamina=100;sprintExhausted=false;rescued=0;elapsed=0;stepClock=0;
    doorNoticeCooldown=0;spottedNoticeCooldown=0;threatSoundClock=0;
    hidden=false;hideSpot=null;powerClock=16+rng()*13;blackout=0;mouseCryClock=10;
  }
  clearScare();
  endingMusic.pause();endingMusic.currentTime=0;
  phase='play';running=true;screen.classList.add('playing');mask.classList.add('hide');
  hadPointerLock=false;
  lastTime=performance.now();gameAudio.start();hud();
  if(!matchMedia('(pointer:coarse)').matches) lockPointer();
  if(!raf) raf=requestAnimationFrame(frame);
}
function pause() {
  if(!running) return;
  running=false;if(raf){cancelAnimationFrame(raf);raf=0;}
  showMask('paused');
  if(document.pointerLockElement===canvas) document.exitPointerLock();
  gameAudio.pause();
}
function end(win) {
  running=false;if(raf){cancelAnimationFrame(raf);raf=0;}
  clearScare();
  showMask(win?'win':'lose');
  if(document.pointerLockElement===canvas) document.exitPointerLock();
  if(win) {
    gameAudio.pause();
    endingMusic.currentTime=0;
    endingMusic.play().catch(()=>{});
  } else {
    gameAudio.play('growl',.5,.65);
    setTimeout(()=>{if(!running && phase==='lose') gameAudio.pause();},650);
  }
}
function clearScare() {
  scareTime=0;
  if(scareModel) {camera?.remove(scareModel);scareModel=null;}
  scareOverlay.classList.remove('active');
}
function toggleHide() {
  if(!running) return;
  if(hidden) {hidden=false;hideSpot=null;lockerView.classList.remove('active');gameAudio.cue('power');notice(text('unhide'));return;}
  const spot=lockers.find(s=>Math.hypot(s.x-px,s.z-pz)*CELL<1.15);
  if(!spot) return;
  hidden=true;hideSpot=spot;spot.uses++;
  lockerView.classList.add('active');gameAudio.cue('power');
  emitNoise(px,pz,spot.uses>1?7:2);
  if(spot.uses>1) notice(text('remembered'));
  else notice(text('hiding'));
}
function triggerScare(enemy) {
  if(scareCooldown>0 || !running) return;
  clearScare();
  scareCooldown=12;scareTime=.62;
  scareModel=enemy.mesh.clone(true);
  scareModel.position.set(0,-.87,-.65);
  scareModel.rotation.set(0,Math.PI,0);
  scareModel.scale.setScalar(2.35);
  camera.add(scareModel);
  scareOverlay.classList.add('active');
  gameAudio.play('growl',.9,.55);
  damageFlash=.3;
}
function shoot() {
  if(!running || hidden) return;
  if(milk<=0) {notice(text('empty'));return;}
  milk--;shotFlash=.12;gameAudio.play('splash',.5,.95+rng()*.12);hud();
  emitNoise(px,pz,8);
  camera.updateMatrixWorld(true);
  const origin=camera.position;
  const direction=camera.getWorldDirection(new THREE.Vector3());
  const raycaster=new THREE.Raycaster(origin,direction,0,7*CELL);
  const wallDistance=wallMesh ? (raycaster.intersectObject(wallMesh,false)[0]?.distance ?? Infinity) : Infinity;
  const {target,blocked}=findShotTarget(origin,direction,wallDistance,enemies,CELL);
  if(target) {
    stunEnemy(target);target.mesh.scale.setScalar(.83);
    const nx=target.x+direction.x*.42/CELL,nz=target.z+direction.z*.42/CELL;
    if(clearAt(nx,target.z)) target.x=nx;
    if(clearAt(target.x,nz)) target.z=nz;
    gameAudio.play('growl',.22,.8);notice(text('hit'));
  } else if(blocked) notice(text('blocked'));
}
function move(dt) {
  doorNoticeCooldown=Math.max(0,doorNoticeCooldown-dt);
  let forward=(keys.w||keys.ArrowUp?1:0)-(keys.s||keys.ArrowDown?1:0)-joyY;
  let strafe=(keys.d?1:0)-(keys.a?1:0)+joyX;
  if(keys.ArrowLeft) yaw+=dt*1.9;
  if(keys.ArrowRight) yaw-=dt*1.9;
  const len=Math.hypot(forward,strafe);
  if(len>1){forward/=len;strafe/=len;}
  const wantsSprint=keys.Shift||sprintTouch;
  if(sprintExhausted && stamina>=35) sprintExhausted=false;
  const sprinting=!hidden && len>.03 && wantsSprint && !sprintExhausted && stamina>0;
  stamina=Math.max(0,Math.min(100,stamina+(sprinting?-23:hidden?19:len>.03?8:16)*dt));
  if(stamina===0) {sprintExhausted=true;sprintTouch=false;}
  const moving=!hidden && len>.03,speed=(sprinting?3.55:2.25)/CELL;
  if(moving) {
    const dx=(-Math.sin(yaw)*forward+Math.cos(yaw)*strafe)*speed*dt;
    const dz=(-Math.cos(yaw)*forward-Math.sin(yaw)*strafe)*speed*dt;
    if(clearAt(px+dx,pz)) px+=dx;
    if(clearAt(px,pz+dz)) pz+=dz;
    stepClock+=dt*speed*CELL;
    if(stepClock>1.15){stepClock=0;gameAudio.play('step',.3,.92+rng()*.16);
      emitNoise(px,pz,sprinting?5.5:1.8);}
  }
  camera.position.set(px*CELL,EYE+(moving?Math.sin(elapsed*speed*CELL*9)*.024:0),pz*CELL);
  hideButton.classList.toggle('available',running && !hidden && lockers.some(s=>Math.hypot(s.x-px,s.z-pz)*CELL<1.15));
  hideButton.classList.toggle('hiding',hidden);
  hideButton.textContent=text(hidden?'unhide':'hide');
  document.getElementById('br-stamina').textContent=Math.ceil(stamina);
  document.getElementById('br-stamina-wrap').classList.toggle('low',stamina<25);
  camera.rotation.set(pitch,yaw,0,'YXZ');
  if(hidden) return;
  for(let i=friends.length-1;i>=0;i--) {
    const f=friends[i];
    f.mesh.position.y=.08+Math.sin(elapsed*2+f.phase)*.08;
    f.mesh.rotation.y=Math.sin(elapsed+f.phase)*.22;
    if(Math.hypot(f.x-px,f.z-pz)*CELL<.72) {
      world.remove(f.mesh);friends.splice(i,1);rescued++;milk=Math.min(18,milk+3);
      gameAudio.play('rescue',.4,1+.06*rescued);
      notice(text('save').replace('{n}',rescued));hud();
      updateExit();
    }
  }
  const exitDistance=Math.hypot(exit.x-px,exit.z-pz);
  if(rescued===GOAL && exitDoor.position.y>1.8 && exitDistance*CELL<.8) end(true);
  else if(rescued<GOAL && exitDistance*CELL<1.4 && doorNoticeCooldown===0) {
    notice(text('locked'));doorNoticeCooldown=4;
  }
}
function updateEnemies(dt) {
  spottedNoticeCooldown=Math.max(0,spottedNoticeCooldown-dt);
  const env={px,pz,lineClear,route,neighbors,clearAt,random:rng,scale:CELL,hidden,hideSpot,blackout:blackout>0};
  for(const e of enemies) {
    const result=stepEnemy(e,dt,env);
    if(result.found) {hidden=false;hideSpot=null;lockerView.classList.remove('active');notice(text('found'));triggerScare(e);}
    if(result.spotted && spottedNoticeCooldown===0) {
      notice(text('spotted'));gameAudio.play('growl',.45,.9);spottedNoticeCooldown=2;threatSoundClock=5;
    }
    e.mesh.position.set(e.x*CELL,.03+Math.sin(elapsed*2+e.phase)*.025,e.z*CELL);
    e.mesh.rotation.y=Math.atan2(e.faceX,e.faceZ);
    const ring=e.mesh.children[1];
    ring.material.color.setHex(e.state==='stunned'?0x8cd8ff:
      e.state==='chase'?0xff483d:e.state==='alert'?0xffb54b:0xc94634);
    ring.material.opacity=e.state==='chase'?.5:e.state==='alert'?.35:e.state==='stunned'?.22:.1;
    const scale=e.mesh.scale.x+(1.25-e.mesh.scale.x)*Math.min(1,dt*6);
    e.mesh.scale.setScalar(scale);
    if(e.state==='chase' && scareCooldown<=0 &&
      Math.hypot(e.x-px,e.z-pz)*CELL<1.65 && lineClear(e.x,e.z,px,pz)) triggerScare(e);
    if(result.attacked) {
      triggerScare(e);
      hp-=20;damageFlash=.35;gameAudio.play('growl',.42,.72);hud();
      if(hp<=0){
        running=false;
        const deathEntry=entryId;
        setTimeout(()=>{if(open && entryId===deathEntry && phase==='play') end(false);},550);
        return;
      }
    }
  }
}
function updateAtmosphere(dt) {
  powerClock-=dt;
  if(powerClock<=0 && blackout<=0) {blackout=4+rng()*3;powerClock=28+rng()*20;notice(text('powerOut'));gameAudio.cue('power');}
  blackout=Math.max(0,blackout-dt);
  baseLight.intensity=blackout>0?.18:.85;
  mouseCryClock-=dt;
  if(mouseCryClock<=0 && friends.length) {
    const friend=pick(friends);
    emitNoise(friend.x,friend.z,7);
    if(Math.hypot(friend.x-px,friend.z-pz)*CELL<9) {notice(text('mouseCry'));gameAudio.cue('squeak');}
    mouseCryClock=12+rng()*12;
  }
  let nearest=Infinity;
  for(const enemy of enemies) if(enemy.state!=='stunned')
    nearest=Math.min(nearest,Math.hypot(enemy.x-px,enemy.z-pz)*CELL);
  const threat=Math.max(0,Math.min(1,(5.5-nearest)/4.5));
  const pulse=(Math.sin(elapsed*(3+threat*2))+1)*.5;
  for(const fixture of fluorescents) {
    const flicker=fixture.faulty && (Math.sin(elapsed*16+fixture.phase)>.92 ||
      Math.sin(elapsed*31+fixture.phase*2)>.985);
    fixture.light.intensity=blackout>0?.02:flicker?.35:5.1+Math.sin(elapsed*2+fixture.phase)*.35;
    fixture.panel.material.color.setHex(flicker?0x292b21:0xc6bc91);
  }
  const torchFlicker=threat>.25 && Math.sin(elapsed*23+Math.sin(elapsed*4)*3)>.94;
  torch.intensity=(shotFlash>0?34:22)*(torchFlicker?.42:1)*(blackout>0?.25:1);
  const red=damageFlash>0?Math.min(.7,.4+damageFlash):threat*(.12+.09*pulse);
  const edge=red>0?`rgba(72,8,8,${.48+red})`:'rgba(0,0,0,.68)';
  document.querySelector('.br-vignette').style.background=
    `radial-gradient(ellipse at center,${blackout>0?'rgba(0,0,0,.35)':'transparent'} 35%,rgba(0,0,0,.5) 72%,${edge} 100%)`;
  lockerSoundClock=Math.max(0,lockerSoundClock-dt);
  if(hidden && nearest<4 && lockerSoundClock===0) {
    gameAudio.play('step',Math.max(.12,(4-nearest)*.1),.68);
    lockerSoundClock=.7+rng()*.45;
  }
  document.querySelector('.br-scanlines').style.opacity=String(.48+threat*.2);
  threatSoundClock=Math.max(0,threatSoundClock-dt);
  if(threat>.65 && threatSoundClock===0) {
    gameAudio.play('growl',.12,.65);threatSoundClock=6+rng()*3;
  }
}
function frame(t) {
  raf=0;if(!running) return;
  const dt=Math.min(.05,(t-lastTime)/1000||0);lastTime=t;
  if(document.hidden){raf=requestAnimationFrame(frame);return;}
  elapsed+=dt;move(dt);
  scareCooldown=Math.max(0,scareCooldown-dt);
  if(scareTime>0) {scareTime-=dt;if(scareTime<=0) clearScare();}
  if(!running) return;
  if(exitOpening) exitDoor.position.y=Math.min(2.7,exitDoor.position.y+dt*1.7);
  updateEnemies(dt);
  shotFlash=Math.max(0,shotFlash-dt);damageFlash=Math.max(0,damageFlash-dt);
  updateAtmosphere(dt);
  ui.clock.textContent=String(Math.floor(elapsed/60)).padStart(2,'0')+':'+String(Math.floor(elapsed%60)).padStart(2,'0');
  objective();
  renderer.render(scene,camera);
  if(running) raf=requestAnimationFrame(frame);
}
function enter(preferences) {
  const currentEntry=++entryId;
  audioPrefs={music:preferences?.music!==false,sfx:preferences?.sfx!==false};
  gameAudio.setPreferences(audioPrefs);
  open=true;phase='intro';screen.classList.remove('playing');
  ui.start.disabled=false;
  if(!init()) {
    sync();ui.message.textContent=text('webglError');ui.start.disabled=true;
    mask.classList.remove('hide');return;
  }
  clearWorld();friends=[];enemies=[];exit=null;
  hp=100;milk=12;stamina=100;sprintExhausted=false;rescued=0;elapsed=0;
  sync();mask.classList.remove('hide');
  ui.message.textContent=text('loading');ui.start.disabled=true;
  ui.load.classList.remove('hide');
  let modelPart=0,audioPart=0;
  const updateLoad=()=>{
    if(currentEntry!==entryId) return;
    const percent=Math.round((modelPart*.75+audioPart*.25)*100);
    ui.loadFill.style.width=percent+'%';ui.loadPct.textContent=percent+'%';
    ui.load.setAttribute('aria-valuenow',String(percent));
  };
  updateLoad();
  Promise.all([
    loadModels(value=>{modelPart=value;updateLoad();}),
    gameAudio.prepare(value=>{audioPart=value;updateLoad();}),
  ]).then(()=>{
    if(!open || currentEntry!==entryId) return;
    rng=seeded((Date.now()^Math.floor(Math.random()*0xffffffff))>>>0);
    buildWorld();sync();ui.start.disabled=false;renderer.render(scene,camera);
    ui.load.classList.add('hide');
  }).catch(err=>{
    console.error('[backrooms3d] character model load failed',err);
    if(open && currentEntry===entryId) {ui.load.classList.add('hide');ui.message.textContent=text('modelError');ui.start.disabled=true;}
  });
}
function leave() {
  entryId++;
  open=false;running=false;phase='intro';screen.classList.remove('playing');
  if(raf){cancelAnimationFrame(raf);raf=0;}
  if(document.pointerLockElement===canvas) document.exitPointerLock();
  gameAudio.stop();
  clearScare();endingMusic.pause();endingMusic.currentTime=0;
  hidden=false;hideSpot=null;hideButton.classList.remove('available','hiding');
  lockerView.classList.remove('active');
  clearWorld();
  Object.keys(keys).forEach(k=>delete keys[k]);joyX=joyY=0;sprintTouch=false;
}

/* Input listeners are attached once, so returning to the lobby cannot multiply controls. */
window.addEventListener('resize',resize);
document.addEventListener('visibilitychange',()=>{lastTime=performance.now();if(open&&running&&document.hidden) pause();});
document.addEventListener('pointerlockchange',()=>{
  if(document.pointerLockElement===canvas) hadPointerLock=true;
  else if(open&&running&&hadPointerLock) pause();
});
window.addEventListener('keydown',e=>{
  if(!open) return;
  const k=e.key.length===1?e.key.toLowerCase():e.key;
  keys[k]=true;
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(k)) e.preventDefault();
  if(k==='Escape'&&running) pause();
  if(k==='e'&&running&&!e.repeat) toggleHide();
  if((k===' '||k==='Enter')&&running&&!e.repeat) shoot();
});
window.addEventListener('keyup',e=>{const k=e.key.length===1?e.key.toLowerCase():e.key;keys[k]=false;});
function touchPoint(e) {
  if(matchMedia('(pointer:coarse) and (orientation:portrait) and (max-width:700px)').matches)
    return {x:e.clientY,y:window.innerWidth-e.clientX};
  return {x:e.clientX,y:e.clientY};
}
canvas.addEventListener('pointerdown',e=>{
  if(!running) return;
  const point=touchPoint(e);
  if(e.pointerType==='mouse') {
    if(document.pointerLockElement!==canvas) {
      lockPointer();
      canvas._look={id:e.pointerId,x:point.x,y:point.y};
    }
    shoot();
  } else if(point.x>canvas.clientWidth*.32) {
    try { canvas.setPointerCapture(e.pointerId); } catch(err) {}
    canvas._look={id:e.pointerId,x:point.x,y:point.y};
  }
});
canvas.addEventListener('pointermove',e=>{
  if(!running) return;
  if(document.pointerLockElement===canvas) {
    yaw-=e.movementX*.0027;
    pitch=Math.max(-1.18,Math.min(1.18,pitch-e.movementY*.0027));
  }
  else if(canvas._look?.id===e.pointerId) {
    const point=touchPoint(e);
    const dx=point.x-canvas._look.x,dy=point.y-canvas._look.y;
    canvas._look.x=point.x;canvas._look.y=point.y;
    yaw-=dx*.0055;
    pitch=Math.max(-1.18,Math.min(1.18,pitch-dy*.0055));
  }
});
canvas.addEventListener('pointerup',e=>{if(canvas._look?.id===e.pointerId) canvas._look=null;});
canvas.addEventListener('pointercancel',()=>{canvas._look=null;});
const joystick=document.getElementById('br-j'),knob=document.getElementById('br-jk');
let joystickId=null;
function setStick(e) {
  const r=joystick.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;
  const point=touchPoint(e),center=touchPoint({clientX:cx,clientY:cy});
  let x=(point.x-center.x)/50,y=(point.y-center.y)/50;
  const len=Math.hypot(x,y);if(len>1){x/=len;y/=len;}
  joyX=x;joyY=y;knob.style.left=(50+x*35)+'%';knob.style.top=(50+y*35)+'%';
}
joystick.addEventListener('pointerdown',e=>{e.preventDefault();joystickId=e.pointerId;joystick.setPointerCapture(e.pointerId);setStick(e);});
joystick.addEventListener('pointermove',e=>{if(joystickId===e.pointerId)setStick(e);});
function releaseStick(e){if(joystickId!==e.pointerId)return;joystickId=null;joyX=joyY=0;knob.style.left='50%';knob.style.top='50%';}
joystick.addEventListener('pointerup',releaseStick);joystick.addEventListener('pointercancel',releaseStick);
document.getElementById('br-fire').addEventListener('pointerdown',e=>{e.preventDefault();shoot();});
hideButton.addEventListener('pointerdown',e=>{e.preventDefault();toggleHide();});
const runButton=document.getElementById('br-run');
runButton.addEventListener('pointerdown',e=>{e.preventDefault();sprintTouch=true;runButton.setPointerCapture(e.pointerId);});
runButton.addEventListener('pointerup',()=>{sprintTouch=false;});
runButton.addEventListener('pointercancel',()=>{sprintTouch=false;});
ui.start.addEventListener('click',start);
window.Backrooms3D={open:enter,stop:leave,pause,debug:()=>({hp,milk,rescued,
  enemies:enemies.map(e=>({x:e.x,z:e.z,state:e.state})),friends:friends.length,exit,px,pz,phase})};
