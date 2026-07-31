# FRAME 编辑器项目结构设计

## 目标

FRAME 最终由三维场景编辑、UI 页面编辑、资源管理、交互编排和项目导出组成。目录按业务能力拆分，每个 feature 同时拥有自己的组件、运行时、状态与样式，避免继续扩展单体 `App.jsx`。

## 目标目录

```text
src/
  app/                         # 应用入口、工作区布局、路由和全局 Provider
    App.jsx
    Workspace.jsx
  core/                        # 与具体业务无关的编辑器内核
    commands/                  # 撤销、重做、复制、删除命令
    persistence/               # 自动保存、工程序列化与版本迁移
    selection/                 # 选择集和对象引用注册表
  features/
    scene/                     # Three 场景、对象、材质、灯光、环境和相机
      components/
      runtime/
      store/
    postprocessing/            # 后期效果栈与独立参数面板
    interaction/               # 交互操作
      roaming/                 # 自动/手动漫游、路径、BVH 碰撞
      events/                  # 点击、悬停、触发器和动作编排
    animation/                 # 对象动画轨道、编辑面板与 Three.js 运行时
    physics/                   # Rapier 刚体、碰撞、关节、物理动画与调试运行时
    ui-editor/                 # 后续二维 UI 页面编辑
      canvas/                  # UI 画布、缩放和对齐
      components/              # 文本、图片、按钮、容器等控件
      inspector/               # UI 属性检查器
      runtime/                 # UI 与三维场景的运行时绑定
    assets/                    # 模型、纹理、字体和媒体资源管理
    export/                    # 工程预检、代码生成和打包
  shared/
    components/                # RangeSetting、ToggleRow、IconButton 等通用控件
    hooks/
    math/
    styles/                    # tokens、layout、controls
  main.jsx
```

## 模块边界

| 模块 | 负责 | 不负责 |
| --- | --- | --- |
| `scene` | Three 对象、材质、灯光、环境、相机 | UI 页面节点、业务交互流程 |
| `postprocessing` | EffectComposer 和效果参数 | 场景灯光、漫游控制 |
| `interaction` | 漫游、碰撞、事件和动作 | 几何体编辑、UI 排版 |
| `animation` | 程序化轨道、关键帧、模型 AnimationClip 混合 | 刚体求解和碰撞响应 |
| `physics` | Rapier 刚体、碰撞体、冲量、关节与碰撞事件 | 时间轴关键帧和模型骨骼动画 |
| `ui-editor` | 二维 UI 节点、布局、样式、三维绑定 | Three 网格和材质实现 |
| `assets` | 文件导入、解析、缓存、引用 | 画布渲染 |
| `export` | 校验、序列化、模板和打包 | 编辑器运行时状态 |

## 状态原则

1. 工程数据和临时运行状态分开。路径点属于工程数据，按键状态、指针锁和当前速度属于运行状态。
2. Feature 只订阅所需字段，并使用浅比较，禁止订阅临时对象字面量造成循环更新。
3. 跨模块通过稳定契约通信，例如对象引用注册表、命令总线和序列化 schema，不直接读取其他面板内部状态。
4. 工程格式必须带 `version`，新增 UI 页面和交互配置时通过迁移函数兼容旧工程。

## 动画与物理动画

动画模块分为三层：程序化效果用于持续旋转、浮动、呼吸和闪烁；`KeyframeTrack` 用于门、活塞、摆锤等可编辑时间轴；导入模型的 `AnimationClip` 由 `AnimationMixer` / `AnimationAction` 控制片段、速度、循环、权重和淡入淡出。案例预设只追加轨道，不覆盖已有动画。

物理模块使用 Rapier，并通过动态导入隔离体积较大的 WASM 运行时。对象工程数据保存刚体、碰撞体、CCD、轴锁、重力倍率与关节参数，世界、事件队列、刚体句柄和当前速度只存在运行时。物理动画覆盖以下场景：

- 冲量与扭矩：弹跳、受击、抛掷、旋转启动。
- RevoluteJoint：门轴、阀门、摆锤。
- PrismaticJoint：活塞、滑台、升降机构。
- Rope / Spring：吊装限长、悬挂和缓冲。
- CollisionEvents / Sensor：碰撞反馈、进入区域和 UI 告警绑定。

同一对象的控制权必须唯一：动态刚体由 Rapier 写入变换；运动学刚体由动画写入目标变换、Rapier 参与碰撞；固定刚体只提供碰撞与传感。后续动作编排通过物理命令总线发送冲量、马达目标和重置指令，不直接持有 Rapier 句柄。

## 漫游模块设计

### 自动漫游

- 路径：`THREE.CatmullRomCurve3`
- 路径点：位置三元组，可添加、删除、逐轴编辑
- 参数：速度、循环、曲线张力、视线前瞻距离
- 运行：播放、暂停、停止；停止后恢复编辑器相机控制
- 可视化：编辑状态下显示路径曲线和路径点

### 手动漫游

- 输入：WASD 移动、鼠标视角、Shift 加速、Esc 退出
- 人物体积：半径与眼高参数
- 碰撞：`three-mesh-bvh` 加速射线查询，前向阻挡并向下检测地面
- 相机：第一人称相机；进入漫游时关闭 OrbitControls，退出时恢复
- 安全：掉出场景最低高度后回到出生点

### 后续演进

- 将射线碰撞升级为胶囊体 `shapecast`，改善楼梯、斜坡和窄门体验。
- 路径点增加停留时间、注视目标、缓动曲线和事件触发器。
- 漫游路径进入时间轴，并允许 UI 按钮触发播放、暂停和跳转。
- BVH 在 Web Worker 中异步构建，大模型加载时显示构建进度。

## 渐进迁移顺序

1. 漫游模块先按目标结构落地。
2. 拆出共享 Inspector 控件和样式 tokens。
3. 拆出 Scene、PostProcessing、Assets 和 Export。
4. 将现有 store 拆成工程 slice、编辑器 slice 与运行时 slice。
5. 建立 `ui-editor` 页面数据 schema 后开始二维 UI 编辑功能。

## UI 编辑工作区

UI 编辑器与三维场景是同一项目下的平级工作区，通过顶部 `3D 场景 / UI 画布` 模式切换，不占用三维检查器页签。

```text
UI workspace
  pages[]                  # 页面、画板尺寸和响应式断点
    nodes[]                # 文本、图片、按钮、容器和业务组件
      layout               # x、y、width、height、约束和自动布局
      appearance           # 颜色、字体、边框、阴影和透明度
      bindings             # Three 对象、变量、事件和动作绑定
  assets[]                 # 图片、字体、图标和组件资源
  activePageId             # 工程状态
```

工作区采用一致的三栏结构：左侧管理页面、图层和组件，中间提供画板、标尺、缩放与对齐，右侧仅编辑 UI 节点属性。当前骨架先覆盖图层选择、基础组件添加、位置尺寸、文本和颜色，后续扩展拖拽缩放、对齐吸附、响应式约束、组件状态和三维事件绑定。
