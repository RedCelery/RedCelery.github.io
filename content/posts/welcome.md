+++
title = "站点搭好了"
date = 2026-03-28
draft = false
tags = ["随记"]
description = "用 Hugo + hugo-paper 主题搭的博客，记录科研和项目想法。"
+++

这是第一篇文章，你可以删掉或改掉。

主题文档见：[nanxiaobei/hugo-paper](https://github.com/nanxiaobei/hugo-paper)。

## 本地预览

```bash
hugo server --buildDrafts
```

浏览器访问终端里提示的地址（多为 `http://localhost:1313/`）。

## 新文章

```bash
hugo new content posts/文章名.md
```

## 部署

推送 `main` 后，CI 会构建并推到 **`gh-pages`**。请在仓库 **Settings → Pages** 中选择 **Deploy from a branch**，分支 **gh-pages**，目录 **/ (root)**。
