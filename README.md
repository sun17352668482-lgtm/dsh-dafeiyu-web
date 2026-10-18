<p align="center">
  <img src="icon-192.png" width="112" alt="大肥鱼">
</p>

<h1 align="center">大肥鱼桌宠 · Web 复刻版</h1>

<p align="center">
  把 Windows 桌面端的 <b>DSH 大肥鱼</b> 搬进浏览器和手机：透明背景、可拖动、会吃 token，<br>
  旁边还挂着一张 DeepSeek 钱包卡 —— 余额、今日已用，一眼就能看到。
</p>

<p align="center">
  <img alt="license" src="https://img.shields.io/badge/license-MIT-blue">
  <img alt="node" src="https://img.shields.io/badge/node-%3E%3D16-brightgreen">
  <img alt="deps" src="https://img.shields.io/badge/dependencies-0-success">
  <img alt="demo" src="https://img.shields.io/badge/demo-GitHub%20Pages-2ea44f">
</p>

> 🔗 **在线试玩（GitHub Pages）**：<https://sun17352668482-lgtm.github.io/dsh-dafeiyu-web/>
>
> 手机上点开就能玩：桌宠会动、能拖动、能摸头、能喂 token、能关掉。但 Pages 是**纯静态托管，没有 Node 后端**，所以
> **余额看板会显示「离线」** —— 拉余额必须靠本地 `svc.js` 代理（见「快速开始」）。这是设计如此，不是 bug。
---
## 这是什么

一个**零依赖、零构建**的单页桌宠。核心只有两个文件：

- `index.html` —— 桌宠本体（动画状态机 + 拖拽 + 互动 + 钱包卡 + 天气）
- `svc.js` —— 一个 200 行的 Node 小服务（静态托管 + 代理 DeepSeek 余额 + 统计今日消耗）

它没有框架、没有打包器、没有 npm install。`node svc.js` 就能跑。

