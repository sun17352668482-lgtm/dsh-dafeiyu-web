'use strict';
/* 大肥鱼桌宠 · 本地服务
   1) 静态托管 pet 目录（让页面走 http://127.0.0.1:8787 而不是 file://，可装成桌面应用）
   2) 代理 DeepSeek 余额接口，避免浏览器跨域 + 不把 key 暴露给页面
   3) 通过余额差值统计“今日消耗”，不需要 usage 接口
*/
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

// 默认就用 svc.js 所在目录，clone 下来即可直接 node svc.js；需要时用 PET_ROOT 覆盖
const ROOT = process.env.PET_ROOT || __dirname;
const CFG = path.join(ROOT, '.cfg.json');
const USAGE = path.join(ROOT, 'usage.json');
const PORT = Number(process.env.PET_PORT || 8787);

const MIME = {
  '.html': 'text/html; charset=utf-8', '.webp': 'image/webp', '.wav': 'audio/wav',
  '.json': 'application/json; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8'
};

function log() {
  const a = Array.prototype.slice.call(arguments);
  console.log(new Date().toISOString(), a.join(' '));
}
function readJson(p, def) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return def; } }
function writeJson(p, o) { try { fs.writeFileSync(p, JSON.stringify(o, null, 1)); } catch (e) { log('write fail', e.message); } }
function cfg() { return readJson(CFG, {}); }
function pad(n) { return n < 10 ? '0' + n : '' + n; }
function today() {
  // 固定按北京时间（UTC+8）算“今日”，不依赖设备/proot 的时区；
  // 否则服务跑在 UTC 环境里，00:00~08:00 这段会把日期算成前一天，导致今日消耗基准错乱
  const d = new Date(Date.now() + 8 * 3600 * 1000);
  return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
}

let last = { ok: false, ts: 0, data: null, err: '' };
let busy = false;

function fetchBalance(key, cb) {
  const req = https.request({
    host: 'api.deepseek.com', path: '/user/balance', method: 'GET',
    headers: { Authorization: 'Bearer ' + key, Accept: 'application/json' }, timeout: 12000
  }, res => {
    let buf = '';
    res.setEncoding('utf8');
    res.on('data', c => buf += c);
    res.on('end', () => {
      if (res.statusCode !== 200) return cb(new Error('HTTP ' + res.statusCode + ' ' + buf.slice(0, 140)));
      try { cb(null, JSON.parse(buf)); } catch (e) { cb(new Error('返回不是 JSON')); }
    });
  });
  req.on('timeout', () => req.destroy(new Error('请求超时')));
  req.on('error', e => cb(e));
  req.end();
}

function sample(cb) {
  const c = cfg();
  if (!c.key) return cb(new Error('还没绑定 API Key'));
  if (busy) return cb(new Error('正在查询'));
  busy = true;
  fetchBalance(c.key, (err, data) => {
    busy = false;
    if (err) { last = { ok: false, ts: Date.now(), data: null, err: err.message }; return cb(err); }
    const infos = (data && data.balance_infos) || [];
    const cny = infos.filter(i => i.currency === 'CNY')[0] || infos[0] || {};
    const total = parseFloat(cny.total_balance || 0) || 0;
    const granted = parseFloat(cny.granted_balance || 0) || 0;
    const topped = parseFloat(cny.topped_up_balance || 0) || 0;
    const u = readJson(USAGE, {});
    const d = today();
    if (u.date !== d || u.start == null) { u.date = d; u.start = total; u.samples = []; }
    u.last = total; u.granted = granted; u.topped = topped; u.ts = Date.now();
    u.samples = u.samples || [];
    u.samples.push({ t: u.ts, b: total });
    if (u.samples.length > 300) u.samples = u.samples.slice(-300);
    writeJson(USAGE, u);
    last = { ok: true, ts: Date.now(), data: { total: total, granted: granted, topped: topped, available: !!data.is_available }, err: '' };
    cb(null, last.data);
  });
}

function usageView() {
  const u = readJson(USAGE, {});
  const d = today();
  if (u.date !== d) return { date: d, spend: 0, start: null, now: null, ts: 0, granted: 0, topped: 0, fresh: true };
  const spend = (u.start != null && u.last != null) ? Math.max(0, u.start - u.last) : 0;
  return { date: u.date, spend: spend, start: u.start, now: u.last, ts: u.ts || 0, granted: u.granted || 0, topped: u.topped || 0, fresh: false };
}

