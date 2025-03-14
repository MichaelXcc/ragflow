import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Background,
  ConnectionMode,
  ControlButton,
  Controls,
  NodeTypes,
  ReactFlow,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  /* Book, */ FolderInput,
  FolderOutput,
  LayoutGrid,
} from 'lucide-react';
import ChatDrawer from '../chat/drawer';
import FormDrawer from '../flow-drawer';
import {
  useHandleDrop,
  useSelectCanvasData,
  useValidateConnection,
  useWatchNodeFormDataChange,
} from '../hooks';
import { useBeforeDelete } from '../hooks/use-before-delete';
import { useHandleExportOrImportJsonFile } from '../hooks/use-export-json';
// import { useOpenDocument } from '../hooks/use-open-document';
import dagre from 'dagre';
import { useShowDrawer } from '../hooks/use-show-drawer';
import JsonUploadModal from '../json-upload-modal';
import RunDrawer from '../run-drawer';
import { ButtonEdge } from './edge';
import { FlowEdge } from './edge/flow-edge';
import styles from './index.less';
import { RagNode } from './node';
import { BeginNode } from './node/begin-node';
import { CategorizeNode } from './node/categorize-node';
import CodeNode from './node/code-node';
import { EmailNode } from './node/email-node';
import { GenerateNode } from './node/generate-node';
import { InvokeNode } from './node/invoke-node';
import { IterationNode, IterationStartNode } from './node/iteration-node';
import { KeywordNode } from './node/keyword-node';
import { LogicNode } from './node/logic-node';
import { MessageNode } from './node/message-node';
import NoteNode from './node/note-node';
import { RelevantNode } from './node/relevant-node';
import { RetrievalNode } from './node/retrieval-node';
import { RewriteNode } from './node/rewrite-node';
import { SwitchNode } from './node/switch-node';
import { TemplateNode } from './node/template-node';

const nodeTypes: NodeTypes = {
  ragNode: RagNode,
  categorizeNode: CategorizeNode,
  beginNode: BeginNode,
  relevantNode: RelevantNode,
  logicNode: LogicNode,
  noteNode: NoteNode,
  switchNode: SwitchNode,
  generateNode: GenerateNode,
  retrievalNode: RetrievalNode,
  messageNode: MessageNode,
  rewriteNode: RewriteNode,
  keywordNode: KeywordNode,
  invokeNode: InvokeNode,
  templateNode: TemplateNode,
  emailNode: EmailNode,
  group: IterationNode,
  iterationStartNode: IterationStartNode,
  // TODO: add more operators
  codeNode: CodeNode,
};

const edgeTypes = {
  buttonEdge: ButtonEdge,
  flowEdge: FlowEdge,
};

interface IProps {
  drawerVisible: boolean;
  hideDrawer(): void;
}

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const nodeWidth = 180;
const nodeHeight = 100;
const nodeSpacing = 50; // 节点边框之间的间距
/**
 * 获取布局后的节点和边
 * @param nodes - 节点列表
 * @param edges - 边列表
 * @returns 布局后的节点和边
 * dagre 布局算法支持以下几种主要的布局方向：
    rankdir（布局方向）：
    'TB' - 从上到下（Top to Bottom）
    'BT' - 从下到上（Bottom to Top）
    'LR' - 从左到右（Left to Right）
    'RL' - 从右到左（Right to Left）
    align（对齐方式）：
    'UL' - 左上对齐（Upper Left）
    'UR' - 右上对齐（Upper Right）
    'DL' - 左下对齐（Down Left）
    'DR' - 右下对齐（Down Right）
    ranker（层级排序算法）：
    'network-simplex' - 网络单纯形算法（当前使用）
    'tight-tree' - 紧凑树算法
    'longest-path' - 最长路径算法
    acyclicer（处理循环依赖）：
    'greedy' - 贪婪算法（当前使用）
    'dfs' - 深度优先搜索
    间距相关参数：
    nodesep - 节点之间的水平间距
    ranksep - 层级之间的垂直间距
    edgesep - 边之间的最小间距
    marginx - 图的水平边距
    marginy - 图的垂直边距
 */
function getLayoutedElements(nodes: any[], edges: any[]) {
  // 设置图的布局参数
  dagreGraph.setGraph({
    rankdir: 'LR', // 从上到下的布局
    align: 'UL', // 左上对齐
    nodesep: nodeWidth + nodeSpacing, // 水平方向：节点宽度 + 间距
    ranksep: nodeHeight + nodeSpacing, // 垂直方向：节点高度 + 间距
    marginx: 50, // 图的水平边距
    marginy: 50, // 图的垂直边距
    acyclicer: 'greedy', // 处理循环依赖
    ranker: 'network-simplex', // 使用网络单纯形算法
    edgesep: 50, // 边之间的最小间距
  });

  // 设置节点
  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, {
      width: nodeWidth,
      height: nodeHeight,
      marginx: 0,
      marginy: 0,
    });
  });

  // 设置边
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target, {
      minlen: 2, // 增加最小边长度，使节点间距更大
      weight: 2, // 增加边的权重
      labelpos: 'c', // 边的标签位置
      labeloffset: 10, // 边的标签偏移
    });
  });

  // 计算布局
  dagre.layout(dagreGraph);

  // 更新节点位置
  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    node.targetPosition = 'top';
    node.sourcePosition = 'bottom';
    node.position = {
      x: nodeWithPosition.x - nodeWidth / 2,
      y: nodeWithPosition.y - nodeHeight / 2,
    };
  });

  return { nodes, edges };
}

