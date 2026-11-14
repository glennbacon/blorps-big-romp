/* ================= level loading ================= */
/* Throw away whatever level is loaded: its meshes, its lists, and any effects still in the air. */
function unloadLevel(){
  disposeWorld();
  blockMesh.clear(); multi.clear(); enemies=[]; items=[]; shots=[]; bombs=[]; plats=[]; springs=[]; firebars=[]; bumps=[];
  coinMesh=null; liquidTex=null; sunMesh=null; flagMesh=null; cpFlag=null; motes=null;
  for(const p of PARTS){ p.life=0; p.mesh.visible=false; }
  for(const s of POPS){ s.life=0; s.sp.visible=false; }
  for(const c of CPOPS){ c.t=-1; c.mesh.visible=false; }
}
function loadLevel(idx,fromCp){
  unloadLevel();
  G.levelIdx=idx; L=LEVELS[idx](); W=L.W; tiles=L.tiles; M=themeMats(L.theme);
  /* each level in a world can restyle the sky and light a little, so five levels do not look like one */
  const base=THEMES[L.theme]; TH=Object.assign({},base,base.looks&&base.looks[L.stage]); GRAV=TH.grav||1;
  applyTheme();
  buildTerrain(); buildBlocks(); buildPipes(); buildSpikes(); buildCoins(); buildLiquid(); buildScenery(); buildGoal(); buildCheckpoint();
  for(const d of L.enemies) spawnEnemy(d);
  if(L.boss) spawnEnemy(Object.assign({type:'boss'},L.boss));
  for(const d of L.plats) spawnPlat(d);
  for(const d of L.springs){ const m=vmesh('spring',mSpring); m.position.set(d.x,d.y,0); world.add(m); springs.push({x:d.x,y:d.y,t:0,mesh:m}); }
  for(const d of L.firebars) spawnFirebar(d);
  const s=(fromCp&&L.checkpoint)?L.checkpoint:L.start;
  resetPlayer(s.x,s.y);
  updateCamera(0,true); animate(0,G.time);
  $('h-level').textContent=L.name+' '+L.label;
}

