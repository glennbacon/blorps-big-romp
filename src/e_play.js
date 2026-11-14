/* ================= play: physics and rules ================= */
/* Speeds are the NES Super Mario Bros. values converted from pixels per frame to tiles per second. */
const WALK_MAX=5.86,RUN_MAX=9.61,WALK_ACC=8.35,RUN_ACC=12.5,REL_DEC=11.4,SKID_DEC=22.9,MIN_V=0.28,MAX_FALL=15,STEP=1/120;
const G={state:'title',levelIdx:0,score:0,coins:0,lives:3,cp:false,time:0,bossDead:false,bossSeen:false,winT:0,cardT:0,goalT:0,fountain:0};
const input={left:false,right:false,jump:false,run:false,jumpBuf:0,runEdge:false};
const player={x:3.5,y:2,vx:0,vy:0,w:0.7,h:0.9,form:0,prevForm:0,face:1,onGround:true,jumping:false,coyote:0,inv:0,star:0,dead:false,deadT:0,goal:null,
  walkPh:0,idleT:0,combo:0,riding:null,gHold:28.125,gFall:98.4,airMax:WALK_MAX,springHold:false,growT:0,fireCool:0,skid:false,squash:0};
const COMBO=[100,200,400,800,1000,2000,4000,8000];

function setSize(){ player.h=player.form>0?1.75:0.9; }
function resetPlayer(x,y){
  const p=player; p.x=x; p.y=y; p.vx=0; p.vy=0; p.face=1; p.onGround=true; p.jumping=false; p.coyote=0; p.inv=0; p.star=0; p.dead=false; p.deadT=0; p.goal=null;
  p.walkPh=0; p.idleT=0; p.combo=0; p.riding=null; p.springHold=false; p.growT=0; p.fireCool=0; p.skid=false; p.squash=0; p.gHold=28.125; p.gFall=98.4; p.airMax=WALK_MAX;
  setSize(); proot.visible=true; proot.rotation.set(0,0.95,0); camLead=1.5; focusY=y;
}
function addScore(n,x,y){ G.score+=n; if(x!==undefined) popup(x,y+0.45,String(n)); }
function gainLife(x,y){ G.lives++; popup(x,y+0.6,'1UP','#7dffb0'); sfx.oneup(); }
function addCoin(){ G.coins++; if(G.coins>=100){ G.coins-=100; gainLife(player.x,player.y+player.h); } }
function comboScore(x,y){ const p=player; if(p.combo>=COMBO.length) gainLife(x,y); else addScore(COMBO[p.combo],x,y); p.combo++; }

/* ---------- tile collision ---------- */
function moveX(e,dx){
  if(!dx) return false;
  e.x+=dx; const y0=Math.floor(e.y+0.02), y1=Math.floor(e.y+e.h-0.02);
  if(dx>0){ const tx=Math.floor(e.x+e.w/2); for(let ty=y0;ty<=y1;ty++) if(solidAt(tx,ty)){ e.x=tx-e.w/2-0.001; return true; } }
  else { const tx=Math.floor(e.x-e.w/2); for(let ty=y0;ty<=y1;ty++) if(solidAt(tx,ty)){ e.x=tx+1+e.w/2+0.001; return true; } }
  return false;
}
function moveY(e,dy){
  const py=e.y; e.y+=dy; const x0=Math.floor(e.x-e.w/2+0.002), x1=Math.floor(e.x+e.w/2-0.002);
  if(dy<=0){ const ty=Math.floor(e.y); for(let tx=x0;tx<=x1;tx++) if(solidAt(tx,ty)||(semiAt(tx,ty)&&py>=ty+0.999)){ e.y=ty+1; return 1; } }
  else { const ty=Math.floor(e.y+e.h); for(let tx=x0;tx<=x1;tx++) if(solidAt(tx,ty)){ e.y=ty-e.h-0.001; return 2; } }
  return 0;
}

