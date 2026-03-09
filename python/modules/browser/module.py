"""
Browser 浏览器自动化模块 v2.0
基于 Playwright 的浏览器自动化控制

特性：
- 持久化会话 - 保持登录状态
- 页面导航和交互
- 元素查找和操作
- 截图和数据提取
- Cookie 和 Storage 管理
"""

import json
import subprocess
import shutil
from pathlib import Path
from typing import Optional, Dict, List

# 模块配置
IFLOW_DIR = Path(__file__).parent.parent.parent
BROWSER_DIR = IFLOW_DIR / "browser_data"
SESSIONS_DIR = BROWSER_DIR / "sessions"
STATE_DIR = BROWSER_DIR / "state"
STATE_FILE = STATE_DIR / "browser_state.json"


def _ensure_dirs():
    """确保目录存在"""
    BROWSER_DIR.mkdir(parents=True, exist_ok=True)
    SESSIONS_DIR.mkdir(parents=True, exist_ok=True)
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    (STATE_DIR / "user_data").mkdir(parents=True, exist_ok=True)


def _check_playwright() -> bool:
    """检查 Playwright 是否安装"""
    try:
        import playwright
        return True
    except ImportError:
        return False


def _run_browser_script(script: str, timeout: int = 60000) -> str:
    """运行浏览器脚本 (同步版本)"""
    _ensure_dirs()
    
    if not _check_playwright():
        return json.dumps({
            "status": "error",
            "message": "Playwright 未安装。请运行: pip install playwright && playwright install chromium"
        }, ensure_ascii=False)
    
    script_file = BROWSER_DIR / "temp_script.py"
    with open(script_file, 'w', encoding='utf-8') as f:
        f.write(script)
    
    try:
        result = subprocess.run(
            ['python', str(script_file)],
            capture_output=True,
            text=True,
            timeout=timeout / 1000,
            cwd=str(BROWSER_DIR)
        )
        script_file.unlink()
        
        if result.returncode == 0:
            return result.stdout or json.dumps({"status": "ok"})
        else:
            return json.dumps({
                "status": "error",
                "message": result.stderr or "Unknown error"
            }, ensure_ascii=False)
    except subprocess.TimeoutExpired:
        if script_file.exists():
            script_file.unlink()
        return json.dumps({"status": "error", "message": "操作超时"})
    except Exception as e:
        if script_file.exists():
            script_file.unlink()
        return json.dumps({"status": "error", "message": str(e)})


# ============ 工具函数 ============

def browser_open(url: str, headless: bool = False, viewport: dict = None) -> str:
    """
    打开浏览器并导航到 URL (支持持久化会话)
    
    Args:
        url: 目标 URL
        headless: 是否无头模式 (默认 False，方便交互)
        viewport: 视口大小 {"width": 1920, "height": 1080}
    """
    viewport = viewport or {"width": 1920, "height": 1080}
    user_data_dir = STATE_DIR / "user_data"
    user_data_dir.mkdir(parents=True, exist_ok=True)
    
    script = f'''
from playwright.sync_api import sync_playwright
import json

def main():
    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            user_data_dir=str(r'{user_data_dir}'),
            headless={headless},
            viewport={{'width': {viewport['width']}, 'height': {viewport['height']}}}
        )
        
        if len(context.pages) > 0:
            page = context.pages[0]
        else:
            page = context.new_page()
        
        page.goto('{url}', wait_until='networkidle', timeout=60000)
        
        context.storage_state(path=str(r'{STATE_FILE}'))
        
        print(json.dumps({{
            "status": "ok",
            "title": page.title(),
            "url": page.url,
            "state_saved": True
        }}, ensure_ascii=False))
        
        context.close()

main()
'''
    return _run_browser_script(script, timeout=90000)


def browser_navigate(url: str, wait_until: str = "networkidle") -> str:
    """导航到新 URL (保持会话状态)"""
    user_data_dir = STATE_DIR / "user_data"
    
    script = f'''
from playwright.sync_api import sync_playwright
import json

def main():
    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            user_data_dir=str(r'{user_data_dir}'),
            headless=True
        )
        
        page = context.pages[0] if context.pages else context.new_page()
        page.goto('{url}', wait_until='{wait_until}', timeout=60000)
        context.storage_state(path=str(r'{STATE_FILE}'))
        
        print(json.dumps({{
            "status": "ok",
            "title": page.title(),
            "url": page.url
        }}, ensure_ascii=False))
        
        context.close()

main()
'''
    return _run_browser_script(script, timeout=90000)


