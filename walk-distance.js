export function walkDistances(grid,sx,sz) {
  const height=grid.length,width=grid[0]?.length||0;
  const result=Array.from({length:height},()=>Array(width).fill(-1));
  if(!height || !width || grid[sz]?.[sx]!==0) return result;
  const queue=[[sx,sz]];result[sz][sx]=0;
  for(let i=0;i<queue.length;i++) {
    const [x,z]=queue[i];
    for(const [nx,nz] of [[x+1,z],[x-1,z],[x,z+1],[x,z-1]]) {
      if(grid[nz]?.[nx]!==0 || result[nz][nx]!==-1) continue;
      result[nz][nx]=result[z][x]+1;
      queue.push([nx,nz]);
    }
  }
  return result;
}
