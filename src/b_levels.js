/* ================= tiles & levels ================= */
const AIR=0,GROUND=1,BRICK=2,QBLOCK=3,USED=4,HARD=5,PIPE=6,HIDDEN=7,SEMI=8,SPIKE=9,COIN=10;
const SOLID=[0,1,1,1,1,1,1,0,0,0,0];
const H=16;

function LevelBuilder(W,theme,name){
  const t=new Uint8Array(W*H);
  const L={W,theme,name,tiles:t,contents:new Map(),enemies:[],pipes:[],plats:[],springs:[],firebars:[],start:{x:3.5,y:2},checkpoint:null,goal:null,boss:null,liquidY:1.3};
  const set=(x,y,id)=>{ if(x>=0&&x<W&&y>=0&&y<H) t[y*W+x]=id; };
  const B={
    L,
    fill(x0,y0,x1,y1,id){ for(let y=y0;y<=y1;y++) for(let x=x0;x<=x1;x++) set(x,y,id); return B; },
    ground(x0,x1,h){ return B.fill(x0,0,x1,(h||2)-1,GROUND); },
    /* B brick, ? coin block, M power-up block, S star block, L life block, m many-coin brick, s star brick,
       I hidden life, i hidden coin, H hard, = one-way ledge, C coin, ^ spikes, anything else: skip */
    row(x,y,s){ for(let i=0;i<s.length;i++){ const c=s[i],k=y*W+x+i;
      if(c==='B') set(x+i,y,BRICK);
      else if(c==='?') set(x+i,y,QBLOCK);
      else if(c==='M'){ set(x+i,y,QBLOCK); L.contents.set(k,'power'); }
      else if(c==='S'){ set(x+i,y,QBLOCK); L.contents.set(k,'star'); }
      else if(c==='L'){ set(x+i,y,QBLOCK); L.contents.set(k,'life'); }
      else if(c==='m'){ set(x+i,y,BRICK); L.contents.set(k,'multi'); }
      else if(c==='s'){ set(x+i,y,BRICK); L.contents.set(k,'star'); }
      else if(c==='I'){ set(x+i,y,HIDDEN); L.contents.set(k,'life'); }
      else if(c==='i') set(x+i,y,HIDDEN);
      else if(c==='H') set(x+i,y,HARD);
      else if(c==='=') set(x+i,y,SEMI);
      else if(c==='C') set(x+i,y,COIN);
      else if(c==='^') set(x+i,y,SPIKE);
    } return B; },
    coins(x,y,n){ for(let i=0;i<n;i++) set(x+i,y,COIN); return B; },
    arc(x,y,n){ for(let i=0;i<n;i++){ const u=(i/(n-1))*2-1; set(x+i,y+Math.round((1-u*u)*2),COIN); } return B; },
    stairs(x,n,dir,base){ base=base||2; for(let i=0;i<n;i++){ const h=(dir||1)>0?i+1:n-i; B.fill(x+i,base,x+i,base+h-1,HARD); } return B; },
    pipe(x,h,chomp,base){ base=base||2; B.fill(x,base,x+1,base+h-1,PIPE); L.pipes.push({x,y:base,h}); if(chomp) L.enemies.push({type:'chomper',x:x+1,y:base+h}); return B; },
    enemy(type,x,y,o){ L.enemies.push(Object.assign({type,x:x+0.5,y:y===undefined?2:y},o||{})); return B; },
    plat(x,y,w,axis,range,speed,phase){ L.plats.push({x,y,w,axis,range,speed,phase:phase||0}); return B; },
    spring(x,y){ L.springs.push({x:x+0.5,y:y||2}); return B; },
    firebar(x,y,n,speed,phase){ set(x,y,HARD); L.firebars.push({x:x+0.5,y:y+0.5,n:n||6,speed:speed||1.7,phase:phase||0}); return B; },
    spikes(x0,x1,y){ for(let x=x0;x<=x1;x++) set(x,y||2,SPIKE); return B; },
    checkpoint(x,y){ L.checkpoint={x:x+0.5,y:y||2}; return B; },
    goal(x){ set(x,2,HARD); L.goal={x}; return B; }
  };
  return B;
}

