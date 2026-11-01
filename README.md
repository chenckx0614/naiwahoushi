# 奶蛙后室 · Level 0（独立版）

从《奶蛙消消乐》里拆出来的蛙后室 3D 小游戏，可独立运行/独立发布。

## 运行

直接双击 `index.html` 不行（浏览器会拦 file:// 的 fetch），起个静态服务器：

```bash
python -m http.server 8950 --bind 127.0.0.1
# 打开 http://127.0.0.1:8950/
```

## 玩法

- 目标：救出 3 只迷路的奶鼠，再找到绿色出口逃出 Level 0
- 奶蛋（黑化奶蛙）看到你会追一小段，趁它停下时绕开
- 牛奶是弹药，泼中奶蛋能把它击退
- 键位：`WASD` 移动 · 鼠标上下左右观察 · 点击/`空格` 泼牛奶 · `Shift` 奔跑 · `Esc` 暂停
- 手机：左侧摇杆移动，右侧滑动观察，🥛 攻击，↟ 奔跑

## 结构

```
index.html              外壳：启动加载进度 + 入口大厅 + 后室全屏页面样式
backrooms3d.js          游戏源码（three.js）
backrooms3d.bundle.js   打包产物（12.6MB，含两个 base64 内嵌模型）
naiwa/backrooms3d/      角色模型源文件 naidan.glb / naishu.glb（仅打包用）
third-party/            three.js MIT 许可证
```

## 改代码后重新打包

```bash
npm install
npm run build
```

`backrooms3d.bundle.js` 是自包含产物，`index.html` 用 fetch 流式读取它显示真实加载进度，不需要额外配置。

## 素材与授权

- three.js：MIT（见 `third-party/three-LICENSE.txt`）
- 奶蛙/奶蛋/奶鼠模型：本项目自制
