---
weight: 5
title: 'SplatShot: 3DGS Dataset Generator (Pre-release) — User Guide'
date: 2026-05-04T12:00:00+08:00
draft: false
author: "TheRedCelery"
description: "Unreal Engine tool for multi-view, high-quality captures and training exports for 3D Gaussian Splatting: baking-style appearance, synthetic datasets, and engine-native camera parameters."
tags: ["UnrealEngine", "3DGS", "COLMAP", "SplatShot", "Plugin"]
categories: ["Unreal", "GaussianSplatting"]
images: ["/images/splatshot/cover-scene-overview.png"]
---

SplatShot is an Unreal Editor capture utility with a straightforward goal: place many cameras in a level, render multi-view frames through Movie Render Queue, and export camera parameters and sparse sidecar data in a layout common to 3DGS training stacks (often COLMAP-oriented text) so tools like PostShot can ingest images and metadata without one-off glue code.

This guide is practical: it does not rehearse the math or terminology for its own sake, but explains the workflow—why, how, step-by-step notes, and common pitfalls. If your engine build or plugin revision differs from what we describe, feedback is welcome so we can keep the path accurate.

<!--more-->

## Motivation: 3DGS, Unreal, and what this tool is for

3D Gaussian Splatting (3DGS) has been in the spotlight lately—not only in papers but also as a new option for how we *represent* assets: in many settings you can pay a relatively light rendering cost (Gaussians as a unified way to carry appearance across materials) while keeping rich visual detail. It does not replace meshes and textures end-to-end, but it is already worth folding into parts of a production pipeline.

Inside Unreal you already push for high quality—per-part materials, global illumination, shadows, path tracing when you need reference-grade frames—and each of these strains performance. To stay within budget you often decimate high-resolution assets or otherwise simplify, which is its own chore. For 3DGS, a useful mental model is broader **appearance baking**: move complex shading into another renderable representation. That framing sounds almost naive, yet it still has real engineering upside and room to explore.

A second use case is **synthetic data**: controlled scenes make large multi-view batches valuable for generative 3DGS work or downstream training. SplatShot strings “place cameras → render → export” into one repeatable path and cuts repetitive manual work.

One more engineering convenience: when you capture in-engine, camera parameters and pixels share the same source, so you can export them directly and skip structure-from-motion *just to recover poses for those frames*. Intrinsics and extrinsics are ground truth; you can also sample on object surfaces to seed a sparse point cloud and help training converge more reliably.

## What the plugin does, in outline

Operationally the steps are straightforward: camera actors are placed using static mesh templates (spheres, hemispheres, capsules, boxes, cylinders under `Plugins/SplatShot/ArrayShapes`), commonly one camera per template vertex, aimed at the subject; a Level Sequence is generated; Movie Render Queue produces the images; finally, camera metadata is exported so filenames and poses stay aligned.

{{< admonition note "Pre-release scope" >}}
The current build emphasizes offline rendering quality and text-based COLMAP-oriented export. Binary COLMAP output, additional render passes (e.g. normals and depth), and richer placement modes are under consideration but not committed here.
{{< /admonition >}}

![Viewport with a hemispherical blue camera dome around a posed mannequin on a neutral stage](/images/splatshot/cover-scene-overview.png)

The screenshot shows the Demo-style setup many users start from: a white ground plane, a posed mannequin as the subject, and a dense hemisphere of standard Camera Actor icons in blue. Each icon is oriented toward the character so that, once rendered, every frame shares the same lighting and pose while varying only viewpoint. Small square control icons near the rig are part of the plugin’s in-level helpers. This is the spatial idea SplatShot automates: many known cameras instead of one handheld path.

## Concept and pipeline figures

![Studio render of a white mannequin with panel lines and dark joint accents on a neutral backdrop](/images/splatshot/concept-3dgs-overview.png)

The figure illustrates a subject with specular detail and structured panels: coverage, materials, GI, and sampling choices in the level still dominate how informative the supervision is, regardless of capture toolchain.

![White wireframe camera frustums forming a dome, all axes aimed at a common center](/images/splatshot/workflow-diagram.png)

