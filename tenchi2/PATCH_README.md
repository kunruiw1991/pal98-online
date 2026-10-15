# 《吞食天地Ⅱ》中文汉化补丁

下载：[zh-hans.ips](./zh-hans.ips) · [直接玩中文版](https://kunruiw1991.github.io/pal98-online/tenchi2/) · [日文版](https://kunruiw1991.github.io/pal98-online/tenchi2/?lang=ja)

汉化来源：同能网中文版，取自 [champyen/sango2_tc_patch](https://github.com/champyen/sango2_tc_patch) 内的 `sango2_chs.nes`，固定源文件提交 `cee31b411adf86fec6ee65e031720742db31adcd`。本 IPS 是将该公开汉化 ROM 与我们已归档的日文原版比较后生成的二进制差分，不是声称作者发布过这份 IPS。字体、对白与汉化归原汉化作者；未新增翻译。字形可能有简繁混用。

## 应用方法

在支持 IPS 的补丁工具中，选原版 `doae2j.nes` 为输入，再选 `zh-hans.ips`，另存中文 ROM。工具须支持 IPS 扩容；结果应为 **655376 字节**。不要覆盖唯一的原版备份。

| 文件 | SHA256 |
|---|---|
| 适用日文 ROM（524304 字节） | `2bc5970f8e2b6ddd0172e900b78d5234ed1919954cf00434a86ca18166a6f4bf` |
| IPS 补丁（191131 字节） | `665ad3baeecf4c8fdcbe3f7e96560e70a740c621e5ea60c59353893c0be2e259` |
| 应用后中文 ROM（655376 字节） | `92e96a551a1b07cfb4b72852a2a23f52618e254f63a7b0aad5188a347cbfe66e` |

网页自动加载原版、应用 IPS，并校验以上原版和汉化结果的 SHA256。默认中文，开始前可选日文。**中日版存档独立，不能互相导入。**

## 模拟器兼容与验证

这个中文版本在 `$5000–$5FFF` 使用 4 KiB 扩展工作 RAM。JSNES 2.1.0 默认把该区域读作 open bus，会在进入游戏时崩溃。网页通过仅对这份汉化 ROM 启用的 `enableTranslationRam` 适配读行为；不改 ROM 字节。参考 FCEUX 官方源码 `src/boards/mmc3.cpp` 的 `M195Power` / `Mapper198_Init`。原作者推荐 FCEUX/FCEUmm，其他模拟器的兼容性请以实际运行为准。

运行 `node verify-zh.mjs`：用网页实际 IPS 读取函数从原版生成中文 ROM，核对目标 SHA256，运行标题、START 后菜单等共 4443 帧，生成音频，并确认恢复存档后 60 帧完整状态一致。结果见 `CHINESE_VERIFICATION.json`。未完成通关测试，也未在 M3 Safari 实机验证。
