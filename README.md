# 奶蛙后室 · Level 0（独立版）

从《奶蛙消消乐》里拆出来的蛙后室 3D 小游戏，可独立运行/独立发布。

## 运行

先安装依赖并构建，再启动静态服务器（直接双击 `index.html` 会被浏览器的 `file://` 限制拦住）：

```bash
npm ci
npm run dev
# 打开 http://127.0.0.1:8950/
```

`npm run dev` 会先构建到 `dist/`，然后从该目录提供页面。

## 玩法

- 目标：救出 3 只迷路的奶鼠，再找到绿色出口逃出 Level 0
- 奶蛋（黑化奶蛙）会巡逻、听到奔跑和泼奶，并追踪最后看到的位置；甩开后仍会在附近搜寻
- 牛奶是弹药，泼中奶蛋能让它短暂晕眩和后退，但不会永久消灭它
- 出口锁定时需先救齐奶鼠；门上的三盏灯显示救援进度
- 键位：`WASD` 移动 · 鼠标上下左右观察 · 点击/`空格` 泼牛奶 · `Shift` 奔跑 · `Esc` 暂停
- 手机：左侧摇杆移动，右侧滑动观察，🥛 攻击，↟ 奔跑

## 结构

```
index.html              外壳：启动加载进度 + 入口大厅 + 后室全屏页面样式
backrooms3d.js          游戏源码（three.js）
shot-target.js          准星射击判定
enemy-ai.js             奶蛋巡逻、警觉、追逐和搜寻逻辑
game-audio.js           按需加载的环境音乐与事件音效
audio/                  CC0 音频文件与来源记录
naiwa/backrooms3d/      角色模型源文件 naidan.glb / naishu.glb
scripts/                模型准备与站点构建脚本
dist/                   构建产物（游戏 JS、优化后的模型和静态页面）
third-party/            three.js MIT 许可证
```

## 构建与部署

```bash
npm ci
npm test
npm run build
```

构建会压缩两个角色模型，再生成 `dist/backrooms3d.bundle.js` 和独立的 GLB 文件。`index.html` 会显示游戏 JS 的下载进度；进入关卡时再加载角色模型。GitHub Pages 工作流会运行测试和构建，并只发布 `dist/`。

## 素材与授权

- three.js：MIT（见 `third-party/three-LICENSE.txt`）
- 奶蛙/奶蛋/奶鼠模型：本项目自制
- 音频：CC0，逐文件来源见 `audio/SOURCES.md`