/* ================= per-frame animation (visual only) ================= */
const _d=new T.Object3D();
function animPlayer(dt,time){
  const p=player, show=(p.growT>0&&((p.growT*14|0)%2))?p.prevForm:p.form;
  for(let i=0;i<3;i++) forms[i].visible=i===show;
  if(p.goal!=='in'&&p.goal!=='done') proot.visible=!(p.inv>0&&!p.dead&&((time*18|0)%2));
  proot.position.set(p.x,p.y,0);
  const g=forms[show], u=g.userData, sp=Math.abs(p.vx), idle=(p.idleT>2.5||G.state==='title')&&p.onGround&&!p.goal;
  let rot=p.face>0?0.95:-0.95; if(p.dead||idle) rot=0; if(p.goal==='slide') rot=1.35;
  proot.rotation.y+=(rot-proot.rotation.y)*Math.min(1,dt*14);
  proot.rotation.z+=((p.skid?-p.face*0.22:0)-proot.rotation.z)*Math.min(1,dt*12);
  let fl=0,fr=0,al=0,ar=0,azl=0,azr=0,by=0;
  if(p.dead){ azl=azr=2.6; fl=0.5; fr=-0.5; }
  else if(p.goal==='slide'){ azl=azr=2.2; fl=fr=0.3; }
  else if(p.onGround){
    p.walkPh+=sp*dt*3.4; const k=Math.min(1,sp/2.5), sw=Math.sin(p.walkPh)*k;
    fl=sw*0.95; fr=-sw*0.95; al=-sw*0.8; ar=sw*0.8; by=Math.abs(Math.sin(p.walkPh))*0.035*k;
    if(idle) azr=2.3+Math.sin(time*9)*0.4;
  } else { fl=0.75; fr=-0.45; azl=azr=2.3; }
  u.fL.rotation.x=fl; u.fR.rotation.x=fr; u.aL.rotation.x=al; u.aR.rotation.x=ar; u.aL.rotation.z=-azl; u.aR.rotation.z=azr; u.body.position.y=by;
  p.squash=Math.max(0,p.squash-dt*7);
  let st=1;
  if(!p.dead&&!p.goal){ st=p.onGround?1-p.squash*0.22+Math.sin(time*3)*0.015:1+clamp(p.vy,-9,12)*0.012; }
  const inv=1/Math.sqrt(st); g.scale.set(inv,st,inv);
  if(p.star>0) pmat.emissive.setHSL((time*1.6)%1,1,(p.star<2&&((time*10|0)%2))?0.06:0.34); else pmat.emissive.setRGB(0,0,0);
  /* blob shadow on whatever is below */
  let gy=-99; const tx=Math.floor(p.x);
  for(let ty=Math.floor(p.y+0.05)-1;ty>=0;ty--){ if(solidAt(tx,ty)||semiAt(tx,ty)){ gy=ty+1; break; } }
  for(const pl of plats) if(p.x>pl.x&&p.x<pl.x+pl.w&&pl.y<=p.y+0.05&&pl.y>gy) gy=pl.y;
  shadow.visible=gy>-50&&!p.dead&&proot.visible&&p.goal!=='slide';
  if(shadow.visible){ const k=clamp(1-(p.y-gy)*0.11,0.3,1); shadow.position.set(p.x,gy+0.03,0); shadow.scale.setScalar(k); }
}
function animEnemies(dt,time){
  for(const e of enemies){
    const m=e.mesh, u=m.userData;
    if(e.dead){ m.position.set(e.x,e.y+(e.flip?e.h:0),0); if(e.flip) m.rotation.z=Math.PI; continue; }
    if(e.type==='chomper'){ m.position.set(e.x,e.top-1.55+e.ext*1.5,0); m.rotation.y=Math.sin(time*2+e.x)*0.35; m.scale.y=1+Math.sin(time*10)*0.05*e.ext; continue; }
    m.position.set(e.x,e.y,0);
    if(e.type==='blob'){ m.rotation.y=(e.vx>0?1:-1)*0.8; m.rotation.z=Math.sin(time*11+e.x)*0.1; }
    else if(e.type==='spikit'){ m.rotation.y=(e.vx>0?1:-1)*0.8; m.rotation.z=Math.sin(time*14+e.x)*0.06; }
    else if(e.type==='shellby'){
      if(e.shell){ if(e.vx) m.rotation.y+=dt*18*sgn(e.vx); m.rotation.z=e.shellT>5?Math.sin(time*40)*0.1:0; }
      else { m.rotation.y=(e.vx>0?1:-1)*1.1; m.rotation.z=0; m.position.y+=Math.abs(Math.sin(time*6+e.x))*0.03; }
    }
    else if(e.type==='batty'){ u.wl.rotation.z=Math.sin(time*16+e.ox)*0.7; u.wr.rotation.z=-u.wl.rotation.z; m.rotation.y=Math.cos(e.t*e.sp)*0.5; }
    else if(e.type==='boing'){ const s=e.onGround?1-Math.max(0,0.45-e.wait)*0.6:1+clamp(e.vy,-6,8)*0.02, q=1/Math.sqrt(s); m.scale.set(q,s,q); m.rotation.y=(player.x>e.x?1:-1)*0.7; }
    else if(e.type==='prickle'){ const k=e.aim&&e.throwT<0.4?1+(0.4-e.throwT)*0.6:1; m.scale.set(k,1/k,k); m.rotation.y=(player.x>e.x?1:-1)*0.6; }
    else if(e.type==='icicle'){ m.rotation.z=e.st===1?Math.sin(time*50)*0.14:0; }
    else if(e.type==='boss'){ m.rotation.y=(player.x>e.x?1:-1)*0.75; m.rotation.z=e.onGround?Math.sin(time*8)*0.05:0; m.visible=!(e.inv>0&&((time*24|0)%2)); }
  }
}
/* the pooled effects: flying bits, score pop-ups and coins from blocks. The map uses them too. */
function animFx(dt){
  for(const p of PARTS){ if(p.life<=0) continue; p.life-=dt; if(p.life<=0){ p.mesh.visible=false; continue; }
    p.vy-=p.grav*dt; const m=p.mesh; m.position.x+=p.vx*dt; m.position.y+=p.vy*dt; m.position.z+=p.vz*dt; m.rotation.x+=dt*8; m.rotation.z+=dt*6; m.scale.setScalar(p.size*Math.min(1,p.life/p.max*2)); }
  for(const s of POPS){ if(s.life<=0) continue; s.life-=dt; if(s.life<=0){ s.sp.visible=false; continue; } s.sp.position.y+=dt*1.5; s.sp.material.opacity=Math.min(1,s.life*4); }
  for(const c of CPOPS){ if(c.t<0) continue; c.t+=dt;
    if(c.t>0.55){ c.t=-1; c.mesh.visible=false; popup(c.x,c.y+1.1,'200','#ffe14d'); continue; }
    c.mesh.position.set(c.x,c.y+13*c.t-20*c.t*c.t,0); c.mesh.rotation.y=c.t*26; }
}
function animate(dt,time){
  animPlayer(dt,time); animEnemies(dt,time);
  for(const it of items){ it.mesh.position.set(it.x,it.y,0);
    it.mesh.rotation.y=it.kind==='star'?time*4:it.kind==='muffin'?Math.sin(time*3)*0.25:Math.sin(time*2.6)*0.6; }
  for(const s of shots){ s.mesh.position.set(s.x,s.y,0.2); s.mesh.rotation.z=time*20; s.mesh.rotation.x=time*13; }
  for(const b of bombs){ b.mesh.position.set(b.x,b.y,0.2); b.mesh.rotation.z-=dt*6*sgn(b.vx); }
  for(const pl of plats) pl.mesh.position.set(pl.x,pl.y,0);
  for(const s of springs){ if(s.t>0) s.t-=dt; const k=s.t>0?Math.sin((s.t/0.35)*Math.PI):0; s.mesh.scale.set(1+k*0.15,1-k*0.45,1+k*0.15); }
  for(const f of firebars){ const c=Math.cos(f.a), s=Math.sin(f.a); for(let i=0;i<f.n;i++){ const m=f.embers[i]; m.position.set(f.x+c*i*0.55,f.y+s*i*0.55,0); m.rotation.z=time*6+i; m.rotation.x=time*4; } }
  if(bumps.length){ for(const b of bumps){ b.t+=dt; b.mesh.position.y=b.y+(b.t<0.2?Math.sin(b.t/0.2*Math.PI)*0.32:0); } bumps=bumps.filter(b=>b.t<0.2); }
  if(coinMesh){
    for(let i=0;i<coinPos.length;i++){ const c=coinPos[i];
      if(c.on&&Math.abs(c.x-camX)<viewHalfW+8){ _d.position.set(c.x,c.y+Math.sin(time*3+c.x)*0.05,0); _d.rotation.set(0,time*3.2+c.x*0.6,0); _d.scale.setScalar(1); }
      else { _d.position.set(c.x,-60,0); _d.scale.setScalar(0.001); }
      _d.updateMatrix(); coinMesh.setMatrixAt(i,_d.matrix); }
    coinMesh.instanceMatrix.needsUpdate=true;
  }
  animFx(dt);
  if(liquidTex) liquidTex.offset.x=time*0.12;
  const bl=(time%3.6)>3.45; if(bl!==blinkOn){ blinkOn=bl; eyeMat.map=bl?texEyeShut:texEyeOpen; }
  if(flagMesh) flagMesh.rotation.y=Math.sin(time*3)*0.18;
  if(cpFlag) cpFlag.rotation.y=Math.sin(time*2.6)*0.22;
  if(motes){ const f=motes.userData.fall; motes.position.y=f?-((time*f)%8.5):Math.sin(time*0.7)*0.35; motes.position.x=Math.sin(time*0.23)*0.8; }
  if(sunMesh) sunMesh.rotation.z=Math.sin(time*0.5)*0.06;
}

