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

SplatShot 是一个面向 Unreal Editor 的采集工具。目标很直接：在关卡里批量布置相机，用 Movie Render Queue 输出多视角图像，再把与图像对齐的相机参数和稀疏信息导出到 3DGS 训练侧常见的目录结构里，方便接入 PostShot 等管线。

这篇文档是实操说明，不展开数学与名词堆砌，而是把流程讲清楚：为什么做、怎么做、各步骤要点、以及容易踩坑的地方。若你的引擎版本或插件构建与文中有出入，欢迎反馈，我们一起把这条流程补完整。

<!--more-->

## 为什么在 UE 里做 3DGS 采集？

近两年 3DGS 很火热，不只是论文热，在资产表达上也多了一种选择：不少场景里可以用相对轻的渲染代价（用高斯点统一表征不同材质的外观）保留较丰富的外观信息。它不能替代传统网格与贴图流程，但已经值得纳入一部分内容生产。

在 UE 里我们本来就会追求高画质：分部件材质、全局光照、阴影、必要时光追等，每一项都会给性能带来压力。为保证帧率，往往还要对高分辨率资产做减面一类处理，同样费工。对 3DGS 而言，可以把它看成一种更通用的外观烘焙：把复杂着色结果迁到另一种可渲染表示里。乍听有些朴素，但在工程上仍有现实价值与探索空间。

另一个实际用途是数据合成。对于 3DGS 相关生成式任务或下游网络训练，可控场景里的批量多视角样本很有用。SplatShot 的定位就是把“摆相机 - 渲染 - 导出”串成一条可复用流程，减少重复手工操作。

最后补充一条工程上的便利：在 UE 里采集时，相机参数与渲染同源，所以相机内参外参是真值，可直接导出，不必再为这批帧单独跑一遍 SfM；还能在物体表面采样做点云初始化等，让 3DGS 训练更稳、效果更好。

## 效果展示

![视口内白色地面上的角色，周围为蓝色相机半球阵列](/images/splatshot/cover-scene-overview.png)

这张图是 SplatShot 的核心画面，可以把被拍照的对象放在中心，外围使用程序化生成多机位阵列。每个相机都朝向目标，渲染时只变视角，不改变主体状态和灯光条件，这样来完成对被拍照对象多视角图像的采集。

![深色背景上白色线框视锥体组成朝向公共中心的半球壳层](/images/splatshot/workflow-diagram.png)

按照后文的采集流程，就可以导出如图所示的且符合Colmap格式的相机矩阵格式，图中每个线框表示一个相机，这里我使用一个半球相机矩阵作为样例。

![深色背景上由亮点构成的人体轮廓点云](/images/splatshot/ui-plugin-window-layout.png)

上图是在被拍摄对象表面均匀采样的稀疏3d点云示意图，可用于后续3dgs训练的初始化，由于我们知道拍摄物体的真实Mesh，一切都变的简单起来。

![中性灰背景下高光白色人台，带分块线与深色关节细节](/images/splatshot/concept-3dgs-overview.png)

最后，这是我使用SplatShot工具导出的多视角图片集、相机数据、初始化稀疏点云，重建的3dgs模型，看起来和Unreal中的效果没有很大差别！

## 流程概览

流程可以压缩成四句话：

1. 用预置的网格体模板自动生成相机矩阵（如球、半球、胶囊、立方体、圆柱等，位于 `Plugins/SplatShot/ArrayShapes`）。
2. 生成 Level Sequence，把机位组织成可渲染序列。
3. 通过 Movie Render Queue 批量出图。
4. 导出与图像文件名对齐的相机与稀疏3d点云数据。

{{< admonition note "预发布范围" >}}
当前版本侧重离线渲染质量与基于文本的 COLMAP 式导出。额外渲染通道（如法线、深度）的导出以及自由度更高的相机矩阵生成方法可能会在后续的更新里补上。
{{< /admonition >}}

## 工具输出清单

1. 被拍摄对象的多视角图片集；
2. 符合Colmap格式的相机矩阵信息、多视角图片信息与稀疏点云；

面板主按钮对应常规顺序：生成相机 → 生成序列 → 送 MRQ → 导出相机信息 → 打开目录查看结果。

## 工具使用流程

在Unreal中启用SplatShot插件后，打开插件中的 Editor Utility Widget，建议停靠在视口旁。在 `Plugins/SplatShot` 下可浏览 `ArrayShapes`、`MovieRenderSettings`、`SceneEssentials` 等文件夹与 Demo 关卡。

![自顶向下完整的 SplatShot 工具面板：多分区折叠与顶部动作按钮](/images/splatshot/editor-plugin-menu.png)

