import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {dirname,resolve as resolvePath} from 'node:path';

// Only the immediate process is bounded/killed; OS/job isolation owns descendants.
export function commandResultAsync(command,args,options={}){
  let executable=command,argv=args;
  if(process.platform==='win32'&&['npm','npx'].includes(command)){
    const entrypoint=resolvePath(dirname(process.execPath),'node_modules','npm','bin',`${command}-cli.js`);
    if(existsSync(entrypoint)){executable=process.execPath;argv=[entrypoint,...args];}
  }
  return new Promise(resolve=>{
    let child,timer,forceTimer,stopping=false,settled=false,bytes=0,stdout='',stderr='',failure=null;
    const maxBytes=options.maxBuffer??10*1024*1024,timeout=options.timeout??30000;
    if(!Number.isSafeInteger(maxBytes)||maxBytes<1||!Number.isFinite(timeout)||timeout<1)throw new Error('Invalid command bounds.');
    const finish=(status,signal)=>{
      if(settled)return;settled=true;clearTimeout(timer);clearTimeout(forceTimer);
      resolve({ok:!failure&&status===0,status,signal,stdout,stderr,error:failure});
    };
    try{child=spawn(executable,argv,{cwd:options.cwd,env:options.env??process.env,shell:false,windowsHide:true,stdio:['ignore','pipe','pipe']});}
    catch(error){failure=error.message;finish(null,null);return;}
    const stop=reason=>{
      if(stopping||settled)return;stopping=true;failure=reason;
      child.kill();child.stdout.destroy();child.stderr.destroy();
      // Wait for the immediate child's close event, not merely kill dispatch.
      // Escalation bounds cooperative shutdown on POSIX; descendants remain external.
      forceTimer=setTimeout(()=>child.kill('SIGKILL'),250);
    };
    for(const [name,stream] of [['stdout',child.stdout],['stderr',child.stderr]]) stream.setEncoding('utf8').on('data',chunk=>{
      bytes+=Buffer.byteLength(chunk);
      if(bytes>maxBytes){stop('Command output limit exceeded');return;}
      if(name==='stdout')stdout+=chunk;else stderr+=chunk;
    });
    child.once('error',error=>{failure=error.message;finish(null,null);});
    child.once('close',finish);
    timer=setTimeout(()=>stop('Command timeout exceeded'),timeout);
  });
}
