# iFlow Skills

iFlow AI Agent 模块与技能集合

## 概述

本项目包含 iFlow AI Agent 的核心模块和技能，提供完整的桌面自动化、浏览器控制、多代理协同、记忆系统、消息通道等功能。当前版本包含 **118个模块**，约 **927个工具**，支持高度可配置的自主代理系统。

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

## 模块列表

### Node.js 核心模块（85个模块，约850个工具）

#### 1. 核心架构
| 模块 | 功能描述 |
|------|----------|
| `subagent` | 多代理协同、并行执行、任务委派、状态持久化 |
| `agents` | 角色定义、多模型路由、协作模式、动态代理 |
| `autonomous` | 自主决策、目标追踪、自主运行引擎 |
| `decision` | 决策支持、偏好学习、决策历史管理 |
| `heartbeat` | 心跳监控、定时任务、自主运行引擎、cron调度 |
| `improve` | 学习进化、错误记录、模式检测、自动推广 |
| `memory` | 长期记忆、向量搜索、SQLite存储、时间衰减 |
| `llm` | 多模型调用、缓存、Schema验证、模型降级容错 |

#### 2. 浏览器与桌面自动化
| 模块 | 功能描述 |
|------|----------|
| `browser` | 浏览器自动化、多页面管理、设备模拟、性能追踪 |
| `desktop` | 桌面自动化、双后端支持、UI自动化、窗口管理 |

#### 3. 消息与通道
| 模块 | 功能描述 |
|------|----------|
| `channel` | 消息通道（Telegram/Discord/Slack/WeCom） |
| `channels-enhanced` | 增强消息路由、会话管理、权限控制、消息去重 |
| `session` | 会话管理、消息历史、上下文追踪 |
| `web-gateway` | Web服务器、REST API、远程控制接口 |

#### 4. 数据与缓存
| 模块 | 功能描述 |
|------|----------|
| `cache` | 缓存系统、TTL过期、LRU缓存 |
| `cache-utils` | 缓存工具、哈希计算、大小估算、清理机制 |
| `lobster` | 数据管道、流式处理、工作流编排 |
| `state` | 状态管理、持久化存储、键值存储 |

#### 5. 工具与实用函数
| 模块 | 功能描述 |
|------|----------|
| `files` | 文件操作、目录管理、批量处理 |
| `clipboard` | 剪贴板操作、跨平台支持、历史记录 |
| `string-utils` | 字符串规范化、大小写转换、转义处理 |
| `utils-base` | 通用工具、分块处理、并发控制、超时管理 |
| `system-utils` | 系统工具、进程管理、文件锁、端口管理 |
| `security-utils` | 安全工具、路径守卫、输入验证、速率限制 |

#### 6. 网络与通信
| 模块 | 功能描述 |
|------|----------|
| `link-extraction` | 链接提取、自动抓取、SSRF防护、Markdown格式化 |
| `web-fetch` | HTTP请求、重试机制、超时控制 |

#### 7. 机器学习与AI
| 模块 | 功能描述 |
|------|----------|
| `summarize` | 内容摘要、批量处理、关键词提取 |
| `context-engine` | 上下文管理、Token估算、自动压缩 |

#### 8. 开发与部署
| 模块 | 功能描述 |
|------|----------|
| `cluster` | 集群管理、节点发现、远程执行 |
| `skills` | 技能系统、依赖管理、自动安装、元数据 |

#### 9. 监控与诊断
| 模块 | 功能描述 |
|------|----------|
| `diagnostic-events` | 诊断事件、模型使用追踪、错误监控 |
| `logging` | 结构化日志、分级日志、敏感信息脱敏 |
| `triage` | 任务分类、优先级排序、统计查询 |

#### 10. 容错与恢复
| 模块 | 功能描述 |
|------|----------|
| `selfrepair` | 自我修复、错误恢复、历史记录 |
| `enhanced-retry` | 增强重试、指数退避、抖动机制 |
| `error-handler` | 统一错误处理、错误分类、敏感信息脱敏 |
| `retry-policy` | 重试策略、自适应延迟、错误检测 |

