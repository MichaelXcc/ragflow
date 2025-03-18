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
        
        # print(f"self._param: {self._param}")
        print(f"self._param.variables: {self._param.variables}")
        result = {}

        try:
            # 根据语言类型执行代码
            if language == "python":
                python_result = self._execute_python(code)
                print(f"python_result: {python_result}")
                result = python_result
            else:
                result= f"不支持的语言类型: {language}"
                logger.warning(f"Unsupported language: {language}")
        except Exception as e:
            result = str(e)
            result += f"\n错误: {traceback.format_exc()}"
            logger.error(f"Code execution error: {str(e)}")
        
        return result
    
    def _execute_python(self, code):
        """执行Python代码，直接返回执行结果"""
        
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
                
                # 检查是否有main函数
                if "main" in local_vars and callable(local_vars["main"]):
                    import inspect
                    
                    # 获取main函数的参数信息
                    sig = inspect.signature(local_vars["main"])
                    params = list(sig.parameters.values())
                    
                    # 执行main函数并直接返回结果
                    if params:
                        # 创建None参数列表
                        args = [None] * len(params)
                        # 执行main函数并获取结果
                        return local_vars["main"](*args)
                    else:
                        # 无参数的main函数直接执行
                        return local_vars["main"]()
                # 如果没有main函数但有_result变量，返回_result
                elif "_result" in local_vars:
                    return local_vars["_result"]
                
                # 如果没有main函数和_result，返回标准输出
                print(f"stdout_capture.getvalue(): {stdout_capture.getvalue()}")
                output = stdout_capture.getvalue().strip()
                if output:
                    return output
                    
                # 如果没有任何输出，返回None
                return None
                
        except Exception as e:
            # 发生异常时，返回错误信息
            error_msg = str(e)
            stderr_output = stderr_capture.getvalue()
            if stderr_output:
                error_msg += "\n" + stderr_output
            return f"错误: {error_msg}"
    
    def get_input_elements(self):
        """返回组件的输入元素"""
        return [] 