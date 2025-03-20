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
import os
import re
from datetime import datetime, timedelta
from flask import request, Response
from api.db.services.llm_service import TenantLLMService
from flask_login import login_required, current_user

from api.db import FileType, LLMType, ParserType, FileSource
from api.db.db_models import APIToken, Task, File
from api.db.services import duplicate_name
from api.db.services.api_service import APITokenService, API4ConversationService
from api.db.services.dialog_service import DialogService, chat
from api.db.services.document_service import DocumentService, doc_upload_and_parse
from api.db.services.file2document_service import File2DocumentService
from api.db.services.file_service import FileService
from api.db.services.knowledgebase_service import KnowledgebaseService
from api.db.services.task_service import queue_tasks, TaskService
from api.db.services.user_service import UserTenantService
from api import settings
from api.utils import get_uuid, current_timestamp, datetime_format
from api.utils.api_utils import server_error_response, get_data_error_result, get_json_result, validate_request, \
    generate_confirmation_token

from api.utils.file_utils import filename_type, thumbnail
from rag.app.tag import label_question
from rag.prompts import keyword_extraction
from rag.utils.storage_factory import STORAGE_IMPL

from api.db.services.canvas_service import UserCanvasService
from agent.canvas import Canvas
from functools import partial


@manager.route('/new_token', methods=['POST'])  # noqa: F821
@login_required
def new_token():
    """
    创建新的API令牌
    
    此端点用于为当前登录用户创建新的API访问令牌，可用于会话或Canvas的访问
    
    请求参数:
        - dialog_id: 对话ID（普通对话模式）
        - canvas_id: Canvas ID（Agent模式）
        
    返回:
        成功：包含新创建令牌信息的JSON对象
        失败：错误信息
    """
    req = request.json
    try:
        tenants = UserTenantService.query(user_id=current_user.id)
        if not tenants:
            return get_data_error_result(message="Tenant not found!")

        tenant_id = tenants[0].tenant_id
        obj = {"tenant_id": tenant_id, "token": generate_confirmation_token(tenant_id),
               "create_time": current_timestamp(),
               "create_date": datetime_format(datetime.now()),
               "update_time": None,
               "update_date": None
               }
        if req.get("canvas_id"):
            obj["dialog_id"] = req["canvas_id"]
            obj["source"] = "agent"
        else:
            obj["dialog_id"] = req["dialog_id"]

        if not APITokenService.save(**obj):
            return get_data_error_result(message="Fail to new a dialog!")

        return get_json_result(data=obj)
    except Exception as e:
        return server_error_response(e)


@manager.route('/token_list', methods=['GET'])  # noqa: F821
@login_required
def token_list():
    """
    获取令牌列表
    
    获取当前用户特定对话或Canvas的所有API令牌
    
    URL参数:
        - dialog_id: 对话ID
        - canvas_id: Canvas ID
        
    返回:
        成功：包含令牌列表的JSON对象
        失败：错误信息
    """
    try:
        tenants = UserTenantService.query(user_id=current_user.id)
        if not tenants:
            return get_data_error_result(message="Tenant not found!")

        id = request.args["dialog_id"] if "dialog_id" in request.args else request.args["canvas_id"]
        objs = APITokenService.query(tenant_id=tenants[0].tenant_id, dialog_id=id)
        return get_json_result(data=[o.to_dict() for o in objs])
    except Exception as e:
        return server_error_response(e)


@manager.route('/rm', methods=['POST'])  # noqa: F821
@validate_request("tokens", "tenant_id")
@login_required
def rm():
    """
    删除API令牌
    
    删除指定的API令牌
    
    请求参数:
        - tokens: 要删除的令牌数组
        - tenant_id: 租户ID
        
    返回:
        成功：true
        失败：错误信息
    """
    req = request.json
    try:
        for token in req["tokens"]:
            APITokenService.filter_delete(
                [APIToken.tenant_id == req["tenant_id"], APIToken.token == token])
        return get_json_result(data=True)
    except Exception as e:
        return server_error_response(e)


@manager.route('/stats', methods=['GET'])  # noqa: F821
@login_required
def stats():
    """
    获取API使用统计信息
    
    获取指定时间范围内的API使用统计数据，包括PV、UV、速度、令牌数量等
    
    URL参数:
        - from_date: 开始日期（默认为7天前）
        - to_date: 结束日期（默认为当前时间）
        - canvas_id: Canvas ID（可选，用于区分Agent模式）
        
    返回:
        成功：包含统计数据的JSON对象
        失败：错误信息
    """
    try:
        tenants = UserTenantService.query(user_id=current_user.id)
        if not tenants:
            return get_data_error_result(message="Tenant not found!")
        objs = API4ConversationService.stats(
            tenants[0].tenant_id,
            request.args.get(
                "from_date",
                (datetime.now() -
                 timedelta(
                     days=7)).strftime("%Y-%m-%d 00:00:00")),
            request.args.get(
                "to_date",
                datetime.now().strftime("%Y-%m-%d %H:%M:%S")),
            "agent" if "canvas_id" in request.args else None)
        res = {
            "pv": [(o["dt"], o["pv"]) for o in objs],
            "uv": [(o["dt"], o["uv"]) for o in objs],
            "speed": [(o["dt"], float(o["tokens"]) / (float(o["duration"] + 0.1))) for o in objs],
            "tokens": [(o["dt"], float(o["tokens"]) / 1000.) for o in objs],
            "round": [(o["dt"], o["round"]) for o in objs],
            "thumb_up": [(o["dt"], o["thumb_up"]) for o in objs]
        }
        return get_json_result(data=res)
    except Exception as e:
        return server_error_response(e)


