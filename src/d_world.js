/* ================= renderer, scene, themes ================= */
const $=id=>document.getElementById(id);
const stage=$('stage'), canvas=$('c');
const reduceMotion=!!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
let renderer;
try{ renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:true}); }
catch(e){ $('nogl').hidden=false; return; }
renderer.setClearColor(0x000000,0);
const scene=new T.Scene();
const camera=new T.PerspectiveCamera(30,1,1,220);
const hemi=new T.HemisphereLight(0xffffff,0x888888,0.6); scene.add(hemi);
const sun=new T.DirectionalLight(0xffffff,0.6); sun.position.set(-6,14,10); scene.add(sun);
let world=new T.Group(); scene.add(world);
const fx=new T.Group(); scene.add(fx);

const THEMES={
  meadow:{ sky:'linear-gradient(#3fb2ff,#96e0ff 52%,#ffeebd)', fog:0xcdeeff, fogNear:10, fogFar:95,
    hemiSky:0xffffff, hemiGround:0xb9c9a0, hemiI:0.64, sunI:0.6, sunCol:0xfff6e0,
    top:'#62d456', topS:['#7be36f','#4cc04a','#8ff07f','#55c94f'], dirt:'#b9773f', dirtS:['#a5642f','#c98a52','#96582a'], cap:'#62d456', capL:'#8ff07f', capD:'#3a9e3d',
    brick:['#f08a3c','#b9571c','#ffb469'], hard:['#e2b278','#f7d6a6','#b07f48'], pipe:['#3ecf5e','#8df59f','#249a41','#145c26'],
    semi:'cloud', plat:['#ffd166','#d98f24'], far:'#74d86a', liquid:['#3fb4ff','#a9e2ff'] },
  grotto:{ sky:'linear-gradient(#120b29,#21144a 60%,#2f1d63)', fog:0x21144a, fogNear:6, fogFar:46,
    hemiSky:0xffffff, hemiGround:0xa79fd6, hemiI:0.66, sunI:0.56, sunCol:0xffffff,
    top:'#35c9a8', topS:['#52e0bf','#27a88c','#6ff0d0'], dirt:'#5a4ea3', dirtS:['#6c60b8','#4a3f8f','#7a6fc8'], cap:'#35c9a8', capL:'#6ff0d0', capD:'#1f8a74',
    brick:['#7a6ff0','#4336b0','#aaa2ff'], hard:['#5fb7c9','#a4e8f2','#357f91'], pipe:['#c15cf0','#e3a6ff','#8b36b8','#4c1670'],
    semi:'shroom', plat:['#7ef0d0','#2f9c82'], far:'#2c2260', liquid:['#9be82e','#e0ff9a'], wall:'#241b55', ceilY:12 },
  castle:{ sky:'linear-gradient(#1b0a22,#451433 55%,#a83c2c)', fog:0x3a1230, fogNear:6, fogFar:50,
    hemiSky:0xfff1e6, hemiGround:0xb07a6a, hemiI:0.66, sunI:0.54, sunCol:0xffe8d6,
    top:'#9a98b3', topS:['#aeacc6','#8a88a2','#a3a1bb'], dirt:'#6f6d8a', dirtS:['#62607c','#807e9b'], cap:'#b4b2cc', capL:'#d0cee6', capD:'#4c4a63', stone:true,
    brick:['#c8524f','#7d2a28','#ea8a80'], hard:['#8a8aa3','#babad0','#5a5a73'], pipe:['#8f9bb3','#c9d3e6','#5e6980','#2c3342'],
    semi:'plank', plat:['#b98a5a','#7d5630'], far:'#33243f', liquid:['#ff6a1f','#ffd23e'], wall:'#3a2a46', ceilY:13 }
};

/* level-scoped state */
let L=null,W=0,tiles=null,M=null,TH=null;
const blockMesh=new Map(), multi=new Map();
let coinMesh=null,coinIdx=new Map(),coinPos=[];
let liquidTex=null,sunMesh=null,flagMesh=null,cpFlag=null,motes=null,blinkOn=false;
let enemies=[],items=[],shots=[],bombs=[],plats=[],springs=[],firebars=[],bumps=[];
let V=12.5,viewHalfW=11,camDist=23.3,camBaseY=6.25,camX=8,camY=6.25,camLead=0,focusY=2,shakeT=0,shakeA=0;

