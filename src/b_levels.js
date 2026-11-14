/* ================= tiles & levels ================= */
const AIR=0,GROUND=1,BRICK=2,QBLOCK=3,USED=4,HARD=5,PIPE=6,HIDDEN=7,SEMI=8,SPIKE=9,COIN=10,ICE=11;
const SOLID=[0,1,1,1,1,1,1,0,0,0,0,1];
const H=16;

function LevelBuilder(W,theme){
  const t=new Uint8Array(W*H);
  const L={W,theme,name:'',tiles:t,contents:new Map(),enemies:[],pipes:[],plats:[],springs:[],firebars:[],start:{x:3.5,y:2},checkpoint:null,goal:null,boss:null,liquidY:1.3};
  const set=(x,y,id)=>{ if(x>=0&&x<W&&y>=0&&y<H) t[y*W+x]=id; };
  const B={
    L,
    fill(x0,y0,x1,y1,id){ for(let y=y0;y<=y1;y++) for(let x=x0;x<=x1;x++) set(x,y,id); return B; },
    ground(x0,x1,h){ return B.fill(x0,0,x1,(h||2)-1,GROUND); },
    /* a strip of slippery ice; with no y it replaces the top of ordinary ground */
    ice(x0,x1,y){ return B.fill(x0,y===undefined?1:y,x1,y===undefined?1:y,ICE); },
    /* B brick, ? coin block, M power-up block, S star block, L life block, m many-coin brick, s star brick,
       I hidden life, i hidden coin, H hard, # ice, = one-way ledge, C coin, ^ spikes, anything else: skip */
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
      else if(c==='#') set(x+i,y,ICE);
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
    goal(x){ set(x,2,HARD); L.goal={x}; return B; },
    boss(x,x0,x1,hp){ L.boss={x,y:2,x0,x1,hp:hp||9}; return B; }
  };
  return B;
}