@manager.route('/new_conversation', methods=['GET'])  # noqa: F821
def set_conversation():
    """
    创建新的对话
    
    基于API令牌创建新的对话，支持普通对话模式和Agent模式
    
    请求头:
        - Authorization: 包含API令牌的Bearer认证头
        
    URL参数:
        - user_id: 用户ID（可选）
        
    返回:
        成功：包含新创建对话信息的JSON对象
        失败：错误信息
    """
    token = request.headers.get('Authorization').split()[1]
    objs = APIToken.query(token=token)
    if not objs:
        return get_json_result(
            data=False, message='Authentication error: API key is invalid!"', code=settings.RetCode.AUTHENTICATION_ERROR)
    try:
        if objs[0].source == "agent":
            e, cvs = UserCanvasService.get_by_id(objs[0].dialog_id)
            if not e:
                return server_error_response("canvas not found.")
            if not isinstance(cvs.dsl, str):
                cvs.dsl = json.dumps(cvs.dsl, ensure_ascii=False)
            canvas = Canvas(cvs.dsl, objs[0].tenant_id)
            conv = {
                "id": get_uuid(),
                "dialog_id": cvs.id,
                "user_id": request.args.get("user_id", ""),
                "message": [{"role": "assistant", "content": canvas.get_prologue()}],
                "source": "agent"
            }
            API4ConversationService.save(**conv)
            return get_json_result(data=conv)
        else:
            e, dia = DialogService.get_by_id(objs[0].dialog_id)
            if not e:
                return get_data_error_result(message="Dialog not found")
            conv = {
                "id": get_uuid(),
                "dialog_id": dia.id,
                "user_id": request.args.get("user_id", ""),
                "message": [{"role": "assistant", "content": dia.prompt_config["prologue"]}]
            }
            API4ConversationService.save(**conv)
            return get_json_result(data=conv)
    except Exception as e:
        return server_error_response(e)


