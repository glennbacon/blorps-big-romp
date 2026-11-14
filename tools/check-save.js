#!/usr/bin/env node
/* Checks that progress is saved in the browser and offered back as "Continue" on the title screen.

   Each check starts the real game code (see game.js) the way a page load would, with a stand-in for the browser's
   localStorage that keeps its contents from one load to the next.

     node tools/check-save.js
*/
'use strict';
const assert=require('assert');
const {loadGame}=require('./game.js');

function storage(){ const m=new Map(); return {map:m,getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>{ m.set(k,String(v)); },removeItem:k=>{ m.delete(k); }}; }
const saved=s=>{ assert.strictEqual(s.map.size,1,'expected exactly one saved entry, found '+s.map.size); return JSON.parse([...s.map.values()][0]); };
/* one page load; the probe hands back the parts of the game the checks drive */
const probe=function(){ return {G,player,act,primaryAction,loadLevel,levelClear,afterDeath,showWin}; };
const page=s=>loadGame(probe,s);
const continueShown=pg=>{ const b=pg.els['btn-continue']; return !!b&&b.hidden===false; };
/* play to the end of level 2-2 (number 6, counting from 0) with a recognisable score, coins, lives and form */
function clearLevel22(s){ const g=page(s).api; g.act('start'); g.loadLevel(6,false); g.G.score=1234; g.G.coins=7; g.G.lives=4; g.player.form=2; g.levelClear(); }

const checks=[
  ['a first visit offers no Continue',()=>{
    assert(!continueShown(page(storage())));
  }],
  ['starting a new game saves the first level',()=>{
    const s=storage(); page(s).api.act('start');
    assert.deepStrictEqual(saved(s),{level:0,score:0,coins:0,lives:3,form:0});
  }],
  ['clearing a level saves the next one, with the score, coins, lives and form',()=>{
    const s=storage(); clearLevel22(s);
    assert.deepStrictEqual(saved(s),{level:7,score:1234,coins:7,lives:4,form:2});
  }],
  ['after a reload the title offers Continue at the saved level',()=>{
    const s=storage(); clearLevel22(s);
    const pg=page(s);
    assert(continueShown(pg),'Continue is not shown');
    assert.strictEqual(pg.els['btn-continue'].textContent,'Continue at 2-3');
  }],
  ['with a save, the main action on the title continues and restores everything',()=>{
    const s=storage(); clearLevel22(s);
    const g=page(s).api; g.primaryAction();
    assert.deepStrictEqual({level:g.G.levelIdx,score:g.G.score,coins:g.G.coins,lives:g.G.lives,form:g.player.form,state:g.G.state},
      {level:7,score:1234,coins:7,lives:4,form:2,state:'card'});
  }],
  ['losing a life saves the lives that are left',()=>{
    const s=storage(), g=page(s).api; g.act('start'); g.afterDeath();
    assert.strictEqual(saved(s).lives,2);
  }],
  ['game over saves a fresh start of the same level',()=>{
    const s=storage(), g=page(s).api; g.act('start'); g.loadLevel(9,false); g.G.lives=1; g.G.score=500; g.G.coins=3; g.player.form=1; g.afterDeath();
    assert.strictEqual(g.G.state,'over');
    assert.deepStrictEqual(saved(s),{level:9,score:0,coins:0,lives:3,form:0});
  }],
  ['finishing the game clears the save',()=>{
    const s=storage(), g=page(s).api; g.act('start'); saved(s); g.showWin();
    assert.strictEqual(s.map.size,0);
    assert(!continueShown(page(s)));
  }],
  ['a damaged save is ignored',()=>{
    const s=storage(); page(s).api.act('start'); const key=[...s.map.keys()][0];
    assert(key,'nothing was saved, so there is no save to damage');
    for(const bad of ['not json','null','[]','{"level":999}','{"level":-1}','{"level":"2"}','{"level":1.5}']){
      s.setItem(key,bad);
      const pg=page(s); assert(!continueShown(pg),'Continue shown for '+bad);
      pg.api.primaryAction(); assert.strictEqual(pg.api.G.levelIdx,0,'did not start a new game for '+bad);
    }
  }],
  ['a browser that blocks storage still plays',()=>{
    const boom=()=>{ throw new Error('storage is blocked'); };
    for(const s of [{getItem:boom,setItem:boom,removeItem:boom},undefined]){
      const g=page(s).api; g.act('start'); assert.strictEqual(g.G.state,'card');
      g.levelClear(); g.G.lives=1; g.afterDeath(); g.showWin();
    }
  }]
];

let bad=0;
for(const [name,run] of checks){
  try{ run(); console.log('ok   '+name); }
  catch(e){ bad++; console.log('FAIL '+name+'\n       '+String(e.message).split('\n')[0]); }
}
console.log(bad?bad+' of '+checks.length+' checks failed':'all '+checks.length+' checks pass');
process.exit(bad?1:0);
