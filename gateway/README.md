<h1 align="center">Qoder2API-Hub</h1>

<p align="center">
  把 Qoder 国内版（qoder.com.cn）与国际版（qoder.com）封装成 OpenAI / Anthropic 兼容接口的多账号网关
</p>

<p align="center">
  <a href="https://github.com/shuishuipingan/qoder2api-hub/releases"><img src="https://img.shields.io/github/v/release/shuishuipingan/qoder2api-hub?style=flat-square" alt="Release"></a>
  <a href="https://github.com/shuishuipingan/qoder2api-hub/actions/workflows/tests.yml"><img src="https://img.shields.io/github/actions/workflow/status/shuishuipingan/qoder2api-hub/tests.yml?branch=main&style=flat-square&label=tests" alt="Tests"></a>
  <img src="https://img.shields.io/badge/Python-3.9+-blue?style=flat-square" alt="Python 3.9+">
  <img src="https://img.shields.io/badge/dependencies-zero-ff69b4?style=flat-square" alt="Zero dependencies">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="MIT"></a>
</p>

![网关总览](docs/img/dashboard.png)

## 特性

- **三种协议**：OpenAI Chat Completions、Responses API（Codex）、Anthropic Messages（Claude Code）
- **双区多账号**：国内版 / 国际版独立账号池与出口，按模型自动选区；账号轮询、会话亲和、故障冷却换号
- **免客户端登录**：OAuth 设备授权、PAT 导入，或直接导入本机官方客户端已登录的凭证
- **模型与官方同源**：动态拉取官方清单，含峰谷价、上下文窗口、思考档位和禁用原因
- **签到与保活**：自动领取每日 Credits 活动，定时刷新 Token
- **防风控**：出站身份形态对齐官方客户端，可选的单号并发闸门与请求节奏控制，`/health` 提供排队 / 限流 / 拒绝信号遥测
- **Web 看板**：账号、用量与性能指标、请求流水、限额护栏、智能体一键配置
- **零依赖**：只用 Python 标准库（COSY 签名、AES / RSA 都是纯 Python 实现），另提供 amd64 / arm64 Docker 镜像

## 快速开始

需要 Python 3.9+ 或 Docker。先获取代码：

```bash
git clone https://github.com/shuishuipingan/qoder2api-hub.git
cd qoder2api-hub
```

然后选一种方式启动：

| 平台 | 启动 | 停止 |
|---|---|---|
| Windows | 双击 `start-qoder-proxy.bat`（后台运行，日志写入 `qoder-proxy.log`） | `stop-qoder-proxy.bat` |
| Linux / macOS | `chmod +x *.sh && ./start-qoder-proxy.sh`（前台运行） | `Ctrl+C` |
| Docker | `docker compose up -d` | `docker compose down` |

启动后：

- **API**：`http://127.0.0.1:8790/v1`
- **看板**：`http://127.0.0.1:8790/`，默认密码 `admin`，首次登录后请到「设置」修改

在看板「账号」页点 **+ 添加账号 (OAuth)**，到浏览器里完成授权，账号就加好了。

> Docker 以局域网模式启动，会强制使用 API Key。首次启动时自动生成，用 `docker compose logs qoder-proxy | grep -i "api key"` 查看。
> 局域网共享、改端口、出口代理见[部署](docs/deployment.md)。

## 接入客户端

| 客户端 | Base URL | 协议 |
|---|---|---|
| OpenAI 兼容客户端（Cherry Studio、Chatbox、NextChat 等） | `http://127.0.0.1:8790/v1` | Chat Completions |
| Codex CLI | `http://127.0.0.1:8790/v1` | Responses API |
| Claude Code | `http://127.0.0.1:8790`（不带 `/v1`） | Anthropic Messages |

- **模型名**：填 `/v1/models` 返回的 `id`，也就是官方模型名，例如 `Qwen3.8-Max`
- **API Key**：在看板「设置」中生成。本机运行且没有配置任何 Key 时，可以留空

```bash
curl http://127.0.0.1:8790/v1/chat/completions \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "Qwen3.8-Flash", "messages": [{"role": "user", "content": "你好"}]}'
```

Claude Code、Codex CLI、OpenCode、DSH、Crush 可以在看板「智能体配置」页一键写入配置，写入前会自动备份，随时可还原。详见[客户端接入](docs/clients.md)。

## 文档

| 文档 | 内容 |
|---|---|
| [部署](docs/deployment.md) | 本机 / 局域网 / Docker 部署、防火墙、出口代理、升级 |
| [配置参考](docs/configuration.md) | 命令行参数、环境变量、API Key、模型闸门、限额护栏 |
| [账号与签到](docs/accounts.md) | 添加账号、凭证生命周期、签到与活动规则、定时调度 |
| [客户端接入](docs/clients.md) | 各协议的接入方式、智能体一键配置 |
| [模型](docs/models.md) | 模型来源、命名、双区路由、峰谷价、思考档位 |
| [接口参考](docs/api.md) | HTTP 端点与鉴权方式 |
| [故障排查](docs/troubleshooting.md) | 常见问题、诊断脚本、已知限制 |
| [风控与排队](docs/risk-control-and-queueing.md) | 上游的风控维度与处置等级、多账号为什么仍会排队、官方客户端逆向结论 |
| [风控处置手册](docs/risk-control-playbook.md) | 出口 / 身份 / 调度 / 请求 / 观测各层的处置办法，容器与数据中心的落地方案 |
| [实现原理](docs/internals.md) | 请求链路、设备指纹、容错重试、工具调用回读 |
| [开发与测试](docs/development.md) | 模块结构、测试、维护脚本 |
| [更新日志](CHANGELOG.md) | 各版本变更 |

## 致谢

- [mmqz/cpa-multi-plugins](https://github.com/mmqz/cpa-multi-plugins)：双区常量表、OAuth 设备授权与 PAT 交换、COSY 签名与自定义 Base64、签到与保活排程
- [Liki4/qodercli2api](https://github.com/Liki4/qodercli2api)：OAuth 与推理协议的逆向记录（PKCE、deviceToken / jobToken、SSE 信封）
- [Sliverkiss/workbuddy2api](https://github.com/Sliverkiss/workbuddy2api)：设备指纹派生（`derive_id`）、整点排程、DeepSeek 思维链回填
- WorkBuddy2API-Hub：本项目架构、看板交互与功能矩阵的蓝本

## 免责声明

本项目是非官方的自托管网关，仅供技术研究，以及个人在私有环境中使用自己合法授权的账号。本项目不提供任何账号或额度。请遵守 Qoder 官方服务条款，不得用于商业转售、恶意并发等滥用行为。

[MIT License](LICENSE)
