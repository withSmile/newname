# GitHub 参考与本次补充

调研日期：2026-10-18。本次按现有 React / R3F / Zustand 数据模型自行实现，没有复制第三方项目源码，没有引入额外依赖。

## 参考项目

| 项目 | 参考价值 | 本项目采用情况 |
| --- | --- | --- |
| [mrdoob/three.js editor](https://github.com/mrdoob/three.js/tree/dev/editor) | 编辑器命令、变换提交、相机与选择控制 | 借鉴操作必须产生有效变化才提交的思路；完善选择工具与相机适配 |
| [pmndrs/react-three-editor](https://github.com/pmndrs/react-three-editor) | 与 R3F 结合、模块化工具和编辑状态 | 调研架构；未引入其代码回写管线 |
| [KolyaVol/threejs-editor](https://github.com/KolyaVol/threejs-editor) | 场景树右键菜单、重命名、复制和删除等工作流 | 实现匹配本项目 store 的独立右键菜单组件 |

官方 Three.js 的 [History.js](https://github.com/mrdoob/three.js/blob/dev/editor/js/History.js) 会处理撤销与重做及连续命令；[Viewport.js](https://github.com/mrdoob/three.js/blob/dev/editor/js/Viewport.js) 在变换开始/结束时收集状态并提交命令。本次没有将现有快照历史替换为完整命令系统。

许可证核查：Three.js 和 pmndrs/react-three-editor 的 LICENSE 均为 MIT；KolyaVol/threejs-editor README 声明 MIT，本次仅参考其公开功能描述，未复制源码。后续如果复制代码，应重新确认具体版本的许可证并保留相应版权声明。

## 已落地

Astral3DEditor 参考后的第二轮补充见 [ASTRAL_INSPIRED_TOOLS.md](ASTRAL_INSPIRED_TOOLS.md)：测量工具、模型子节点检查和可视化历史。

- 场景树右键操作：聚焦、重命名、复制、锁定/解锁、显隐、删除。
- 双击或 F2 重命名；Enter 提交、Escape 取消；支持撤销。
- 菜单支持方向键、Home、End、Escape 和 Shift+F10。
- 标准视图：自由、前、后、左、右、顶、底；沿用当前透视/正交投影模式。
- 查看全场景：仅计算可见对象边界，不包含网格等编辑器辅助对象。
- 相机适配同时考虑视口宽高比，窄视口也能完整容纳对象；支持正交缩放。
- Q 进入选择模式，不再误用移动工具；W/E/R 继续控制变换。
- 没有实际改变的对象更新不再占用撤销记录，也不会清空重做栈。

## 验证

运行 `node --test tests/editor-regressions.test.js` 与 `npm run build`。

后续候选：统一场景设置与对象的命令历史、多选与分组、资源拖拽导入。它们需要同步考虑工程序列化、运行时引用、物理控制权和导出格式，本次不做局部拼接。