#### 11. 性能优化
| 模块 | 功能描述 |
|------|----------|
| `text-chunking` | 文本分块、Markdown支持、Token估算 |
| `rate-limit` | 速率限制、多种算法、装饰器支持 |
| `dedupe-cache` | 去重缓存、持久化去重、TTL过期 |

#### 12. 安全与认证
| 模块 | 功能描述 |
|------|----------|
| `secrets` | 密钥存储、环境变量、密钥引用、脱敏显示 |
| `secret-file` | 密钥文件加载、安全验证、环境变量回退 |
| `http-guard` | HTTP防护、请求体限制、超时控制 |
| `file-security` | 文件安全、符号链接防护、身份验证 |

#### 13. 数据处理
| 模块 | 功能描述 |
|------|----------|
| `markdown` | Markdown解析渲染、Frontmatter、表格处理 |
| `media` | 媒体文件处理、MIME类型、元数据提取 |
| `data-validation` | 数据验证、随机数生成、范围检查 |
| `json-files-enhanced` | JSON文件增强、原子写入、并发安全 |

#### 14. 系统工具
| 模块 | 功能描述 |
|------|----------|
| `path-resolver` | 路径解析、跨平台、主目录处理 |
| `executable-path` | 可执行文件路径、PATH管理、命令查找 |
| `shell-env` | Shell环境、环境变量管理、命令查找 |
| `os-summary` | 系统摘要、CPU/内存信息、网络接口 |
| `node-commands` | Node.js命令、运行时信息、模块管理 |
| `process-monitor` | 进程监控、进程树、资源监控 |

#### 15. 配置与环境
| 模块 | 功能描述 |
|------|----------|
| `env-config` | 环境配置、.env加载、验证、脱敏 |
| `runtime-env` | 运行时环境、日志支持、错误处理 |
| `config-eval` | 配置评估、二进制检查、运行时验证 |
| `requirements-eval` | 需求评估、缺失检查、验证报告 |

#### 16. Git与版本控制
| 模块 | 功能描述 |
|------|----------|
| `git-utils` | Git工具、提交信息、分支管理、状态检查 |
| `git-root-enhanced` | 增强Git根目录查找、HEAD路径解析 |

#### 17. 时间与格式化
| 模块 | 功能描述 |
|------|----------|
| `cli-format` | CLI格式化、ANSI颜色、表格渲染、进度条 |
| `subagents-format` | 子代理格式化、Token统计、性能显示 |

#### 18. 平台兼容
| 模块 | 功能描述 |
|------|----------|
| `wsl` | WSL检测、环境变量检查、异步缓存 |
| `stable-node-path` | 稳定Node路径、Homebrew处理 |
| `machine-name` | 机器名称、主机名、唯一标识 |

#### 19. 其他工具
| 模块 | 功能描述 |
|------|----------|
| `archive` | 归档系统、压缩解压、格式检测 |
| `plugin-tools` | 插件工具、异步队列、持久化去重 |
| `runtime-system` | 运行时系统、系统事件、命令队列 |
| `sandbox` | 沙箱环境、隔离执行、安全限制 |

### Python 模块

| 模块 | 功能描述 |
|------|----------|
| `browser` | 浏览器自动化 v2.0 - 持久化会话、多页面管理 |
| `desktop` | 桌面控制 v2.0 - 双后端支持（pyautogui/pywinauto） |

## 架构

```
iflow-skills/
├── node/                    # Node.js MCP 服务器
│   ├── mcp-server.js       # 入口
│   ├── index.js            # 模块导出
│   ├── package.json        # 依赖配置
│   └── modules/            # 85个核心模块
│       ├── subagent.js
│       ├── agents.js
│       ├── heartbeat.js
│       ├── memory.js
│       ├── llm.js
│       ├── browser.js
│       ├── desktop.js
│       ├── channel.js
│       ├── channels-enhanced.js
│       ├── session.js
│       ├── web-gateway.js
│       ├── cache.js
│       ├── secrets.js
│       └── ...
├── python/                  # Python MCP 服务器
│   ├── mcp-server/
│   │   └── server.py
│   └── modules/
│       ├── browser/
│       │   └── module.py
│       └── desktop/
│           └── module.py
├── .gitignore               # Git忽略配置
└── README.md                # 本文件
```

## 特性

