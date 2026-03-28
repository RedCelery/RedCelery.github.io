+++
title = "站点搭好了"
date = 2026-03-28
draft = false
tags = ["随记"]
summary = "用 Hugo + PaperMod 搭的个人博客，之后科研和项目笔记都会写在这里。"
+++

这是第一篇文章。你可以删掉或改掉它。

## 本地预览

在仓库根目录执行：

```bash
hugo server --buildDrafts
```

浏览器打开终端里提示的地址（一般是 `http://localhost:1313/`）。

## 写新文章

```bash
hugo new content posts/你的文章名.md
```

把正文写在 `+++` 下面的 Markdown 里；需要草稿时把 front matter 里的 `draft` 设为 `true`，本地加 `--buildDrafts` 才能看到。

## 上线

把代码推到 GitHub 的 `main` 分支后，在仓库 **Settings → Pages** 里把 **Source** 选成 **GitHub Actions**。首次推送后等几分钟，访问 [https://redcelery.github.io/](https://redcelery.github.io/) 即可。
