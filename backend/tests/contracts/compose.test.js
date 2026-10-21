// docker-compose.yml once described a system that was not in the repository:
// a database the backend does not use, a Dockerfile, a folder and a proxy
// configuration that did not exist (finding F20, B09.2). These checks keep
// every path it names real. They do not start a container.
const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..', '..', '..');
const composePath = path.join(repoRoot, 'docker-compose.yml');
const describeCompose = fs.existsSync(composePath) ? describe : describe.skip;
const compose = () => fs.readFileSync(composePath, 'utf8').replace(/\r\n/g, '\n');
// the file with its comments removed, so a comment about the past is not read as configuration
const configuration = () => compose().split('\n').filter(line => !/^\s*#/.test(line)).join('\n');
const exists = relative => fs.existsSync(path.join(repoRoot, relative));

describeCompose('docker-compose.yml', () => {
  test('every build context has the Dockerfile it names', () => {
    const builds = [...configuration().matchAll(/context:\s*(\S+)\s*\n\s*dockerfile:\s*(\S+)/g)].map(m => path.join(m[1], m[2]));
    expect(builds.length).toBeGreaterThan(0);
    expect(builds.filter(file => !exists(file))).toEqual([]);
  });

  test('every host path mounted or read exists, or has a documented example to copy', () => {
    const mounted = [...configuration().matchAll(/^\s*-\s*(\.\/[^:\s]+):/gm)].map(m => m[1]);
    expect(mounted.filter(file => !exists(file))).toEqual([]);
    const envFiles = [...configuration().matchAll(/^\s*-\s*(\.\/\S*\.env)\s*$/gm)].map(m => m[1]);
    expect(envFiles.length).toBeGreaterThan(0);
    // a .env file is never committed; its example must be
    expect(envFiles.filter(file => !exists(`${file}.example`))).toEqual([]);
  });

  test('it gives the backend the database and cache the backend uses', () => {
    expect(configuration()).toMatch(/DATABASE_URL:\s*mongodb:\/\/mongo:27017\//);
    expect(configuration()).toMatch(/REDIS_URL:\s*redis:\/\/redis:6379/);
    expect(configuration()).not.toMatch(/postgres/i);
    const server = fs.readFileSync(path.join(repoRoot, 'backend', 'src', 'server.js'), 'utf8');
    expect(server).toMatch(/process\.env\.PORT \|\| 8000/);
    expect(configuration()).toMatch(/PORT:\s*"8000"/);
  });

  test('it holds no secret and no placeholder secret', () => {
    expect(configuration()).not.toMatch(/JWT_SECRET|PASSWORD|API_KEY|_TOKEN/);
  });

  test('the image copies only what exists, and leaves secrets out', () => {
    const dockerfile = fs.readFileSync(path.join(repoRoot, 'backend', 'Dockerfile'), 'utf8');
    const copied = [...dockerfile.matchAll(/^COPY\s+(.+?)\s+\S+\s*$/gm)].flatMap(m => m[1].split(/\s+/));
    expect(copied.length).toBeGreaterThan(0);
    expect(copied.filter(file => !exists(path.join('backend', file)))).toEqual([]);
    expect(dockerfile).toMatch(/^USER node$/m);
    const ignored = fs.readFileSync(path.join(repoRoot, 'backend', '.dockerignore'), 'utf8').split(/\r?\n/);
    expect(ignored).toEqual(expect.arrayContaining(['.env', '.env.*', 'node_modules']));
    const engine = JSON.parse(fs.readFileSync(path.join(repoRoot, 'backend', 'package.json'), 'utf8')).engines.node;
    expect(dockerfile).toMatch(new RegExp(`^FROM node:${engine.replace('.x', '')}-`, 'm'));
  });

  test('both say plainly that they have not been run', () => {
    expect(compose()).toMatch(/NOT RUN YET/);
    expect(fs.readFileSync(path.join(repoRoot, 'backend', 'Dockerfile'), 'utf8')).toMatch(/NOT RUN YET/);
  });
});