@manager.route('/completion', methods=['POST'])  # noqa: F821
@validate_request("conversation_id", "messages")
def completion():
    """
    生成回复内容
    
    这是系统的核心API端点，处理对话内容生成。支持普通对话模式和Agent模式，以及流式和非流式响应。
    
    请求头:
        - Authorization: 包含API令牌的Bearer认证头
        
    请求参数:
        - conversation_id: 对话ID
        - messages: 对话消息数组，每条消息包含role和content
        - quote: 是否引用来源（默认为false）
        - stream: 是否使用流式响应（默认为true）
        
    返回:
        流式模式: 返回SSE格式的流式响应
        非流式模式: 返回包含回答和引用信息的JSON对象
    """
    # 获取并验证API令牌
    token = request.headers.get('Authorization').split()[1]
    objs = APIToken.query(token=token)
    if not objs:
        return get_json_result(
            data=False, message='Authentication error: API key is invalid!"', code=settings.RetCode.AUTHENTICATION_ERROR)
    req = request.json
    
    # 获取对话信息
    e, conv = API4ConversationService.get_by_id(req["conversation_id"])
    if not e:
        return get_data_error_result(message="Conversation not found!")
    if "quote" not in req:
        req["quote"] = False

    # 处理消息，排除系统消息和首条助手消息
    msg = []
    for m in req["messages"]:
        if m["role"] == "system":
            continue
        if m["role"] == "assistant" and not msg:
            continue
        msg.append(m)
    
    # 为消息生成ID
    if not msg[-1].get("id"):
        msg[-1]["id"] = get_uuid()
    message_id = msg[-1]["id"]

    # 填充对话引用和回复的内部函数
    def fillin_conv(ans):
        nonlocal conv, message_id
        if not conv.reference:
            conv.reference.append(ans["reference"])
        else:
            conv.reference[-1] = ans["reference"]
        conv.message[-1] = {"role": "assistant", "content": ans["answer"], "id": message_id}
        ans["id"] = message_id

    # 重命名文档字段的内部函数
    def rename_field(ans):
        reference = ans['reference']
        if not isinstance(reference, dict):
            return
        for chunk_i in reference.get('chunks', []):
            if 'docnm_kwd' in chunk_i:
                chunk_i['doc_name'] = chunk_i['docnm_kwd']
                chunk_i.pop('docnm_kwd')

    try:
        # 处理Agent模式对话
        if conv.source == "agent":
            stream = req.get("stream", True)
            conv.message.append(msg[-1])
            
            # 获取Canvas信息
            e, cvs = UserCanvasService.get_by_id(conv.dialog_id)
            if not e:
                return server_error_response("canvas not found.")
            del req["conversation_id"]
            del req["messages"]

            # 确保DSL格式正确
            if not isinstance(cvs.dsl, str):
                cvs.dsl = json.dumps(cvs.dsl, ensure_ascii=False)

            # 初始化引用和回复
            if not conv.reference:
                conv.reference = []
            conv.message.append({"role": "assistant", "content": "", "id": message_id})
            conv.reference.append({"chunks": [], "doc_aggs": []})

            final_ans = {"reference": [], "content": ""}
            canvas = Canvas(cvs.dsl, objs[0].tenant_id)

            # 添加用户输入到Canvas
            canvas.messages.append(msg[-1])
            canvas.add_user_input(msg[-1]["content"])
            answer = canvas.run(stream=stream)

            # 验证回复是否为空
            assert answer is not None, "Nothing. Is it over?"

            # 处理流式响应
            if stream:
                assert isinstance(answer, partial), "Nothing. Is it over?"

                def sse():
                    nonlocal answer, cvs, conv
                    try:
                        # 迭代生成回复流
                        for ans in answer():
                            for k in ans.keys():
                                final_ans[k] = ans[k]
                            ans = {"answer": ans["content"], "reference": ans.get("reference", [])}
                            fillin_conv(ans)
                            rename_field(ans)
                            yield "data:" + json.dumps({"code": 0, "message": "", "data": ans},
                                                       ensure_ascii=False) + "\n\n"

                        # 更新Canvas和对话历史
                        canvas.messages.append({"role": "assistant", "content": final_ans["content"], "id": message_id})
                        canvas.history.append(("assistant", final_ans["content"]))
                        if final_ans.get("reference"):
                            canvas.reference.append(final_ans["reference"])
                        cvs.dsl = json.loads(str(canvas))
                        API4ConversationService.append_message(conv.id, conv.to_dict())
                    except Exception as e:
                        # 处理错误情况
                        yield "data:" + json.dumps({"code": 500, "message": str(e),
                                                    "data": {"answer": "**ERROR**: " + str(e), "reference": []}},
                                                   ensure_ascii=False) + "\n\n"
                    # 结束流响应
                    yield "data:" + json.dumps({"code": 0, "message": "", "data": True}, ensure_ascii=False) + "\n\n"

                # 返回流式响应
                resp = Response(sse(), mimetype="text/event-stream")
                resp.headers.add_header("Cache-control", "no-cache")
                resp.headers.add_header("Connection", "keep-alive")
                resp.headers.add_header("X-Accel-Buffering", "no")
                resp.headers.add_header("Content-Type", "text/event-stream; charset=utf-8")
                return resp

            # 处理非流式响应
            final_ans["content"] = "\n".join(answer["content"]) if "content" in answer else ""
            canvas.messages.append({"role": "assistant", "content": final_ans["content"], "id": message_id})
            if final_ans.get("reference"):
                canvas.reference.append(final_ans["reference"])
            cvs.dsl = json.loads(str(canvas))

            result = {"answer": final_ans["content"], "reference": final_ans.get("reference", [])}
            fillin_conv(result)
            API4ConversationService.append_message(conv.id, conv.to_dict())
            rename_field(result)
            return get_json_result(data=result)

        # ******************处理普通对话模式******************
        conv.message.append(msg[-1])
        e, dia = DialogService.get_by_id(conv.dialog_id)
        if not e:
            return get_data_error_result(message="Dialog not found!")
        del req["conversation_id"]
        del req["messages"]

        # 初始化引用和回复
        if not conv.reference:
            conv.reference = []
        conv.message.append({"role": "assistant", "content": "", "id": message_id})
        conv.reference.append({"chunks": [], "doc_aggs": []})

        # 定义流式响应生成器
        def stream():
            nonlocal dia, msg, req, conv
            try:
                # 迭代生成回复流
                for ans in chat(dia, msg, True, **req):
                    fillin_conv(ans)
                    rename_field(ans)
                    yield "data:" + json.dumps({"code": 0, "message": "", "data": ans},
                                               ensure_ascii=False) + "\n\n"
                API4ConversationService.append_message(conv.id, conv.to_dict())
            except Exception as e:
                # 处理错误情况
                yield "data:" + json.dumps({"code": 500, "message": str(e),
                                            "data": {"answer": "**ERROR**: " + str(e), "reference": []}},
                                           ensure_ascii=False) + "\n\n"
            # 结束流响应
            yield "data:" + json.dumps({"code": 0, "message": "", "data": True}, ensure_ascii=False) + "\n\n"

        # 处理流式响应请求
        if req.get("stream", True):
            resp = Response(stream(), mimetype="text/event-stream")
            resp.headers.add_header("Cache-control", "no-cache")
            resp.headers.add_header("Connection", "keep-alive")
            resp.headers.add_header("X-Accel-Buffering", "no")
            resp.headers.add_header("Content-Type", "text/event-stream; charset=utf-8")
            return resp

        # 处理非流式响应请求
        answer = None
        for ans in chat(dia, msg, **req):
            answer = ans
            fillin_conv(ans)
            API4ConversationService.append_message(conv.id, conv.to_dict())
            break
        print(f"--completion answer--: {answer}")
        rename_field(answer)
        return get_json_result(data=answer)

    except Exception as e:
        return server_error_response(e)


