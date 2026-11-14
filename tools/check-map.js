#!/usr/bin/env node
/* Proves the world map is sound and that its rules hold, without drawing it.

   The game code in src/ is loaded as-is (see game.js), with three.js and the page stubbed out, so the island, the
   route and the rules of walking being checked are the real ones.

     node tools/check-map.js          run the checks
     node tools/check-map.js --map    print the island as text: the regions and route, then the heights
*/
'use strict';
const assert=require('assert');
const {loadGame}=require('./game.js');

function storage(){ const m=new Map(); return {map:m,getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>{ m.set(k,String(v)); },removeItem:k=>{ m.delete(k); }}; }
const saved=s=>JSON.parse([...s.map.values()][0]);
/* One page load. The probe looks names up inside the game's own scope when they are asked for, so `m.mapGo` is the
   game's mapGo and a name the game lacks fails only the checks that use it. */
const probe=function(){ return n=>eval(n); };
function game(s){ const get=loadGame(probe,s===undefined?storage():s).api; return new Proxy({},{get:(_,k)=>get(k)}); }

const STEP={N:[0,-1],E:[1,0],S:[0,1],W:[-1,0]}, COMPASS=Object.keys(STEP);
/* keep ticking until Blorp is standing still and no path is appearing */
function settle(m,held,dt){ let n=0; do{ m.mapTick(dt||1/60,held||null,false); assert(++n<20000,'the map never came to rest'); }while(m.MAPST.walk||m.MAPST.reveal); }
function go(m,dir){ const r=m.mapGo(dir); if(r==='go') settle(m); return r; }
const key=code=>({code,preventDefault(){}});
const cellsOf=m=>m.MAPSEGS.map(s=>s.map(c=>c.z*m.MAP_W+c.x));