const tileAt=(x,y)=>(x<0||x>=W||y<0||y>=H)?AIR:tiles[y*W+x];
const solidAt=(x,y)=>{ if(x<0||x>=W) return true; if(y<0||y>=H) return false; return SOLID[tiles[y*W+x]]===1; };
const semiAt=(x,y)=>tileAt(x,y)===SEMI;
const tmpGeo=g=>{ g.userData.tmp=true; return g; };
function disposeWorld(){
  world.traverse(o=>{
    if(o.geometry&&o.geometry.userData.tmp) o.geometry.dispose();
    const m=o.material; if(m&&!Array.isArray(m)&&m.userData.tmp){ if(m.map) m.map.dispose(); m.dispose(); }
  });
  scene.remove(world); world=new T.Group(); scene.add(world);
}

/* ---------- materials ---------- */
const LM=t=>new T.MeshLambertMaterial({map:t});
const matCache={};
function themeMats(name){
  if(matCache[name]) return matCache[name];
  const c=THEMES[name];
  return matCache[name]={ gTop:LM(texTop(c)), gSide:LM(texSide(c)), gDirt:LM(texDirt(c)), gUnder:LM(texUnder(c)), hard:LM(texHard(c.hard)),
    sTop:LM(texSemi(c.semi,0)), sSide:LM(texSemi(c.semi,1)), sFace:LM(texSemi(c.semi,2)), sUnder:new T.MeshLambertMaterial({color:SEMI_UNDER[c.semi]}), brick:LM(texBrick(c.brick)) };
}
const texEyeOpen=texEye(true), texEyeShut=texEye(false);
const eyeMat=LM(texEyeOpen), eyeTopMat=LM(texEyeTop()), usedMat=LM(texUsed(true)), usedTopMat=LM(texUsed(false));
const eyeArr=[eyeMat,eyeMat,eyeTopMat,eyeTopMat,eyeMat,eyeMat], usedArr=[usedMat,usedMat,usedTopMat,usedTopMat,usedMat,usedMat];
const blockGeo=new T.BoxGeometry(1,1,1), partGeo=new T.BoxGeometry(1,1,1);
const emberMat=[new T.MeshBasicMaterial({color:0xff7a1f}),new T.MeshBasicMaterial({color:0xffd23e})];
const fireMat=new T.MeshBasicMaterial({color:0xffa52e});