/* ---------- World 1: Gumdrop Meadow. Open grassland: blocks, stomps, shells, springs and clouds. ---------- */
function w1l1(){
  const B=LevelBuilder(204,'meadow');
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

/* 1-2: pipes, a hill and a first climb. */
function w1l2(){
  const B=LevelBuilder(186,'meadow');
  B.ground(0,30).ground(34,62).ground(66,96).ground(100,131).ground(135,185);
  B.coins(6,3,4).enemy('blob',12).row(15,5,'B?B');
  B.pipe(20,2).enemy('blob',24).pipe(27,3,true).arc(30,4,5);
  B.ground(38,44,4).row(40,7,'?M?').enemy('blob',41,4).enemy('boing',48);
  B.pipe(52,2,true).row(55,5,'BBmBB').enemy('shellby',58).arc(62,4,5);
  B.stairs(68,3).ground(71,76,5).coins(72,6,4).stairs(77,3,-1);
  B.enemy('blob',83).enemy('blob',85).row(86,5,'?B?').enemy('spikit',90);
  B.checkpoint(94);
  B.row(97,3,'===').coins(97,4,3);
  B.pipe(104,2).pipe(109,3,true).pipe(114,4).coins(104,5,2).coins(109,6,2).coins(114,7,2);
  B.enemy('boing',119).row(122,5,'B?B').row(123,9,'L').enemy('blob',126).enemy('blob',128).arc(131,4,5);
  B.spring(138).row(140,8,'=====').coins(140,9,5).enemy('batty',146,6);
  B.row(150,5,'?B?').enemy('shellby',153).enemy('blob',157).enemy('blob',159);
  B.stairs(163,6).fill(169,2,169,7,HARD);
  B.goal(175);
  return B.L;
}

/* 1-3: long drops crossed on cloud ledges. */
function w1l3(){
  const B=LevelBuilder(176,'meadow');
  B.ground(0,22).ground(40,52).ground(74,84).ground(108,121).ground(138,175);
  B.row(8,5,'?M?').enemy('blob',13).enemy('blob',17).spring(20);
  B.row(24,4,'===').row(29,6,'===').row(34,5,'===').coins(24,5,3).coins(29,7,3).coins(34,6,3).enemy('batty',31,10,{rx:2.5});
  B.row(44,5,'B?B').enemy('shellby',47).enemy('boing',50);
  B.row(54,3,'==').row(58,5,'===').row(63,7,'====').row(69,5,'===').coins(58,6,3).coins(63,8,4).coins(69,6,3).enemy('batty',66,11,{rx:3,ry:0.8});
  B.checkpoint(77);
  B.row(79,5,'?').enemy('spikit',82);
  B.row(86,4,'===').ground(91,92,4).spring(91,4).row(95,9,'=====').coins(95,10,5).row(102,6,'===').coins(102,7,3).enemy('batty',99,5,{rx:2});
  B.row(111,5,'B?B?B').enemy('blob',112).enemy('shellby',116).enemy('boing',119);
  B.row(123,3,'===').row(128,5,'===').row(133,6,'===').coins(123,4,3).coins(128,6,3).coins(133,7,3).enemy('batty',130,9,{rx:3});
  B.row(142,5,'?B?').row(146,5,'I').enemy('blob',145).enemy('blob',148).enemy('spikit',152);
  B.stairs(155,5).fill(160,2,160,6,HARD);
  B.goal(165);
  return B.L;
}

/* 1-4: brick walls, a shell alley and a stepped hill. */
function w1l4(){
  const B=LevelBuilder(196,'meadow');
  B.ground(0,58).ground(62,110).ground(114,150).ground(155,195);
  B.row(7,5,'BB?BB').enemy('blob',10).enemy('blob',14);
  B.fill(18,2,19,3,HARD).row(22,5,'?mB').enemy('shellby',25).fill(30,2,31,4,HARD);
  B.enemy('boing',36).pipe(40,3,true).row(44,5,'B?B').row(45,9,'M').enemy('blob',47);
  B.stairs(51,4).fill(55,2,56,5,HARD).arc(57,7,5).fill(62,2,63,5,HARD).stairs(64,4,-1);
  B.enemy('spikit',72).row(75,5,'?B?B?').enemy('blob',78).enemy('blob',80).enemy('shellby',84);
  B.pipe(88,2).pipe(93,4,true);
  B.checkpoint(98);
  B.row(101,5,'BBB').row(105,8,'BsB').arc(110,4,5);
  B.ground(117,123,4).ground(124,130,6).ground(131,137,4).enemy('blob',119,4).enemy('boing',127,6).enemy('blob',134,4).coins(125,8,5);
  B.row(141,5,'?B?').enemy('shellby',144).enemy('spikit',147);
  B.row(151,3,'===').coins(151,4,3);
  B.row(160,5,'B?B').enemy('blob',158).enemy('blob',162).enemy('blob',164).pipe(167,3,true);
  B.stairs(172,7).fill(179,2,179,8,HARD);
  B.goal(185);
  return B.L;
}

/* 1-5: the long way to the edge of the meadow. */
function w1l5(){
  const B=LevelBuilder(230,'meadow');
  B.ground(0,26).ground(31,48).ground(53,80).ground(85,99).ground(111,140).ground(145,170).ground(175,229);
  B.row(6,5,'?B?').enemy('blob',10).enemy('blob',12).enemy('spikit',18);
  B.pipe(22,3,true).arc(26,5,6);
  B.enemy('shellby',36).row(38,5,'BMB').row(39,9,'?').enemy('boing',44).arc(48,5,6);
  B.stairs(55,3).ground(58,66,5).stairs(67,3,-1).enemy('blob',60,5).enemy('blob',63,5).row(61,8,'?m?');
  B.enemy('spikit',73).pipe(76,2,true);
  B.row(81,3,'===').coins(81,4,3);
  B.row(88,5,'B?B').enemy('shellby',91).enemy('blob',95).spring(97);
  B.row(101,8,'====').row(107,6,'===').row(102,3,'==').coins(101,9,4).coins(107,7,3).enemy('batty',104,5,{rx:2.5,ry:0.7});
  B.checkpoint(114);
  B.row(117,5,'?B?B?').row(119,9,'S').enemy('blob',118).enemy('blob',120).enemy('boing',124);
  B.row(128,5,'BB').pipe(132,4,true).enemy('boing',136).arc(140,5,6);
  B.ground(148,152,4).ground(153,158,6).ground(159,163,4).enemy('spikit',150,4).enemy('shellby',155,6).coins(154,8,4);
  B.enemy('blob',166).enemy('blob',168);
  B.row(171,4,'==').row(173,6,'=').coins(171,5,2);
  B.row(179,5,'B?B').row(182,5,'I').enemy('blob',180).enemy('spikit',185).enemy('shellby',190).enemy('boing',194);
  B.pipe(197,2).pipe(201,3,true);
  B.stairs(205,7).fill(212,2,212,8,HARD);
  B.goal(218);
  return B.L;
}

/* ---------- World 2: Glowshroom Grotto. A cave with a low roof, goo pits and moving ledges. ---------- */
function w2l1(){
  const B=LevelBuilder(202,'grotto');
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

/* 2-2: ferries across the goo. */
function w2l2(){
  const B=LevelBuilder(196,'grotto');
  B.ground(0,24).ground(34,52).ground(66,88).ground(104,126).ground(141,195);
  B.fill(0,12,195,15,GROUND).fill(36,10,44,11,GROUND).fill(70,9,80,11,GROUND).fill(108,10,118,11,GROUND).fill(150,9,160,11,GROUND);
  B.row(6,5,'B?B').enemy('blob',10).enemy('boing',15).enemy('blob',20);
  B.plat(25,2,3,'x',6,1.1).coins(27,5,5);
  B.row(38,5,'?M?').enemy('spikit',42).enemy('boing',47);
  B.plat(53,2,3,'y',4,1.0).plat(58,6,3,'x',4,1.2,1.5).coins(54,8,2).coins(60,8,4);
  B.row(72,5,'B?B').enemy('shellby',76).enemy('blob',80).enemy('blob',82).pipe(84,3,true);
  B.row(90,4,'==').plat(93,3,3,'x',6,1.3).coins(94,5,6);
  B.checkpoint(106);
  B.row(110,5,'?B?').enemy('spikit',112).enemy('boing',116).enemy('boing',120).spring(123);
  B.row(125,8,'===').coins(125,9,3).plat(129,8,3,'x',4,1.0).plat(137,4,3,'y',4,1.1,3.14);
  B.row(145,5,'B?BsB').enemy('batty',148,8,{ry:0.8}).enemy('shellby',152).enemy('spikit',156).enemy('blob',160).enemy('blob',162);
  B.pipe(165,3,true).row(169,5,'I');
  B.stairs(174,5).fill(179,2,179,6,HARD);
  B.goal(185);
  return B.L;
}

/* 2-3: up and over on stacked shroom ledges. */
function w2l3(){
  const B=LevelBuilder(182,'grotto');
  B.ground(0,40).ground(46,96).ground(102,140).ground(146,181);
  B.fill(0,12,181,15,GROUND);
  B.row(6,5,'?B?').enemy('blob',9).enemy('spikit',14);
  B.row(18,4,'==').row(22,6,'==').ground(26,33,8).coins(18,5,2).coins(22,7,2).enemy('blob',29,8).enemy('blob',31,8);
  B.row(35,5,'==').row(42,3,'===').coins(42,4,3);
  B.row(50,5,'BMB').enemy('boing',53).enemy('boing',57).spring(60);
  B.row(62,8,'====').coins(62,9,4).row(65,4,'==').ground(68,75,6).enemy('spikit',70,6).enemy('spikit',73,6).enemy('batty',71,9,{rx:2.5,ry:0.6});
  B.enemy('shellby',82).row(84,5,'?B?').enemy('blob',88).pipe(91,3,true);
  B.plat(97,2,3,'y',5,1.2).ground(102,108,7).coins(103,8,5).enemy('blob',105,7).row(110,5,'==');
  B.checkpoint(113);
  B.row(117,5,'B?B').enemy('spikit',119).enemy('boing',123).enemy('batty',126,7,{rx:2.5});
  B.row(129,4,'==').row(133,6,'==').row(137,8,'==').row(141,9,'===').coins(129,5,2).coins(133,7,2).coins(137,9,2).coins(141,10,3);
  B.row(150,5,'?B?').row(156,5,'I').enemy('shellby',153).enemy('spikit',157).enemy('blob',160);
  B.stairs(163,4).fill(167,2,167,5,HARD);
  B.goal(171);
  return B.L;
}

/* 2-4: a squeeze under low rock. */
function w2l4(){
  const B=LevelBuilder(190,'grotto');
  B.ground(0,50).ground(55,104).ground(110,150).ground(156,189);
  B.fill(0,12,189,15,GROUND).fill(12,6,34,11,GROUND).fill(58,7,78,11,GROUND).fill(116,8,146,11,GROUND);
  B.row(5,5,'?').enemy('blob',9);
  B.enemy('spikit',16).enemy('spikit',22).spikes(27,28).enemy('shellby',31).coins(26,4,4);
  B.row(38,5,'BMB').enemy('boing',42).pipe(46,2,true).arc(50,4,6);
  B.fill(62,2,63,3,HARD).fill(68,2,69,4,HARD).fill(74,2,75,3,HARD).enemy('blob',65).enemy('blob',71).coins(62,4,2).coins(68,5,2).coins(74,4,2);
  B.enemy('shellby',82).row(84,5,'?B?').enemy('spikit',88).enemy('batty',93,6,{rx:2,ry:0.6}).spikes(97,98);
  B.plat(105,2,2.5,'x',2.5,1.4);
  B.checkpoint(112);
  B.row(118,5,'B?B').enemy('boing',121).pipe(125,2,true).pipe(131,3,true).enemy('spikit',136).spikes(140,141).enemy('shellby',144);
  B.row(152,3,'===').coins(152,4,3);
  B.row(160,5,'?B?').enemy('blob',163).enemy('blob',165).enemy('boing',169);
  B.stairs(172,4).fill(176,2,176,5,HARD);
  B.goal(180);
  return B.L;
}

/* 2-5: the goo lake. */
function w2l5(){
  const B=LevelBuilder(222,'grotto');
  B.ground(0,22).ground(52,70).ground(100,118).ground(150,164).ground(176,221);
  B.fill(0,12,221,15,GROUND).fill(56,10,66,11,GROUND).fill(104,9,114,11,GROUND).fill(180,10,196,11,GROUND);
  B.row(6,5,'BMB').enemy('blob',10).enemy('spikit',15);
  B.plat(24,2,3,'x',5,1.2).row(34,4,'===').plat(39,4,3,'y',4,1.0).row(44,8,'===').row(48,5,'==').coins(34,5,3).coins(44,9,3).coins(48,6,2);
  B.row(55,5,'?B?').enemy('shellby',58).enemy('boing',62).enemy('boing',66);
  B.plat(72,2,3,'x',7,1.0).plat(84,2,3,'y',5,1.3).row(89,7,'==').plat(92,7,3,'x',4,1.4,1.0).coins(89,8,2).enemy('batty',79,5,{rx:2.5});
  B.checkpoint(103);
  B.row(107,5,'B?BsB').enemy('blob',110).enemy('blob',112).enemy('shellby',115);
  B.row(120,3,'==').plat(123,3,2.5,'x',6,1.5).plat(133,3,2.5,'y',5,1.1,1.6).plat(138,8,2.5,'x',6,1.3).row(147,6,'==').enemy('batty',128,6,{rx:3}).enemy('batty',142,10,{rx:3,ry:0.5});
  B.row(153,5,'?M?').enemy('boing',156).enemy('spikit',160);
  B.plat(166,2,3,'x',6,1.6).enemy('batty',170,5,{rx:3,ry:1.5,sp:1.6});
  B.enemy('shellby',180).enemy('blob',184).enemy('blob',186).enemy('spikit',190).pipe(194,3,true).row(198,5,'I');
  B.stairs(202,5).fill(207,2,207,6,HARD);
  B.goal(211);
  return B.L;
}

/* ---------- World 3: Castle Crumble. Lava, spinning ember chains, and King Grump at the end. ---------- */
/* 3-1: first ember chains. */
function w3l1(){
  const B=LevelBuilder(190,'castle');
  B.ground(0,40).ground(44,86).ground(90,128).ground(133,189);
  B.fill(0,13,189,15,GROUND).fill(48,11,60,12,GROUND).fill(100,11,116,12,GROUND);
  B.row(7,5,'B?B').enemy('spikit',11).enemy('blob',16);
  B.firebar(22,5,5,1.5).enemy('shellby',28).row(31,5,'BMB').pipe(36,2,true).arc(40,4,5);
  B.enemy('spikit',48).firebar(53,5,6,-1.6).enemy('spikit',58);
  B.row(62,5,'?B?').row(63,9,'?').enemy('boing',66).enemy('boing',70);
  B.stairs(74,3).fill(77,2,82,4,HARD).firebar(79,8,5,1.8).stairs(83,3,-1);
  B.checkpoint(93);
  B.row(97,5,'B?B').enemy('spikit',100).spikes(104,105).enemy('shellby',109).firebar(113,5,6,1.7).spikes(118,119);
  B.enemy('blob',122).enemy('blob',124).pipe(126,3,true);
  B.row(137,5,'?S?').enemy('boing',141).firebar(146,5,6,-1.9).enemy('spikit',151).enemy('spikit',155).row(158,5,'B?B').enemy('shellby',162);
  B.stairs(166,6).fill(172,2,172,7,HARD);
  B.goal(178);
  return B.L;
}

/* 3-2: ferries over the lava. */
function w3l2(){
  const B=LevelBuilder(200,'castle');
  B.ground(0,20).ground(36,50).ground(72,92).ground(112,128).ground(146,199);
  B.fill(0,13,199,15,GROUND).fill(38,11,48,12,GROUND).fill(76,11,90,12,GROUND).fill(150,11,170,12,GROUND);
  B.row(6,5,'?M?').enemy('spikit',10).enemy('blob',15);
  B.plat(22,2,3,'x',9,1.0).firebar(28,6,6,1.6);
  B.row(39,5,'B?B').enemy('shellby',42).enemy('spikit',46);
  B.plat(52,2,3,'y',4,1.2).row(57,6,'===').plat(62,6,3,'x',5,1.2).coins(57,7,3).enemy('batty',60,10,{rx:2,ry:0.6});
  B.checkpoint(75);
  B.row(78,5,'?B?').enemy('boing',81).firebar(85,5,6,1.8).enemy('spikit',89);
  B.row(94,3,'==').plat(97,3,3,'x',4,1.4).ground(106,108).firebar(107,5,6,2.0);
  B.row(115,5,'BsB').enemy('spikit',117).enemy('blob',121).enemy('blob',123).pipe(125,3,true);
  B.plat(130,2,2.5,'y',4,1.1,0).plat(135,2,2.5,'y',4,1.1,3.14).plat(140,2,2.5,'y',4,1.1,0).coins(131,8,1).coins(136,8,1).coins(141,8,1);
  B.row(152,5,'?M?').enemy('boing',155).enemy('boing',159).firebar(164,5,6,-1.8).enemy('spikit',168).spikes(172,173);
  B.stairs(177,5).fill(182,2,182,6,HARD);
  B.goal(188);
  return B.L;
}

/* 3-3: spikes below, planks above. */
function w3l3(){
  const B=LevelBuilder(188,'castle');
  B.ground(0,60).ground(66,120).ground(126,187);
  B.fill(0,13,187,15,GROUND).fill(14,9,40,12,GROUND).fill(70,9,96,12,GROUND).fill(130,10,150,12,GROUND);
  B.row(6,5,'B?B').enemy('blob',10);
  B.spikes(17,20).row(17,4,'====').enemy('spikit',23).spikes(25,29).row(25,4,'=====').spikes(34,37).row(34,5,'====').coins(17,5,4).coins(25,5,5).coins(34,6,4);
  B.row(44,5,'?M?').enemy('shellby',47).enemy('boing',51).pipe(55,3,true);
  B.plat(61,2,2.5,'x',2.5,1.6);
  B.pipe(72,2,true).firebar(78,5,6,1.7).pipe(83,2,true).spikes(87,89).row(87,4,'===').enemy('spikit',93);
  B.checkpoint(99);
  B.row(102,5,'B?B').row(103,9,'L').enemy('blob',105).enemy('blob',107).enemy('shellby',111);
  B.stairs(114,4).fill(118,2,120,5,HARD).fill(126,2,128,5,HARD).stairs(129,4,-1);
  B.firebar(137,5,6,1.8).enemy('spikit',141).firebar(146,5,6,-1.8).spikes(151,152).enemy('boing',156).enemy('boing',160);
  B.row(163,5,'?B?').enemy('shellby',166);
  B.stairs(169,4).fill(173,2,173,5,HARD);
  B.goal(177);
  return B.L;
}

/* 3-4: the gauntlet before the throne room. */
function w3l4(){
  const B=LevelBuilder(206,'castle');
  B.ground(0,24).ground(30,56).ground(74,100).ground(118,150).ground(156,205);
  B.fill(0,13,205,15,GROUND).fill(34,11,52,12,GROUND).fill(78,11,96,12,GROUND).fill(160,11,180,12,GROUND);
  B.row(5,5,'BMB').enemy('spikit',9).firebar(14,5,6,1.8).enemy('spikit',19);
  B.row(26,3,'===');
  B.firebar(36,5,6,1.8).firebar(43,5,6,-1.8,1.0).enemy('shellby',48).row(50,5,'?B?').enemy('boing',54);
  B.plat(58,2,3,'y',5,1.2).row(63,7,'===').plat(67,5,3,'x',3,1.5).coins(63,8,3);
  B.spikes(80,81).enemy('spikit',84).firebar(88,5,6,2.0).spikes(92,93).enemy('blob',96).enemy('blob',98);
  B.row(102,3,'==').plat(105,3,2.5,'x',3,1.6).plat(112,3,2.5,'y',4,1.3).enemy('batty',109,8,{rx:3});
  B.checkpoint(121);
  B.row(124,5,'?M?').enemy('boing',127).enemy('boing',131).pipe(134,3,true).firebar(140,5,6,-1.9).enemy('spikit',144).enemy('shellby',147);
  B.row(152,3,'===');
  B.firebar(162,5,6,1.9).firebar(171,5,6,-1.9,2.0).enemy('spikit',176).row(179,5,'B?B').enemy('shellby',183);
  B.stairs(187,5).fill(192,2,192,6,HARD);
  B.goal(196);
  return B.L;
}

/* 3-5: King Grump's first stand. He gets away. */
function w3l5(){
  const B=LevelBuilder(216,'castle');
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
  B.boss(200,180,205);
  return B.L;
}
/* ---------- World 4: Snowcone Summit. Slippery ice, and icicles that drop when Blorp walks under them. ---------- */
/* 4-1: first frost. */
function w4l1(){
  const B=LevelBuilder(192,'snow');
  B.ground(0,46).ground(50,92).ground(96,140).ground(145,191);
  B.row(7,5,'?B?').enemy('blob',11).ice(16,24).coins(18,3,5);
  B.enemy('blob',28).row(31,5,'BMB').enemy('boing',36).ice(39,46).arc(45,4,6);
  B.row(54,6,'HHHH').enemy('icicle',55,5).enemy('icicle',57,5).coins(54,7,4);
  B.enemy('shellby',62).ice(66,78).row(70,5,'?B?').enemy('blob',72).enemy('blob',76);
  B.pipe(82,2,true).pipe(87,3).arc(92,4,5);
  B.checkpoint(99);
  B.ground(103,110,4).ice(103,110,3).enemy('spikit',106,4);
  B.row(114,6,'HHHHH').enemy('icicle',114,5).enemy('icicle',116,5).enemy('icicle',118,5).enemy('boing',122);
  B.ice(124,140).row(127,5,'B?B').enemy('shellby',131).enemy('blob',136).arc(140,4,6);
  B.row(150,5,'?S?').enemy('blob',153).enemy('blob',155).enemy('spikit',160).ice(162,170);
  B.stairs(172,5).fill(177,2,177,6,HARD);
  B.goal(181);
  return B.L;
}

/* 4-2: icy edges. */
function w4l2(){
  const B=LevelBuilder(198,'snow');
  B.ground(0,30).ground(35,60).ground(66,90).ground(104,134).ground(140,197);
  B.row(6,5,'B?B').enemy('blob',9).enemy('spikit',14);
  B.ground(18,24,4).ice(18,24,3).coins(19,5,5).ice(25,30);
  B.ice(35,42).enemy('blob',38).row(44,5,'?M?').enemy('shellby',48).row(51,6,'HHH').enemy('icicle',51,5).enemy('icicle',53,5);
  B.stairs(56,3).ground(59,60,5);
  B.ice(66,74).enemy('boing',72).enemy('boing',78).row(80,5,'B?B').pipe(86,3,true);
  B.row(92,4,'==').row(96,5,'###').row(101,4,'==').coins(96,6,3);
  B.checkpoint(107);
  B.row(110,5,'?B?').enemy('spikit',112).ice(114,126).enemy('shellby',118).enemy('blob',123).row(119,6,'HHHH').enemy('icicle',120,5).enemy('icicle',122,5);
  B.spring(130).row(132,8,'====').coins(132,9,4);
  B.ice(140,150).enemy('blob',146).pipe(152,2).pipe(157,4,true).row(162,5,'B?B').enemy('boing',166).ice(168,176).enemy('spikit',172);
  B.stairs(179,5).fill(184,2,184,6,HARD);
  B.goal(188);
  return B.L;
}

/* 4-3: the frozen lake. */
function w4l3(){
  const B=LevelBuilder(200,'snow');
  B.ground(0,70).ground(84,120).ground(136,199);
  B.row(5,5,'?M?').enemy('blob',9).ice(13,66);
  B.enemy('spikit',20).row(23,5,'B?B').enemy('spikit',28).fill(33,2,34,2,HARD).enemy('shellby',39).fill(44,2,45,3,HARD);
  B.enemy('boing',49).row(52,6,'HHHHHH').enemy('icicle',53,5).enemy('icicle',55,5).enemy('icicle',57,5).enemy('spikit',62).pipe(67,2,true);
  B.plat(72,2,3,'x',8,1.1).enemy('batty',78,5,{rx:3});
  B.checkpoint(87);
  B.ice(90,116).row(93,5,'?B?').enemy('blob',96).enemy('blob',98).enemy('spikit',104).fill(108,2,109,3,HARD).enemy('shellby',114).row(111,6,'HHH').enemy('icicle',111,5).enemy('icicle',113,5);
  B.row(123,3,'###').plat(127,3,2.5,'y',4,1.2).row(132,5,'###').coins(123,5,3).coins(132,7,3);
  B.ice(138,160).enemy('boing',142).enemy('spikit',148).row(150,5,'B?B').row(151,9,'S').enemy('spikit',155);
  B.pipe(163,3,true).enemy('shellby',168).ice(170,178).enemy('blob',174);
  B.stairs(181,5).fill(186,2,186,6,HARD);
  B.goal(190);
  return B.L;
}

/* 4-4: the icicle climb. */
function w4l4(){
  const B=LevelBuilder(196,'snow');
  B.ground(0,34).ground(40,84).ground(92,130).ground(136,195);
  B.row(6,5,'B?B').enemy('blob',10).enemy('boing',15);
  B.ground(19,22,3).ground(23,26,4).ground(27,34,5).ice(27,34,4).enemy('spikit',30,5);
  B.ice(40,48).row(44,5,'?M?').enemy('shellby',52).spring(56);
  B.ground(58,70,7).ice(58,70,6).row(60,11,'HHHHHHHHH').enemy('icicle',61,10).enemy('icicle',63,10).enemy('icicle',65,10).enemy('icicle',67,10).coins(61,8,7);
  B.enemy('blob',76).enemy('blob',78).pipe(81,2,true);
  B.row(86,3,'==').row(89,4,'##');
  B.checkpoint(95);
  B.row(98,5,'B?B').enemy('spikit',101).ice(103,128).row(106,6,'HHHHHHHHHHH').enemy('icicle',107,5).enemy('icicle',109,5).enemy('icicle',111,5).enemy('icicle',113,5).enemy('icicle',115,5);
  B.enemy('blob',110).enemy('shellby',118).fill(121,2,122,3,HARD).enemy('boing',126);
  B.row(132,3,'===');
  B.ground(140,146,4).ice(140,146,3).ground(147,153,6).ice(147,153,5).ground(154,160,4).enemy('spikit',150,6).enemy('blob',157,4).coins(148,8,5);
  B.row(164,5,'?B?').enemy('shellby',167).pipe(171,3,true);
  B.stairs(176,5).fill(181,2,181,6,HARD);
  B.goal(185);
  return B.L;
}

/* 4-5: the summit. */
function w4l5(){
  const B=LevelBuilder(228,'snow');
  B.ground(0,28).ground(33,52).ground(66,96).ground(102,118).ground(132,160).ground(165,227);
  B.row(6,5,'?M?').enemy('spikit',10).ice(12,28).enemy('blob',18).enemy('shellby',23);
  B.ice(33,40).row(36,6,'HHHH').enemy('icicle',36,5).enemy('icicle',38,5).enemy('boing',44).row(46,5,'B?B').spring(50);
  B.row(53,8,'====').row(59,9,'===').coins(53,9,4).coins(59,10,3).row(55,3,'###').row(61,4,'###').enemy('batty',57,6,{rx:2.5,ry:0.7});
  B.ice(66,80).enemy('spikit',70).row(72,5,'?B?').enemy('spikit',77).pipe(84,3,true).enemy('boing',90).enemy('blob',94);
  B.row(98,3,'===').coins(98,4,3);
  B.checkpoint(105);
  B.ice(108,118).row(110,6,'HHHHHH').enemy('icicle',111,5).enemy('icicle',113,5).enemy('icicle',115,5).enemy('shellby',114);
  B.plat(120,2,2.5,'x',3,1.5).plat(127,2,2.5,'y',4,1.2).enemy('batty',124,6,{rx:3});
  B.ground(136,142,4).ice(136,142,3).ground(143,150,6).ice(143,150,5).row(145,10,'HHH').enemy('icicle',145,9).enemy('icicle',147,9).enemy('spikit',139,4).enemy('boing',148,6);
  B.ice(151,160).enemy('blob',155);
  B.row(169,5,'B?B').row(172,5,'I').enemy('shellby',173).enemy('spikit',178).ice(180,196).enemy('blob',184).enemy('boing',191).row(186,6,'HHHH').enemy('icicle',187,5).enemy('icicle',189,5);
  B.pipe(199,3,true);
  B.stairs(203,7).fill(210,2,210,8,HARD);
  B.goal(216);
  return B.L;
}

/* ---------- World 5: Doughnut Dunes. Quicksand, pyramids, and Prickles that lob seeds. ---------- */
/* 5-1: the first Prickles. */
function w5l1(){
  const B=LevelBuilder(190,'dunes');
  B.ground(0,48).ground(52,98).ground(103,142).ground(147,189);
  B.row(6,5,'B?B').enemy('blob',10).enemy('prickle',17);
  B.row(21,5,'?M?').enemy('blob',25).enemy('shellby',30);
  B.stairs(34,3).fill(37,2,39,4,HARD).stairs(40,3,-1).enemy('prickle',38,5).coins(36,8,5);
  B.enemy('boing',45).arc(48,4,5);
  B.pipe(55,2,true).enemy('prickle',60).row(63,5,'B?B').enemy('blob',66).enemy('blob',68).enemy('spikit',73);
  B.ground(77,84,4).enemy('prickle',81,4).enemy('shellby',88).pipe(92,3,true);
  B.row(99,3,'===').coins(99,4,3);
  B.checkpoint(106);
  B.row(109,5,'?B?').enemy('prickle',113).enemy('boing',118).enemy('prickle',123).row(126,5,'BsB').enemy('blob',130).enemy('blob',132);
  B.stairs(135,4).fill(139,2,142,5,HARD);
  B.enemy('prickle',151).row(154,5,'B?B').enemy('shellby',158).enemy('spikit',163).pipe(166,2,true);
  B.stairs(170,5).fill(175,2,175,6,HARD);
  B.goal(179);
  return B.L;
}

/* 5-2: quicksand crossings. */
function w5l2(){
  const B=LevelBuilder(196,'dunes');
  B.ground(0,22).ground(40,58).ground(76,96).ground(112,134).ground(150,195);
  B.row(6,5,'?M?').enemy('blob',10).enemy('prickle',16);
  B.row(24,3,'===').plat(28,3,3,'x',5,1.2).row(37,4,'==').coins(24,4,3).enemy('batty',32,7,{rx:3});
  B.row(44,5,'B?B').enemy('boing',47).enemy('prickle',52).enemy('shellby',56);
  B.row(60,3,'===').ground(64,65).enemy('prickle',64).row(67,3,'===').row(72,3,'==').coins(60,4,3).coins(67,4,3);
  B.row(82,5,'?B?').enemy('blob',85).enemy('blob',87).enemy('prickle',92);
  B.plat(98,2,3,'y',4,1.1).row(103,6,'===').coins(103,7,3).enemy('batty',107,6,{rx:2});
  B.checkpoint(115);
  B.row(118,5,'B?B').enemy('prickle',122).enemy('boing',126).enemy('boing',130);
  B.row(136,3,'===').ground(140,141).enemy('prickle',140).row(143,3,'===').coins(136,4,3).coins(143,4,3);
  B.row(154,5,'?M?').enemy('shellby',157).enemy('prickle',162).enemy('spikit',167).enemy('blob',171).enemy('blob',173);
  B.stairs(176,5).fill(181,2,181,6,HARD);
  B.goal(185);
  return B.L;
}

/* 5-3: the ruins. */
function w5l3(){
  const B=LevelBuilder(200,'dunes');
  B.ground(0,60).ground(65,118).ground(123,160).ground(166,199);
  B.row(6,5,'B?B').enemy('blob',10).enemy('spikit',15);
  B.row(19,5,'BBBB').enemy('prickle',20,6);
  B.row(28,6,'HHHHHHHHH').fill(28,4,28,5,HARD).fill(36,4,36,5,HARD).enemy('shellby',32).enemy('prickle',30,7).enemy('prickle',34,7);
  B.enemy('boing',41).pipe(45,3,true).row(49,5,'?M?').enemy('blob',52).spikes(55,56).arc(60,4,6);
  B.stairs(67,4).fill(71,2,76,5,HARD).stairs(77,4,-1).enemy('prickle',73,6).row(72,10,'?L?');
  B.enemy('shellby',84).row(87,5,'B?B').enemy('prickle',92).pipe(96,2,true).enemy('boing',101);
  B.checkpoint(104);
  B.row(107,6,'HHHHHHH').fill(107,4,107,5,HARD).fill(113,4,113,5,HARD).enemy('spikit',110).enemy('prickle',110,7);
  B.row(126,5,'BBB').enemy('prickle',127,6).enemy('shellby',131).row(134,5,'?B?').enemy('blob',137);
  B.pipe(141,3,true).pipe(147,4,true).enemy('spikit',152).spikes(156,157);
  B.row(162,3,'===');
  B.row(170,5,'?B?').enemy('prickle',174).enemy('boing',178);
  B.stairs(181,5).fill(186,2,186,6,HARD);
  B.goal(190);
  return B.L;
}

/* 5-4: the great pyramid. */
function w5l4(){
  const B=LevelBuilder(206,'dunes');
  B.ground(0,40).ground(45,112).ground(126,150).ground(156,205);
  B.row(6,5,'?B?').enemy('blob',9).enemy('prickle',14).enemy('boing',20);
  B.row(24,5,'BMB').enemy('shellby',27).pipe(31,2,true).enemy('prickle',36).arc(40,4,6);
  B.enemy('spikit',49).enemy('blob',53).enemy('blob',55);
  for(let k=0;k<6;k++) B.fill(60+3*k,2+k,101-3*k,2+k,HARD);
  B.enemy('prickle',64,4).enemy('blob',70,6).enemy('prickle',77,8).enemy('boing',81,8).row(80,11,'?S?').coins(83,9,3).enemy('shellby',91,6).enemy('spikit',97,4);
  B.checkpoint(105);
  B.enemy('boing',109);
  B.row(114,3,'==').row(118,5,'==').row(122,3,'==').coins(118,6,2).enemy('batty',116,7,{rx:2}).enemy('batty',121,9,{rx:2.5,sp:1.6});
  B.row(130,5,'B?B').enemy('prickle',134).enemy('shellby',138).enemy('blob',142).enemy('blob',144).pipe(147,3,true);
  B.row(152,3,'===');
  B.enemy('prickle',160).row(163,5,'?B?').enemy('spikit',167).enemy('boing',171).enemy('prickle',176);
  B.stairs(180,7).fill(187,2,187,8,HARD);
  B.goal(193);
  return B.L;
}

/* 5-5: the last dune. */
function w5l5(){
  const B=LevelBuilder(230,'dunes');
  B.ground(0,26).ground(31,56).ground(70,96).ground(101,124).ground(140,168).ground(173,229);
  B.row(6,5,'?M?').enemy('prickle',11).enemy('blob',15).enemy('blob',17).enemy('spikit',22).arc(26,4,6);
  B.row(35,5,'BBBBB').enemy('prickle',36,6).enemy('prickle',38,6).enemy('shellby',42).pipe(46,3,true).enemy('boing',51);
  B.plat(58,2,3,'x',7,1.2).enemy('batty',63,5,{rx:3});
  B.stairs(72,3).fill(75,2,80,4,HARD).stairs(81,3,-1).enemy('prickle',77,5).row(86,5,'?B?').enemy('shellby',89).enemy('spikit',93);
  B.checkpoint(104);
  B.row(107,6,'HHHHHHH').fill(107,4,107,5,HARD).fill(113,4,113,5,HARD).enemy('prickle',109,7).enemy('prickle',112,7).enemy('blob',110);
  B.enemy('boing',117).pipe(120,2,true);
  B.plat(126,2,2.5,'y',4,1.2).row(131,6,'==').plat(134,6,2.5,'x',3,1.5).enemy('batty',130,10,{rx:3});
  for(let k=0;k<4;k++) B.fill(144+2*k,2+k,163-2*k,2+k,HARD);
  B.enemy('prickle',153,6).enemy('blob',156,6).row(152,10,'?S?');
  B.row(177,5,'B?B').row(180,5,'I').enemy('shellby',181).enemy('prickle',186).enemy('spikit',190).enemy('boing',194).enemy('prickle',199).pipe(202,3,true);
  B.stairs(206,7).fill(213,2,213,8,HARD);
  B.goal(219);
  return B.L;
}

/* ---------- World 6: Comet Citadel. Low gravity: Blorp jumps higher and floats further. King Grump waits at the end. ---------- */
/* 6-1: liftoff. */
function w6l1(){
  const B=LevelBuilder(200,'citadel');
  B.ground(0,30).ground(37,66).ground(74,100).ground(109,140).ground(149,199);
  B.row(6,6,'?M?').enemy('blob',10).enemy('blob',14);
  B.ground(18,23,6).coins(19,7,4).enemy('boing',27).arc(31,5,6);
  B.row(41,6,'B?B').enemy('shellby',44).ground(49,54,7).enemy('spikit',51,7).row(58,7,'===').coins(58,8,3).enemy('blob',62).arc(67,5,7);
  B.pipe(78,4,true).pipe(84,6,true).coins(78,8,2).coins(84,10,2).enemy('boing',90).row(93,6,'?B?').enemy('batty',96,10,{rx:2.5});
  B.row(104,5,'==').coins(104,6,2);
  B.checkpoint(112);
  B.row(115,6,'B?B').enemy('spikit',119).enemy('spikit',124).ground(128,134,5).ground(135,140,8).enemy('blob',131,5).coins(136,9,4);
  B.row(153,6,'?S?').enemy('shellby',157).enemy('boing',162).enemy('boing',166).pipe(170,5,true);
  B.stairs(175,8).fill(183,2,183,9,HARD);
  B.goal(189);
  return B.L;
}

/* 6-2: the beam walk. */
function w6l2(){
  const B=LevelBuilder(204,'citadel');
  B.ground(0,20).ground(48,62).ground(92,108).ground(140,156).ground(168,203);
  B.row(6,6,'B?B').enemy('blob',10).enemy('spikit',15);
  B.row(25,4,'===').row(32,7,'===').row(40,5,'===').coins(25,5,3).coins(32,8,3).coins(40,6,3).enemy('batty',36,11,{rx:3});
  B.row(51,6,'?M?').enemy('shellby',54).enemy('boing',58);
  B.plat(64,2,3,'x',8,0.9).row(77,5,'===').plat(82,5,3,'y',5,1.0).coins(77,6,3);
  B.checkpoint(95);
  B.row(98,6,'B?B').enemy('spikit',100).enemy('blob',104).enemy('blob',106);
  B.row(112,4,'==').plat(116,4,2.5,'x',6,1.2).row(127,6,'==').plat(131,6,2.5,'y',4,1.1).row(136,5,'==').enemy('batty',121,8,{rx:3}).enemy('batty',134,12,{rx:2.5,ry:0.7});
  B.row(144,6,'?B?').enemy('boing',147).enemy('shellby',152);
  B.row(160,5,'==').row(164,7,'==').coins(160,6,2).coins(164,8,2);
  B.enemy('spikit',172).enemy('blob',176).pipe(179,4,true);
  B.stairs(183,6).fill(189,2,189,7,HARD);
  B.goal(193);
  return B.L;
}

/* 6-3: ember rings. */
function w6l3(){
  const B=LevelBuilder(200,'citadel');
  B.ground(0,44).ground(52,100).ground(108,150).ground(159,199);
  B.row(6,6,'?B?').enemy('blob',9).firebar(15,6,8,1.5).enemy('spikit',21).spikes(25,27);
  B.firebar(32,6,8,-1.5).enemy('boing',37).row(39,6,'BMB').arc(45,5,7);
  B.ground(56,62,5).firebar(59,9,8,1.7).enemy('shellby',66).spikes(70,72).enemy('spikit',75);
  B.firebar(80,6,8,1.8).firebar(88,6,8,-1.8,1.0).enemy('blob',93).enemy('blob',95).pipe(97,4,true);
  B.row(103,5,'===');
  B.checkpoint(111);
  B.row(114,6,'B?B').enemy('boing',117).spikes(121,123).firebar(129,6,8,1.6).enemy('shellby',134).firebar(141,6,8,-1.6,2.0).enemy('spikit',146);
  B.plat(152,2,3,'x',4,1.4);
  B.row(163,6,'?S?').enemy('boing',166).firebar(171,6,8,2.0).enemy('spikit',176);
  B.stairs(179,6).fill(185,2,185,7,HARD);
  B.goal(189);
  return B.L;
}

/* 6-4: everything at once. */
function w6l4(){
  const B=LevelBuilder(220,'citadel');
  B.ground(0,22).ground(30,50).ground(76,98).ground(107,128).ground(152,172).ground(181,219);
  B.row(5,6,'BMB').enemy('spikit',9).enemy('boing',13).firebar(18,6,8,1.8);
  B.row(25,5,'==');
  B.pipe(33,4,true).enemy('shellby',38).pipe(42,6,true).enemy('spikit',47);
  B.row(54,4,'===').plat(59,4,2.5,'y',5,1.2).row(64,9,'===').plat(69,7,2.5,'x',3,1.4).coins(64,10,3).enemy('batty',62,13,{rx:2,ry:0.6});
  B.row(79,6,'?B?').firebar(85,6,8,1.7).enemy('blob',89).enemy('blob',91).spikes(93,95).arc(99,5,8);
  B.checkpoint(110);
  B.row(113,6,'B?B').enemy('spikit',116).firebar(121,6,8,-1.8).enemy('shellby',126);
  B.plat(131,3,2.5,'y',5,1.0,0).plat(137,3,2.5,'y',5,1.0,2.1).plat(143,3,2.5,'y',5,1.0,4.2).enemy('batty',140,11,{rx:4}).coins(132,10,1).coins(138,10,1).coins(144,10,1);
  B.row(156,6,'?M?').enemy('boing',159).enemy('boing',163).firebar(168,6,8,2.0);
  B.row(175,5,'===');
  B.enemy('spikit',185).spikes(189,190).enemy('shellby',194).pipe(197,5,true);
  B.stairs(201,5).fill(206,2,206,6,HARD);
  B.goal(210);
  return B.L;
}

/* 6-5: King Grump's throne among the stars. */
function w6l5(){
  const B=LevelBuilder(190,'citadel');
  B.ground(0,26).ground(34,58).ground(66,90).ground(110,189);
  B.row(6,6,'?M?').enemy('spikit',10).firebar(16,6,8,1.8).enemy('boing',22);
  B.row(29,5,'==');
  B.pipe(38,4,true).enemy('shellby',43).firebar(49,6,8,-1.7).enemy('spikit',54).arc(59,5,7);
  B.row(70,6,'B?B').enemy('boing',73).enemy('boing',77).spikes(81,83).firebar(86,6,7,2.0);
  B.plat(92,2,3,'x',5,1.2).plat(102,2,3,'y',5,1.1).coins(103,9,2);
  B.checkpoint(113);
  B.row(117,6,'?M?');
  B.fill(181,2,189,13,GROUND).row(150,6,'===').row(166,6,'===');
  B.boss(172,146,179,15);
  return B.L;
}

/* ---------- the worlds, in order ---------- */
const WORLDS=[
  {name:'Gumdrop Meadow',levels:[w1l1,w1l2,w1l3,w1l4,w1l5]},
  {name:'Glowshroom Grotto',levels:[w2l1,w2l2,w2l3,w2l4,w2l5]},
  {name:'Castle Crumble',levels:[w3l1,w3l2,w3l3,w3l4,w3l5]},
  {name:'Snowcone Summit',levels:[w4l1,w4l2,w4l3,w4l4,w4l5]},
  {name:'Doughnut Dunes',levels:[w5l1,w5l2,w5l3,w5l4,w5l5]},
  {name:'Comet Citadel',levels:[w6l1,w6l2,w6l3,w6l4,w6l5]}
];
/* The flat list the game plays through. Each level knows its world, its place in that world, and a label such as 2-3. */
const LEVELS=[], LABELS=[];
WORLDS.forEach((w,wi)=>w.levels.forEach((make,si)=>{
  const label=(wi+1)+'-'+(si+1); LABELS.push(label);
  LEVELS.push(()=>{ const L=make(); L.name=w.name; L.world=wi; L.stage=si; L.stages=w.levels.length; L.label=label; return L; });
}));