function ArrangeButton() {
  const { getNodes, getEdges, setNodes, setEdges, fitView } = useReactFlow();

  const handleArrange = () => {
    const nodes = getNodes();
    const edges = getEdges();
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      nodes,
      edges,
    );
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
    // 使用 setTimeout 确保在节点位置更新后再触发 fitView
    setTimeout(() => {
      fitView({ duration: 800, padding: 0.2 });
    }, 0);
  };

  return (
    <ControlButton onClick={handleArrange}>
      <Tooltip>
        <TooltipTrigger asChild>
          <LayoutGrid className="!fill-none" />
        </TooltipTrigger>
        <TooltipContent>整理画布</TooltipContent>
      </Tooltip>
    </ControlButton>
  );
}

function FlowCanvas({ drawerVisible, hideDrawer }: IProps) {
  const {
    nodes,
    edges,
    onConnect,
    onEdgesChange,
    onNodesChange,
    onSelectionChange,
  } = useSelectCanvasData();
  const isValidConnection = useValidateConnection();

  const { onDrop, onDragOver, setReactFlowInstance } = useHandleDrop();

  const {
    handleExportJson,
    handleImportJson,
    fileUploadVisible,
    onFileUploadOk,
    hideFileUploadModal,
  } = useHandleExportOrImportJsonFile();

  // const openDocument = useOpenDocument();

  const {
    onNodeClick,
    onPaneClick,
    clickedNode,
    formDrawerVisible,
    hideFormDrawer,
    singleDebugDrawerVisible,
    hideSingleDebugDrawer,
    showSingleDebugDrawer,
    chatVisible,
    runVisible,
    hideRunOrChatDrawer,
    showChatModal,
  } = useShowDrawer({
    drawerVisible,
    hideDrawer,
  });

  const { handleBeforeDelete } = useBeforeDelete();

  useWatchNodeFormDataChange();

  return (
    <div className={styles.canvasWrapper}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        style={{ position: 'absolute', top: 10, left: 0 }}
      >
        <defs>
          <marker
            fill="rgb(157 149 225)"
            id="logo"
            viewBox="0 0 40 40"
            refX="8"
            refY="5"
            markerUnits="strokeWidth"
            markerWidth="20"
            markerHeight="20"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" />
          </marker>
        </defs>
      </svg>
      <ReactFlow
        connectionMode={ConnectionMode.Loose}
        nodes={nodes}
        onNodesChange={onNodesChange}
        edges={edges}
        onEdgesChange={onEdgesChange}
        fitView
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onInit={setReactFlowInstance}
        onSelectionChange={onSelectionChange}
        nodeOrigin={[0.5, 0]}
        isValidConnection={isValidConnection}
        nodesFocusable={true}
        edgesFocusable={false}
        defaultEdgeOptions={{
          type: 'flowEdge',
          style: {
            strokeWidth: 3,
            stroke: '#8c7ae6',
          },
          zIndex: 0,
        }}
        deleteKeyCode={['Delete', 'Backspace']}
        onBeforeDelete={handleBeforeDelete}
      >
        <Background />
        <Controls className="text-black !flex-col-reverse">
          <ArrangeButton />
          <ControlButton onClick={handleImportJson}>
            <Tooltip>
              <TooltipTrigger asChild>
                <FolderInput className="!fill-none" />
              </TooltipTrigger>
              <TooltipContent>导入</TooltipContent>
            </Tooltip>
          </ControlButton>
          <ControlButton onClick={handleExportJson}>
            <Tooltip>
              <TooltipTrigger asChild>
                <FolderOutput className="!fill-none" />
              </TooltipTrigger>
              <TooltipContent>导出</TooltipContent>
            </Tooltip>
          </ControlButton>
          {/* Document按钮已注释掉
          <ControlButton onClick={openDocument}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Book className="!fill-none" />
              </TooltipTrigger>
              <TooltipContent>Document</TooltipContent>
            </Tooltip>
          </ControlButton>
          */}
        </Controls>
      </ReactFlow>
      {formDrawerVisible && (
        <FormDrawer
          node={clickedNode}
          visible={formDrawerVisible}
          hideModal={hideFormDrawer}
          singleDebugDrawerVisible={singleDebugDrawerVisible}
          hideSingleDebugDrawer={hideSingleDebugDrawer}
          showSingleDebugDrawer={showSingleDebugDrawer}
        ></FormDrawer>
      )}
      {chatVisible && (
        <ChatDrawer
          visible={chatVisible}
          hideModal={hideRunOrChatDrawer}
        ></ChatDrawer>
      )}

      {runVisible && (
        <RunDrawer
          hideModal={hideRunOrChatDrawer}
          showModal={showChatModal}
        ></RunDrawer>
      )}
      {fileUploadVisible && (
        <JsonUploadModal
          onOk={onFileUploadOk}
          visible={fileUploadVisible}
          hideModal={hideFileUploadModal}
        ></JsonUploadModal>
      )}
    </div>
  );
}

export default FlowCanvas;
