#!/usr/bin/env node
/* Proves that every level can be finished.

   The game code in src/ is loaded as-is (see game.js), with three.js and the page stubbed out, so the rules being
   tested are the real ones. A search bot then plays each level: it keeps a snapshot for every spot it has managed to stand
   on, keeps trying moves from those spots, and stops when Blorp reaches the flag or beats the boss. Each level is
   played twice, as small Blorp and as big Blorp (who must not get hurt), and the bot jumps 5% lower than a player
   can, so a pass leaves some margin. It also reports common slips, such as a monster placed in mid-air, a roof
   low enough to hit when jumping for the flag, or a tree standing in front of the checkpoint flag or inside the
   hut after the goal.

     node tools/check-levels.js              check every level
     node tools/check-levels.js 2-3 4-1      check only these levels
     node tools/check-levels.js --map 2-3    print a level as text
*/
'use strict';
const {loadGame}=require('./game.js');

/* Runs inside the game's own scope, so it can read and rewind the game's state directly. */
function harness(){
  /* two random streams: the game's own (rewound with each snapshot, so the game stays repeatable) and the bot's choices (never rewound) */
  let seed=1, botSeed=1, simT=0, lastTiles=null, nerf=1;
  const mix=s=>{ let t=Math.imul(s^(s>>>15),1|s); t=(t+Math.imul(t^(t>>>7),61|t))^t; return ((t^(t>>>14))>>>0)/4294967296; };
  Math.random=()=>{ seed=(seed+0x6D2B79F5)|0; return mix(seed); };
  const rnd=()=>{ botSeed=(botSeed+0x6D2B79F5)|0; return mix(botSeed); };
  const same=(a,b)=>{ for(let i=0;i<a.length;i++) if(a[i]!==b[i]) return false; return true; };
  /* every prop the scenery places goes through put(); keep a note of each while a level loads */
  let props=null; const put0=put;
  put=function(list,model,ox,oy,oz){ if(props) props.push({model,ox,oy,oz}); return put0(list,model,ox,oy,oz); };
  const copies=a=>a.map(o=>Object.assign({},o));
  const bossOf=()=>{ for(const e of enemies) if(e.type==='boss') return e; return null; };
  /* every block Blorp's head meets goes through bumpBlock(); keep a note of each while a jump for the flag is tried */
  let knocks=null; const bump0=bumpBlock;
  bumpBlock=function(tx,ty){ if(knocks) knocks.push([tx,ty]); return bump0(tx,ty); };

  function snap(){
    const p=Object.assign({},player); p.riding=player.riding?plats.indexOf(player.riding):-1;
    if(!lastTiles||!same(lastTiles,tiles)) lastTiles=tiles.slice();
    return {p,inp:Object.assign({},input),g:Object.assign({},G),tiles:lastTiles,multi:new Map(multi),
      en:copies(enemies),it:copies(items),sh:copies(shots),bo:copies(bombs),
      pl:plats.map(q=>[q.x,q.y,q.t,q.dx,q.dy]),fb:firebars.map(f=>f.a),cam:[camX,camY,camLead,focusY],seed,time:simT};
  }
  function restore(s){
    Object.assign(player,s.p); player.riding=s.p.riding>=0?plats[s.p.riding]:null;
    Object.assign(input,s.inp); Object.assign(G,s.g);
    tiles.set(s.tiles); lastTiles=s.tiles;
    multi.clear(); for(const [k,v] of s.multi) multi.set(k,v);
    enemies=copies(s.en); items=copies(s.it); shots=copies(s.sh); bombs=copies(s.bo);
    s.pl.forEach((q,i)=>{ const o=plats[i]; o.x=q[0]; o.y=q[1]; o.t=q[2]; o.dx=q[3]; o.dy=q[4]; });
    s.fb.forEach((a,i)=>{ firebars[i].a=a; });
    camX=s.cam[0]; camY=s.cam[1]; camLead=s.cam[2]; focusY=s.cam[3]; seed=s.seed; simT=s.time; bumps=[];
  }
  /* one tick of the real game; any upward launch is trimmed so the bot never relies on a full-height jump */
  function adv(){ const vy=player.vy; step(STEP); updateCamera(STEP,false); simT+=STEP; if(player.vy>vy+5) player.vy*=nerf; }
  function start(idx,form){
    G.lives=3; G.cp=false; G.score=0; G.coins=0; G.bossSeen=false; G.bossDead=false; player.form=form;
    loadLevel(idx,false); G.state='play'; simT=0; lastTiles=null;
    input.left=input.right=input.jump=input.run=false; input.jumpBuf=0; input.runEdge=false;
  }

  /* Try a short burst of play from wherever the game currently is. */
  function rollout(form,onStand){
    const n=1+((rnd()*3)|0);
    for(let m=0;m<n;m++){
      const r=rnd(); let dir=r<0.6?1:r<0.78?-1:0;
      const run=rnd()<0.5, jump=rnd()<0.6, hold=0.04+rnd()*0.58;
      const dur=jump?3.2:0.1+rnd()*0.6;
      let sw=rnd()<0.3?rnd()*0.9:-1; const swDir=((rnd()*3)|0)-1;
      if(jump){ input.jumpBuf=0.11; input.jump=true; }
      for(let t=0;t<dur;t+=STEP){
        if(jump&&t>=hold) input.jump=false;
        if(sw>=0&&t>=sw){ dir=swDir; sw=-1; }
        input.left=dir<0; input.right=dir>0; input.run=run;
        adv();
        if(player.dead||player.form<form) return 'dead';
        if(player.goal||G.bossDead) return 'win';
        if(jump&&t>0.1&&player.onGround) break;
      }
      input.jump=false;
      if(player.onGround) onStand();
    }
    return '';
  }

  function run(idx,form,budget,sd,margin){
    seed=1; botSeed=sd||1; nerf=margin||1; start(idx,form);
    const cells=new Map(), list=[]; let front=[], maxX=0, rolls=0;
    const stand=()=>{
      const b=L.boss?bossOf():null, hp=b?b.hp:0, k=(player.x|0)+'_'+Math.round(player.y*2)+'_'+hp;
      let c=cells.get(k);
      if(!c){ c={x:player.x,y:player.y,hp,near:b&&G.bossSeen?Math.abs(player.x-b.x):0,snaps:[snap()],n:0}; cells.set(k,c); list.push(c); if(player.x>maxX) maxX=player.x; }
      else if(c.snaps.length<3&&simT-c.snaps[c.snaps.length-1].time>1.5) c.snaps.push(snap());
    };
    const score=c=>-c.hp*1000+(G.bossSeen&&L.boss?-c.near:c.x);
    const choose=()=>{
      const r=rnd();
      if(r<0.62&&front.length) return front[(rnd()*front.length)|0];
      if(r<0.9){ let best=null,bs=-1e9; for(let i=0;i<4;i++){ const c=list[(rnd()*list.length)|0], s=score(c)-Math.sqrt(c.n)*0.6; if(s>bs){ bs=s; best=c; } } return best; }
      return list[(rnd()*list.length)|0];
    };
    stand();
    for(;rolls<budget;rolls++){
      if(rolls%150===0) front=list.slice().sort((a,b)=>score(b)-score(a)).slice(0,36);
      const c=choose(); c.n++; restore(c.snaps[(rnd()*c.snaps.length)|0]);
      if(rollout(form,stand)==='win'){
        const t=simT; input.left=input.right=input.jump=input.run=false;
        for(let i=0;i<120*20&&G.state==='play';i++) adv();
        const ok=G.state==='clear'||G.state==='win';
        return {ok,time:t,rolls,cells:list.length,why:ok?'':'reached the end but the level never finished (state '+G.state+', x '+player.x.toFixed(1)+', y '+player.y.toFixed(1)+')'};
      }
    }
    const far=list.slice().sort((a,b)=>score(b)-score(a))[0];
    return {ok:false,rolls,cells:list.length,why:'stuck: furthest x '+maxX.toFixed(1)+(L.boss?', boss hp left '+far.hp:'')+' of '+L.W};
  }

  /* A jump for the flag must not end on Blorp's head. From every step of the last staircase he jumps for the pole with the
     button held, from a standstill, a walk and a full run, small and big; the real game says whether his head met anything. */
  function headroom(idx){
    const out=[];
    for(const form of [0,1]){
      start(idx,form); if(!L.goal) return out;
      enemies=[]; /* this is about the roof, not about who is flying under it */
      const gx=L.goal.x, base=snap(); let hit=null;
      for(let x=gx-12;x<gx&&!hit;x++){
        let top=-1; for(let y=0;y<H;y++){ if(solidAt(x,y)) top=y; else if(top>=0) break; }
        if(top<2) continue; /* level ground, not a step */
        for(const vx of [0,5.5,RUN_MAX]){
          restore(base); player.x=x+0.5; player.y=top+1; player.vx=vx; player.vy=0; player.onGround=true;
          input.left=false; input.right=input.run=input.jump=true; input.jumpBuf=0.11; knocks=[];
          for(let i=0;i<120*4&&!player.goal&&!player.dead;i++){ step(STEP); if(player.onGround&&i>30) break; }
          if(knocks.length){ hit={x,at:knocks[0]}; break; }
        }
      }
      knocks=null; input.right=input.run=input.jump=false;
      if(hit) out.push((form?'big':'small')+' Blorp hits his head at '+hit.at[0]+','+hit.at[1]+' when he jumps for the flag from the step at x '+hit.x);
    }
    return out;
  }

  /* Mistakes that are easy to make when writing a level by hand. */
  function lint(idx){
    const L0=LEVELS[idx](), W0=L0.W, t=L0.tiles, out=[];
    const at=(x,y)=>(x<0||x>=W0||y<0||y>=H)?AIR:t[y*W0+x], sol=(x,y)=>SOLID[at(x,y)]===1, floor=(x,y)=>sol(x,y)||at(x,y)===SEMI;
    const onFloor=(what,x,y)=>{ const tx=Math.floor(x), ty=Math.floor(y+0.01);
      if(sol(tx,ty)) out.push(what+' at '+x+','+y+' is inside a solid tile');
      else if(Math.abs(y-Math.round(y))>0.01||!floor(tx,ty-1)) out.push(what+' at '+x+','+y+' is not standing on anything'); };
    onFloor('start',L0.start.x,L0.start.y);
    if(L0.checkpoint) onFloor('checkpoint',L0.checkpoint.x,L0.checkpoint.y);
    for(const s of L0.springs) onFloor('spring',s.x,s.y);
    for(const e of L0.enemies){
      if(e.type==='chomper') continue;
      if(e.type==='batty'){ if(sol(Math.floor(e.x),Math.floor(e.y))) out.push('batty at '+e.x+','+e.y+' starts inside a solid tile'); continue; }
      if(e.type==='icicle'){ if(sol(Math.floor(e.x),Math.floor(e.y))) out.push('icicle at '+e.x+','+e.y+' is inside a solid tile'); if(!floor(Math.floor(e.x),Math.floor(e.y)+1)) out.push('icicle at '+e.x+','+e.y+' has nothing to hang from'); continue; }
      onFloor(e.type,e.x,e.y);
    }
    for(const k of L0.contents.keys()){ const id=t[k]; if(id!==BRICK&&id!==QBLOCK&&id!==HIDDEN) out.push('block contents at '+(k%W0)+','+Math.floor(k/W0)+' have no block'); }
    for(let x=0;x<W0;x++) for(let y=0;y<2;y++){ const id=at(x,y); if(id!==AIR&&id!==GROUND&&id!==ICE) out.push('tile '+id+' at '+x+','+y+' is below the walking surface'); }
    if(L0.goal){ const gx=L0.goal.x;
      if(W0<gx+10) out.push('level is too narrow for the hut after the flag (needs W >= '+(gx+10)+')');
      for(let x=gx-1;x<=gx+8;x++){ if(!sol(x,1)) out.push('no ground at x '+x+' around the flag'); for(let y=2;y<12;y++) if(at(x,y)!==AIR&&!(x===gx&&y===2)) out.push('tile in the way at '+x+','+y+' around the flag'); } }
    else if(!L0.boss) out.push('level has neither a flag nor a boss');
    for(const n of headroom(idx)) out.push(n);
    if(L0.boss){ const b=L0.boss; if(!(b.x0<b.x&&b.x<b.x1)) out.push('boss starts outside its arena'); onFloor('boss',b.x,b.y); }
    /* scenery: nothing tall may stand between the camera and the checkpoint flag. The flag stands at depth CP_Z and
       spans about a tile to the right of its post; the 0.75 allows for props further back shifting sideways on screen. */
    props=[]; loadLevel(idx,false); const placed=props; props=null;
    if(L0.checkpoint){
      const cp=L0.checkpoint, seen=new Set();
      for(const q of placed) for(const b of q.model){
        const x0=(b[0]+q.ox)/8, x1=x0+b[3]/8, y0=(b[1]+q.oy)/8, y1=y0+b[4]/8, front=(b[2]+b[5]+q.oz)/8;
        if(front>CP_Z-0.075&&y1>cp.y+1&&y0<cp.y+2.4&&x1>cp.x-0.25-0.75&&x0<cp.x+0.95+0.75) seen.add(Math.round(q.ox/8));
      }
      for(const x of seen) out.push('a tall prop near x '+x+' stands in front of the checkpoint at x '+cp.x);
    }
    /* nor may anything tall stand where the hut after the flag does: it would poke out of the walls or roof */
    if(L0.goal){
      const ox=(L0.goal.x+HUT_DX)*8, seen=new Set(); let hx0=1e9, hx1=-1e9, hz0=1e9, hz1=-1e9;
      for(const b of mHut()){ hx0=Math.min(hx0,b[0]+ox); hx1=Math.max(hx1,b[0]+b[3]+ox); hz0=Math.min(hz0,b[2]+HUT_Z); hz1=Math.max(hz1,b[2]+b[5]+HUT_Z); }
      for(const q of placed){
        if(q.ox===ox&&q.oz===HUT_Z) continue; /* the hut itself */
        for(const b of q.model){ const x0=b[0]+q.ox, x1=x0+b[3], top=b[1]+b[4]+q.oy, back=b[2]+q.oz, front=back+b[5];
          if(top>16+12&&x1>hx0&&x0<hx1&&front>hz0&&back<hz1) seen.add(Math.round(q.ox/8)); }
      }
      for(const x of seen) out.push('a tall prop near x '+x+' overlaps the hut after the flag');
    }
    for(const p of L0.plats){ const x1=p.x+(p.axis==='x'?p.range:0)+p.w, y1=p.y+(p.axis==='y'?p.range:0); if(p.x<0||x1>W0||p.y<1||y1>H-2) out.push('moving ledge at '+p.x+','+p.y+' leaves the level'); }
    return out;
  }

  function map(idx){
    const L0=LEVELS[idx](), W0=L0.W, t=L0.tiles, CH=' #B?UHPh=^oI', rows=[];
    for(let y=H-1;y>=0;y--){ const r=[]; for(let x=0;x<W0;x++) r.push(CH[t[y*W0+x]]||'?'); rows.push(r); }
    const put=(x,y,c)=>{ const tx=Math.floor(x), ty=Math.floor(y); if(tx>=0&&tx<W0&&ty>=0&&ty<H) rows[H-1-ty][tx]=c; };
    const EC={blob:'b',shellby:'s',spikit:'k',batty:'y',boing:'g',chomper:'c',icicle:'i',prickle:'p'};
    for(const e of L0.enemies) put(e.x,e.y,EC[e.type]||'e');
    for(const s of L0.springs) put(s.x,s.y,'S');
    for(const p of L0.plats) for(let i=0;i<p.w;i++) put(p.x+i,p.y-1,'~');
    for(const f of L0.firebars) put(f.x,f.y,'*');
    if(L0.checkpoint) put(L0.checkpoint.x,L0.checkpoint.y,'C');
    if(L0.goal) put(L0.goal.x,3,'F');
    if(L0.boss) put(L0.boss.x,L0.boss.y,'K');
    put(L0.start.x,L0.start.y,'@');
    let ruler=''; for(let x=0;x<W0;x+=10) ruler+=String(x).padEnd(10);
    return rows.map((r,i)=>String(H-1-i).padStart(2)+' '+r.join('')).join('\n')+'\n   '+ruler;
  }
  const label=idx=>{ const L0=LEVELS[idx](); return L0.world===undefined?String(idx+1):(L0.world+1)+'-'+(L0.stage+1); };
  const info=idx=>{ const L0=LEVELS[idx](); return {label:label(idx),name:L0.name,theme:L0.theme,W:L0.W}; };
  /* scripted input, for debugging the checker itself: acts is a list of [seconds, dir, run, jump] */
  function trace(idx,form,acts){
    seed=1; nerf=1; start(idx,form); const out=[];
    for(const a of acts){ if(a[3]){ input.jumpBuf=0.11; } input.jump=!!a[3];
      for(let t=0;t<a[0];t+=STEP){ input.left=a[1]<0; input.right=a[1]>0; input.run=!!a[2]; adv(); }
      out.push({t:+simT.toFixed(2),x:+player.x.toFixed(2),y:+player.y.toFixed(2),vx:+player.vx.toFixed(2),vy:+player.vy.toFixed(2),ground:player.onGround,dead:player.dead,state:G.state,camX:+camX.toFixed(2),viewHalfW,active:enemies.filter(e=>e.active).length}); }
    return out;
  }
  return {count:LEVELS.length,run,lint,map,info,trace};
}