@manager.route('/conversation/<conversation_id>', methods=['GET'])  # noqa: F821
# @login_required
def get(conversation_id):
    """
    获取对话信息
    
    获取指定ID对话的完整信息，包括消息历史和引用
    
    请求头:
        - Authorization: 包含API令牌的Bearer认证头
        
    URL参数:
        - conversation_id: 对话ID
        
    返回:
        成功：包含对话完整信息的JSON对象
        失败：错误信息
    """
    token = request.headers.get('Authorization').split()[1]
    objs = APIToken.query(token=token)
    if not objs:
        return get_json_result(
            data=False, message='Authentication error: API key is invalid!"', code=settings.RetCode.AUTHENTICATION_ERROR)

    try:
        e, conv = API4ConversationService.get_by_id(conversation_id)
        if not e:
            return get_data_error_result(message="Conversation not found!")

        conv = conv.to_dict()
        if token != APIToken.query(dialog_id=conv['dialog_id'])[0].token:
            return get_json_result(data=False, message='Authentication error: API key is invalid for this conversation_id!"',
                                   code=settings.RetCode.AUTHENTICATION_ERROR)

        # 处理引用中的字段名
        for referenct_i in conv['reference']:
            if referenct_i is None or len(referenct_i) == 0:
                continue
            for chunk_i in referenct_i['chunks']:
                if 'docnm_kwd' in chunk_i.keys():
                    chunk_i['doc_name'] = chunk_i['docnm_kwd']
                    chunk_i.pop('docnm_kwd')
        return get_json_result(data=conv)
    except Exception as e:
        return server_error_response(e)


@manager.route('/document/upload', methods=['POST'])  # noqa: F821
@validate_request("kb_name")
def upload():
    """
    上传文档
    
    上传文档到指定的知识库
    
    请求头:
        - Authorization: 包含API令牌的Bearer认证头
        
    请求参数:
        - kb_name: 知识库名称
        - file: 要上传的文件
        - parser_id: 解析器ID（可选）
        - run: 是否立即处理文档（可选，值为1时处理）
        
    返回:
        成功：包含文档信息的JSON对象
        失败：错误信息
    """
    token = request.headers.get('Authorization').split()[1]
    objs = APIToken.query(token=token)
    if not objs:
        return get_json_result(
            data=False, message='Authentication error: API key is invalid!"', code=settings.RetCode.AUTHENTICATION_ERROR)

    kb_name = request.form.get("kb_name").strip()
    tenant_id = objs[0].tenant_id

    try:
        e, kb = KnowledgebaseService.get_by_name(kb_name, tenant_id)
        if not e:
            return get_data_error_result(
                message="Can't find this knowledgebase!")
        kb_id = kb.id
    except Exception as e:
        return server_error_response(e)

    if 'file' not in request.files:
        return get_json_result(
            data=False, message='No file part!', code=settings.RetCode.ARGUMENT_ERROR)

    file = request.files['file']
    if file.filename == '':
        return get_json_result(
            data=False, message='No file selected!', code=settings.RetCode.ARGUMENT_ERROR)

    root_folder = FileService.get_root_folder(tenant_id)
    pf_id = root_folder["id"]
    FileService.init_knowledgebase_docs(pf_id, tenant_id)
    kb_root_folder = FileService.get_kb_folder(tenant_id)
    kb_folder = FileService.new_a_file_from_kb(kb.tenant_id, kb.name, kb_root_folder["id"])

    try:
        if DocumentService.get_doc_count(kb.tenant_id) >= int(os.environ.get('MAX_FILE_NUM_PER_USER', 8192)):
            return get_data_error_result(
                message="Exceed the maximum file number of a free user!")

        filename = duplicate_name(
            DocumentService.query,
            name=file.filename,
            kb_id=kb_id)
        filetype = filename_type(filename)
        if not filetype:
            return get_data_error_result(
                message="This type of file has not been supported yet!")

        location = filename
        while STORAGE_IMPL.obj_exist(kb_id, location):
            location += "_"
        blob = request.files['file'].read()
        STORAGE_IMPL.put(kb_id, location, blob)
        doc = {
            "id": get_uuid(),
            "kb_id": kb.id,
            "parser_id": kb.parser_id,
            "parser_config": kb.parser_config,
            "created_by": kb.tenant_id,
            "type": filetype,
            "name": filename,
            "location": location,
            "size": len(blob),
            "thumbnail": thumbnail(filename, blob)
        }

        form_data = request.form
        if "parser_id" in form_data.keys():
            if request.form.get("parser_id").strip() in list(vars(ParserType).values())[1:-3]:
                doc["parser_id"] = request.form.get("parser_id").strip()
        if doc["type"] == FileType.VISUAL:
            doc["parser_id"] = ParserType.PICTURE.value
        if doc["type"] == FileType.AURAL:
            doc["parser_id"] = ParserType.AUDIO.value
        if re.search(r"\.(ppt|pptx|pages)$", filename):
            doc["parser_id"] = ParserType.PRESENTATION.value
        if re.search(r"\.(eml)$", filename):
            doc["parser_id"] = ParserType.EMAIL.value

        doc_result = DocumentService.insert(doc)
        FileService.add_file_from_kb(doc, kb_folder["id"], kb.tenant_id)
    except Exception as e:
        return server_error_response(e)

    if "run" in form_data.keys():
        if request.form.get("run").strip() == "1":
            try:
                info = {"run": 1, "progress": 0}
                info["progress_msg"] = ""
                info["chunk_num"] = 0
                info["token_num"] = 0
                DocumentService.update_by_id(doc["id"], info)
                # if str(req["run"]) == TaskStatus.CANCEL.value:
                tenant_id = DocumentService.get_tenant_id(doc["id"])
                if not tenant_id:
                    return get_data_error_result(message="Tenant not found!")

                # e, doc = DocumentService.get_by_id(doc["id"])
                TaskService.filter_delete([Task.doc_id == doc["id"]])
                e, doc = DocumentService.get_by_id(doc["id"])
                doc = doc.to_dict()
                doc["tenant_id"] = tenant_id
                bucket, name = File2DocumentService.get_storage_address(doc_id=doc["id"])
                queue_tasks(doc, bucket, name)
            except Exception as e:
                return server_error_response(e)

    return get_json_result(data=doc_result.to_json())


