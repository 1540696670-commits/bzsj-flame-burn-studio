const mobilePreview=matchMedia('(pointer:coarse)').matches||innerWidth<=720;let simWidth=mobilePreview?192:512,simHeight=mobilePreview?108:288,simRate=mobilePreview?30:60;let lastPreviewDraw=0;
const $=id=>document.getElementById(id),canvas=$('view');
const gl=canvas.getContext('webgl',{alpha:false,antialias:false,preserveDrawingBuffer:true});
if(!gl){$('error').hidden=false;$('error').textContent='请在支持 WebGL 的浏览器中打开。';throw Error('WebGL unavailable')}
const vertex=`attribute vec2 a;varying vec2 uv;void main(){uv=a*.5+.5;gl_Position=vec4(a,0.,1.);}`;
const fragment=`precision highp float;
varying vec2 uv;
uniform sampler2D mask,heatField;
uniform float time,burn,aspect,flameHeight,glow,count,debugDepth,coreGain;
uniform vec3 fireColor,inkColor,backgroundColor;
uniform vec4 boxes[32];uniform vec2 volumeSize;uniform float raySamples;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),f.x),f.y);}
float fbm(vec2 p){float n=0.,amp=.5;for(int i=0;i<4;i++){n+=amp*noise(p);p=p*2.02+vec2(11.7,7.8);amp*=.5;}return n;}
vec4 sampleMask(vec2 p){if(p.x<0.||p.x>1.||p.y<0.||p.y>1.)return vec4(0.);return texture2D(mask,p);}
float glyphStart(float i){return i<.5?0.:.3+(i-1.)*.5;}
float age(vec4 s){return (time-.20)/burn-glyphStart(floor(s.r*32.));}

float hash3(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
float noise3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash3(i),hash3(i+vec3(1,0,0)),f.x),mix(hash3(i+vec3(0,1,0)),hash3(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash3(i+vec3(0,0,1)),hash3(i+vec3(1,0,1)),f.x),mix(hash3(i+vec3(0,1,1)),hash3(i+vec3(1,1,1)),f.x),f.y),f.z);}
vec2 atlasUV(vec2 p,float z){vec2 tile=vec2(mod(z,4.),floor(z/4.));return (tile+clamp(p,vec2(.5/volumeSize.x,.5/volumeSize.y),vec2(1.-.5/volumeSize.x,1.-.5/volumeSize.y)))/4.;}
vec4 volume(vec3 p){if(any(lessThan(p,vec3(0.)))||any(greaterThan(p,vec3(1.))))return vec4(0.);float z=p.z*15.;return mix(texture2D(heatField,atlasUV(p.xy,floor(z))),texture2D(heatField,atlasUV(p.xy,min(15.,floor(z)+1.))),fract(z));}
void main(){vec2 p=uv;if(debugDepth>=0.){vec4 v=volume(vec3(p,debugDepth));gl_FragColor=vec4(v.r,v.g,0.,1.);return;}vec4 tex=sampleMask(p);float a=age(tex);float field=tex.g;float breakup=(fbm(p*vec2(78.,44.))-.5)*.045;float release=field+breakup;
float complete=smoothstep(release+.035,release+.065,a);
// Fragment lead is measured in seconds, independently of animation duration.
float lead=.3/burn;
float prepare=smoothstep(release-lead,release-lead+.035,a);
float approach=clamp((a-release+lead)/lead,0.,1.);
float coarse=noise(p*vec2(85.,48.));
float fine=noise(p*vec2(230.,130.)+vec2(8.,17.));
float island=step(.65-approach*.32,coarse)*step(.27,fine);
float layer=mix(.32,.95,smoothstep(.25,.75,fine))*mix(.6,1.,approach);
float fragment=prepare*island*layer;
float charAlpha=tex.a*mix(fragment,1.,complete);
// Signed progress distance: heat lives on the revealed side of the moving fire front.
float behind=a-release;
float surfaceHeat=exp(-pow((behind-.035)/.093333,2.))*smoothstep(-.025,.018,behind)*(1.-smoothstep(.78,1.15,a));
vec3 surfaceHue=fireColor/max(max(fireColor.r,fireColor.g),fireColor.b);
float surfaceBlueMode=step(surfaceHue.r+.15,surfaceHue.b)*step(surfaceHue.g+.15,surfaceHue.b);
vec3 heatedBlue=mix(surfaceHue,vec3(.243137,.352941,.741176),surfaceBlueMode);
vec3 hotterBlue=mix(mix(surfaceHue,vec3(1.),.13),vec3(.227451,.349020,.933333),surfaceBlueMode);
vec3 heatedInk=mix(inkColor,heatedBlue,surfaceHeat*.90);
heatedInk=mix(heatedInk,hotterBlue,pow(surfaceHeat,3.)*.75);
vec3 col=heatedInk*charAlpha;
vec3 flame=vec3(0.);float smoke=0.;
for(int k=0;k<32;k++){if(float(k)<count){vec4 b=boxes[k];float ga=(time-.20)/burn-glyphStart(float(k));float gw=b.y-b.x,gh=b.w-b.z;float active=smoothstep(-.03,.13,ga)*(1.-smoothstep(1.03,1.19,ga));
// Smoke starts at 70%; its predecessor dissipates by the next glyph's completion.
float onset=.20+(glyphStart(float(k))+.70)*burn;
float endTime=float(k)+1.<count?.20+(glyphStart(float(k)+1.)+1.)*burn:.20+(glyphStart(float(k))+1.)*burn+.95;
float envelope=smoothstep(onset,onset+.22,time)*(1.-smoothstep(endTime-.25,endTime,time));
for(int packet=0;packet<6;packet++){
 float emitted=onset+float(packet)*min(.12,(endTime-onset)*.12);
 float elapsed=time-emitted;
 if(elapsed>0.&&time<endTime){
  float seed=hash(vec2(float(k)*13.,float(packet)*7.));
  vec2 center=vec2(mix(b.x,b.y,.12+seed*.3)-gh*.12/aspect-elapsed*gh*.14/aspect,b.w+elapsed*gh*.45);
  vec2 d=p-center;float radius=gh*(.045+elapsed*.055);
  float shape=exp(-dot(d/vec2(radius*1.10,radius*1.55),d/vec2(radius*1.10,radius*1.55))*2.);
  float grain=fbm((p-center)*vec2(105.,75.)+vec2(seed*30.,elapsed*1.5));
  smoke+=shape*grain*envelope*smoothstep(0.,.20,elapsed)*exp(-elapsed*.42)*.18;
 }
}}}
// Ray integration through independently advected 3D temperature/fuel voxels.
vec3 hue=fireColor/max(max(fireColor.r,fireColor.g),fireColor.b);
float blueMode=step(hue.r+.15,hue.b)*step(hue.g+.15,hue.b);
vec3 outer=mix(pow(hue,vec3(2.2)),vec3(.215686,.349020,.874510),blueMode);
vec3 edge=mix(pow(hue,vec3(2.2)),vec3(.039216,.243137,.831373),blueMode);
vec3 whiteCore=mix(vec3(1.),vec3(.960784,.984314,.988235),blueMode);
vec3 cyan=mix(mix(hue,vec3(1.),.43),vec3(.635294,.933333,.976471),blueMode);
vec3 radiance=vec3(0.);float transmittance=1.;float coverage=0.;
for(int slice=0;slice<32;slice++){
 if(float(slice)>=raySamples)break;float z=(float(slice)+.5)/raySamples;
 // Fixed camera: the opaque glyph face occludes rear-volume emission.
 if(float(slice)==floor(raySamples*.5))transmittance*=1.-charAlpha;
 vec3 q=vec3(p+vec2((z-.5)*.017,(z-.5)*.004),z);
 vec3 turbulence=vec3(q.xy*vec2(55.,34.),z*5.)-vec3(0.,time*1.7,0.);
 vec3 warp=vec3(noise3(turbulence),noise3(turbulence+17.),noise3(turbulence+31.))-.5;
 q+=warp*vec3(.0015,.001,.025);
 vec4 hot=volume(q);
 float fold=.7*noise3(turbulence*1.8+warp*2.)+.3*noise3(turbulence*3.7+warp*3.);
 float density=max(0.,hot.g-.015)*mix(.92,1.05,fold);
 float temperature=hot.r*pow(max(hot.g,.001),.18);
 float owner=floor(hot.b/max(hot.g,.001)*32.);vec4 box=vec4(0.);for(int k=0;k<32;k++){if(abs(float(k)-owner)<.1)box=boxes[k];}
 float altitude=(q.y-box.z)/max(.01,box.w-box.z);
 // Front-view left/right balance per owning glyph: right emission -40%.
 float sideX=(q.x-box.x)/max(.01,box.y-box.x);
 float rightSide=smoothstep(.48,.54,sideX);
 float sideEmission=1.-.61*rightSide;
 // Local fire ridges and thin films coexist at the same height.
 float phase=(time-.20)/burn-glyphStart(owner);
 float growth=smoothstep(-.02,.35,phase);
 float retreat=1.-smoothstep(.72,1.12,phase);
 float thin=clamp(hot.g*2.,0.,1.);
 vec3 gradient=mix(edge,outer,smoothstep(.025,.12,hot.g));
 gradient=mix(gradient,cyan,smoothstep(.12,.48,hot.g)*smoothstep(.25,.65,temperature));
 // Local core clusters follow the moving burn front, rather than a fixed top stripe.
 float gx=(q.x-box.x)/max(.01,box.y-box.x);
 float drift=noise(vec2(owner*7.3,time*.85))-.5;
 float h0=phase+.13+drift*.10;
 float x0=.36+(noise(vec2(owner*11.,time*.62))-.5)*.32;
 float mainCore=exp(-pow((altitude-h0)/.19,2.)-pow((gx-x0)/.30,2.));
 float sideCore=exp(-pow((altitude-h0+.15)/.12,2.)-pow((gx-.78-drift*.14)/.18,2.));
 float tipCore=exp(-pow((altitude-h0-.19)/.14,2.)-pow((gx-.23+drift*.12)/.12,2.));
 float localFold=smoothstep(.23,.72,fold);
 float coreLayout=clamp((mainCore+sideCore*.58+tipCore*.28)*mix(.40,1.15,localFold),0.,1.);
 gradient=mix(gradient,whiteCore,clamp(smoothstep(.45,.80,hot.g)*smoothstep(.50,.84,temperature)*retreat*coreGain*coreLayout,0.,1.));
 float stageBrightness=mix(.70,1.10,growth)*mix(.30,1.,retreat);
 vec3 emission=gradient*pow(temperature,1.25)*4.8*stageBrightness*sideEmission;
 float opacity=1.-exp(-density*mix(.12,.32,smoothstep(.05,.55,hot.g))*32./raySamples);
 radiance+=transmittance*emission*opacity;
 transmittance*=1.-opacity;coverage+=density/raySamples;;
}
float peak=max(max(radiance.r,radiance.g),radiance.b);
float brightness=1.-exp(-peak*3.4*(.85+glow*.35));
float contrastBrightness=brightness*brightness/max(.00001,brightness*brightness+(1.-brightness)*(1.-brightness));
vec3 flameHue=radiance/max(peak,.0001);
float luminance=dot(flameHue,vec3(.2126,.7152,.0722));
flameHue=clamp(vec3(luminance)+(flameHue-vec3(luminance))*2.,0.,1.);
flame=flameHue*contrastBrightness;
flame+=outer*coverage*.12*glow;
// Soft neighboring emission, not a hard outline.
float halo=0.;vec2 haloPx=vec2(1./volumeSize.x,1./volumeSize.y);
for(int ring=0;ring<2;ring++){float r=3.+float(ring)*3.;for(int k=0;k<4;k++){vec2 direction=k==0?vec2(1.,0.):k==1?vec2(-1.,0.):k==2?vec2(0.,1.):vec2(0.,-1.);vec4 nearby=volume(vec3(p+direction*haloPx*r,.5));halo+=nearby.g*nearby.r*(ring==0?.025:.012);}}
flame+=edge*halo*glow;
col*=mix(.72,1.,transmittance);
col+=backgroundColor*(1.-charAlpha)*transmittance+flame+vec3(.7,.75,.82)*smoke;
gl_FragColor=vec4(clamp(col,0.,1.),1.);}
`;
function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s}
const program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vertex));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);
const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);const attr=gl.getAttribLocation(program,'a');gl.enableVertexAttribArray(attr);gl.vertexAttribPointer(attr,2,gl.FLOAT,false,0,0);const U={};for(const n of ['time','burn','aspect','flameHeight','glow','fireColor','inkColor','backgroundColor','volumeSize','raySamples','count','boxes[0]'])U[n]=gl.getUniformLocation(program,n);
gl.uniform1f(gl.getUniformLocation(program,'coreGain'),24.45);gl.uniform1f(gl.getUniformLocation(program,'debugDepth'),-1.);gl.uniform1i(gl.getUniformLocation(program,'mask'),0);gl.activeTexture(gl.TEXTURE0);const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);

