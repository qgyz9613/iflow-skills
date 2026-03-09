#!/usr/bin/env python3
"""
iFlow MCP Server - 模块化工具服务器
自动扫描并加载 modules/ 目录下的所有模块

特性：
- 自动发现和加载模块
- 输出长度限制（防止超 token）
- 智能截断提示
"""

import asyncio
import importlib.util
import sys
import os
import json
from pathlib import Path
from typing import Any, Callable

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent

# 模块目录
IFLOW_DIR = Path(__file__).parent.parent
MODULES_DIR = IFLOW_DIR / "modules"
STATE_DIR = IFLOW_DIR / "workflow-state"

# 输出限制配置
MAX_OUTPUT_CHARS = 50000      # 最大输出字符数（约 12-15K tokens）
MAX_OUTPUT_LINES = 500        # 最大输出行数
TRUNCATION_MESSAGE = "\n\n⚠️ [输出已截断] 内容过长，已截断以避免超出 API 限制。\n如需完整内容，请使用分批查询或指定更小的范围。"


class ModuleLoader:
    """模块加载器 - 自动发现并加载模块"""
    
    def __init__(self, modules_dir: Path):
        self.modules_dir = modules_dir
        self.tools: dict[str, Callable] = {}
        self.tool_definitions: list[Tool] = []
        self.modules_info: list[dict] = []
    
    def discover_modules(self) -> list[Path]:
        """扫描模块目录，发现所有可用模块"""
        modules = []
        if not self.modules_dir.exists():
            self.modules_dir.mkdir(parents=True, exist_ok=True)
            print(f"[MCP] 创建模块目录: {self.modules_dir}", file=sys.stderr)
            return modules
        
        for module_path in self.modules_dir.iterdir():
            if module_path.is_dir():
                module_file = module_path / "module.py"
                if module_file.exists():
                    modules.append(module_path)
                else:
                    print(f"[MCP] 跳过无效模块: {module_path.name} (缺少 module.py)", file=sys.stderr)
        return modules
    
    def load_module(self, module_path: Path) -> dict | None:
        """动态加载单个模块"""
        module_file = module_path / "module.py"
        try:
            spec = importlib.util.spec_from_file_location(
                f"iflow_modules.{module_path.name}", 
                module_file
            )
            if spec is None or spec.loader is None:
                print(f"[MCP] 无法加载模块规格: {module_path.name}", file=sys.stderr)
                return None
                
            module = importlib.util.module_from_spec(spec)
            sys.modules[spec.name] = module
            spec.loader.exec_module(module)
            
            # 获取模块定义
            if hasattr(module, 'MODULE_DEF'):
                return module.MODULE_DEF
            else:
                print(f"[MCP] 模块缺少 MODULE_DEF: {module_path.name}", file=sys.stderr)
                return None
        except Exception as e:
            print(f"[MCP] 加载模块异常 {module_path.name}: {e}", file=sys.stderr)
            return None
    
    def load_all(self):
        """加载所有模块"""
        print(f"[MCP] 开始扫描模块目录: {self.modules_dir}", file=sys.stderr)
        discovered = self.discover_modules()
        print(f"[MCP] 发现 {len(discovered)} 个模块", file=sys.stderr)
        
        for module_path in discovered:
            module_def = self.load_module(module_path)
            if module_def:
                self._register_module(module_def)
                self.modules_info.append({
                    "name": module_def.get("name", module_path.name),
                    "version": module_def.get("version", "0.0.0"),
                    "description": module_def.get("description", ""),
                    "tools_count": len(module_def.get("tools", []))
                })
                print(f"[MCP] ✓ 已加载模块: {module_def.get('name', module_path.name)} "
                      f"({len(module_def.get('tools', []))} 个工具)", file=sys.stderr)
        
        print(f"[MCP] 模块加载完成，共 {len(self.tools)} 个工具可用", file=sys.stderr)
    
    def _register_module(self, module_def: dict):
        """注册模块的工具到 MCP"""
        module_name = module_def.get("name", "unknown")
        
        for tool in module_def.get("tools", []):
            tool_name = tool.get("name")
            if not tool_name:
                print(f"[MCP] 模块 {module_name} 有工具缺少名称，跳过", file=sys.stderr)
                continue
            
            # 检查工具名冲突
            if tool_name in self.tools:
                print(f"[MCP] 警告: 工具名冲突 '{tool_name}'，将被覆盖", file=sys.stderr)
            
            handler = tool.get("handler")
            if handler is None:
                print(f"[MCP] 工具 {tool_name} 缺少 handler，跳过", file=sys.stderr)
                continue
            
            self.tools[tool_name] = handler
            self.tool_definitions.append(
                Tool(
                    name=tool_name,
                    description=tool.get("description", ""),
                    inputSchema=tool.get("input_schema", {"type": "object", "properties": {}})
                )
            )


