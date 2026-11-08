import { createServer, IncomingMessage } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import worker from '../dist/server/index.js';

const port=Number(process.env.PORT || 4173);
const host=process.env.HOST || '127.0.0.1';
await mkdir('.data',{recursive:true,mode:0o700});
const db=new DatabaseSync('.data/thorn-heart.sqlite');
const migration=await readFile('drizzle/0000_player_state.sql','utf8');
db.exec(migration.replace('CREATE TABLE ', 'CREATE TABLE IF NOT EXISTS '));
db.exec(`
  CREATE TABLE IF NOT EXISTS accounts (login TEXT PRIMARY KEY, salt TEXT NOT NULL, hash TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS sessions (key TEXT PRIMARY KEY, login TEXT NOT NULL, expiry INTEGER NOT NULL);
`);
const env={DB:{prepare(sql) {const stmt=db.prepare(sql);return {bind(...params) {
  return {first:()=>stmt.get(...params),run:()=>({meta:{changes:stmt.run(...params).changes}})};
}};}}};
const derive=promisify(scrypt);
const hashKey=token=>createHash('sha256').update(token).digest('hex');
const sessionToken=req=>req.headers.get('cookie')?.match(/(?:^|;\s*)thorn_session=([0-9a-f]{64})(?:;|$)/)?.[1];
const ttl=60*60*24*30;
const cookie=(value,age,secure)=>`thorn_session=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${age}${secure?'; Secure':''}`;
const redirect=(location,headers={})=>new Response(null,{status:303,headers:{Location:location,...headers}});
const loginPage=(message='',status=200)=>new Response(`<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Вход · Сердце чащи</title><link rel="stylesheet" href="/game.css"><main><section class="gate-card"><p class="eyebrow">СЕРДЦЕ ЧАЩИ</p><h1>Досье путника</h1><p>Локальная версия. Войди или зарегистрируйся на этом сервере.</p><p role="alert">${message}</p><form class="local-form" method="post"><label>Логин <input name="login" required minlength="3" maxlength="32" autocomplete="username"></label><label>Пароль <input name="password" type="password" required minlength="10" maxlength="128" autocomplete="current-password"></label><button class="gold" name="mode" value="login">Войти</button><button class="quiet" name="mode" value="register">Создать аккаунт</button></form><p><a href="/">← К доске</a></p></section></main></html>`,{status,headers:{
  'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store',
  'Content-Security-Policy':"default-src 'self'; base-uri 'none'; form-action 'self'"
}});
let deriving=0;
async function handle(req) {
  const url=new URL(req.url);
  const token=sessionToken(req);
  const session=token && db.prepare('SELECT login FROM sessions WHERE key = ? AND expiry > ?').get(hashKey(token),Date.now());
  if(url.pathname==='/signin-with-chatgpt' && req.method==='GET')return redirect(session?'/':'/local-login');
  if(url.pathname==='/signout-with-chatgpt' && req.method==='GET'){
    if (token) db.prepare('DELETE FROM sessions WHERE key = ?').run(hashKey(token));
    return redirect('/',{'Set-Cookie':cookie('',0,url.protocol==='https:')});
  }
  if(url.pathname==='/local-login'){
    if (session) return redirect('/');
    if (req.method==='GET')return loginPage();
    if (req.method!=='POST' || req.headers.get('origin')!==url.origin) return loginPage('Недопустимый запрос.',403);
    if (deriving>=4) return loginPage('Сервер занят. Попробуй ещё раз.',429);
    const form=new URLSearchParams(await req.text());
    const login=(form.get('login')||'').trim().toLowerCase(), password=form.get('password')||'';
    if (!/^[a-z0-9_.-]{3,32}$/.test(login) || password.length<10 || password.length>128)
      return loginPage('Логин: 3–32 латинские буквы, цифры или ._-. Пароль: 10–128 символов.',400);
    const account=db.prepare('SELECT salt, hash FROM accounts WHERE login = ?').get(login);
    const salt=account?.salt ?? randomBytes(16).toString('hex');
    let derived;
    deriving++;
    try {derived=await derive(password,salt,64);} finally {deriving--;}
    if(form.get('mode')==='register') {
      const inserted=db.prepare('INSERT OR IGNORE INTO accounts VALUES (?, ?, ?)').run(login,salt,derived.toString('hex'));
      if (!inserted.changes) return loginPage('Этот логин уже занят.',409);
    } else if(!account || !timingSafeEqual(derived,Buffer.from(account.hash,'hex'))) return loginPage('Неверный логин или пароль.',401);
    const key=randomBytes(32).toString('hex');
    db.prepare('DELETE FROM sessions WHERE expiry <= ?').run(Date.now());
    db.prepare('INSERT INTO sessions VALUES (?, ?, ?)').run(hashKey(key),login,Date.now()+ttl*1000);
    return redirect('/',{'Set-Cookie':cookie(key,ttl,url.protocol==='https:')});
  }
  req.headers.delete('oai-authenticated-user-id');
  req.headers.delete('oai-authenticated-user-email');
  if(session){
    req.headers.set('oai-authenticated-user-id',session.login);
    req.headers.set('oai-authenticated-user-email',session.login+'@local.invalid');
  }
  const response=await worker.fetch(req,env);
  if(url.pathname==='/' && req.method==='GET')return new Response((await response.text()).replace('<body>','<body data-local="true">'),response);
  return response;
}

createServer({IncomingMessage},async (req,res)=>{
  try{
    const proto=req.headers['x-forwarded-proto']==='https'?'https':'http';
    const base=`${proto}://${req.headers.host}`;
    if (!req.url?.startsWith('/') || req.url.startsWith('//')) {res.writeHead(400).end();return;}
    const chunks=[];
    let length=0;
    for await (const part of req) {
      length+=part.length;
      if(length>8192){res.writeHead(413).end();return;}
      chunks.push(part);
    }
    const request=new Request(base+req.url,{method:req.method,headers:req.headers,body:chunks.length?Buffer.concat(chunks):undefined});
    const result=await handle(request);
    res.writeHead(result.status,Object.fromEntries(result.headers));res.end(Buffer.from(await result.arrayBuffer()));
  } catch(error){console.error(error.message);if(!res.headersSent)res.writeHead(500);res.end();}
}).listen(port,host,()=>console.log(`Сердце чащи · http://${host}:${port}`));