/* ---------- terrain mesher ---------- */
const DEPTH={}; DEPTH[GROUND]=[1.5,-2.5]; DEPTH[HARD]=[1,-1]; DEPTH[SEMI]=[1,-1];
function buildTerrain(){
  const bk={};
  const bucket=n=>bk[n]||(bk[n]={p:[],n:[],u:[],i:[],c:0});
  function quad(name,a,b,c,d,nx,ny,nz,uw,vh,v0){ const q=bucket(name); v0=v0||0;
    q.p.push(a[0],a[1],a[2],b[0],b[1],b[2],c[0],c[1],c[2],d[0],d[1],d[2]);
    for(let k=0;k<4;k++) q.n.push(nx,ny,nz);
    q.u.push(0,v0,uw,v0,uw,v0+vh,0,v0+vh); q.i.push(q.c,q.c+1,q.c+2,q.c,q.c+2,q.c+3); q.c+=4; }
  /* outside the level the ground simply continues, so the edges of the world are never seen */
  const vis=(x,y)=>{ if(y>=H) return AIR; const cx=clamp(x,0,W-1);
    if(y<0) return tiles[cx]===GROUND?GROUND:AIR;
    const id=tiles[y*W+cx]; return (x<0||x>=W)?(id===GROUND?GROUND:AIR):id; };
  const covers=(x,y,zf,zb)=>{ const id=vis(x,y); if(id!==GROUND&&id!==HARD) return false; const d=DEPTH[id]; return d[0]>=zf&&d[1]<=zb; };
  for(let y=-4;y<H;y++) for(let x=-12;x<W+12;x++){
    const id=vis(x,y), d=DEPTH[id]; if(!d) continue;
    const zf=d[0], zb=d[1], dz=zf-zb;
    if(id===SEMI){
      const y0=y+0.5, y1=y+1;
      quad('sTop',[x,y1,zf],[x+1,y1,zf],[x+1,y1,zb],[x,y1,zb],0,1,0,1,dz);
      quad(((x%3)+3)%3===1?'sFace':'sSide',[x,y0,zf],[x+1,y0,zf],[x+1,y1,zf],[x,y1,zf],0,0,1,1,0.5,0.5);
      if(vis(x+1,y)!==SEMI) quad('sSide',[x+1,y0,zf],[x+1,y0,zb],[x+1,y1,zb],[x+1,y1,zf],1,0,0,dz,0.5,0.5);
      if(vis(x-1,y)!==SEMI) quad('sSide',[x,y0,zb],[x,y0,zf],[x,y1,zf],[x,y1,zb],-1,0,0,dz,0.5,0.5);
      quad('sUnder',[x,y0,zb],[x+1,y0,zb],[x+1,y0,zf],[x,y0,zf],0,-1,0,1,dz);
      continue;
    }
    let top='hard',side='hard',under='hard';
    if(id===GROUND){
      const expTop=y<H-1&&vis(x,y+1)!==GROUND, expBot=y>0&&vis(x,y-1)!==GROUND;
      top='gTop'; under='gDirt'; side=expTop?'gSide':(expBot?'gUnder':'gDirt');
    }
    if(!covers(x,y+1,zf,zb)&&y<H-1) quad(top,[x,y+1,zf],[x+1,y+1,zf],[x+1,y+1,zb],[x,y+1,zb],0,1,0,1,dz);
    quad(side,[x,y,zf],[x+1,y,zf],[x+1,y+1,zf],[x,y+1,zf],0,0,1,1,1);
    if(!covers(x+1,y,zf,zb)) quad(side,[x+1,y,zf],[x+1,y,zb],[x+1,y+1,zb],[x+1,y+1,zf],1,0,0,dz,1);
    if(!covers(x-1,y,zf,zb)) quad(side,[x,y,zb],[x,y,zf],[x,y+1,zf],[x,y+1,zb],-1,0,0,dz,1);
    if(y>0&&!covers(x,y-1,zf,zb)) quad(under,[x,y,zb],[x+1,y,zb],[x+1,y,zf],[x,y,zf],0,-1,0,1,dz);
  }
  for(const k in bk){ const q=bk[k], g=tmpGeo(new T.BufferGeometry());
    g.setAttribute('position',new T.Float32BufferAttribute(q.p,3)); g.setAttribute('normal',new T.Float32BufferAttribute(q.n,3)); g.setAttribute('uv',new T.Float32BufferAttribute(q.u,2)); g.setIndex(q.i);
    world.add(new T.Mesh(g,M[k])); }
}
function addBlock(x,y,id){ const m=new T.Mesh(blockGeo,id===BRICK?M.brick:id===QBLOCK?eyeArr:usedArr); m.position.set(x+0.5,y+0.5,0); world.add(m); blockMesh.set(y*W+x,m); return m; }
function buildBlocks(){ for(let y=0;y<H;y++) for(let x=0;x<W;x++){ const id=tiles[y*W+x]; if(id===BRICK||id===QBLOCK||id===USED) addBlock(x,y,id); } }
function buildPipes(){
  const c=TH.pipe, b=[];
  for(const p of L.pipes){ const x=p.x,y=p.y,h=p.h;
    b.push([x+0.1,y,-0.9,1.8,h-0.55,1.8,c[0]],[x-0.06,y+h-0.55,-1.06,2.12,0.55,2.12,c[0]],
      [x+0.3,y,0.9,0.25,h-0.55,0.03,c[1]],[x+0.14,y+h-0.55,1.06,0.3,0.55,0.03,c[1]],[x+1.35,y,0.9,0.4,h-0.55,0.03,c[2]],[x+1.5,y+h-0.55,1.06,0.4,0.55,0.03,c[2]],
      [x+0.25,y+h,-0.75,1.5,0.02,1.5,c[3]]); }
  if(b.length) world.add(new T.Mesh(tmpGeo(voxGeo(b,1)),MAT.vox));
}
function buildSpikes(){ const b=[], m=mSpikeTile(); for(let y=0;y<H;y++) for(let x=0;x<W;x++) if(tiles[y*W+x]===SPIKE) put(b,m,x*8,y*8,0); if(b.length) world.add(new T.Mesh(tmpGeo(voxGeo(b)),MAT.vox)); }
function buildCoins(){
  coinPos=[]; coinIdx=new Map(); coinMesh=null;
  for(let y=0;y<H;y++) for(let x=0;x<W;x++) if(tiles[y*W+x]===COIN){ coinIdx.set(y*W+x,coinPos.length); coinPos.push({x:x+0.5,y:y+0.5,on:true}); }
  if(!coinPos.length) return;
  coinMesh=new T.InstancedMesh(geo('coin',mCoin,0.1),MAT.coin,coinPos.length); coinMesh.frustumCulled=false; world.add(coinMesh);
}
function buildLiquid(){
  const c=TH.liquid;
  liquidTex=mkTex(g=>{ PX(g,c[0],0,0,16,16); const R=rng(5); for(let i=0;i<12;i++) PX(g,c[1],(R()*13)|0,(R()*16)|0,3,1); for(let i=0;i<10;i++) PX(g,shade(c[0],0.86),(R()*14)|0,(R()*16)|0,2,1); });
  const w=W+60; liquidTex.repeat.set(w,4);
  const mat=new T.MeshBasicMaterial({map:liquidTex}); mat.userData.tmp=true;
  const top=tmpGeo(new T.PlaneGeometry(w,3.95)); top.rotateX(-Math.PI/2);
  const a=new T.Mesh(top,mat); a.position.set(W/2,L.liquidY,-0.525);
  const b=new T.Mesh(tmpGeo(new T.PlaneGeometry(w,L.liquidY+6)),mat); b.position.set(W/2,(L.liquidY-6)/2,1.45);
  world.add(a,b);
}

