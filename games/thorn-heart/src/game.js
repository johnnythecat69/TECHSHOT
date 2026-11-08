export const END = 32;
export const ROLES = {
  tracker: { name: 'Следопыт', icon: '⌖', color: '#65d9ab', perk: 'Первая рана в партии не отнимает здоровье.' },
  scholar: { name: 'Оккультист', icon: '☽', color: '#bba3ed', perk: 'Начинает с дополнительной печатью.' },
  warden: { name: 'Хранитель', icon: '◇', color: '#f4b775', perk: 'Начинает с четырьмя жизнями.' }
};
export const TILES = 'start threat event rest threat relic event threat shrine event threat rest relic threat event threat shrine event relic threat rest event threat relic threat event shrine threat rest event threat relic gate'.split(' ');
export const SYMBOLS = ['Луна', 'Клык', 'Око', 'Ветвь', 'Пламя'];
export const GLYPHS = ['☽', '△', '◉', '✦', 'ϟ'];
const encounters = [
  { name:'Лицо между деревьями', story:'Существо повторяет каждый твой шаг, но отступает, когда слышит плеск. У тропы течёт ручей.', choices:['Замереть на тропе','Шагнуть в ручей','Крикнуть в темноту'], safe:1, win:'Зеркало воды разорвало связь. На берегу блеснула печать.' },
  { name:'Красная орхидея', story:'Доска шепчет: «Живое дышит». Из белых цветов поднимается пар. Красный цветок неподвижен.', choices:['Сорвать белый цветок','Вдохнуть аромат','Поднять красный цветок'], safe:2, win:'Красный цветок оказался вырезан из камня. Внутри была печать.' },
  { name:'Пустой барабан', story:'На коже выжжено: «Третий удар меня разбудит». Из чащи уже отозвались два удара.', choices:['Перевернуть барабан','Ударить ладонью','Бросить в него камень'], safe:0, win:'Под барабаном нашлась печать. Третий удар так и не прозвучал.' },
  { name:'Колодец без дна', story:'Голос снизу обещает сокровище. Верёвка тёплая и пульсирует. На ободе лежит холодный камень.', choices:['Тянуть верёвку','Взять холодный камень','Спуститься на голос'], safe:1, win:'На камне проступил знак. Голос осёкся.' },
  { name:'Порог масок', story:'На створке три маски. Надпись гласит: «Доверяй тому, кто не смотрит». У третьей маски глаза зашиты.', choices:['Надеть первую маску','Надеть вторую маску','Коснуться третьей маски'], safe:2, win:'Маска рассыпалась. В пепле осталась печать.' },
  { name:'Чёрные мотыльки', story:'Мотыльки летят на тепло. В кармане горячая лампа. У подножия скалы холодный проход.', choices:['Погасить лампу и уйти в проход','Поднять лампу над головой','Бежать с лампой'], safe:0, win:'Рой пролетел мимо. В проходе нашлась печать.' },
  { name:'Мост из костей', story:'Одна доска белая, две зелёные. С белой свисает паутина. На зелёных видны свежие следы когтей.', choices:['Идти по зелёным доскам','Ступить на белую доску','Прыгнуть в овраг'], safe:1, win:'Паутина дрогнула. Белая доска выдержала, а под ней нашлась печать.' }
];
const threats = [
  ['Зверь без тени','Что-то тяжёлое идёт вокруг стола. Погаси след, повторив три знака доски.'],
  ['Мёртвый фонарь','Чужой свет ищет тебя. Запомни порядок знаков и замкни круг.'],
  ['Голодные корни','Корни тянутся к твоим ногам. Повтори знаки, пока круг держится.'],
  ['Лица под водой','Из портала поднимаются лица. Закрой его теми же знаками и в том же порядке.']
];
const rand = (max) => {
  const data = new Uint32Array(1);
  const limit = 2 ** 32 - (2 ** 32 % max);
  do { crypto.getRandomValues(data); } while (data[0] >= limit);
  return data[0] % max;
};
const note = (s, line) => { s.log = [line, ...s.log].slice(0, 9); };
export const newRun = (role, wins = 0, losses = 0) => ({
  pos:0, hp:role === 'warden' ? 4 : 3, maxHp:role === 'warden' ? 4 : 3, seals:role === 'scholar' ? 1 : 0,
  turn:0, die:0, guard:role === 'tracker', charm:0, curse:0, pending:null,
  phase:'board', wins, losses, log:['Доска проснулась. Дорога назад закрылась.']
});
const requireMove = (ok) => { if (!ok) throw new Error('Этот ход сейчас недоступен.'); };
function hurt(s) {
  if (s.guard) { s.guard = false; note(s, 'Навык следопыта спас от первой раны.'); }
  else { s.hp--; }
  if (s.hp <= 0) { s.phase = 'lost'; s.losses++; note(s, 'Чаща забрала ещё одного путника.'); }
}
function trial(s, now, draw, final = false) {
  const [name, story] = final ? ['Сердце чащи','Последний обряд. Запомни четыре знака и повтори их, пока проход не закрылся.'] : threats[draw(threats.length)];
  const pool = [0,1,2,3,4];
  const count = final || s.curse ? 4 : 3;
  const sequence = Array.from({length:count}, () => pool.splice(draw(pool.length),1)[0]);
  s.pending = { kind:'trial', name, story, final, sequence, index:0, revealUntil:now + 7600, deadline:now + 23700 };
  if (s.curse) { s.curse--; note(s, 'Проклятие добавило лишний знак.'); }
}
function endTrial(s, ok) {
  const final = s.pending.final;
  s.pending = null;
  if (ok && final) { s.phase = 'won'; s.wins++; note(s, 'Сердце замолкло. Ты покинул чащу.'); return; }
  if (ok) { s.seals++; note(s, 'Круг выдержал. Получена печать.'); return; }
  note(s, 'Круг разорван. Чаща ударила в ответ.');
  hurt(s);
  if (final && s.phase === 'board') s.pos = END - 4;
}
function land(s, now, draw) {
  switch (TILES[s.pos]) {
    case 'gate':
      if (s.seals >= 3) trial(s, now, draw, true);
      else {
        s.seals++;
        s.pos = END - 6;
        note(s, 'Вратам нужны три печати. Сердце оставило одну и отбросило тебя на шесть клеток.');
      }
      break;
    case 'threat': trial(s, now, draw); break;
    case 'event': s.pending = {kind:'choice', ...encounters[draw(encounters.length)]}; break;
    case 'shrine':
      s.pending = {kind:'altar', name:'Каменный идол', story:'Идол просит плату. Печать снимет проклятие и восстановит жизнь. Или оставь идола в покое.'};
      break;
    case 'relic':
      s.seals++;
      s.charm = Math.min(s.charm + 1, 2);
      note(s, 'Тайник: печать и талисман. Талисман позволяет выбрать осторожный бросок.');
      break;
    case 'rest':
      s.hp = Math.min(s.hp + 1, s.maxHp);
      note(s, 'На привале восстановлена жизнь.');
      break;
  }
}
export function act(run, role, action, payload = {}, now = Date.now(), draw = rand) {
  if (action === 'restart') {
    requireMove(run.phase !== 'board');
    return newRun(role, run.wins, run.losses);
  }
  const s = structuredClone(run);
  requireMove(s.phase === 'board');
  if (action === 'roll') {
    requireMove(!s.pending && (!payload.careful || s.charm > 0));
    s.die = 1 + draw(payload.careful ? 3 : 6);
    if (payload.careful) s.charm--;
    s.turn++;
    s.pos = Math.min(s.pos + s.die, END);
    note(s, `Ход ${s.turn}. На кубике ${s.die}.`);
    if (s.die === 6) { s.curse = 1; note(s, 'Шестёрка разбудила чащу. Следующий обряд станет труднее.'); }
    land(s, now, draw);
    return s;
  }
  const p = s.pending;
  requireMove(p);
  if (action === 'choice' && p.kind === 'choice') {
    requireMove(Number.isInteger(payload.pick) && payload.pick >= 0 && payload.pick < p.choices.length);
    s.pending = null;
    if (p.safe === payload.pick) { s.seals++; note(s, p.win); }
    else { note(s, 'Чаща услышала тебя. Придётся заплатить за ошибку.'); hurt(s); }
  } else if (action === 'altar' && p.kind === 'altar') {
    requireMove(payload.pick === 0 || (payload.pick === 1 && s.seals > 0));
    s.pending = null;
    if (payload.pick === 1) { s.seals--; s.hp = Math.min(s.hp + 1, s.maxHp); s.curse = 0; note(s, 'Идол принял печать.'); }
    else note(s, 'Идол проводил тебя взглядом.');
  } else if (p.kind === 'trial' && ['sigil','expire'].includes(action)) {
    if (now >= p.deadline) endTrial(s, false);
    else {
      requireMove(action === 'sigil' && now >= p.revealUntil && Number.isInteger(payload.pick) && payload.pick >= 0 && payload.pick < SYMBOLS.length);
      if (payload.pick !== p.sequence[p.index]) endTrial(s, false);
      else if (++p.index === p.sequence.length) endTrial(s, true);
    }
  } else requireMove(false);
  return s;
}
export function visibleRun(s, now = Date.now()) {
  if (!s.pending) return s;
  const { safe, win, sequence, ...pending } = s.pending;
  if (sequence) {
    pending.count = sequence.length;
    if (now < pending.revealUntil) pending.sequence = sequence;
  }
  return { ...s, pending };
}