const sparkProgram=gl.createProgram();
gl.attachShader(sparkProgram,shader(gl.VERTEX_SHADER,'attribute vec4 particle;uniform float pixelScale;varying float strength;void main(){gl_Position=vec4(particle.xy*2.-1.,0.,1.);gl_PointSize=max(1.2,particle.z*pixelScale);strength=particle.w;}'));
gl.attachShader(sparkProgram,shader(gl.FRAGMENT_SHADER,'precision mediump float;uniform vec3 tint;uniform vec2 viewport;uniform vec4 glyphBoxes[32];uniform float glyphCount,clock,burn;varying float strength;void main(){vec2 p=gl_FragCoord.xy/viewport;for(int i=0;i<32;i++){if(float(i)<glyphCount&&(clock-.20)/burn-(float(i)<.5?0.:.3+(float(i)-1.)*.5)>-.15){vec4 b=glyphBoxes[i];vec2 pad=vec2(2.)/viewport;if(p.x>=b.x-pad.x&&p.x<=b.y+pad.x&&p.y>=b.z-pad.y&&p.y<=b.w+pad.y)discard;}}float d=length(gl_PointCoord-.5)*2.;float halo=exp(-d*d*3.2)*(1.-smoothstep(.7,1.,d));float core=1.-smoothstep(.08,.35,d);vec3 vivid=pow(tint/max(max(tint.r,tint.g),tint.b),vec3(1.7));vec3 c=vivid*halo*1.4+mix(vivid,vec3(1.),.55)*core*.32;gl_FragColor=vec4(c*strength,halo*strength);}'));
gl.linkProgram(sparkProgram);const sparkBuffer=gl.createBuffer(),sparkAttr=gl.getAttribLocation(sparkProgram,'particle');let sparkSeeds=[],flameSeeds=[];
function glyphOffset(i){return i===0?0:.3+(i-1)*.5}
function cpuHash(x,y){const n=Math.sin(x*127.1+y*311.7)*43758.5453;return n-Math.floor(n)}
function cpuNoise(x,y){const ix=Math.floor(x),iy=Math.floor(y);let fx=x-ix,fy=y-iy;fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy);return (cpuHash(ix,iy)*(1-fx)+cpuHash(ix+1,iy)*fx)*(1-fy)+(cpuHash(ix,iy+1)*(1-fx)+cpuHash(ix+1,iy+1)*fx)*fy}
function cpuFbm(x,y){let n=0,a=.5;for(let j=0;j<4;j++){n+=a*cpuNoise(x,y);x=x*2.02+11.7;y=y*2.02+7.8;a*=.5}return n}
function drawSparks(seconds,w,h){const points=[];for(const s of sparkSeeds){
const birth= .20+(glyphOffset(s.g)+s.release)*burnTime+s.delay;
const age=seconds-birth;if(age<0||age>s.life)continue;const f=age/s.life;
// Independent eddies combine with a slow shared gust; no frame-dependent random jumps.
const wander=Math.sin(age*s.frequency+s.phase)-Math.sin(s.phase);
const curl=Math.sin(age*s.frequency*.61+s.phase*1.7)-Math.sin(s.phase*1.7);
const gust=(Math.cos(birth*1.7+s.y*7)-Math.cos(seconds*1.7+s.y*7))*.0025;
const g=glyphs[s.g],gh=g.y1-g.y0;
const x=g.x1+gh*(.025+s.seed*.035)/(16/9)+s.vx*age+s.ax*age*age+s.sway*wander*(.25+.75*f)+gust;
const y=s.y+gh*(.15+s.seed*.30)+s.vy*age-.004*age*age+s.sway*.30*curl;
const twinkle=.72+.18*Math.sin(age*s.twinkle+s.phase)+.10*Math.sin(age*s.twinkle*2.31+s.phase*2.9);
const fade=Math.pow(1-f,.85)*Math.min(1,age/.045);
const intensity=s.brightness*fade*twinkle;
points.push(x,y,s.size*(1-.25*f),intensity)}
gl.useProgram(sparkProgram);gl.bindBuffer(gl.ARRAY_BUFFER,sparkBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(points),gl.DYNAMIC_DRAW);gl.enableVertexAttribArray(sparkAttr);gl.vertexAttribPointer(sparkAttr,4,gl.FLOAT,false,0,0);gl.uniform2f(gl.getUniformLocation(sparkProgram,'viewport'),w,h);gl.uniform1f(gl.getUniformLocation(sparkProgram,'clock'),seconds);gl.uniform1f(gl.getUniformLocation(sparkProgram,'burn'),burnTime);gl.uniform1f(gl.getUniformLocation(sparkProgram,'glyphCount'),glyphs.length);const sparkBoxes=new Float32Array(128);glyphs.forEach((g,i)=>sparkBoxes.set([g.x0,g.x1,g.y0,g.y1],i*4));gl.uniform4fv(gl.getUniformLocation(sparkProgram,'glyphBoxes[0]'),sparkBoxes);gl.uniform1f(gl.getUniformLocation(sparkProgram,'pixelScale'),w/1280);gl.uniform3fv(gl.getUniformLocation(sparkProgram,'tint'),rgb($('color').value));gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE);gl.drawArrays(gl.POINTS,0,points.length/4);gl.disable(gl.BLEND);gl.disableVertexAttribArray(sparkAttr);gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.enableVertexAttribArray(attr);gl.vertexAttribPointer(attr,2,gl.FLOAT,false,0,0);}