/* ---------- scenery ---------- */
function hill(list,cx,top,z,w,col,R,face){
  const steps=4+((R()*3)|0), light=shade(col,1.07); let ww=w*0.34, y=top;
  for(let k=0;k<steps;k++){ const hh=1+R()*0.7; list.push([cx-ww/2,y-hh,z-2,ww,hh,4,k%2?col:light]); y-=hh; ww+=w*0.66/steps; }
  list.push([cx-ww/2,y-34,z-2,ww,34,4,col]);
  if(face){ const d=shade(col,0.6); list.push([cx-1.15,top-1.5,z+2,0.45,0.9,0.12,d],[cx+0.7,top-1.5,z+2,0.45,0.9,0.12,d],[cx-0.5,top-2.3,z+2,1,0.25,0.12,d]); }
}
function cloud(list,x,y,z,R){ const s=0.8+R()*0.9;
  list.push([x,y,z,5*s,1.3*s,2,WHITE],[x+0.9*s,y+1.3*s,z,3*s,1.1*s,2,WHITE],[x+3*s,y+1.3*s,z+0.2,1.4*s,0.6*s,1.6,WHITE],
    [x-0.8*s,y+0.2*s,z+0.3,1.2*s,0.7*s,1.4,'#f1f9ff'],[x+4.6*s,y+0.2*s,z+0.3,1.1*s,0.6*s,1.4,'#f1f9ff'],[x+0.4*s,y-0.25*s,z+0.1,4.2*s,0.3*s,1.8,'#d4ecff']); }