/* ================= screens and flow ================= */
let isTouch=!!(window.matchMedia&&window.matchMedia('(pointer: coarse)').matches), saved=null, acc=0, lastT=0;
function show(id){
  const ov=$('overlay'); ov.hidden=!id; ov.className=id||'';
  for(const s of ov.querySelectorAll('.screen')) s.hidden=s.id!==id;
  if(id&&!isTouch){ const b=$(id).querySelector('.btn'); if(b){ try{ b.focus({preventScroll:true}); }catch(e){} } }
}
/* Progress is kept in the browser so "Continue" on the title screen can pick it up after the page is closed:
   `level` is the marker Blorp stands on and `open` the furthest level opened (see f_map.js).
   Storage can be missing or blocked (private windows, embedded pages), so every use is allowed to fail quietly. */
const SAVE_KEY='blorps-big-romp.save';
function writeSave(level,fresh){
  const d=fresh?{level,open:G.open,score:0,coins:0,lives:3,form:0}:{level,open:G.open,score:G.score,coins:G.coins,lives:G.lives,form:player.form};
  try{ window.localStorage.setItem(SAVE_KEY,JSON.stringify(d)); }catch(e){}
}
/* Make sense of something that claims to be a save, or return null. A save from before the map has no `open`:
   everything up to its level counts as open. One whose `open` cannot be right is read the same way. */
