const realOutput=[];
let activeOutput=null;
const modal=document.getElementById('previewModal');
const modalImage=document.getElementById('previewImage');
const zoom=document.getElementById('zoomRange');
const zoomLabel=document.getElementById('zoomValue');
const stage=document.querySelector('.preview-stage');
const grid=document.getElementById('resultGrid');
const archiveButton=document.getElementById('downloadAll');

function sizeLabel(bytes){
  if(bytes<1024*1024)return Math.max(1,Math.round(bytes/1024))+' KB';
  return (bytes/(1024*1024)).toFixed(1)+' MB';
}
function fileLink(file,name){
  const link=document.createElement('a');
  link.href=URL.createObjectURL(file);
  link.download=name||file.name;
  document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(link.href),300);
}
function setZoom(value){
  const safe=Math.max(1,Math.min(4,Number(value)||1));
  zoom.value=safe;
  zoomLabel.textContent=Math.round(safe*100)+'%';
  modalImage.style.transform='scale('+safe+')';
}
function openPhoto(item){
  activeOutput=item;
  document.getElementById('previewTitle').textContent=item.file.name;
  document.getElementById('previewFilename').textContent=item.file.name;
  document.getElementById('previewResolution').textContent=item.width+' × '+item.height+' px';
  document.getElementById('previewSize').textContent=sizeLabel(item.file.size);
  document.getElementById('previewQuality').textContent='Исходный файл · без подмены';
  modalImage.src=item.url;
  modalImage.alt='Увеличенный просмотр: '+item.file.name;
  setZoom(1);
  modal.classList.add('open');
  modal.setAttribute('aria-hidden','false');
  document.body.style.overflow='hidden';
}
function closePhoto(){
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden','true');
  document.body.style.overflow='';
}
function photoCard(item,index){
  const card=document.createElement('article');
  card.className='result-card real-result-card';
  card.innerHTML='<div class="result-image"><img class="result-preview-image" alt=""><span class="image-tag">ФОТО '+String(index+1).padStart(2,'0')+'</span><button class="result-open" type="button"><span>⤢</span><small>Открыть</small></button></div><div class="result-meta"><div><strong></strong><small></small></div><button class="download-one" type="button" title="Скачать исходный файл">⇩</button></div>';
  const img=card.querySelector('img');
  img.src=item.url;
  img.alt='Реальное фото: '+item.file.name;
  card.querySelector('.result-meta strong').textContent=item.file.name;
  card.querySelector('.result-meta small').textContent=item.width+' × '+item.height+' · '+sizeLabel(item.file.size);
  card.querySelector('.result-open').addEventListener('click',()=>openPhoto(item));
  img.addEventListener('click',()=>openPhoto(item));
  card.querySelector('.download-one').addEventListener('click',()=>fileLink(item.file));
  return card;
}
function renderOutput(){
  grid.innerHTML='';
  if(!realOutput.length){
    grid.innerHTML='<div class="empty-results" id="emptyResults"><div class="empty-results-icon">▧</div><h3>Пока нет фотографий техники</h3><p>Здесь будут только реальные результаты парсинга, загрузки или генерации — без рисунков, чужих моделей и фальшивых превью.</p><label class="upload-real-button" for="realPhotos">＋ Добавить реальные фото для просмотра</label><input id="realPhotos" type="file" accept="image/*" multiple hidden><small>Файлы остаются в браузере до подключения хранилища.</small></div>';
    bindUpload();
    return;
  }
  realOutput.forEach((item,index)=>grid.appendChild(photoCard(item,index)));
  document.getElementById('resultStatus').textContent='Загружено реальных фото: '+realOutput.length;
  archiveButton.disabled=true;
  archiveButton.title='ZIP появится после подключения backend-обработки';
}
function loadImage(file){
  return new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(file);
    const image=new Image();
    image.onload=()=>resolve({file,url,width:image.naturalWidth,height:image.naturalHeight});
    image.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Не удалось открыть изображение'));};
    image.src=url;
  });
}
async function addRealPhotos(files){
  const images=[...files].filter(file=>file.type.startsWith('image/'));
  if(!images.length){if(typeof toast==='function')toast('Выберите изображения техники.');return;}
  const loaded=await Promise.all(images.map(loadImage));
  realOutput.push(...loaded);
  renderOutput();
  if(typeof toast==='function')toast('Загружено фото: '+loaded.length+'. Можно открыть и проверить исходное разрешение.');
}
function bindUpload(){
  const input=document.getElementById('realPhotos');
  if(input)input.addEventListener('change',event=>addRealPhotos(event.target.files));
}
bindUpload();
document.querySelectorAll('[data-close-preview]').forEach(item=>item.addEventListener('click',closePhoto));
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&modal.classList.contains('open'))closePhoto();});
zoom.addEventListener('input',event=>setZoom(event.target.value));
document.getElementById('zoomOut').addEventListener('click',()=>setZoom(Number(zoom.value)-.25));
document.getElementById('zoomIn').addEventListener('click',()=>setZoom(Number(zoom.value)+.25));
document.getElementById('fitZoom').addEventListener('click',()=>setZoom(1));
document.getElementById('modalDownload').addEventListener('click',()=>{if(activeOutput)fileLink(activeOutput.file);});
stage.addEventListener('wheel',event=>{if(!modal.classList.contains('open'))return;event.preventDefault();setZoom(Number(zoom.value)+(event.deltaY<0?.15:-.15));},{passive:false});
