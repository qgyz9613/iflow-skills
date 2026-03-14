# -*- coding: utf-8 -*-
"""
智能点击工具 - 一次或两次完成精准点击

使用方法：
    from smart_click import SmartClick
    
    # 初始化
    clicker = SmartClick(window_title="抖音")
    
    # 方法1：使用预设坐标（一次完成）
    clicker.quick_click('精选')
    
    # 方法2：定位新按钮（两次完成）
    clicker.locate_and_click('新按钮名称')

作者: iFlow CLI
版本: 1.0.0
"""

import ctypes
import time
import json
import os
from pathlib import Path
from typing import Dict, Tuple, Optional
from dataclasses import dataclass

try:
    from PIL import ImageGrab, ImageDraw
    import pyautogui
except ImportError:
    print("请安装依赖: pip install pillow pyautogui")
    raise


@dataclass
class ButtonCoord:
    """按钮坐标"""
    name: str
    window_x: int  # 窗口内相对坐标
    window_y: int
    verified: bool = False  # 是否已验证


class SmartClick:
    """智能点击工具"""
    
    def __init__(self, window_title: str = None, hwnd: int = None):
        """
        初始化
        
        Args:
            window_title: 窗口标题（模糊匹配）
            hwnd: 窗口句柄（优先使用）
        """
        self.hwnd = hwnd or self._find_window(window_title)
        self.preset_coords: Dict[str, ButtonCoord] = {}
        self.config_dir = Path.home() / ".iflow" / "smart_click"
        self.config_file = self.config_dir / f"coords_{self.hwnd}.json"
        
        # 加载预设坐标
        self._load_presets()
    
    def _find_window(self, title: str) -> int:
        """查找窗口句柄"""
        hwnd = ctypes.windll.user32.FindWindowW(None, title)
        if not hwnd:
            raise ValueError(f"未找到窗口: {title}")
        return hwnd
    
    def _get_window_rect(self) -> Tuple[int, int, int, int]:
        """获取窗口位置 (left, top, right, bottom)"""
        class RECT(ctypes.Structure):
            _fields_ = [('left', ctypes.c_long), ('top', ctypes.c_long), 
                        ('right', ctypes.c_long), ('bottom', ctypes.c_long)]
        rect = RECT()
        ctypes.windll.user32.GetWindowRect(self.hwnd, ctypes.byref(rect))
        return rect.left, rect.top, rect.right, rect.bottom
    
    def _window_to_screen(self, window_x: int, window_y: int) -> Tuple[int, int]:
        """窗口坐标转屏幕坐标"""
        left, top, _, _ = self._get_window_rect()
        return left + window_x, top + window_y
    
    def _load_presets(self):
        """加载预设坐标"""
        if self.config_file.exists():
            try:
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    for name, coords in data.items():
                        self.preset_coords[name] = ButtonCoord(
                            name=name,
                            window_x=coords['x'],
                            window_y=coords['y'],
                            verified=coords.get('verified', False)
                        )
            except Exception as e:
                print(f"加载预设坐标失败: {e}")
    
    def _save_presets(self):
        """保存预设坐标"""
        self.config_dir.mkdir(parents=True, exist_ok=True)
        data = {}
        for name, coord in self.preset_coords.items():
            data[name] = {
                'x': coord.window_x,
                'y': coord.window_y,
                'verified': coord.verified
            }
        with open(self.config_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    
    # ==================== 核心功能 ====================
    
    def capture_with_grid(self, region: Tuple[int, int, int, int] = (0, 0, 250, 350),
                          save_path: str = None) -> str:
        """
        截取区域并添加刻度网格
        
        Args:
            region: (x1, y1, x2, y2) 相对于窗口的截取区域
            save_path: 保存路径（可选）
        
        Returns:
            截图保存路径
        """
        left, top, _, _ = self._get_window_rect()
        
        # 计算屏幕绝对坐标
        x1 = left + region[0]
        y1 = top + region[1]
        x2 = left + region[2]
        y2 = top + region[3]
        
        # 截图
        screenshot = ImageGrab.grab(bbox=(x1, y1, x2, y2))
        draw = ImageDraw.Draw(screenshot)
        
        # 添加刻度网格（每 25px 一条线）
        width, height = screenshot.size
        for i in range(0, width, 25):
            draw.line([(i, 0), (i, height)], fill='cyan', width=1)
            if i % 50 == 0:
                draw.text((i+2, 2), str(i), fill='yellow')
        
        for i in range(0, height, 25):
            draw.line([(0, i), (width, i)], fill='cyan', width=1)
            if i % 50 == 0:
                draw.text((2, i+2), str(i), fill='yellow')
        
        # 保存
        if not save_path:
            save_path = str(Path.home() / ".iflow" / "desktop_data" / "screenshots" / "grid_capture.png")
            Path(save_path).parent.mkdir(parents=True, exist_ok=True)
        
        screenshot.save(save_path)
        return save_path
    
    def verify_mouse_position(self, window_x: int, window_y: int,
                               region: Tuple[int, int, int, int] = (0, 0, 250, 350)) -> str:
        """
        移动鼠标到目标位置并截图验证
        
        Args:
            window_x, window_y: 窗口内相对坐标
            region: 验证截图区域
        
        Returns:
            验证截图保存路径
        """
        screen_x, screen_y = self._window_to_screen(window_x, window_y)
        
        # 移动鼠标
        pyautogui.moveTo(screen_x, screen_y)
        time.sleep(0.1)
        
        # 截取验证区域
        left, top, _, _ = self._get_window_rect()
        x1 = left + region[0]
        y1 = top + region[1]
        x2 = left + region[2]
        y2 = top + region[3]
        
        screenshot = ImageGrab.grab(bbox=(x1, y1, x2, y2))
        draw = ImageDraw.Draw(screenshot)
        
        # 计算鼠标在截图中的位置
        local_x = screen_x - x1
        local_y = screen_y - y1
        r = 15
        
        # 画十字准星
        draw.ellipse([local_x-r, local_y-r, local_x+r, local_y+r], 
                     outline='lime', width=3)
        draw.line([local_x-r, local_y, local_x+r, local_y], fill='lime', width=2)
        draw.line([local_x, local_y-r, local_x, local_y+r], fill='lime', width=2)
        
        # 保存
        save_path = str(Path.home() / ".iflow" / "desktop_data" / "screenshots" / "verify_mouse.png")
        Path(save_path).parent.mkdir(parents=True, exist_ok=True)
        screenshot.save(save_path)
        
        return save_path
    
    def click_at(self, window_x: int, window_y: int) -> Tuple[int, int]:
        """
        在窗口内坐标点击
        
        Args:
            window_x, window_y: 窗口内相对坐标
        
        Returns:
            屏幕绝对坐标 (x, y)
        """
        screen_x, screen_y = self._window_to_screen(window_x, window_y)
        pyautogui.click(screen_x, screen_y)
        return screen_x, screen_y
    
    # ==================== 高级功能 ====================
    
    def quick_click(self, button_name: str) -> Tuple[int, int]:
        """
        快速点击预设按钮（一次完成）
        
        Args:
            button_name: 按钮名称
        
        Returns:
            屏幕坐标 (x, y)
        
        Raises:
            ValueError: 按钮未预设
        """
        if button_name not in self.preset_coords:
            raise ValueError(f"未知按钮: {button_name}，请先使用 locate_button 定位")
        
        coord = self.preset_coords[button_name]
        return self.click_at(coord.window_x, coord.window_y)
    
    def save_preset(self, button_name: str, window_x: int, window_y: int, verified: bool = True):
        """
        保存按钮坐标到预设
        
        Args:
            button_name: 按钮名称
            window_x, window_y: 窗口内相对坐标
            verified: 是否已验证
        """
        self.preset_coords[button_name] = ButtonCoord(
            name=button_name,
            window_x=window_x,
            window_y=window_y,
            verified=verified
        )
        self._save_presets()
        print(f"已保存预设: {button_name} -> ({window_x}, {window_y})")
    
    def locate_button(self, button_name: str, 
                      region: Tuple[int, int, int, int] = (0, 0, 250, 350)) -> dict:
        """
        定位新按钮（需要配合 AI 视觉分析）
        
        流程：
        1. 截图 + 刻度网格 → 返回路径供 AI 分析
        2. AI 给出坐标后，调用 verify_mouse_position 验证
        3. 验证通过后，调用 save_preset 保存
        
        Args:
            button_name: 按钮名称
            region: 截图区域
        
        Returns:
            {'grid_image': 截图路径, 'prompt': AI 提示词}
        """
        grid_path = self.capture_with_grid(region)
        
        prompt = f"""这是应用窗口的截图，带有每25像素一条青色刻度线，每50像素有黄色数字标注。

请根据刻度线，告诉我 "{button_name}" 按钮的中心坐标(x,y)。

请利用图上的刻度精确读取，格式：({button_name}: (x, y))"""
        
        return {
            'grid_image': grid_path,
            'prompt': prompt,
            'instructions': [
                '1. 将截图发送给 AI 进行分析',
                '2. AI 返回坐标后，调用 verify_mouse_position(window_x, window_y) 验证',
                '3. 验证通过后，调用 save_preset(button_name, window_x, window_y) 保存',
            ]
        }
    
    def locate_and_click(self, button_name: str, 
                          window_x: int, window_y: int,
                          verify: bool = True) -> dict:
        """
        定位并点击（两次完成：验证 + 点击）
        
        Args:
            button_name: 按钮名称
            window_x, window_y: AI 分析得到的窗口内坐标
            verify: 是否验证
        
        Returns:
            {'success': bool, 'coords': (x, y), 'verify_image': str}
        """
        result = {
            'success': False,
            'coords': (window_x, window_y),
            'verify_image': None
        }
        
        if verify:
            verify_path = self.verify_mouse_position(window_x, window_y)
            result['verify_image'] = verify_path
            result['instructions'] = '请查看验证截图，确认鼠标是否对准目标。如对准，调用 confirm_and_click()'
            result['pending_click'] = (window_x, window_y)
            return result
        
        # 直接点击
        screen_x, screen_y = self.click_at(window_x, window_y)
        self.save_preset(button_name, window_x, window_y)
        result['success'] = True
        result['screen_coords'] = (screen_x, screen_y)
        return result
    
    def confirm_and_click(self, button_name: str, window_x: int, window_y: int):
        """确认后点击并保存预设"""
        screen_x, screen_y = self.click_at(window_x, window_y)
        self.save_preset(button_name, window_x, window_y, verified=True)
        return {'success': True, 'screen_coords': (screen_x, screen_y)}


# ==================== 便捷函数 ====================

def quick_click_douyin(button_name: str) -> Tuple[int, int]:
    """快速点击抖音按钮（便捷函数）"""
    clicker = SmartClick(window_title="抖音")
    return clicker.quick_click(button_name)


# 抖音常用按钮预设坐标（窗口内坐标）
DOUYIN_BUTTONS = {
    '精选': (88, 100),
    '推荐': (88, 150),
    '关注': (88, 250),
    '朋友': (88, 300),
    '我的': (88, 350),
    '直播': (88, 400),
    '放映厅': (88, 450),
}


if __name__ == '__main__':
    # 测试
    print("智能点击工具 v1.0.0")
    print("使用方法:")
    print("  from smart_click import SmartClick")
    print("  clicker = SmartClick(window_title='抖音')")
    print("  clicker.quick_click('精选')")
