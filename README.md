# iFlow Skills

iFlow AI Agent 模块与技能集合

## 概述

本项目包含 iFlow AI Agent 的核心模块和技能，提供完整的桌面自动化、浏览器控制、多代理协同等功能。

## 模块列表

### Node.js 模块 (20个, 149个工具)

| 模块 | 功能 |
|------|------|
| `subagent` | 多代理协同、并行执行、任务委派 |
| `agents` | 角色定义、多模型路由、协作模式 |
| `autonomous` | 自主决策、目标追踪 |
| `decision` | 决策支持、偏好学习 |
| `heartbeat` | 心跳监控、定时任务、自主运行引擎 |
| `improve` | 学习进化、错误记录、模式推广 |
| `memory` | 长期记忆、向量搜索、SQLite存储 |
| `llm` | 多模型调用、缓存、Schema验证 |
| `browser` | 浏览器自动化 (Playwright) |
| `desktop` | 桌面自动化 (pyautogui/pywinauto) |
| `triage` | 任务分类、优先级 |
| `selfrepair` | 自我修复、错误恢复 |
| `state` | 状态管理 |
| `cache` | 缓存系统 |
| `lobster` | 数据管道 |
| `summarize` | 内容摘要 |
| `session` | 会话管理 |
| `channel` | 消息通道 (Telegram/Discord/Slack) |
| `skills` | 技能系统 |
| `files` | 文件操作 |

### Python 模块

| 模块 | 功能 |
|------|------|
| `browser` | 浏览器自动化 v2.0 - 持久化会话 |
| `desktop` | 桌面控制 v2.0 - 双后端支持 |
| `mcp-server` | MCP 协议服务器 |

## 快速开始

### Node.js 模块

```bash
cd node
npm install
npm run mcp
```

### Python 模块

```bash
pip install -r python/mcp-server/requirements.txt
python python/mcp-server/server.py
```

## 架构

```
iflow-skills/
├── node/                    # Node.js MCP 服务器
│   ├── mcp-server.js       # 入口
│   ├── index.js            # 模块导出
│   ├── package.json
│   └── modules/            # 所有模块
│       ├── subagent.js
│       ├── agents.js
│       ├── heartbeat.js
│       ├── memory.js
│       └── ...
├── python/                  # Python MCP 服务器
│   ├── mcp-server/
│   │   └── server.py
│   └── modules/
│       ├── browser/module.py
│       └── desktop/module.py
└── README.md
```

## 特性

- **多代理协同**: 自动复杂度评估、并行委派、结果聚合
- **自主运行**: 心跳驱动的技能系统，支持定时触发
- **学习进化**: 错误记录、模式检测、自动推广
- **向量搜索**: 基于 SQLite 的向量相似度搜索
- **多模型路由**: 支持 OpenAI、Anthropic、豆包、扣子等
- **浏览器持久化**: 保持登录状态，无需重复认证
- **桌面双后端**: pyautogui + pywinauto 自动切换

## 许可证

MIT