function checkSave(d){
  if(!d||!Number.isInteger(d.level)||d.level<0||d.level>=LEVELS.length) return null;
  if(!Number.isInteger(d.open)||d.open<d.level||d.open>LEVELS.length) d.open=d.level;
  return d;
}
function readSave(){ try{ return checkSave(JSON.parse(window.localStorage.getItem(SAVE_KEY))); }catch(e){} return null; }
function beginLevel(fromCp){
  G.bossSeen=false; G.bossDead=false;
  mapMode(false);
  loadLevel(G.levelIdx,fromCp); writeSave(G.levelIdx);
  G.state='card'; G.cardT=1.8; acc=0; input.jumpBuf=0; input.runEdge=false;
  $('card-eyebrow').textContent='World '+(L.world+1)+' \u00b7 Level '+(L.stage+1)+' of '+L.stages; $('card-name').textContent=L.name; $('card-lives').textContent=G.lives;
  show('s-card'); musicStop();
}
/* There is no pausing while Blorp is dying: the pause screen's ways out would let him off the life he just lost. */
function togglePause(){
  if(G.state==='play'&&!player.dead){ G.state='pause'; show('s-pause'); musicPause(true); sfx.pause(); }
  else if(G.state==='pause'){ G.state='play'; show(null); musicPause(false); acc=0; }
}
function afterDeath(){
  G.lives--; player.form=0;
  if(G.lives<=0){ G.state='over'; writeSave(G.levelIdx,true); show('s-over'); sfx.over(); }
  else beginLevel(G.cp);
}
/* Clearing a level for the first time opens the next one. The new stretch of path is shown appearing once Blorp is
   back on the map; after the last level there is no more path to show. */