function laneDecor(R,near,glow){
  const th=L.theme;
  for(let x=1;x<W-1;x++){
    let ty=-1; for(let y=0;y<8;y++){ if(tiles[y*W+x]===GROUND&&tiles[(y+1)*W+x]!==GROUND){ ty=y+1; break; } }
    if(ty<0) continue;
    const free=h=>{ for(let k=0;k<h;k++){ const id=tiles[(ty+k)*W+x]; if(id===GROUND||id===HARD||id===PIPE) return false; } return true; };
    if(!free(1)) continue;
    let clearSky=true; for(let dx=-2;dx<=2&&clearSky;dx++) for(let k=0;k<8;k++){ const id=tileAt(x+dx,ty+k); if(id===BRICK||id===QBLOCK||id===SEMI||id===HIDDEN||id===COIN||id===PIPE){ clearSky=false; break; } }
    const r=R(), jx=x*8+2+R()*4, zb=-19+R()*5, zf=9.5+R()*1.5;
    if(th==='meadow'){
      if(r<0.13&&free(5)&&clearSky) put(near,dTree(pick(R,CANDY)),jx,ty*8,-16);
      else if(r<0.22) put(near,dGumdrop(pick(R,CANDY)),jx,ty*8,zb);
      else if(r<0.5) put(near,dFlower(pick(R,['#ff8fc7','#ffffff','#ffe14d','#b58cff'])),jx,ty*8,zb);
      else if(r<0.72) put(near,dTuft('#4cc04a'),jx,ty*8,zb);
      const f=R(); if(f<0.16) put(near,dFlower(pick(R,['#ff8fc7','#ffffff','#ffe14d'])),x*8+R()*6,ty*8,zf); else if(f<0.36) put(near,dTuft('#55c94f'),x*8+R()*6,ty*8,zf);
    } else if(th==='grotto'){
      if(r<0.1) put(glow,dCrystal(pick(R,['#6ff0ff','#ff7ad9','#b6ff6a'])),jx,ty*8,zb);
      else if(r<0.3) put(glow,dShroom(pick(R,['#39f0d0','#ff7ad9','#ffe14d'])),jx,ty*8,zb);
      else if(r<0.46) put(near,dRock('#6c60b8'),jx,ty*8,zb);
      const f=R(); if(f<0.12) put(glow,dShroom(pick(R,['#39f0d0','#ff7ad9'])),x*8+R()*6,ty*8,zf); else if(f<0.22) put(near,dRock('#4a3f8f'),x*8+R()*6,ty*8,zf);
    } else {
      if(r<0.1){ put(near,dCandle(),jx,ty*8,zb); glow.push([jx-0.4,ty*8+2.4,zb-0.4,0.8,1.2,0.8,'#ffd23e']); }
      else if(r<0.22) put(near,dBones(),jx,ty*8,zb);
      else if(r<0.4) put(near,dRock('#62607c'),jx,ty*8,zb);
      const f=R(); if(f<0.12) put(near,dRock('#807e9b'),x*8+R()*6,ty*8,zf);
    }
  }
}
function addMotes(col,n,size){
  const P=[], R=rng(77); for(let i=0;i<n;i++) P.push(R()*W,2.5+R()*8.5,-4.2+R()*5.4);
  const g=tmpGeo(new T.BufferGeometry()); g.setAttribute('position',new T.Float32BufferAttribute(P,3));
  const m=new T.PointsMaterial({color:col,size:size,sizeAttenuation:true,transparent:true,opacity:0.85,depthWrite:false}); m.userData.tmp=true;
  motes=new T.Points(g,m); world.add(motes);
}
function buildScenery(){
  const R=rng(1000+G.levelIdx*77), far=[], near=[], glow=[], glowFar=[], th=L.theme, c=TH;
  sunMesh=null; motes=null;
  if(th==='meadow'){
    for(let x=-50;x<W+50;x+=15+R()*12) hill(far,x,-1+R()*6,-25-R()*6,20+R()*16,pick(R,['#a9e79a','#9fe090','#b4eba6']),R,false);
    for(let x=-30;x<W+30;x+=11+R()*10) hill(far,x,-1+R()*3.2,-10-R()*4,9+R()*8,pick(R,['#5fcf62','#52c25a','#6ddb6a']),R,true);
    for(let x=-40;x<W+40;x+=8+R()*9) cloud(glowFar,x,4+R()*8,-16-R()*14,R);
    const s=[[-3,-4,0,6,8,1,'#ffe14d'],[-4,-3,0,8,6,1,'#ffe14d'],[-1.8,0.2,1,0.8,1.5,0.1,'#e08a12'],[1,0.2,1,0.8,1.5,0.1,'#e08a12'],[-1.6,-2,1,3.2,0.6,0.1,'#e08a12'],[-2.2,-1.5,1,0.6,0.6,0.1,'#e08a12'],[1.6,-1.5,1,0.6,0.6,0.1,'#e08a12'],
      [-0.7,5,0.2,1.4,1.8,0.6,'#fff3a0'],[-0.7,-6.8,0.2,1.4,1.8,0.6,'#fff3a0'],[5,-0.7,0.2,1.8,1.4,0.6,'#fff3a0'],[-6.8,-0.7,0.2,1.8,1.4,0.6,'#fff3a0'],
      [3.8,3.8,0.2,1.3,1.3,0.6,'#fff3a0'],[-5.1,3.8,0.2,1.3,1.3,0.6,'#fff3a0'],[3.8,-5.1,0.2,1.3,1.3,0.6,'#fff3a0'],[-5.1,-5.1,0.2,1.3,1.3,0.6,'#fff3a0']];
    sunMesh=new T.Mesh(tmpGeo(voxGeo(s,1)),new T.MeshBasicMaterial({vertexColors:true,fog:false})); sunMesh.material.userData.tmp=true; sunMesh.position.set(0,13,-62); world.add(sunMesh);
  } else {
    const wall=c.wall, cy=c.ceilY;
    far.push([-14,1,-5.5,W+28,1,3,c.far],[-14,cy,-5.5,W+28,8,3,c.far]);
    if(th==='grotto'){
      for(let gy=-9;gy<22;gy+=3) for(let gx=-14;gx<W+14;gx+=3) far.push([gx,gy,-6.3+R()*0.6,3,3,1,shade(wall,0.78+R()*0.5)]);
      for(let x=2;x<W;x+=4+R()*7){ const z=-4.9+R()*1.6, h=1+R()*2.6, w=0.7+R()*0.7;
        if(R()<0.55){ far.push([x,2,z,w,h,w,shade('#5a4ea3',0.8+R()*0.3)],[x+w*0.25,2+h,z+w*0.25,w*0.5,h*0.45,w*0.5,'#6c60b8']); }
        else { const col=pick(R,['#39f0d0','#ff7ad9','#ffe14d']); far.push([x+0.3,2,z+0.3,0.5,h+0.6,0.5,'#d9d0ff']); glowFar.push([x-0.5,2.6+h,z-0.5,2.1,0.7,2.1,col],[x-0.1,3.3+h,z-0.1,1.3,0.5,1.3,col],[x+0.2,2.75+h,z+1.6,0.5,0.3,0.05,WHITE]); }
        if(R()<0.6){ const sx=x+2+R()*2, sh=1+R()*2.2, sw=0.6+R()*0.6, sz=-4.8+R()*2; far.push([sx,cy-sh,sz,sw,sh,sw,shade('#5a4ea3',0.75+R()*0.3)],[sx+sw*0.25,cy-sh-sh*0.4,sz+sw*0.25,sw*0.5,sh*0.4,sw*0.5,'#4a3f8f']); }
      }
      addMotes(0xd8ff9a,90,0.13);
    } else {
      for(let gy=-8;gy<22;gy+=2){ const off=((gy/2)&1)?-2:0; for(let gx=-16+off;gx<W+16;gx+=4) far.push([gx+0.05,gy+0.05,-6.2+R()*0.45,3.9,1.9,1,shade(wall,0.8+R()*0.4)]); }
      for(let x=9;x<W;x+=18){
        glowFar.push([x,6,-4.72,3,4,0.1,'#ffb36b'],[x+0.5,10,-4.72,2,0.9,0.1,'#ffb36b'],[x+0.6,8.2,-4.6,1.8,0.5,0.05,'#ffe2a8']);
        far.push([x+1.4,6,-4.6,0.2,4.9,0.1,'#2a1f33'],[x,7.9,-4.6,3,0.2,0.1,'#2a1f33'],[x-0.4,5.5,-4.75,3.8,0.5,0.4,'#62607c']);
        const bx=x+8; far.push([bx,6.5,-4.72,2.2,4.5,0.1,'#c8524f'],[bx,6,-4.72,0.7,0.5,0.1,'#c8524f'],[bx+1.5,6,-4.72,0.7,0.5,0.1,'#c8524f'],[bx-0.2,11,-4.75,2.6,0.3,0.25,'#ffc928'],
          [bx+0.45,8.6,-4.6,0.45,0.6,0.05,'#ffc928'],[bx+1.3,8.6,-4.6,0.45,0.6,0.05,'#ffc928'],[bx+0.5,7.6,-4.6,1.2,0.25,0.05,'#ffc928']);
        const px=x+4.5; far.push([px,2,-4.6,1.3,cy-2,1.3,'#62607c'],[px-0.2,2,-4.8,1.7,0.6,1.7,'#807e9b'],[px-0.2,cy-0.6,-4.8,1.7,0.6,1.7,'#807e9b']);
        glowFar.push([px+0.4,7.3,-3.25,0.5,0.7,0.3,'#ffd23e'],[px+0.5,8,-3.2,0.3,0.4,0.2,'#fff3a0']); far.push([px+0.45,6.6,-3.3,0.4,0.7,0.3,'#2a1f33']);
      }
      addMotes(0xff9a3d,70,0.11);
    }
  }
  laneDecor(R,near,glow);
  if(far.length) world.add(new T.Mesh(tmpGeo(voxGeo(far,1)),MAT.vox));
  if(near.length) world.add(new T.Mesh(tmpGeo(voxGeo(near)),MAT.vox));
  if(glow.length) world.add(new T.Mesh(tmpGeo(voxGeo(glow)),MAT.glow));
  if(glowFar.length) world.add(new T.Mesh(tmpGeo(voxGeo(glowFar,1)),MAT.glow));
}
function buildGoal(){
  flagMesh=null; if(!L.goal) return;
  const gx=L.goal.x, b=[];
  for(let i=0;i<18;i++) b.push([gx*8+3.4,24+i*4,-0.6,1.2,4,1.2,i%2?WHITE:'#ff4f7b']);
  b.push([gx*8+2.4,96,-1.6,3.2,3.2,3.2,'#ffc928']);
  put(b,mHut(),(gx+5)*8,16,-12);
  world.add(new T.Mesh(tmpGeo(voxGeo(b)),MAT.vox));
  flagMesh=vmesh('flag',()=>[[-12,0,-0.3,12,8,0.6,'#2fd6c3'],[-8.6,2,0.3,5,4,0.2,WHITE],[-7,3,0.5,2,2,0.15,INK],[-8.6,2,-0.5,5,4,0.2,WHITE]]);
  flagMesh.position.set(gx+0.43,10.8,0); world.add(flagMesh);
}
function buildCheckpoint(){
  cpFlag=null; if(!L.checkpoint) return;
  const c=L.checkpoint;
  const post=vmesh('cppost',()=>[[-0.6,0,-0.6,1.2,15,1.2,'#fff2c2'],[-1.2,15,-1.2,2.4,2,2.4,'#ffc928'],[-2,0,-2,4,1,4,'#b9773f']]); post.position.set(c.x,c.y,-1.4); world.add(post);
  const m=new T.MeshLambertMaterial({vertexColors:true,color:G.cp?0x2fd6c3:0xb9b4c6}); m.userData.tmp=true;
  cpFlag=new T.Mesh(geo('cpflag',()=>[[0.6,9,-0.3,7,5,0.6,WHITE],[2.6,10.4,0.3,3,2.4,0.15,INK],[3.6,11,0.45,1,1,0.1,WHITE]]),m); cpFlag.position.copy(post.position); world.add(cpFlag);
}

