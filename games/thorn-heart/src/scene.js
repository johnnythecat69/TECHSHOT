import * as T from 'three';
import { END, GLYPHS, TILES } from './game.js';

const tones = {jade:0x81e7b2, bronze:0xf0a658, bone:0xf5dfb4, amethyst:0xc39dff};
const colors = { start:0x8be5c1, threat:0xf2a180, event:0xe7c992, rest:0xaad6a4, relic:0xf9d38f, shrine:0xc9a4ef, gate:0x7df0c8 };
const marks = { start:'✦', threat:'×', event:'·', rest:'+', relic:'◇', shrine:'☽', gate:'✦' };
const V = (x,y,z) => new T.Vector3(x,y,z);
const mat = (color, options = {}) => new T.MeshStandardMaterial({color, roughness:.8, ...options});
let seed = 8136;
function random() {
  seed = (1664525 * seed + 1013904223) >>> 0;
  return seed / 2**32;
}
function texture(kind) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const pix = ctx.createImageData(256,256);
  for (let y=0; y<256; y++) for (let x=0; x<256; x++) {
    const n = kind === 'wood'
      ? 142 + 39*Math.sin(y*.45 + Math.sin(x*.024)*3 + Math.sin(y*.09)*2) + 17*Math.sin(y*1.44 + Math.sin(x*.052)*2)
      : 171 + 12*Math.cos(x*.11 + y*.13) + 13*Math.sin(x*.31 - y*.16);
    const k = (y*256+x)*4;
    const v = n + random()*38;
    pix.data[k]=v; pix.data[k+1]=v; pix.data[k+2]=v; pix.data[k+3]=255;
  }
  ctx.putImageData(pix,0,0);
  const tex = new T.CanvasTexture(c);
  tex.colorSpace = T.SRGBColorSpace;
  return tex;
}
function label(text, color, size = 0.6) {
  const c = document.createElement('canvas');
  c.width=c.height=128;
  const ctx=c.getContext('2d');
  ctx.font = 'bold 83px Georgia';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = color; ctx.fillText(text,64,67);
  const map = new T.CanvasTexture(c); map.colorSpace = T.SRGBColorSpace;
  const mesh = new T.Mesh(new T.PlaneGeometry(size,size),new T.MeshBasicMaterial({map,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}));
  mesh.rotation.x=-Math.PI/2;
  return mesh;
}
function rounded(w,h,r) {
  const x=-w/2, y=-h/2, s=new T.Shape();
  s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);
  s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);
  s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);
  return s;
}
export function makeBoardPath() {
  const control = [[4.61,3.28],[3.1,3.32],[.2,3.35],[-2.7,3.26],[-4.48,2.86],[-4.63,.9],[-4.53,-1.8],[-4.05,-3.22],[-1.8,-3.32],[1,-3.36],[3.75,-3.22],[4.55,-2.55],[4.39,-.85],[3.23,-.04],[2.6,1.66],[1.15,2.06],[-1.02,2.05],[-2.88,1.66],[-3.12,.45],[-2.77,-.87],[-1.77,-1.64],[-.57,-1.9],[.6,-1.6],[1.18,-.85],[.91,-.21],[.18,.04]];
  const path=new T.CatmullRomCurve3(control.map(([x,z])=>V(x,.18,z)));
  path.arcLengthDivisions=900;
  return path;
}
export function makeScene(host, selectRune) {
  const renderer = new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.65));
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFShadowMap;
  host.append(renderer.domElement);
  const scene = new T.Scene();
  scene.background = new T.Color(0x152821);
  scene.fog = new T.FogExp2(0x152821,.055);
  const camera = new T.PerspectiveCamera(39,1,.1,85);
  let azimuth=.11, pitch=.93, distance=18.5, top=false, aspect=1;
  const target=V(-.12,.1,.05);
  const board = new T.Group(); scene.add(board);
  function mesh(g,m,x,y,z,parent=board) {
    const obj=new T.Mesh(g,m); obj.position.set(x,y,z); parent.add(obj); obj.receiveShadow=true; return obj;
  }
  const box=(x,y,z,w,h,d,m,parent)=>mesh(new T.BoxGeometry(w,h,d),m,x,y,z,parent);
  function slab(w,h,r,depth,y,m) {
    const g = new T.ExtrudeGeometry(rounded(w,h,r),{depth,bevelSize:.045,bevelThickness:.055,bevelSegments:2,steps:1});
    g.rotateX(-Math.PI/2);
    const o=mesh(g,m,0,y,0);
    o.castShadow=true;
    return o;
  }
  scene.add(new T.HemisphereLight(0xc1ead9,0x5a3730,2.3));
  const sun=new T.DirectionalLight(0xffdb9b,3.05);
  sun.position.set(-5,10,3); sun.castShadow=true; sun.shadow.mapSize.set(1024,1024);
  Object.assign(sun.shadow.camera,{left:-9,right:9,top:9,bottom:-9,near:.2,far:27});
  sun.shadow.bias=-.0006; sun.shadow.normalBias=.025; scene.add(sun);
  const fill=new T.DirectionalLight(0x6affce,1.35); fill.position.set(5,4,-7); scene.add(fill);
  const wood = texture('wood'), stone = texture('stone');
  const timber=mat(0x75472a,{map:wood}), darkWood=mat(0x472719,{map:wood}), brass=mat(0xb38d49,{metalness:.58,roughness:.47});
  slab(11.4,9.0,.31,.34,-.48,darkWood);
  slab(11.19,8.78,.26,.18,-.16,timber);
  slab(10.49,8.06,.16,.04,.045,mat(0x214f3a,{map:stone}));
  const floor=mesh(new T.PlaneGeometry(135,135),mat(0x26372d,{map:stone}),0,-.61,0,scene); floor.rotation.x=-Math.PI/2;
  for (const z of [-4.28,4.28]) {
    box(0,.14,z,10.95,.22,.36,timber).castShadow=true;
    box(0,.26,z,10.6,.019,.027,brass);
    for(let i=-10;i<=10;i++) box(i*.49,.265,z,.21,.025,.21,darkWood).rotation.y=Math.PI/4;
  }
  for (const x of [-5.41,5.41]) {
    box(x,.14,0,.37,.22,8.3,timber).castShadow=true;
    box(x,.26,0,.027,.018,7.95,brass);
    for(let i=-8;i<=8;i++) box(x,.265,i*.445,.20,.024,.20,darkWood).rotation.y=Math.PI/4;
  }
  for(const x of [-5.35,5.35]) for(const z of [-4.17,4.17]) {
    const mount=mesh(new T.CylinderGeometry(.25,.28,.10,8),brass,x,.295,z);
    mount.castShadow=true;
    const sign=label('✦','#49311b',.31);sign.position.set(x,.35,z);board.add(sign);
  }
  const leafGeo = new T.BufferGeometry();
  leafGeo.setAttribute('position',new T.Float32BufferAttribute([0,0,0, -.36,.025,.57, 0,.035,1.24, .34,.02,.62, 0,.15,.58],3));
  leafGeo.setIndex([0,1,4,1,2,4,2,3,4,3,0,4]);leafGeo.computeVertexNormals();
  const leaves=[0x1f6041,0x35754c,0x69965b,0x1b4736,0xa18a49].map(c=>mat(c,{side:T.DoubleSide}));
  function leaf(x,y,z,length,angle,parent=board) {
    const o=mesh(leafGeo,leaves[Math.floor(random()*leaves.length)],x,y,z,parent);
    o.scale.set(length,length,length);o.rotation.y=angle;return o;
  }
  for(let i=0;i<180;i++) {
    const x=(random()-.5)*10.14,z=(random()-.5)*7.86;
    leaf(x,.093,z,.19+random()*.45,random()*6.28);
  }
  for(let i=0;i<25;i++) {
    const a=i/25*Math.PI*2, radius=6.4+random()*7;
    const x=Math.cos(a)*radius,z=Math.sin(a)*radius*.88;
    if(Math.abs(x)<5.9 && Math.abs(z)<4.8) continue;
    const height=.1+random()*.42;
    for(let j=0;j<8;j++){
      const o=leaf(x,-.55+height,z,.7+random()*1.65,a+j*.79,scene);
      o.rotation.x=-.22-random()*.72;
    }
    const rock=mesh(new T.DodecahedronGeometry(.45+random()*.75,0),mat(0x465449,{flatShading:true}),x,-.5,z,scene);
    rock.scale.set(1.3,.57,1); rock.rotation.y=a;
  }

  const path = makeBoardPath();
  const spots=Array.from({length:END+1},(_,i)=>path.getPointAt(i/END));
  const rimMat=mat(0x8b6c43,{metalness:.28});
  const ring = mesh(new T.TorusGeometry(.87,.073,10,52),brass,0,.29,0); ring.rotation.x=-Math.PI/2;
  const innerRing = mesh(new T.TorusGeometry(.77,.029,9,52),mat(0x74d9b7,{emissive:0x285e45,emissiveIntensity:.9}),0,.31,0);innerRing.rotation.x=-Math.PI/2;
  const well = mesh(new T.CylinderGeometry(.82,.91,.18,52),rimMat,0,.18,0);well.castShadow=true;
  const portalMat=new T.ShaderMaterial({
    uniforms:{clock:{value:0},alarm:{value:0}}, vertexShader:'varying vec2 p; void main(){p=uv-.5;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec2 p; uniform float clock; uniform float alarm;
    void main(){float d=length(p);float a=atan(p.y,p.x);float w=sin(39.*d-3.*a+sin(a*5.+clock)*1.2+clock*1.9)*.5+.5;float edge=pow(clamp(d*2.,0.,1.),2.);
    vec3 cool=vec3(.08,.79,.58), hot=vec3(.93,.31,.12);
    vec3 c=vec3(.012,.035,.026)+mix(cool,hot,alarm)*(w*.46+edge*.5)*smoothstep(.04,.42,d);gl_FragColor=vec4(c,1.);}`
  });
  const portal=mesh(new T.CircleGeometry(.766,54),portalMat,0,.30,0);portal.rotation.x=-Math.PI/2;
  const glow=new T.PointLight(0x60e8b5,16,4.2,2);glow.position.set(0,.57,0);board.add(glow);

  const tileColors = {start:0xb9dac2, threat:0xba8966, event:0xcdb587, rest:0xa4ad89, relic:0xe1b878, shrine:0xb09d9d};
  const tiles = [];
  for(let i=0;i<END;i++) {
    const spot=spots[i], tangent=path.getTangentAt(i/END), kind=TILES[i];
    const group=new T.Group(); group.position.copy(spot); group.rotation.y=Math.atan2(-tangent.z,tangent.x);board.add(group);
    const color = new T.Color(tileColors[kind]).multiplyScalar(.91+random()*.15);
    const m = mat(color,{map:stone,emissive:colors[kind],emissiveIntensity:.025});
    const shape=new T.ExtrudeGeometry(rounded(.84,.77,.145),{depth:.07,bevelSize:.025,bevelThickness:.025,bevelSegments:2});
    shape.rotateX(-Math.PI/2);
    const o=mesh(shape,m,0,0,0,group);o.castShadow=true;
    tiles.push(o);
    const face=label(marks[kind],'#30271e',.48);face.position.set(0,.102,0);group.add(face);
  }

  const pawn=new T.Group();board.add(pawn);
  const pawnMat=mat(tones.jade,{metalness:.39,roughness:.34,emissive:0x2d725a,emissiveIntensity:.15});
  mesh(new T.CylinderGeometry(.24,.29,.11,12),brass,0,.065,0,pawn).castShadow=true;
  mesh(new T.CylinderGeometry(.19,.10,.37,7),pawnMat,0,.30,0,pawn).castShadow=true;
  mesh(new T.IcosahedronGeometry(.17,1),pawnMat,0,.59,0,pawn).castShadow=true;
  const halo=mesh(new T.TorusGeometry(.33,.022,8,32),new T.MeshBasicMaterial({color:0x9affce}),0,.014,0,pawn);halo.rotation.x=-Math.PI/2;
  let landed=0, route=null, aim=0;
  const dice=new T.Group();board.add(dice);
  const directions=[V(0,1,0),V(0,0,1),V(1,0,0),V(-1,0,0),V(0,0,-1),V(0,-1,0)];
  const cubeMat=mat(0xc7aa7b,{metalness:.18,roughness:.55});
  const cube=mesh(new T.BoxGeometry(.57,.57,.57),cubeMat,0,0,0,dice);cube.castShadow=true;
  const dotGeo=new T.CircleGeometry(.037,14),dotMat=new T.MeshBasicMaterial({color:0x34241b,side:T.DoubleSide});
  const pips=[[[0,0]],[[-1,1],[1,-1]],[[-1,1],[0,0],[1,-1]],[[-1,1],[1,1],[-1,-1],[1,-1]],[[-1,1],[1,1],[0,0],[-1,-1],[1,-1]],[[-1,1],[1,1],[-1,0],[1,0],[-1,-1],[1,-1]]];
  directions.forEach((normal,i)=>{
    const face=new T.Group();face.position.copy(normal).multiplyScalar(.288);
    face.quaternion.setFromUnitVectors(V(0,0,1),normal);dice.add(face);
    for(const [x,y] of pips[i])mesh(dotGeo,dotMat,x*.15,y*.15,0,face);
  });
  const dieEnd=new T.Quaternion();
  function pose(die) {dieEnd.setFromUnitVectors(directions[(die||1)-1],V(0,1,0));dice.quaternion.copy(dieEnd);}
  dice.position.set(-1.02,.47,1.00); pose(1);

  const runeGroup=new T.Group(), runeTargets=[]; board.add(runeGroup); runeGroup.visible=false;
  for(let i=0;i<5;i++){
    const a=Math.PI*.07 + i*Math.PI*2/5;
    const o=mesh(new T.CylinderGeometry(.44,.49,.22,8),mat(0x435d4c,{emissive:0x66f4c3,emissiveIntensity:.32}),Math.cos(a)*1.63,.62,Math.sin(a)*1.63,runeGroup);
    o.userData.rune=i; runeTargets.push(o);
    const glyph=label(GLYPHS[i],'#fbdfac',.68);
    glyph.position.copy(o.position);glyph.position.y+=.117;runeGroup.add(glyph);
  }
  const particleGeo = new T.BufferGeometry(), fireflies=[];
  for(let i=0;i<100;i++)fireflies.push((random()-.5)*24,random()*4,(random()-.5)*18);
  particleGeo.setAttribute('position',new T.Float32BufferAttribute(fireflies,3));
  const particles=new T.Points(particleGeo,new T.PointsMaterial({color:0xb1e9a0,size:.052,transparent:true,opacity:.76,depthWrite:false}));scene.add(particles);
  const ray=new T.Raycaster();
  let drag=null, activeTrial=false;
  const canvas=renderer.domElement;
  canvas.setAttribute('aria-label','Трёхмерная проклятая доска');
  const resize=()=>{
    aspect=Math.max(.3,host.clientWidth/Math.max(host.clientHeight,1));
    camera.aspect=aspect;camera.updateProjectionMatrix();
    renderer.setSize(host.clientWidth,host.clientHeight,false);
  };
  new ResizeObserver(resize).observe(host);resize();
  canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY,a:azimuth,p:pitch};canvas.setPointerCapture(e.pointerId);});
  canvas.addEventListener('pointermove',e=>{if(drag?.id!==e.pointerId)return;azimuth=drag.a-(e.clientX-drag.x)*.008;pitch=T.MathUtils.clamp(drag.p+(e.clientY-drag.y)*.006,.42,1.54);});
  canvas.addEventListener('pointercancel',()=>{drag=null;});
  canvas.addEventListener('pointerup',e=>{
    if(drag?.id!==e.pointerId)return;
    if(activeTrial && Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<6){
      const rect=canvas.getBoundingClientRect();
      ray.setFromCamera(new T.Vector2((e.clientX-rect.left)/rect.width*2-1,1-(e.clientY-rect.top)/rect.height*2),camera);
      const hit=ray.intersectObjects(runeTargets,false)[0]; if(hit)selectRune(hit.object.userData.rune);
    }
    drag=null;
  });
  canvas.addEventListener('wheel',e=>{e.preventDefault();distance=T.MathUtils.clamp(distance+e.deltaY*.012,12,25);},{passive:false});
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const now=()=>performance.now();
  renderer.setAnimationLoop(t=>{
    portalMat.uniforms.clock.value=t/1000;particles.rotation.y=t*.000031;
    portalMat.uniforms.alarm.value=activeTrial ? 1 : 0;
    glow.color.setHex(activeTrial ? 0xf58d55 : 0x60e8b5);
    glow.intensity=13+Math.sin(t*.003)*3;
    for(const [i,o] of runeTargets.entries()) o.material.emissiveIntensity=.22 + .12*Math.sin(t*.005+i);
    if(route){
      const elapsed=t-route.start;
      const spin=Math.min(1,elapsed/470);
      if(spin<1){dice.rotation.set(spin*12,spin*9,spin*7);dice.position.y=.48+Math.sin(spin*Math.PI)*.9;}
      else{dice.position.y=.47;dice.quaternion.copy(dieEnd);}
      const step=Math.max(0,(elapsed-450)/140);
      const walk=Math.min(route.end-route.from,step);
      aim=route.from+walk;
      if(step>=route.end-route.from+.5){aim=route.to;route=null;}
    } else aim=landed;
    const a=Math.floor(aim), b=Math.min(END,a+1), fraction=aim-a;
    pawn.position.copy(spots[a]).lerp(spots[b],fraction);
    pawn.position.y=.297+(route? Math.sin(fraction*Math.PI)*.19:Math.sin(t*.003)*.016);
    for(const [i,o] of tiles.entries()) o.material.emissiveIntensity=i===Math.round(aim)?.51:.025;
    const radius=distance*Math.max(1,1.06/aspect);
    const p=top ? 1.535 : pitch;
    camera.position.set(target.x+Math.sin(azimuth)*radius*Math.cos(p), target.y+radius*Math.sin(p),target.z+Math.cos(azimuth)*radius*Math.cos(p));
    camera.lookAt(target);renderer.render(scene,camera);
  });
  return {
    display(run, appearance, animate) {
      const before=landed;
      landed=run?.pos ?? 0;activeTrial=run?.pending?.kind==='trial';runeGroup.visible=activeTrial;
      pawnMat.color.setHex(tones[appearance] ?? tones.jade);
      pose(run?.die);
      route=animate && !reduced.matches ? {start:now(),from:before,end:Math.min(END,before+run.die),to:landed} : null;
    },
    toggleCamera(){top=!top;return top;}
  };
}
