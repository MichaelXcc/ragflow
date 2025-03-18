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
import logging
import json
from copy import deepcopy
from functools import partial

import pandas as pd

from agent.component import component_class
from agent.component.base import ComponentBase


class Canvas:
    """
    Canvas类是工作流引擎的核心类，负责管理组件之间的连接和执行流程。
    它通过DSL（领域特定语言）配置来定义组件和它们之间的关系。
    
    DSL示例:
    dsl = {
        "components": {
            "begin": {
                "obj":{
                    "component_name": "Begin",
                    "params": {},
                },
                "downstream": ["answer_0"],
                "upstream": [],
            },
            "answer_0": {
                "obj": {
                    "component_name": "Answer",
                    "params": {}
                },
                "downstream": ["retrieval_0"],
                "upstream": ["begin", "generate_0"],
            },
            "retrieval_0": {
                "obj": {
                    "component_name": "Retrieval",
                    "params": {}
                },
                "downstream": ["generate_0"],
                "upstream": ["answer_0"],
            },
            "generate_0": {
                "obj": {
                    "component_name": "Generate",
                    "params": {}
                },
                "downstream": ["answer_0"],
                "upstream": ["retrieval_0"],
            }
        },
        "history": [],        # 对话历史
        "messages": [],       # 消息列表
        "reference": [],      # 参考信息
        "path": [["begin"]],  # 执行路径
        "answer": []          # 答案组件列表
    }
    """

    def __init__(self, dsl: str, tenant_id=None):
        """
        初始化Canvas对象
        
        参数:
            dsl (str): 包含工作流定义的DSL字符串
            tenant_id (str, 可选): 租户ID，用于多租户环境
        """
        self.path = []           # 执行路径，记录组件执行的顺序
        self.history = []        # 对话历史记录
        self.messages = []       # 消息记录
        self.answer = []         # 答案组件列表
        self.components = {}     # 组件字典，键为组件ID，值为组件对象
        # 解析DSL字符串为字典，如果为空则创建默认DSL配置
        self.dsl = json.loads(dsl) if dsl else {
            "components": {
                "begin": {
                    "obj": {
                        "component_name": "Begin",
                        "params": {
                            "prologue": "Hi there!"
                        }
                    },
                    "downstream": [],
                    "upstream": [],
                    "parent_id": ""
                }
            },
            "history": [],
            "messages": [],
            "reference": [],
            "path": [],
            "answer": []
        }
        self._tenant_id = tenant_id  # 租户ID
        self._embed_id = ""          # 嵌入模型ID
        self.load()                  # 加载DSL配置

    def load(self):
        """
        加载DSL配置，初始化所有组件对象
        """
        self.components = self.dsl["components"]
        cpn_nms = set([])
        # 收集所有组件名称
        for k, cpn in self.components.items():
            cpn_nms.add(cpn["obj"]["component_name"])

        # 确保必要的组件存在
        assert "Begin" in cpn_nms, "There have to be an 'Begin' component."
        assert "Answer" in cpn_nms, "There have to be an 'Answer' component."

        # 初始化每个组件
        for k, cpn in self.components.items():
            cpn_nms.add(cpn["obj"]["component_name"])
            # 创建组件参数对象
            param = component_class(cpn["obj"]["component_name"] + "Param")()
            param.update(cpn["obj"]["params"])
            param.check()
            # 创建组件实例
            cpn["obj"] = component_class(cpn["obj"]["component_name"])(self, k, param)
            # 处理分类组件的特殊情况
            if cpn["obj"].component_name == "Categorize":
                for _, desc in param.category_description.items():
                    if desc["to"] not in cpn["downstream"]:
                        cpn["downstream"].append(desc["to"])

        # 从DSL中加载其他状态
        self.path = self.dsl["path"]
        self.history = self.dsl["history"]
        self.messages = self.dsl["messages"]
        self.answer = self.dsl["answer"]
        self.reference = self.dsl["reference"]
        self._embed_id = self.dsl.get("embed_id", "")

    def __str__(self):
        """
        将Canvas对象转换为DSL字符串
        
        返回:
            str: 表示当前Canvas状态的DSL JSON字符串
        """
        # 更新DSL中的各个字段
        self.dsl["path"] = self.path
        self.dsl["history"] = self.history
        self.dsl["messages"] = self.messages
        self.dsl["answer"] = self.answer
        self.dsl["reference"] = self.reference
        self.dsl["embed_id"] = self._embed_id
        dsl = {
            "components": {}
        }
        # 复制非组件相关的字段
        for k in self.dsl.keys():
            if k in ["components"]:
                continue
            dsl[k] = deepcopy(self.dsl[k])

        # 处理组件字段
        for k, cpn in self.components.items():
            if k not in dsl["components"]:
                dsl["components"][k] = {}
            for c in cpn.keys():
                if c == "obj":
                    dsl["components"][k][c] = json.loads(str(cpn["obj"]))
                    continue
                dsl["components"][k][c] = deepcopy(cpn[c])
        return json.dumps(dsl, ensure_ascii=False)

    def reset(self):
        """
        重置Canvas的所有状态和组件
        """
        self.path = []
        self.history = []
        self.messages = []
        self.answer = []
        self.reference = []
        # 重置所有组件
        for k, cpn in self.components.items():
            self.components[k]["obj"].reset()
        self._embed_id = ""

    def get_component_name(self, cid):
        """
        根据组件ID获取组件名称
        
        参数:
            cid (str): 组件ID
            
        返回:
            str: 组件名称，如果未找到则返回空字符串
        """
        for n in self.dsl["graph"]["nodes"]:
            if cid == n["id"]:
                return n["data"]["name"]
        return ""

    def run(self, **kwargs):
        """
        执行工作流
        
        参数:
            **kwargs: 可变关键字参数，例如stream=True时启用流式响应
            
        生成器:
            生成工作流执行过程中的中间结果或最终答案
        """
        # 如果有待处理的答案组件，先处理它
        if self.answer:
            cpn_id = self.answer[0]
            self.answer.pop(0)
            try:
                # 运行答案组件
                ans = self.components[cpn_id]["obj"].run(self.history, **kwargs)
            except Exception as e:
                ans = ComponentBase.be_output(str(e))
            self.path[-1].append(cpn_id)
            # 处理流式响应
            if kwargs.get("stream"):
                for an in ans():
                    yield an
            else:
                yield ans
            return

        # 如果执行路径为空，先执行Begin组件
        if not self.path:
            self.components["begin"]["obj"].run(self.history, **kwargs)
            self.path.append(["begin"])

        # 为新一轮执行创建新的路径
        self.path.append([])

        ran = -1               # 已运行组件的索引
        waiting = []           # 等待执行的组件列表
        without_dependent_checking = []  # 无需检查依赖的组件列表

        def prepare2run(cpns):
            """
            准备运行组件的内部函数
            
            参数:
                cpns (list): 要运行的组件ID列表
                
            生成器:
                生成组件运行状态消息
            """
            nonlocal ran, ans
            for c in cpns:
                # 避免重复运行同一组件
                if self.path[-1] and c == self.path[-1][-1]:
                    continue
                cpn = self.components[c]["obj"]
                # 如果是Answer组件，添加到answer列表中稍后处理
                if cpn.component_name == "Answer":
                    self.answer.append(c)
                else:
                    logging.debug(f"Canvas.prepare2run: {c}")
                    # 检查组件依赖是否满足
                    if c not in without_dependent_checking:
                        cpids = cpn.get_dependent_components()
                        if any([cc not in self.path[-1] for cc in cpids]):
                            if c not in waiting:
                                waiting.append(c)
                            continue
                    # 输出组件运行状态
                    yield "*'{}'* is running...🕞".format(self.get_component_name(c))

                    # 处理迭代组件的特殊情况
                    if cpn.component_name.lower() == "iteration":
                        st_cpn = cpn.get_start()
                        assert st_cpn, "Start component not found for Iteration."
                        if not st_cpn["obj"].end():
                            cpn = st_cpn["obj"]
                            c = cpn._id

                    # 运行组件
                    try:
                        ans = cpn.run(self.history, **kwargs)
                    except Exception as e:
                        logging.exception(f"Canvas.run got exception: {e}")
                        self.path[-1].append(c)
                        ran += 1
                        raise e
                    self.path[-1].append(c)

            ran += 1

        # 获取上一个执行路径中最后一个组件的下游组件
        downstream = self.components[self.path[-2][-1]]["downstream"]
        # 处理父组件的特殊情况
        if not downstream and self.components[self.path[-2][-1]].get("parent_id"):
            cid = self.path[-2][-1]
            pid = self.components[cid]["parent_id"]
            o, _ = self.components[cid]["obj"].output(allow_partial=False)
            oo, _ = self.components[pid]["obj"].output(allow_partial=False)
            self.components[pid]["obj"].set(pd.concat([oo, o], ignore_index=True))
            downstream = [pid]

        # 执行下游组件
        for m in prepare2run(downstream):
            yield {"content": m, "running_status": True}

        # 主执行循环
        while 0 <= ran < len(self.path[-1]):
            logging.debug(f"Canvas.run: {ran} {self.path}")
            cpn_id = self.path[-1][ran]
            cpn = self.get_component(cpn_id)
            # 如果没有下游组件、父组件或等待组件，结束执行
            if not any([cpn["downstream"], cpn.get("parent_id"), waiting]):
                break

            # 检测循环
            loop = self._find_loop()
            if loop:
                raise OverflowError(f"Too much loops: {loop}")

            # 处理特殊组件类型（Switch, Categorize, Relevant）
            if cpn["obj"].component_name.lower() in ["switch", "categorize", "relevant"]:
                switch_out = cpn["obj"].output()[1].iloc[0, 0]
                assert switch_out in self.components, \
                    "{}'s output: {} not valid.".format(cpn_id, switch_out)
                for m in prepare2run([switch_out]):
                    yield {"content": m, "running_status": True}
                continue

            # 获取当前组件的下游组件
            downstream = cpn["downstream"]
            # 处理父组件的特殊情况
            if not downstream and cpn.get("parent_id"):
                pid = cpn["parent_id"]
                _, o = cpn["obj"].output(allow_partial=False)
                _, oo = self.components[pid]["obj"].output(allow_partial=False)
                self.components[pid]["obj"].set_output(pd.concat([oo.dropna(axis=1), o.dropna(axis=1)], ignore_index=True))
                downstream = [pid]

            # 执行下游组件
            for m in prepare2run(downstream):
                yield {"content": m, "running_status": True}

            # 处理等待组件
            if ran >= len(self.path[-1]) and waiting:
                without_dependent_checking = waiting
                waiting = []
                for m in prepare2run(without_dependent_checking):
                    yield {"content": m, "running_status": True}
                without_dependent_checking = []
                ran -= 1

        # 处理答案组件
        if self.answer:
            cpn_id = self.answer[0]
            self.answer.pop(0)
            ans = self.components[cpn_id]["obj"].run(self.history, **kwargs)
            self.path[-1].append(cpn_id)
            # 处理流式响应
            if kwargs.get("stream"):
                assert isinstance(ans, partial)
                for an in ans():
                    yield an
            else:
                yield ans
        # 如果没有答案组件，抛出异常
        else:
            raise Exception("The dialog flow has no way to interact with you. Please add an 'Interact' component to the end of the flow.")

    def get_component(self, cpn_id):
        """
        获取组件对象
        
        参数:
            cpn_id (str): 组件ID
            
        返回:
            dict: 组件对象
        """
        return self.components[cpn_id]

    def get_tenant_id(self):
        """
        获取租户ID
        
        返回:
            str: 租户ID
        """
        return self._tenant_id

    def get_history(self, window_size):
        """
        获取对话历史记录
        
        参数:
            window_size (int): 历史记录窗口大小
            
        返回:
            list: 对话历史记录列表
        """
        convs = []
        for role, obj in self.history[window_size * -1:]:
            if isinstance(obj, list) and obj and all([isinstance(o, dict) for o in obj]):
                convs.append({"role": role, "content": '\n'.join([str(s.get("content", "")) for s in obj])})
            else:
                convs.append({"role": role, "content": str(obj)})
        return convs

    def add_user_input(self, question):
        """
        添加用户输入到历史记录
        
        参数:
            question (str): 用户输入的问题
        """
        self.history.append(("user", question))

    def set_embedding_model(self, embed_id):
        """
        设置嵌入模型ID
        
        参数:
            embed_id (str): 嵌入模型ID
        """
        self._embed_id = embed_id

    def get_embedding_model(self):
        """
        获取嵌入模型ID
        
        返回:
            str: 嵌入模型ID
        """
        return self._embed_id

    def _find_loop(self, max_loops=6):
        """
        检测执行路径中是否存在循环
        
        参数:
            max_loops (int): 最大允许循环次数
            
        返回:
            bool或str: 如果存在循环返回循环路径，否则返回False
        """
        # 获取当前执行路径并反转顺序
        path = self.path[-1][::-1]
        if len(path) < 2:
            return False

        # 排除某些特殊组件
        for i in range(len(path)):
            if path[i].lower().find("answer") == 0 or path[i].lower().find("iterationitem") == 0:
                path = path[:i]
                break

        if len(path) < 2:
            return False

        # 检查是否存在重复模式
        for loc in range(2, len(path) // 2):
            pat = ",".join(path[0:loc])
            path_str = ",".join(path)
            if len(pat) >= len(path_str):
                return False
            loop = max_loops
            while path_str.find(pat) == 0 and loop >= 0:
                loop -= 1
                if len(pat)+1 >= len(path_str):
                    return False
                path_str = path_str[len(pat)+1:]
            if loop < 0:
                pat = " => ".join([p.split(":")[0] for p in path[0:loc]])
                return pat + " => " + pat

        return False

    def get_prologue(self):
        """
        获取开场白
        
        返回:
            str: 开场白文本
        """
        return self.components["begin"]["obj"]._param.prologue

    def set_global_param(self, **kwargs):
        """
        设置全局参数
        
        参数:
            **kwargs: 参数键值对
        """
        for k, v in kwargs.items():
            for q in self.components["begin"]["obj"]._param.query:
                if k != q["key"]:
                    continue
                q["value"] = v

    def get_preset_param(self):
        """
        获取预设参数
        
        返回:
            list: 预设参数列表
        """
        return self.components["begin"]["obj"]._param.query

    def get_component_input_elements(self, cpnnm):
        """
        获取组件的输入元素
        
        参数:
            cpnnm (str): 组件ID
            
        返回:
            list: 输入元素列表
        """
        return self.components[cpnnm]["obj"].get_input_elements()