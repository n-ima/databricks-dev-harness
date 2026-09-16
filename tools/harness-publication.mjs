#!/usr/bin/env node
import { checkPublication, prePush, installGuard, guardStatus } from './lib/publication.mjs';

async function input() {
  const chunks=[]; let size=0;
  for await (const chunk of process.stdin) {
    size+=chunk.length; if(size>1024*1024) throw new Error('push ref入力が上限を超えています。');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

try {
  const [command,...args]=process.argv.slice(2);
  const options={};
  if(command==='check') {
    for(let i=0;i<args.length;i++) {
      if(args[i]==='--base' && !Object.hasOwn(options,'base') && args[i+1]) options.base=args[++i];
      else if(args[i]==='--committed' && !options.committed) options.committed=true;
      else throw new Error('不明・重複した引数です。check [--base SHA] [--committed]');
    }
  } else if(args.length) throw new Error('余分な引数は受理しません。');
  const root=process.cwd();
  const result=command==='check'?await checkPublication(root,options)
    :command==='pre-push'?await prePush(root,await input())
    :command==='install-hook'?await installGuard(root)
    :command==='guard-status'?await guardStatus(root)
    :null;
  if(!result) throw new Error('check / guard-status / install-hook / pre-push を指定してください。');
  console.log(JSON.stringify(result,null,2));
  if(result.status==='not-installed') process.exitCode=1;
} catch(error) {
  console.error(`ハーネス公開を停止: ${error.message}`);
  process.exitCode=2;
}
