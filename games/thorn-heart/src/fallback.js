import { END, TILES, GLYPHS } from './game.js';
import { makeBoardPath } from './scene.js';

const kinds = {start:['#b8d1ad','✦'], threat:['#c48666','×'], event:['#d5bb89','·'],
  rest:['#a7b58c','+'], relic:['#e1b271','◇'], shrine:['#bea3a4','☽']};
const palette = {jade:'#92e0b1', bronze:'#f0a658', bone:'#f5dfb4', amethyst:'#c39dff'};
const ns='http://www.w3.org/2000/svg';
const node = (tag, attrs) => {
  const n=document.createElementNS(ns,tag);
  for(const [key,value] of Object.entries(attrs)) n.setAttribute(key,value);
  return n;
};
export function makeFallback(host,pick) {
  const svg=node('svg',{viewBox:'0 0 760 560',class:'illustrated-board',role:'group','aria-label':'Иллюстрированная игровая доска'});
  svg.innerHTML=`<defs>
  <radialGradient id="mist"><stop stop-color="#476052"/><stop offset="1" stop-color="#101b16"/></radialGradient>
  <linearGradient id="grain" x2=".2" y2="1"><stop stop-color="#8c5733"/><stop offset=".52" stop-color="#593921"/><stop offset="1" stop-color="#342319"/></linearGradient>
  <linearGradient id="jungle"><stop stop-color="#285747"/><stop offset="1" stop-color="#112e25"/></linearGradient>
  <radialGradient id="pool"><stop stop-color="#071a19"/><stop offset=".61" stop-color="#11362e"/><stop offset="1" stop-color="#43aa83"/></radialGradient>
  <filter id="shadow" x="-30%" y="-30%" width="160%" height="180%"><feDropShadow dx="5" dy="17" stdDeviation="17" flood-color="#070d09" flood-opacity=".85"/></filter>
  <pattern id="grain-lines" width="24" height="12" patternUnits="userSpaceOnUse"><path d="M0 2Q13 5 24 2M0 9Q13 8 24 9" fill="none" stroke="#db9a5f" opacity=".14"/></pattern>
  <path id="leaf" d="M0 0Q-23 -27 0 -60Q26 -32 0 0Z M0 -5L0 -50" />
  </defs>
  <rect width="760" height="560" fill="url(#mist)"/>
  <ellipse cx="375" cy="375" rx="348" ry="135" fill="#0b1410" opacity=".57"/>
  <g id="wild-leaves"></g>
  <g id="svg-table" transform="translate(380 269) scale(1 .77) rotate(-8)">
  <rect x="-296" y="-216" width="592" height="455" rx="22" fill="#2f2018" filter="url(#shadow)"/>
  <rect x="-296" y="-231" width="592" height="462" rx="20" fill="url(#grain)" stroke="#aa8050" stroke-width="3"/>
  <rect x="-295" y="-230" width="590" height="460" rx="20" fill="url(#grain-lines)"/>
  <rect x="-276" y="-210" width="552" height="420" rx="11" fill="url(#jungle)" stroke="#ad8551" stroke-width="3"/>
  <g id="inlay"></g>
  <circle r="51" fill="#3d2e1c" stroke="#c09557" stroke-width="5"/>
  <circle r="43" fill="url(#pool)" stroke="#a2b984" stroke-width="1.5"/>
  <g fill="none" stroke="#9aebae" opacity=".72">
    <path d="M-27 -25C-1 -47 40 -20 35 6S3 44 -21 23S-20 -19 0 -19S23 -2 15 9S-5 17 -8 5"/>
    <circle r="35" stroke-dasharray="2 5"/><circle r="40" stroke-dasharray="1 3"/>
  </g>
  <g id="svg-tiles"></g>
  <g id="svg-die" transform="translate(-61 22) rotate(18)"><rect x="-17" y="-13" width="34" height="34" rx="6" fill="#574432"/><rect x="-17" y="-17" width="34" height="34" rx="6" fill="#e1c38f" stroke="#9b7549" stroke-width="2"/><g id="svg-pips" fill="#372819"></g></g>
  <g id="svg-runes"></g>
  <g id="svg-pawn"><ellipse cy="8" rx="18" ry="10" fill="#090f0d" opacity=".7"/><circle r="19" fill="none" stroke="#c1f3be" stroke-width="2"/><path d="M-11 5L-6 -12L-13 -22L0 -33L13 -22L6 -12L11 5Z" stroke="#322c20" stroke-width="2"/><path d="M-4 -21L0 -26L4 -21L0 -16Z" fill="#263e34"/></g>
  </g>`;
  const table=svg.querySelector('#svg-table');
  const inlay=svg.querySelector('#inlay'), jungle=svg.querySelector('#wild-leaves');
  for(let i=0;i<121;i++){
    const x=((i*431)%533)-264,y=((i*283)%400)-196;
    inlay.append(node('use',{href:'#leaf',fill:['#417553','#43794e','#8d8346','#325c45'][i%4],stroke:'#a59254','stroke-opacity':'.35',transform:`translate(${x} ${y}) rotate(${(i*59)%360}) scale(${.20+(i%11)*.045})`}));
  }
  for(let i=0;i<48;i++){
    const edge=i%4,x=edge===0?30+(i*41)%75:edge===1?660+(i*37)%90:(i*169)%760,y=edge===2?20+(i*61)%85:edge===3?464+(i*37)%90:(i*139)%560;
    jungle.append(node('use',{href:'#leaf',fill:['#1d3b2d','#284635','#33533b','#5c6139'][i%4],stroke:'#456e48','stroke-opacity':'.45',transform:`translate(${x} ${y}) rotate(${(i*57)%360}) scale(${.5+(i%9)*.13})`}));
  }
  const path=makeBoardPath();
  const points=Array.from({length:END+1},(_,i)=>path.getPointAt(i/END).multiplyScalar(49));
  const cells=svg.querySelector('#svg-tiles');
  const borders=[];
  points.slice(0,-1).forEach((p,i)=>{
    const tangent=path.getTangentAt(i/END),[color,mark]=kinds[TILES[i]];
    const cell=node('g',{transform:`translate(${p.x} ${p.z}) rotate(${Math.atan2(tangent.z,tangent.x)*180/Math.PI})`});
    cell.append(node('rect',{x:-21,y:-15,width:42,height:39,rx:8,fill:'#60492f'}));
    const rim=node('rect',{x:-21,y:-19,width:42,height:38,rx:8,fill:color,stroke:'#372d1b','stroke-width':1.7});
    borders.push(rim);cell.append(rim);
    const label=node('text',{y:7,'text-anchor':'middle',fill:'#46351f','font-size':21});label.textContent=mark;cell.append(label);
    cells.append(cell);
  });
  const pawn=svg.querySelector('#svg-pawn'), die=svg.querySelector('#svg-die'), pips=svg.querySelector('#svg-pips');
  const runes=svg.querySelector('#svg-runes');
  GLYPHS.forEach((glyph,i)=>{
    const angle=.2+i*2*Math.PI/5;
    const rune=node('g',{transform:`translate(${Math.cos(angle)*82} ${Math.sin(angle)*82})`,class:'svg-rune'});
    rune.append(node('circle',{r:20,fill:'#304d38',stroke:'#dab983','stroke-width':2.5}));
    const text=node('text',{y:8,'text-anchor':'middle',fill:'#f5d79d','font-size':25});text.textContent=glyph;rune.append(text);
    rune.addEventListener('click',()=>pick(i));runes.append(rune);
  });
  host.replaceChildren(svg);
  let top=false, shown=0, frame=0;
  function move(at){
    shown=at;
    const n=Math.floor(at),p=points[n].clone().lerp(points[Math.min(END,n+1)],at-n);
    pawn.setAttribute('transform',`translate(${p.x} ${p.z-Math.sin((at-n)*Math.PI)*9})`);
    borders.forEach((el,i)=>el.setAttribute('stroke',i===Math.round(at)?'#e0ffce':'#372d1b'));
  }
  function setDie(face){
    const layout=[[[0,0]],[[-1,1],[1,-1]],[[-1,1],[0,0],[1,-1]],[[-1,1],[1,1],[-1,-1],[1,-1]],[[-1,1],[1,1],[0,0],[-1,-1],[1,-1]],[[-1,1],[1,1],[-1,0],[1,0],[-1,-1],[1,-1]]];
    pips.replaceChildren(...layout[(face||1)-1].map(([x,y])=>node('circle',{cx:x*8,cy:y*8,r:2.8})));
  }
  move(0);setDie(1);
  return {
    display(run,appearance,animate){
      cancelAnimationFrame(frame);
      pawn.querySelector('path').setAttribute('fill',palette[appearance]??palette.jade);
      const active=run?.pending?.kind==='trial';
      runes.style.display=active?'':'none';die.style.display=active?'none':'';
      setDie(run?.die);
      if(!animate || matchMedia('(prefers-reduced-motion: reduce)').matches){move(run?.pos??0);return;}
      const start=performance.now(), from=Math.round(shown), to=Math.min(END,from+run.die);
      const spin=t=>{
        const elapsed=t-start;
        const f=Math.max(0,(elapsed-450)/140);
        if(elapsed<450)setDie(Math.min(6,1+Math.floor(elapsed/68)));
        else setDie(run.die);
        move(Math.min(to,from+f));
        if(f<to-from+.5)frame=requestAnimationFrame(spin);else move(run.pos);
      };
      frame=requestAnimationFrame(spin);
    },
    toggleCamera(){
      top=!top;
      table.setAttribute('transform',top?'translate(380 279)':'translate(380 269) scale(1 .77) rotate(-8)');
      return top;
    }
  };
}
