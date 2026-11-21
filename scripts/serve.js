import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';

const port = Number(process.env.QUIZ_PORT ?? 4173);
const host = '127.0.0.1';
const root = new URL('../', import.meta.url);
const pages = new Set(['/index.html', '/quiz.html', '/results.html', '/profiles.html', '/about.html', '/working.html']);
const assets = /^\/(css|js|img)\/(?:favicon\/)?[a-z0-9][a-z0-9.-]*$/i;
const types = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
};

const server = createServer(async (request, response) => {
    const pathname = (request.url ?? '').split('?')[0];
    const file = pathname === '/' ? '/index.html' : pathname;
    const type = types[extname(file)];
    if (request.method !== 'GET' && request.method !== 'HEAD') {
        response.writeHead(405, { Allow: 'GET, HEAD' }).end();
        return;
    }
    if (!type || (!pages.has(file) && !assets.test(file))) {
        response.writeHead(404).end('Not found');
        return;
    }
    try {
        const contents = await readFile(new URL(`.${file}`, root));
        response.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' })
            .end(request.method === 'HEAD' ? undefined : contents);
    } catch (error) {
        const missing = error.code === 'ENOENT';
        response.writeHead(missing ? 404 : 500).end(missing ? 'Not found' : 'Could not read file');
    }
});

server.listen(port, host, () => console.log(`Local quiz preview: http://${host}:${server.address().port}/`));