let newPath=-1;
function levelClear(){
  const first=G.levelIdx>=G.open; if(first) G.open=G.levelIdx+1;
  newPath=first&&G.levelIdx<MAPSEGS.length?G.levelIdx:-1;
  G.state='clear'; writeSave(G.levelIdx);
  $('clear-eyebrow').textContent='Level '+L.label+' clear'; $('clear-name').textContent=L.name; $('clear-score').textContent=G.score; $('clear-coins').textContent=G.coins;
  $('clear-note').hidden=!L.boss;
  show('s-clear');
}
/* Beating the last level opens nothing new, but it still counts: `open` runs one past the end so its marker reads as cleared. */
function showWin(){ G.open=LEVELS.length; newPath=-1; G.state='win'; writeSave(G.levelIdx); $('win-score').textContent=G.score; $('win-coins').textContent=G.coins; show('s-win'); }
function act(a){
  auInit();
  if(a==='start'){ G.score=0; G.coins=0; G.lives=3; G.open=0; G.levelIdx=0; player.form=0; showMap(-1); }
  else if(a==='continue'&&saved){ G.score=saved.score|0; G.coins=saved.coins|0; G.lives=Math.max(1,saved.lives|0); G.open=saved.open; G.levelIdx=saved.level; player.form=clamp(saved.form|0,0,2); showMap(-1); }
  else if(a==='resume') togglePause();
  else if(a==='restart'&&G.state==='pause'){ G.cp=false; player.form=0; beginLevel(false); }
  else if(a==='map'&&(G.state==='clear'||G.state==='over'||G.state==='win'||G.state==='pause')){
    if(G.state==='over'){ G.score=0; G.coins=0; G.lives=3; player.form=0; }
    const seg=G.state==='clear'?newPath:-1; newPath=-1; showMap(seg);
  }
}
function primaryAction(){
  if(G.state==='map') return mapEnter();
  const a={title:saved?'continue':'start',pause:'resume',clear:'map',over:'map',win:'map'}[G.state];
  if(!a) return false; act(a); return true;
}
function toggleSound(){ setMuted(!AU.muted); const b=$('b-sound'); b.classList.toggle('off',AU.muted); b.setAttribute('aria-pressed',String(!AU.muted)); }
$('overlay').addEventListener('click',e=>{ const b=e.target.closest('[data-act]'); if(b){ b.blur(); act(b.dataset.act); } });
$('b-pause').addEventListener('click',e=>{ auInit(); e.currentTarget.blur(); togglePause(); });
$('b-sound').addEventListener('click',e=>{ auInit(); e.currentTarget.blur(); toggleSound(); });
/* A hidden page pauses a level. The map has nothing to pause, but its tune goes quiet until the page is back. */
function pageHidden(){ if(G.state==='map') musicPause(document.hidden); else if(document.hidden&&G.state==='play') togglePause(); }
document.addEventListener('visibilitychange',pageHidden);

/* ================= the map between levels ================= */
/* The map and a level never show together. Switching also re-runs the layout, because the touch keys are laid out
   differently on the map and the level camera measures itself against them. */
let mapOn=false;
function mapMode(on){ if(mapOn===on) return; mapOn=on; document.body.classList.toggle('map',on); mapViewShow(on); layout(); }
/* Go to the map, with Blorp on the marker of the level he was last on. `seg` is a stretch of path to show
   appearing, or -1. */
