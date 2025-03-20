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
import json
import traceback
from flask import request, Response
from flask_login import login_required, current_user
from api.db.services.canvas_service import CanvasTemplateService, UserCanvasService
from api.settings import RetCode
from api.utils import get_uuid
from api.utils.api_utils import get_json_result, server_error_response, validate_request, get_data_error_result
from agent.canvas import Canvas
from peewee import MySQLDatabase, PostgresqlDatabase
from api.db.db_models import APIToken

# 添加调试代码，打印当前路由
import logging
logger = logging.getLogger(__name__)
logger.info("Canvas app loaded with routes:")

@manager.route('/templates', methods=['GET'])  # noqa: F821
@login_required
def templates():
    return get_json_result(data=[c.to_dict() for c in CanvasTemplateService.get_all()])


@manager.route('/list', methods=['GET'])  # noqa: F821
@login_required
def canvas_list():
    return get_json_result(data=sorted([c.to_dict() for c in \
                                 UserCanvasService.query(user_id=current_user.id)], key=lambda x: x["update_time"]*-1)
                           )


@manager.route('/rm', methods=['POST'])  # noqa: F821
@validate_request("canvas_ids")
@login_required
def rm():
    for i in request.json["canvas_ids"]:
        if not UserCanvasService.query(user_id=current_user.id,id=i):
            return get_json_result(
                data=False, message='Only owner of canvas authorized for this operation.',
                code=RetCode.OPERATING_ERROR)
        UserCanvasService.delete_by_id(i)
    return get_json_result(data=True)


@manager.route('/set', methods=['POST'])  # noqa: F821
@validate_request("dsl", "title")
@login_required
def save():
    req = request.json
    req["user_id"] = current_user.id
    if not isinstance(req["dsl"], str):
        req["dsl"] = json.dumps(req["dsl"], ensure_ascii=False)

    req["dsl"] = json.loads(req["dsl"])
    if "id" not in req:
        if UserCanvasService.query(user_id=current_user.id, title=req["title"].strip()):
            return get_data_error_result(message=f"{req['title'].strip()} already exists.")
        req["id"] = get_uuid()
        if not UserCanvasService.save(**req):
            return get_data_error_result(message="Fail to save canvas.")
    else:
        if not UserCanvasService.query(user_id=current_user.id, id=req["id"]):
            return get_json_result(
                data=False, message='Only owner of canvas authorized for this operation.',
                code=RetCode.OPERATING_ERROR)
        UserCanvasService.update_by_id(req["id"], req)
    return get_json_result(data=req)


@manager.route('/get/<canvas_id>', methods=['GET'])  # noqa: F821
@login_required
def get(canvas_id):
    e, c = UserCanvasService.get_by_id(canvas_id)
    if not e:
        return get_data_error_result(message="canvas not found.")
    return get_json_result(data=c.to_dict())

@manager.route('/getsse/<canvas_id>', methods=['GET'])  # type: ignore # noqa: F821
def getsse(canvas_id):
    token = request.headers.get('Authorization').split()
    if len(token) != 2:
        return get_data_error_result(message='Authorization is not valid!"')
    token = token[1]
    objs = APIToken.query(beta=token)
    if not objs:
        return get_data_error_result(message='Authentication error: API key is invalid!"')
    e, c = UserCanvasService.get_by_id(canvas_id)
    if not e:
        return get_data_error_result(message="canvas not found.")
    return get_json_result(data=c.to_dict())


