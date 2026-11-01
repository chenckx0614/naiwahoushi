function distance(x1,z1,x2,z2) { return Math.hypot(x1-x2,z1-z2); }

export function hearNoise(enemy,x,z,radius) {
  if(['stunned','alert','chase'].includes(enemy.state)) return;
  const hearing=enemy.kind==='listener'?1.7:enemy.kind==='watcher'?.65:1;
  if(distance(enemy.x,enemy.z,x,z)>radius*hearing) return;
  enemy.state='investigate';
  enemy.lastKnown={x:Math.round(x),z:Math.round(z)};
  enemy.memory=5;
  enemy.think=0;
  enemy.path=[];
}

export function stunEnemy(enemy) {
  enemy.state='stunned';
  enemy.stun=Math.min(5,enemy.stun+3);
  enemy.path=[];
  enemy.think=0;
}

export function stepEnemy(enemy,dt,env) {
  const {px,pz,lineClear,route,neighbors,clearAt,random}=env;
  const scale=env.scale||1;
  enemy.attack=Math.max(0,enemy.attack-dt);
  enemy.think-=dt;
  const d=distance(enemy.x,enemy.z,px,pz);
  const facing=d>0 ? ((px-enemy.x)*enemy.faceX+(pz-enemy.z)*enemy.faceZ)/d : 1;
  const sight=enemy.kind==='watcher'?7.2:enemy.kind==='listener'?4.1:5.8;
  const sightRange=(env.blackout?sight*.48:env.flashlight?sight*1.25:sight*.72)/scale;
  const sees=!env.hidden && d<sightRange && (d<1.25/scale || facing>.12 || enemy.state==='chase' ||
    (enemy.kind==='watcher' && env.flashlight)) &&
    lineClear(enemy.x,enemy.z,px,pz);
  let spotted=false,attacked=false;

  function moveToward(x,z,speed) {
    const dx=x-enemy.x,dz=z-enemy.z,len=Math.hypot(dx,dz);
    if(len<.08) return true;
    const step=Math.min(len,speed*dt),nx=enemy.x+dx/len*step,nz=enemy.z+dz/len*step;
    if(clearAt(nx,enemy.z)) enemy.x=nx;
    if(clearAt(enemy.x,nz)) enemy.z=nz;
    enemy.faceX=dx/len;enemy.faceZ=dz/len;
    return false;
  }
  function followPath(speed) {
    const next=enemy.path[0];
    if(!next) return true;
    if(moveToward(next.x,next.z,speed)) enemy.path.shift();
    return enemy.path.length===0;
  }
  function setPath(target) {
    enemy.path=target ? route(Math.round(enemy.x),Math.round(enemy.z),target.x,target.z) : [];
  }
  function wander() {
    const x=Math.round(enemy.x),z=Math.round(enemy.z);
    const nearby=neighbors(x,z);
    const choices=nearby.filter(([nx,nz])=>nx!==enemy.previousX || nz!==enemy.previousZ);
    const cell=(choices.length?choices:nearby)[Math.floor(random()*(choices.length?choices.length:nearby.length))];
    if(!cell) return;
    enemy.previousX=x;enemy.previousZ=z;
    enemy.path=route(x,z,cell[0],cell[1]);
  }

  if(enemy.state==='stunned') {
    enemy.stun-=dt;
    if(enemy.stun<=0) {enemy.stun=0;enemy.state='search';enemy.searchTime=3;enemy.path=[];}
    return {spotted,attacked};
  }
  if(enemy.kind==='warden' && env.exitReady && env.exit && enemy.state==='patrol') {
    enemy.state='guard';enemy.path=[];enemy.think=0;
  }
  if(env.hidden && env.hideSpot && enemy.state==='chase' && d<2.4/scale) {
    enemy.lastKnown={x:env.hideSpot.x,z:env.hideSpot.z};
    enemy.memory=Math.max(enemy.memory,2);
  }

  if(sees) {
    const cell=`${Math.round(px)},${Math.round(pz)}`;
    if(enemy.previousPlayerCell && enemy.previousPlayerCell!==cell) {
      enemy.learnedRoutes??=new Map();
      const key=enemy.previousPlayerCell+'>'+cell;
      enemy.learnedRoutes.set(key,Math.min(4,(enemy.learnedRoutes.get(key)||0)+1));
    }
    enemy.previousPlayerCell=cell;
    enemy.lastKnown={x:Math.round(px),z:Math.round(pz)};
    if(enemy.state!=='chase' && enemy.state!=='alert') {
      enemy.state='alert';enemy.alertTime=.4;enemy.path=[];spotted=true;
    }
  }

  if(enemy.state==='alert') {
    enemy.faceX=(px-enemy.x)/(d||1);enemy.faceZ=(pz-enemy.z)/(d||1);
    enemy.alertTime-=dt;
    if(enemy.alertTime<=0) {enemy.state='chase';enemy.memory=4.5;enemy.think=0;}
  }

  if(enemy.state==='chase') {
    if(sees) enemy.memory=4.5;
    else enemy.memory-=dt;
    if(enemy.memory<=0) {enemy.state='search';enemy.searchTime=4;enemy.path=[];}
    else if(sees && d<2.4/scale) {enemy.path=[];moveToward(px,pz,2.75/scale);}
    else {
      if(!sees && enemy.lastKnown && enemy.learnedRoutes?.size) {
        const prefix=`${enemy.lastKnown.x},${enemy.lastKnown.z}>`;
        const learned=[...enemy.learnedRoutes].filter(([key,count])=>key.startsWith(prefix)&&count>=2)
          .sort((a,b)=>b[1]-a[1])[0];
        if(learned) {
          const [x,z]=learned[0].slice(prefix.length).split(',').map(Number);
          if(env.clearAt(x,z)) enemy.lastKnown={x,z};
        }
      }
      if(enemy.think<=0) {enemy.think=.35;setPath(enemy.lastKnown);}
      followPath(2.5/scale);
    }
    if(env.hidden && env.hideSpot && d<1.05/scale && enemy.memory>0) {
      enemy.state='alert';enemy.alertTime=.45;enemy.path=[];
      return {spotted,attacked,found:true};
    }
  } else if(enemy.state==='guard') {
    if(enemy.think<=0) {enemy.think=1;setPath(env.guardPost||env.exit);}
    followPath(1.15/scale);
  } else if(enemy.state==='investigate') {
    if(env.hidden && env.hideSpot && d<1.05/scale) {
      enemy.state='alert';enemy.alertTime=.45;enemy.path=[];
      return {spotted,attacked,found:true};
    }
    enemy.memory-=dt;
    if(enemy.think<=0) {enemy.think=.7;setPath(enemy.lastKnown);}
    const arrived=followPath((env.exitReady?1.9:1.2)/scale);
    if(arrived || enemy.memory<=0) {
      enemy.state=enemy.kind==='warden' && env.exitReady?'guard':'search';
      enemy.searchTime=3.5;enemy.path=[];
    }
  } else if(enemy.state==='search') {
    enemy.searchTime-=dt;
    if(enemy.searchTime<=0) {enemy.state='patrol';enemy.path=[];enemy.wait=.3;}
    else {
      if(!enemy.path.length) wander();
      followPath(.95/scale);
    }
  } else if(enemy.state==='patrol') {
    enemy.wait-=dt;
    if(enemy.wait<=0) {
      if(!enemy.path.length) wander();
      if(followPath(.72/scale)) enemy.wait=.4+random()*.7;
    }
  }

  if((enemy.state==='chase' || enemy.state==='alert') &&
      distance(enemy.x,enemy.z,px,pz)<.68/scale && enemy.attack<=0) {
    enemy.attack=1.4;enemy.state='search';enemy.searchTime=2;enemy.path=[];attacked=true;
  }
  return {spotted,attacked};
}
