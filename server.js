const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8000;

const server = http.createServer((req, res) => {
    const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const requestPath = decodeURIComponent(requestUrl.pathname);
    const workspaceRoot = path.resolve(__dirname);
    const filePath = path.resolve(workspaceRoot, `.${requestPath}`);

    if (filePath === workspaceRoot) {
        res.writeHead(302, { Location: '/index.html' });
        return res.end();
    }

    if (/^\/dispositivo\/\d+\/?$/.test(requestPath)) {
        return fs.readFile(path.join(workspaceRoot, 'index.html'), (error, content) => {
            if (error) {
                res.writeHead(500);
                return res.end('Server Error');
            }
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(content, 'utf-8');
        });
    }

    if (!filePath.startsWith(`${workspaceRoot}${path.sep}`) || filePath.includes(`${path.sep}.git${path.sep}`)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        return res.end('Forbidden');
    }

    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon'
    }[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if(error.code === 'ENOENT'){
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 Not Found</h1>', 'utf-8');
            } else {
                res.writeHead(500);
                res.end('Server Error: ' + error.code);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
});
