export function findShotTarget(origin,direction,wallDistance,enemies,cellSize=1) {
  const range=7*cellSize;
  let target=null,nearest=range,blocked=false;
  for(const enemy of enemies) {
    const dx=enemy.x*cellSize-origin.x,dy=.5-origin.y,dz=enemy.z*cellSize-origin.z;
    const along=dx*direction.x+dy*direction.y+dz*direction.z;
    if(along<=0 || along>range+.55) continue;
    const radius=.55;
    const perpendicularSq=dx*dx+dy*dy+dz*dz-along*along;
    if(perpendicularSq>radius*radius) continue;
    const offset=Math.sqrt(Math.max(0,radius*radius-perpendicularSq));
    const hit=along-offset>=0 ? along-offset : along+offset;
    if(hit>range || hit>=nearest) continue;
    if(wallDistance<hit) {blocked=true;continue;}
    nearest=hit;target=enemy;
  }
  return {target,blocked:!target && blocked};
}
