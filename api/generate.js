function publicUrl(value){try{const url=new URL(value);const host=url.hostname.toLowerCase();if(url.protocol!=='https:')return null;if(['localhost','127.0.0.1','0.0.0.0','::1'].includes(host)||host.startsWith('10.')||host.startsWith('192.168.')||host.startsWith('169.254.'))return null;return url.href}catch{return null}}
function dataImage(value){return /^data:image\/(?:png|jpe?g|webp);base64,[a-z0-9+/=]+$/i.test(String(value||''))?value:null}
async function referenceDataUrl(source){const inline=dataImage(source);if(inline)return inline;const url=publicUrl(source);if(!url)throw new Error('Некорректный адрес фото-референса.');const response=await fetch(url,{redirect:'follow',signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error('Не удалось получить выбранный референс. Загрузите это фото вручную.');const mime=(response.headers.get('content-type')||'').split(';')[0].toLowerCase();const size=Number(response.headers.get('content-length')||0);if(!/^image\/(png|jpeg|webp)$/.test(mime)||size>8*1024*1024)throw new Error('Референс должен быть PNG, JPG или WebP не больше 8 МБ.');const buffer=Buffer.from(await response.arrayBuffer());if(buffer.length>8*1024*1024)throw new Error('Референс больше 8 МБ.');return `data:${mime};base64,${buffer.toString('base64')}`}

module.exports=async function(req,res){
  if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Используй POST.'})}
  const bridgeUrl=publicUrl(process.env.COMFY_BRIDGE_URL);
  const bridgeToken=process.env.COMFY_BRIDGE_TOKEN;
  if(!bridgeUrl||!bridgeToken)return res.status(503).json({error:'Локальный генератор ещё не подключён. Запусти ComfyUI на рабочем ПК и добавь COMFY_BRIDGE_URL и COMFY_BRIDGE_TOKEN в Vercel.'});
  try{
    const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
    const model=String(body.model||'').replace(/\s+/g,' ').trim().slice(0,220);
    const scenario=['studio','details','nature'].includes(body.scenario)?body.scenario:'studio';
    const angle=String(body.angle||'');
    const references=Array.isArray(body.referenceImages)?body.referenceImages.slice(0,1):[];
    if(!model)return res.status(400).json({error:'Укажи модель техники.'});
    if(!['front-left','side','rear-right','rear'].includes(angle))return res.status(400).json({error:'Выбери допустимый ракурс.'});
    const referenceImage=references.length?await referenceDataUrl(references[0]):null;
    const response=await fetch(new URL('/generate',bridgeUrl),{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+bridgeToken},body:JSON.stringify({model,scenario,angle,referenceImage}),signal:AbortSignal.timeout(59000)});
    const payload=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(payload.error||'Локальный генератор не ответил.');
    if(!dataImage(payload.image))throw new Error('Локальный генератор вернул некорректный файл.');
    return res.status(200).json({image:payload.image,filename:payload.filename||`techshot-${angle}.png`,quality:payload.quality||'Создано локально · проверь QC'});
  }catch(error){return res.status(502).json({error:error.message||'Ошибка локальной генерации.'})}
};
module.exports.config={maxDuration:60};
