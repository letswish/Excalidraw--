# Excalidraw--

基于 `@excalidraw/excalidraw` npm 包和 Electron 构建的桌面应用。

## 功能改动

- 本地打开、保存 `.excalidraw` 文件，并记录最近打开的文件。
- 打开其他文件或关闭窗口前检查未保存内容，支持保存、不保存和取消。
- 支持从 Excalidraw 官方库安装素材，并持久化到本地。
  Ubuntu 下存储路径为 `~/.config/excalidraw--/libraries.json`。
- 允许嵌入任意有效的 HTTP/HTTPS 地址。
- Ubuntu 下注册 `.excalidraw` MIME 和文件关联，支持双击文件启动或唤醒已有实例。

详细的上游兼容性说明见 [`docs/excalidraw-compatibility.md`](docs/excalidraw-compatibility.md)。

## 调试

安装依赖：

```bash
npm install
```

启动开发环境：

```bash
npm run dev
```

运行测试：

```bash
npm test
```

## 构建

构建生产代码：

```bash
npm run build
```

输出目录为 `out/`。

构建 Ubuntu Debian 安装包：

```bash
npm run dist:linux
```

安装包输出到 `release/`。安装示例：

```bash
sudo apt install ./release/excalidraw-desktop-0.1.0-amd64.deb
```

## 支持的平台

- Ubuntu/Debian x64：已配置并验证 `.deb` 打包和文件关联。
- Windows、macOS、Linux ARM64：暂未配置安装包。