> 本项目是 [QCYTSN/dsh-dafeiyu](https://github.com/QCYTSN/dsh-dafeiyu) 的**非官方 Web 移植**，
> 动画素材来自上游（MIT），详见 [素材归属](#素材归属与许可)。

## 功能

| | |
|---|---|
| 🐟 **真实素材** | 直接复用上游 35 段 `.webp` 动画：idle / 打哈欠 / 伸懒腰 / 被拖拽 / 吃 token / 摸头 / 甩尾 / 出错等（含右向 `_r` 变体） |
| 🖱 **拖动 & 互动** | 按住拖动会切到 dragging 动画，松手播放落地；点身体、摸头、喂 token 各有独立反应 |
| 💰 **余额看板** | 显示 DeepSeek 总余额、今日已用、赠送 / 充值拆分；45 秒缓存 + 手动刷新 |
| 📉 **今日消耗** | 用**余额差值法**算出，不依赖任何 usage 接口；按 **UTC+8** 固定切日，换机器、换时区都不会错位 |
| ⏻ **真·关闭** | 右上角 ✕ 会 `POST /api/quit` 真正杀掉 node 进程，而不是只关掉页面留个后台在轮询余额 |
| ⏰ **再叫醒** | 关掉后页面变成「大肥鱼下班了」遮罩，点一下自动探活：服务活着就重载，没活就提示你先跑 `run.sh` |
| 🌤 **天气卡** | Open-Meteo 免密钥接口，按经纬度取当前天气 / 体感 / 湿度 |
| 📱 **PWA** | 带 manifest 与 Service Worker，可「添加到主屏幕」当独立应用 |
| 🔌 **可移植** | `PET_ROOT` / `PET_PORT` 环境变量覆盖，clone 到哪都能跑 |

## 目录结构

```
pet/
├── index.html            # 桌宠页面（约 40KB，样式+状态机+钱包逻辑全在里面）
├── svc.js                # 本地服务：静态托管 / 余额代理 / 今日消耗
├── run.sh                # 幂等启动脚本（已在跑就不重复起）
├── anim/                 # 35 段动画帧（约 107MB，来自上游）
├── icon-192.png          # PWA 图标
├── icon-512.png
├── manifest.webmanifest
├── sw.js                 # 离线壳
├── LICENSE
└── .gitignore
```

运行时才会生成（**已被 git 忽略**）：

- `.cfg.json` —— 存放你的 API Key，形如 `{"key":"sk-..."}`
- `usage.json` —— 今日消耗的采样状态

## 快速开始

需要 **Node.js ≥ 16**（不需要 npm 包）。

```bash
git clone <this-repo> dafeiyu-web
cd dafeiyu-web

# 方式一：直接跑
node svc.js

# 方式二：用脚本（推荐，幂等 + 可选自动打开页面）
sh run.sh --open
```

然后浏览器打开 **<http://127.0.0.1:8787/>**。

自定义端口 / 目录：

```bash
PET_PORT=9000 PET_ROOT=/path/to/pet node svc.js
```

### 手机上跑

Android 上任意能跑 Node 的环境都行（Termux、proot Ubuntu、AidLux…）：

```bash
node svc.js &          # 起服务
am start -a android.intent.action.VIEW -d http://127.0.0.1:8787/
```

> ⚠️ Termux 与 Ubuntu proot 里**没有 `pkill`**，要停服务请用页面上的 ✕（推荐），
> 或 `for p in /proc/[0-9]*; do grep -qa svc.js $p/cmdline && kill -9 ${p#/proc/}; done`。

## 绑定 DeepSeek API Key

两种方式，任选其一：

**A. 页面上填** —— 首次打开会提示未绑定，直接在输入框里粘贴 `sk-...` 即可。

**B. 走接口**

```bash
curl -X POST http://127.0.0.1:8787/api/key \
     -H 'content-type: application/json' \
     -d '{"key":"sk-你的key"}'
```

解绑：把 `key` 传空字符串。

Key 只写进本地 `.cfg.json`，**不会**被发送到除 `api.deepseek.com` 以外的任何地方；余额请求由 `svc.js` 在服务端发起，页面拿不到你的 key。

## HTTP API

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/ping` | 探活，返回 `{ok:true, ts, today}` |
| GET | `/api/state` | 一次性拿全量：是否绑定、余额、缓存时间、今日消耗 |
| GET | `/api/balance?force=1` | 取余额，`force=1` 跳过 45s 缓存 |
| POST | `/api/key` | 写入 / 清空 API Key |
| POST | `/api/quit` | **停机**：返回 200 后 200ms 退出进程 |
| OPTIONS | `*` | CORS / Private Network Access 预检，返回 204 |

`/api/state` 样例：

```json
{
  "ok": true,
  "bound": true,
  "balance": { "total": 9.31, "granted": 1.58, "topped": 7.72, "available": true },
  "usage": { "date": "2026-10-19", "spend": 0.37, "start": 9.68, "now": 9.31, "fresh": false }
}
```

## 今日消耗是怎么算的

没有官方 usage 接口可用，所以用**余额差值**：

1. 当天第一次拿到余额时，把它记成 `usage.json` 里的 `start`；
2. 之后每次采样更新 `now`，`spend = start - now`；
3. 跨天时（`today()` 变了）自动滚动基准。

`today()` 显式按 **UTC+8** 计算，不读宿主时区：

```js
const d = new Date(Date.now() + 8 * 3600 * 1000);
return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
```

> 这一行是踩过坑的：服务跑在 UTC 的 proot 里时，北京时间 00:00–08:00 会被算成「昨天」，
> 于是「今日已用」整天错位。现在跟系统时区彻底解耦。

副作用是：你在别处（别的设备、网页版）花的钱也会算进「今日已用」。这是有意的——它统计的是账户维度的消耗。

## 关闭与再唤起

```
点 ✕
 ├─ POST /api/quit      → 服务 200ms 后退出，不再轮询余额
 ├─ window.close()      → 浏览器通常会拦（正常现象）
 └─ 260ms 后仍未关窗    → 渲染全屏遮罩「大肥鱼下班了」
       └─ 点遮罩 → GET /api/ping
            ├─ 活着 → location.reload()
            └─ 没活 → 提示「服务没在跑，先执行 run.sh」
```

之所以要 `/api/quit`：**只 `window.close()` 是假的**。浏览器拦截后页面关不掉，
就算关掉了，node 进程还在后台每 10 分钟打一次余额接口——白耗电。

## 常见问题

**`EADDRINUSE: address already in use 127.0.0.1:8787`**
端口被上次的进程占着。先 `curl http://127.0.0.1:8787/api/quit` 停掉旧的，或换 `PET_PORT`。

**页面显示「未绑定」但 `.cfg.json` 里有 key**
重启服务；或直接 `curl -X POST .../api/key` 重新写入触发一次采样。

**余额一直不刷新**
余额接口有 45 秒缓存，点「刷新」或加 `?force=1`。若一直报错，多半是 key 失效或网络不通 `api.deepseek.com`。

**从 `file://` 打开页面拿不到数据**
会走 CORS + Private Network Access 预检。`svc.js` 已返回 `Access-Control-Allow-Private-Network: true`，
但更推荐直接用 `http://127.0.0.1:8787/` 打开。

**动画太大 / clone 很慢**
`anim/` 约 107MB（最大单文件 4MB）。这是上游素材的原始体积，为了「一比一还原」没有压缩。
纯看效果可以只保留 `idle*.webp` 和 `dragging*.webp`。

## 素材归属与许可

- 角色「大肥鱼」、动画帧与图标：**[QCYTSN/dsh-dafeiyu](https://github.com/QCYTSN/dsh-dafeiyu)**，MIT License。
- 本仓库的页面、服务与脚本：MIT License。

两者都以 MIT 发布，再分发时保留版权与许可声明即可，见 [LICENSE](LICENSE)。
本项目与上游作者无隶属关系，属社区非官方移植；若权利人希望调整署名方式，欢迎开 issue。

## 隐私

- 无遥测、无统计、无第三方脚本。
- API Key 仅存本地 `.cfg.json`。
- 余额请求直连 `https://api.deepseek.com`。
- 天气请求仅向 Open-Meteo 发送经纬度，不含任何身份信息。

---

<p align="center"><sub>如果这条鱼让你多看了两眼余额，给它点个 ⭐ 吧</sub></p>
