# 吞食天地Ⅱ：诸葛孔明传 · 日文原版网页播放器

游玩入口：https://kunruiw1991.github.io/pal98-online/tenchi2/

沿用本账号 `pal98-online` 的静态 GitHub Pages 部署方式，在独立 `tenchi2/` 子目录运行原版 FC ROM。中文网页界面，游戏仍是 1991 年日文原版。没有改动游戏数据，不依赖第三方运行时 CDN。

点击“开始游戏”后，按 Enter 或屏幕 START 进入原版标题菜单。方向键移动，X 为 A，Z 为 B，Ctrl 为 SELECT。支持触屏与 JSNES 默认游戏手柄映射。切换标签页暂停，返回后点继续。

完整模拟器状态存到 IndexedDB：每分钟自动保存，手动保存独立保留；“读取进度”读取手动和自动存档中较新的记录。导出/导入 JSON 可转移设备。存档只留在当前浏览器，不上传服务器；清除网站数据将删除存档，建议导出备份。离开页面的异步保存为尽力处理，重要进度请先手动保存。

## 原版与引擎

- ROM 来源：https://kongming.net/doae2/dl/doae2j.zip
- ROM：`doae2j.nes`，524304 字节，MMC3 / Mapper 4。
- SHA256：`2bc5970f8e2b6ddd0172e900b78d5234ed1919954cf00434a86ca18166a6f4bf`；浏览器加载前重新校验。
- PRG SHA1：`c002be9213e53221c247b38ba27f4cf6c9d15796`，CRC32 `CB32E243`，与 https://nesdir.github.io/CB32E243_Japan.html 记录相符。
- 完整原版归档、原扫描记录：https://github.com/kunruiw1991/games-download-original/releases/tag/tenchi2-japanese-original （私有库需要账号权限）。归档扫描未检出不能保证绝对无毒。
- 引擎：[JSNES](https://github.com/bfirsh/jsnes) 2.1.0，来自 npm 官方包；Apache 2.0 许可见 `LICENSE-jsnes.txt`。游戏版权属于原权利人。

## 验证

`node verify.mjs` 使用页面实际部署的 `jsnes.min.js`：校验 ROM、运行 843 帧、生成标题画面及音频采样、按 START、导出再恢复状态，并断言恢复后 60 帧的完整状态与原运行完全一致。结果见 `VERIFICATION.json`。这不是通关测试，也不代表在每种设备上都已验证。

本地可在仓库根目录运行 `python3 -m http.server 8080`，访问 `http://localhost:8080/tenchi2/`。浏览器 SHA256 和音频需要 HTTPS 或 localhost 安全环境。


### 2026-10-14 线上验证

GitHub Pages 部署成功。在 Chrome 中实际验证原版游戏启动、标题与剧情画面、屏幕 START、暂停继续、手动存档读取、刷新后存档保留，以及 JSON 存档实际下载。

`node verify-saves.mjs` 测试页面实际导出/导入处理函数和真实 NES 核心：导出的 JSON 能恢复 CPU 内存并保存，错误 ROM 校验值及超大文件被拒绝，当前进度保留。结果和验证范围见 `WEB_VERIFICATION.json`。

文件选择器自动化验证遇到工具超时，因此未完成浏览器内导入的全流程验证；也未在 M3 Safari 实机、触屏设备或真实手柄上测试。已实现这些控制方式，但不把实现当作实机验证。


## 中文汉化

网页现默认加载中文汉化；开始前可选日文原版。汉化补丁、来源、SHA256和适配说明见 [PATCH_README.md](./PATCH_README.md)。中文与日文存档分别保存，互不覆盖。日文原版文件未修改。