const hx=loadGame(harness).api;

module.exports=hx;
if(require.main!==module) return;
const args=process.argv.slice(2), wantMap=args.includes('--map'), names=args.filter(a=>!a.startsWith('--'));
const all=[]; for(let i=0;i<hx.count;i++) all.push(Object.assign({idx:i},hx.info(i)));
const picked=names.length?all.filter(l=>names.includes(l.label)):all;
if(names.length&&picked.length!==names.length){ console.error('unknown level; levels are '+all.map(l=>l.label).join(' ')); process.exit(2); }
if(wantMap){ for(const l of picked) console.log(l.label+' '+l.name+' ('+l.theme+', '+l.W+' wide)\n'+hx.map(l.idx)+'\n'); process.exit(0); }

let bad=0;
for(const l of picked){
  const notes=hx.lint(l.idx), res=[];
  for(const form of [0,1]){
    let r=null;
    for(let attempt=0;attempt<3&&!(r&&r.ok);attempt++) r=hx.run(l.idx,form,40000,1+attempt*7919+form,0.95);
    res.push(r);
  }
  const ok=res.every(r=>r.ok)&&!notes.length; if(!ok) bad++;
  const cell=r=>r.ok?(r.time.toFixed(0)+'s').padStart(5):' FAIL';
  console.log((ok?'ok  ':'FAIL')+' '+l.label.padEnd(4)+l.name.padEnd(20)+' small '+cell(res[0])+'  big '+cell(res[1]));
  for(const n of notes) console.log('       '+n);
  res.forEach((r,i)=>{ if(!r.ok) console.log('       '+(i?'big':'small')+' Blorp: '+r.why); });
}
console.log(bad?bad+' of '+picked.length+' levels failed':'all '+picked.length+' levels can be finished');
process.exit(bad?1:0);
