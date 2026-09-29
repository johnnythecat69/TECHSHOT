function publicUrl(value){try{const url=new URL(value);const host=url.hostname.toLowerCase();if(url.protocol!=='https:')return null;if(['localhost','127.0.0.1','0.0.0.0','::1'].includes(host)||host.startsWith('10.')||host.startsWith('192.168.')||host.startsWith('169.254.'))return null;return url.href}catch{return null}}
module.exports=async function(req,res){
  if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Используй POST.'})}
  const bridgeUrl=publicUrl(process.env.COMFY_BRIDGE_URL);const bridgeToken=process.env.COMFY_BRIDGE_TOKEN;
  if(!bridgeUrl||!bridgeToken)return res.status(503).json({error:'Локальный генератор ещё не подключён.'});
  try{const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});const jobId=String(body.jobId||'');if(!jobId)return res.status(400).json({error:'Нет идентификатора задачи.'});const response=await fetch(new URL('/jobs/'+encodeURIComponent(jobId),bridgeUrl),{headers:{Authorization:'Bearer '+bridgeToken},signal:AbortSignal.timeout(59000)});const payload=await response.json().catch(()=>({}));if(!response.ok)throw new Error(payload.error||'Не удалось проверить состояние кадра.');return res.status(200).json(payload)}catch(error){return res.status(502).json({error:error.message||'Ошибка проверки кадра.'})}
};
module.exports.config={maxDuration:60};
