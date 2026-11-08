import { api } from './api.js';
import assets from 'built:assets';

const types = {'/':'text/html; charset=utf-8','/game.css':'text/css; charset=utf-8','/game.js':'text/javascript; charset=utf-8'};
export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (path.startsWith('/api/')) {
      try { const userId = request.headers.get('oai-authenticated-user-email') && request.headers.get('oai-authenticated-user-id');
        return await api(request, env.DB, userId); }
      catch (error) {
        console.error('Player storage:', error.message);
        return Response.json({error:'Доска временно недоступна.'}, {status:503,headers:{'Cache-Control':'no-store'}});
      }
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response(null,{status:405});
    if (!Object.hasOwn(types,path)) return new Response('Not found',{status:404});
    return new Response(request.method === 'HEAD' ? null : assets[path], {headers:{
      'Content-Type':types[path], 'X-Content-Type-Options':'nosniff',
      'Cache-Control':path==='/'?'no-cache':'public, max-age=120',
      'Content-Security-Policy':"default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'self'"
    }});
  }
};
