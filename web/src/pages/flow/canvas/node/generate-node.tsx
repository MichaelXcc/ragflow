/**
 * 生成节点组件 - 流程图中用于生成内容的节点
 * 该组件实现了一个具有输入/输出连接点的流程图节点
 */
import LLMLabel from '@/components/llm-select/llm-label';
import { useTheme } from '@/components/theme-provider';
import { IGenerateNode } from '@/interfaces/database/flow';
import { Handle, NodeProps, Position } from '@xyflow/react';
import classNames from 'classnames';
import { get } from 'lodash';
import { LeftHandleStyle, RightHandleStyle } from './handle-icon';
import styles from './index.less';
import NodeHeader from './node-header';

/**
 * 生成节点组件
 * @param {string} id - 节点的唯一标识符
 * @param {IGenerateNode} data - 节点的数据，包含名称、标签和表单信息
 * @param {boolean} isConnectable - 节点是否可连接，默认为true
 * @param {boolean} selected - 节点是否被选中
 * @returns {JSX.Element} 渲染的节点组件
 */
export function GenerateNode({
  id,
  data,
  isConnectable = true,
  selected,
}: NodeProps<IGenerateNode>) {
  // 获取当前主题（深色/浅色）
  const { theme } = useTheme();

  return (
    <section
      className={classNames(
        styles.logicNode, // 基础节点样式
        theme === 'dark' ? styles.dark : '', // 根据主题应用深色样式
        {
          [styles.selectedNode]: selected, // 被选中时应用选中样式
        },
      )}
    >
      {/* 左侧连接点 - 作为输入连接点 */}
      <Handle
        id="c"
        type="source"
        position={Position.Left}
        isConnectable={isConnectable}
        className={styles.handle}
        style={LeftHandleStyle}
      ></Handle>

      {/* 右侧连接点 - 作为输出连接点 */}
      <Handle
        type="source"
        position={Position.Right}
        isConnectable={isConnectable}
        className={styles.handle}
        style={RightHandleStyle}
        id="b"
      ></Handle>

      {/* 节点标题区域 - 显示节点名称和标签 */}
      <NodeHeader
        id={id}
        name={data.name}
        label={data.label}
        className={styles.nodeHeader}
      ></NodeHeader>

      {/* 节点内容区域 - 显示LLM模型信息 */}
      <div className={styles.nodeText}>
        <LLMLabel value={get(data, 'form.llm_id')}></LLMLabel>
      </div>
    </section>
  );
}