// Heat advection and cooling on two ping-pong render targets. No flipbook is sampled.
const simVertex=vertex;
const simFragment=`precision highp float;varying vec2 uv;uniform sampler2D previous,burnMask;uniform float clock,dt,burnLength,heightScale;uniform vec2 volumeSize;uniform vec4 glyphBounds[32];uniform float linkStrength[32];
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
float fbm(vec2 p){float v=0.,amp=.5;for(int i=0;i<4;i++){v+=amp*noise(p);p=p*2.02+vec2(11.7,7.8);amp*=.5;}return v;}
float glyphStart(float i){return i<.5?0.:.3+(i-1.)*.5;}
float stream(vec2 p){return noise(p*vec2(22.,13.)+vec2(0.,-clock*.8))+.25*noise(p*vec2(57.,31.)+vec2(clock*.3,-clock*1.5))+.085*noise(p*vec2(160.,90.)+vec2(clock*.6,-clock*3.7));}

float hash3(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
float noise3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash3(i),hash3(i+vec3(1,0,0)),f.x),mix(hash3(i+vec3(0,1,0)),hash3(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash3(i+vec3(0,0,1)),hash3(i+vec3(1,0,1)),f.x),mix(hash3(i+vec3(0,1,1)),hash3(i+vec3(1,1,1)),f.x),f.y),f.z);}
vec2 atlasUV(vec2 p,float z){vec2 tile=vec2(mod(z,4.),floor(z/4.));return (tile+clamp(p,vec2(.5/volumeSize.x,.5/volumeSize.y),vec2(1.-.5/volumeSize.x,1.-.5/volumeSize.y)))/4.;}
vec4 sampleVolume(vec3 p){if(any(lessThan(p,vec3(0.)))||any(greaterThan(p,vec3(1.))))return vec4(0.);float z=p.z*15.;return mix(texture2D(previous,atlasUV(p.xy,floor(z))),texture2D(previous,atlasUV(p.xy,min(15.,floor(z)+1.))),fract(z));}
void main(){vec2 tile=floor(uv*4.);float z=(tile.x+tile.y*4.)/15.;vec2 p=fract(uv*4.),cell=vec2(1./volumeSize.x,1./volumeSize.y);vec3 point=vec3(p,z);vec4 old=sampleVolume(point);
// Procedural three-dimensional eddies; no pressure projection is performed.
float e=.008;
vec3 c=point*vec3(28.,19.,3.)-vec3(0.,clock*2.,0.);
float dY=(noise3(c+vec3(0,e,0))-noise3(c-vec3(0,e,0)))/(2.*e);
float dX=(noise3(c+vec3(e,0,0))-noise3(c-vec3(e,0,0)))/(2.*e);
float dZ=(noise3(c+vec3(0,0,e))-noise3(c-vec3(0,0,e)))/(2.*e);
vec3 micro=point*vec3(95.,64.,7.)-vec3(0.,clock*5.,0.);
float curlX=(noise3(micro+vec3(0,e,0))-noise3(micro-vec3(0,e,0)))/(2.*e);
float curlY=(noise3(micro+vec3(e,0,0))-noise3(micro-vec3(e,0,0)))/(2.*e);
vec3 velocity=vec3(.018+dY*.11-dZ*.035+curlX*.07,.40+old.r*.26-dX*.09-curlY*.065,dX*.26-dY*.20);
// Moving eddies are decorrelated across position/depth; no global sine sway.
float oldId=floor(old.b/max(old.g,.001)*32.);vec4 ownBox=vec4(0.);for(int k=0;k<32;k++){if(abs(float(k)-oldId)<.1)ownBox=glyphBounds[k];}
float localAge=(clock-.20)/burnLength-glyphStart(oldId);
float ownSlope=tan(.20944)*(ownBox.y-ownBox.x)*(16./9.)/max(.01,ownBox.w-ownBox.z);
float rootY=ownBox.z+clamp(localAge,0.,1.)*(ownBox.w-ownBox.z)*(1.+ownSlope)-ownSlope*(p.x-ownBox.x)/(max(.001,ownBox.y-ownBox.x))*(ownBox.w-ownBox.z);
float lift=max(0.,p.y-rootY)/max(.01,ownBox.w-ownBox.z);
float loose=smoothstep(.025,.32,lift)*smoothstep(.015,.07,old.g);
float wandering=noise3(vec3(p.x*35.+oldId*13.,z*6.,clock*3.8))-.5;
float gust=noise3(vec3(p.y*18.,z*9.+oldId*3.,clock*7.5))-.5;
velocity.x+=loose*(wandering*1.05+gust*.65+curlX*.16);
float burst=noise3(vec3(oldId*11.+p.y*9.,z*5.,clock*1.45));
velocity.x+=loose*(burst-.5)*(.36+.65*burst);
velocity.z+=loose*(gust*.62);
// Clockwise orbit seen from above: (dx,dz) -> (dz,-dx).
float orbitRx=max(.012,(ownBox.y-ownBox.x)*.55);
float orbitX=(p.x-(ownBox.x+ownBox.y)*.5)/orbitRx;
float orbitZ=(z-.5)/.27;
float orbitMask=smoothstep(.01,.08,old.g)*(1.-smoothstep(1.10,1.30,localAge));
float omega=2.4*(.85+.30*noise3(vec3(oldId,clock*.7,z)));
velocity.x+=orbitMask*omega*orbitRx*orbitZ;
velocity.z-=orbitMask*omega*.27*orbitX;
velocity.y+=orbitMask*omega*orbitRx*(16./9.)*.267949*orbitZ;
velocity.y*=heightScale;
vec3 back=point-velocity*dt;
vec4 adv=sampleVolume(back);
float grain=noise3(point*vec3(100.,62.,7.)-vec3(0.,clock*3.,0.));
float heat=max(0.,adv.r-dt*(.20+grain*.28));
float fuel=max(0.,adv.g-dt*(.40+grain*.70));float owner=adv.b/max(adv.g,.001);
vec4 m=texture2D(burnMask,p);
float age=(clock-.20)/burnLength-glyphStart(floor(m.r*32.));
float release=m.g+(fbm(p*vec2(78.,44.))-.5)*.045;
float boundary=1.-m.b;
float contourWeight=mix(.45,1.35,boundary);
float front=exp(-pow((age-release)/.045,2.))*m.a*contourWeight;
// A heated ribbon connects adjacent, independently timed fire fronts.
float bridge=0.,bridgeOwner=0.;
for(int k=0;k<31;k++){vec4 l=glyphBounds[k],r=glyphBounds[k+1];float al=(clock-.20)/burnLength-glyphStart(float(k));float ar=(clock-.20)/burnLength-glyphStart(float(k)+1.);
 if(r.y>r.x&&al>.05&&ar>-.025&&ar<1.06){
  float x0=mix(l.x,l.y,.72),x1=mix(r.x,r.y,.18);float u=clamp((p.x-x0)/max(.001,x1-x0),0.,1.);
  float y0=l.z+clamp(al,0.,1.)*(l.w-l.z),y1=r.z+clamp(ar,0.,1.)*(r.w-r.z);
  float bend=(noise3(vec3(u*3.,z*3.,clock*2.+float(k)*11.))-.5)*.14*(l.w-l.z)*sin(u*3.14159);
  float line=mix(y0,y1,u)+bend+sin(u*3.14159)*sin(clock*4.+float(k)*2.3)*(l.w-l.z)*.055;
  float contact=noise3(vec3(float(k)*17.,clock*1.5,float(k)*2.7));
  float selected=linkStrength[k];
  float intermittent=mix(smoothstep(.48,.70,contact)*.14,.8+.2*smoothstep(.48,.70,contact),selected);
  float taper=noise3(vec3(u*4.+float(k)*9.,clock*3.4,z*3.));
  float surge=noise3(vec3(float(k)*7.1,clock*1.15,float(k)+5.));
  float sizeMode=mix(.30,2.25,smoothstep(.28,.78,surge));
  float width=(l.w-l.z)*(.010+.032*contact)*mix(.40,1.,taper)*sizeMode*mix(.65,1.55,selected);
  float ribbon=exp(-pow((p.y-line)/width,2.))*smoothstep(x0-.005,x0+.008,p.x)*(1.-smoothstep(x1-.008,x1+.005,p.x));
  ribbon*=intermittent*mix(.35,1.,taper)*smoothstep(-.025,.1,ar)*(1.-smoothstep(.82,1.12,al));
  if(ribbon>bridge){bridge=ribbon;bridgeOwner=(float(k)+.5+step(.5,u))/32.;}
 }
}
// A pitched, irregular hot ribbon circulates around the extruded letter.
float sourceId=floor(m.r*32.);vec4 sourceBox=vec4(0.);
for(int k=0;k<32;k++){if(abs(float(k)-sourceId)<.1)sourceBox=glyphBounds[k];}
float sourceWidth=max(.01,sourceBox.y-sourceBox.x);
float sourceX=(p.x-(sourceBox.x+sourceBox.y)*.5)/(sourceWidth*.55);
float theta=atan((z-.5)/.27,sourceX);
float orbitPhase=theta+clock*2.4+sourceId*1.73;
float wrapPulse=.48+.52*pow(.5+.5*cos(orbitPhase),2.);
float pitchedRelease=release+.267949*(p.x-(sourceBox.x+sourceBox.y)*.5)*(16./9.)/max(.01,sourceBox.w-sourceBox.z);
front=exp(-pow((age-pitchedRelease)/.060,2.))*m.a*contourWeight*wrapPulse*1.55;
float depth=exp(-pow((z-.5)/.30,2.));float ignition=(.85+.15*grain)*depth;
float smallTongue=smoothstep(.61,.86,noise3(vec3(p.x*46.+floor(m.r*32.)*19.,p.y*32.,clock*3.4+z*3.)));
heat=max(heat,front*ignition*(1.+smallTongue*.35));float injected=front*depth*(.82+.18*noise3(point*vec3(18.,12.,3.)-vec3(0.,clock*1.3,0.)))*(1.+smallTongue*.8);if(injected>fuel){fuel=injected;owner=m.r;}heat=max(heat,bridge*depth*.85);if(bridge*depth*.58>fuel){fuel=bridge*depth*.58;owner=bridgeOwner;}if(fuel>.001){vec4 b=vec4(0.);float id=floor(owner*32.);for(int i=0;i<32;i++){if(abs(float(i)-id)<.1)b=glyphBounds[i];}float gh=b.w-b.z,gw=b.y-b.x;float above=max(0.,(p.y-b.w)/gh);fuel*=exp(-dt*32.*smoothstep(.18,.48,above))*(1.-smoothstep(.48,.60,above));float lateral=max(0.,max(b.x-p.x,p.x-b.y));float allowance=gw*.12+gh*.22*clamp(above,0.,.5)/(16./9.);fuel*=exp(-dt*8.*pow(lateral/max(.002,allowance),2.));}
if(p.y<.01||p.y>.995)heat=0.;
gl_FragColor=vec4(heat,fuel,owner*fuel,1.);}`;
const simProgram=gl.createProgram();gl.attachShader(simProgram,shader(gl.VERTEX_SHADER,simVertex));gl.attachShader(simProgram,shader(gl.FRAGMENT_SHADER,simFragment));gl.linkProgram(simProgram);if(!gl.getProgramParameter(simProgram,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(simProgram));
const simAttr=gl.getAttribLocation(simProgram,'a'),simUniform={};for(const n of ['previous','burnMask','clock','dt','burnLength','heightScale','volumeSize','glyphBounds[0]','linkStrength[0]'])simUniform[n]=gl.getUniformLocation(simProgram,n);
const heatHalf=gl.getExtension('OES_texture_half_float'),heatLinear=gl.getExtension('OES_texture_half_float_linear');gl.getExtension('EXT_color_buffer_half_float');const heatType=heatHalf&&heatLinear?heatHalf.HALF_FLOAT_OES:gl.UNSIGNED_BYTE;const simTargets=[0,1].map(()=>{let type=heatType;const tex=gl.createTexture();gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,tex);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,simWidth*4,simHeight*4,0,gl.RGBA,heatType,null);const fbo=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tex,0);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE){type=gl.UNSIGNED_BYTE;gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,simWidth*4,simHeight*4,0,gl.RGBA,gl.UNSIGNED_BYTE,null);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Heat framebuffer unavailable')};return {tex,fbo,type}});
gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.activeTexture(gl.TEXTURE0);gl.useProgram(program);gl.uniform1i(gl.getUniformLocation(program,'heatField'),2);
let simFrame=0,simRead=0;
function configureSimulation(high){const width=high?512:mobilePreview?192:512,height=high?288:mobilePreview?108:288;simRate=high?60:mobilePreview?30:60;if(width===simWidth&&height===simHeight)return;simWidth=width;simHeight=height;for(const target of simTargets){gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,target.tex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,simWidth*4,simHeight*4,0,gl.RGBA,target.type,null);}resetHeat();}
function resetHeat(){simFrame=0;simRead=0;for(const target of simTargets){gl.bindFramebuffer(gl.FRAMEBUFFER,target.fbo);gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT)}gl.bindFramebuffer(gl.FRAMEBUFFER,null)}
function advanceHeat(seconds){const targetFrame=Math.max(0,Math.round(seconds*simRate));if(targetFrame<simFrame)resetHeat();gl.useProgram(simProgram);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.enableVertexAttribArray(simAttr);gl.vertexAttribPointer(simAttr,2,gl.FLOAT,false,0,0);gl.viewport(0,0,simWidth*4,simHeight*4);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);gl.uniform2f(simUniform.volumeSize,simWidth,simHeight);gl.uniform1i(simUniform.burnMask,0);gl.uniform1i(simUniform.previous,2);gl.uniform1f(simUniform.dt,1/simRate);gl.uniform1f(simUniform.burnLength,burnTime);gl.uniform1f(simUniform.heightScale,+$('height').value);const heatBoxes=new Float32Array(128);glyphs.forEach((g,i)=>heatBoxes.set([g.x0,g.x1,g.y0,g.y1],i*4));gl.uniform4fv(simUniform['glyphBounds[0]'],heatBoxes);gl.uniform1fv(simUniform['linkStrength[0]'],linkStrength);
while(simFrame<targetFrame){gl.bindFramebuffer(gl.FRAMEBUFFER,simTargets[1-simRead].fbo);gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,simTargets[simRead].tex);gl.uniform1f(simUniform.clock,(simFrame+1)/simRate);gl.drawArrays(gl.TRIANGLES,0,6);simRead=1-simRead;simFrame++}
gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,simTargets[simRead].tex);gl.activeTexture(gl.TEXTURE0);gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.enableVertexAttribArray(attr);gl.vertexAttribPointer(attr,2,gl.FLOAT,false,0,0);}

