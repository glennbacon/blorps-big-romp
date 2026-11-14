/* ================= level loading ================= */
function loadLevel(idx,fromCp){
  disposeWorld();
  G.levelIdx=idx; L=LEVELS[idx](); W=L.W; tiles=L.tiles; M=themeMats(L.theme);
  /* each level in a world can restyle the sky and light a little, so five levels do not look like one */
  const base=THEMES[L.theme]; TH=Object.assign({},base,base.looks&&base.looks[L.stage]); GRAV=TH.grav||1;
  applyTheme();
  blockMesh.clear(); multi.clear(); enemies=[]; items=[]; shots=[]; bombs=[]; plats=[]; springs=[]; firebars=[]; bumps=[];
  for(const p of PARTS){ p.life=0; p.mesh.visible=false; }
  for(const s of POPS){ s.life=0; s.sp.visible=false; }
  for(const c of CPOPS){ c.t=-1; c.mesh.visible=false; }
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
  for(const p of PARTS){ if(p.life<=0) continue; p.life-=dt; if(p.life<=0){ p.mesh.visible=false; continue; }
    p.vy-=p.grav*dt; const m=p.mesh; m.position.x+=p.vx*dt; m.position.y+=p.vy*dt; m.position.z+=p.vz*dt; m.rotation.x+=dt*8; m.rotation.z+=dt*6; m.scale.setScalar(p.size*Math.min(1,p.life/p.max*2)); }
  for(const s of POPS){ if(s.life<=0) continue; s.life-=dt; if(s.life<=0){ s.sp.visible=false; continue; } s.sp.position.y+=dt*1.5; s.sp.material.opacity=Math.min(1,s.life*4); }
  for(const c of CPOPS){ if(c.t<0) continue; c.t+=dt;
    if(c.t>0.55){ c.t=-1; c.mesh.visible=false; popup(c.x,c.y+1.1,'200','#ffe14d'); continue; }
    c.mesh.position.set(c.x,c.y+13*c.t-20*c.t*c.t,0); c.mesh.rotation.y=c.t*26; }
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
function beginLevel(fromCp){
  G.bossSeen=false; G.bossDead=false;
  loadLevel(G.levelIdx,fromCp);
  G.state='card'; G.cardT=1.8; acc=0; input.jumpBuf=0; input.runEdge=false;
  $('card-eyebrow').textContent='World '+(L.world+1)+' \u00b7 Level '+(L.stage+1)+' of '+L.stages; $('card-name').textContent=L.name; $('card-lives').textContent=G.lives;
  show('s-card'); musicStop();
}
function newGame(level){ G.score=0; G.coins=0; G.lives=3; G.levelIdx=level||0; G.cp=false; player.form=0; beginLevel(false); }
function togglePause(){
  if(G.state==='play'){ G.state='pause'; show('s-pause'); musicPause(true); sfx.pause(); }
  else if(G.state==='pause'){ G.state='play'; show(null); musicPause(false); acc=0; }
}
function afterDeath(){
  G.lives--; player.form=0;
  if(G.lives<=0){ G.state='over'; show('s-over'); sfx.over(); }
  else beginLevel(G.cp);
}
function levelClear(){
  G.state='clear';
  $('clear-eyebrow').textContent='Level '+L.label+' clear'; $('clear-name').textContent=L.name; $('clear-score').textContent=G.score; $('clear-coins').textContent=G.coins;
  $('clear-note').hidden=!L.boss; $('btn-next').textContent=L.stage===L.stages-1?'Next world':'Next level';
  show('s-clear');
}
function showWin(){ G.state='win'; $('win-score').textContent=G.score; $('win-coins').textContent=G.coins; show('s-win'); }
function act(a){
  auInit();
  if(a==='start'||a==='again') newGame(0);
  else if(a==='continue'&&saved){ G.score=saved.score|0; G.coins=saved.coins|0; G.lives=Math.max(1,saved.lives|0); G.levelIdx=clamp(saved.level|0,0,LEVELS.length-1); G.cp=false; player.form=clamp(saved.form|0,0,2); beginLevel(false); }
  else if(a==='resume') togglePause();
  else if(a==='restart'){ G.cp=false; player.form=0; beginLevel(false); }
  else if(a==='next'){ G.levelIdx=Math.min(G.levelIdx+1,LEVELS.length-1); G.cp=false; beginLevel(false); }
  else if(a==='retry'){ const i=G.levelIdx; newGame(i); }
}
function primaryAction(){
  const a={title:'start',pause:'resume',clear:'next',over:'retry',win:'again'}[G.state];
  if(!a) return false; act(a); return true;
}
function toggleSound(){ setMuted(!AU.muted); const b=$('b-sound'); b.classList.toggle('off',AU.muted); b.setAttribute('aria-pressed',String(!AU.muted)); }
$('overlay').addEventListener('click',e=>{ const b=e.target.closest('[data-act]'); if(b){ b.blur(); act(b.dataset.act); } });
$('b-pause').addEventListener('click',e=>{ auInit(); e.currentTarget.blur(); togglePause(); });
$('b-sound').addEventListener('click',e=>{ auInit(); e.currentTarget.blur(); toggleSound(); });
document.addEventListener('visibilitychange',()=>{ if(document.hidden&&G.state==='play') togglePause(); });

/* ================= input ================= */
const kb={left:false,right:false,jump:false,run:false}, tk={left:false,right:false,jump:false,run:false};
const KEYS={ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',Space:'jump',ArrowUp:'jump',KeyW:'jump',KeyZ:'jump',KeyK:'jump',ShiftLeft:'run',ShiftRight:'run',KeyX:'run',KeyJ:'run'};
window.addEventListener('keydown',e=>{
  if(e.metaKey||e.ctrlKey||e.altKey) return;
  const k=KEYS[e.code];
  if(e.repeat){ if(k||e.code==='Enter') e.preventDefault(); return; }
  auInit();
  if(e.code==='Enter'||(e.code==='Space'&&G.state!=='play')){ e.preventDefault(); primaryAction(); return; }
  if(e.code==='KeyP'||e.code==='Escape'){ e.preventDefault(); togglePause(); return; }
  if(e.code==='KeyM'){ toggleSound(); return; }
  if(k){ kb[k]=true; e.preventDefault(); }
});
window.addEventListener('keyup',e=>{ const k=KEYS[e.code]; if(k){ kb[k]=false; e.preventDefault(); } });
window.addEventListener('blur',()=>{ kb.left=kb.right=kb.jump=kb.run=false; });
function pollInput(){
  const j=kb.jump||tk.jump, r=kb.run||tk.run;
  if(j&&!input.jump) input.jumpBuf=0.11;
  if(r&&!input.run) input.runEdge=true;
  input.jump=j; input.run=r; input.left=kb.left||tk.left; input.right=kb.right||tk.right;
}
const padMove=$('pad-move'), padAct=$('pad-act'), keyA=$('key-a'), keyB=$('key-b'), keyL=padMove.children[0], keyR=padMove.children[1];
function evalTouches(ev){
  let l=false,r=false,a=false,b=false;
  const rm=padMove.getBoundingClientRect(), rp=padAct.getBoundingClientRect(), ra=keyA.getBoundingClientRect(), rb=keyB.getBoundingClientRect();
  const ax=ra.left+ra.width/2, ay=ra.top+ra.height/2, bx=rb.left+rb.width/2, by=rb.top+rb.height/2, rad=ra.width/2+26;
  const mid=(rm.right+rp.left)/2; /* a thumb left of this line only steers, right of it only acts */
  for(let i=0;i<ev.touches.length;i++){ const t=ev.touches[i], x=t.clientX, y=t.clientY;
    if(x<mid){ if(x>rm.left-40&&y>rm.top-48&&y<rm.bottom+48){ if(x<rm.left+rm.width/2) l=true; else r=true; } }
    else { if(Math.hypot(x-ax,y-ay)<rad) a=true; if(Math.hypot(x-bx,y-by)<rad) b=true; } }
  tk.left=l; tk.right=r; tk.jump=a; tk.run=b;
  keyL.classList.toggle('on',l); keyR.classList.toggle('on',r); keyA.classList.toggle('on',a); keyB.classList.toggle('on',b);
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
    for(const k of [keyL,keyR,keyA,keyB]) top=Math.min(top,k.getBoundingClientRect().top);
    const n=clamp(1-2*(sb-top+6)/sh,0.1,1);
    lift=Math.min(lift,n*V/(2*(Math.cos(0.19)-n*Math.sin(0.19)*Math.tan(15*Math.PI/180))));
  }
  camBaseY=2+lift;
  if(scene.fog&&TH){ scene.fog.near=camDist+TH.fogNear; scene.fog.far=camDist+TH.fogFar; }
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
  if(G.state!=='pause'){ G.time+=dt; animate(dt,G.time); updateCamera(dt,false); }
  updateHud();
  renderer.render(scene,camera);
}

/* Keep progress when the page is republished while open. */
const hot=window.claude&&window.claude.hot;
if(hot&&hot.snapshot){ try{ hot.snapshot(()=>({level:G.levelIdx,score:G.score,coins:G.coins,lives:G.lives,form:player.form,playing:G.state!=='title'})); }catch(e){} }
function boot(data){
  layout();
  loadLevel(0,false);
  if(data&&data.playing){ saved=data; const b=$('btn-continue'); b.hidden=false; b.textContent='Continue at '+LABELS[clamp(data.level|0,0,LEVELS.length-1)]; }
  show('s-title');
  lastT=performance.now();
  requestAnimationFrame(frame);
}
window.__romp={G,player,input,kb,load:(i,cp)=>{ G.levelIdx=i; beginLevel(!!cp); },tp:(x,y)=>{ player.x=x; player.y=y; player.vx=player.vy=0; },form:f=>{ player.form=f; setSize(); },view:()=>({camX,camY,V,viewHalfW,W}),enemies:()=>enemies,items:()=>items,plats:()=>plats,step,solidAt,tileAt,L:()=>L,animate,updateCamera,info:()=>renderer.info.render};
if(hot&&hot.ready) hot.ready(boot); else boot((hot&&hot.data)||{});