const checks=[
  ['there is one marker for every level',()=>{
    const m=game();
    assert.strictEqual(m.MAPNODES.length,m.LEVELS.length);
    assert.strictEqual(m.MAPSEGS.length,m.LEVELS.length-1);
  }],
  ['every stretch of path runs from its marker to the next, one cell at a time, north, south, east or west',()=>{
    const m=game();
    m.MAPSEGS.forEach((seg,i)=>{
      const a=m.MAPNODES[i], b=m.MAPNODES[i+1], f=seg[0], l=seg[seg.length-1];
      assert(seg.length>=2,'stretch '+i+' has no length');
      assert(f.x===a.x&&f.z===a.z,'stretch '+i+' does not start on marker '+i);
      assert(l.x===b.x&&l.z===b.z,'stretch '+i+' does not end on marker '+(i+1));
      for(let k=1;k<seg.length;k++) assert.strictEqual(Math.abs(seg[k].x-seg[k-1].x)+Math.abs(seg[k].z-seg[k-1].z),1,'stretch '+i+' jumps at tile '+k);
    });
  }],
  ['the path stays on the island, a bridge or a stair',()=>{
    const m=game();
    m.MAPSEGS.forEach((seg,i)=>seg.forEach(c=>{
      assert(c.x>=0&&c.x<m.MAP_W&&c.z>=0&&c.z<m.MAP_D,'stretch '+i+' leaves the map at '+c.x+','+c.z);
      const k=c.z*m.MAP_W+c.x;
      assert(m.mapStandH(c.x,c.z)>0,'nothing to stand on at '+c.x+','+c.z);
      assert(m.ISLE.kind[k]===m.MK_LAND||m.ISLE.deck[k]>0,'no bridge over '+c.x+','+c.z);
      assert(m.ISLE.kind[k]===m.MK_LAND||m.ISLE.deck[k]>=m.ISLE.h[k],'the bridge at '+c.x+','+c.z+' is under the pool it crosses');
      assert(m.ISLE.route[k]>=0,'the island does not know '+c.x+','+c.z+' is on the route');
      assert.strictEqual(c.h,m.mapStandH(c.x,c.z),'the tile at '+c.x+','+c.z+' disagrees with the island about its height');
    }));
  }],
  ['markers stand on land in their own world',()=>{
    const m=game();
    m.MAPNODES.forEach((n,i)=>{ const k=n.z*m.MAP_W+n.x;
      assert.strictEqual(m.ISLE.kind[k],m.MK_LAND,'marker '+i+' is not on land');
      assert.strictEqual(m.ISLE.deck[k],0,'marker '+i+' is on a bridge');
      assert.strictEqual(m.ISLE.world[k],m.LEVELS[i]().world,'marker '+i+' is in the wrong world');
    });
  }],
  ['the path never changes height by more than one step',()=>{
    const m=game();
    m.MAPSEGS.forEach((seg,i)=>{ for(let k=1;k<seg.length;k++){ const d=Math.abs(seg[k].h-seg[k-1].h);
      assert(d<=1,'stretch '+i+' steps '+d+' at '+seg[k].x+','+seg[k].z); } });
  }],
  ['the path climbs and falls: it is a landscape, not a board',()=>{
    const m=game(), hs=m.MAPNODES.map(n=>n.h);
    assert(Math.max(...hs)-Math.min(...hs)>=8,'the highest and lowest markers are only '+(Math.max(...hs)-Math.min(...hs))+' steps apart');
  }],
  ['the last world floats, and is reached by a stair',()=>{
    const m=game(), first=m.LEVELS.length-5;
    for(let i=first;i<m.LEVELS.length;i++){ const n=m.MAPNODES[i]; assert(m.ISLE.base[n.z*m.MAP_W+n.x]>0,'marker '+i+' is not on floating ground'); }
    const stair=m.MAPSEGS[first-1].filter(c=>m.ISLE.deck[c.z*m.MAP_W+c.x]>0);
    assert(stair.length>=6,'the stair up has only '+stair.length+' steps');
  }],
  ['the path never crosses itself',()=>{
    const m=game(), seen=new Set();
    cellsOf(m).forEach((seg,i)=>seg.forEach((c,k)=>{ if(k===0&&i>0) return; assert(!seen.has(c),'stretch '+i+' reuses a cell'); seen.add(c); }));
  }],
  ['the path never runs alongside itself, where it would read as a short cut',()=>{
    const m=game(), I=m.ISLE, W=m.MAP_W;
    for(let z=0;z<m.MAP_D;z++) for(let x=0;x<W;x++){ const a=I.route[z*W+x]; if(a<0) continue;
      for(const [dx,dz] of [[1,0],[0,1]]){ const b=x+dx<W&&z+dz<m.MAP_D?I.route[(z+dz)*W+x+dx]:-1;
        assert(b<0||Math.abs(a-b)===1,'the path touches itself between '+x+','+z+' and '+(x+dx)+','+(z+dz)); } }
  }],
  ['no two stretches leave a marker the same way',()=>{
    const m=game(), n=m.MAPNODES.length;
    for(let i=0;i<n;i++){ const d=m.mapDirAt(i);
      if(i>0) assert(COMPASS.includes(d.back),'marker '+i+' has no way back'); else assert.strictEqual(d.back,null);
      if(i<n-1) assert(COMPASS.includes(d.fwd),'marker '+i+' has no way on'); else assert.strictEqual(d.fwd,null);
      assert.notStrictEqual(d.fwd,d.back,'marker '+i+' goes on and back the same way');
    }
  }],
  ['with nothing cleared Blorp cannot leave the first marker',()=>{
    const m=game(); m.G.open=0; m.mapPlace(0);
    const fwd=m.mapDirAt(0).fwd;
    for(const d of COMPASS) assert.strictEqual(m.mapGo(d),d===fwd?'locked':'none',d);
    assert.strictEqual(m.MAPST.at,0); assert.strictEqual(m.MAPST.walk,null);
  }],
  ['with three levels cleared Blorp can walk to the fourth marker and no further',()=>{
    const m=game(); m.G.open=3; m.mapPlace(0);
    for(let i=0;i<3;i++){ assert.strictEqual(go(m,m.mapDirAt(i).fwd),'go'); assert.strictEqual(m.MAPST.at,i+1); }
    assert.strictEqual(go(m,m.mapDirAt(3).fwd),'locked'); assert.strictEqual(m.MAPST.at,3);
  }],
  ['Blorp stands where the marker is, at its height',()=>{
    const m=game(); m.G.open=3; m.mapPlace(0); go(m,m.mapDirAt(0).fwd);
    const n=m.MAPNODES[1];
    assert.deepStrictEqual([m.MAPST.x,m.MAPST.y,m.MAPST.z],[n.x+0.5,n.h*m.MAP_STEP,n.z+0.5]);
  }],
  ['Blorp can walk back to the start',()=>{
    const m=game(); m.G.open=3; m.mapPlace(3);
    for(let i=3;i>0;i--){ assert.strictEqual(go(m,m.mapDirAt(i).back),'go'); assert.strictEqual(m.MAPST.at,i-1); }
    for(const d of COMPASS) if(d!==m.mapDirAt(0).fwd) assert.strictEqual(m.mapGo(d),'none');
  }],
  ['a press while walking is ignored',()=>{
    const m=game(); m.G.open=3; m.mapPlace(0);
    assert.strictEqual(m.mapGo(m.mapDirAt(0).fwd),'go'); m.mapTick(1/60,null,false);
    for(const d of COMPASS) assert.strictEqual(m.mapGo(d),'busy');
    settle(m); assert.strictEqual(m.MAPST.at,1);
  }],
  ['holding a direction carries on through a marker',()=>{
    const m=game(), n=m.MAPNODES.length; m.G.open=n;
    let i=0; while(i<n-2&&m.mapDirAt(i).fwd!==m.mapDirAt(i+1).fwd) i++;
    assert(i<n-2,'the route has no two markers in a row that are left the same way, so this cannot be shown');
    m.mapPlace(i); m.mapGo(m.mapDirAt(i).fwd); settle(m,m.mapDirAt(i).fwd);
    assert(m.MAPST.at>=i+2,'stopped at marker '+m.MAPST.at+' having set off from '+i);
  }],
  ['holding a direction never turns Blorp back the way he came',()=>{
    const m=game(), n=m.MAPNODES.length; m.G.open=n;
    for(let i=0;i<n;i++){ const d=m.mapDirAt(i);
      if(d.fwd){ m.mapPlace(i); m.mapGo(d.fwd); settle(m,d.fwd); assert(m.MAPST.at>i,'holding '+d.fwd+' from marker '+i+' ended on '+m.MAPST.at); }
      if(d.back){ m.mapPlace(i); m.mapGo(d.back); settle(m,d.back); assert(m.MAPST.at<i,'holding '+d.back+' from marker '+i+' ended on '+m.MAPST.at); } }
  }],
  ['a held direction does not set Blorp off; only a press does',()=>{
    const m=game(); m.G.open=3; m.mapPlace(0);
    for(let k=0;k<30;k++) m.mapTick(1/60,m.mapDirAt(0).fwd,false);
    assert.strictEqual(m.MAPST.walk,null); assert.strictEqual(m.MAPST.at,0);
  }],
  ['the coast is tidy: no land hangs on by a corner, and no pool spills into the sea',()=>{
    const m=game(), I=m.ISLE, W=m.MAP_W, D=m.MAP_D, at=(x,z)=>x<0||z<0||x>=W||z>=D?m.MK_SEA:I.kind[z*W+x];
    for(let z=0;z<D;z++) for(let x=0;x<W;x++){ const k=at(x,z); if(k===m.MK_SEA) continue;
      const solid=[[1,0],[-1,0],[0,1],[0,-1]].filter(([dx,dz])=>at(x+dx,z+dz)!==m.MK_SEA).length;
      assert(solid>=2,'the land at '+x+','+z+' has only '+solid+' neighbours');
      if(k!==m.MK_LAND) for(let dz=-1;dz<=1;dz++) for(let dx=-1;dx<=1;dx++) assert(at(x+dx,z+dz)!==m.MK_SEA,'the pool at '+x+','+z+' touches the sea');
      assert(x>0&&z>0&&x<W-1&&z<D-1,'land reaches the edge of the map at '+x+','+z); }
  }],
  ['the castle rock and the floating island stand apart, reached only by bridge and stair',()=>{
    const m=game(), I=m.ISLE, W=m.MAP_W, D=m.MAP_D;
    for(let z=1;z<D-1;z++) for(let x=1;x<W-1;x++){ const k=z*W+x; if(I.kind[k]===m.MK_SEA) continue;
      for(const n of [k+1,k+W]){ if(I.kind[n]===m.MK_SEA) continue;
        assert((I.world[k]===2)===(I.world[n]===2),'the castle rock touches other land at '+x+','+z);
        assert((I.base[k]>0)===(I.base[n]>0),'floating land touches the ground at '+x+','+z); } }
    for(const i of [9,14]) assert(m.MAPSEGS[i].filter(c=>I.kind[c.z*W+c.x]===m.MK_SEA).length>=2,'stretch '+i+' does not cross open sea');
  }],
  ['no ground stands between the camera and the path',()=>{
    /* the camera looks north and down at about 50 degrees, so ground d cells nearer than a tile hides it once it
       stands more than about 2d steps higher */
    const m=game(), I=m.ISLE, W=m.MAP_W;
    m.MAPSEGS.forEach(seg=>seg.forEach(c=>{ for(let d=1;d<=7&&c.z+d<m.MAP_D;d++){ const k=(c.z+d)*W+c.x, h=Math.max(I.h[k],I.deck[k]);
      assert(h-c.h<=2*d,'the path at '+c.x+','+c.z+' is hidden by the ground at '+c.x+','+(c.z+d)); } }));
  }],
  ['running is faster than walking',()=>{
    const time=fast=>{ const m=game(); m.G.open=3; m.mapPlace(0); m.mapGo(m.mapDirAt(0).fwd); let n=0; while(m.MAPST.walk){ m.mapTick(1/120,null,fast); n++; assert(n<20000); } return n; };
    assert(time(true)<time(false)*0.8);
  }],
  ['a new stretch of path appears tile by tile and then opens its marker',()=>{
    const m=game(); m.G.open=1; m.mapPlace(0); m.mapReveal(0);
    assert.strictEqual(m.mapSegShown(0),0); assert.strictEqual(m.mapMarkState(1),0);
    for(const d of COMPASS) assert.strictEqual(m.mapGo(d),'busy');
    m.mapTick(1/60,null,false); const early=m.mapSegShown(0);
    assert(early<m.MAPSEGS[0].length,'the whole stretch appeared at once');
    settle(m,null,0.1); /* as slow as a frame is ever allowed to be */
    assert.strictEqual(m.mapSegShown(0),m.MAPSEGS[0].length); assert.strictEqual(m.mapMarkState(1),1);
    assert.strictEqual(go(m,m.mapDirAt(0).fwd),'go');
  }],
  ['markers read as locked, open and cleared',()=>{
    const m=game(); m.G.open=2;
    assert.deepStrictEqual([0,1,2,3].map(i=>m.mapMarkState(i)),[2,2,1,0]);
    assert.strictEqual(m.mapSegShown(1),m.MAPSEGS[1].length); assert.strictEqual(m.mapSegShown(2),0);
    m.G.open=m.LEVELS.length; assert.strictEqual(m.mapMarkState(m.LEVELS.length-1),2);
  }],
  ['choosing a marker starts that level',()=>{
    const m=game(); m.act('start'); m.G.open=4; m.mapPlace(2);
    assert.strictEqual(m.mapEnter(),true); assert.deepStrictEqual([m.G.state,m.G.levelIdx],['card',2]);
  }],
  ['a level cannot be chosen mid-walk or while a path is appearing',()=>{
    const m=game(); m.act('start'); m.G.open=4; m.mapPlace(0);
    m.mapGo(m.mapDirAt(0).fwd); m.mapTick(1/60,null,false);
    assert.strictEqual(m.mapEnter(),false); assert.strictEqual(m.G.state,'map');
    settle(m); m.mapReveal(2);
    assert.strictEqual(m.mapEnter(),false); assert.strictEqual(m.G.state,'map');
  }],
  ['a level cannot be chosen from anywhere but the map',()=>{
    const m=game(); assert.strictEqual(m.mapEnter(),false); assert.strictEqual(m.G.state,'title');
  }],
  ['back on the map after a first clear, the next stretch of path appears',()=>{
    const m=game(); m.act('start'); m.mapEnter(); m.levelClear(); m.primaryAction();
    assert.deepStrictEqual([m.G.state,m.MAPST.at,m.MAPST.reveal&&m.MAPST.reveal.seg],['map',0,0]);
    settle(m,null,1/30); assert.strictEqual(m.mapMarkState(1),1); assert.strictEqual(go(m,m.mapDirAt(0).fwd),'go');
  }],
  ['back on the map after clearing a level again, nothing appears',()=>{
    const m=game(); m.act('start'); m.G.open=5; m.mapPlace(2); m.mapEnter(); m.levelClear(); m.act('map');
    assert.deepStrictEqual([m.G.state,m.MAPST.at,m.MAPST.reveal,m.G.open],['map',2,null,5]);
  }],
  ['after the last level there is no more path to appear, and its marker reads as cleared',()=>{
    const m=game(), last=m.LEVELS.length-1; m.act('start'); m.G.open=last; m.mapPlace(last); m.mapEnter(); m.showWin(); m.primaryAction();
    assert.deepStrictEqual([m.G.state,m.MAPST.at,m.MAPST.reveal,m.mapMarkState(last)],['map',last,null,2]);
  }],
  ['leaving a level from the pause screen keeps lives, coins, score and form, and clears nothing',()=>{
    const m=game(); m.act('start'); m.mapEnter(); m.G.state='play'; m.G.score=900; m.G.coins=5; m.G.lives=2; m.player.form=1;
    m.togglePause(); assert.strictEqual(m.G.state,'pause'); m.act('map');
    assert.deepStrictEqual([m.G.state,m.G.score,m.G.coins,m.G.lives,m.player.form,m.G.open,m.MAPST.reveal],['map',900,5,2,1,0,null]);
  }],
  ['an arrow key or W A S D sets Blorp off, and the way north does not start the level',()=>{
    const KEY={N:['ArrowUp','KeyW'],E:['ArrowRight','KeyD'],S:['ArrowDown','KeyS'],W:['ArrowLeft','KeyA']};
    for(const k of [0,1]){ const m=game(); m.act('start'); m.G.open=m.LEVELS.length;
      for(const d of COMPASS){ let i=0; while(m.mapDirAt(i).fwd!==d) i++;
        m.mapPlace(i); m.keyDown(key(KEY[d][k])); m.keyUp(key(KEY[d][k]));
        assert(m.MAPST.walk&&m.MAPST.walk.seg===i,KEY[d][k]+' did not set him off from marker '+i); assert.strictEqual(m.G.state,'map'); } }
  }],
  ['Space, Enter, Z and K start the level Blorp stands on',()=>{
    for(const code of ['Space','Enter','KeyZ','KeyK']){ const m=game(); m.act('start'); m.G.open=4; m.mapPlace(3); m.keyDown(key(code));
      assert.deepStrictEqual([m.G.state,m.G.levelIdx],['card',3],code); }
  }],
  ['a key that is only repeating because it is held does not count as a press',()=>{
    const m=game(); m.act('start'); m.G.open=3;
    m.keyDown(Object.assign(key('ArrowRight'),{repeat:true})); m.keyDown(Object.assign(key('Space'),{repeat:true}));
    assert.strictEqual(m.MAPST.walk,null); assert.strictEqual(m.G.state,'map');
  }],
  ['holding an arrow key carries Blorp through a marker, and letting go stops him at the next',()=>{
    const m=game(), n=m.MAPNODES.length; m.act('start'); m.G.open=n;
    let i=0; while(m.mapDirAt(i).fwd!=='E'||m.mapDirAt(i+1).fwd!=='E') i++;
    m.mapPlace(i); m.keyDown(key('ArrowRight')); assert.strictEqual(m.heldDir(),'E');
    let t=0; do{ m.mapTick(1/60,m.heldDir(),false); assert(++t<20000); }while(m.MAPST.at<i+1||m.MAPST.walk===null);
    m.keyUp(key('ArrowRight')); assert.strictEqual(m.heldDir(),null);
    do{ m.mapTick(1/60,m.heldDir(),false); assert(++t<20000); }while(m.MAPST.walk);
    assert.strictEqual(m.MAPST.at,i+2);
  }],
  ['on the map the touch pad walks Blorp in all four directions',()=>{
    const PAD={N:'up',E:'right',S:'down',W:'left'}, m=game(); m.act('start'); m.G.open=m.LEVELS.length;
    for(const d of COMPASS){ let i=0; while(m.mapDirAt(i).fwd!==d) i++;
      m.mapPlace(i); m.mapInput(); m.tk[PAD[d]]=true; m.mapInput(); assert.strictEqual(m.heldDir(),d); m.tk[PAD[d]]=false;
      assert(m.MAPST.walk&&m.MAPST.walk.seg===i,'the '+PAD[d]+' key did not set him off from marker '+i); }
  }],
  ['a jump held from the level before does not start one on arriving at the map',()=>{
    const m=game(); m.tk.jump=true; m.act('start'); m.mapInput();
    assert.strictEqual(m.G.state,'map');
    m.tk.jump=false; m.mapInput(); m.tk.jump=true; m.mapInput();
    assert.strictEqual(m.G.state,'card');
  }],
  ['a direction held from the level before does not walk Blorp off on arriving at the map',()=>{
    const PAD={N:'up',E:'right',S:'down',W:'left'}, m=game(), flag=PAD[m.mapDirAt(0).fwd]; m.tk[flag]=true;
    m.act('start'); m.G.open=3; m.mapInput(); for(let k=0;k<20;k++) m.mapTick(1/60,m.heldDir(),false);
    assert.strictEqual(m.MAPST.walk,null); assert.strictEqual(m.MAPST.at,0);
    m.tk[flag]=false; m.mapInput(); m.tk[flag]=true; m.mapInput(); assert(m.MAPST.walk,'a fresh press did not set him off');
  }],
  ['arriving at a marker saves where Blorp stands',()=>{
    const s=storage(), m=game(s); m.act('start'); m.G.open=3; go(m,m.mapDirAt(0).fwd);
    assert.strictEqual(saved(s).level,1); assert.strictEqual(m.G.levelIdx,1);
  }]
];