function showMap(seg){
  unloadLevel(); musicStop();
  G.state='map'; G.cp=false; player.dead=false; setSize();
  mapPlace(G.levelIdx); if(seg>=0) mapReveal(seg);
  mapMode(true); mapViewSync(); mapBanner(); show(null);
  padWas=padDir(); playWas=tk.jump; /* whatever is held on arriving does not count until it is let go */
  writeSave(G.levelIdx); musicStart('map');
}
/* Play the level Blorp is standing on. Not while he is walking, and not while a path is appearing. */
function mapEnter(){
  if(G.state!=='map'||MAPST.walk||MAPST.reveal) return false;
  G.levelIdx=MAPST.at; G.cp=false; sfx.mapPlay(); beginLevel(false); return true;
}
/* A direction was pressed on the map. */
function mapPress(dir){
  if(G.state!=='map') return;
  const r=mapGo(dir);
  if(r==='locked'){ sfx.mapNo(); mapBanner('Clear this level to open the path'); } else if(r==='none') sfx.mapNo();
}
/* The touch pad and the A key on the map. Only a fresh press counts. */
let padWas=null, playWas=false;
function mapInput(){
  const d=padDir(), a=tk.jump;
  if(d&&d!==padWas) mapPress(d);
  if(a&&!playWas) mapEnter();
  padWas=d; playWas=a;
}
/* f_map.js calls these as Blorp walks and as a new stretch of path appears */
function mapStepped(){ sfx.mapHop(); }
function mapArrived(){ G.levelIdx=MAPST.at; writeSave(G.levelIdx); mapBanner(); }
function mapRevealed(seg,k,done){ mapViewSync(); mapViewPop(seg,k,done); if(done){ sfx.mapOpen(); mapBanner(); } else sfx.mapTile(k); }

