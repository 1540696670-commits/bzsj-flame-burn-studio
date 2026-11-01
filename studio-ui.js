(()=>{
 const $=id=>document.getElementById(id),kind=$('view')?'flame':$('mainText')?'burn':'motion';document.body.classList.add('studio-ui',kind+'-ui');
 const move=(el,to)=>{if(el)to.append(el);},label=(text,input)=>{const l=document.createElement('label');l.className='unified-color';l.append(document.createTextNode(text),input);return l;};
 let panel,font;
 if(kind!=='flame'){
  const host=document.createElement('section');host.className='unified-controls';host.innerHTML='<div class="unified-state"></div><div class="unified-dock"></div><div class="unified-download"></div><div class="unified-seek"></div>';
  (kind==='burn'?document.querySelector('.workspace'):document.body).append(host);
  const dock=host.querySelector('.unified-dock');
  const input=$(kind==='burn'?'mainText':'text');input.classList.add('unified-text');input.setAttribute('aria-label','主文字');move(input,dock);
  for(const [title,id] of (kind==='burn'?[['余烬','ember'],['文字','ink'],['背景','bg']]:[['拖尾','color'],['文字','textColor'],['背景','background']]))dock.append(label(title,$(id)));
  const divider=document.createElement('span');divider.className='unified-divider';dock.append(divider);move($('restart'),dock);if(kind==='motion')$('restart').textContent='↺';move($('play'),dock);
  const settings=document.createElement('details');settings.className='unified-settings';settings.innerHTML='<summary title="设置" aria-label="打开设置">☷</summary><div class="unified-panel"><div class="unified-heading">设置<button type="button" aria-label="关闭设置">×</button></div></div>';dock.append(settings);panel=settings.querySelector('.unified-panel');settings.querySelector('button').onclick=()=>settings.open=false;
  if(kind==='motion'){
   const old=$('inspector');old.querySelector('label[for=text]').hidden=true;old.querySelector('.field-hint').hidden=true;old.hidden=false;old.classList.add('unified-content');move(old,panel);$('closeInspector').hidden=true;old.querySelector('.inspector-title').hidden=true;
   $('editToggle').hidden=true;document.querySelector('.dock-area').hidden=true;
   move($('downloadVideo'),host.querySelector('.unified-download'));move($('timeline'),host.querySelector('.unified-seek'));move($('timecode'),host.querySelector('.unified-state'));font=$('font');
   $('reset').addEventListener('click',()=>settings.open=false);
  }else{
   for(const id of ['textPanel','fontPanel','colorPanel']){const section=$(id);section.hidden=false;section.classList.add('unified-content');section.querySelector('.panel-heading').hidden=true;const movedLabel=section.querySelector('label[for=mainText]');if(movedLabel)movedLabel.hidden=true;move(section,panel);}
   // Original color readouts remain in settings, color inputs live in the dock.
   document.querySelector('.playback').hidden=true;document.querySelector('.dock').hidden=true;document.querySelector('.hint').hidden=true;
   $('centerPlay').hidden=true;move($('timeline'),host.querySelector('.unified-seek'));move($('time'),host.querySelector('.unified-state'));
   const download=document.createElement('button');download.id='downloadBurn';download.innerHTML='下载高清 <span>↓</span>';host.querySelector('.unified-download').append(download);
  }
  document.addEventListener('keydown',e=>{if(e.key==='Escape')settings.open=false;});
 }else{panel=document.querySelector('.settings-panel');font=$('font');}
 const settings=document.querySelector(kind==='flame'?'.settings':'.unified-settings');
 document.body.append(panel);panel.hidden=!settings.open;settings.addEventListener('toggle',()=>panel.hidden=!settings.open);
 panel.querySelector(kind==='flame'?'#close-settings':'.unified-heading button').addEventListener('click',()=>settings.open=false);
 document.addEventListener('keydown',e=>{if(e.key==='Escape')settings.open=false;});
 // Uploaded fonts stay in this browser session and feed the actual glyph renderer.
 if(kind!=='burn'){
  const upload=document.createElement('label');upload.className='unified-upload';upload.textContent='＋ 上传自己的字体';const file=document.createElement('input');file.type='file';file.id='fontFile';file.accept='.ttf,.otf,.woff,.woff2';file.hidden=true;upload.append(file);font.insertAdjacentElement('afterend',upload);
  const message=document.createElement('p');message.className='font-message';upload.after(message);
  file.onchange=async()=>{const source=file.files[0];if(!source)return;try{const name='UserFont'+Date.now(),face=new FontFace(name,await source.arrayBuffer());await face.load();document.fonts.add(face);font.add(new Option(source.name.replace(/\.[^.]+$/,''),name));font.value=name;font.dispatchEvent(new Event('input',{bubbles:true}));font.dispatchEvent(new Event('change',{bubbles:true}));message.textContent='字体已导入 · 刷新后需重新上传';}catch{message.textContent='无法读取字体，请选择 TTF、OTF 或 WOFF 文件';}file.value='';};
 }
 document.querySelectorAll('.header-note,.effect-logo,.menu-logo,.creator-credit,.studio-credit').forEach(el=>el.remove());
 const footer=document.createElement('p');footer.className='menu-credit';footer.textContent='小红书 · 关注我 BzsJ';document.querySelector('.effect-switch nav').append(footer);
 for(const id of ['restart','replay']){const el=$(id);if(el)el.hidden=true;}
 const loop=$('loop');if(loop){loop.checked=true;loop.closest('label').hidden=true;}
 const durationLabel=document.querySelector('.duration');if(durationLabel)durationLabel.hidden=true;
 const download=$(kind==='flame'?'downloadFlame':kind==='burn'?'downloadBurn':'downloadVideo');
 download.classList.add('download-icon');download.setAttribute('aria-label','下载高清 MP4');download.title='下载高清 MP4 · 最高 4K';download.innerHTML='↓';
 (kind==='flame'?document.querySelector('.dock'):document.querySelector('.unified-dock')).append(download);
 new MutationObserver(()=>{if(!download.disabled&&download.textContent.trim()!=='↓')download.innerHTML='↓';}).observe(download,{childList:true});
})();