def browser_snapshot(selector: str = None) -> str:
    """获取页面快照，返回可交互元素列表"""
    user_data_dir = STATE_DIR / "user_data"
    selector_code = f"page.locator('{selector}')" if selector else "page"
    
    script = f'''
from playwright.sync_api import sync_playwright
import json

def main():
    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            user_data_dir=str(r'{user_data_dir}'),
            headless=True
        )
        
        page = context.pages[0] if context.pages else context.new_page()
        page.wait_for_load_state('networkidle', timeout=10000)
        
        elements = []
        for role in ['button', 'link', 'textbox', 'checkbox', 'combobox', 'menuitem', 'searchbox']:
            locators = page.get_by_role(role)
            count = locators.count()
            for i in range(min(count, 30)):
                el = locators.nth(i)
                try:
                    name = el.get_attribute('aria-label') or el.get_attribute('placeholder') or el.inner_text()[:50]
                    el_id = el.get_attribute('id')
                    if el_id:
                        sel = '#' + el_id
                    else:
                        sel = '[role="' + role + '"]:nth-of-type(' + str(i+1) + ')'
                    elements.append({{
                        'role': role,
                        'name': name.strip() if name else '',
                        'selector': sel
                    }})
                except:
                    pass
        
        context.storage_state(path=str(r'{STATE_FILE}'))
        
        print(json.dumps({{
            "status": "ok",
            "element_count": len(elements),
            "elements": elements[:100],
            "url": page.url,
            "title": page.title()
        }}, ensure_ascii=False))
        
        context.close()

main()
'''
    return _run_browser_script(script, timeout=60000)


def browser_click(selector: str, click_count: int = 1, delay: int = 0) -> str:
    """点击页面元素"""
    user_data_dir = STATE_DIR / "user_data"
    
    script = f'''
from playwright.sync_api import sync_playwright
import json

def main():
    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            user_data_dir=str(r'{user_data_dir}'),
            headless=True
        )
        
        page = context.pages[0] if context.pages else context.new_page()
        
        try:
            element = page.locator('{selector}')
            if {click_count} == 2:
                element.dblclick(delay={delay})
            else:
                element.click(click_count={click_count}, delay={delay})
            
            page.wait_for_load_state('networkidle', timeout=10000)
            context.storage_state(path=str(r'{STATE_FILE}'))
            
            print(json.dumps({{
                "status": "ok",
                "message": "点击成功",
                "selector": '{selector}',
                "url": page.url
            }}, ensure_ascii=False))
        except Exception as e:
            print(json.dumps({{"status": "error", "message": str(e)}}, ensure_ascii=False))
        
        context.close()

main()
'''
    return _run_browser_script(script, timeout=60000)


def browser_fill(selector: str, value: str, clear: bool = True) -> str:
    """填充输入框"""
    user_data_dir = STATE_DIR / "user_data"
    safe_value = value.replace("'", "\\'")
    
    script = f'''
from playwright.sync_api import sync_playwright
import json

def main():
    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            user_data_dir=str(r'{user_data_dir}'),
            headless=True
        )
        
        page = context.pages[0] if context.pages else context.new_page()
        
        try:
            element = page.locator('{selector}')
            if {str(clear).lower()}:
                element.clear()
            element.fill('{safe_value}', timeout=10000)
            
            context.storage_state(path=str(r'{STATE_FILE}'))
            
            print(json.dumps({{
                "status": "ok",
                "message": "填充成功",
                "selector": '{selector}',
                "value": '{safe_value}'
            }}, ensure_ascii=False))
        except Exception as e:
            print(json.dumps({{"status": "error", "message": str(e)}}, ensure_ascii=False))
        
        context.close()

main()
'''
    return _run_browser_script(script, timeout=60000)