Each frustum corresponds to one camera on the template. Transforms come from the engine; the export follows COLMAP-style conventions so existing tools can ingest the bundle without a bespoke UE reader. Always verify matrix handedness and quaternion ordering against your trainer’s documentation once per toolchain.

![Point-cloud style visualization of a humanoid: dense white samples on dark gray](/images/splatshot/ui-plugin-window-layout.png)

This is not a screenshot of the widget: it illustrates mesh-derived samples used for sparse geometry. RGB comes from Movie Render Queue; export settings control how points populate `points3D` or companion PLY files, subject to your trainer’s expectations for initialization.

## What the export provides

You receive image files and matching text: camera models, per-frame extrinsics (and intrinsics as encoded), and optional sparse points when enabled. Poses are tied to the same engine transforms used for rendering; still verify coordinate handedness, units, and trainer expectations after export.

Resolution follows your Movie Render Queue configuration. Examples in this document use 1920×1080 or 800×800 for legibility in screenshots; higher resolutions are appropriate when your budget allows. The primary buttons on the widget implement the usual order: generate cameras, build the sequence, send to MRQ, export camera info, then open the output directory; advanced users may insert manual Sequencer edits between steps.

## Opening the tool

The interface is an Editor Utility Widget bundled with the plugin (e.g. `EUW_CameraArraySetting`, exact names may vary by build). After enabling SplatShot, dock the panel beside the viewport and inspect `Plugins/SplatShot` for `ArrayShapes`, `MovieRenderSettings`, `SceneEssentials`, and the Demo level.

![Full-height view of the SplatShot Editor Utility Widget: action row plus Camera Array, Mesh to World, Export, and Render sections](/images/splatshot/editor-plugin-menu.png)

Despite the asset filename, the capture shows the full panel. The top row lists Generate Cameras, Generate LevelSequence, Send MRQ, Export Camera Info, Clear All, and Open Directory. Lower sections cover targets, array shape, rig transform, export paths, resolution, and MRQ presets—compare against your project if labels differ slightly across versions.

## Step 1 — Target and initial widget state

Open the Demo level or your own map, then open the widget. Start by assigning what should be reconstructed: either populate Target Actors with explicit meshes or use the editor layer workflow if your project sets that up.

![Editor with viewport, Content Browser on Plugins/SplatShot, and widget showing Target Actors empty and Camera Array Shape unset](/images/splatshot/ui-step-01-plugin-window.png)

In this frame the Content Browser path is `All / Plugins / SplatShot`, showing folders such as ArrayShapes, ConsoleSettings, MovieRenderSettings, SceneEssentials, plus the Demo level and the EUW asset. The widget’s Camera Array section highlights that Target Actors currently has zero entries and Camera Array Shape is None. Mesh to World still shows default aim and FOV, Export Settings lists sample mode and a large sample count placeholder, and Render Settings shows a 1920×1080 image size with prefix `frame` and sequence name `LS_CameraArray`. Treat this as the blank-slate step before you wire a subject.

## Step 2 — Pick the subject and array shape family

Add your skeletal mesh or static mesh to Target Actors, then choose which geometric family will carry camera sites. Shapes live under `ArrayShapes/CentricShot` with folders Capsule, Cube, Cylinder, Semi_Sphere, and Sphere.

![Widget with Target Actors listing SKM_Quinn_Simple and annotation pointing at Camera Array Shape selector](/images/splatshot/ui-step-02-orbit-tracks.png)

Here the mannequin is the capture target. Camera Array Shape is still unset in the dropdown; the next action is to pick one of the template meshes so the plugin knows where vertices lie in space. The viewport already shows a few camera gizmos from earlier trials—after you assign the shape and regenerate, the rig will fill in to match the template’s topology.

The plugin’s sampling density is tied to the mesh you pick. Under CentricShot you first choose a primitive family, then a tessellation.

![Content Browser path ending in CentricShot with folders Capsule, Cube, Cylinder, Semi_Sphere, Sphere](/images/splatshot/ui-step-03-preview-single-track.png)

This view lists the five shape categories. Each opens to static meshes with different vertex counts; coarser meshes mean fewer cameras and faster iteration, finer meshes mean smoother angular sampling at the cost of render time and disk.