/* ---------- blocks ---------- */
function bumpAnim(key){ const m=blockMesh.get(key); if(!m) return; for(const b of bumps) if(b.mesh===m){ b.t=0; return; } bumps.push({mesh:m,t:0,y:Math.floor(key/W)+0.5}); }
function makeUsed(tx,ty){ const k=ty*W+tx; tiles[k]=USED; const m=blockMesh.get(k); if(m) m.material=usedArr; }
function collectCoin(tx,ty){
  const k=ty*W+tx; if(tiles[k]!==COIN) return; tiles[k]=AIR; const i=coinIdx.get(k); if(i!==undefined) coinPos[i].on=false;
  addCoin(); G.score+=200; sfx.coin(); burst(tx+0.5,ty+0.5,'#fff0a8',4,2.5,0.09,0.3);
}
function spawnItem(kind,tx,ty){
  const f={muffin:mMuffin,chili:mChili,star:mStar,heart:mHeart}[kind];
  const it={kind,x:tx+0.5,y:ty,baseY:ty,vx:0,vy:0,w:0.7,h:0.7,emerge:0.7,mesh:vmesh(kind,f)};
  it.mesh.position.set(it.x,it.y,0); world.add(it.mesh); items.push(it); sfx.sprout();
}
function releaseContent(tx,ty,c){
  if(c==='coin'){ addCoin(); G.score+=200; coinPop(tx+0.5,ty+1.2); sfx.coin(); }
  else if(c==='power') spawnItem(player.form===0?'muffin':'chili',tx,ty);
  else if(c==='star') spawnItem('star',tx,ty);
  else if(c==='life') spawnItem('heart',tx,ty);
}
function hitAbove(tx,ty){
  for(const e of enemies){ if(!e.active||e.dead||e.gone||e.type==='boss'||e.type==='chomper') continue;
    if(e.y>=ty+0.9&&e.y<ty+1.35&&Math.abs(e.x-(tx+0.5))<0.5+e.w/2){ killEnemy(e,'flip',sgn(e.x-player.x)); addScore(100,e.x,e.y+e.h); } }
  for(const it of items){ if(it.emerge<=0&&it.y>=ty+0.9&&it.y<ty+1.3&&Math.abs(it.x-(tx+0.5))<0.85){ it.vy=9; if(it.vx) it.vx=Math.abs(it.vx)*sgn(it.x-(tx+0.5)); } }
  if(tileAt(tx,ty+1)===COIN) collectCoin(tx,ty+1);
}
function breakBrick(tx,ty){
  const k=ty*W+tx; tiles[k]=AIR; const m=blockMesh.get(k); if(m){ world.remove(m); blockMesh.delete(k); }
  for(const b of bumps) if(b.mesh===m) b.t=9;
  addScore(50); sfx.brk(); shake(0.12);
  const c=TH.brick;
  for(let i=0;i<8;i++) spawnPart(tx+0.25+(i%2)*0.5,ty+0.25+((i>>1)%2)*0.5,(i>>2)*0.5-0.25,c[i%3],(i%2?1:-1)*(2+Math.random()*2.5),7+Math.random()*5,(Math.random()-0.5)*4,0.9,0.3,36);
}
function bumpBlock(tx,ty){
  const id=tileAt(tx,ty), k=ty*W+tx, p=player;
  if(id===BRICK){
    const c=L.contents.get(k);
    if(c==='multi'){ let n=multi.has(k)?multi.get(k):8; n--; multi.set(k,n); releaseContent(tx,ty,'coin'); if(n<=0) makeUsed(tx,ty); bumpAnim(k); hitAbove(tx,ty); }
    else if(c){ releaseContent(tx,ty,c); makeUsed(tx,ty); bumpAnim(k); hitAbove(tx,ty); }
    else if(p.form>0){ hitAbove(tx,ty); breakBrick(tx,ty); }
    else { bumpAnim(k); hitAbove(tx,ty); sfx.bump(); }
  } else if(id===QBLOCK||id===HIDDEN){
    const c=L.contents.get(k)||'coin';
    if(id===HIDDEN) addBlock(tx,ty,USED);
    makeUsed(tx,ty); releaseContent(tx,ty,c); bumpAnim(k); hitAbove(tx,ty);
  } else sfx.bump();
}