function corsHead(extra) {
  const h = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    // Chrome 从 file:// 或公网页面访问 127.0.0.1 时会走 Private Network Access 预检，
    // 必须回这个头，否则离线副本拿不到余额
    'Access-Control-Allow-Private-Network': 'true',
    'Access-Control-Max-Age': '86400'
  };
  if (extra) Object.assign(h, extra);
  return h;
}
function sendJson(res, code, obj) {
  const s = JSON.stringify(obj);
  res.writeHead(code, corsHead({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }));
  res.end(s);
}

function body(req, cb) {
  let b = '';
  req.on('data', c => { b += c; if (b.length > 1e6) req.destroy(); });
  req.on('end', () => cb(b));
}

const server = http.createServer((req, res) => {
  const u = url.parse(req.url, true);
  const p = u.pathname || '/';

  // CORS / Private Network Access 预检（file:// 离线副本访问本机服务时会先打 OPTIONS）
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHead());
    return res.end();
  }
  // 主动停机：页面右上角 ✕ 会先打这个，避免关掉界面后服务还在后台轮询余额
  if (p === '/api/quit') {
    sendJson(res, 200, { ok: true, bye: true });
    setTimeout(function(){
      log('quit requested, shutting down');
      try { process.exit(0); } catch(e){}
    }, 200);
    return;
  }
  if (p === '/api/ping') return sendJson(res, 200, { ok: true, ts: Date.now(), today: today() });

  if (p === '/api/state') {
    return sendJson(res, 200, {
      ok: true, bound: !!cfg().key, balance: last.data, balanceTs: last.ts,
      balanceErr: last.err, usage: usageView()
    });
  }

  if (p === '/api/balance') {
    const force = u.query.force === '1';
    if (!force && last.ts && Date.now() - last.ts < 45000) {
      return sendJson(res, 200, { ok: last.ok, balance: last.data, ts: last.ts, err: last.err, usage: usageView(), cached: true });
    }
    sample(err => {
      sendJson(res, 200, { ok: !err, balance: last.data, ts: last.ts, err: err ? err.message : '', usage: usageView(), cached: false });
    });
    return;
  }

  if (p === '/api/key') {
    if (req.method !== 'POST') return sendJson(res, 405, { ok: false, err: '只支持 POST' });
    return body(req, raw => {
      let k = '';
      try { k = (JSON.parse(raw || '{}').key || '').trim(); } catch (e) { k = ''; }
      if (k && k.length < 12) return sendJson(res, 400, { ok: false, err: 'Key 看起来不对' });
      const c = cfg();
      c.key = k;
      writeJson(CFG, c);
      last = { ok: false, ts: 0, data: null, err: '' };
      if (!k) return sendJson(res, 200, { ok: true, bound: false });
      sample(err => sendJson(res, 200, { ok: !err, bound: true, balance: last.data, err: err ? err.message : '' }));
    });
  }

  // 静态文件
  let rel = decodeURIComponent(p === '/' ? '/index.html' : p);
  const fp = path.join(ROOT, rel);
  if (fp.indexOf(ROOT) !== 0) { res.writeHead(403); return res.end('forbidden'); }
  fs.stat(fp, (e, st) => {
    if (e || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('404'); }
    const ext = path.extname(fp).toLowerCase();
    const head = { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Content-Length': st.size, 'Accept-Ranges': 'bytes' };
    if (ext === '.webp') head['Cache-Control'] = 'public, max-age=2592000';
    res.writeHead(200, head);
    fs.createReadStream(fp).pipe(res);
  });
});

server.on('error', e => { log('server error', e.message); process.exit(1); });
server.listen(PORT, '127.0.0.1', () => {
  log('pet service on http://127.0.0.1:' + PORT, 'today=' + today());
  if (cfg().key) sample(() => log('first sample done', last.err || 'ok'));
});
setInterval(() => { if (cfg().key) sample(() => log('tick', last.ok ? 'ok' : last.err)); }, 10 * 60 * 1000);