![Content Browser inside Sphere showing SM_ISOSphere_42 through SM_UVSphere_32x16 thumbnails](/images/splatshot/ui-step-03-preview-multi-tracks.png)

Icospheres (ISO) distribute vertices more uniformly on the ball; UV spheres concentrate quads along meridians. Semi-spheres save views below the ground plane when your subject sits on a floor and you do not need bottom hemispheres. Pick based on coverage goals, not only triangle count.

## Step 3 — Position the rig and generate cameras

Assign the chosen static mesh to Camera Array Shape, adjust Mesh to World (translation lifts the dome off the floor, uniform scale grows radius), then spawn.

![Viewport hemispherical blue rig, Content Browser on Semi_Sphere with SM_Semi_UV_Sphere selected, widget Mesh to World highlighted](/images/splatshot/ui-step-04-orbit-parameters.png)

The viewport shows a hemispherical shell of cameras with a picture-in-picture from one camera. The Content Browser is under `.../CentricShot/Semi_Sphere` with a semi-UV sphere mesh highlighted. The widget uses Look At Center, FOV 60, Spawn Point Mode on mesh vertices. Details for a spawned `CameraActor_Vtx...` confirm standard perspective settings you can tweak per actor if needed.

![Same workflow after assigning SM_UVSphere_32x16 with Generate Cameras callout](/images/splatshot/ui-step-04-parameters-configured.png)

After selecting `SM_UVSphere_32x16` from the Sphere folder, the user triggers Generate Cameras. Target Actors still lists the mannequin; the array shape thumbnail updates. This is the moment the level fills with one camera per vertex.

### Viewport-only layout references

![Three stacked rectangular rings of blue cameras around a central mannequin, plus a light with gizmo](/images/splatshot/orbit-capture-example-01.png)

Tiered rings give strong horizontal coverage at several heights—useful when limbs extend sideways and you want elevation diversity without a full sphere.

![Vertical capsule-like stack of camera rings on a grid floor, all facing inward](/images/splatshot/orbit-capture-example-02.png)

A capsule or tall ellipsoid pattern emphasizes head-to-toe sampling; compare against a tight sphere if your asset is wider than tall.

![Near-complete sphere of cameras enclosing the mannequin](/images/splatshot/orbit-capture-example-03.png)

Full spheres are appropriate for floating props or when bottom views are acceptable. Remember ground intersection: cameras inside the floor may need to be culled or replaced with a semi-sphere template.

## Step 4 — Level Sequence authorship

Generate LevelSequence builds `LS_CameraArray` (or your renamed default) with one cut per camera. The Sequencer timeline should show dense markers—one per viewpoint.

![Viewport with large dome, widget highlighting Generate LevelSequence, Content Browser showing LS_CameraArray asset](/images/splatshot/ui-step-05-create-level-sequence.png)

The Details panel on the CameraArray instance reports hundreds of elements (for example 513), matching the number of keys you will render. Target Level Sequence slot on the widget can bind this asset for later MRQ passes.

![Sequencer on LS_CameraArray with dense tick marks, viewport from above, widget showing linked Target Level Sequence](/images/splatshot/ui-step-05-level-sequence-view-frame.png)

Scrubbing confirms framing before you commit hours of rendering. If any camera clips the ground or loses the subject, fix the Mesh to World transform or FOV here rather than after export.

## Step 5 — Movie Render Pipeline preset

Before Send MRQ, assign a Movie Pipeline Primary Config compatible with multi-view export. The plugin ships presets under its MovieRenderSettings content; the screenshots reference `MPPC_MultiViews_Color`.

![Widget Render Settings with MPPConfig Color selector pointing at MPPC_MultiViews_Color, Img Size 800, Target Level Sequence set](/images/splatshot/ui-step-06-movie-render-pipeline.png)

Match the config to your bit depth, tone mapping, and output format requirements. If your trainer expects linear colors, disable display encoding in the preset rather than baking sRGB unknowingly.

## Step 6 — Queue, local render, progress

Send MRQ pushes the job into Movie Render Queue with the copied pipeline settings and output path you set under Export or Render sections.