def truncate_output(text: str, max_chars: int = MAX_OUTPUT_CHARS, max_lines: int = MAX_OUTPUT_LINES) -> str:
    """
    智能截断输出内容
    
    按以下优先级截断：
    1. 如果是 JSON，尝试截断数组元素
    2. 按行数截断
    3. 按字符数截断
    """
    if len(text) <= max_chars and text.count('\n') <= max_lines:
        return text
    
    lines = text.split('\n')
    total_lines = len(lines)
    truncated = False
    
    # 尝试解析 JSON 并智能截断
    try:
        data = json.loads(text)
        if isinstance(data, list):
            # 数组：保留前后部分
            if len(data) > 50:
                truncated_data = data[:25] + [{"...truncated...": f"已省略 {len(data) - 50} 项"}] + data[-25:]
                text = json.dumps(truncated_data, ensure_ascii=False, indent=2)
                truncated = True
        elif isinstance(data, dict):
            # 对象：检查是否有大数组字段
            for key, value in list(data.items()):
                if isinstance(value, list) and len(value) > 50:
                    data[key] = value[:25] + [f"...{len(value) - 50} items truncated..."] + value[-25:]
                    truncated = True
            if truncated:
                text = json.dumps(data, ensure_ascii=False, indent=2)
    except (json.JSONDecodeError, TypeError):
        pass
    
    # 如果还是太长，按行截断
    if len(text) > max_chars or text.count('\n') > max_lines:
        lines = text.split('\n')
        if len(lines) > max_lines:
            half = max_lines // 2
            text = '\n'.join(lines[:half] + [f"\n... 已省略 {len(lines) - max_lines} 行 ...\n"] + lines[-half:])
            truncated = True
    
    # 最终按字符截断
    if len(text) > max_chars:
        half = max_chars // 2
        text = text[:half] + TRUNCATION_MESSAGE + text[-half:]
        truncated = True
    
    if truncated and TRUNCATION_MESSAGE.strip() not in text:
        text += TRUNCATION_MESSAGE
    
    return text


def create_server() -> Server:
    """创建 MCP 服务器"""
    server = Server("iflow-modules")
    loader = ModuleLoader(MODULES_DIR)
    loader.load_all()
    
    @server.list_tools()
    async def list_tools() -> list[Tool]:
        """列出所有可用工具"""
        return loader.tool_definitions
    
    @server.call_tool()
    async def call_tool(name: str, arguments: dict) -> list[TextContent]:
        """执行工具调用"""
        if name not in loader.tools:
            return [TextContent(
                type="text", 
                text=f"错误: 未知工具 '{name}'\n可用工具: {', '.join(loader.tools.keys())}"
            )]
        
        try:
            handler = loader.tools[name]
            
            # 支持同步和异步处理器
            if asyncio.iscoroutinefunction(handler):
                result = await handler(**arguments)
            else:
                result = handler(**arguments)
            
            # 格式化结果
            if isinstance(result, str):
                text = result
            elif isinstance(result, dict) or isinstance(result, list):
                text = json.dumps(result, ensure_ascii=False, indent=2)
            else:
                text = str(result)
            
            # 自动截断过长内容
            text = truncate_output(text)
            
            return [TextContent(type="text", text=text)]
            
        except TypeError as e:
            # 参数错误
            return [TextContent(type="text", text=f"参数错误: {e}\n请检查工具参数格式")]
        except Exception as e:
            import traceback
            return [TextContent(
                type="text", 
                text=f"执行错误: {type(e).__name__}: {e}\n\n{traceback.format_exc()}"
            )]
    
    return server


async def main():
    """主入口"""
    # 确保状态目录存在
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    
    server = create_server()
    
    print("[MCP] iFlow Modules MCP Server 启动中...", file=sys.stderr)
    print("[MCP] 等待 iflow 连接...", file=sys.stderr)
    
    async with stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream, 
            write_stream, 
            server.create_initialization_options()
        )


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n[MCP] 服务器已停止", file=sys.stderr)
    except Exception as e:
        print(f"[MCP] 服务器错误: {e}", file=sys.stderr)
        sys.exit(1)