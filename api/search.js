const MAX_RESULTS=16;
const FILTERS={all:{query:model=>`${model} фото техники`},manufacturer:{query:model=>`${model} официальный сайт фото`},stores:{query:model=>`${model} купить фото`},media:{query:model=>`${model} обзор фото`}};
function clean(value,max){return String(value||'').replace(/\s+/g,' ').trim().slice(0,max)}
function httpUrl(value){try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)?url.href:null}catch{return null}}
function domain(value){try{return new URL(value).hostname.replace(/^www\./,'')}catch{return 'Источник'}}
function decodeXml(value){return String(value||'').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#(?:x([\da-f]+)|(\d+));/gi,(_,hex,decimal)=>String.fromCodePoint(parseInt(hex||decimal,hex?16:10))).replace(/&amp;/g,'&')}
function decodeHtml(value){return decodeXml(String(value||'').replace(/&#39;|&apos;/gi,"'"))}
function textFromHtml(value){return clean(decodeHtml(String(value||'').replace(/<[^>]*>/g,' ')),220)}
function xmlTag(xml,tag){const match=String(xml).match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`,'i'));return match?decodeXml(match[1].replace(/<[^>]*>/g,' ')):''}
function yandexImageSearchUrl(query){return `https://yandex.ru/images/search?text=${encodeURIComponent(query)}`}
function isGlobaldriveProductUrl(value){try{const url=new URL(value);return /(^|\.)globaldrive\.ru$/i.test(url.hostname)&&url.pathname.includes('/catalog/')}catch{return false}}
function absoluteGlobaldriveUrl(value){try{return new URL(value,'https://globaldrive.ru').href}catch{return null}}
function parseGlobaldriveGallery(html,pageUrl,query){
  const titleMatch=String(html).match(/<meta[^>]+(?:property|name)=["'](?:og:title|twitter:title)["'][^>]+content=["']([^"']+)["']/i)||String(html).match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:title|twitter:title)["']/i)||String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title=textFromHtml(titleMatch?.[1]||query)||query;
  const gallery=[...String(html).matchAll(/<a\b[^>]*\bdata-fancybox=["']card-photo-fancy["'][^>]*>/gi)];
  const seen=new Set();
  const images=gallery.map((match,index)=>{
    const href=match[0].match(/\bhref=["']([^"']+)["']/i)?.[1];
    const imageUrl=absoluteGlobaldriveUrl(href);
    if(!imageUrl||seen.has(imageUrl))return null;
    seen.add(imageUrl);
    return {imageUrl,pageUrl,title:`${title} · фото ${index+1}`,domain:'globaldrive.ru',engine:'globaldrive'};
  }).filter(Boolean);
  return {title,images};
}
async function fetchGlobaldriveGallery(pageUrl,query){
  const response=await fetch(pageUrl,{headers:{'User-Agent':'Mozilla/5.0 (compatible; TechShotStudio/1.0)','Accept':'text/html,application/xhtml+xml'}});
  if(!response.ok)throw new Error(`Globaldrive не открыл карточку (HTTP ${response.status}).`);
  const parsed=parseGlobaldriveGallery(await response.text(),pageUrl,query);
  if(!parsed.images.length)throw new Error('В карточке Globaldrive не найдена фотогалерея.');
  return parsed;
}
async function findGlobaldriveProduct(query){
  if(!process.env.SERPER_API_KEY)throw new Error('Поиск Globaldrive требует SERPER_API_KEY. Можно вставить прямую ссылку на карточку.');
  const response=await fetch('https://google.serper.dev/search',{method:'POST',headers:{'X-API-KEY':process.env.SERPER_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({q:`site:globaldrive.ru/catalog/ ${query}`,num:5,gl:'ru',hl:'ru',autocorrect:false})});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(payload?.message||payload?.error||'Поиск Globaldrive не ответил.');
  const item=(Array.isArray(payload.organic)?payload.organic:[]).find(result=>isGlobaldriveProductUrl(result.link));
  return item?.link||null;
}
async function searchGlobaldrive(query){
  const pageUrl=isGlobaldriveProductUrl(query)?query:await findGlobaldriveProduct(query);
  if(!pageUrl)return null;
  return fetchGlobaldriveGallery(pageUrl,query);
}
function providerError(payload,status,fallback){
  if(typeof payload==='string'&&payload.trim()){
    if(/permissiondenied|permission to \[resource-manager/i.test(payload))return 'Яндекс Картинки: API-ключ не имеет доступа к выбранному каталогу. Создай новый ключ в AI Studio в этом каталоге или выдай его сервисному аккаунту роль search-api.webSearch.user.';
    return payload.trim();
  }
  const details=payload?.details||payload?.error?.details;
  const detailText=Array.isArray(details)?details.map(item=>item?.message||item?.detail||'').filter(Boolean).join(' '):'';
  const message=payload?.message||payload?.error?.message||payload?.error_description||detailText;
  if(/permissiondenied|permission to \[resource-manager/i.test(message||''))return 'Яндекс Картинки: API-ключ не имеет доступа к выбранному каталогу. Создай новый ключ в AI Studio в этом каталоге или выдай его сервисному аккаунту роль search-api.webSearch.user.';
  return message||`${fallback} (HTTP ${status}).`;
}
async function searchGoogle(query){if(!process.env.SERPER_API_KEY)throw new Error('Google Images не настроен: добавь SERPER_API_KEY в Vercel.');const response=await fetch('https://google.serper.dev/images',{method:'POST',headers:{'X-API-KEY':process.env.SERPER_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({q:query,num:MAX_RESULTS,gl:'ru',hl:'ru',autocorrect:false})});const payload=await response.json().catch(()=>({}));if(!response.ok)throw new Error(payload?.message||payload?.error||'Google Images не ответил.');const seen=new Set();return (Array.isArray(payload.images)?payload.images:[]).map(item=>{const imageUrl=httpUrl(item.imageUrl||item.thumbnailUrl);const pageUrl=httpUrl(item.link||item.source||item.imageUrl);if(!imageUrl||!pageUrl||seen.has(imageUrl))return null;seen.add(imageUrl);return {imageUrl,pageUrl,title:clean(item.title,180)||query,domain:domain(pageUrl),engine:'google'}}).filter(Boolean)}
function parseYandexImages(rawData,query){const xml=Buffer.from(String(rawData||''),'base64').toString('utf8');const blocks=xml.match(/<doc(?:\s[^>]*)?>[\s\S]*?<\/doc>/gi)||[];const seen=new Set();return blocks.map(block=>{const imageUrl=httpUrl(xmlTag(block,'url')||xmlTag(block,'original-url')||xmlTag(block,'img-url'));if(!imageUrl||seen.has(imageUrl))return null;seen.add(imageUrl);const sourceDomain=clean(xmlTag(block,'domain'),140)||domain(imageUrl);const title=clean(xmlTag(block,'title'),180)||query;return {imageUrl,pageUrl:yandexImageSearchUrl(query),title,domain:sourceDomain,engine:'yandex'}}).filter(Boolean)}
async function searchYandex(query){if(!process.env.YANDEX_SEARCH_API_KEY||!process.env.YANDEX_FOLDER_ID)throw new Error('Яндекс Картинки не настроен: добавь YANDEX_SEARCH_API_KEY и YANDEX_FOLDER_ID в Vercel.');const response=await fetch('https://searchapi.api.cloud.yandex.net/v2/image/search',{method:'POST',headers:{'Authorization':`Api-Key ${process.env.YANDEX_SEARCH_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({query:{searchType:'SEARCH_TYPE_RU',queryText:query,familyMode:'FAMILY_MODE_STRICT',page:'0',fixTypoMode:'FIX_TYPO_MODE_OFF'},imageSpec:{size:'IMAGE_SIZE_LARGE'},docsOnPage:String(MAX_RESULTS),folderId:process.env.YANDEX_FOLDER_ID})});const raw=await response.text();let payload={};try{payload=raw?JSON.parse(raw):{}}catch{payload=raw}if(!response.ok)throw new Error(providerError(payload,response.status,'Яндекс Картинки не ответил'));const images=parseYandexImages(payload.rawData,query);if(!images.length)throw new Error('Яндекс Картинки не вернул пригодных для показа ссылок.');return images}
function uniqueImages(images){const seen=new Set();return images.filter(image=>{const key=image.imageUrl.toLowerCase();if(seen.has(key))return false;seen.add(key);return true}).slice(0,MAX_RESULTS)}
module.exports=async function(req,res){if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Используй POST.'})}try{const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});const requestedModel=clean(body.model,500);const filter=FILTERS[body.filter]?body.filter:'all';const engine=['auto','google','yandex','both'].includes(body.engine)?body.engine:'auto';if(!requestedModel)return res.status(400).json({error:'Укажи модель или вставь ссылку на карточку Globaldrive.'});if(engine==='auto'){
    try{const globaldrive=await searchGlobaldrive(requestedModel);if(globaldrive)return res.status(200).json({model:isGlobaldriveProductUrl(requestedModel)?globaldrive.title:requestedModel,filter,engine,source:'globaldrive',images:uniqueImages(globaldrive.images),errors:[]});}catch(error){/* Если карточка недоступна, штатно продолжаем поиском по сети. */}
  }
  if(isGlobaldriveProductUrl(requestedModel))return res.status(404).json({error:'В этой карточке Globaldrive не нашлась фотогалерея. Вставь название модели — сервис поищет её по всей сети.'});
  const query=FILTERS[filter].query(requestedModel);const searches=[];const networkEngine=engine==='auto'?'both':engine;if(networkEngine==='google'||networkEngine==='both')searches.push({engine:'google',task:searchGoogle(query)});if(networkEngine==='yandex'||networkEngine==='both')searches.push({engine:'yandex',task:searchYandex(query)});const settled=await Promise.allSettled(searches.map(item=>item.task));const images=[];const errors=[];settled.forEach((result,index)=>{if(result.status==='fulfilled')images.push(...result.value);else errors.push({engine:searches[index].engine,error:result.reason?.message||'Поиск недоступен.'})});const usable=uniqueImages(images);if(!usable.length)return res.status(503).json({error:errors.map(item=>item.error).join(' ')});return res.status(200).json({model:requestedModel,filter,engine:networkEngine,source:engine==='auto'?'network-fallback':'network',images:usable,errors})}catch(error){return res.status(502).json({error:error.message||'Ошибка поиска фотографий.'})}};
module.exports.config={maxDuration:30};