function printMap(){
  const m=game(), W=m.MAP_W, D=m.MAP_D, I=m.ISLE, node=new Map(); m.MAPNODES.forEach((n,i)=>node.set(n.z*W+n.x,i));
  const head='    '+Array.from({length:W},(_,x)=>x%10===0?String(x/10|0):' ').join('')+'\n    '+Array.from({length:W},(_,x)=>x%10).join('');
  console.log('Regions and route (digits: a marker, by its place in its world; + path; = bridge or stair)\n'+head);
  for(let z=0;z<D;z++){ let r='';
    for(let x=0;x<W;x++){ const k=z*W+x;
      r+=node.has(k)?String(node.get(k)%5+1):I.route[k]>=0?(I.deck[k]?'=':'+'):I.kind[k]===m.MK_LAND?'mgcsdz'[I.world[k]]:I.kind[k]===m.MK_SEA?'~':'*'; }
    console.log(String(z).padStart(3)+' '+r); }
  console.log('\nHeights in steps (a=10 and so on; . sea; upper case floats)\n'+head);
  for(let z=0;z<D;z++){ let r='';
    for(let x=0;x<W;x++){ const k=z*W+x, h=m.mapStandH(x,z), c=h.toString(36); r+=h?(I.base[k]?c.toUpperCase():c):'.'; }
    console.log(String(z).padStart(3)+' '+r); }
}

if(process.argv.includes('--map')){ printMap(); process.exit(0); }
let bad=0;
for(const [name,run] of checks){
  try{ run(); console.log('ok   '+name); }
  catch(e){ bad++; console.log('FAIL '+name+'\n       '+String(e.message).split('\n')[0]); }
}
console.log(bad?bad+' of '+checks.length+' checks failed':'all '+checks.length+' checks pass');
process.exit(bad?1:0);
