/* ================= audio: everything is synthesised ================= */
const AU={ac:null,master:null,mg:null,sg:null,muted:false,noise:null};
function auInit(){
  if(AU.ac){ if(AU.ac.state!=='running') AU.ac.resume().catch(()=>{}); return; }
  try{
    const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return;
    const ac=new AC(); AU.ac=ac;
    AU.master=ac.createGain(); AU.master.gain.value=AU.muted?0:0.5; AU.master.connect(ac.destination);
    AU.mg=ac.createGain(); AU.mg.gain.value=0.5; AU.mg.connect(AU.master);
    AU.sg=ac.createGain(); AU.sg.gain.value=1; AU.sg.connect(AU.master);
    const n=ac.createBuffer(1,Math.floor(ac.sampleRate*0.5),ac.sampleRate), d=n.getChannelData(0);
    for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1;
    AU.noise=n;
    if(ac.state!=='running') ac.resume().catch(()=>{});
  }catch(e){ AU.ac=null; }
}
function setMuted(m){ AU.muted=m; if(AU.master) AU.master.gain.value=m?0:0.5; }
const NOTE_IX={C:0,D:2,E:4,F:5,G:7,A:9,B:11};
function NF(n){ let i=1,s=NOTE_IX[n[0]]; if(n[1]==='#'){ s++; i++; } else if(n[1]==='b'){ s--; i++; } return 440*Math.pow(2,(s+(+n.slice(i)-4)*12-9)/12); }
function voice(type,f0,f1,t,dur,vol,dest){
  const ac=AU.ac; const o=ac.createOscillator(), g=ac.createGain();
  o.type=type; o.frequency.setValueAtTime(f0,t); if(f1&&f1!==f0) o.frequency.exponentialRampToValueAtTime(f1,t+dur);
  g.gain.setValueAtTime(0.0001,t); g.gain.linearRampToValueAtTime(vol,t+0.008); g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  o.connect(g); g.connect(dest); o.start(t); o.stop(t+dur+0.03);
}
function tone(type,f0,f1,dur,vol,delay){ if(!AU.ac||AU.ac.state!=='running') return; voice(type,f0,f1,AU.ac.currentTime+(delay||0),dur,vol,AU.sg); }
function hiss(dur,vol,delay,hp){
  const ac=AU.ac; if(!ac||ac.state!=='running') return; const t=ac.currentTime+(delay||0);
  const s=ac.createBufferSource(); s.buffer=AU.noise; const f=ac.createBiquadFilter(); f.type='highpass'; f.frequency.value=hp||900;
  /* A gain node sits at 1 until its first scheduled value. Start it at 0, or a burst that begins a sample early clicks at full volume. */
  const g=ac.createGain(); g.gain.value=0; g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  s.connect(f); f.connect(g); g.connect(AU.sg); s.start(t); s.stop(t+dur+0.02);
}
function jingle(type,notes,step,vol,len){ notes.split(' ').forEach((n,i)=>{ if(n!=='.') tone(type,NF(n),0,len||step*1.4,vol,i*step); }); }
const sfx={
  jump(big){ tone('square',big?250:330,big?520:680,0.17,0.12); },
  coin(){ tone('square',988,0,0.08,0.12); tone('square',1319,0,0.3,0.12,0.07); },
  stomp(){ tone('square',420,110,0.13,0.16); hiss(0.07,0.18); },
  bump(){ tone('triangle',170,80,0.11,0.4); },
  brk(){ hiss(0.2,0.3,0,500); tone('square',220,60,0.16,0.12); },
  sprout(){ jingle('square','C5 E5 G5 C6 E6 G6',0.045,0.09,0.08); },
  power(){ jingle('square','G4 C5 E5 G5 C6 E6 G6 C7',0.055,0.11,0.1); },
  hurt(){ jingle('square','E5 C5 A4 E4 C4',0.07,0.13,0.1); },
  fire(){ tone('square',880,280,0.11,0.1); },
  kick(){ tone('square',520,880,0.07,0.14); },
  oneup(){ jingle('square','E5 G5 E6 C6 D6 G6',0.1,0.12,0.14); },
  spring(){ tone('sine',220,980,0.28,0.3); tone('square',220,980,0.2,0.05); },
  thud(){ tone('triangle',110,45,0.22,0.5); hiss(0.12,0.15,0,200); },
  pause(){ tone('square',660,0,0.07,0.1); tone('square',440,0,0.1,0.1,0.08); },
  check(){ jingle('triangle','C5 G5 C6',0.08,0.3,0.16); },
  slide(){ tone('triangle',1400,300,0.7,0.2); },
  die(){ jingle('square','B4 . F5 . F5 E5 D5 C5 . G4 . E4',0.085,0.12,0.14); },
  clear(){ jingle('square','G4 C5 E5 G5 C6 E6 G6 . E6 . G6',0.1,0.12,0.2); jingle('triangle','C3 . G3 . C4 . G3 . C4 . C3',0.1,0.3,0.2); },
  over(){ jingle('triangle','C5 . G4 . E4 . A4 B4 A4 Ab4 Bb4 Ab4 G4',0.13,0.3,0.22); },
  bossHit(){ tone('sawtooth',300,70,0.3,0.2); hiss(0.15,0.2,0,300); },
  spit(){ tone('square',300,640,0.09,0.09); },
  shatter(){ hiss(0.12,0.2,0,2500); tone('square',1500,700,0.08,0.06); },
  win(){ jingle('square','C5 C5 C5 E5 G5 . E5 G5 C6 . C6 E6 G6 . . C7',0.11,0.12,0.24); jingle('triangle','C3 . . C3 G3 . . G3 C4 . . E4 G4 . . C4',0.11,0.3,0.24); }
};

