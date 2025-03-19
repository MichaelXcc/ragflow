import CopyToClipboard from '@/components/copy-to-clipboard';
import { useTheme } from '@/components/theme-provider';
import { useFetchFlow } from '@/hooks/flow-hooks';
import {
  CopyOutlined,
  DeleteOutlined,
  DownOutlined,
  FormatPainterOutlined,
  FullscreenOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons';
import Editor, { useMonaco } from '@monaco-editor/react';
import {
  Button,
  Dropdown,
  Form,
  Input,
  MenuProps,
  Select,
  Space,
  Spin,
  Tooltip,
  Typography,
  message,
} from 'antd';
import axios from 'axios';
import { isEmpty } from 'lodash';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import JsonView from 'react18-json-view';
import 'react18-json-view/src/style.css';
import { IOperatorForm } from '../interface';
import InputVariableSelector from './components/input-variable-selector';

const languageOptions = [
  { value: 'python', label: 'Python' },
  // { value: 'javascript', label: 'JavaScript' },
  // { value: 'typescript', label: 'TypeScript' },
  // { value: 'shell', label: 'Shell (Bash)' },
  // { value: 'sql', label: 'SQL' },
  // { value: 'json', label: 'JSON' },
  // { value: 'html', label: 'HTML' },
  // { value: 'css', label: 'CSS' },
  // { value: 'markdown', label: 'Markdown' },
  // { value: 'yaml', label: 'YAML' },
];

// 预设语言范例代码
const languageTemplates: Record<string, string> = {
  python:
    'def main(arg1: str, arg2: str) -> dict:\n    return {\n        "result": arg1 + arg2,\n    }',
  // javascript:
  //   '// JavaScript 代码示例\nfunction helloWorld() {\n    console.log("Hello, World!");\n}\n\nhelloWorld();',
  // typescript:
  //   '// TypeScript 代码示例\nfunction helloWorld(name: string): void {\n    console.log(`Hello, ${name}!`);\n}\n\nhelloWorld("World");',
  // shell: '#!/bin/bash\n# Shell 脚本示例\necho "Hello, World!"',
  // sql: '-- SQL 查询示例\nSELECT * FROM users WHERE active = true;',
  // json: '{\n    "name": "示例",\n    "type": "JSON",\n    "properties": {\n        "isValid": true,\n        "count": 42\n    }\n}',
  // html: '<!DOCTYPE html>\n<html>\n<head>\n    <title>示例页面</title>\n</head>\n<body>\n    <h1>Hello, World!</h1>\n</body>\n</html>',
  // css: '/* CSS 样式示例 */\nbody {\n    font-family: Arial, sans-serif;\n    background-color: #f0f0f0;\n}\n\nh1 {\n    color: #333;\n    text-align: center;\n}',
  // markdown:
  //   '# Markdown 示例\n\n## 子标题\n\n- 列表项 1\n- 列表项 2\n- 列表项 3\n\n**粗体文本** 和 *斜体文本*',
  // yaml: '# YAML 示例\nname: 示例配置\nversion: 1.0\nenvironment:\n  production: false\ndependencies:\n  - name: react\n    version: ^18.2.0',
};

// 代码片段库
const codeSnippets: Record<
  string,
  Array<{ label: string; description: string; code: string }>
> = {
  python: [
    {
      label: '默认模板',
      description: '标准Python函数模板',
      code: 'def main(arg1: str, arg2: str) -> dict:\n    return {\n        "result": arg1 + arg2,\n    }',
    },
    {
      label: '文件读取',
      description: '读取文本文件内容',
      code: 'with open("filename.txt", "r", encoding="utf-8") as file:\n    content = file.read()\n    print(content)',
    },
    {
      label: 'HTTP请求',
      description: '使用requests库进行HTTP请求',
      code: 'import requests\n\nresponse = requests.get("https://api.example.com/data")\nif response.status_code == 200:\n    data = response.json()\n    print(data)\nelse:\n    print(f"请求失败: {response.status_code}")',
    },
    {
      label: '数据处理',
      description: '使用pandas处理CSV数据',
      code: 'import pandas as pd\n\n# 读取CSV文件\ndf = pd.read_csv("data.csv")\n\n# 显示前几行\nprint(df.head())\n\n# 基本统计信息\nprint(df.describe())',
    },
  ],
  javascript: [
    {
      label: 'Fetch API',
      description: '使用Fetch API获取数据',
      code: 'fetch("https://api.example.com/data")\n  .then(response => {\n    if (!response.ok) {\n      throw new Error(`HTTP error! Status: ${response.status}`);\n    }\n    return response.json();\n  })\n  .then(data => console.log(data))\n  .catch(error => console.error("获取数据时出错:", error));',
    },
    {
      label: '异步函数',
      description: '使用async/await处理异步操作',
      code: 'async function fetchData() {\n  try {\n    const response = await fetch("https://api.example.com/data");\n    if (!response.ok) {\n      throw new Error(`HTTP error! Status: ${response.status}`);\n    }\n    const data = await response.json();\n    console.log(data);\n    return data;\n  } catch (error) {\n    console.error("获取数据时出错:", error);\n  }\n}\n\nfetchData();',
    },
  ],
  typescript: [
    {
      label: '接口定义',
      description: '定义TypeScript接口',
      code: 'interface User {\n  id: number;\n  name: string;\n  email: string;\n  age?: number; // 可选属性\n  readonly createdAt: Date; // 只读属性\n}\n\nconst user: User = {\n  id: 1,\n  name: "张三",\n  email: "zhangsan@example.com",\n  createdAt: new Date()\n};',
    },
  ],
  shell: [
    {
      label: '循环处理',
      description: '遍历目录中的文件',
      code: '#!/bin/bash\n\n# 遍历当前目录中的所有.txt文件\nfor file in *.txt; do\n  echo "处理文件: $file"\n  # 在这里添加处理文件的命令\ndone',
    },
  ],
  sql: [
    {
      label: '联表查询',
      description: 'SQL联表查询示例',
      code: 'SELECT u.id, u.name, o.order_date, o.amount\nFROM users u\nINNER JOIN orders o ON u.id = o.user_id\nWHERE o.amount > 100\nORDER BY o.order_date DESC\nLIMIT 10;',
    },
  ],
};

// 为其他语言添加空数组，避免未定义错误
Object.keys(languageTemplates).forEach((lang) => {
  if (!codeSnippets[lang]) {
    codeSnippets[lang] = [];
  }
});

/**
 * 输出变量选择器组件
 */
const OutputVariableSelector = () => {
  const { t } = useTranslation();

  return (
    <div
      className="output-variable-container"
      style={{ marginTop: '24px', marginBottom: '24px' }}
    >
      <Typography.Title
        level={5}
        style={{
          fontSize: '16px',
          fontWeight: 500,
          color: '#333',
          marginBottom: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        输出变量
      </Typography.Title>

      <div
        className="output-variable-row"
        style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: '12px',
          backgroundColor: '#f5f7fa',
          borderRadius: '6px',
          padding: '10px',
        }}
      >
        <div style={{ flex: '0 0 150px' }}>
          <Input value="result" disabled />
        </div>

        <div style={{ flex: 1, marginLeft: '12px', marginRight: '12px' }}>
          <Select
            value="String"
            style={{ width: '100%' }}
            options={[{ value: 'String', label: 'String' }]}
            disabled
          />
        </div>

        <Button
          type="text"
          icon={<DeleteOutlined />}
          disabled
          style={{ color: '#999' }}
        />
      </div>
    </div>
  );
};

const CodeForm = ({ form, onValuesChange, node }: IOperatorForm) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const monaco = useMonaco();
  const [showMinimap, setShowMinimap] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [executeResult, setExecuteResult] = useState<any>(null);
  const [executeLoading, setExecuteLoading] = useState(false);
  // 添加编辑器引用
  const editorRef = useCallback(
    (editor: any) => {
      if (editor) {
        // 保存编辑器实例引用
        (window as any).monacoEditor = editor;

        // 添加快捷键绑定
        editor.addAction({
          id: 'format-with-shortcut',
          label: '格式化代码 (Shift+Alt+F)',
          keybindings: [
            // Monaco编辑器的键码常量
            // Shift + Alt + F
            2048 | 512 | 33,
          ],
          run: () => {
            editor.getAction('editor.action.formatDocument')?.run();
          },
        });
      }
    },
    [monaco],
  );

  // 使用useEffect注册格式化提供者
  useEffect(() => {
    if (monaco) {
      // 为Python语言注册格式化提供者
      monaco.languages.registerDocumentFormattingEditProvider('python', {
        provideDocumentFormattingEdits: async (model) => {
          const text = model.getValue();
          try {
            // 在实际项目中，这里应该发送API请求到后端进行专业格式化
            // 例如使用Python的black或autopep8等工具
            // 以下是一个简单的格式化实现

            // 简单Python格式化：修正缩进和空格
            const lines = text.split('\n');
            const formattedLines = [];
            let indentLevel = 0;

            for (let line of lines) {
              const trimmedLine = line.trim();

              // 跳过空行
              if (trimmedLine === '') {
                formattedLines.push('');
                continue;
              }

              // 减少缩进级别（如果行以这些关键词结束）
              if (
                // trimmedLine.startsWith('return') ||
                trimmedLine.startsWith('break') ||
                trimmedLine.startsWith('continue') ||
                trimmedLine.startsWith('pass') ||
                trimmedLine.startsWith('raise') ||
                trimmedLine.startsWith('}') ||
                trimmedLine.startsWith(']') ||
                trimmedLine.startsWith(')')
              ) {
                indentLevel = Math.max(0, indentLevel - 1);
              }

              // 添加当前缩进
              const indent = '    '.repeat(indentLevel);
              formattedLines.push(indent + trimmedLine);

              // 增加缩进级别（如果行以这些关键词结束）
              if (
                trimmedLine.endsWith(':') ||
                trimmedLine.endsWith('{') ||
                trimmedLine.endsWith('[') ||
                (trimmedLine.endsWith('(') && !trimmedLine.includes(')'))
              ) {
                indentLevel++;
              }
            }

            const formattedText = formattedLines.join('\n');

            return [
              {
                range: model.getFullModelRange(),
                text: formattedText,
              },
            ];
          } catch (error) {
            console.error('格式化代码失败:', error);
            // 出错时返回原始文本
            return [
              {
                range: model.getFullModelRange(),
                text: text,
              },
            ];
          }
        },
      });

      // 为JSON注册格式化提供者
      monaco.languages.registerDocumentFormattingEditProvider('json', {
        provideDocumentFormattingEdits: (model) => {
          try {
            const text = model.getValue();
            const json = JSON.parse(text);
            const formattedText = JSON.stringify(json, null, 2);

            return [
              {
                range: model.getFullModelRange(),
                text: formattedText,
              },
            ];
          } catch (error) {
            console.error('格式化JSON失败:', error);
            return [];
          }
        },
      });

      // 为JavaScript注册格式化提供者
      monaco.languages.registerDocumentFormattingEditProvider('javascript', {
        provideDocumentFormattingEdits: (model) => {
          try {
            // 简单的JS格式化
            const text = model.getValue();
            // 这里应该使用专业的JS格式化库，比如prettier
            // 但为了简单起见，我们只进行一些基本处理

            return [
              {
                range: model.getFullModelRange(),
                text: text, // 在生产环境中替换为实际格式化后的文本
              },
            ];
          } catch (error) {
            console.error('格式化JavaScript失败:', error);
            return [];
          }
        },
      });
    }
  }, [monaco]);

  // 使用调试hook
  const { data: flowData } = useFetchFlow();

  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      form?.setFieldsValue({ code: value || '' });
      onValuesChange?.(
        { code: value || '' },
        { ...form?.getFieldsValue(), code: value || '' },
      );
    },
    [form, onValuesChange],
  );

  const handleLanguageChange = useCallback(
    (value: string) => {
      form?.setFieldsValue({ language: value });
      onValuesChange?.(
        { language: value },
        { ...form?.getFieldsValue(), language: value },
      );

      // 如果代码为空，自动填入模板代码
      const currentCode = form?.getFieldValue('code');
      if (!currentCode || currentCode.trim() === '') {
        const templateCode = languageTemplates[value] || '';
        form?.setFieldsValue({ code: templateCode });
        onValuesChange?.(
          { code: templateCode },
          { ...form?.getFieldsValue(), code: templateCode },
        );
      }
    },
    [form, onValuesChange],
  );

  const currentCode = Form.useWatch('code', form) || '';
  const currentLanguage = Form.useWatch('language', form) || 'python';

  const toggleMinimap = useCallback(() => {
    setShowMinimap((prev) => !prev);
  }, []);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  const handleCopyCode = useCallback(() => {
    const code = form?.getFieldValue('code');
    if (code) {
      navigator.clipboard
        .writeText(code)
        .then(() => {
          message.success('代码已复制到剪贴板');
        })
        .catch((err) => {
          console.error('复制失败:', err);
          message.error('复制失败');
        });
    }
  }, [form]);

  const handleFormatCode = useCallback(() => {
    try {
      // 使用全局保存的编辑器实例
      const editor = (window as any).monacoEditor;
      if (editor) {
        editor.getAction('editor.action.formatDocument')?.run();
        message.success('代码已格式化');
      } else {
        message.error('找不到编辑器实例');
      }
    } catch (error) {
      console.error('格式化失败:', error);
      message.error('格式化失败');
    }
  }, []);

  const handleClearCode = useCallback(() => {
    form?.setFieldsValue({ code: '' });
    onValuesChange?.({ code: '' }, { ...form?.getFieldsValue(), code: '' });
  }, [form, onValuesChange]);

  const handleInsertSnippet = useCallback(
    (snippet: string) => {
      form?.setFieldsValue({ code: snippet });
      onValuesChange?.(
        { code: snippet },
        { ...form?.getFieldsValue(), code: snippet },
      );
    },
    [form, onValuesChange],
  );

  // 代码片段菜单项
  const getSnippetMenuItems = useCallback((): MenuProps['items'] => {
    const snippets = codeSnippets[currentLanguage] || [];
    if (snippets.length === 0) {
      return [{ key: 'no-snippets', label: '当前语言暂无代码片段' }];
    }

    return snippets.map((snippet, index) => ({
      key: `snippet-${index}`,
      label: snippet.label,
      title: snippet.description,
      onClick: () => handleInsertSnippet(snippet.code),
    }));
  }, [currentLanguage, handleInsertSnippet]);

  // 设置编辑器高度，全屏模式下更高
  const editorHeight = isFullscreen ? '70vh' : '300px';

  // 配置编辑器选项
  const editorOptions = {
    minimap: { enabled: showMinimap },
    scrollBeyondLastLine: false,
    automaticLayout: true,
    tabSize: 2,
    fontSize: 14,
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    lineNumbers: 'on' as const,
    scrollbar: {
      verticalScrollbarSize: 8,
      horizontalScrollbarSize: 8,
    },
    formatOnPaste: true,
    formatOnType: true,
    autoIndent: 'full' as const,
    wordWrap: 'on' as const,
    suggest: { showKeywords: true },
    quickSuggestions: true,
    renderLineHighlight: 'all' as const,
  };

  // 修改运行代码函数
  const handleRunCode = useCallback(async () => {
    const code = form?.getFieldValue('code');
    const language = form?.getFieldValue('language');
    const variables = form?.getFieldValue('variables') || [];

    if (!code) {
      message.error('代码不能为空');
      return;
    }

    setExecuteLoading(true);
    try {
      const response = await axios.post('/v1/canvas/execute_code', {
        code,
        language,
        variables, // 将变量一起传递给后端
      });

      if (response.data.code === 0) {
        setExecuteResult(response.data.data);
        if (!response.data.data.success) {
          message.error('代码执行出错，请查看错误信息');
        }
      } else {
        message.error(response.data.message || '代码执行失败');
      }
    } catch (error) {
      console.error('执行代码时出错:', error);
      message.error('执行代码时发生错误');
    } finally {
      setExecuteLoading(false);
    }
  }, [form]);
  console.log('node', node);
  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={{
        language: 'python',
        code: languageTemplates.python,
        variables: [],
      }}
    >
      {/* 输入变量选择器 - 允许用户定义变量并选择上一个节点的输出作为输入 */}
      {/* 这些变量可以在代码中被访问，用于数据处理和逻辑编写 */}
      <InputVariableSelector node={node} />
      {/* <div
        style={{
          marginBottom: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Form.Item
          name="language"
          label={
            <span style={{ color: '#333' }}>{t('flow.codeLanguage')}</span>
          }
          rules={[{ required: true, message: t('flow.pleaseSelectLanguage') }]}
          style={{ marginBottom: 0, flex: 1, marginRight: '16px' }}
        >
          <Select
            options={languageOptions}
            placeholder={t('flow.selectLanguage')}
            onChange={handleLanguageChange}
          />
        </Form.Item>

        <Space>
          <Tooltip title={t('flow.toggleMinimap')}>
            <span style={{ color: '#333', marginRight: '4px' }}>Minimap</span>
            <Switch
              size="small"
              checked={showMinimap}
              onChange={toggleMinimap}
            />
          </Tooltip>
          <Tooltip title={t('flow.fullscreen')}>
            <Button
              type="text"
              icon={<FullscreenOutlined style={{ color: '#333' }} />}
              onClick={toggleFullscreen}
              size="small"
            />
          </Tooltip>
        </Space>
      </div> */}

      <Form.Item
        name="code"
        rules={[{ required: true, message: t('flow.pleaseEnterCode') }]}
      >
        <div className="code-editor-container" style={{ position: 'relative' }}>
          <div
            style={{
              border: '1px solid #e0e0e0',
              borderRadius: '12px',
              overflow: 'hidden',
              position: isFullscreen ? 'fixed' : 'relative',
              top: isFullscreen ? '50px' : 'auto',
              left: isFullscreen ? '0' : 'auto',
              right: isFullscreen ? '0' : 'auto',
              bottom: isFullscreen ? '0' : 'auto',
              zIndex: isFullscreen ? 1000 : 'auto',
              width: isFullscreen ? '100%' : 'auto',
              backgroundColor: '#f5f7fa',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
            }}
          >
            <div
              style={{
                padding: '8px 12px',
                display: 'flex',
                justifyContent: 'space-between',
                backgroundColor: '#f5f7fa',
                color: '#333',
                borderBottom: '0',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <Dropdown
                  menu={{
                    items: languageOptions.map((option) => ({
                      key: option.value,
                      label: option.label,
                      onClick: () => handleLanguageChange(option.value),
                    })),
                  }}
                >
                  <div
                    className="language-selector"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      cursor: 'pointer',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      transition: 'background-color 0.2s',
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.backgroundColor = '#f0f2f5')
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.backgroundColor = 'transparent')
                    }
                  >
                    <span
                      style={{
                        fontWeight: 'bold',
                        fontSize: '14px',
                        color: '#444',
                        textTransform: 'uppercase',
                      }}
                    >
                      {currentLanguage}3
                    </span>
                    <DownOutlined
                      style={{
                        fontSize: '10px',
                        marginLeft: '4px',
                        color: '#666',
                      }}
                    />
                  </div>
                </Dropdown>
              </div>
              <Space>
                <Tooltip title="格式化代码">
                  <Button
                    type="text"
                    icon={
                      <FormatPainterOutlined
                        style={{ color: '#1677ff', fontSize: '14px' }}
                      />
                    }
                    size="small"
                    onClick={handleFormatCode}
                  />
                </Tooltip>
                <Tooltip title="复制代码">
                  <Button
                    type="text"
                    icon={<CopyOutlined style={{ color: '#555' }} />}
                    size="small"
                    onClick={handleCopyCode}
                  />
                </Tooltip>
                <Tooltip title={t('flow.fullscreen')}>
                  <Button
                    type="text"
                    icon={<FullscreenOutlined style={{ color: '#555' }} />}
                    size="small"
                    onClick={toggleFullscreen}
                  />
                </Tooltip>
              </Space>
            </div>
            <Editor
              height={editorHeight}
              language={currentLanguage}
              value={currentCode}
              onChange={handleEditorChange}
              theme="light"
              onMount={editorRef}
              options={{
                ...editorOptions,
                fontSize: 14,
                lineHeight: 22,
                fontFamily: '"Menlo", "Monaco", "Courier New", monospace',
                renderWhitespace: 'none',
                renderLineHighlight: 'all',
                scrollBeyondLastLine: false,
                minimap: { enabled: false },
                padding: { top: 15, bottom: 15 },
                overviewRulerBorder: false,
                hideCursorInOverviewRuler: true,
                overviewRulerLanes: 0,
                folding: true,
                glyphMargin: false,
                contextmenu: false,
              }}
            />
            {isFullscreen && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '20px',
                  right: '20px',
                  zIndex: 1001,
                }}
              >
                <Button
                  type="primary"
                  size="small"
                  onClick={toggleFullscreen}
                  style={{ backgroundColor: '#1890ff', color: 'white' }}
                >
                  退出全屏
                </Button>
              </div>
            )}
          </div>
        </div>
      </Form.Item>

      {/* 执行结果区域 - 移除条件判断，始终显示 */}
      <div
        className="code-execution-result"
        style={{ marginTop: '16px', marginBottom: '16px' }}
      >
        <div
          className="result-header"
          style={{
            padding: '8px',
            backgroundColor: '#f5f5f5',
            border: '1px solid #d9d9d9',
            borderTopLeftRadius: '4px',
            borderTopRightRadius: '4px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontWeight: 'bold' }}>执行结果</span>
          {!isEmpty(executeResult) && (
            <CopyToClipboard text={JSON.stringify(executeResult, null, 2)} />
          )}
        </div>
        <div
          style={{
            border: '1px solid #d9d9d9',
            borderTop: 'none',
            borderBottomLeftRadius: '4px',
            borderBottomRightRadius: '4px',
            padding: '16px',
            height: '200px', // 设置固定高度
            maxHeight: '200px',
            overflow: 'auto',
            backgroundColor: '#fafafa', // 添加浅灰色背景
          }}
        >
          <Spin spinning={executeLoading}>
            {!isEmpty(executeResult) ? (
              <JsonView
                src={executeResult}
                displaySize
                collapseStringsAfterLength={100}
                className="w-full break-words overflow-auto bg-slate-100"
              />
            ) : (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  height: '100%',
                  color: '#999',
                }}
              >
                代码执行后将在此处显示结果
              </div>
            )}
          </Spin>
        </div>
      </div>

      {/* 输出变量部分 */}
      <OutputVariableSelector />

      {/* 运行按钮 */}
      <div style={{ marginTop: '16px' }}>
        <Button
          type="primary"
          icon={<PlayCircleOutlined />}
          onClick={handleRunCode}
          loading={executeLoading}
          style={{ width: '100%' }}
        >
          运行代码
        </Button>
      </div>
    </Form>
  );
};

export default CodeForm;
