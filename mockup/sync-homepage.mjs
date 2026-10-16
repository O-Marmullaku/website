import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

export function mockupHomepage(source) {
  return source.replace('<head>','<head>\n  <base href="../" />')
    .replace('class="wordmark" href="./"','class="wordmark" href="mockup/"')
    .replace('src="main/site-services.js?v=classic-reader"','src="mockup/site-services.js?v=shared-mockup"');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  const source=await readFile(new URL('../index.html',import.meta.url),'utf8');
  await writeFile(new URL('index.html',import.meta.url),mockupHomepage(source));
}