/* ---------- pooled effects ---------- */
const PARTS=[], partMats={};
const pmatOf=col=>partMats[col]||(partMats[col]=new T.MeshLambertMaterial({color:col}));
function spawnPart(x,y,z,col,vx,vy,vz,life,size,grav){
  let p=null; for(const q of PARTS) if(q.life<=0){ p=q; break; }
  if(!p){ if(PARTS.length>=150) return; p={mesh:new T.Mesh(partGeo,pmatOf(col)),life:0}; fx.add(p.mesh); PARTS.push(p); }
  p.mesh.material=pmatOf(col); p.mesh.visible=true; p.mesh.position.set(x,y,z); p.mesh.scale.setScalar(size);
  p.vx=vx; p.vy=vy; p.vz=vz; p.life=life; p.max=life; p.size=size; p.grav=grav===undefined?30:grav;
}
function burst(x,y,col,n,spd,size,life){
  for(let i=0;i<n;i++){ const a=Math.random()*6.283, s=(spd||5)*(0.4+Math.random()*0.6);
    spawnPart(x,y,(Math.random()-0.5)*0.6,col,Math.cos(a)*s,Math.abs(Math.sin(a))*s+1.5,(Math.random()-0.5)*3,(life||0.5)*(0.6+Math.random()*0.6),(size||0.14)*(0.7+Math.random()*0.6)); }
}
const POPS=[], popTexCache={};
function popTex(txt,col){
  const k=txt+col; if(popTexCache[k]) return popTexCache[k];
  const c=document.createElement('canvas'); c.width=256; c.height=64; const g=c.getContext('2d');
  g.font='700 46px "Pixelify Sans","Trebuchet MS",sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.lineJoin='round';
  g.lineWidth=10; g.strokeStyle=INK; g.strokeText(txt,128,34); g.fillStyle=col; g.fillText(txt,128,34);
  const t=new T.CanvasTexture(c); return popTexCache[k]=t;
}
function popup(x,y,txt,col){
  let s=null; for(const q of POPS) if(q.life<=0){ s=q; break; }
  if(!s){ if(POPS.length>=14) return; const sp=new T.Sprite(new T.SpriteMaterial({transparent:true,depthTest:false,depthWrite:false})); sp.renderOrder=10; fx.add(sp); s={sp,life:0}; POPS.push(s); }
  s.sp.material.map=popTex(txt,col||WHITE); s.sp.material.needsUpdate=true; s.sp.visible=true; s.sp.position.set(x,y,1.3); s.sp.scale.set(3.4,0.85,1); s.life=0.9;
}
const CPOPS=[];
function coinPop(x,y){
  let c=null; for(const q of CPOPS) if(q.t<0){ c=q; break; }
  if(!c){ if(CPOPS.length>=14) return; c={mesh:new T.Mesh(geo('coin',mCoin,0.1),MAT.coin),t:-1}; fx.add(c.mesh); CPOPS.push(c); }
  c.t=0; c.x=x; c.y=y; c.mesh.visible=true;
}
function shake(a){ shakeT=0.22; shakeA=a; }

