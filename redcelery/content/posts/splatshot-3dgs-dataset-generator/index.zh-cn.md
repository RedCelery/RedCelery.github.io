---
weight: 5
title: 'SplatShot：3DGS 数据集生成插件（预发布）使用说明'
date: 2026-05-04T12:00:00+08:00
draft: false
author: "TheRedCelery"
description: "在 UE 中高画质多视角出图并导出训练数据，面向 3D 高斯溅射（3DGS）：可用于资产外观“烘焙”式表达，也可用于合成数据集构建。"
tags: ["UnrealEngine", "3DGS", "COLMAP", "SplatShot", "插件"]
categories: ["Unreal", "GaussianSplatting"]
images: ["/images/splatshot/cover-scene-overview.png"]
---

SplatShot 是一个面向 Unreal Editor 的采集工具。它做的事情很明确：在关卡里批量布置相机，用 Movie Render Queue 输出多视角图像，再把与图像对齐的相机参数和稀疏信息导出到训练侧常见的目录结构里，方便接入 PostShot 等 3DGS 管线。

这篇文档定位是实操说明。写作目标不是追求术语密度，而是把流程说清楚：为什么做、怎么做、每一步看哪里、哪里容易出错。若你的引擎版本或插件构建与文中有差异，欢迎反馈，我们一起把这条流程补完整。

<!--more-->

## 动机：为什么在 UE 里做 3DGS 采集

近两年 3DGS 很热，不只是论文热，它在资产表达层面也确实提供了一种新选项：在不少场景里，可以用较轻的渲染代价保留较丰富的外观信息。它未必替代传统网格和贴图流程，但已经足够值得放进内容生产和技术验证的工具箱里。

在 UE 侧，我们本来就会做高质量渲染：分部位材质、全局光照、阴影、必要时光追和更高采样。换句话说，很多团队已经具备了“高质量多视角监督信号”的生产条件。把这些信号用于 3DGS，可以把它理解成一种更通用的“外观烘焙”思路：把复杂着色结果迁移到另一种可渲染表示中。这个想法不神奇，但在工程上有现实价值，也有探索空间。

另一个实际用途是数据合成。对于 3DGS 相关生成式任务或下游网络训练，可控场景里的批量多视角样本很有用。SplatShot 的定位就是把“摆相机 - 渲染 - 导出”串成一条可复用流程，减少重复手工操作。

最后补一句工程便利：在 UE 里采集时，相机参数和渲染同源，可以直接导出，不需要再为这批帧单独走一次 SfM。文档里提到 COLMAP 只是因为训练侧生态比较成熟、兼容性好，不是要否定摄影测量本身。

## 先看一眼整体效果与流程

![视口内白色地面上的角色，周围为蓝色相机半球阵列](/images/splatshot/cover-scene-overview.png)

这张图是 SplatShot 的核心画面：主体放在中心，外围是程序化生成的多机位阵列。每个相机朝向目标，渲染时只变视角，不改变主体状态和灯光条件。后面所有步骤，本质上都是在把这个“可控多视角拍摄”流程落地。

![中性灰背景下高光白色人台，带分块线与深色关节细节](/images/splatshot/concept-3dgs-overview.png)

这张图对应采集目标的典型特征：高光、分块、局部细节。对于这类主体，是否采得好，通常取决于轨道覆盖和渲染设置是否充足。

![深色背景上白色线框视锥体组成朝向公共中心的半球壳层](/images/splatshot/workflow-diagram.png)

线框图展示的是“机位几何关系”：每个视锥对应一台相机，统一指向中心。它是流程理解图，不是 UI 截图。

![深色背景上由亮点构成的人体轮廓点云](/images/splatshot/ui-plugin-window-layout.png)

这张图是采样结果示意。图像序列负责外观监督，稀疏点信息由导出参数控制，用于训练初始化或校验。

## 插件做了什么（概要）

流程可以压缩成四句话：