/* ---------- player ---------- */
function doJump(){
  const p=player, sp=Math.abs(p.vx);
  if(sp<3.75){ p.vy=15.5; p.gHold=28.125; p.gFall=98.4; }
  else if(sp<8.67){ p.vy=15.5; p.gHold=26.37; p.gFall=84.4; }
  else { p.vy=19; p.gHold=35.16; p.gFall=126.6; }
  p.jumping=true; p.onGround=false; p.coyote=0; p.riding=null; p.springHold=false; input.jumpBuf=0;
  p.airMax=sp>WALK_MAX+0.2?RUN_MAX:WALK_MAX; sfx.jump(p.form>0);
}
function playerUp(p,dy){
  const prevTop=p.y+p.h; p.y+=dy;
  const ty=Math.floor(p.y+p.h), xl=p.x-p.w/2, xr=p.x+p.w/2, txl=Math.floor(xl+0.002), txr=Math.floor(xr-0.002);
  const hs=tx=>solidAt(tx,ty)||(tileAt(tx,ty)===HIDDEN&&prevTop<=ty+0.02);
  const sl=hs(txl), sr=txr!==txl&&hs(txr);
  if(!sl&&!sr) return;
  /* clipping a block's corner slides you around it, as in the original */
  if(sl&&!sr&&txr!==txl){ const ov=txl+1-xl; if(ov<0.26){ p.x+=ov+0.003; return; } }
  if(sr&&!sl){ const ov=xr-txr; if(ov<0.26){ p.x-=ov+0.003; return; } }
  p.y=ty-p.h-0.001; p.vy=-1; p.jumping=false; p.springHold=false;
  const tc=Math.floor(p.x); bumpBlock(hs(tc)?tc:(sl?txl:txr),ty);
}
function hurtPlayer(){
  const p=player; if(p.inv>0||p.star>0||p.dead||p.goal||G.bossDead) return;
  if(p.form>0){ p.prevForm=p.form; p.form=p.form===2?1:0; setSize(); p.inv=2.2; p.growT=0.5; sfx.hurt(); }
  else killPlayer();
}
function killPlayer(){
  const p=player; if(p.dead) return;
  p.dead=true; p.deadT=0; p.vy=15; p.vx=0; p.star=0; p.riding=null; musicStop(); sfx.die();
}
function shoot(){
  const p=player; if(shots.length>=2) return;
  p.fireCool=0.2; const m=new T.Mesh(partGeo,fireMat); m.scale.setScalar(0.3); world.add(m);
  shots.push({x:p.x+p.face*0.45,y:p.y+p.h*0.5,vx:p.face*13,vy:-2,life:2.5,mesh:m}); sfx.fire();
}
function collectItem(it){
  const p=player; it.gone=true;
  if(it.kind==='muffin'){ if(p.form===0){ p.prevForm=0; p.form=1; setSize(); p.growT=0.6; } addScore(1000,it.x,it.y+0.6); sfx.power(); }
  else if(it.kind==='chili'){ if(p.form!==2){ p.prevForm=p.form; p.form=2; setSize(); p.growT=0.6; } addScore(1000,it.x,it.y+0.6); sfx.power(); }
  else if(it.kind==='star'){ p.star=10; addScore(1000,it.x,it.y+0.6); sfx.power(); musicRate(1.35); }
  else gainLife(it.x,it.y+0.4);
  burst(it.x,it.y+0.4,'#fff3a0',8,4,0.12,0.5);
}
function startGoal(){
  const p=player, gx=L.goal.x;
  p.goal='slide'; p.vx=0; p.vy=0; p.x=gx+0.5-0.4; p.y=clamp(p.y,3,11.2); p.star=0; p.inv=0; p.face=1; p.riding=null; p.onGround=false;
  const hgt=p.y-3; addScore(hgt>=7?5000:hgt>=5?2000:hgt>=3?800:hgt>=1.5?400:100,p.x,p.y+p.h);
  musicStop(); sfx.slide(); G.goalT=0;
}
function updateGoal(dt){
  const p=player, gx=L.goal.x;
  if(p.goal==='slide'){
    p.y=Math.max(3,p.y-7*dt); if(flagMesh) flagMesh.position.y=Math.max(3.3,flagMesh.position.y-7*dt);
    if(p.y<=3&&(!flagMesh||flagMesh.position.y<=3.3)){ G.goalT+=dt; if(G.goalT>0.35){ p.goal='walk'; p.x=gx+1.2; sfx.clear(); } }
  } else if(p.goal==='walk'){
    p.vx=4; p.vy-=60*dt; if(p.vy<-MAX_FALL) p.vy=-MAX_FALL; moveX(p,p.vx*dt);
    if(moveY(p,p.vy*dt)===1){ p.vy=0; p.onGround=true; } else p.onGround=false;
    if(p.x>=gx+6.5){ p.goal='in'; p.vx=0; proot.visible=false; burst(p.x,p.y+0.6,'#ffe14d',14,5,0.14,0.7); G.goalT=0; }
  } else { G.goalT+=dt; if(G.goalT>1.5){ p.goal='done'; levelClear(); } }
}
function updatePlayer(dt){
  const p=player;
  if(p.dead){ p.deadT+=dt; if(p.deadT>0.35){ p.vy-=45*dt; p.y+=p.vy*dt; } if(p.deadT>2.5){ p.deadT=-99; afterDeath(); } return; }
  if(p.goal){ if(p.goal!=='done') updateGoal(dt); return; }
  p.inv=Math.max(0,p.inv-dt); p.growT=Math.max(0,p.growT-dt); p.fireCool=Math.max(0,p.fireCool-dt);
  if(p.star>0){ p.star-=dt; if(p.star<=0){ p.star=0; musicRate(G.bossSeen?1.12:1); } }
  if(p.riding){ const pl=p.riding; if(pl.dx) moveX(p,pl.dx); p.y+=pl.dy; }

  const dir=(input.right?1:0)-(input.left?1:0), run=input.run, maxV=run?RUN_MAX:WALK_MAX;
  if(p.onGround){
    /* on ice Blorp speeds up slowly and barely slows down */
    const ice=tileAt(Math.floor(p.x),Math.floor(p.y-0.5))===ICE, grip=ice?0.14:1, push=ice?0.55:1;
    if(dir){
      if(p.vx*dir<-0.01){ p.vx+=dir*SKID_DEC*(ice?0.3:1)*dt; p.skid=Math.abs(p.vx)>1.5; }
      else { p.skid=false; if(Math.abs(p.vx)<MIN_V) p.vx=dir*MIN_V;
        if(Math.abs(p.vx)<=maxV){ p.vx+=dir*(run?RUN_ACC:WALK_ACC)*push*dt; if(Math.abs(p.vx)>maxV) p.vx=dir*maxV; }
        else { p.vx-=dir*REL_DEC*grip*dt; if(Math.abs(p.vx)<maxV) p.vx=dir*maxV; } }
      p.face=dir;
    } else { p.skid=false; const s=Math.abs(p.vx)-REL_DEC*grip*dt; p.vx=s>0?sgn(p.vx)*s:0; }
  } else if(dir){
    p.vx+=dir*((p.vx*dir<0||Math.abs(p.vx)>=WALK_MAX)?RUN_ACC:WALK_ACC)*dt;
    if(Math.abs(p.vx)>p.airMax) p.vx=sgn(p.vx)*p.airMax;
    p.face=dir;
  }
  if(dir||!p.onGround||Math.abs(p.vx)>0.1) p.idleT=0; else p.idleT+=dt;

  if(p.onGround) p.coyote=0.09; else p.coyote=Math.max(0,p.coyote-dt);
  if(input.jumpBuf>0&&p.coyote>0) doJump();
  input.jumpBuf=Math.max(0,input.jumpBuf-dt);
  if(input.runEdge){ input.runEdge=false; if(p.form===2&&p.fireCool<=0) shoot(); }

  const hold=p.vy>0&&(p.springHold||(p.jumping&&input.jump));
  p.vy-=(hold?p.gHold:p.gFall)*GRAV*dt; if(p.vy<=0) p.springHold=false; if(p.vy<-MAX_FALL) p.vy=-MAX_FALL;

  /* a tall Blorp who ends up inside a low gap is nudged out instead of sticking */
  if(p.form>0&&solidAt(Math.floor(p.x),Math.floor(p.y+p.h-0.25))){ p.x+=p.face*3*dt; p.vx=0; }
  else if(moveX(p,p.vx*dt)) p.vx=0;

  const prevY=p.y, fallV=p.vy; let landed=false;
  if(p.vy>0) playerUp(p,p.vy*dt); else if(moveY(p,p.vy*dt)===1) landed=true;
  p.riding=null;
  if(p.vy<=0) for(const pl of plats){
    if(p.x+p.w/2>pl.x+0.05&&p.x-p.w/2<pl.x+pl.w-0.05&&prevY>=pl.y-0.16&&p.y<=pl.y){ p.y=pl.y; landed=true; p.riding=pl; break; } }
  if(landed){
    if(!p.onGround){ p.squash=1; if(fallV<-9) burst(p.x,p.y+0.05,'#ffffff',4,2,0.08,0.3); }
    p.onGround=true; p.vy=0; p.jumping=false; p.combo=0;
  } else { if(p.onGround) p.airMax=Math.abs(p.vx)>WALK_MAX+0.2?RUN_MAX:WALK_MAX; p.onGround=false; }

  for(const s of springs){
    if(p.vy<=0&&!p.onGround&&Math.abs(p.x-s.x)<0.78&&p.y<=s.y+0.62&&p.y>=s.y+0.12){
      p.y=s.y+0.6; p.vy=22; p.springHold=true; p.jumping=true; p.gHold=28.125; p.gFall=98.4; p.riding=null; p.combo=0; s.t=0.35; sfx.spring(); } }

  const x0=Math.floor(p.x-p.w/2), x1=Math.floor(p.x+p.w/2), y0=Math.floor(p.y+0.05), y1=Math.floor(p.y+p.h-0.05);
  for(let ty=y0;ty<=y1;ty++) for(let tx=x0;tx<=x1;tx++){
    const id=tileAt(tx,ty);
    if(id===COIN) collectCoin(tx,ty);
    else if(id===SPIKE&&p.y<ty+0.55&&p.x+p.w/2>tx+0.14&&p.x-p.w/2<tx+0.86) hurtPlayer();
  }
  const cp=L.checkpoint;
  if(cp&&!G.cp&&p.x>cp.x-0.2){ G.cp=true; if(cpFlag) cpFlag.material.color.set(0x2fd6c3); sfx.check(); popup(cp.x,cp.y+2.6,'Checkpoint','#7dffe6'); burst(cp.x,cp.y+1.6,'#2fd6c3',10,4,0.12,0.6); }
  if(L.goal&&p.x<L.goal.x+1&&(p.x+p.w/2>=L.goal.x+0.43||(p.y<3&&p.x+p.w/2>=L.goal.x-0.01))) startGoal(); /* walking into the pole's base counts too */
  if(L.boss&&!G.bossSeen&&p.x>L.boss.x0-6){ G.bossSeen=true; musicRate(1.12); popup(p.x+3,7.5,'King Grump!','#ffc928'); }
  if(p.y<L.liquidY-0.75&&!p.dead){ burst(p.x,L.liquidY,TH.liquid[1],12,5,0.16,0.7); p.y=L.liquidY-0.8; killPlayer(); }
}