@manager.route('/document/upload_and_parse', methods=['POST'])  # noqa: F821
@validate_request("conversation_id")
def upload_parse():
    """
    上传并解析文档
    
    上传文档并自动触发解析处理，用于对话中的实时文档处理
    
    请求头:
        - Authorization: 包含API令牌的Bearer认证头
        
    请求参数:
        - conversation_id: 对话ID
        - file: 要上传的文件（可以是多个文件）
        
    返回:
        成功：包含文档ID列表的JSON对象
        失败：错误信息
    """
    token = request.headers.get('Authorization').split()[1]
    objs = APIToken.query(token=token)
    if not objs:
        return get_json_result(
            data=False, message='Authentication error: API key is invalid!"', code=settings.RetCode.AUTHENTICATION_ERROR)

    if 'file' not in request.files:
        return get_json_result(
            data=False, message='No file part!', code=settings.RetCode.ARGUMENT_ERROR)

    file_objs = request.files.getlist('file')
    for file_obj in file_objs:
        if file_obj.filename == '':
            return get_json_result(
                data=False, message='No file selected!', code=settings.RetCode.ARGUMENT_ERROR)

    doc_ids = doc_upload_and_parse(request.form.get("conversation_id"), file_objs, objs[0].tenant_id)
    return get_json_result(data=doc_ids)


@manager.route('/list_chunks', methods=['POST'])  # noqa: F821
# @login_required
def list_chunks():
    """
    列出文档块
    
    获取指定文档的所有内容块
    
    请求头:
        - Authorization: 包含API令牌的Bearer认证头
        
    请求参数:
        - doc_name: 文档名称（与doc_id二选一）
        - doc_id: 文档ID（与doc_name二选一）
        
    返回:
        成功：包含文档块列表的JSON对象
        失败：错误信息
    """
    token = request.headers.get('Authorization').split()[1]
    objs = APIToken.query(token=token)
    if not objs:
        return get_json_result(
            data=False, message='Authentication error: API key is invalid!"', code=settings.RetCode.AUTHENTICATION_ERROR)

    req = request.json

    try:
        if "doc_name" in req.keys():
            tenant_id = DocumentService.get_tenant_id_by_name(req['doc_name'])
            doc_id = DocumentService.get_doc_id_by_doc_name(req['doc_name'])

        elif "doc_id" in req.keys():
            tenant_id = DocumentService.get_tenant_id(req['doc_id'])
            doc_id = req['doc_id']
        else:
            return get_json_result(
                data=False, message="Can't find doc_name or doc_id"
            )
        kb_ids = KnowledgebaseService.get_kb_ids(tenant_id)

        # 获取文档块列表
        res = settings.retrievaler.chunk_list(doc_id, tenant_id, kb_ids)
        res = [
            {
                "content": res_item["content_with_weight"],
                "doc_name": res_item["docnm_kwd"],
                "image_id": res_item["img_id"]
            } for res_item in res
        ]

    except Exception as e:
        return server_error_response(e)

    return get_json_result(data=res)