@manager.route('/completion', methods=['POST'])  # noqa: F821
@validate_request("id")
@login_required
def run():
    """
    执行画布操作的API端点
    
    该函数处理画布执行请求，支持流式输出和一次性输出两种模式。
    流式输出适合长时间运行的操作，可以实时返回中间结果。
    
    请求参数:
        id (str): 必需，画布ID，用于查找对应的画布数据
        stream (bool): 可选，默认为True，决定是否使用流式输出
        message (str): 可选，用户输入的消息，会被添加到画布的消息列表中
        message_id (str): 可选，消息ID，如果未提供会自动生成
    
    返回值:
        如果stream=True: 返回一个流式响应，包含实时执行结果
        如果stream=False: 返回一个JSON响应，包含最终执行结果
    
    权限要求:
        只有画布的所有者才能执行该操作
    
    执行流程:
        1. 验证请求参数和用户权限
        2. 获取画布数据并初始化Canvas对象
        3. 如有用户消息，添加到消息历史
        4. 执行画布并收集结果
        5. 更新画布状态并保存到数据库
        6. 返回执行结果
    """
    req = request.json
    stream = req.get("stream", True)
    e, cvs = UserCanvasService.get_by_id(req["id"])
    if not e:
        return get_data_error_result(message="canvas not found.")
    if not UserCanvasService.query(user_id=current_user.id, id=req["id"]):
        return get_json_result(
            data=False, message='Only owner of canvas authorized for this operation.',
            code=RetCode.OPERATING_ERROR)

    if not isinstance(cvs.dsl, str):
        cvs.dsl = json.dumps(cvs.dsl, ensure_ascii=False)

    final_ans = {"reference": [], "content": ""}
    message_id = req.get("message_id", get_uuid())
    try:
        canvas = Canvas(cvs.dsl, current_user.id)
        if "message" in req:
            canvas.messages.append({"role": "user", "content": req["message"], "id": message_id})
            canvas.add_user_input(req["message"])
    except Exception as e:
        return server_error_response(e)

    if stream:
        def sse():
            nonlocal answer, cvs
            try:
                for ans in canvas.run(stream=True):
                    if ans.get("running_status"):
                        yield "data:" + json.dumps({"code": 0, "message": "",
                                                    "data": {"answer": ans["content"],
                                                             "running_status": True}},
                                                   ensure_ascii=False) + "\n\n"
                        continue
                    for k in ans.keys():
                        final_ans[k] = ans[k]
                    ans = {"answer": ans["content"], "reference": ans.get("reference", [])}
                    yield "data:" + json.dumps({"code": 0, "message": "", "data": ans}, ensure_ascii=False) + "\n\n"

                canvas.messages.append({"role": "assistant", "content": final_ans["content"], "id": message_id})
                canvas.history.append(("assistant", final_ans["content"]))
                if not canvas.path[-1]:
                    canvas.path.pop(-1)
                if final_ans.get("reference"):
                    canvas.reference.append(final_ans["reference"])
                cvs.dsl = json.loads(str(canvas))
                UserCanvasService.update_by_id(req["id"], cvs.to_dict())
            except Exception as e:
                cvs.dsl = json.loads(str(canvas))
                if not canvas.path[-1]:
                    canvas.path.pop(-1)
                UserCanvasService.update_by_id(req["id"], cvs.to_dict())
                traceback.print_exc()
                yield "data:" + json.dumps({"code": 500, "message": str(e),
                                            "data": {"answer": "**ERROR**: " + str(e), "reference": []}},
                                           ensure_ascii=False) + "\n\n"
            yield "data:" + json.dumps({"code": 0, "message": "", "data": True}, ensure_ascii=False) + "\n\n"

        resp = Response(sse(), mimetype="text/event-stream")
        resp.headers.add_header("Cache-control", "no-cache")
        resp.headers.add_header("Connection", "keep-alive")
        resp.headers.add_header("X-Accel-Buffering", "no")
        resp.headers.add_header("Content-Type", "text/event-stream; charset=utf-8")
        return resp
    for answer in canvas.run(stream=False):
        if answer.get("running_status"):
            continue
        final_ans["content"] = "\n".join(answer["content"]) if "content" in answer else ""
        canvas.messages.append({"role": "assistant", "content": final_ans["content"], "id": message_id})
        if final_ans.get("reference"):
            canvas.reference.append(final_ans["reference"])
        
        cvs.dsl = json.loads(str(canvas))
        UserCanvasService.update_by_id(req["id"], cvs.to_dict())
        return get_json_result(data={"answer": final_ans["content"], "reference": final_ans.get("reference", [])})


@manager.route('/reset', methods=['POST'])  # noqa: F821
@validate_request("id")
@login_required
def reset():
    req = request.json
    try:
        e, user_canvas = UserCanvasService.get_by_id(req["id"])
        if not e:
            return get_data_error_result(message="canvas not found.")
        if not UserCanvasService.query(user_id=current_user.id, id=req["id"]):
            return get_json_result(
                data=False, message='Only owner of canvas authorized for this operation.',
                code=RetCode.OPERATING_ERROR)

        canvas = Canvas(json.dumps(user_canvas.dsl), current_user.id)
        canvas.reset()
        req["dsl"] = json.loads(str(canvas))
        UserCanvasService.update_by_id(req["id"], {"dsl": req["dsl"]})
        return get_json_result(data=req["dsl"])
    except Exception as e:
        return server_error_response(e)


