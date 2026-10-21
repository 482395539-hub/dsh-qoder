# Qoder 免费模型网关 — DeepSeek Harness (DSH) 插件

把 [Qoder](https://qoder.com.cn) 的免费模型直连进 [DeepSeek Harness](https://github.com/AiGptCode/DeepSeek-Harness)（DSH）的插件：内置设备码登录 + 多账号池反代网关，装上就能在模型列表里选 Qwen3.8-Flash / DeepSeek-Flash 等 **1M 上下文**的模型开聊，另带一个可视设置页管理账号、分享账号池、检测模型健康。

> 内嵌网关基于开源项目 [qoder2api-hub](https://github.com/shuishuipingan/qoder2api-hub)（MIT）二次打包，见 `gateway/LICENSE`。

---

## ✨ 功能

| 功能 | 说明 |
|---|---|
| 免费模型直连 | 注册 `qoder` LLM 路由，模型列表即插即用，真流式输出（文本/思考/工具调用） |
| 内置账号 | 首次装配自动拉起网关并用内置账号登录，开箱即聊（"先用我的"） |
| 1M 上下文 | 模型上下文档位按官方 `context_config` 上报（多数模型 1M，实测 84 万 tokens 输入通过） |
| 设置页 | DSH 设置 → 「Qoder 免费模型网关」，见下文截图区 |
| 账号池 | 添加/启用/停用/删除/测试账号，多号自动轮换与错误冷却 |
| 每日签到 | 一键签到领积分（每天 100 Credits），下次可签时间直接显示 |
| 分享 / 导入 | 一键导出含 refreshToken 的账号 JSON，他人粘贴即导入；另支持 PAT（`pt-`）导入与本机桌面端/CLI 凭证扫描导入 |
| 模型健康检测 | 逐模型真实探活，延迟 + 错误一目了然 |
| 外部模型地址 | Base URL / API Key 可热改指向任意 OpenAI 兼容端点，保存即生效 |
| Agent 工具 | `qoder_login`（发起/查询设备码登录）、`qoder_gateway`（网关状态/重启） |

## 📦 安装

环境要求：DSH ≥ 0.2.1-rc.2，Python 3.9+（网关零第三方依赖）。

### 方式 A：从 GitHub 安装（推荐）

DSH Web GUI 的「设置 → 插件 → 添加插件」输入框里填：

```text
github:482395539-hub/dsh-qoder
```

或命令行：

```bash
dsh plugin add github:482395539-hub/dsh-qoder
```

### 方式 B：本地目录 / 手动

安装框同样接受本地绝对路径，适合边改边装：

```text
<解压后的目录>\dsh-qoder
```

在 DSH 会话里也可以直接让 agent 执行 `plugin_manager` 的 `install_bundle`，`target` 填上面的目录。

安装后 **无需重启**：宿主半（适配器 + 工具 + HTTP API）热装配，浏览器半在下次页面加载时生效。

## 🚀 快速开始

1. 安装完成后刷新 DSH 网页；
2. 模型选择器里出现「Qoder 免费模型」分组，选 `Qwen3.8-Flash` 或 `DeepSeek-Flash` 即聊；
3. 打开 **设置 → Qoder 免费模型网关** 管理账号池与模型。

## ⚙️ 设置页

- **网关状态**：本地网关运行状态、就绪账号数、可用模型数
- **账号池**：
  - 内置账号开箱即用；每行可 **测试 / 刷新 Token / 启停 / 删除**，并显示额度用量与到期
  - **+ 添加个人账号**：自动生成设备码授权链接 → 浏览器确认 → 账号自动落盘（10 分钟有效；面板带倒计时、「立即检测」与明确的过期/失效提示）
  - **PAT 导入 / 本机凭证扫描**：浏览器授权不顺畅时的两条兜底路径
  - **每日签到**：一键为池内所有账号签到领积分
  - **分享全部账号**：导出含 refreshToken 的 JSON（导入即用，注意保管）
  - **导入账号**：粘贴分享的 JSON 批量入池
- **模型**：全模型列表 + 一键健康检测（免费档不耗额度，付费档消耗极小）
- **模型地址与 Key**：留空 = 内置本地网关；填外部地址可指向任意 OpenAI 兼容端点，热生效

## 🛠️ Agent 工具

| 工具 | 说明 |
|---|---|
| `qoder_login` | `action=start` 生成设备码授权链接；`action=status` 查询账号池与登录结果 |
| `qoder_gateway` | `action=status` 探活 + 模型数 + 日志尾巴；`action=restart` 重启网关进程 |

## 🔧 配置项（cordis.patch.yml 行内 `config`）

| 键 | 默认 | 说明 |
|---|---|---|
| `port` | `8790` | 本地网关端口（仅监听 127.0.0.1） |
| `apiKey` | 内置 | 网关 API Key（插件侧自动注入，浏览器永不接触） |
| `panelPassword` | `admin` | 网关面板密码（建议修改） |
| `realm` | `cn` | 登录区服：`cn` = qoder.com.cn，`intl` = qoder.com |
| `autoStart` | `true` | 网关未运行时自动拉起 |
| `accountsDir` | `<dshHome>/qoder/accounts` | 账号 JSON 落盘目录 |

## ❓ FAQ

**报 `upstream 403 code 112 / pricingUrl`？**
账号额度用尽。免费档（`*Flash`）不消耗额度；付费档与 `auto` 需要剩余额度。处理：模型切 Flash、设置页「每日签到」、添加新账号、或等周期重置。

**为什么模型上下文显示 1M？**
按 Qoder 官方 `context_config` 的最高档上报；`Auto` 与 MiniMax 为 200K。实测 842K tokens 输入 HTTP 200。

**模型列表出现两个 Qoder 分组？**
配置里同时存在插件路由与其他 Qoder 提供方，删掉重复的那条即可。

**想指向别处的网关 / 其他 OpenAI 端点？**
设置页「模型地址与 Key」填 Base URL（与可选 API Key），保存即热生效，无需重启。

## 📁 目录结构

```
dsh-qoder/
├── index.js          # 宿主半：适配器、工具、/api/qoder/* 管理 API
├── client.js         # 浏览器半：设置页（React + 主题 token）
├── cordis.patch.yml  # Loader 行（装配配置）
├── package.json      # dsh.bundle / dsh.client 双面清单
├── icon.svg / locale/  # 图标与中英文案
└── gateway/          # 内嵌 qoder2api-hub 网关（Python，零依赖）
```

## 📜 许可证

本项目 MIT（见 `LICENSE`）；内嵌网关 [qoder2api-hub](https://github.com/shuishuipingan/qoder2api-hub) 遵循其原 MIT 许可（见 `gateway/LICENSE`）。

## ⚠️ 免责声明

本项目仅供学习与研究，请遵守目标服务的用户协议；账号、额度与上游策略变动造成的任何影响由使用者自行承担。请勿用于商业倒卖或破坏性行为。