![Widget with Send MRQ highlighted; viewport shows dome around Quinn](/images/splatshot/ui-step-07-sequence-as-render-target.png)

The red annotation in the source material emphasizes moving from sequence generation to queue submission once presets look correct.

![Movie Render Queue window with Render_CameraArray job and blue Render (Local) control](/images/splatshot/ui-step-07-render-local-mrp.png)

Render Local keeps work on the workstation. For farms, you would adapt the same job to your remote executor; SplatShot only depends on Unreal writing frames and the export step seeing consistent naming.

![Movie Pipeline Render preview: progress 120 of 513 frames, low-quality preview of mannequin, cut cycling CameraActor_Vtx indices](/images/splatshot/ui-step-07-rendering-in-progress.png)

The progress window names the active camera actor index, shows warm-up completion, and estimates remaining time. Long runs are normal when hundreds of views meet path tracing or high resolutions.

![Contact sheet of sequential frames frame_0001, frame_0002, … showing rotating viewpoints of the same pose](/images/splatshot/dataset-rendered-views-sample.png)

After completion you should see a contiguous numbering scheme (zero-padded width matches your export dialog). Lighting and pose are constant across tiles; only the camera orbit changes, which is exactly the multi-view consistency structure-from-motion would try to recover—but here the metadata is authoritative.

## Step 7 — COLMAP text export

When frames exist on disk, Export Camera Info writes sparse text alongside them. A completion dialog in the reference project reported 513 image rows, 513 camera models, output under `.../bake/sparse/0`, and files `cameras.txt`, `images.txt`.

![Modal reading “COLMAP export completed” with paths and counts; Export Camera Info button outlined](/images/splatshot/ui-step-08-export-colmap-options.png)

Keep filename padding, image resolution, and aspect consistent with the values embedded in `cameras.txt`. If you change resolution after rendering, regenerate both images and metadata.

![Export Settings with Sample Meshes listing StaticMesh2, Sample Count 50k, output directory path](/images/splatshot/ui-step-08-static-mesh-export-settings.png)

Sampling meshes for sparse points is independent of camera vertices: you can downsample or swap meshes to control `points3D` density. Align world scale with your training framework’s expectations (Unreal centimeters versus meters).

## Step 8 — Inspect files on disk

Use Open Directory from the widget or browse manually. You should find rendered images, the COLMAP text set, and optional PLY point clouds depending on options.

![Explorer listing cameras, images, point_cloud.ply, points3D text with sizes and timestamps](/images/splatshot/colmap-project-initialization.png)

This folder layout is what many trainers expect: intrinsics per camera model, image lines with quaternions and translations, sparse points with track references. Because the data originated in-engine, you mainly validate path strings and units rather than fighting drift from featureless regions.

![Editor return view with Open Directory highlighted on the widget](/images/splatshot/ui-step-09-output-folder-result.png)

The duplicate editor screenshot underscores the habit of jumping straight from export to Explorer to confirm byte sizes before kicking off GPU training.

## Downstream training (PostShot and others)

Import the output directory into PostShot or any trainer that accepts COLMAP-style layouts together with RGB images. The schematic below illustrates multi-view frustums around a subject; it is not tied to a particular application’s UI.

![Wireframe character with axis gizmo at feet inside a white frustum hemisphere on dark gray](/images/splatshot/postshot-colmap-training-import.png)

Consult your tool’s notes on world versus camera matrices and quaternion order; sign mistakes remain possible even when UE data is internally consistent. A short validation—projecting sparse points into a handful of frames—before a long training run is time well spent.

## Technical summary

Pre-release builds focus on text-oriented COLMAP-style export paired with rendered images. Baseline engine: Unreal Engine 5.3 or newer; Movie Render Queue is the intended path when high rendering quality is required.

## Roadmap

Possible extensions we are exploring include spline-based camera paths, adaptive sampling on surfaces, and exporting additional buffers (e.g. normals, depth) for auxiliary losses. Nothing here should be read as a fixed product commitment.

## Support

Email: [m2clarry@gmail.com](mailto:m2clarry@gmail.com)

If something in this guide disagrees with your engine version or downstream tool, we would appreciate hearing about it so the document can be tightened for everyone.