/* ---------- Blorp ---------- */
const pmat=new T.MeshLambertMaterial({vertexColors:true});
function makeBlorp(form){
  const c=blorpCols(form), big=form>0, g=new T.Group();
  const body=new T.Mesh(voxGeo(big?mBlorpBig(c,form===2):mBlorpSmall(c)),pmat);
  const footG=voxGeo(big?[[-1.3,-1.5,-1.5,2.6,1.5,4.2,c.f]]:[[-1,-1,-1.2,2,1,3.2,c.f]]);
  const armG=voxGeo(big?[[-0.6,-3.4,-0.6,1.2,3.6,1.2,c.d]]:[[-0.5,-2,-0.5,1,2.2,1,c.d]]);
  const fxo=big?1.9:1.6, fy=big?1.5:1, ax=big?4.1:3.5, ay=big?7.6:4.2;
  const fL=new T.Mesh(footG,pmat), fR=new T.Mesh(footG,pmat), aL=new T.Mesh(armG,pmat), aR=new T.Mesh(armG,pmat);
  fL.position.set(-fxo*S8,fy*S8,0); fR.position.set(fxo*S8,fy*S8,0); aL.position.set(-ax*S8,ay*S8,0.3*S8); aR.position.set(ax*S8,ay*S8,0.3*S8);
  g.add(body,fL,fR,aL,aR); g.userData={body,fL,fR,aL,aR}; return g;
}
const proot=new T.Group(), forms=[makeBlorp(0),makeBlorp(1),makeBlorp(2)];
forms.forEach(f=>proot.add(f)); scene.add(proot);
const shadow=new T.Mesh(new T.CircleGeometry(0.4,14),new T.MeshBasicMaterial({color:0x1c1233,transparent:true,opacity:0.26,depthWrite:false}));
shadow.rotation.x=-Math.PI/2; scene.add(shadow);

