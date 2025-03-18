/**
 * 检索节点组件 - 流程图中用于知识库检索的节点
 * 该组件实现了一个具有输入/输出连接点的流程图节点，可展示关联的知识库信息
 */
import { useTheme } from '@/components/theme-provider';
import { useFetchKnowledgeList } from '@/hooks/knowledge-hooks';
import { IRetrievalNode } from '@/interfaces/database/flow';
import { UserOutlined } from '@ant-design/icons';
import { Handle, NodeProps, Position } from '@xyflow/react';
import { Avatar, Flex } from 'antd';
import classNames from 'classnames';
import { get } from 'lodash';
import { useMemo } from 'react';
import { LeftHandleStyle, RightHandleStyle } from './handle-icon';
import styles from './index.less';
import NodeHeader from './node-header';

/**
 * 检索节点组件
 * @param {string} id - 节点的唯一标识符
 * @param {IRetrievalNode} data - 节点的数据，包含名称、标签和知识库配置
 * @param {boolean} isConnectable - 节点是否可连接，默认为true
 * @param {boolean} selected - 节点是否被选中
 * @returns {JSX.Element} 渲染的节点组件
 */
export function RetrievalNode({
  id,
  data,
  isConnectable = true,
  selected,
}: NodeProps<IRetrievalNode>) {
  // 从节点数据中获取关联的知识库ID列表
  const knowledgeBaseIds: string[] = get(data, 'form.kb_ids', []);

  // 获取当前主题（深色/浅色）
  const { theme } = useTheme();

  // 获取所有知识库列表数据
  const { list: knowledgeList } = useFetchKnowledgeList(true);

  // 根据知识库ID过滤出需要显示的知识库信息
  const knowledgeBases = useMemo(() => {
    return knowledgeBaseIds.map((x) => {
      const item = knowledgeList.find((y) => x === y.id);
      return {
        name: item?.name,
        avatar: item?.avatar,
        id: x,
      };
    });
  }, [knowledgeList, knowledgeBaseIds]);

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

      {/* 节点标题区域 - 显示节点名称和标签，当有知识库时应用特定样式 */}
      <NodeHeader
        id={id}
        name={data.name}
        label={data.label}
        className={classNames({
          [styles.nodeHeader]: knowledgeBaseIds.length > 0,
        })}
      ></NodeHeader>

      {/* 知识库列表区域 - 垂直排列各个知识库信息 */}
      <Flex vertical gap={8}>
        {knowledgeBases.map((knowledge) => {
          return (
            <div className={styles.nodeText} key={knowledge.id}>
              <Flex align={'center'} gap={6}>
                {/* 知识库头像 - 显示知识库的头像或默认图标 */}
                <Avatar
                  size={26}
                  icon={<UserOutlined />}
                  src={knowledge.avatar}
                />
                {/* 知识库名称 - 展示知识库的名称 */}
                <Flex className={styles.knowledgeNodeName} flex={1}>
                  {knowledge.name}
                </Flex>
              </Flex>
            </div>
          );
        })}
      </Flex>
    </section>
  );
}