/* ---------- enemies ---------- */
function spawnEnemy(d){
  const e={type:d.type,x:d.x,y:d.y,vx:0,vy:0,w:0.8,h:0.8,active:false,dead:false,gone:false,flip:false,deadT:0,onGround:false,t:Math.random()*6,stomp:true,fly:false};
  if(d.type==='blob') e.vx=-1.9;
  else if(d.type==='shellby'){ e.vx=-1.7; e.h=0.9; e.shell=false; e.kick=0; e.shellT=0; e.chain=0; }
  else if(d.type==='spikit'){ e.vx=-1.6; e.h=0.75; e.stomp=false; }
  else if(d.type==='batty'){ e.ox=d.x; e.oy=d.y; e.rx=d.rx||3; e.ry=d.ry||1; e.sp=d.sp||1.3; e.h=0.7; e.fly=true; }
  else if(d.type==='boing') e.wait=0.8;
  else if(d.type==='chomper'){ e.top=d.y; e.h=1.3; e.ext=0; e.ph=Math.random(); e.cy=0; e.stomp=false; e.fly=true; }
  else if(d.type==='prickle'){ e.h=1.3; e.stomp=false; e.throwT=1+Math.random()*1.5; e.aim=false; }
  else if(d.type==='icicle'){ e.w=0.6; e.h=1; e.stomp=false; e.fly=true; e.st=0; e.shakeT=0; }
  else if(d.type==='boss'){ e.w=2.2; e.h=2.4; e.hp=d.hp||9; e.hp0=e.hp; e.inv=0; e.jumpT=2.2; e.throwT=1.6; e.x0=d.x0; e.x1=d.x1; e.vx=-1.4; e.t=0; }
  e.mesh=makeEnemy(d.type); e.mesh.position.set(e.x,e.type==='chomper'?e.top-1.55:e.y,0); world.add(e.mesh); enemies.push(e); return e;
}
function killEnemy(e,how,dir){
  if(e.dead) return; e.dead=true;
  if(how==='squish'&&!e.fly){ e.flip=false; e.deadT=0.45; e.mesh.scale.set(1.25,0.28,1.25); sfx.stomp(); }
  else { e.flip=true; if(how==='squish'){ e.vy=1; e.vx=0; sfx.stomp(); } else { e.vy=9; e.vx=(dir||1)*3; sfx.kick(); } if(e.type==='chomper') e.y=e.top; }
  burst(e.x,e.y+e.h*0.5,WHITE,5,3,0.1,0.35);
}
function walk(e,dt){
  e.vy-=55*dt; if(e.vy<-MAX_FALL) e.vy=-MAX_FALL;
  let hit=false; if(e.vx&&moveX(e,e.vx*dt)){ e.vx=-e.vx; hit=true; }
  const r=moveY(e,e.vy*dt); if(r===1){ e.vy=0; e.onGround=true; } else { if(r===2) e.vy=0; e.onGround=false; }
  return hit;
}
function toShell(e){ e.shell=true; e.vx=0; e.h=0.62; e.shellT=0; e.kick=0.25; e.chain=0; const u=e.mesh.userData; u.slug.visible=false; u.shell.position.set(0,0,0); }
function fromShell(e){ e.shell=false; e.vx=player.x<e.x?-1.7:1.7; e.h=0.9; const u=e.mesh.userData; u.slug.visible=true; u.shell.position.set(0,1.4*S8,-0.9*S8); e.mesh.rotation.set(0,0,0); }
function throwBomb(e){
  const p=player, m=vmesh('bomb',mBomb); m.scale.setScalar(1.15); world.add(m);
  bombs.push({x:e.x,y:e.y+e.h,vx:clamp((p.x-e.x)/1.05,-9,9),vy:11,mesh:m,gone:false}); sfx.fire();
}
function throwSeed(e){
  const p=player, m=vmesh('seed',mSeed); world.add(m);
  bombs.push({x:e.x,y:e.y+e.h+0.2,vx:clamp(p.x-e.x,-7,7),vy:9.5,mesh:m,gone:false}); if(Math.abs(e.x-camX)<viewHalfW+1) sfx.spit();
}
function damageBoss(e,n){
  if(e.inv>0||e.dead) return;
  e.hp-=n; e.inv=n>=3?1.1:0.3; sfx.bossHit(); shake(0.2); burst(e.x,e.y+e.h*0.6,'#ffc928',10,5,0.16,0.6);
  if(e.hp<=0){
    e.dead=true; e.flip=true; e.vy=13; e.vx=0; G.bossDead=true; G.winT=0; G.fountain=0; G.bossX=e.x; addScore(5000,e.x,e.y+e.h);
    for(const b of bombs) b.gone=true; musicStop(); sfx.win(); shake(0.4);
    for(let i=0;i<4;i++) burst(e.x+(Math.random()-0.5)*2,e.y+1+Math.random()*1.5,pick(Math.random,['#7d3fd1','#ffc928','#ff4f7b','#ffffff']),10,7,0.2,1);
  }
}
function updateEnemies(dt){
  const p=player; let anyGone=false;
  for(const e of enemies){
    if(e.gone){ anyGone=true; continue; }
    if(!e.active){ if(Math.abs(e.x-camX)<viewHalfW+2.5) e.active=true; else continue; }
    if(e.dead){ if(e.flip){ e.vy-=45*dt; e.x+=e.vx*dt; e.y+=e.vy*dt; if(e.y<-7) e.gone=true; } else { e.deadT-=dt; if(e.deadT<=0) e.gone=true; } continue; }
    e.t+=dt;
    if(e.type==='blob'||e.type==='spikit') walk(e,dt);
    else if(e.type==='shellby'){
      e.kick=Math.max(0,e.kick-dt);
      const hit=walk(e,dt);
      if(e.shell){
        if(e.vx){ e.shellT=0; if(hit&&Math.abs(e.x-camX)<viewHalfW+1) sfx.bump();
          for(const o of enemies){ if(o===e||!o.active||o.dead||o.gone) continue; if(o.type==='chomper'&&o.ext<0.3) continue;
            const oy=o.type==='chomper'?o.top:o.y;
            if(Math.abs(o.x-e.x)<(o.w+e.w)/2&&oy<e.y+e.h&&oy+o.h>e.y){
              if(o.type==='boss'){ damageBoss(o,3); killEnemy(e,'flip',-sgn(e.vx)); break; }
              killEnemy(o,'flip',sgn(e.vx)); addScore([500,800,1000,2000,4000,8000][Math.min(e.chain,5)],o.x,oy+o.h); e.chain++; } }
        } else { e.shellT+=dt; if(e.shellT>7) fromShell(e); }
      }
    }
    else if(e.type==='batty'){ e.x=e.ox+Math.sin(e.t*e.sp)*e.rx; e.y=e.oy+Math.sin(e.t*e.sp*2)*e.ry; }
    else if(e.type==='prickle'){
      /* stays put and lobs a seed at Blorp every few seconds */
      walk(e,dt); e.aim=Math.abs(p.x-e.x)<10&&!p.dead&&!p.goal;
      e.throwT-=dt; if(e.throwT<=0){ if(e.aim){ e.throwT=2.6; throwSeed(e); } else e.throwT=0.5; }
    }
    else if(e.type==='icicle'){
      /* hangs until Blorp walks underneath, wobbles, then drops and shatters */
      if(e.st===0){ if(Math.abs(p.x-e.x)<1.8&&p.y<e.y&&!p.dead){ e.st=1; e.shakeT=0.3; } }
      else if(e.st===1){ e.shakeT-=dt; if(e.shakeT<=0) e.st=2; }
      else { e.vy-=40*dt; if(e.vy<-MAX_FALL) e.vy=-MAX_FALL; const py=e.y; e.y+=e.vy*dt; const tx=Math.floor(e.x), ty=Math.floor(e.y);
        if(solidAt(tx,ty)||(semiAt(tx,ty)&&py>=ty+0.999)){ e.gone=true; burst(e.x,ty+1.1,'#dcf6ff',8,4,0.12,0.4); if(Math.abs(e.x-camX)<viewHalfW) sfx.shatter(); } }
    }
    else if(e.type==='boing'){
      if(e.onGround){ e.vx=0; e.wait-=dt; if(e.wait<=0){ e.vy=13; e.vx=(p.x<e.x?-1:1)*2.6; e.wait=1+Math.random()*0.7; e.onGround=false; } }
      const vx=e.vx; walk(e,dt); if(!e.onGround&&e.vx===-vx&&vx) e.vx=0;
    }
    else if(e.type==='chomper'){
      e.ph+=dt; e.y=e.top;
      if(e.cy===0){ if(e.ph>1.6&&Math.abs(p.x-e.x)>1.7){ e.cy=1; e.ph=0; } }
      else if(e.cy===1){ e.ext=Math.min(1,e.ph/0.6); if(e.ph>=0.6){ e.cy=2; e.ph=0; } }
      else if(e.cy===2){ if(e.ph>1.5){ e.cy=3; e.ph=0; } }
      else { e.ext=Math.max(0,1-e.ph/0.6); if(e.ph>=0.6){ e.cy=0; e.ph=0; } }
    }
    else if(e.type==='boss'){
      e.inv=Math.max(0,e.inv-dt);
      const rage=(e.hp0-e.hp)/e.hp0;
      if(e.onGround){
        e.vx+=((p.x<e.x?-1:1)*(1.5+rage*1.7)-e.vx)*Math.min(1,dt*3);
        e.jumpT-=dt; if(e.jumpT<=0){ e.vy=13+rage*3; e.jumpT=2.5-rage+Math.random()*0.7; e.onGround=false; }
      }
      e.throwT-=dt; if(e.throwT<=0&&Math.abs(p.x-e.x)<15&&!p.dead){ e.throwT=2.9-rage*1.3; throwBomb(e); }
      e.vy-=40*dt; if(e.vy<-MAX_FALL) e.vy=-MAX_FALL;
      moveX(e,e.vx*dt); e.x=clamp(e.x,e.x0,e.x1);
      const wasAir=!e.onGround, fv=e.vy, r=moveY(e,e.vy*dt);
      if(r===1){ if(wasAir&&fv<-8){ shake(0.3); sfx.thud(); burst(e.x,e.y,'#cfcfe0',8,4,0.14,0.5); } e.vy=0; e.onGround=true; } else { if(r===2) e.vy=0; e.onGround=false; }
    }
    if(e.y<-6) e.gone=true;
  }
  /* walkers turn around when they meet */
  for(let i=0;i<enemies.length;i++){ const a=enemies[i]; if(!a.active||a.dead||a.fly||a.type==='boss'||a.type==='boing'||a.shell) continue;
    for(let j=i+1;j<enemies.length;j++){ const b=enemies[j]; if(!b.active||b.dead||b.fly||b.type==='boss'||b.type==='boing'||b.shell) continue;
      if(Math.abs(a.x-b.x)<(a.w+b.w)/2&&Math.abs(a.y-b.y)<0.6){ const l=a.x<b.x?a:b, r=l===a?b:a; if(l.vx>0) l.vx=-l.vx; if(r.vx<0) r.vx=-r.vx; } } }
  if(anyGone){ for(const e of enemies) if(e.gone) world.remove(e.mesh); enemies=enemies.filter(e=>!e.gone); }
}
function stompBounce(top){ const p=player; p.y=top; p.vy=15; p.jumping=true; p.springHold=false; p.gHold=28.125; p.gFall=98.4; p.onGround=false; }
function playerVsEnemies(){
  const p=player; if(p.dead||p.goal) return;
  for(const e of enemies){
    if(!e.active||e.dead||e.gone) continue;
    const isCh=e.type==='chomper'; if(isCh&&e.ext<0.3) continue;
    const ey=isCh?e.top:e.y, eh=isCh?e.ext*1.4:e.h;
    if(!(Math.abs(p.x-e.x)<(p.w+e.w)/2-0.06&&p.y<ey+eh&&p.y+p.h>ey)) continue;
    if(p.star>0){ if(e.type==='boss') damageBoss(e,3); else { killEnemy(e,'flip',sgn(e.x-p.x)); comboScore(e.x,ey+eh); } continue; }
    const above=p.vy<0&&p.y>ey+eh*0.4;
    if(e.type==='shellby'&&e.shell){
      if(e.vx===0){ if(e.kick<=0){ e.vx=(p.x<e.x?1:-1)*10; e.kick=0.3; e.chain=0; sfx.kick(); addScore(400,e.x,e.y+e.h); if(above){ p.y=ey+eh; p.vy=8; } } }
      else if(above){ e.vx=0; e.kick=0.3; stompBounce(ey+eh); sfx.stomp(); comboScore(e.x,ey+eh); }
      else if(e.kick<=0) hurtPlayer();
      continue;
    }
    if(e.type==='boss'){
      if(above){ stompBounce(ey+eh); if(e.inv<=0){ damageBoss(e,3); } }
      else if(e.inv<0.6) hurtPlayer();
      continue;
    }
    if(above&&e.stomp){
      stompBounce(ey+eh);
      if(e.type==='shellby'){ toShell(e); sfx.stomp(); } else killEnemy(e,'squish');
      comboScore(e.x,ey+eh);
    } else hurtPlayer();
  }
}