1. 用模板网格自动摆相机（球、半球、胶囊、立方体、圆柱等，位于 `Plugins/SplatShot/ArrayShapes`）。
2. 生成 Level Sequence，把机位组织成可渲染序列。
3. 通过 Movie Render Queue 批量出图。
4. 导出与图像文件名对齐的相机与稀疏数据。

{{< admonition note "预发布范围" >}}
当前版本侧重离线渲染质量与基于文本的 COLMAP 式导出。二进制输出、额外渲染通道（如法线、深度）以及更复杂的摆镜方式仍在评估中，本文不将其列为已承诺功能。
{{< /admonition >}}

## 导出内容的意义

你将得到图像文件及与之对齐的文本：相机模型、各帧外参（及所编码的内参）、可选稀疏点等。相机参数与渲染同源，导出后仍建议核对坐标系、单位与训练入口的约定是否一致。

分辨率由 Movie Render Queue 决定；文中 1920×1080 或 800×800 仅便于截图阅读，在资源允许时可提高。面板主按钮对应常规顺序：生成相机 → 生成序列 → 送 MRQ → 导出相机信息 → 打开目录；若需自定义，可在 Sequencer 中插入手工步骤。

## 如何打开工具

启用插件后，打开随附的 Editor Utility Widget（名称因版本可能为 `EUW_CameraArraySetting` 等），建议停靠在视口旁。在 `Plugins/SplatShot` 下可浏览 `ArrayShapes`、`MovieRenderSettings`、`SceneEssentials` 与 Demo 关卡。

![自顶向下完整的 SplatShot 工具面板：多分区折叠与顶部动作按钮](/images/splatshot/editor-plugin-menu.png)

这张图就是主控面板全貌。你可以把它理解为“从上到下的一条流水线”：上方是动作按钮，下方是参数分区。后续步骤会按这个顺序往下走。

## 步骤一：指定目标与初始状态

打开 Demo 或自建关卡，展开工具。首先需要明确「重建谁」：在 Target Actors 中放入骨骼网格或静态网格实例，或按项目约定使用编辑器层批量收集。

![内容浏览器位于 Plugins/SplatShot，右侧工具里 Target Actors 为空、Camera Array Shape 为 None](/images/splatshot/ui-step-01-plugin-window.png)

此帧展示空白配置：Target Actors 数组元素数为 0，阵列形状未指定，Mesh to World 仍为默认瞄准与视场，Export Settings 中可见网格顶点去重采样模式与较大的采样计数占位，Render Settings 给出前缀 `frame`、序列名 `LS_CameraArray` 以及 1920×1080 输出尺寸。后续所有步骤都在此基础上填充。

## 步骤二：绑定主体与形状族

将场景中的模特（示例为 `SKM_Quinn_Simple`）加入 Target Actors，然后在 Camera Array Shape 中选择几何族。形状资源位于 `ArrayShapes/CentricShot`，下级文件夹包括 Capsule、Cube、Cylinder、Semi_Sphere、Sphere。

![Target Actors 已含 SKM_Quinn_Simple，标注指向 Camera Array Shape 下拉框](/images/splatshot/ui-step-02-orbit-tracks.png)

此时主体已锁定，但阵列形状尚未赋值；视口里若残留少量相机图标，可在重新生成后被新拓扑覆盖。下一步应从内容浏览器拖入具体模板网格。

## 步骤三：选择细分模板

相机数量与顶点分布直接由模板网格决定。先在 CentricShot 下选族，再打开对应文件夹挑选细分等级。

![路径 CentricShot，下列 Capsule、Cube、Cylinder、Semi_Sphere、Sphere 五个文件夹](/images/splatshot/ui-step-03-preview-single-track.png)

五个族对应不同包围习惯：全球、半球、竖直胶囊、盒状或柱状，可按场景地面、物体宽高比与是否需要底面视角来选。

![Sphere 文件夹内 ISO 与 UV 球多种细分缩略图，SM_ISOSphere_162 高亮](/images/splatshot/ui-step-03-preview-multi-tracks.png)