def browser_screenshot(path: str = None, full_page: bool = False, 
                       selector: str = None) -> str:
    """截取页面截图"""
    _ensure_dirs()
    save_path = path or str(BROWSER_DIR / "screenshot.png")
    user_data_dir = STATE_DIR / "user_data"
    
    selector_code = f"page.locator('{selector}')" if selector else "page"
    
    script = f'''
from playwright.sync_api import sync_playwright
import json
import base64

def main():
    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            user_data_dir=str(r'{user_data_dir}'),
            headless=True
        )
        
        page = context.pages[0] if context.pages else context.new_page()
        
        try:
            if '{selector}':
                {selector_code}.screenshot(path='{save_path}')
            else:
                page.screenshot(path='{save_path}', full_page={str(full_page).lower()})
            
            with open('{save_path}', 'rb') as f:
                b64 = base64.b64encode(f.read()).decode()
            
            print(json.dumps({{
                "status": "ok",
                "path": '{save_path}',
                "base64_preview": b64[:100] + "..."
            }}, ensure_ascii=False))
        except Exception as e:
            print(json.dumps({{"status": "error", "message": str(e)}}, ensure_ascii=False))
        
        context.close()

main()
'''
    return _run_browser_script(script, timeout=60000)


def browser_get_text(selector: str = None) -> str:
    """获取页面或元素文本"""
    user_data_dir = STATE_DIR / "user_data"
    
    script = f'''
from playwright.sync_api import sync_playwright
import json

def main():
    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            user_data_dir=str(r'{user_data_dir}'),
            headless=True
        )
        
        page = context.pages[0] if context.pages else context.new_page()
        
        try:
            text = page.locator('{selector}').inner_text() if '{selector}' else page.content()
            
            print(json.dumps({{
                "status": "ok",
                "text": text[:5000]
            }}, ensure_ascii=False))
        except Exception as e:
            print(json.dumps({{"status": "error", "message": str(e)}}, ensure_ascii=False))
        
        context.close()

main()
'''
    return _run_browser_script(script)


def browser_evaluate(script_code: str) -> str:
    """在页面中执行 JavaScript"""
    user_data_dir = STATE_DIR / "user_data"
    
    script = f'''
from playwright.sync_api import sync_playwright
import json

def main():
    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            user_data_dir=str(r'{user_data_dir}'),
            headless=True
        )
        
        page = context.pages[0] if context.pages else context.new_page()
        
        try:
            result = page.evaluate("""{script_code}""")
            
            print(json.dumps({{
                "status": "ok",
                "result": result
            }}, ensure_ascii=False, default=str))
        except Exception as e:
            print(json.dumps({{"status": "error", "message": str(e)}}, ensure_ascii=False))
        
        context.close()

main()
'''
    return _run_browser_script(script)


def browser_wait(selector: str = None, timeout: int = 30000, 
                 state: str = "visible") -> str:
    """等待元素或条件"""
    user_data_dir = STATE_DIR / "user_data"
    
    if selector:
        script = f'''
from playwright.sync_api import sync_playwright
import json

def main():
    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            user_data_dir=str(r'{user_data_dir}'),
            headless=True
        )
        
        page = context.pages[0] if context.pages else context.new_page()
        
        try:
            page.wait_for_selector('{selector}', timeout={timeout}, state='{state}')
            print(json.dumps({{"status": "ok", "message": "元素已就绪"}}))
        except Exception as e:
            print(json.dumps({{"status": "error", "message": str(e)}}, ensure_ascii=False))
        
        context.close()

main()
'''
    else:
        return json.dumps({"status": "ok", "message": "等待完成"})
    
    return _run_browser_script(script, timeout=timeout + 5000)


def browser_cookies(action: str = "get", name: str = None, 
                    value: str = None, domain: str = None) -> str:
    """管理 Cookies"""
    user_data_dir = STATE_DIR / "user_data"
    
    if action == "get":
        script = f'''
from playwright.sync_api import sync_playwright
import json

def main():
    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            user_data_dir=str(r'{user_data_dir}'),
            headless=True
        )
        
        cookies = context.cookies()
        
        print(json.dumps({{
            "status": "ok",
            "cookies": cookies[:50]
        }}, ensure_ascii=False))
        
        context.close()

main()
'''
    elif action == "set":
        script = f'''
from playwright.sync_api import sync_playwright
import json

def main():
    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            user_data_dir=str(r'{user_data_dir}'),
            headless=True
        )
        
        context.add_cookies([{{
            'name': '{name}',
            'value': '{value}',
            'domain': '{domain or "example.com"}',
            'path': '/'
        }}])
        
        print(json.dumps({{"status": "ok", "message": "Cookie 已设置"}}))
        
        context.close()

main()
'''
    else:
        script = f'''
from playwright.sync_api import sync_playwright
import json

def main():
    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            user_data_dir=str(r'{user_data_dir}'),
            headless=True
        )
        
        context.clear_cookies()
        print(json.dumps({{"status": "ok", "message": "Cookies 已清除"}}))
        
        context.close()

main()
'''
    return _run_browser_script(script)


