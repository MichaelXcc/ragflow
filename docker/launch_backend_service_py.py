#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
RAGFlow后端服务启动脚本，替代原有的bash启动脚本

该脚本实现了对原bash脚本(launch_backend_service.sh)的功能替代，主要职责包括：
1. 启动多个任务执行器进程(task_executor.py)
2. 启动RAGFlow主服务器进程(ragflow_server.py)
3. 实现进程监控和自动重启机制
4. 处理终止信号并优雅关闭所有子进程

技术实现：
- 使用Python的subprocess模块管理子进程
- 使用ThreadPoolExecutor实现并发控制
- 实现信号处理确保优雅退出
- 提供自动重试机制增强服务稳定性
"""

import os                      # 操作系统接口，用于环境变量设置和路径操作
import sys                     # 系统相关功能，如命令行参数获取和退出控制
import time                    # 时间相关功能，用于实现延时等待
import signal                  # 信号处理，用于捕获SIGINT、SIGTERM等信号
import subprocess              # 子进程管理，用于启动和监控外部进程
import logging                 # 日志管理，用于记录系统运行状态
from concurrent.futures import ThreadPoolExecutor  # 线程池，用于并发管理任务执行器和服务器进程

# 设置日志格式，包含时间戳、日志名称、日志级别和消息内容
logging.basicConfig(
    level=logging.INFO,        # 设置日志级别为INFO，记录所有信息、警告和错误消息
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'  # 时间戳-日志名称-日志级别-日志内容
)

# 清除可能的代理环境变量，避免网络请求被重定向到代理服务器
# 这在Docker环境中特别重要，因为Docker守护进程可能设置了代理
os.environ.update({
    "http_proxy": "",
    "https_proxy": "",
    "no_proxy": "",
    "HTTP_PROXY": "",
    "HTTPS_PROXY": "",
    "NO_PROXY": ""
})

# 设置Python路径为当前工作目录，确保能够正确导入项目模块
os.environ["PYTHONPATH"] = os.getcwd()

# 设置动态链接库路径，确保能够找到系统库
# 针对Linux环境下的标准库路径，特别是在Docker容器中
os.environ["LD_LIBRARY_PATH"] = "/usr/lib/x86_64-linux-gnu/"

# 尝试获取jemalloc内存分配器的路径
# jemalloc是一个高性能的内存分配器，可以减少内存碎片和提高内存使用效率
try:
    # 使用pkg-config工具获取jemalloc的库目录，并构造完整的库文件路径
    jemalloc_path = subprocess.check_output("pkg-config --variable=libdir jemalloc", shell=True).decode().strip() + "/libjemalloc.so"
except Exception as e:
    # 如果获取失败，记录警告日志并将jemalloc_path设为None
    logging.warning(f"无法获取jemalloc路径: {e}")
    jemalloc_path = None

# 设置工作进程数，从环境变量WS获取，如果未设置或小于1则默认为1
# 这决定了启动多少个任务执行器进程
WS = int(os.environ.get("WS", "1"))
if WS < 1:
    WS = 1

# 最大重试次数，当进程异常退出时，最多尝试重启的次数
MAX_RETRIES = 5

# 子进程列表，用于跟踪所有启动的子进程，便于后续清理
processes = []

# 控制终止的标志，用于在接收到终止信号时通知所有线程停止工作
stop_flag = False

def cleanup(signum, frame):
    """
    信号处理函数，用于处理终止信号(如CTRL+C或kill命令)
    
    参数:
        signum: 接收到的信号编号
        frame: 当前的执行帧
        
    功能:
        1. 设置停止标志，通知所有线程准备退出
        2. 依次终止所有子进程
        3. 如果子进程在给定时间内未能正常终止，则强制终止
        4. 退出程序
    """
    global stop_flag
    logging.info("收到终止信号，正在关闭服务...")
    stop_flag = True
    
    # 终止所有子进程
    for process in processes:
        if process.poll() is None:  # 检查进程是否仍在运行
            logging.info(f"终止进程 {process.pid}")
            try:
                # 先尝试优雅终止进程
                process.terminate()
                # 等待最多5秒让进程自行退出
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                # 如果进程在5秒内未能终止，则强制终止
                process.kill()
    
    # 退出程序
    sys.exit(0)

def run_task_executor(task_id):
    """
    启动任务执行器进程，并在进程异常退出时自动重启
    
    参数:
        task_id: 任务执行器的ID，用于区分不同的执行器实例
        
    功能:
        1. 启动task_executor.py进程，并传入任务ID
        2. 如果配置了jemalloc，则使用LD_PRELOAD预加载jemalloc以优化内存管理
        3. 监控进程退出状态，如果异常退出则自动重启
        4. 达到最大重试次数后，调用cleanup函数终止所有服务
    
    执行流程:
        1. 初始化重试计数器
        2. 循环尝试启动进程，直到成功或达到最大重试次数
        3. 等待进程结束并检查退出码
        4. 根据退出码决定是否重试或退出
    """
    retry_count = 0
    
    while not stop_flag and retry_count < MAX_RETRIES:
        logging.info(f"启动任务执行器 task_executor.py，任务ID: {task_id} (尝试 {retry_count + 1})")
        
        # 构建命令行参数
        cmd = [sys.executable, "rag/svr/task_executor.py", str(task_id)]
        
        # 如果有jemalloc，则使用LD_PRELOAD预加载它
        if jemalloc_path:
            env = os.environ.copy()
            env["LD_PRELOAD"] = jemalloc_path
            process = subprocess.Popen(cmd, env=env)
        else:
            process = subprocess.Popen(cmd)
            
        # 将新进程添加到进程列表中
        processes.append(process)
        
        # 等待进程结束
        exit_code = process.wait()
        processes.remove(process)
        
        # 检查进程退出状态
        if exit_code == 0:
            logging.info(f"任务执行器，任务ID: {task_id} 成功退出")
            break
        else:
            logging.error(f"任务执行器，任务ID: {task_id} 失败，退出码: {exit_code}，准备重试...")
            retry_count += 1
            time.sleep(2)  # 延迟2秒后重试，避免频繁重启
    
    # 如果达到最大重试次数，则终止所有服务
    if retry_count >= MAX_RETRIES:
        logging.error(f"任务执行器，任务ID: {task_id} 在 {MAX_RETRIES} 次尝试后仍然失败，退出...")
        cleanup(None, None)

def run_server():
    """
    启动RAGFlow主服务器进程，并在进程异常退出时自动重启
    
    功能:
        1. 启动ragflow_server.py进程
        2. 监控进程退出状态，如果异常退出则自动重启
        3. 达到最大重试次数后，调用cleanup函数终止所有服务
    
    执行流程:
        1. 初始化重试计数器
        2. 循环尝试启动进程，直到成功或达到最大重试次数
        3. 等待进程结束并检查退出码
        4. 根据退出码决定是否重试或退出
    
    服务器架构说明:
        ragflow_server.py是RAGFlow的主服务器程序，负责处理客户端请求、
        API调用和任务分发。它会监听HTTP端口并提供RESTful API接口。
    """
    retry_count = 0
    
    while not stop_flag and retry_count < MAX_RETRIES:
        logging.info(f"启动 ragflow_server.py (尝试 {retry_count + 1})")
        
        # 启动主服务器进程
        process = subprocess.Popen([sys.executable, "api/ragflow_server.py"])
        processes.append(process)
        
        # 等待进程结束
        exit_code = process.wait()
        processes.remove(process)
        
        # 检查进程退出状态
        if exit_code == 0:
            logging.info("ragflow_server.py 成功退出")
            break
        else:
            logging.error(f"ragflow_server.py 失败，退出码: {exit_code}，准备重试...")
            retry_count += 1
            time.sleep(2)  # 延迟2秒后重试，避免频繁重启
    
    # 如果达到最大重试次数，则终止所有服务
    if retry_count >= MAX_RETRIES:
        logging.error(f"ragflow_server.py 在 {MAX_RETRIES} 次尝试后仍然失败，退出...")
        cleanup(None, None)

def main():
    """
    主函数，负责启动和管理所有服务进程
    
    功能:
        1. 注册信号处理器，捕获SIGINT和SIGTERM信号
        2. 创建线程池，用于并发管理多个任务执行器和服务器进程
        3. 启动指定数量的任务执行器进程
        4. 启动主服务器进程
        5. 等待直到收到终止信号
    
    系统架构说明:
        - 每个任务执行器(task_executor.py)负责处理特定类型的任务，如文档处理、索引创建等
        - 主服务器(ragflow_server.py)负责接收和分发任务、处理API请求等
        - 所有进程共享同一个数据存储和消息队列，实现分布式协作
    """
    # 注册信号处理器，捕获SIGINT(Ctrl+C)和SIGTERM(kill命令)信号
    signal.signal(signal.SIGINT, cleanup)
    signal.signal(signal.SIGTERM, cleanup)
    
    # 创建线程池，最大线程数为WS+1(所有任务执行器+主服务器)
    with ThreadPoolExecutor(max_workers=WS + 1) as executor:
        # 启动任务执行器进程
        for i in range(WS):
            executor.submit(run_task_executor, i)
        
        # 启动主服务器进程
        executor.submit(run_server)
        
        # 主循环：等待直到收到终止信号
        # 每秒检查一次stop_flag，避免过度消耗CPU资源
        while not stop_flag:
            time.sleep(1)

# 程序入口点
if __name__ == "__main__":
    main() 