@manager.route('/list_kb_docs', methods=['POST'])  # noqa: F821
# @login_required
def list_kb_docs():
    """
    列出知识库文档
    
    获取指定知识库中的所有文档
    
    请求头:
        - Authorization: 包含API令牌的Bearer认证头
        
    请求参数:
        - kb_name: 知识库名称
        - page: 页码（默认为1）
        - page_size: 每页数量（默认为15）
        - orderby: 排序字段（默认为create_time）
        - desc: 是否降序排序（默认为true）
        - keywords: 搜索关键词（可选）
        
    返回:
        成功：包含文档列表和总数的JSON对象
        失败：错误信息
    """
    token = request.headers.get('Authorization').split()[1]
    objs = APIToken.query(token=token)
    if not objs:
        return get_json_result(
            data=False, message='Authentication error: API key is invalid!"', code=settings.RetCode.AUTHENTICATION_ERROR)

    req = request.json
    tenant_id = objs[0].tenant_id
    kb_name = req.get("kb_name", "").strip()

    try:
        # 获取知识库信息
        e, kb = KnowledgebaseService.get_by_name(kb_name, tenant_id)
        if not e:
            return get_data_error_result(
                message="Can't find this knowledgebase!")
        kb_id = kb.id

    except Exception as e:
        return server_error_response(e)

    # 处理分页和排序参数
    page_number = int(req.get("page", 1))
    items_per_page = int(req.get("page_size", 15))
    orderby = req.get("orderby", "create_time")
    desc = req.get("desc", True)
    keywords = req.get("keywords", "")

    try:
        # 查询文档列表
        docs, tol = DocumentService.get_by_kb_id(
            kb_id, page_number, items_per_page, orderby, desc, keywords)
        docs = [{"doc_id": doc['id'], "doc_name": doc['name']} for doc in docs]

        return get_json_result(data={"total": tol, "docs": docs})

    except Exception as e:
        return server_error_response(e)


@manager.route('/document/infos', methods=['POST'])  # noqa: F821
@validate_request("doc_ids")
def docinfos():
    """
    获取文档信息
    
    获取指定ID列表的文档详细信息
    
    请求头:
        - Authorization: 包含API令牌的Bearer认证头
        
    请求参数:
        - doc_ids: 文档ID列表
        
    返回:
        成功：包含文档详细信息的JSON对象
        失败：错误信息
    """
    token = request.headers.get('Authorization').split()[1]
    objs = APIToken.query(token=token)
    if not objs:
        return get_json_result(
            data=False, message='Authentication error: API key is invalid!"', code=settings.RetCode.AUTHENTICATION_ERROR)
    req = request.json
    doc_ids = req["doc_ids"]
    docs = DocumentService.get_by_ids(doc_ids)
    return get_json_result(data=list(docs.dicts()))


@manager.route('/document', methods=['DELETE'])  # noqa: F821
# @login_required
def document_rm():
    """
    删除文档
    
    从知识库中删除指定文档
    
    请求头:
        - Authorization: 包含API令牌的Bearer认证头
        
    请求参数:
        - doc_names: 文档名称列表（与doc_ids二选一）
        - doc_ids: 文档ID列表（与doc_names二选一）
        
    返回:
        成功：true
        失败：错误信息
    """
    token = request.headers.get('Authorization').split()[1]
    objs = APIToken.query(token=token)
    if not objs:
        return get_json_result(
            data=False, message='Authentication error: API key is invalid!"', code=settings.RetCode.AUTHENTICATION_ERROR)

    tenant_id = objs[0].tenant_id
    req = request.json
    try:
        # 从文档名获取文档ID
        doc_ids = [DocumentService.get_doc_id_by_doc_name(doc_name) for doc_name in req.get("doc_names", [])]
        for doc_id in req.get("doc_ids", []):
            if doc_id not in doc_ids:
                doc_ids.append(doc_id)

        if not doc_ids:
            return get_json_result(
                data=False, message="Can't find doc_names or doc_ids"
            )

    except Exception as e:
        return server_error_response(e)

    # 获取根目录
    root_folder = FileService.get_root_folder(tenant_id)
    pf_id = root_folder["id"]
    FileService.init_knowledgebase_docs(pf_id, tenant_id)

    errors = ""
    for doc_id in doc_ids:
        try:
            # 获取文档信息
            e, doc = DocumentService.get_by_id(doc_id)
            if not e:
                return get_data_error_result(message="Document not found!")
            tenant_id = DocumentService.get_tenant_id(doc_id)
            if not tenant_id:
                return get_data_error_result(message="Tenant not found!")

            # 获取存储地址
            b, n = File2DocumentService.get_storage_address(doc_id=doc_id)

            # 从数据库删除文档
            if not DocumentService.remove_document(doc, tenant_id):
                return get_data_error_result(
                    message="Database error (Document removal)!")

            # 删除文件和文档关联
            f2d = File2DocumentService.get_by_document_id(doc_id)
            FileService.filter_delete([File.source_type == FileSource.KNOWLEDGEBASE, File.id == f2d[0].file_id])
            File2DocumentService.delete_by_document_id(doc_id)

            # 从存储中删除文件
            STORAGE_IMPL.rm(b, n)
        except Exception as e:
            errors += str(e)

    if errors:
        return get_json_result(data=False, message=errors, code=settings.RetCode.SERVER_ERROR)

    return get_json_result(data=True)