Icosphere（ISO）顶点分布更均匀；UV Sphere 经纬分段可控，便于加强「赤道」一带采样。低顶点版本用于快速试跑，高顶点版本用于最终数据集。若角色站在地面上，常用半球模板避免机位穿地。

## 步骤四：摆放阵列并生成相机

把选定静态网格赋给 Camera Array Shape，用 Mesh to World 提升或缩放阵列（示例中常见 Z 轴平移加均匀缩放），确认 Spawn Point Mode 为网格顶点且瞄准模式指向中心，然后执行 Generate Cameras。

![视口为蓝色半球相机壳，内容浏览器在 Semi_Sphere 下选中 SM_Semi_UV_Sphere，工具高亮 Mesh to World](/images/splatshot/ui-step-04-orbit-parameters.png)

视口右下角小窗显示某一生成相机的构图。中间 Details 可检查单个 `CameraActor_Vtx...` 的投影模式与视场角。内容浏览器路径表明当前使用半球 UV 球细分。

![选中 SM_UVSphere_32x16 后高亮 Generate Cameras](/images/splatshot/ui-step-04-parameters-configured.png)

赋值完整球体网格后，通过 Generate Cameras 在关卡中实例化与顶点数相当的相机 Actor。若阵列过密或穿模，应回到缩放、半球模板或 FOV 上调整；不宜仅依赖导出后改动图像尺寸来掩盖构图问题。

### 视口布局参考（无 UI）

![三层矩形环带相机围绕中央人台，旁有灯光与变换坐标轴](/images/splatshot/orbit-capture-example-01.png)

水平分层环带在肩高、腰高、近地高度上提供环绕采样，适合站姿角色与强调剪影轮廓的训练。

![竖直椭球状多层环带相机，网格地面与坐标轴可见](/images/splatshot/orbit-capture-example-02.png)

竖直拉长的分布强化从头到脚的俯仰变化，可与偏扁的球壳互为补充。

![近乎完整球壳包裹人台，地面网格与光源 gizmo 仍在场景内](/images/splatshot/orbit-capture-example-03.png)

全球适合浮空物体或允许底视的情况；若与地台相交，需裁剪顶点、改用半球，或提高地台以下阵列半径。

## 步骤五：写入 Level Sequence

点击 Generate LevelSequence 生成 `LS_CameraArray`（或你在 Render Settings 中改写的名字）。Sequencer 时间轴上会出现与相机数量一致的密集切分。

![视口大半球、工具高亮 Generate LevelSequence，内容浏览器选中 LS_CameraArray 资产](/images/splatshot/ui-step-05-create-level-sequence.png)

Details 里 CameraArray 实例显示数百个子项（例如 513），应与序列长度一致。Render Settings 中的 Target Level Sequence 槽位可指向该资产，供后续 MRQ 引用。

![底部 Sequencer 打开 LS_CameraArray，时间轴布满竖线标记；视口为俯视；工具绑定目标序列](/images/splatshot/ui-step-05-level-sequence-view-frame.png)

逐帧 scrub 检查构图、截断和地面穿帮。若个别机位不理想，可在 Sequencer 或阵列变换上微调后再渲染，避免导出后才发现废片。

## 步骤六：配置影片渲染管线预设

Send MRQ 之前，为 Render Settings 里的 MPPConfig 指定与多视图输出兼容的预设，示例工程使用 `MPPC_MultiViews_Color`。

![MPPConfig Color 指向 MPPC_MultiViews_Color，Img Size 800，目标序列已绑定](/images/splatshot/ui-step-06-movie-render-pipeline.png)

若训练端需要线性颜色或指定位深，应在 Movie Pipeline 预设里显式设置，而不是依赖视口显示曲线。

## 步骤七：入队、本机渲染与进度

Send MRQ 将作业送入影片渲染队列，输出路径与命名规则来自你在导出与渲染区的配置。

![工具高亮 Send MRQ，视口仍为围绕角色的相机穹顶](/images/splatshot/ui-step-07-sequence-as-render-target.png)

示意图强调在序列与预设就绪后转入队列阶段。