这张图是主控面板全貌，你可以把它理解为“从上到下的一条流水线”：上方是动作按钮，下方是参数分区。后续步骤我们会按这个顺序往下走。

## 步骤一：指定目标与初始状态

打开 Demo 或自建关卡，展开工具。首先需要明确被拍摄对象：在 Target Actors 中放入静态网格实例，你可以加入多个静态网格实例。

![内容浏览器位于 Plugins/SplatShot，右侧工具里 Target Actors 为空、Camera Array Shape 为 None](/images/splatshot/ui-step-01-plugin-window.png)

## 步骤二：绑定主体与形状族

将场景中的模特（示例为 `SKM_Quinn_Simple`）加入 Target Actors，然后在 Camera Array Shape 中选择预置的网格体。相机居中形状资源位于 插件中`ArrayShapes`文件夹内，下级文件夹包括 Capsule、Cube、Cylinder、Semi_Sphere、Sphere等常用的相机矩阵形状。

![Target Actors 已含 SKM_Quinn_Simple，标注指向 Camera Array Shape 下拉框](/images/splatshot/ui-step-02-orbit-tracks.png)

相机数量与顶点分布直接由模板网格决定。先在 CentricShot 下选择你想要的相机矩阵形状。

![路径 CentricShot，下列 Capsule、Cube、Cylinder、Semi_Sphere、Sphere 五个文件夹](/images/splatshot/ui-step-03-preview-single-track.png)

以 `ArrayShapes/CenterShot`文件夹为例，五组对应不同包围习惯：全球、半球、竖直胶囊、盒状或柱状，可按场景地面、物体宽高比与是否需要底面视角来选。

![Sphere 文件夹内 ISO 与 UV 球多种细分缩略图，SM_ISOSphere_162 高亮](/images/splatshot/ui-step-03-preview-multi-tracks.png)

以球形相机矩阵为例，一般来说Icosphere（ISO）顶点分布更均匀；UV Sphere 经纬分段可控，便于加强「赤道」一带采样。低顶点版本用于快速试跑，高顶点版本用于最终数据集。

## 步骤三：摆放阵列并生成相机

把选定静态网格赋给 Camera Array Shape，用 Mesh to World 提升或缩放阵列（示例中常见 Z 轴平移加均匀缩放），确认 Spawn Point Mode 为网格顶点且瞄准模式指向中心，然后执行 Generate Cameras。如果你想自定义相机矩阵的配置，可以使用不同的Spawn Point Mode，如使用从相机矩阵网格体的每个三角形中心生成，瞄准模式可以使用其他的瞄准模式，如相机朝向法向量方向或者切向量方向等，如果你对相机的Fov与成像分辨率不满意，可以在菜单中自由调节，点击重新生成即可。

![视口为蓝色半球相机壳，内容浏览器在 Semi_Sphere 下选中 SM_Semi_UV_Sphere，工具高亮 Mesh to World](/images/splatshot/ui-step-04-orbit-parameters.png)

赋值相机矩阵网格后，通过 Generate Cameras 在关卡中实例化与顶点数相当的相机 Actor。

![选中 SM_UVSphere_32x16 后高亮 Generate Cameras](/images/splatshot/ui-step-04-parameters-configured.png)

### 视口布局参考
以下是常用几种相机布局的示意图：
1. 水平分层环带在肩高、腰高、近地高度上提供环绕采样。
![三层矩形环带相机围绕中央人台，旁有灯光与变换坐标轴](/images/splatshot/orbit-capture-example-01.png)

2. 竖直拉长的分布强化从头到脚的俯仰变化。
![竖直椭球状多层环带相机，网格地面与坐标轴可见](/images/splatshot/orbit-capture-example-02.png)

3. 全球适合浮空物体或允许底视的情况。
![近乎完整球壳包裹人台，地面网格与光源 gizmo 仍在场景内](/images/splatshot/orbit-capture-example-03.png)

你可以自己尝试不同的相机矩阵预置形状，看哪个适合你的应用场景。

## 步骤四：写入 Level Sequence

点击 Generate LevelSequence 生成 `LS_CameraArray`（或你可以在 Render Settings 中改写名字）。Sequencer 时间轴上会出现与相机数量一致的密集切分。

![视口大半球、工具高亮 Generate LevelSequence，内容浏览器选中 LS_CameraArray 资产](/images/splatshot/ui-step-05-create-level-sequence.png)

Details 里 CameraArray 实例显示数百个子项（例如 513），应与序列长度一致。Render Settings 中的 Target Level Sequence 槽位可指向该资产，供后续 MRQ 引用。