@manager.route('/completion_aibotk', methods=['POST'])  # noqa: F821
@validate_request("Authorization", "conversation_id", "word")
def completion_faq():
    """
    生成FAQ回复内容
    
    特殊格式的对话回复生成，支持图像响应，适用于FAQ场景
    
    请求参数:
        - Authorization: API令牌
        - conversation_id: 对话ID
        - word: 用户输入内容
        - quote: 是否引用来源（默认为true）
        
    返回:
        成功：包含回复内容的JSON对象，支持文本和图像
        失败：错误信息
    """
    import base64
    req = request.json

    token = req["Authorization"]
    objs = APIToken.query(token=token)
    if not objs:
        return get_json_result(
            data=False, message='Authentication error: API key is invalid!"', code=settings.RetCode.AUTHENTICATION_ERROR)

    e, conv = API4ConversationService.get_by_id(req["conversation_id"])
    if not e:
        return get_data_error_result(message="Conversation not found!")
    if "quote" not in req:
        req["quote"] = True

    msg = []
    msg.append({"role": "user", "content": req["word"]})
    if not msg[-1].get("id"):
        msg[-1]["id"] = get_uuid()
    message_id = msg[-1]["id"]

    def fillin_conv(ans):
        nonlocal conv, message_id
        if not conv.reference:
            conv.reference.append(ans["reference"])
        else:
            conv.reference[-1] = ans["reference"]
        conv.message[-1] = {"role": "assistant", "content": ans["answer"], "id": message_id}
        ans["id"] = message_id

    try:
        if conv.source == "agent":
            conv.message.append(msg[-1])
            e, cvs = UserCanvasService.get_by_id(conv.dialog_id)
            if not e:
                return server_error_response("canvas not found.")

            if not isinstance(cvs.dsl, str):
                cvs.dsl = json.dumps(cvs.dsl, ensure_ascii=False)

            if not conv.reference:
                conv.reference = []
            conv.message.append({"role": "assistant", "content": "", "id": message_id})
            conv.reference.append({"chunks": [], "doc_aggs": []})

            final_ans = {"reference": [], "doc_aggs": []}
            canvas = Canvas(cvs.dsl, objs[0].tenant_id)

            canvas.messages.append(msg[-1])
            canvas.add_user_input(msg[-1]["content"])
            answer = canvas.run(stream=False)

            assert answer is not None, "Nothing. Is it over?"

            data_type_picture = {
                "type": 3,
                "url": "base64 content"
            }
            data = [
                {
                    "type": 1,
                    "content": ""
                }
            ]
            final_ans["content"] = "\n".join(answer["content"]) if "content" in answer else ""
            canvas.messages.append({"role": "assistant", "content": final_ans["content"], "id": message_id})
            if final_ans.get("reference"):
                canvas.reference.append(final_ans["reference"])
            cvs.dsl = json.loads(str(canvas))

            ans = {"answer": final_ans["content"], "reference": final_ans.get("reference", [])}
            data[0]["content"] += re.sub(r'##\d\$\$', '', ans["answer"])
            fillin_conv(ans)
            API4ConversationService.append_message(conv.id, conv.to_dict())

            chunk_idxs = [int(match[2]) for match in re.findall(r'##\d\$\$', ans["answer"])]
            for chunk_idx in chunk_idxs[:1]:
                if ans["reference"]["chunks"][chunk_idx]["img_id"]:
                    try:
                        bkt, nm = ans["reference"]["chunks"][chunk_idx]["img_id"].split("-")
                        response = STORAGE_IMPL.get(bkt, nm)
                        data_type_picture["url"] = base64.b64encode(response).decode('utf-8')
                        data.append(data_type_picture)
                        break
                    except Exception as e:
                        return server_error_response(e)

            response = {"code": 200, "msg": "success", "data": data}
            return response

        # ******************For dialog******************
        conv.message.append(msg[-1])
        e, dia = DialogService.get_by_id(conv.dialog_id)
        if not e:
            return get_data_error_result(message="Dialog not found!")
        del req["conversation_id"]

        if not conv.reference:
            conv.reference = []
        conv.message.append({"role": "assistant", "content": "", "id": message_id})
        conv.reference.append({"chunks": [], "doc_aggs": []})

        data_type_picture = {
            "type": 3,
            "url": "base64 content"
        }
        data = [
            {
                "type": 1,
                "content": ""
            }
        ]
        ans = ""
        for a in chat(dia, msg, stream=False, **req):
            ans = a
            break
        data[0]["content"] += re.sub(r'##\d\$\$', '', ans["answer"])
        fillin_conv(ans)
        API4ConversationService.append_message(conv.id, conv.to_dict())

        chunk_idxs = [int(match[2]) for match in re.findall(r'##\d\$\$', ans["answer"])]
        for chunk_idx in chunk_idxs[:1]:
            if ans["reference"]["chunks"][chunk_idx]["img_id"]:
                try:
                    bkt, nm = ans["reference"]["chunks"][chunk_idx]["img_id"].split("-")
                    response = STORAGE_IMPL.get(bkt, nm)
                    data_type_picture["url"] = base64.b64encode(response).decode('utf-8')
                    data.append(data_type_picture)
                    break
                except Exception as e:
                    return server_error_response(e)

        response = {"code": 200, "msg": "success", "data": data}
        return response

    except Exception as e:
        return server_error_response(e)