/* World 1: open grassland. Teaches blocks, stomps, shells, springs and clouds. */
function level1(){
  const B=LevelBuilder(204,'meadow','Gumdrop Meadow');
  B.ground(0,44).ground(47,74).ground(78,118).ground(126,160).ground(163,203);
  B.coins(8,3,3).row(14,5,'?').enemy('blob',19);
  B.row(21,5,'B?BMB').row(23,9,'?').enemy('blob',27);
  B.pipe(31,2).row(36,5,'I').enemy('blob',35).pipe(39,3).coins(39,6,2);
  B.arc(44,4,4);
  B.fill(49,2,57,3,GROUND).row(52,7,'?B?').enemy('shellby',54,4);
  B.spring(60).row(62,8,'======').coins(62,9,6).enemy('batty',64,5);
  B.row(68,5,'BBB').enemy('blob',70).enemy('blob',72);
  B.arc(74,4,5);
  B.row(80,5,'B?B').enemy('boing',85).pipe(88,3,true);
  B.checkpoint(93);
  B.row(96,5,'BmB').row(97,9,'?');
  B.enemy('shellby',101).enemy('blob',104).enemy('blob',105.5);
  B.stairs(108,4).row(114,5,'?S?');
  B.row(120,2,'==').row(123,3,'==').coins(120,4,2).coins(123,5,2).enemy('batty',122,7);
  B.row(128,5,'B?B?B').row(130,9,'M').enemy('blob',131).enemy('blob',133);
  B.enemy('spikit',137).pipe(141,3).pipe(147,2,true).enemy('boing',151);
  B.stairs(155,4).fill(159,2,160,5,HARD).coins(161,8,2).stairs(163,4,-1);
  B.row(170,5,'?B?').enemy('blob',172).enemy('blob',173.5).enemy('shellby',177);
  B.stairs(181,7).fill(188,2,188,8,HARD);
  B.goal(194);
  return B.L;
}

/* World 2: cave with a low roof, goo pits and moving ledges. */
function level2(){
  const B=LevelBuilder(202,'grotto','Glowshroom Grotto');
  B.ground(0,30).ground(37,72).ground(79,110).ground(121,150).ground(154,201);
  B.fill(0,12,201,15,GROUND);
  B.fill(10,11,15,11,GROUND).fill(44,10,50,11,GROUND).fill(90,11,97,11,GROUND).fill(129,9,134,11,GROUND).fill(160,10,168,11,GROUND);
  B.row(8,5,'B?B').enemy('blob',12);
  B.row(17,4,'==').row(21,6,'==').coins(17,5,2).coins(21,7,2).enemy('batty',25,6);
  B.plat(31,2,3,'x',3,1.3).coins(32,5,4);
  B.row(40,5,'?M?').enemy('boing',44).enemy('boing',48).enemy('spikit',52);
  B.spring(57).fill(61,2,72,5,GROUND);
  B.row(64,9,'B?B').enemy('shellby',67,6).coins(68,7,4);
  B.plat(74,2,3,'y',4,1.2);
  B.checkpoint(82);
  B.row(85,5,'B?BsB').enemy('batty',89,7,{ry:0.8}).enemy('spikit',95);
  B.pipe(99,3,true).row(102,7,'===').coins(102,8,3).pipe(106,2);
  B.plat(111.3,2,3,'x',6.4,1.0).enemy('batty',116,4.6,{rx:2.5,ry:0.8}).coins(113,5,6);
  B.row(124,5,'?B?B?').enemy('boing',128).enemy('boing',132).row(136,5,'I');
  B.enemy('shellby',138).enemy('blob',141).enemy('blob',143).enemy('blob',145);
  B.spring(148).row(149,8,'====').coins(149,9,4);
  B.spikes(158,159).row(162,5,'BMB').enemy('spikit',166);
  B.pipe(170,3,true).enemy('batty',175,6);
  B.stairs(180,5).fill(185,2,185,6,HARD);
  B.goal(191);
  return B.L;
}

/* World 3: castle over lava, ember chains, and King Grump at the end. */
function level3(){
  const B=LevelBuilder(216,'castle','Castle Crumble');
  B.ground(0,18).ground(22,34).ground(43,60).ground(64,100).ground(111,140).ground(144,160).ground(165,215);
  B.fill(0,13,215,15,GROUND).fill(44,11,58,12,GROUND).fill(84,12,99,12,GROUND).fill(124,11,139,12,GROUND);
  B.row(7,5,'BMB').enemy('spikit',13).arc(18,4,5);
  B.firebar(27,5,6,1.7).enemy('spikit',31);
  B.plat(35.3,2,3,'x',4.4,1.0).coins(37,5,4);
  B.row(46,5,'B?B').enemy('spikit',48).enemy('spikit',51).enemy('shellby',55).pipe(57,3,true);
  B.enemy('batty',62,5,{rx:2});
  B.stairs(66,3).fill(69,2,72,4,HARD).row(76,5,'?s?').spikes(79,80);
  B.checkpoint(84);
  B.row(87,5,'BMB').enemy('boing',90).enemy('boing',93).firebar(96,5,6,-1.7);
  B.plat(102,2,2.5,'y',4,1.1,0).plat(106.5,2,2.5,'y',4,1.1,Math.PI).coins(103,8,1).coins(107,8,1);
  B.spring(113).row(116,8,'=====').coins(116,9,5);
  B.enemy('spikit',118).spikes(121,122);
  B.row(126,5,'?B?B?').row(128,9,'I').enemy('shellby',129).enemy('blob',132).enemy('blob',134).pipe(136,4,true);
  B.arc(140,4,5);
  B.stairs(146,4).fill(150,2,153,5,HARD).firebar(157,5,6,1.9);
  B.plat(161.2,2,2,'x',1.6,1.6);
  B.row(168,5,'M?');
  B.fill(207,2,215,12,GROUND).row(184,5,'===').row(197,5,'===');
  B.L.boss={x:200,y:2,x0:180,x1:205};
  return B.L;
}
const LEVELS=[level1,level2,level3];