/* ---------- things that move on their own ---------- */
function updateItems(dt){
  const p=player; let any=false;
  for(const it of items){
    if(it.emerge>0){ it.emerge-=dt; it.y=it.baseY+(1-Math.max(0,it.emerge)/0.7);
      if(it.emerge<=0){ it.y=it.baseY+1; if(it.kind==='muffin'||it.kind==='heart') it.vx=3.2; else if(it.kind==='star'){ it.vx=4.2; it.vy=10; } } }
    else { it.vy-=(it.kind==='star'?40:60)*dt; if(it.vy<-MAX_FALL) it.vy=-MAX_FALL;
      if(it.vx&&moveX(it,it.vx*dt)) it.vx=-it.vx;
      const r=moveY(it,it.vy*dt); if(r===1) it.vy=it.kind==='star'?12:0; else if(r===2) it.vy=0; }
    if(it.emerge<0.25&&!p.dead&&!p.goal&&Math.abs(p.x-it.x)<(p.w+it.w)/2&&p.y<it.y+it.h&&p.y+p.h>it.y) collectItem(it);
    if(it.y<-3) it.gone=true;
    if(it.gone) any=true;
  }
  if(any){ for(const it of items) if(it.gone) world.remove(it.mesh); items=items.filter(it=>!it.gone); }
}
function updateShots(dt){
  let any=false;
  for(const s of shots){
    s.life-=dt; s.vy-=50*dt; if(s.vy<-14) s.vy=-14;
    s.x+=s.vx*dt;
    if(solidAt(Math.floor(s.x),Math.floor(s.y))){ s.life=0; burst(s.x,s.y,'#ffb347',5,3,0.1,0.3); }
    else {
      const py=s.y; s.y+=s.vy*dt; const tx=Math.floor(s.x), ty=Math.floor(s.y-0.15);
      if(s.vy<0&&(solidAt(tx,ty)||(semiAt(tx,ty)&&py-0.15>=ty+0.99))){ s.y=ty+1.15; s.vy=8.5; }
      if(s.y<-2||Math.abs(s.x-camX)>viewHalfW+3) s.life=0;
      for(const e of enemies){
        if(!e.active||e.dead||e.gone) continue; const isCh=e.type==='chomper'; if(isCh&&e.ext<0.3) continue;
        const ey=isCh?e.top:e.y, eh=isCh?e.ext*1.4:e.h;
        if(Math.abs(s.x-e.x)<e.w/2+0.18&&s.y>ey-0.15&&s.y<ey+eh+0.15){
          s.life=0; burst(s.x,s.y,'#ffb347',6,4,0.12,0.35);
          if(e.type==='boss') damageBoss(e,1); else { killEnemy(e,'flip',sgn(s.vx)); addScore(200,e.x,ey+eh); }
          break; } }
    }
    if(s.life<=0) any=true;
  }
  if(any){ for(const s of shots) if(s.life<=0) world.remove(s.mesh); shots=shots.filter(s=>s.life>0); }
}
function updateBombs(dt){
  const p=player; let any=false;
  for(const b of bombs){
    if(!b.gone){
      b.vy-=26*dt; b.x+=b.vx*dt; b.y+=b.vy*dt;
      if((b.vy<0&&solidAt(Math.floor(b.x),Math.floor(b.y-0.25)))||b.y<0||b.x<1||b.x>W-1){ b.gone=true; burst(b.x,b.y,'#fff1d0',7,4,0.13,0.4); if(Math.abs(b.x-camX)<viewHalfW) sfx.bump(); }
      else if(!p.dead&&Math.abs(b.x-p.x)<0.4+p.w/2&&b.y+0.35>p.y&&b.y-0.35<p.y+p.h){ b.gone=true; burst(b.x,b.y,'#fff1d0',7,4,0.13,0.4); hurtPlayer(); }
    }
    if(b.gone) any=true;
  }
  if(any){ for(const b of bombs) if(b.gone) world.remove(b.mesh); bombs=bombs.filter(b=>!b.gone); }
}
function spawnPlat(d){
  const pl={x:d.x,y:d.y,w:d.w,ax:d.axis,a0:d.axis==='x'?d.x:d.y,range:d.range,sp:d.speed,ph:d.phase||0,t:0,dx:0,dy:0}, w8=d.w*8, c=TH.plat;
  const b=[[0,-3.2,-8,w8,3.2,16,c[0]],[0.5,-4.2,-7,w8-1,1,14,c[1]],[1,-0.2,-7,w8-2,0.3,14,shade(c[0],1.12)],[w8/2-3.6,-2.5,8,1.5,1.5,0.2,INK],[w8/2+2.1,-2.5,8,1.5,1.5,0.2,INK],[w8/2-1.2,-2.7,8,2.4,0.4,0.2,INK]];
  pl.mesh=new T.Mesh(tmpGeo(voxGeo(b)),MAT.vox); world.add(pl.mesh); plats.push(pl);
  const v=pl.a0+(0.5-0.5*Math.cos(pl.ph))*pl.range; if(pl.ax==='x') pl.x=v; else pl.y=v;
}
function updatePlats(dt){
  for(const pl of plats){ pl.t+=dt; const v=pl.a0+(0.5-0.5*Math.cos(pl.t*pl.sp+pl.ph))*pl.range;
    if(pl.ax==='x'){ pl.dx=v-pl.x; pl.dy=0; pl.x=v; } else { pl.dy=v-pl.y; pl.dx=0; pl.y=v; } }
}
function spawnFirebar(d){
  const f={x:d.x,y:d.y,n:d.n,sp:d.speed,a:d.phase||0,embers:[]};
  for(let i=0;i<d.n;i++){ const m=new T.Mesh(partGeo,emberMat[i%2]); m.scale.setScalar(0.36); world.add(m); f.embers.push(m); }
  firebars.push(f);
}
function updateFirebars(dt){
  const p=player;
  for(const f of firebars){ f.a+=f.sp*dt; if(p.dead||p.goal||p.star>0) continue; const c=Math.cos(f.a), s=Math.sin(f.a);
    for(let i=1;i<f.n;i++){ const ex=f.x+c*i*0.55, ey=f.y+s*i*0.55; if(ex>p.x-p.w/2-0.14&&ex<p.x+p.w/2+0.14&&ey>p.y-0.14&&ey<p.y+p.h+0.14){ hurtPlayer(); break; } } }
}
function step(dt){
  updatePlats(dt);
  updatePlayer(dt);
  if(G.state!=='play') return;
  updateEnemies(dt); updateItems(dt); updateShots(dt); updateBombs(dt); updateFirebars(dt);
  playerVsEnemies();
  if(G.bossDead){
    G.winT+=dt; G.fountain-=dt;
    if(G.winT<1.8&&G.fountain<=0){ G.fountain=0.09; coinPop(G.bossX+(Math.random()-0.5)*5,2.2+Math.random()*2); addCoin(); G.score+=200; sfx.coin(); }
    if(G.winT>4&&!player.dead){ G.bossDead=false; if(G.levelIdx>=LEVELS.length-1) showWin(); else levelClear(); }
  }
}