@manager.route('/input_elements', methods=['GET'])  # noqa: F821
@login_required
def input_elements():
    cvs_id = request.args.get("id")
    cpn_id = request.args.get("component_id")
    try:
        e, user_canvas = UserCanvasService.get_by_id(cvs_id)
        if not e:
            return get_data_error_result(message="canvas not found.")
        if not UserCanvasService.query(user_id=current_user.id, id=cvs_id):
            return get_json_result(
                data=False, message='Only owner of canvas authorized for this operation.',
                code=RetCode.OPERATING_ERROR)

        canvas = Canvas(json.dumps(user_canvas.dsl), current_user.id)
        logging.info(f"canvas.get_component_input_elements(cpn_id): {canvas}")
        return get_json_result(data=canvas.get_component_input_elements(cpn_id))
    except Exception as e:
        return server_error_response(e)


@manager.route('/debug', methods=['POST'])  # noqa: F821
@validate_request("id", "component_id", "params")
@login_required
def debug():
    req = request.json
    for p in req["params"]:
        assert p.get("key")
    try:
        e, user_canvas = UserCanvasService.get_by_id(req["id"])
        if not e:
            return get_data_error_result(message="canvas not found.")
        if not UserCanvasService.query(user_id=current_user.id, id=req["id"]):
            return get_json_result(
                data=False, message='Only owner of canvas authorized for this operation.',
                code=RetCode.OPERATING_ERROR)

        print(f"user_canvas.dsl: {user_canvas.dsl}")
        canvas = Canvas(json.dumps(user_canvas.dsl), current_user.id)
        canvas.get_component(req["component_id"])["obj"]._param.debug_inputs = req["params"]
        df = canvas.get_component(req["component_id"])["obj"].debug()
        return get_json_result(data=df.to_dict(orient="records"))
    except Exception as e:
        return server_error_response(e)


@manager.route('/test_db_connect', methods=['POST'])  # noqa: F821
@validate_request("db_type", "database", "username", "host", "port", "password")
@login_required
def test_db_connect():
    req = request.json
    try:
        if req["db_type"] in ["mysql", "mariadb"]:
            db = MySQLDatabase(req["database"], user=req["username"], host=req["host"], port=req["port"],
                              password=req["password"])
            db.connect()
            db.close()
        elif req["db_type"] in ["postgres", "postgresql"]:
            db = PostgresqlDatabase(req["database"], user=req["username"], host=req["host"], port=req["port"],
                                  password=req["password"])
            db.connect()
            db.close()
        else:
            return get_json_result(data=False, message="Unsupported database type")
        return get_json_result(data=True)
    except Exception as e:
        return get_json_result(data=False, message=str(e))


@manager.route('/execute_code', methods=['POST'])  # noqa: F821
@validate_request("code", "language")
def execute_code():
    """
    专门用于执行Code节点的代码，不需要加载整个画布
    """
    logger.info("Execute code endpoint called")
    req = request.json
    logger.debug(f"Request data: {req}")
    try:
        code = req.get("code", "")
        language = req.get("language", "python")
        
        # 导入Code组件
        from agent.component.code import Code, CodeParam
        
        # 创建参数和执行代码
        param = CodeParam()
        param.code = code
        param.language = language
        
        # 初始化代码组件 - 提供必要的参数
        code_component = Code(canvas=None, id="code_execute", param=param)
        
        # 执行代码
        result = code_component._run({})
        
        logger.debug(f"Code execution result: {result}")
        return get_json_result(data=result)
    except Exception as e:
        traceback_str = traceback.format_exc()
        logger.error(f"Code execution failed: {e}\n{traceback_str}")
        return get_json_result(
            data={
                "success": False,
                "error": str(e),
                "traceback": traceback_str
            }, 
            message="代码执行失败",
            code=RetCode.OPERATING_ERROR
        )