![影片渲染队列窗口中 Render_CameraArray 作业与右下角蓝色的 Render (Local)](/images/splatshot/ui-step-07-render-local-mrp.png)

本机渲染适合调试与小批量；农场分发需改由你们的执行器调度，但 SplatShot 只依赖引擎写出帧与一致的文件命名。

![Movie Pipeline Render 预览窗：513 帧中已完成 120，低质量预览显示人台，当前 Cut 对应 CameraActor_Vtx 编号](/images/splatshot/ui-step-07-rendering-in-progress.png)

进度界面给出已用时间、估计剩余、当前相机索引与预热帧状态，大批量高分辨率时耗时正常。

![文件浏览器式栅格：frame_0001、frame_0002… 多缩略图展示同一姿态下旋转视角](/images/splatshot/dataset-rendered-views-sample.png)

完成后应得到连续编号、固定光照与姿态、仅视点变化的帧序列；这是结构恢复希望从真实照片中间接求得的结构，在此处由元数据直接给定。

## 步骤八：导出 COLMAP 文本

图像落盘后，使用 Export Camera Info。示例对话框曾报告 513 行图像、513 个相机模型、输出目录 `.../bake/sparse/0`，并生成 `cameras.txt` 与 `images.txt`。

![中央弹窗显示 COLMAP export completed 及路径统计，右侧 Export Camera Info 被框选](/images/splatshot/ui-step-08-export-colmap-options.png)

请保持零填充宽度、分辨率与 `cameras.txt` 中内参一致；若只改图不改元数据，训练会很快以几何方式暴露错误。

![Export Settings 中 Sample Meshes 含 StaticMesh2，Sample Count 50000，输出目录指向工程 bake 文件夹](/images/splatshot/ui-step-08-static-mesh-export-settings.png)

稀疏点采样网格可与相机模板网格不同：你可以用另一份静态网格控制 `points3D` 密度，同时注意世界单位（虚幻常用厘米）与训练框架假设是否一致。

## 步骤九：在资源管理器中核对

点击 Open Directory 或手动进入输出根路径，确认图像子目录与 `sparse` 文本齐全。

![资源管理器列出的 cameras、images、point_cloud.ply、points3D 及文件大小](/images/splatshot/colmap-project-initialization.png)

该布局与许多训练入口兼容：相机模型文件、图像关联文件、可选 PLY 与稀疏点文本在同一批次生成，修改时间相邻说明导出是原子完成的。

![回到编辑器，工具上高亮 Open Directory 便于跳转](/images/splatshot/ui-step-09-output-folder-result.png)

第二张截图重复强调「导出后立刻验文件体积与数量」的操作习惯，再进入长时间 GPU 训练。

## 与 PostShot 等工具衔接

将输出目录导入 PostShot，或任何接受 COLMAP 式布局与 RGB 图像的训练流程。下图表示多视锥围绕主体的几何示意，并不对应某一软件的界面截图。

![线框人台脚下方坐标轴，周围白色视锥半球壳全部指向角色](/images/splatshot/postshot-colmap-training-import.png)

请查阅所使用工具对 world/camera 矩阵与四元数顺序的说明；即便 UE 内部数据自洽，约定错误仍可能导致无效训练。长时训练前，用少量帧做稀疏点投影校验，通常值得花费这点时间。

## 技术摘要

预发布版本以文本型 COLMAP 式导出与渲染图像为主。建议引擎版本为 Unreal Engine 5.3 及以上；对画质有要求时，以影片渲染队列为主要出图路径。

## 后续方向（不构成承诺）

正在考虑的路径包括：基于样条的相机轨迹、表面上更合理的采样密度，以及法线、深度等附加通道导出以支持辅助监督。此处所列均非固定产品承诺。

## 支持与联系

邮箱：[m2clarry@gmail.com](mailto:m2clarry@gmail.com)

文档或作品集链接：就绪后请在本段替换为你的公开 URL。

若本文与您的引擎版本或下游工具行为不一致，欢迎来信指出，便于持续修订，供后来者参考。