const maskCanvas=document.createElement('canvas');maskCanvas.width=1280;maskCanvas.height=720;const ctx=maskCanvas.getContext('2d',{willReadFrequently:true});let exportSize=null,exporting=false;let duration=7,t=0,playing=true,last=0,glyphs=[],burnTime=2,fontReady=false;const linkStrength=new Float32Array(32);
function chooseConnections(){linkStrength.fill(0);for(let i=0;i<glyphs.length-1;i++)linkStrength[i]=1}
function glyphProgress(g,x,y){const xn=(x-g.x0)/(g.x1-g.x0),yn=(y-g.y0)/(g.y1-g.y0);const slope=Math.tan(12*Math.PI/180)*(g.x1-g.x0)*1280/((g.y1-g.y0)*720);return Math.max(0,Math.min(1,(yn+slope*xn)/(1+slope)))}
function rebuild(){const chars=Array.from($('text').value.trim()||'HOODA').slice(0,32);ctx.clearRect(0,0,1280,720);let size=330*+$('scale').value;const reference=$('font').value==='Reference';const family=reference?'Sancreek':$('font').value;const weight=['Sancreek','Rye','Smokum'].includes(family)?'normal':'900';ctx.font=weight+' '+size+'px '+family;const widths=chars.map(c=>reference?size*.39:ctx.measureText(c).width),gap=size*.04,total=widths.reduce((a,b)=>a+b,0)+gap*(chars.length-1);const fit=Math.min(1,940/total);size*=fit;ctx.font=weight+' '+size+'px '+family;ctx.textAlign='left';ctx.textBaseline='alphabetic';let x=(1280-total*fit)/2;const baseline=360+size*.5;glyphs=[];let order=0;for(let i=0;i<chars.length;i++){const c=chars[i],metrics=ctx.measureText(c),width=widths[i]*fit;if(c.trim()){let top,bottom,x0,x1;if(reference&&referenceGlyph.has(c)){top=baseline-size;bottom=baseline;x0=x;x1=x+width;referenceGlyph.draw(ctx,c,x,top,width,size)}else{top=baseline-metrics.actualBoundingBoxAscent;bottom=baseline+metrics.actualBoundingBoxDescent;const squeeze=Math.min(1,width/metrics.width);x0=x-metrics.actualBoundingBoxLeft*squeeze;x1=x+metrics.actualBoundingBoxRight*squeeze;ctx.fillStyle='white';ctx.fillText(c,x,baseline,width)}glyphs.push({index:order,x0:x0/1280,x1:x1/1280,y0:1-bottom/720,y1:1-top/720});order++}x+=width+gap*fit}
sparkSeeds=[];flameSeeds=[];const data=ctx.getImageData(0,0,1280,720);
// Inside distance to the actual glyph outline, including counters. Two chamfer passes.
const distances=new Float32Array(1280*720);for(let i=0;i<distances.length;i++)distances[i]=data.data[i*4+3]>127?9999:0;
for(let y=0;y<720;y++)for(let x=0;x<1280;x++){let i=y*1280+x;if(!distances[i])continue;if(x)distances[i]=Math.min(distances[i],distances[i-1]+1);if(y)distances[i]=Math.min(distances[i],distances[i-1280]+1);if(x&&y)distances[i]=Math.min(distances[i],distances[i-1281]+1.414214);if(y&&x<1279)distances[i]=Math.min(distances[i],distances[i-1279]+1.414214)}
for(let y=719;y>=0;y--)for(let x=1279;x>=0;x--){let i=y*1280+x;if(!distances[i])continue;if(x<1279)distances[i]=Math.min(distances[i],distances[i+1]+1);if(y<719)distances[i]=Math.min(distances[i],distances[i+1280]+1);if(x<1279&&y<719)distances[i]=Math.min(distances[i],distances[i+1281]+1.414214);if(y<719&&x)distances[i]=Math.min(distances[i],distances[i+1279]+1.414214)}
for(let y=0;y<720;y++)for(let x=0;x<1280;x++){const i=(y*1280+x)*4;if(data.data[i+3]){const g=glyphs.find(g=>x/1280>=g.x0-.002&&x/1280<=g.x1+.002);if(g){data.data[i]=Math.round((g.index+.5)/32*255);data.data[i+1]=Math.round(glyphProgress(g,x/1280,1-y/720)*255);if(cpuHash(x+41.31,y+8.73)>.9935){
const seed=cpuHash(y+19.7,x+6.2),px=x/1280,py=1-y/720;
const rand=n=>cpuHash(x+n*17.13,y+n*43.71);
const release=glyphProgress(g,px,py)+(cpuFbm(px*78,py*44)-.5)*.045;
sparkSeeds.push({x:px,y:py,g:g.index,release,seed,delay:rand(1)*.18-.02,
vx:.085+rand(2)*.10,vy:.05+rand(3)*.075,ax:rand(4)*.003,
sway:.002+rand(5)*.005,phase:rand(6)*Math.PI*2,frequency:1.3+rand(7)*4.3,
twinkle:6+rand(8)*19,life:1.1+rand(9)*1.85,
size:1.5+Math.pow(rand(10),2)*3.5,brightness:1.25+rand(11)*.95})}
if(x%40===0&&y%40===0&&cpuHash(x+1,y)>.28){const seed=cpuHash(y+2,x),px=x/1280,py=1-y/720;const release=glyphProgress(g,px,py)+(cpuFbm(px*78,py*44)-.5)*.045;flameSeeds.push({x:px,y:py,g:g.index,release,seed,life:.42+seed*.22,width:.095+seed*.045,height:.34+seed*.18})}data.data[i+2]=Math.round(Math.min(1,distances[y*1280+x]/Math.max(1,(g.y1-g.y0)*720*.08))*255)}else data.data[i+3]=0}}
ctx.putImageData(data,0,0);const boxes=new Float32Array(128);glyphs.forEach((g,i)=>boxes.set([g.x0,g.x1,g.y0,g.y1],i*4));gl.uniform4fv(U['boxes[0]'],boxes);gl.uniform1f(U.count,glyphs.length);gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,maskCanvas);burnTime=Math.min(2*(duration/7),(duration-1.4)/(glyphs.length<2?1:1.3+.5*(glyphs.length-2)));restart()}
function rgb(h){return [1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255)}
function render(seconds,withSparks=true){const rect=canvas.getBoundingClientRect(),ratio=mobilePreview?Math.min(devicePixelRatio||1,1.25):Math.min(Math.max(devicePixelRatio||1,1.5),2);const w=exportSize?.[0]||Math.round(rect.width*ratio),h=exportSize?.[1]||Math.round(rect.height*ratio);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}advanceHeat(seconds);gl.viewport(0,0,w,h);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);gl.uniform1f(U.time,seconds);gl.uniform1f(U.burn,burnTime);gl.uniform2f(U.volumeSize,simWidth,simHeight);gl.uniform1f(U.raySamples,mobilePreview&&!exporting?16:32);gl.uniform1f(U.aspect,16/9);gl.uniform1f(U.flameHeight,+$('height').value);gl.uniform1f(U.glow,+$('glow').value);gl.uniform3fv(U.fireColor,rgb($('color').value));gl.uniform3fv(U.inkColor,rgb($('ink').value));gl.uniform3fv(U.backgroundColor,rgb($('background').value));gl.drawArrays(gl.TRIANGLES,0,6);if(withSparks)drawSparks(seconds,w,h);$('seek').value=seconds;$('clock').textContent=seconds.toFixed(1)+' / '+duration.toFixed(1)+'s';$('state').textContent=seconds>duration-2?'燃尽 · 余烟':playing?'逐字向右燃烧':'已暂停'}
function restart(){chooseConnections();resetHeat();t=0;playing=true;$('play').textContent='Ⅱ';last=performance.now()}
function tick(now){if(exporting||window.studioSleeping||document.hidden){last=now;requestAnimationFrame(tick);return;}if(!playing){last=now;requestAnimationFrame(tick);return;}if(last)t+=Math.max(0,Math.min(.1,(now-last)/1000));last=now;if(mobilePreview&&now-lastPreviewDraw<1000/30){requestAnimationFrame(tick);return;}lastPreviewDraw=now;if(t>duration){if($('loop').checked)t=0;else{t=duration;playing=false;$('play').textContent='▶'}}render(t);requestAnimationFrame(tick)}
$('play').onclick=()=>{playing=!playing;$('play').textContent=playing?'Ⅱ':'▶'};$('restart').onclick=$('replay').onclick=restart;$('seek').oninput=()=>{playing=false;t=+$('seek').value;$('play').textContent='▶'};let rebuildTimer;for(const id of ['text','scale'])$(id).addEventListener('input',()=>{clearTimeout(rebuildTimer);rebuildTimer=setTimeout(rebuild,120);});$('font').addEventListener('input',async()=>{const family=$('font').value==='Reference'?'Sancreek':$('font').value;await document.fonts.load('250px '+family);rebuild();});$('duration').onchange=()=>{duration=+$('duration').value;$('seek').max=duration;rebuild()};document.querySelectorAll('[data-color]').forEach(b=>b.onclick=()=>{$('color').value=b.dataset.color;document.querySelectorAll('[data-color]').forEach(x=>x.classList.toggle('selected',x===b))});$('background').oninput=()=>{document.documentElement.style.setProperty('--canvas-bg',$('background').value);render(t)};$('color').oninput=()=>document.querySelectorAll('[data-color]').forEach(b=>b.classList.toggle('selected',b.dataset.color===$('color').value));
const params=new URLSearchParams(location.search);if(params.has('capture'))document.body.classList.add('capture');
async function init(){try{await document.fonts.load('250px '+($('font').value==='Reference'?'Sancreek':$('font').value));fontReady=true}catch(e){$('error').hidden=false;$('error').textContent='展示字体加载失败，已使用系统字体。';$('font').value='serif'}rebuild();window.flameDemo={beginExport:(w,h)=>{const previous={t,playing};exporting=true;playing=false;configureSimulation(true);exportSize=[w,h];resetHeat();t=0;return previous;},endExport:previous=>{exportSize=null;configureSimulation(false);exporting=false;t=previous.t;render(t);playing=previous.playing;last=performance.now();$('play').textContent=playing?'Ⅱ':'▶';},setCoreGain:value=>{gl.uniform1f(gl.getUniformLocation(program,"coreGain"),value);render(t)},regenerateConnections:()=>{chooseConnections();resetHeat()},inspectDepth:()=>{const bytes=new Uint8Array(canvas.width*canvas.height*4),stats=[];for(const depth of [.1,.5,.9]){gl.uniform1f(gl.getUniformLocation(program,"debugDepth"),depth);gl.drawArrays(gl.TRIANGLES,0,6);gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,bytes);let heat=0,fuel=0;for(let i=0;i<bytes.length;i+=64){heat+=bytes[i];fuel+=bytes[i+1]}stats.push({depth,heat,fuel})}gl.uniform1f(gl.getUniformLocation(program,"debugDepth"),-1.);render(t);return stats},render:(seconds,withSparks=true)=>{playing=false;t=seconds;render(t,withSparks)},setText:value=>{$('text').value=value;rebuild()},getState:()=>({t,playing,width:canvas.width,height:canvas.height,fontReady,duration,letterGapHeightRatio:.04,palette:{core:"#F5FBFC",transition:"#A2EEF9",blue:"#3759DF",edge:"#0A3ED4",ink:"#3C5977"},gradientMode:"surface-heat-to-local-fire",attachmentModel:"glyph-interior-distance",surfaceHeatBandHeightRatio:.093333,upperFlameMotion:"irregular-lateral-bursts",fireInjection:"continuous-with-sparse-local-tongues",interGlyphFire:"all-adjacent-variable-size-tongues",requiredConnectionCount:Math.max(0,glyphs.length-1),connectionPairs:Array.from(linkStrength).flatMap((v,i)=>v?[[i,i+1]]:[]),edgeGlow:"soft-two-radius",opacity:"variable-thickness",fireColorContrast:2,fireToneContrast:2,whiteCoreTargetPercent:24.5,whiteCoreCalibrationGain:24.45,whiteCoreLayout:"advected-local-clusters",fireOrbit:"clockwise-xz",fireOrbitPitchDegrees:15,camera:"fixed",glyphRearOcclusion:true,backgroundColor:$("background").value,frontViewFireBalance:{left:1,right:.39,reductionPercent:61,additionalReductionPercent:35},coreSpatialReference:{A:[.904,.311],B:[.533,.637,.753],C:[.649,.801,.475]},font:$('font').value,burnTime,fragmentLeadSeconds:.3,burnFrontAngleDegrees:12,fireEngine:"3d-voxel-advection",volumeDepthSamples:32,simulationFrame:simFrame,heatResolution:[simWidth,simHeight,16],previewProfile:mobilePreview?"mobile":"desktop",simulationRate:simRate,raySamples:mobilePreview&&!exporting?16:32,usesFlameFlipbook:false,sparkSourceCount:sparkSeeds.length,sparkFlight:"diagonal-ahead-of-burning-front",smokeTimings:glyphs.map(g=>({onset:.20+(glyphOffset(g.index)+.7)*burnTime,end:g.index+1<glyphs.length?.20+(glyphOffset(g.index+1)+1)*burnTime:.20+(glyphOffset(g.index)+1)*burnTime+.95})),glyphs:glyphs.map(g=>({...g,start:.20+glyphOffset(g.index)*burnTime,burnProgress:Math.max(0,Math.min(1,(t-.20)/burnTime-glyphOffset(g.index)))}))})};if(!params.has('manual'))requestAnimationFrame(tick);else render(0)}init();for(const id of ['color','ink','height','glow'])$(id).addEventListener('input',()=>render(t));












