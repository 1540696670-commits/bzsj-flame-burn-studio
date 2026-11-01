(()=>{
  const button=document.getElementById('downloadBurn'),status=document.createElement('p');
  status.className='export-status';status.hidden=true;document.body.append(status);
  let busy=false;
  button.onclick=async()=>{
    if(busy)return;
    const report=text=>{status.hidden=false;status.textContent=text;};
    if(!window.burnStudio){report('动画正在加载，请稍后再试');return;}
    if(!window.VideoEncoder||!window.Mp4Muxer){report('高清下载需要新版 Chrome 或 Edge');return;}
    let encoder,previous;
    const controls=[...document.querySelectorAll('button,input,select')],disabled=controls.map(el=>el.disabled);
    busy=true;controls.forEach(el=>el.disabled=true);
    try{
      let config;
      for(const edge of [3840,2560,1920]){
        const width=Math.round(Math.min(1,innerWidth/innerHeight)*edge/2)*2;
        const candidate={codec:'avc1.640034',width,height:Math.round(width*innerHeight/innerWidth/2)*2,bitrate:edge===3840?60000000:edge===2560?40000000:24000000,framerate:30,avc:{format:'avc'}};
        for(const codec of ['avc1.640034','avc1.420034']){
          candidate.codec=codec;
          try{if((await VideoEncoder.isConfigSupported(candidate)).supported){config={...candidate};break;}}catch{}
        }
        if(config)break;
      }
      if(!config)throw Error('设备不支持高清 MP4 编码');
      const seconds=5,fps=30,frames=seconds*fps;
      previous={t:burnStudio.state.t,playing:burnStudio.state.playing};burnStudio.pause();burnStudio.state.exportSize=[config.width,config.height];
      const out=document.createElement('canvas');out.width=config.width;out.height=config.height;const ctx=out.getContext('2d');
      const target=new Mp4Muxer.ArrayBufferTarget(),muxer=new Mp4Muxer.Muxer({target,video:{codec:'avc',width:config.width,height:config.height,frameRate:fps},fastStart:'in-memory'});
      let failure;
      encoder=new VideoEncoder({output:(chunk,meta)=>muxer.addVideoChunk(chunk,meta),error:error=>failure=error});encoder.configure(config);
      window.lastBurnExport={width:config.width,height:config.height,bitrate:config.bitrate,fps,duration:seconds};
      report('正在生成 '+config.width+' × '+config.height+' 高清 MP4，请稍候');
      for(let i=0;i<frames;i++){
        if(failure)throw failure;
        burnStudio.state.t=i/fps;burnStudio.render();ctx.fillStyle=burnStudio.state.bg;ctx.fillRect(0,0,out.width,out.height);
        const img=burnStudio.state.image;if(img){const scale=Math.max(out.width/img.width,out.height/img.height);ctx.drawImage(img,(out.width-img.width*scale)/2,(out.height-img.height*scale)/2,img.width*scale,img.height*scale);}
        ctx.drawImage(document.getElementById('stage'),0,0);
        const frame=new VideoFrame(out,{timestamp:Math.round(i*1000000/fps),duration:Math.round((i+1)*1000000/fps)-Math.round(i*1000000/fps)});
        try{encoder.encode(frame,{keyFrame:i%60===0});}finally{frame.close();}
        if(encoder.encodeQueueSize>8)await encoder.flush();
        button.textContent='生成中 '+Math.floor((i+1)/frames*100)+'%';
        if(i%3===0)await new Promise(resolve=>setTimeout(resolve,0));
      }
      await encoder.flush();if(failure)throw failure;muxer.finalize();
      const url=URL.createObjectURL(new Blob([target.buffer],{type:'video/mp4'})),link=document.createElement('a');
      link.href=url;link.download='BzsJ-burn-'+config.width+'x'+config.height+'-'+seconds+'s.mp4';link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
      report('高清 MP4 已下载');
    }catch(error){report('下载失败：'+error.message);}
    finally{
      if(encoder&&encoder.state!=='closed')encoder.close();
      try{if(previous){burnStudio.state.exportSize=null;burnStudio.state.t=previous.t;burnStudio.render();if(previous.playing)burnStudio.play();}}finally{controls.forEach((el,i)=>el.disabled=disabled[i]);button.innerHTML='下载高清 <span>↓</span>';busy=false;}
      setTimeout(()=>{if(!busy)status.hidden=true;},8000);
    }
  };
})();
