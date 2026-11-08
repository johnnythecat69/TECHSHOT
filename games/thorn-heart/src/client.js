import { END, ROLES, GLYPHS, SYMBOLS } from './game.js';
import { makeScene } from './scene.js';
import { makeFallback } from './fallback.js';

const $ = id => document.getElementById(id);
const button = (text, onClick, cls='quiet') => {
  const b=document.createElement('button'); b.type='button'; b.className=cls; b.textContent=text; b.onclick=onClick; return b;
};
const elem = (tag, text, cls) => {
  const n=document.createElement(tag); if(text) n.textContent=text; if(cls)n.className=cls; return n;
};
const appearances = {jade:['Нефрит','#81e7b2'], bronze:['Бронза','#f0a658'], bone:['Кость','#f5dfb4'], amethyst:['Аметист','#c39dff']};
const gate=$('gate');
let player=null, busy=false, timer=0, clockOffset=0, readyAt=0, sound=false, audio, scene;
function play(kind) {
  if(!sound || !audio) return;
  const start=audio.currentTime;
  const notes={roll:[112,164,196], rune:[330,490], end:[82,51,43]}[kind];
  notes.forEach((hz,i)=>{
    const osc=audio.createOscillator(), gain=audio.createGain(), at=start+i*.075;
    osc.type=kind==='end'?'triangle':'sine';osc.frequency.setValueAtTime(hz,at);
    osc.frequency.exponentialRampToValueAtTime(hz*.66,at+.22);
    gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(.10,at+.025);
    gain.gain.exponentialRampToValueAtTime(.0001,at+.24);
    osc.connect(gain);gain.connect(audio.destination);osc.start(at);osc.stop(at+.25);
  });
}
try { scene=makeScene($('viewport'),pickRune); }
catch {
  scene=makeFallback($('viewport'),pickRune);
  $('scene-tip').textContent='Режим без WebGL · руны можно нажимать на доске';
}
function tell(message='') { $('error').textContent=message;$('error').hidden=!message; }
function panel(kicker,title,body,trial=false) {
  gate.hidden=false;gate.classList.toggle('trial',trial);
  const card=elem('div',null,'gate-card');
  card.append(elem('p',kicker,'eyebrow'),elem('h2',title),elem('p',body));
  gate.replaceChildren(card);
  return card;
}
async function api(path, data) {
  const options = data===undefined ? {} : {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)};
  const sent=Date.now(), response=await fetch(path,options), result=await response.json();
  if(typeof result.now==='number') clockOffset=result.now-(sent+Date.now())/2;
  return [response,result];
}
function signin() {
  const card=panel('ЧАЩА ЖДЁТ','Доска проснулась','Войди, чтобы доска запомнила твоего персонажа и текущую экспедицию.');
  const link=elem('a',document.body.dataset.local ? 'Войти / регистрация ↗' : 'Войти через ChatGPT ↗','gold');
  link.href='/signin-with-chatgpt?return_to=%2F';link.target='_top';card.append(link);
}
function creation() {
  const card=panel('ДОСЬЕ ПУТНИКА','Кто идёт в чащу?','Имя, класс и облик будут закреплены за твоим аккаунтом.');
  const form=elem('form');
  const name=elem('input');name.required=true;name.minLength=2;name.maxLength=24;name.autocomplete='off';name.placeholder='Например, Мистакэт';
  const named=elem('label','Имя персонажа');named.append(name);
  const roleOptions=elem('div',null,'option-grid');roleOptions.setAttribute('aria-label','Класс');
  const perk=elem('label',ROLES.tracker.perk);
  const palette=elem('div',null,'appearance');palette.setAttribute('aria-label','Цвет фигурки');
  let role='tracker', appearance='jade';
  for (const [key,value] of Object.entries(ROLES)) {
    const b=button(value.name,()=>{
      role=key;perk.textContent=value.perk;
      for (const option of roleOptions.children) option.setAttribute('aria-pressed',String(option===b));
    });
    b.setAttribute('aria-pressed',String(key===role));roleOptions.append(b);
  }
  for (const [key,[title,color]] of Object.entries(appearances)) {
    const b=button('◆',()=>{
      appearance=key;scene.display(null,key);
      for (const option of palette.children) option.setAttribute('aria-pressed',String(option===b));
    },'swatch');
    b.setAttribute('aria-label',title);b.setAttribute('aria-pressed',String(key===appearance));
    b.style.setProperty('--swatch',color);palette.append(b);
  }
  const alert=elem('p');alert.setAttribute('role','alert');
  const submit=elem('button','Начать экспедицию ↗','gold');submit.type='submit';
  form.append(named,roleOptions,perk,palette,submit,alert);card.append(form);
  form.onsubmit=async e=>{
    e.preventDefault();submit.disabled=true;alert.textContent='';
    try {
      const [response,result]=await api('/api/player',{name:name.value,role,appearance});
      if (!response.ok) {alert.textContent=result.error;return;}
      player=result.player;render();
    } catch { alert.textContent='Связь с доской оборвалась. Попробуй ещё раз.'; }
    finally { submit.disabled=false; }
  };
}
function showPending(p) {
  if(p.kind==='trial'){
    const card=panel('ИСПЫТАНИЕ · ОБРЯД',p.name,p.story,true);
    const line=elem('div',null,'sequence');
    const clock=elem('div',null,'countdown');
    const keys=elem('div',null,'runes');
    GLYPHS.forEach((glyph,i)=>{
      const b=button(glyph,()=>pickRune(i));b.append(elem('small',`${i+1} · ${SYMBOLS[i]}`));
      b.setAttribute('aria-label',`${i+1}. ${SYMBOLS[i]}`);keys.append(b);
    });
    card.append(line,clock,keys);
    function tick(){
      const now=Date.now()+clockOffset, reveal=now<p.revealUntil;
      line.textContent=reveal && p.sequence ? p.sequence.map(i=>GLYPHS[i]).join(' ') : '● '.repeat(p.index)+'○ '.repeat(p.count-p.index);
      const time=Math.max(0,Math.ceil(((reveal?p.revealUntil:p.deadline)-now)/1000));
      clock.textContent=reveal?`Запомни знаки · ${time} с`:`Повтори порядок · ${time} с`;
      for(const b of keys.children)b.disabled=reveal || busy || time===0;
      if(!reveal && time===0 && !busy && now>=readyAt) {
        readyAt=now+2500;move('expire');
      }
    }
    timer=setInterval(tick,140);tick();
    return;
  }
  const card=panel(p.kind==='altar'?'СДЕЛКА':'ИСПЫТАНИЕ · ВЫБОР',p.name,p.story);
  const list=elem('div',null,'choice-list');
  const choices=p.kind==='altar'?['Оставить идола','Отдать печать']:p.choices;
  choices.forEach((label,pick)=>{
    const b=button(label,()=>move(p.kind==='altar'?'altar':'choice',{pick}));
    if(p.kind==='altar' && pick===1)b.disabled=!player.run.seals;
    list.append(b);
  });
  card.append(list);
}
function render(animate=false) {
  clearInterval(timer);timer=0;
  if (!player) return;
  const { profile,run,revision:runRevision }=player;
  const role=ROLES[profile.role];
  $('profile-title').textContent=profile.name;
  $('class-name').textContent=role.name;$('portrait').textContent=role.icon;
  $('portrait').style.color=appearances[profile.appearance]?.[1] ?? role.color;
  $('hp').textContent=`${run.hp} / ${run.maxHp}`;
  $('seals').textContent=`${run.seals} / 3`;$('progress').textContent=`${run.pos} / ${END}`;
  $('fill').style.width=`${100*run.pos/END}%`;
  $('inventory').textContent=[`Талисманы ${run.charm}`, run.curse?'Доска проклята':'', run.guard?'Защита активна':'', `Победы ${run.wins}`].filter(Boolean).join(' · ');
  $('die').textContent=['⚄','⚀','⚁','⚂','⚃','⚄','⚅'][run.die];
  $('chapter').textContent=run.pending?'ДОСКА · ИСПЫТАНИЕ':`ДОСКА · ХОД ${String(run.turn).padStart(2,'0')}`;
  $('entries').replaceChildren(...run.log.map(line=>elem('li',line)));
  $('roll').disabled=busy || animate || !!run.pending || run.phase!=='board';
  $('careful').hidden=!run.charm || !!run.pending || run.phase!=='board';
  $('careful').disabled=busy || animate;
  $('action-desc').textContent=run.pending?'Сначала переживи испытание.':run.curse?'Следующий обряд потребует четыре знака.':'Один бросок меняет всё.';
  scene.display(run,profile.appearance,animate);
  if(animate && !matchMedia('(prefers-reduced-motion: reduce)').matches){
    gate.hidden=true;
    window.setTimeout(()=>{
      if(player?.revision===runRevision)finishRender(run);
    }, 530+run.die*140);
    return;
  }
  finishRender(run);
}
function finishRender(run) {
  $('roll').disabled=!!run.pending || run.phase!=='board';
  $('careful').disabled=false;
  if(run.phase!=='board'){
    const won=run.phase==='won';
    const card=panel(won?'ЭКСПЕДИЦИЯ ЗАВЕРШЕНА':'ЭКСПЕДИЦИЯ ПОТЕРЯНА',won?'Дорога открыта':'Чаща забрала тебя',
      `Ходов: ${run.turn}. Печатей: ${run.seals}. Твой персонаж готов к новой экспедиции.`);
    card.append(button('Новая экспедиция ↗',()=>move('restart'),'gold'));
  } else if(run.pending) showPending(run.pending);
  else gate.hidden=true;
}
async function move(action,payload={}) {
  if (busy || !player) return;
  busy=true;tell();
  $('roll').disabled=true;$('careful').disabled=true;
  let animate=false;
  const before=player;
  try {
    const [response,result]=await api('/api/move',{action,revision:player.revision,...payload});
    if(result.player)player=result.player;
    if(!response.ok) tell(result.error);
    else {
      animate=action==='roll';
      if(animate)play('roll');
      if(action==='sigil')play('rune');
      if(before.run.phase==='board' && player.run.phase!=='board')play('end');
    }
  } catch { tell('Связь с доской оборвалась. Обнови страницу, чтобы сверить ход.'); }
  finally {busy=false;render(animate);}
}
function pickRune(i) {
  const p=player?.run.pending;
  if(p?.kind==='trial' && Date.now()+clockOffset>=p.revealUntil)move('sigil',{pick:i});
}
$('roll').onclick=()=>move('roll');
$('careful').onclick=()=>move('roll',{careful:true});
$('camera').onclick=()=>{$('camera').textContent=scene.toggleCamera()?'Вид под углом':'Вид сверху';};
$('help').onclick=()=>$('rules').showModal();
$('close-rules').onclick=()=>$('rules').close();
$('sound').onclick=async()=>{
  if(!window.AudioContext)return;
  audio??=new AudioContext();
  if(audio.state==='suspended')await audio.resume();
  sound=!sound;$('sound').textContent=sound?'Звук вкл.':'Звук выкл.';
  $('sound').setAttribute('aria-pressed',String(sound));if(sound)play('rune');
};
document.addEventListener('keydown',e=>{
  if(e.repeat || e.altKey || e.ctrlKey || e.metaKey || $('rules').open || e.target.matches('input'))return;
  if(/^[1-5]$/.test(e.key))pickRune(Number(e.key)-1);
});
async function start() {
  try {
    const [response,result]=await api('/api/player');
    if(response.status===401){signin();return;}
    if(!response.ok)throw new Error('Load failed');
    $('logout').hidden=false;player=result.player;
    if(player)render();else creation();
  } catch {
    const card=panel('ДОСКА МОЛЧИТ','Связь оборвалась','Не удалось загрузить экспедицию.');
    card.append(button('Повторить',start,'gold'));
  }
}
start();
