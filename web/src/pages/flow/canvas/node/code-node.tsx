import { useTheme } from '@/components/theme-provider';
import { ICodeNode } from '@/interfaces/database/flow';
import { Handle, NodeProps, Position } from '@xyflow/react';
import classNames from 'classnames';
import React from 'react';
import { LeftHandleStyle, RightHandleStyle } from './handle-icon';
import styles from './index.less';
import NodeHeader from './node-header';

function CodeNode({
  id,
  data,
  isConnectable = true,
  selected,
}: NodeProps<ICodeNode>) {
  const { theme } = useTheme();

  const nodeStyle = {
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'center',
    padding: '10px',
    height: 'auto',
    minHeight: '50px',
    zIndex: 9999,
  };

  return (
    <section
      className={classNames(
        styles.logicNode,
        styles.codeNode,
        theme === 'dark' ? styles.dark : '',
        {
          [styles.selectedNode]: selected,
        },
      )}
      style={nodeStyle}
    >
      <Handle
        id="target"
        type="target"
        position={Position.Left}
        isConnectable={isConnectable}
        className={styles.handle}
        style={LeftHandleStyle}
      />
      <Handle
        id="source"
        type="source"
        position={Position.Right}
        isConnectable={isConnectable}
        className={styles.handle}
        style={RightHandleStyle}
      />

      <NodeHeader
        id={id}
        name={data.name}
        label={data.label}
        className={styles.nodeHeader}
      />
    </section>
  );
}

export default React.memo(CodeNode);
