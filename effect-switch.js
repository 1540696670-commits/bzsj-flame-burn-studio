(()=>{
 const picker=document.querySelector('.effect-switch');if(!picker)return;
 const links=[...picker.querySelectorAll('a')];links.forEach(a=>a.href=new URL(a.getAttribute('href'),location.href).href);
 for(const link of links){
  const text=[...link.childNodes].find(node=>node.nodeType===Node.TEXT_NODE&&node.textContent.trim());
  if(!text)continue;
  const name=document.createElement('span');name.className='effect-menu-name';name.textContent=text.textContent.trim();name.dataset.text=name.textContent;
  name.dataset.effect=name.textContent==='焰字'?'flame':name.textContent==='焚字'?'burn':name.textContent==='流墨'?'fluid':name.textContent==='字隙'?'zixi':'motion';
  text.replaceWith(name);
 }
 let eggTimer,finishTimer;
 const stopEgg=()=>{clearTimeout(eggTimer);clearTimeout(finishTimer);picker.classList.remove('menu-easter-egg');};
 picker.addEventListener('toggle',()=>{stopEgg();if(picker.open)eggTimer=setTimeout(()=>{
  if(!picker.open)return;picker.classList.add('menu-easter-egg');
  finishTimer=setTimeout(()=>picker.classList.remove('menu-easter-egg'),7000);
 },5000);});
 links.forEach(link=>link.addEventListener('click',stopEgg));
 const setActive=(win,active)=>{try{win.studioSleeping=!active;if(win.study?.setStudioActive)win.study.setStudioActive(active);if(win.fluidEngine){if(active)win.fluidEngine.resume();else if(!win.fluidEngine.isPaused())win.fluidEngine.pause();}if(win.motion){win.motion.last=win.performance.now();}if(win.burnStudio){active?win.burnStudio.play():win.burnStudio.pause();}if(active&&win.flameDemo&&!win.flameDemo.getState().playing)win.document.getElementById('play').click();}catch{}};
 if(window===window.top){
  const original=location.pathname,frames=new Map();let active=original;
  const ensure=path=>{if(path===original||frames.has(path))return frames.get(path);const frame=document.createElement('iframe');frame.className='studio-frame';frame.title='动画工作室';frame.src=path+'?prewarm=1';frame.loading='eager';document.body.append(frame);frames.set(path,frame);return frame;};
  window.studioSwitchPreload=ensure;
  window.studioSwitch=path=>{if(path===active)return;const start=performance.now();document.querySelectorAll('.effect-switch').forEach(el=>el.open=false);
   for(const [key,frame] of frames){frame.classList.toggle('active',key===path);setActive(frame.contentWindow,key===path);}
   setActive(window,path===original);document.body.classList.toggle('studio-child-active',path!==original);
   if(path!==original){const frame=ensure(path);frame.classList.add('active');setActive(frame.contentWindow,true);}
   active=path;history.pushState({studio:path},'',path);window.lastStudioSwitch={path,milliseconds:performance.now()-start};
  };
  window.addEventListener('popstate',()=>window.studioSwitch(location.pathname));
  const warm=()=>links.forEach((a,i)=>{const path=new URL(a.href).pathname;if(path==='/zixi/')return;if(matchMedia('(pointer:coarse)').matches||innerWidth<=720)setTimeout(()=>ensure(path),i*800);else ensure(path);});picker.addEventListener('toggle',()=>{if(picker.open)warm();});setTimeout(warm,2500);
  window.addEventListener('message',event=>{if(event.origin!==location.origin||event.data?.type!=='studio-ready')return;const path=event.data.path,frame=frames.get(path);if(frame)setActive(frame.contentWindow,path===active);});
 }else{
  const poll=setInterval(()=>{if(window.study||window.fluidEngine||window.motion||window.flameDemo||window.burnStudio&&document.getElementById('stage').width>300){clearInterval(poll);if(window.flameDemo)flameDemo.render(0);setActive(window,false);parent.postMessage({type:'studio-ready',path:location.pathname},location.origin);}},50);
 }
 links.forEach(a=>a.addEventListener('pointerenter',()=>{if(window===window.top&&new URL(a.href).pathname==='/zixi/')window.studioSwitchPreload?.('/zixi/');}));
 links.forEach(a=>a.addEventListener('click',e=>{if(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;e.preventDefault();const path=new URL(a.href).pathname;picker.open=false;window.top.studioSwitch(path);}));
 document.addEventListener('pointerdown',e=>{if(!picker.contains(e.target))picker.open=false;});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&picker.open){picker.open=false;picker.querySelector('summary').focus();}});
})();