def browser_form_fill(fields: list, submit: str = None) -> str:
    """批量填充表单"""
    user_data_dir = STATE_DIR / "user_data"
    
    field_actions = "\n        ".join([
        f"page.fill('{f['selector']}', '{f['value'].replace(chr(39), chr(92)+chr(39))}')"
        for f in fields
    ])
    submit_code = f"page.click('{submit}')" if submit else ""
    
    script = f'''
from playwright.sync_api import sync_playwright
import json

def main():
    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            user_data_dir=str(r'{user_data_dir}'),
            headless=True
        )
        
        page = context.pages[0] if context.pages else context.new_page()
        
        try:
            {field_actions}
            {submit_code}
            
            context.storage_state(path=str(r'{STATE_FILE}'))
            
            print(json.dumps({{
                "status": "ok",
                "fields_filled": {len(fields)},
                "submitted": {str(submit is not None).lower()}
            }}, ensure_ascii=False))
        except Exception as e:
            print(json.dumps({{"status": "error", "message": str(e)}}, ensure_ascii=False))
        
        context.close()

main()
'''
    return _run_browser_script(script)


def browser_extract(url: str, selectors: dict) -> str:
    """从页面提取结构化数据"""
    user_data_dir = STATE_DIR / "user_data"
    
    script = f'''
from playwright.sync_api import sync_playwright
import json

def main():
    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            user_data_dir=str(r'{user_data_dir}'),
            headless=True
        )
        
        page = context.pages[0] if context.pages else context.new_page()
        page.goto('{url}', wait_until='networkidle', timeout=60000)
        
        data = {{}}
        selectors = {selectors}
        
        for key, sel in selectors.items():
            try:
                data[key] = page.locator(sel).inner_text()
            except:
                data[key] = None
        
        print(json.dumps({{
            "status": "ok",
            "url": '{url}',
            "data": data
        }}, ensure_ascii=False))
        
        context.close()

main()
'''
    return _run_browser_script(script)


def browser_check() -> str:
    """检查浏览器环境和 Playwright 状态"""
    result = {
        "playwright_installed": _check_playwright(),
        "browser_dir": str(BROWSER_DIR),
        "sessions_dir": str(SESSIONS_DIR),
        "state_dir": str(STATE_DIR),
        "state_file": str(STATE_FILE),
        "has_saved_state": STATE_FILE.exists()
    }
    
    if _check_playwright():
        try:
            import playwright.sync_api
            result["playwright_version"] = getattr(playwright.sync_api, '__version__', 'unknown')
        except:
            pass
    
    return json.dumps({
        "status": "ok",
        "environment": result
    }, ensure_ascii=False, indent=2)


def browser_clear_state() -> str:
    """清除保存的浏览器状态 (cookies, localStorage)"""
    try:
        if STATE_FILE.exists():
            STATE_FILE.unlink()
        
        user_data_dir = STATE_DIR / "user_data"
        if user_data_dir.exists():
            shutil.rmtree(user_data_dir)
            user_data_dir.mkdir(parents=True, exist_ok=True)
        
        return json.dumps({
            "status": "ok",
            "message": "浏览器状态已清除，下次打开将重新开始"
        }, ensure_ascii=False)
    except Exception as e:
        return json.dumps({
            "status": "error",
            "message": str(e)
        }, ensure_ascii=False)


# ============ 模块定义 ============

