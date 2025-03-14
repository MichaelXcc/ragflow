import { useTheme } from '@/components/theme-provider';
import { useFetchFlow } from '@/hooks/flow-hooks';
import {
  BaseEdge,
  EdgeLabelRenderer,
  EdgeProps,
  getBezierPath,
} from '@xyflow/react';
import { useMemo, useState } from 'react';
import useGraphStore from '../../store';
import styles from './flow-edge.less';

export function FlowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  source,
  target,
  style = {},
  selected,
}: EdgeProps) {
  const { deleteEdgeById } = useGraphStore((state) => state);
  const { data: flowDetail } = useFetchFlow();
  const [isHovered, setIsHovered] = useState(false);

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const { theme } = useTheme();

  const graphPath = useMemo(() => {
    // TODO: this will be called multiple times
    const path = flowDetail?.dsl?.path ?? [];
    // The second to last
    const previousGraphPath: string[] = path.at(-2) ?? [];
    let graphPath: string[] = path.at(-1) ?? [];
    // The last of the second to last article
    const previousLatestElement = previousGraphPath.at(-1);
    if (previousGraphPath.length > 0 && previousLatestElement) {
      graphPath = [previousLatestElement, ...graphPath];
    }
    return graphPath;
  }, [flowDetail?.dsl?.path]);

  const edgeStyles = useMemo(() => {
    let flowStyle = {
      ...style,
      strokeWidth: 2,
    };

    if (selected) {
      flowStyle = {
        ...flowStyle,
        stroke: '#ff0072',
        strokeWidth: 3,
      };
    }

    // 检查边是否在路径中
    const idx = graphPath.findIndex((x) => x === source);
    if (idx !== -1) {
      // The set of elements following source
      const slicedGraphPath = graphPath.slice(idx + 1);
      if (slicedGraphPath.some((x) => x === target)) {
        flowStyle = {
          ...flowStyle,
          stroke: '#1677ff',
          strokeWidth: 3,
        };
      }
    }

    return flowStyle;
  }, [style, selected, graphPath, source, target]);

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  return (
    <>
      <BaseEdge
        path={edgePath}
        style={edgeStyles}
        className={styles.flowEdge}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: isHovered || selected ? 'all' : 'none',
            zIndex: 1001,
            opacity: isHovered || selected ? 1 : 0,
            transition: 'opacity 0.3s ease',
          }}
          className="nodrag nopan"
        >
          <button
            className={
              theme === 'dark' ? styles.edgeButtonDark : styles.edgeButton
            }
            onClick={() => {
              deleteEdgeById(id);
            }}
          >
            ×
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
