import { useSetModalState } from '@/hooks/common-hooks';
import { ReactFlowProvider } from '@xyflow/react';
import { Layout } from 'antd';
import { useState } from 'react';
import FlowCanvas from './canvas';
import Sider from './flow-sider';
import FlowHeader from './header';
import { useCopyPaste } from './hooks';
import { useFetchDataOnMount } from './hooks/use-fetch-data';
import styles from './index.less';

const { Content } = Layout;

function RagFlow() {
  const [collapsed, setCollapsed] = useState(false);
  const {
    visible: chatDrawerVisible,
    hideModal: hideChatDrawer,
    showModal: showChatDrawer,
  } = useSetModalState();

  useFetchDataOnMount();
  useCopyPaste();

  return (
    <Layout className={styles.mainLayout}>
      <ReactFlowProvider>
        <Sider setCollapsed={setCollapsed} collapsed={collapsed}></Sider>
        <Layout>
          <Content className={styles.contentContainer}>
            <FlowCanvas
              drawerVisible={chatDrawerVisible}
              hideDrawer={hideChatDrawer}
            ></FlowCanvas>
            <FlowHeader
              showChatDrawer={showChatDrawer}
              chatDrawerVisible={chatDrawerVisible}
            ></FlowHeader>
          </Content>
        </Layout>
      </ReactFlowProvider>
    </Layout>
  );
}

export default RagFlow;
