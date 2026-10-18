# Astral3DEditor 功能参考与落地

日期：2026-10-18。

参考仓库：[withSmile/Astral3DEditor](https://github.com/withSmile/Astral3DEditor)。该仓库的 `LICENSE` 标记 Apache-2.0，`LEGAL.md` 另有商业授权条款。本次仅参考公开功能与模块分工，代码按本项目 React / R3F / Zustand 架构独立实现，没有复制其源码、素材或 UI。

## 模块与入口

| 功能 | 入口 | 实现 |
| --- | --- | --- |
| 测距、测角 | 检查器 → 测量 | `src/features/measure/` |
| 子网格选择、属性、聚焦、显隐 | 选择导入模型 → 对象 → 导入模型 → 子节点 | `src/features/scene/model/ModelHierarchyPanel.jsx` |
| 对象操作历史 | 检查器 → 历史 | `src/features/history/` |
| 运行时对象引用 | 内部基础模块 | `src/features/scene/sceneRegistry.js` |

## 测量

- 点击可见模型表面取世界坐标，两点测距离；三点测角度，中间点是角顶点。
- 拖动视口不计为选点；空白点击给出提示；重复点和无效向量不生成结果。
- 进入测量暂停变换手柄，仍允许 OrbitControls 操作。切换到变换工具、右键或点击“结束测量”退出；Esc 取消当前未完成的一组。
- 漫游期间不采样，启动漫游会退出测量。
- 默认显示场景单位；米、厘米、毫米按“1 场景单位 = 1 米”换算，面板明确提示模型比例前提。
- 最多保留 100 项会话测量，可逐项删除或清空。结果固定在采样世界坐标，不跟随模型后续运动，不进入项目导出或自动保存。

参考功能：[Measure.ts](https://github.com/withSmile/Astral3DEditor/blob/main/src/core/utils/Measure.ts)。本次实现距离和角度，不宣称包含面积测量、顶点吸附或 BIM 精度校准。

## 模型子节点

- 通过已有层级路径建立运行时索引，不把 Three 对象引用写入工程 JSON。
- 层级列表的选择与显隐操作分开，支持点击视口模型表面选中子网格。
- 橙色包围盒跟随节点运动；可查看类型、顶点/三角面数、世界包围盒尺寸、材质和附加属性，并聚焦子节点。
- 保留现有 `modelHiddenNodes` 序列化和导出契约。
- 列表沿用现有 80 节点限制；视口拾取和内部索引不受此列表限制。属性面板是选择时快照，包围盒在运行时更新。

参考功能：[Viewport.Selector.ts](https://github.com/withSmile/Astral3DEditor/blob/main/src/core/Viewport.Selector.ts)。当前实现普通模型节点检查，不包含 IFC ExpressID、RVT 转换服务或构件数据库。

## 历史

- 复用现有对象快照历史，显示添加、删除、重命名、移动、旋转、缩放等操作的摘要。
- 点击任意保留记录，通过已有 undo/redo 顺序恢复该状态；新编辑会清空未来分支。
- 对象历史统一限制到 40 步；启动恢复草稿不再产生虚假的历史条目。
- 目前不包含环境设置、UI 画布、粒子独立 store 的历史，不序列化历史记录。

## 验证

`node --test tests/*.test.js`：测量数学、重复/无效采样、单位换算、重复名称节点索引、历史跳转和启动恢复，加上原有相机与对象更新回归。

`npm run build`：生产构建。

后续可继续扩展：面积测量、节点搜索/虚拟列表、统一工程命令历史、Worker 中 BVH 构建、大场景资源分包。BIM/CAD 的服务转换和协作后端不在本轮范围内。