@manager.route('/retrieval', methods=['POST'])  # noqa: F821
@validate_request("kb_id", "question")
def retrieval():
    """
    知识库检索
    
    在指定知识库中检索与问题相关的内容块
    
    请求头:
        - Authorization: 包含API令牌的Bearer认证头
        
    请求参数:
        - kb_id: 知识库ID列表
        - question: 检索问题
        - doc_ids: 文档ID列表（可选，限制检索范围）
        - page: 页码（默认为1）
        - size: 每页数量（默认为30）
        - similarity_threshold: 相似度阈值（默认为0.2）
        - vector_similarity_weight: 向量相似度权重（默认为0.3）
        - top_k: 检索最大结果数（默认为1024）
        - keyword: 是否使用关键词增强（默认为false）
        - rerank_id: 重排模型ID（可选）
        
    返回:
        成功：包含检索结果的JSON对象
        失败：错误信息
    """
    token = request.headers.get('Authorization').split()[1]
    objs = APIToken.query(token=token)
    if not objs:
        return get_json_result(
            data=False, message='Authentication error: API key is invalid!"', code=settings.RetCode.AUTHENTICATION_ERROR)

    req = request.json
    kb_ids = req.get("kb_id", [])
    doc_ids = req.get("doc_ids", [])
    question = req.get("question")
    page = int(req.get("page", 1))
    size = int(req.get("size", 30))
    similarity_threshold = float(req.get("similarity_threshold", 0.2))
    vector_similarity_weight = float(req.get("vector_similarity_weight", 0.3))
    top = int(req.get("top_k", 1024))

    try:
        # 获取知识库信息并验证嵌入模型
        kbs = KnowledgebaseService.get_by_ids(kb_ids)
        embd_nms = list(set([kb.embd_id for kb in kbs]))
        if len(embd_nms) != 1:
            return get_json_result(
                data=False, message='Knowledge bases use different embedding models or does not exist."',
                code=settings.RetCode.AUTHENTICATION_ERROR)

        # 初始化嵌入模型和重排模型
        embd_mdl = TenantLLMService.model_instance(
            kbs[0].tenant_id, LLMType.EMBEDDING.value, llm_name=kbs[0].embd_id)
        rerank_mdl = None
        if req.get("rerank_id"):
            rerank_mdl = TenantLLMService.model_instance(
                kbs[0].tenant_id, LLMType.RERANK.value, llm_name=req["rerank_id"])
        
        # 如果启用关键词增强，使用LLM生成关键词
        if req.get("keyword", False):
            chat_mdl = TenantLLMService.model_instance(kbs[0].tenant_id, LLMType.CHAT)
            question += keyword_extraction(chat_mdl, question)
        
        # 执行检索
        ranks = settings.retrievaler.retrieval(question, embd_mdl, kbs[0].tenant_id, kb_ids, page, size,
                                               similarity_threshold, vector_similarity_weight, top,
                                               doc_ids, rerank_mdl=rerank_mdl,
                                               rank_feature=label_question(question, kbs))
        
        # 移除向量数据以减小响应大小
        for c in ranks["chunks"]:
            c.pop("vector", None)
        return get_json_result(data=ranks)
    except Exception as e:
        if str(e).find("not_found") > 0:
            return get_json_result(data=False, message='No chunk found! Check the chunk status please!',
                                   code=settings.RetCode.DATA_ERROR)
        return server_error_response(e)