/* ================= input ================= */
const kb={left:false,right:false,jump:false,run:false}, tk={left:false,right:false,up:false,down:false,jump:false,run:false};
const KEYS={ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',Space:'jump',ArrowUp:'jump',KeyW:'jump',KeyZ:'jump',KeyK:'jump',ShiftLeft:'run',ShiftRight:'run',KeyX:'run',KeyJ:'run'};
/* On the map the arrows and W A S D walk Blorp north, east, south and west. Up and W jump in a level; here they are
   only a direction, so they never start one. */
const MAPKEYS={ArrowUp:'N',KeyW:'N',ArrowRight:'E',KeyD:'E',ArrowDown:'S',KeyS:'S',ArrowLeft:'W',KeyA:'W'}, kbDir={N:false,E:false,S:false,W:false};
let lastDir='N';
function keyDown(e){
  if(e.metaKey||e.ctrlKey||e.altKey) return;
  const k=KEYS[e.code], d=MAPKEYS[e.code];
  if(e.repeat){ if(k||d||e.code==='Enter') e.preventDefault(); return; }
  auInit();
  if(e.code==='Enter'||(e.code==='Space'&&G.state!=='play')||(G.state==='map'&&(e.code==='KeyZ'||e.code==='KeyK'))){ e.preventDefault(); primaryAction(); return; }
  if(e.code==='KeyP'||e.code==='Escape'){ e.preventDefault(); togglePause(); return; }
  if(e.code==='KeyM'){ toggleSound(); return; }
  if(d){ kbDir[d]=true; lastDir=d; e.preventDefault(); if(G.state==='map') mapPress(d); }
  if(k){ kb[k]=true; e.preventDefault(); }
}
function keyUp(e){ const k=KEYS[e.code], d=MAPKEYS[e.code]; if(d) kbDir[d]=false; if(k){ kb[k]=false; e.preventDefault(); } }
window.addEventListener('keydown',keyDown);
window.addEventListener('keyup',keyUp);
window.addEventListener('blur',()=>{ kb.left=kb.right=kb.jump=kb.run=false; kbDir.N=kbDir.E=kbDir.S=kbDir.W=false; });
const padDir=()=>tk.up?'N':tk.right?'E':tk.down?'S':tk.left?'W':null;
/* the direction being held on the map: the key pressed last if it is still down, else any that is, else the touch pad */
function heldDir(){ if(kbDir[lastDir]) return lastDir; for(const d in kbDir) if(kbDir[d]) return d; return padDir(); }
function pollInput(){
  const j=kb.jump||tk.jump, r=kb.run||tk.run;
  if(j&&!input.jump) input.jumpBuf=0.11;
  if(r&&!input.run) input.runEdge=true;
  input.jump=j; input.run=r; input.left=kb.left||tk.left; input.right=kb.right||tk.right;
}
const padMove=$('pad-move'), padAct=$('pad-act'), keyA=$('key-a'), keyB=$('key-b'), keyL=padMove.children[0], keyR=padMove.children[1], keyU=padMove.children[2], keyD=padMove.children[3];
function evalTouches(ev){
  let l=false,r=false,u=false,d=false,a=false,b=false;
  const rm=padMove.getBoundingClientRect(), rp=padAct.getBoundingClientRect(), ra=keyA.getBoundingClientRect(), rb=keyB.getBoundingClientRect();
  const ax=ra.left+ra.width/2, ay=ra.top+ra.height/2, bx=rb.left+rb.width/2, by=rb.top+rb.height/2, rad=ra.width/2+26;
  const mid=(rm.right+rp.left)/2; /* a thumb left of this line only steers, right of it only acts */
  for(let i=0;i<ev.touches.length;i++){ const t=ev.touches[i], x=t.clientX, y=t.clientY;
    if(x<mid){ if(x>rm.left-40&&y>rm.top-48&&y<rm.bottom+48){ const dx=x-(rm.left+rm.width/2), dy=y-(rm.top+rm.height/2);
        /* on the map the pad is a cross, and whichever arm the thumb is nearest wins */
        if(mapOn&&Math.abs(dy)>Math.abs(dx)){ if(dy<0) u=true; else d=true; } else if(dx<0) l=true; else r=true; } }
    else { if(Math.hypot(x-ax,y-ay)<rad) a=true; if(Math.hypot(x-bx,y-by)<rad) b=true; } }
  tk.left=l; tk.right=r; tk.up=u; tk.down=d; tk.jump=a; tk.run=b;
  keyL.classList.toggle('on',l); keyR.classList.toggle('on',r); keyU.classList.toggle('on',u); keyD.classList.toggle('on',d); keyA.classList.toggle('on',a); keyB.classList.toggle('on',b);
}
function onTouch(e){
  if(!isTouch){ isTouch=true; layout(); }
  evalTouches(e);
  const t=e.target; if(t===canvas||(t.closest&&t.closest('#deck'))) e.preventDefault();
}
for(const n of ['touchstart','touchmove','touchend','touchcancel']) document.addEventListener(n,onTouch,{passive:false});
/* mouse on the on-screen keys, for touch laptops and testing */
for(const el of document.querySelectorAll('.key')){
  el.addEventListener('pointerdown',e=>{ if(e.pointerType==='mouse'){ tk[el.dataset.k]=true; el.classList.add('on'); } });
  for(const n of ['pointerup','pointerleave']) el.addEventListener(n,e=>{ if(e.pointerType==='mouse'){ tk[el.dataset.k]=false; el.classList.remove('on'); } });
}

/* ================= layout, HUD, loop ================= */
function layout(){
  const w=window.innerWidth, h=window.innerHeight;
  document.body.classList.toggle('touch',isTouch);
  const portrait=isTouch&&h>w*1.05;
  document.body.classList.toggle('portrait',portrait);
  stage.style.flex=portrait?'0 0 '+Math.round(clamp(h*0.56,Math.min(w*0.86,h-205),h-205))+'px':'';
  const sw=stage.clientWidth||w, sh=stage.clientHeight||h;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2)); renderer.setSize(sw,sh,false);
  const aspect=sw/sh;
  V=clamp(14/aspect,12.5,19); camDist=(V/2)/Math.tan(15*Math.PI/180);
  camera.aspect=aspect; camera.far=camDist+150; camera.updateProjectionMatrix();
  viewHalfW=V*aspect/2;
  /* Landscape touch: the pads float over the bottom of the stage, so raise the walking surface until it clears them.
     n is how far below centre the ground line has to sit (1 = bottom edge); the divisor allows for the camera's 0.19 rad tilt. */
  let lift=0.34*V;
  if(isTouch&&!portrait){
    const sb=stage.getBoundingClientRect().bottom; let top=sb;
    /* measured from the pads, not the keys: a key shifts down while it is pressed, and A is down when a level starts from the map */
    for(const k of [padMove,padAct]) top=Math.min(top,k.getBoundingClientRect().top);
    const n=clamp(1-2*(sb-top+6)/sh,0.1,1);
    lift=Math.min(lift,n*V/(2*(Math.cos(0.19)-n*Math.sin(0.19)*Math.tan(15*Math.PI/180))));
  }
  camBaseY=2+lift;
  if(scene.fog&&TH&&!mapOn){ scene.fog.near=camDist+TH.fogNear; scene.fog.far=camDist+TH.fogFar; } /* the map keeps its own haze */
}
window.addEventListener('resize',layout);
const hudC={lives:-1,coins:-1,score:-1};
function updateHud(){
  if(hudC.lives!==G.lives){ hudC.lives=G.lives; $('h-lives').textContent=G.lives; }
  if(hudC.coins!==G.coins){ hudC.coins=G.coins; $('h-coins').textContent=String(G.coins).padStart(2,'0'); }
  if(hudC.score!==G.score){ hudC.score=G.score; $('h-score').textContent=String(G.score).padStart(6,'0'); }
}
function frame(now){
  requestAnimationFrame(frame);
  const dt=Math.min(0.1,Math.max(0,(now-lastT)/1000)); lastT=now;
  pollInput();
  if(G.state==='card'){ G.cardT-=dt; if(G.cardT<=0){ show(null); G.state='play'; acc=0; input.jumpBuf=0; input.runEdge=false; musicStart(L.theme); } }
  if(G.state==='play'){ acc+=dt; let n=0; while(acc>=STEP&&n<16&&G.state==='play'){ step(STEP); acc-=STEP; n++; } if(n>=16) acc=0; }
  if(G.state==='map') mapInput(); /* which may start a level, so the state is looked at again */
  if(G.state==='map'){ G.time+=dt; mapTick(dt,heldDir(),input.run); animFx(dt); mapViewFrame(dt,G.time); }
  else if(G.state!=='pause'){ G.time+=dt; animate(dt,G.time); updateCamera(dt,false); }
  updateHud();
  renderer.render(scene,camera);
}