/* tiny step sequencer: one token per eighth note. '.' rest, '-' hold */
function parseTrack(s){
  const tok=s.trim().split(/\s+/), out=[];
  for(let i=0;i<tok.length;i++){ if(tok[i]==='.'||tok[i]==='-'){ out.push(null); continue; } let d=1; while(tok[i+d]==='-') d++; out.push({f:NF(tok[i]),d}); }
  return out;
}
function song(bpm,wave,lead,bass){ return {bpm,wave,lead:parseTrack(lead),bass:parseTrack(bass)}; }
const SONGS={
  meadow:song(150,'square',
    'E5 . G5 E5 C5 . E5 G5  A5 - G5 . E5 - . .  C5 . E5 C5 A4 . C5 E5  G5 - E5 . C5 - . . '+
    'F5 . A5 F5 C5 . F5 A5  C6 - A5 . F5 . A5 .  G5 . B5 G5 D5 . G5 B5  D6 - B5 G5 D5 G5 B5 D6',
    'C3 . G3 . C3 . G3 .  C3 . G3 . C3 . G3 .  A2 . E3 . A2 . E3 .  A2 . E3 . A2 . E3 . '+
    'F2 . C3 . F2 . C3 .  F2 . C3 . F2 . C3 .  G2 . D3 . G2 . D3 .  G2 . D3 . G2 B2 D3 G3'),
  grotto:song(126,'triangle',
    'A4 . C5 . E5 . C5 .  A4 . C5 E5 A5 - - .  F4 . A4 . C5 . A4 .  F4 . A4 C5 F5 - - . '+
    'D5 . F5 . A5 . F5 .  D5 F5 A5 F5 D5 - . .  E5 . G#5 . B5 . G#5 .  E5 G#5 B5 E6 B5 G#5 E5 .',
    'A2 . . A2 . . E3 .  A2 . . A2 . . E3 .  F2 . . F2 . . C3 .  F2 . . F2 . . C3 . '+
    'D3 . . D3 . . A2 .  D3 . . D3 . . A2 .  E2 . . E2 . . B2 .  E2 . . E2 . B2 E3 .'),
  castle:song(164,'square',
    'D5 D5 . D5 F5 . A5 .  G5 F5 E5 F5 D5 - . .  D5 D5 . D5 F5 . Bb5 .  A5 G5 F5 G5 A5 - . . '+
    'G5 G5 . G5 Bb5 . D6 .  C6 Bb5 A5 Bb5 G5 - . .  A5 . C#6 . E6 . C#6 .  A5 C#6 E6 C#6 A5 E5 A5 .',
    'D3 D3 D3 D3 D3 D3 A2 A2  D3 D3 D3 D3 D3 D3 A2 A2  Bb2 Bb2 Bb2 Bb2 Bb2 Bb2 F3 F3  Bb2 Bb2 Bb2 Bb2 Bb2 Bb2 F3 F3 '+
    'G2 G2 G2 G2 G2 G2 D3 D3  G2 G2 G2 G2 G2 G2 D3 D3  A2 A2 A2 A2 A2 A2 E3 E3  A2 A2 A2 A2 A2 C#3 E3 A3'),
  snow:song(132,'sine',
    'C6 . A5 . F5 . A5 C6  D6 - C6 . A5 - . .  A5 . F5 . D5 . F5 A5  C6 - A5 . F5 - . . '+
    'D6 . Bb5 . F5 . Bb5 D6  F6 - D6 . Bb5 . D6 .  E6 . C6 . G5 . C6 E6  G6 - E6 C6 G5 C6 E6 G6',
    'F2 . C3 . F2 . C3 .  F2 . C3 . F2 . C3 .  D3 . A2 . D3 . A2 .  D3 . A2 . D3 . A2 . '+
    'Bb2 . F3 . Bb2 . F3 .  Bb2 . F3 . Bb2 . F3 .  C3 . G2 . C3 . G2 .  C3 . G2 . C3 E3 G3 C3'),
  dunes:song(138,'square',
    'D5 . F#5 G5 A5 . G5 F#5  Eb5 - D5 . D5 - . .  Eb5 . G5 A5 Bb5 . A5 G5  F#5 - Eb5 . D5 - . . '+
    'G5 . Bb5 . D6 . C6 Bb5  A5 - G5 . Bb5 - A5 .  G5 . Eb5 . Bb5 A5 G5 F#5  Eb5 D5 F#5 A5 D6 - . .',
    'D3 . D3 A2 D3 . A2 .  D3 . D3 A2 D3 . A2 .  Eb3 . Eb3 Bb2 Eb3 . Bb2 .  D3 . D3 A2 D3 . A2 . '+
    'G2 . G2 D3 G2 . D3 .  G2 . G2 D3 G2 . D3 .  Eb3 . Eb3 Bb2 Eb3 . Bb2 .  D3 . A2 . D3 F#3 A3 D3'),
  citadel:song(156,'sawtooth',
    'E5 . G5 B5 E6 . B5 G5  F#5 - G5 . E5 - . .  C5 . E5 G5 C6 . G5 E5  D5 - E5 . G5 - . . '+
    'A5 . C6 E6 A5 . C6 E6  G6 - E6 . C6 - A5 .  B5 . D#6 . F#6 . D#6 .  B5 D#6 F#6 B6 F#6 D#6 B5 .',
    'E2 E2 E3 E2 E2 E2 E3 E2  E2 E2 E3 E2 E2 E2 E3 E2  C3 C3 C3 C3 C3 C3 G2 G2  C3 C3 C3 C3 C3 C3 G2 G2 '+
    'A2 A2 A2 A2 A2 A2 E3 E3  A2 A2 A2 A2 A2 A2 E3 E3  B2 B2 B2 B2 B2 B2 F#3 F#3  B2 B2 B2 B2 B2 D#3 F#3 B3')
};
const LEAD_VOL={square:0.07,sawtooth:0.05,triangle:0.2,sine:0.22};
const mus={song:null,step:0,next:0,timer:0,rate:1,paused:false};
function musicTick(){
  const ac=AU.ac, s=mus.song; if(!ac||!s||ac.state!=='running') return;
  if(mus.paused){ mus.next=ac.currentTime+0.06; return; }
  if(mus.next<ac.currentTime) mus.next=ac.currentTime+0.03;
  const sd=60/s.bpm/2/mus.rate;
  while(mus.next<ac.currentTime+0.18){
    const i=mus.step%s.lead.length, l=s.lead[i], b=s.bass[i%s.bass.length];
    if(l) voice(s.wave,l.f,0,mus.next,sd*l.d*0.9,LEAD_VOL[s.wave],AU.mg);
    if(b) voice('triangle',b.f,0,mus.next,sd*b.d*0.85,0.26,AU.mg);
    mus.step++; mus.next+=sd;
  }
}
function musicStart(name){ musicStop(); if(!AU.ac) return; mus.song=SONGS[name]; mus.step=0; mus.rate=1; mus.paused=false; mus.next=AU.ac.currentTime+0.1; mus.timer=setInterval(musicTick,45); }
function musicStop(){ if(mus.timer) clearInterval(mus.timer); mus.timer=0; mus.song=null; }
function musicPause(p){ mus.paused=p; }
function musicRate(r){ mus.rate=r; }
