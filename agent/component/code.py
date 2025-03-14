#
#  Copyright 2024 The InfiniFlow Authors. All Rights Reserved.
#
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
#
import sys
import io
import traceback
import json
import logging
from abc import ABC
from contextlib import redirect_stdout, redirect_stderr
from agent.component.base import ComponentBase, ComponentParamBase
import pandas as pd

logger = logging.getLogger(__name__)

class CodeParam(ComponentParamBase):
    """
    Define the Code component parameters.
    """
    def __init__(self):
        super().__init__()
        self.code = ""
        self.language = "python"  # python, javascript, shell等
        self.timeout = 30  # 执行超时时间（秒）

    def check(self):
        self.check_string(self.code, "[Code] code")
        self.check_string(self.language, "[Code] language")
        self.check_positive_integer(self.timeout, "[Code] timeout")
        return True


class Code(ComponentBase, ABC):
    component_name = "Code"

    def _run(self, history, **kwargs):
        """执行代码并返回结果"""
        return self._execute_code()
    
    def debug(self):
        """调试代码执行"""
        # 从debug_inputs中获取参数
        if hasattr(self._param, 'debug_inputs'):
            # 解析debug_inputs
            for param in self._param.debug_inputs:
                if param.get('key') == 'code' and param.get('value'):
                    self._param.code = param.get('value')
                elif param.get('key') == 'language' and param.get('value'):
                    self._param.language = param.get('value')
        
        # 执行代码
        result = self._execute_code()
        
        # 转换为Debug API需要的DataFrame格式
        df = pd.DataFrame([result])
        return df
    
    def _execute_code(self):
        """根据语言类型执行代码"""
        language = self._param.language.lower()
        code = self._param.code
        
        # 创建结果对象
        result = {
            "success": False,
            "output": "",
            "error": "",
            "result": None
        }
        
        try:
            # 根据语言类型执行代码
            if language == "python":
                result = self._execute_python(code)
            else:
                result["error"] = f"不支持的语言类型: {language}"
                logger.warning(f"Unsupported language: {language}")
        except Exception as e:
            result["error"] = str(e)
            result["output"] += f"\n错误: {traceback.format_exc()}"
            logger.error(f"Code execution error: {str(e)}")
        
        return result
    
    def _execute_python(self, code):
        """执行Python代码"""
        result = {
            "success": False,
            "output": "",
            "error": "",
            "result": None
        }
        
        # 捕获标准输出和错误
        stdout_capture = io.StringIO()
        stderr_capture = io.StringIO()
        
        try:
            # 重定向输出
            with redirect_stdout(stdout_capture), redirect_stderr(stderr_capture):
                # 创建本地命名空间
                local_vars = {}
                
                # 执行代码
                exec(code, {}, local_vars)
                
                # 尝试获取返回值 (如果有)
                if "_result" in local_vars:
                    result["result"] = local_vars["_result"]
                
                # 捕获输出并处理空格
                output = stdout_capture.getvalue()
                # 去除开头和结尾的空白字符，保留中间的格式
                output = output.strip()
                result["output"] = output
                
                # 标记成功
                result["success"] = True
        except Exception as e:
            result["error"] = str(e)
            result["output"] = stdout_capture.getvalue()
            result["error"] += "\n" + stderr_capture.getvalue()
            
        return result
    
    def get_input_elements(self):
        """返回组件的输入元素"""
        return [] 