/* Keep progress when the page is republished while open. */
const hot=window.claude&&window.claude.hot;
if(hot&&hot.snapshot){ try{ hot.snapshot(()=>({level:G.levelIdx,open:G.open,score:G.score,coins:G.coins,lives:G.lives,form:player.form,playing:G.state!=='title'})); }catch(e){} }
function boot(data){
  layout();
  loadLevel(0,false);
  saved=data&&data.playing?checkSave(data):readSave();
  if(saved){
    /* Continue becomes the main button, so a stray Enter cannot start over and overwrite the save */
    const b=$('btn-continue'), n=$('btn-start'); b.hidden=false; b.textContent='Continue at '+LABELS[saved.level];
    b.classList.remove('quiet'); n.classList.add('quiet'); n.textContent='New game'; n.before(b);
  }
  show('s-title');
  lastT=performance.now();
  requestAnimationFrame(frame);
}
window.__romp={G,player,input,kb,MAPST,map:()=>showMap(-1),open:n=>{ G.open=n; mapViewSync(); mapBanner(); },at:i=>{ mapPlace(i); mapBanner(); },zoom:k=>{ mapZoom=k; },load:(i,cp)=>{ G.levelIdx=i; beginLevel(!!cp); },tp:(x,y)=>{ player.x=x; player.y=y; player.vx=player.vy=0; },form:f=>{ player.form=f; setSize(); },view:()=>({camX,camY,V,viewHalfW,W}),enemies:()=>enemies,items:()=>items,plats:()=>plats,step,solidAt,tileAt,L:()=>L,animate,updateCamera,info:()=>renderer.info.render};
if(hot&&hot.ready) hot.ready(boot); else boot((hot&&hot.data)||{});
