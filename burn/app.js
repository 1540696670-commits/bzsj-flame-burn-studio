'use strict';
const $=id=>document.getElementById(id);
const fonts=[['Anton','Anton','紧凑粗体'],['Bebas','Bebas','高窄标题'],['Sans','Arial, "Microsoft YaHei", sans-serif','现代无衬线'],['Serif','Georgia, "SimSun", serif','经典衬线'],['Mono','"Courier New", monospace','等宽字体'],['Hei','"SimHei", "Microsoft YaHei", sans-serif','中文黑体'],['Song','"SimSun", "Songti SC", serif','中文宋体'],['Kai','"KaiTi", "STKaiti", serif','中文楷体']];
const state={main:'BzsJ',sub:'BURN STUDIO',font:'Serif',size:1,ink:'#f6d745',ember:'#ff8040',bg:'#101010',t:0,playing:false,image:null,imageUrl:null};
const canvas=$('stage'),gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:false,antialias:false,preserveDrawingBuffer:true});
let program,texture,locations={},pixels=null,raf=0,last=0,building=false,buildVersion=0;
const W=1024,H=768;
const vertex=`attribute vec2 a;varying vec2 v;void main(){v=a*.5+.5;gl_Position=vec4(a,0.,1.);}`;
const fragment=`precision highp float;
varying vec2 v;uniform sampler2D field;uniform vec2 resolution;uniform vec3 ink,ember;uniform float time;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
void main(){
float scale=min(resolution.x/1024.,resolution.y/768.)*.90;
vec2 uv=(gl_FragCoord.xy-vec2(resolution.x*.5,resolution.y*.55))/scale/vec2(1024.,768.)+.5;
uv.y=1.-uv.y;
if(uv.x<0.||uv.y<0.||uv.x>1.||uv.y>1.){gl_FragColor=vec4(0.);return;}
vec4 data=texture2D(field,uv);float mask=data.a; if(mask<.003){gl_FragColor=vec4(0.);return;}
float arrival=(data.r*255.*256.+data.g*255.)/65535.*5.;
float age=time-arrival;
float intact=1.-smoothstep(-.024,.026,age);
// Halve the dark charring transition band (0.445s -> 0.2225s).
float charred=smoothstep(-.2575,-.035,age);
float shade=.91+.09*smoothstep(0.,.7,data.b);
float noise=hash(floor(uv*vec2(1024.,768.)));
// Reduce the previous 85% charring darkening by half: 42.5%.
vec3 material=ink*shade*mix(1.,.575,charred);
material*=mix(vec3(1.),vec3(1.05,.76,.55),charred);
float edge=exp(-pow((age+.022)/.052,2.));
float tail=step(0.,age)*exp(-max(0.,age)/.105);
float flicker=.66+.34*sin(time*33.+noise*70.);
float sparkle=smoothstep(.72,.96,noise);
float heat=(edge+tail*.43)*sparkle*flicker;
// Increase core emission another 40% relative to the previous revision.
vec3 hot=mix(ember,vec3(1.,.92,.64),heat*.27)*heat*3.234;
float alpha=mask*max(intact,clamp(heat*1.8,0.,1.));
vec3 rgb=material*intact+hot;
gl_FragColor=vec4(rgb/max(max(intact,heat),.1),alpha);
}`;
function notify(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(notify.timer);notify.timer=setTimeout(()=>$('toast').classList.remove('show'),2500);}
function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
function initGL(){if(!gl)throw Error('当前浏览器无法使用图形加速。请开启硬件加速或换用 Chrome / Edge。');program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vertex));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);const buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);const a=gl.getAttribLocation(program,'a');gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);for(const key of ['field','resolution','ink','ember','time'])locations[key]=gl.getUniformLocation(program,key);texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.uniform1i(locations.field,0);}
function hash(x,y){let k=Math.imul(x,374761393)^Math.imul(y,668265263);k=Math.imul(k^(k>>>13),1274126177);return ((k^(k>>>16))>>>0)/4294967295;}
function noise(x,y){const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;const sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy);return (hash(ix,iy)*(1-sx)+hash(ix+1,iy)*sx)*(1-sy)+(hash(ix,iy+1)*(1-sx)+hash(ix+1,iy+1)*sx)*sy;}
const profiles={S:[1,.999,.991,.891,.739,.583,.243,.039,0],H:[1,.999,.925,.872,.601,.287,0,0,0],Y:[1,.997,.954,.734,.295,.028,0,0,0],C:[1,1,.902,.72,.484,.335,.151,0,0],small:[1,.75,.025,0,0,0,0,0,0]};
function arrival(rank,profile){const target=1-rank;for(let j=1;j<profile.length;j++)if(profile[j]<=target){const d=profile[j-1]-profile[j];return .30+(j-1+(d?(profile[j-1]-target)/d:0))*.54;}return 4.62;}
function drawLine(ctx,text,family,size,y,spacing,isSub,groups){
const chars=Array.from(text);if(!chars.length)return;
ctx.font=`${family==='Anton'||family==='Bebas'?'400':'700'} ${size}px ${family}`;
let widths=chars.map(c=>ctx.measureText(c).width),total=widths.reduce((a,b)=>a+b,0)+spacing*(chars.length-1);
if(total>860){size*=860/total;spacing*=860/total;ctx.font=`${family==='Anton'||family==='Bebas'?'400':'700'} ${size}px ${family}`;widths=chars.map(c=>ctx.measureText(c).width);total=widths.reduce((a,b)=>a+b,0)+spacing*(chars.length-1);}
let x=(W-total)/2;chars.forEach((ch,index)=>{const id=groups.length+1;groups.push({id,profile:isSub?(index===0?profiles.C:profiles.small):chars.length===1?profiles.H:index/(chars.length-1)<.34?profiles.S:index/(chars.length-1)>.66?profiles.Y:profiles.H});ctx.fillStyle=`rgb(${id},${id},${id})`;ctx.fillText(ch,x,y);x+=widths[index]+spacing;});
}
async function rebuild(){const version=++buildVersion;building=true;pause();const family=fonts.find(f=>f[0]===state.font)?.[1]||'Arial';try{await document.fonts.load(`210px ${family.split(',')[0]}`);}catch{}if(version!==buildVersion)return;
const off=document.createElement('canvas');off.width=W;off.height=H;const ctx=off.getContext('2d',{willReadFrequently:true});ctx.textBaseline='alphabetic';const groups=[];
drawLine(ctx,state.main,family,235*state.size,448,23*state.size,false,groups);drawLine(ctx,state.sub,family,38*state.size,510,36*state.size,true,groups);
const raw=ctx.getImageData(0,0,W,H).data,n=W*H,dist=new Float32Array(n),ids=new Uint8Array(n);const lists=groups.map(()=>[]);
for(let i=0;i<n;i++){dist[i]=raw[i*4+3]>127?999:0;ids[i]=raw[i*4];}
for(let y=1;y<H;y++)for(let x=1;x<W-1;x++){let i=y*W+x;dist[i]=Math.min(dist[i],dist[i-1]+1,dist[i-W]+1,dist[i-W-1]+1.414,dist[i-W+1]+1.414);}
for(let y=H-2;y>=0;y--)for(let x=W-2;x>0;x--){let i=y*W+x;dist[i]=Math.min(dist[i],dist[i+1]+1,dist[i+W]+1,dist[i+W+1]+1.414,dist[i+W-1]+1.414);}
pixels=new Uint8Array(n*4);
for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=y*W+x;if(!raw[i*4+3])continue;let id=ids[i];if(id<1||id>groups.length){id=ids[Math.min(n-1,i+1)]||ids[Math.max(0,i-1)]||1;}const v=noise(x/58+7,y/58+11)*.56+noise(x/16+3,y/16)*.29+noise(x/5,y/5)*.15+Math.min(dist[i]/35,.7)*.14;
lists[id-1].push([i,v]);pixels[i*4+2]=Math.min(255,dist[i]/30*255);pixels[i*4+3]=raw[i*4+3];}
lists.forEach((list,k)=>{list.sort((a,b)=>a[1]-b[1]);list.forEach(([i],j)=>{const value=Math.min(65535,Math.round(arrival((j+.5)/list.length,groups[k].profile)/5*65535));pixels[i*4]=value>>>8;pixels[i*4+1]=value&255;});});
gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,W,H,0,gl.RGBA,gl.UNSIGNED_BYTE,pixels);state.t=0;building=false;render();}
function rgb(hex){return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);}
function render(){if(!pixels||!gl||gl.isContextLost())return;const dpr=Math.min(devicePixelRatio||1,2),w=state.exportSize?.[0]||Math.round(innerWidth*dpr),h=state.exportSize?.[1]||Math.round(innerHeight*dpr);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}gl.viewport(0,0,w,h);gl.uniform2f(locations.resolution,w,h);gl.uniform3fv(locations.ink,rgb(state.ink));gl.uniform3fv(locations.ember,rgb(state.ember));gl.uniform1f(locations.time,state.t);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.drawArrays(gl.TRIANGLES,0,6);$('time').textContent=`${state.t.toFixed(1)} / 5.0 s`;$('timeline').value=state.t;}
function updatePlay(){const paused=!state.playing;$('centerPlay').hidden=!paused;$('play').setAttribute('aria-label',paused?'播放':'暂停');$('play').title=paused?'播放':'暂停';$('play').innerHTML=paused?'<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="currentColor" stroke="none"/></svg>':'<svg viewBox="0 0 24 24"><path d="M8 6v12M16 6v12" stroke-width="3"/></svg>';}
function pause(){state.playing=false;cancelAnimationFrame(raf);updatePlay();}
function tick(now){if(!state.playing)return;state.t=(state.t+(now-last)/1000)%5;last=now;render();raf=requestAnimationFrame(tick);}
function play(){if(window.studioSleeping)return;if(building||state.playing)return;if(state.t>=4.99)state.t=0;state.playing=true;last=performance.now();closePanels();updatePlay();raf=requestAnimationFrame(tick);}
function closePanels(){const settings=document.querySelector('.unified-settings');if(settings)settings.open=false;else document.querySelectorAll('.panel').forEach(p=>p.hidden=true);document.querySelectorAll('[data-panel]').forEach(b=>{b.classList.remove('selected');b.setAttribute('aria-expanded','false');});}
function setColors(){for(const key of ['ink','ember','bg']){$(key).value=state[key];$(key+'Value').textContent=state[key].toUpperCase();}document.documentElement.style.setProperty('--bg',state.bg);document.body.classList.toggle('light',rgb(state.bg).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0)>.5);render();}
function fontButtons(){const grid=$('fontGrid');grid.replaceChildren();const select=document.createElement('select');select.id='burnFont';select.setAttribute('aria-label','字体');for(const [key,family,name] of fonts){const option=new Option(name,key);option.selected=key===state.font;select.add(option);}select.onchange=()=>{state.font=select.value;rebuild();};grid.append(select);}
document.querySelectorAll('[data-panel]').forEach(b=>{b.setAttribute('aria-expanded','false');b.onclick=()=>{const panel=$(b.dataset.panel),open=panel.hidden;closePanels();panel.hidden=!open;b.classList.toggle('selected',open);b.setAttribute('aria-expanded',String(open));};});document.querySelectorAll('.close').forEach(b=>b.onclick=closePanels);
document.addEventListener('pointerdown',e=>{if(!e.target.closest('.workspace,.unified-panel'))closePanels();});document.addEventListener('keydown',e=>{if(e.key==='Escape')closePanels();if(e.code==='Space'&&!e.target.matches('input,textarea,button')){e.preventDefault();state.playing?pause():play();}});
let debounce;for(const [id,key] of [['mainText','main'],['subText','sub']])$(id).addEventListener('input',()=>{state[key]=$(id).value;clearTimeout(debounce);debounce=setTimeout(rebuild,160);});$('size').oninput=()=>{state.size=+$('size').value/100;$('sizeLabel').value=$('size').value+'%';clearTimeout(debounce);debounce=setTimeout(rebuild,90);};
for(const key of ['ink','ember','bg'])$(key).oninput=()=>{state[key]=$(key).value;setColors();document.querySelectorAll('.swatch').forEach(b=>b.classList.remove('active'));};
const presets={classic:['#ffb64b','#fff0a8','#173bce'],paper:['#8de2dd','#fff0b5','#d72638'],rose:['#d9f45a','#ffe8a1','#6332a4'],blue:['#f6d745','#ff8040','#101010']};document.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>{[state.ink,state.ember,state.bg]=presets[b.dataset.preset];document.querySelectorAll('.swatch').forEach(s=>s.classList.toggle('active',s===b));clearBg();setColors();});
$('play').onclick=()=>state.playing?pause():play();$('centerPlay').onclick=play;$('restart').onclick=()=>{pause();state.t=0;render();play();};$('timeline').oninput=()=>{pause();state.t=+$('timeline').value;render();};
$('fontFile').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{const name='Custom'+Date.now(),face=new FontFace(name,await file.arrayBuffer());await face.load();document.fonts.add(face);fonts.push([name,name,file.name.replace(/\.[^.]+$/,'')]);state.font=name;fontButtons();await rebuild();notify('字体已导入');}catch{notify('无法读取这个字体文件');}e.target.value='';};
function clearBg(){state.image=null;if(state.imageUrl)URL.revokeObjectURL(state.imageUrl);state.imageUrl=null;$('background').style.backgroundImage='none';$('removeBg').hidden=true;}
$('bgFile').onchange=e=>{const file=e.target.files[0];if(!file)return;if(!file.type.startsWith('image/')){notify('请选择图片文件');return;}const url=URL.createObjectURL(file),img=new Image();img.onload=()=>{clearBg();state.image=img;state.imageUrl=url;$('background').style.backgroundImage=`url("${url}")`;$('removeBg').hidden=false;notify('背景已更新');};img.onerror=()=>{URL.revokeObjectURL(url);notify('图片无法读取');};img.src=url;e.target.value='';};$('removeBg').onclick=clearBg;
$('snapshot').onclick=()=>{render();const out=document.createElement('canvas');out.width=canvas.width;out.height=canvas.height;const c=out.getContext('2d');c.fillStyle=state.bg;c.fillRect(0,0,out.width,out.height);if(state.image){const img=state.image,s=Math.max(out.width/img.width,out.height/img.height);c.drawImage(img,(out.width-img.width*s)/2,(out.height-img.height*s)/2,img.width*s,img.height*s);}c.drawImage(canvas,0,0);out.toBlob(blob=>{if(!blob)return;const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='焚字-'+state.t.toFixed(1)+'s.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('当前画面已保存');});};
window.addEventListener('resize',render);document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();pause();notify('图形连接已暂停，正在恢复');});canvas.addEventListener('webglcontextrestored',()=>{initGL();rebuild();});
try{initGL();fontButtons();setColors();rebuild().then(()=>play()).catch(err=>{console.error(err);$('error').hidden=false;$('error').textContent='动画初始化失败，请刷新重试。';});}catch(err){$('error').hidden=false;$('error').textContent=err.message;$('centerPlay').hidden=true;}
window.burnStudio={state,render,rebuild,play,pause};