### 核心能力
- **多代理协同**: 自动复杂度评估、并行委派、结果聚合、状态持久化
- **自主运行**: 心跳驱动的技能系统、Cron调度、自主决策
- **学习进化**: 错误记录、模式检测、自动推广、置信度管理
- **向量搜索**: 基于 SQLite 的向量相似度搜索、时间衰减、MMR重排序
- **多模型路由**: 支持 OpenAI、Anthropic、豆包、扣子、模型降级容错
- **密钥管理**: 安全存储、环境变量、密钥引用、脱敏显示、审计日志
- **消息通道**: Telegram/Discord/Slack/WeCom/Feishu/DingTalk、增强路由、权限控制
- **上下文管理**: Token估算、自动压缩、会话历史、智能选择

### 自动化能力
- **浏览器持久化**: 保持登录状态、多页面管理、设备模拟、性能追踪
- **桌面双后端**: pyautogui + pywinauto 自动切换、窗口管理、UI自动化
- **剪贴板跨平台**: 复制粘贴、历史记录、文件操作
- **Shell环境管理**: 命令查找、环境变量、执行控制

### 安全与性能
- **全面安全**: 路径守卫、输入验证、SSRF防护、速率限制、内容安全
- **错误恢复**: 增强重试、指数退避、自我修复、错误分类
- **性能优化**: 缓存系统、文本分块、速率限制、并发控制、超时管理
- **诊断监控**: 诊断事件、模型使用追踪、结构化日志、敏感信息脱敏

### 开发支持
- **配置管理**: 环境配置、需求评估、运行时验证、密钥管理
- **Git集成**: Git工具、版本控制、提交管理
- **集群管理**: 节点发现、远程执行、资源共享
- **技能系统**: 依赖管理、自动安装、元数据、技能目录

## 许可证

MIT

## 贡献

欢迎提交 Issue 和 Pull Request！

## 更新日志

### v2.0 (2026-03-13)
- ✅ 新增85个Node.js模块（从20个扩展到85个）
- ✅ 新增约850个工具（从149个扩展到约850个）
- ✅ 新增secrets模块 - 密钥安全管理
- ✅ 新增channels-enhanced模块 - 增强消息路由
- ✅ 新增web-gateway模块 - Web远程控制
- ✅ 新增context-engine模块 - 智能上下文管理
- ✅ 新增markdown/media/logging模块 - 内容处理
- ✅ 新增retry-policy/error-handler模块 - 增强容错
- ✅ 新增rate-limit/text-chunking/dedupe-cache模块 - 性能优化
- ✅ 新增security-utils/file-security模块 - 安全防护
- ✅ 新增system-utils/shell-env/os-summary模块 - 系统管理
- ✅ 新增git-utils/env-config模块 - 配置管理
- ✅ 新增cli-format/plugin-tools模块 - 开发工具
- ✅ 新增wsl/stable-node-path/machine-name模块 - 平台兼容
- ✅ 新增archive/runtime-system模块 - 基础设施
- ✅ 新增diagnostic-events/agent-events/channel-activity模块 - 监控诊断
- ✅ 新增path-resolver/executable-path/process-monitor模块 - 系统工具
- ✅ 新增data-validation/secret-file/json-files-enhanced模块 - 数据处理
- ✅ 新增subagents-format/reasoning-tags/assistant-visible-text模块 - AI支持
- ✅ 新增sanitize-text/path-guards模块 - 安全处理
- ✅ 新增http-guard模块 - HTTP防护
- ✅ 新增package-json/map-size模块 - 工具库
- ✅ 新增string-sample/join-segments/code-regions模块 - 文本处理
- ✅ 新增detect-package-manager/is-main模块 - 开发工具
- ✅ 新增fetch-enhanced模块 - 网络请求
- ✅ 新增process-restart/file-lock/abort模块 - 进程管理
- ✅ 新增file-atomic/agent-events模块 - 原子操作与事件
- ✅ 新增object-safety/frontmatter/json-file模块 - 数据安全
- ✅ 新增link-extraction模块 - 链接处理
- ✅ 整合OpenClaw核心功能，参考顶级开源项目设计
- ✅ 完整的脱敏和审计机制，确保敏感信息安全