MODULE_DEF = {
    "name": "browser",
    "version": "2.0.0",
    "description": "浏览器自动化 v2.0 - 支持持久化会话，保持登录状态",
    "tools": [
        {
            "name": "browser_open",
            "description": "打开浏览器并导航到 URL (支持持久化会话)",
            "input_schema": {
                "type": "object",
                "properties": {
                    "url": {"type": "string", "description": "目标 URL"},
                    "headless": {"type": "boolean", "description": "是否无头模式", "default": False},
                    "viewport": {
                        "type": "object",
                        "properties": {
                            "width": {"type": "integer", "default": 1920},
                            "height": {"type": "integer", "default": 1080}
                        }
                    }
                },
                "required": ["url"]
            },
            "handler": browser_open
        },
        {
            "name": "browser_navigate",
            "description": "导航到新 URL (保持会话状态)",
            "input_schema": {
                "type": "object",
                "properties": {
                    "url": {"type": "string", "description": "目标 URL"},
                    "wait_until": {
                        "type": "string",
                        "enum": ["load", "domcontentloaded", "networkidle"],
                        "default": "networkidle"
                    }
                },
                "required": ["url"]
            },
            "handler": browser_navigate
        },
        {
            "name": "browser_snapshot",
            "description": "获取页面快照，返回可交互元素列表",
            "input_schema": {
                "type": "object",
                "properties": {
                    "selector": {"type": "string", "description": "CSS 选择器，限定快照范围"}
                }
            },
            "handler": browser_snapshot
        },
        {
            "name": "browser_click",
            "description": "点击页面元素",
            "input_schema": {
                "type": "object",
                "properties": {
                    "selector": {"type": "string", "description": "CSS 选择器"},
                    "click_count": {"type": "integer", "description": "点击次数", "default": 1},
                    "delay": {"type": "integer", "description": "点击间隔毫秒", "default": 0}
                },
                "required": ["selector"]
            },
            "handler": browser_click
        },
        {
            "name": "browser_fill",
            "description": "填充输入框",
            "input_schema": {
                "type": "object",
                "properties": {
                    "selector": {"type": "string", "description": "CSS 选择器"},
                    "value": {"type": "string", "description": "填充值"},
                    "clear": {"type": "boolean", "description": "是否先清空", "default": True}
                },
                "required": ["selector", "value"]
            },
            "handler": browser_fill
        },
        {
            "name": "browser_screenshot",
            "description": "截取页面截图",
            "input_schema": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "保存路径"},
                    "full_page": {"type": "boolean", "description": "是否全页面截图", "default": False},
                    "selector": {"type": "string", "description": "截取特定元素"}
                }
            },
            "handler": browser_screenshot
        },
        {
            "name": "browser_get_text",
            "description": "获取页面或元素文本",
            "input_schema": {
                "type": "object",
                "properties": {
                    "selector": {"type": "string", "description": "CSS 选择器"}
                }
            },
            "handler": browser_get_text
        },
        {
            "name": "browser_evaluate",
            "description": "在页面中执行 JavaScript",
            "input_schema": {
                "type": "object",
                "properties": {
                    "script_code": {"type": "string", "description": "JavaScript 代码"}
                },
                "required": ["script_code"]
            },
            "handler": browser_evaluate
        },
        {
            "name": "browser_wait",
            "description": "等待元素或条件",
            "input_schema": {
                "type": "object",
                "properties": {
                    "selector": {"type": "string", "description": "CSS 选择器"},
                    "timeout": {"type": "integer", "description": "超时时间(毫秒)", "default": 30000},
                    "state": {
                        "type": "string",
                        "enum": ["visible", "hidden", "attached", "detached"],
                        "default": "visible"
                    }
                }
            },
            "handler": browser_wait
        },
        {
            "name": "browser_cookies",
            "description": "管理 Cookies",
            "input_schema": {
                "type": "object",
                "properties": {
                    "action": {"type": "string", "enum": ["get", "set", "clear"], "default": "get"},
                    "name": {"type": "string", "description": "Cookie 名称"},
                    "value": {"type": "string", "description": "Cookie 值"},
                    "domain": {"type": "string", "description": "Cookie 域名"}
                }
            },
            "handler": browser_cookies
        },
        {
            "name": "browser_form_fill",
            "description": "批量填充表单",
            "input_schema": {
                "type": "object",
                "properties": {
                    "fields": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "selector": {"type": "string"},
                                "value": {"type": "string"}
                            }
                        }
                    },
                    "submit": {"type": "string", "description": "提交按钮选择器"}
                },
                "required": ["fields"]
            },
            "handler": browser_form_fill
        },
        {
            "name": "browser_extract",
            "description": "从页面提取结构化数据",
            "input_schema": {
                "type": "object",
                "properties": {
                    "url": {"type": "string", "description": "目标 URL"},
                    "selectors": {"type": "object", "description": "选择器映射"}
                },
                "required": ["url", "selectors"]
            },
            "handler": browser_extract
        },
        {
            "name": "browser_check",
            "description": "检查浏览器环境和 Playwright 状态",
            "input_schema": {"type": "object", "properties": {}},
            "handler": browser_check
        },
        {
            "name": "browser_clear_state",
            "description": "清除保存的浏览器状态 (重新登录用)",
            "input_schema": {"type": "object", "properties": {}},
            "handler": browser_clear_state
        }
    ]
}