function makeEnemy(type){
  const g=new T.Group(), u=g.userData;
  if(type==='blob') g.add(vmesh('blob',mBlob));
  else if(type==='shellby'){ u.slug=vmesh('slug',mSlug); u.shell=vmesh('shell',mShell); u.shell.position.set(0,1.4*S8,-0.9*S8); g.add(u.slug,u.shell); }
  else if(type==='spikit') g.add(vmesh('spikit',mSpikit));
  else if(type==='batty'){ u.body=vmesh('batty',mBatty); u.wl=vmesh('wingL',()=>mWing(-1)); u.wr=vmesh('wingR',()=>mWing(1)); u.wl.position.set(-2.5*S8,3.2*S8,0); u.wr.position.set(2.5*S8,3.2*S8,0); g.add(u.body,u.wl,u.wr); }
  else if(type==='boing') g.add(vmesh('boing',mBoing));
  else if(type==='chomper') g.add(vmesh('chomper',mChomper));
  else if(type==='boss'){ const m=vmesh('boss',mBoss); m.scale.setScalar(2.2); g.add(m); }
  return g;
}

/* ---------- camera ---------- */
function camTargetX(){ const lo=viewHalfW-0.3, hi=W-viewHalfW+0.3; return lo<hi?clamp(player.x+camLead,lo,hi):W/2; }
function updateCamera(dt,snap){
  const p=player;
  if(!p.dead){
    camLead+=((p.face*1.5+clamp(p.vx*0.22,-2,2))-camLead)*Math.min(1,dt*2.2);
    if(p.onGround||p.y<focusY) focusY=p.y; else if(p.y>focusY+5) focusY=p.y-5;
  }
  const tx=camTargetX(), ty=Math.min(camBaseY+Math.max(0,focusY-5)*0.9,Math.max(camBaseY,H-V/2+1));
  if(snap){ camX=tx; camY=ty; } else { camX+=(tx-camX)*Math.min(1,dt*6); camY+=(ty-camY)*Math.min(1,dt*3); }
  let sx=0,sy=0;
  if(shakeT>0){ shakeT-=dt; if(!reduceMotion){ sx=(Math.random()-0.5)*shakeA; sy=(Math.random()-0.5)*shakeA; } }
  camera.position.set(camX+sx,camY+camDist*Math.sin(0.19)+sy,camDist*Math.cos(0.19));
  camera.lookAt(camX+sx,camY+sy,0);
  if(sunMesh) sunMesh.position.x=camX+viewHalfW*2.2;
}
function applyTheme(){
  stage.style.background=TH.sky;
  scene.fog=new T.Fog(TH.fog,camDist+TH.fogNear,camDist+TH.fogFar);
  hemi.color.set(TH.hemiSky); hemi.groundColor.set(TH.hemiGround); hemi.intensity=TH.hemiI; sun.color.set(TH.sunCol); sun.intensity=TH.sunI;
}
