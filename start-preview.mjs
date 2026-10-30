import { spawn } from 'node:child_process';
import { openSync, closeSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const root = dirname(fileURLToPath(import.meta.url));
const vite = join(root, 'node_modules', 'vite', 'bin', 'vite.js');
const runtime = join(root, '.preview');
const url = 'http://127.0.0.1:5174/';
async function probe() {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1500) });
    return response.ok && (await response.text()).includes('Fonseca Barber Club') ? 'ready' : 'other';
  } catch { return 'offline'; }
}
if (!existsSync(vite)) throw new Error('Dependências ausentes. Execute npm install na pasta do projeto.');
const initial = await probe();
if (initial === 'other') throw new Error('A porta 5174 está ocupada por outro aplicativo. Nenhum processo foi encerrado.');
if (initial === 'ready') {
  console.log(`Preview já ativo: ${url}`);
} else {
  mkdirSync(runtime, {recursive:true});
  const stdout = openSync(join(runtime,'stdout.log'),'a');
  const stderr = openSync(join(runtime,'stderr.log'),'a');
  const child = spawn(process.execPath, [vite,'--host','127.0.0.1','--port','5174','--strictPort'], {
    cwd:root, detached:true, windowsHide:true, stdio:['ignore',stdout,stderr],
  });
  await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject)});
  child.unref();
  closeSync(stdout); closeSync(stderr);
  writeFileSync(join(runtime,'pid.txt'),String(child.pid));
  let ready=false;
  for(let attempt=0;attempt<20;attempt++){
    await delay(500);
    if(await probe()==='ready'){ready=true;break;}
  }
  if(!ready) throw new Error('Preview ainda não respondeu. Consulte .preview/stdout.log e .preview/stderr.log.');
  console.log(`Preview iniciado em processo separado: ${url} (PID ${child.pid}). Sem serviço ou inicialização automática.`);
}