![底部 Sequencer 打开 LS_CameraArray，时间轴布满竖线标记；视口为俯视；工具绑定目标序列](/images/splatshot/ui-step-05-level-sequence-view-frame.png)

逐帧检查构图、截断和地面穿帮。若个别机位不理想，可在 Sequencer 或阵列变换上微调后再渲染，避免导出后才发现废片。

## 步骤五：配置影片渲染管线预设

Send MRQ 之前，为 Render Settings 里的 MPPConfig 指定与多视图输出兼容的预设，示例工程使用 `MPPC_MultiViews_Color`。

![MPPConfig Color 指向 MPPC_MultiViews_Color，Img Size 800，目标序列已绑定](/images/splatshot/ui-step-06-movie-render-pipeline.png)

这个配置文件会设置渲染的多视图图片为带透明通道的png图片。

## 步骤六：入队、本机渲染与进度

先填写 Output Directory 来设置你希望把多视图图片保存在磁盘的地址，然后 Send MRQ 将作业送入影片渲染队列，输出路径与命名规则来自你在导出与渲染区的配置。

![工具高亮 Send MRQ，视口仍为围绕角色的相机穹顶](/images/splatshot/ui-step-07-sequence-as-render-target.png)

在序列与预设就绪后就可以转入队列阶段了。

![影片渲染队列窗口中 Render_CameraArray 作业与右下角蓝色的 Render (Local)](/images/splatshot/ui-step-07-render-local-mrp.png)

点击Render Local按钮就可以在本机上开始渲染多视图图片了。

![Movie Pipeline Render 预览窗：513 帧中已完成 120，低质量预览显示人台，当前 Cut 对应 CameraActor_Vtx 编号](/images/splatshot/ui-step-07-rendering-in-progress.png)

进度界面给出已用时间、估计剩余、当前相机索引与预热帧状态，大批量高分辨率时耗时正常，通常需要等待一会，经验来看400-500张图一般来说是比较理想的3dgs训练图片集大小，大约进行渲染5-10分钟。

![文件浏览器式栅格：frame_0001、frame_0002… 多缩略图展示同一姿态下旋转视角](/images/splatshot/dataset-rendered-views-sample.png)

完成后你应该可以得到连续编号的、多视图的帧序，这里的图片会默认只渲染被拍照的对象，自动过滤掉背景等其他物体，所以不同担心相机被其他物品遮挡。

## 步骤七：导出 COLMAP 文本

图像渲染完成后，使用 Export Camera Info按钮，导出相机参数信息 `cameras.txt` 与图像参数信息 `images.txt`到目录 `.../sparse/0`中。

![中央弹窗显示 COLMAP export completed 及路径统计，右侧 Export Camera Info 被框选](/images/splatshot/ui-step-08-export-colmap-options.png)

如果你需要稀疏3d点云，你可以额外设置采样网格，一般来说，采样网格使用被拍摄的对象即可，或者你也可以用另一份静态网格来自由控制 `points3D` 密度。

![Export Settings 中 Sample Meshes 含 StaticMesh2，Sample Count 50000，输出目录指向工程 bake 文件夹](/images/splatshot/ui-step-08-static-mesh-export-settings.png)


## 步骤八：在资源管理器中核对

点击 Open Directory 按钮，确认图像子目录与 `sparse` 文本齐全。

![回到编辑器，工具上高亮 Open Directory 便于跳转](/images/splatshot/ui-step-09-output-folder-result.png)


在打开的文件夹中可以查看生成的多视图图集和对应colmap格式的初始化所需的文件：如cameras、images、point_cloud.ply、points3D等。

![资源管理器列出的 cameras、images、point_cloud.ply、points3D 及文件大小](/images/splatshot/colmap-project-initialization.png)
## 与其他训练工具衔接

将输出目录导入任何接受 COLMAP 式布局与 RGBA 图像的训练工具，如PostShot等，你就可以开始训练3dgs。

![线框人台脚下方坐标轴，周围白色视锥半球壳全部指向角色](/images/splatshot/postshot-colmap-training-import.png)


## 技术摘要

预发布版本以文本型 COLMAP 式导出与渲染图像为主。建议引擎版本为 Unreal Engine 5.3 及以上；对画质有要求时，以影片渲染队列为主要出图路径。

## 后续方向

正在考虑后续的更新包括：
1. 基于样条的相机轨迹、表面上更合理的采样密度，
2. 法线、深度等附加通道导出以支持辅助监督。

此处所列均非固定产品承诺。

## 支持与联系

邮箱：[m2clarry@gmail.com](mailto:m2clarry@gmail.com)

若本文与您的引擎版本或下游工具行为不一致，欢迎指出，便于持续修订，感谢。
