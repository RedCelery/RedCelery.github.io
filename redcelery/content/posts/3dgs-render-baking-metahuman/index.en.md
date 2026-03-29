---
weight: 1
title: 'Can We "Bake" a MetaHuman with 3DGS? LOD3 Teacher, LOD0 Look'
date: 2026-03-28T12:00:00+08:00
draft: true
author: "xxxx"
description: "A working note on using 3D Gaussian Splatting as a precomputed appearance target—MetaHuman LOD as teacher/student—and what would need to be tried."
tags: ["3DGS", "MetaHuman", "baking", "rendering", "LOD"]
categories: ["GaussianSplatting"]
---

3D Gaussian Splatting (3DGS) has been strong for reconstructing real scenes with a relatively clear pipeline. Lately I have been wondering: if we treat **expensive shading and detail** as something to **pre-pack** into another representation that is cheaper to draw at runtime, does 3DGS have a role—similar in *motivation* to lightmaps, impostors, or LOD pop, but with **splats** as the medium?

<!--more-->

This post is a **thought experiment**, not an experiment report. I want to separate **classic baking** from **supervised fitting to a reference**, sketch a tiny 3DGS primer, then ask how that might interact with **MetaHuman** and **LOD**.

## Motivation

In static or weakly dynamic settings, 3DGS often gives high-quality results. The engineering instinct is familiar: **pay offline (or in a heavier asset), buy runtime**. Game engines already do this with baked lighting, probes, textures, and LOD chains.

The question here is narrower: could **reference renders** from a **heavy** setup (e.g. a high-cost character pass) provide **supervision** for a **lighter** drawable thing—here hypothetically **3DGS** or **GS plus a small amount of mesh**—so that, under constraints, we get a **better look than the underlying cheap geometry alone**?

## A very short primer on 3DGS

For readers who only need intuition:

- The scene is approximated by many **3D Gaussians** (ellipsoids): each has a **position**, and parameters that define **shape and orientation** (covariance / scale).
- Each Gaussian also has **opacity** and **color**. Color is often encoded with low-order **spherical harmonics (SH)** so appearance can vary modestly with **viewing direction** within some range.
- **Rendering** projects those ellipsoids to the screen as **splats**, sorts them roughly by depth, and **alpha-composites** them—same broad family of ideas as splatting / point-based rendering.
- **Training** starts from **multi-view images** and uses differentiable rendering to adjust Gaussian parameters until the rendered views match the observations.

For the original formulation, see Kerbl et al., *3D Gaussian Splatting for Real-Time Radiance Field Rendering* ([project page](https://repo-sam.inria.fr/fungraph/3d-gaussian-splatting/)). No formulas here—this is anchor vocabulary for the rest of the note.

## What I mean by “baking” here

**Classic baking** in engines usually means precomputing **lighting, shadows, GI, or other shading** into textures, vertices, or probes so the runtime does less lighting work.

In this note, **“baking”** means something adjacent: use **high-cost reference rendering** (or a **higher-LOD** asset) to produce **supervision signals**, and **fit** a **cheaper** drawable representation (3DGS or hybrid) so it **matches that reference** under agreed cameras and conditions.

That is **not** claiming 3DGS *is* a lightmap. It is asking whether splats can act as a **queryable, precomputed appearance approximation** in the same *budget trade-off* spirit.

## Does 3DGS fit that picture? Some real sub-questions

These are discussion points, not answers.

- **View-dependent effects**: strong specular highlights, anisotropic skin highlights, corneas—does SH-limited 3DGS extrapolate well, or do we need a **hybrid** (e.g. face stays mesh, GS handles hair / peach fuzz)?
- **Time / animation**: a single “statue” splat set vs **expression and body motion**. If it moves, is the path per-frame optimization, skeleton-driven Gaussians, or **only** using GS at LOD transitions?
- **LOD narrative**: engine LOD is **geometry and material switches**. Two different stories:
  - **Distillation**: **LOD3** as **teacher**, **LOD0-like appearance** as the **target** for a sparse student (splats with a cap).
  - **Decoupled look**: runtime geometry stays **LOD3**, but **appearance** is carried by GS (or baked textures derived from GS). Same words, different engineering contracts.

Both are worth stating explicitly so we do not mix them accidentally.

## The MetaHuman-shaped thought experiment

Concrete picture:

- **Teacher**: **MetaHuman at LOD3** (or whatever you define as the “cheap” runtime baseline), rendered under **fixed or narrow lighting** and **fixed or narrow expression** while you capture views.
- **Student**: a **bounded** primitive count—e.g. a **maximum splat budget**, or **splats + a low mesh**.

**Hypothesis (not a claim):** if the student can match the teacher **inside that camera and expression envelope**, do we get something that **reads like a higher LOD** under **real-time** budgets—and what do we pay in **memory**, **off-angle failure**, and **animation consistency**?

**Scope honesty:** hair, transparency, and SSS-heavy regions might need **phased** treatment or a **first pass** that deliberately avoids them. The goal is not to sound like “one button fixes MetaHuman.”

## Risks and sanity checks

- **View extrapolation** outside the training arc; teeth and oral cavity; **extreme close-ups**; motion blur; interaction with engine **TAA** and temporal filters.
- Define **“real-time”**: target **hardware**, **resolution**, **ms budget**, and whether any **per-view** offline step is allowed.

## A phased path (if one were to try)

**Phase 0 — Narrow the problem:** head only, **static** pose, fixed HDRI or a small studio light rig; teacher = LOD3 in **Unreal**. Deliverable: stable **multi-view RGB** (optional depth / normals).

**Phase 1 — Can appearance fit at all?** Off-the-shelf 3DGS (or equivalent) on a **static** face; **hard splat cap**. Success: reasonable match on a **fixed viewing arc** (metrics or side-by-side). If this fails, fix **capture density** before MetaHuman-specific storytelling.

**Phase 2 — LOD story:** same pose, two teachers: **LOD0 vs LOD3**. See whether the student tracks **which** teacher and **where** it breaks (hairline, specular lobes, etc.).

**Phase 3 — Minimal motion:** one **blendshape** band or tiny expression range; or a blunt baseline (**per keyframe splat set**) to measure **popping** and **storage**. If it is ugly, that is evidence for **hybrid** rather than pure GS.

**Engine integration (optional mentions):** train splats offline and bring them in via an **engine-friendly splat path** if available, or use GS **only offline** to generate **textures** fed back into traditional materials. No need to commit to one in a note.

## Closing

The interesting part is the **question graph**: what “baking” means when the baked thing is **3D Gaussians**, how that interacts with **LOD semantics**, and what a **minimal experiment** would falsify first. This is a **project note**, not a verdict—corrections welcome once there is data.
