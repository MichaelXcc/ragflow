import { ReactComponent as ChatAppCube } from '@/assets/svg/chat-app-cube.svg';
import RenameModal from '@/components/rename-modal';
import {
  AppstoreOutlined,
  DeleteOutlined,
  EditOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import {
  Avatar,
  Button,
  Card,
  Col,
  Divider,
  Dropdown,
  Empty,
  Flex,
  Form,
  Input,
  List,
  MenuProps,
  Row,
  Space,
  Spin,
  Tag,
  Typography,
  message,
} from 'antd';
import { MenuItemProps } from 'antd/lib/menu/MenuItem';
import classNames from 'classnames';
import { useCallback, useEffect, useState } from 'react';
import ChatConfigurationModal from './chat-configuration-modal';
import ChatContainer from './chat-container';
import {
  useDeleteConversation,
  useDeleteDialog,
  useEditDialog,
  useHandleItemHover,
  useRenameConversation,
  useSelectDerivedConversationList,
} from './hooks';

import EmbedModal from '@/components/api-service/embed-modal';
import { useShowEmbedModal } from '@/components/api-service/hooks';
import { useTheme } from '@/components/theme-provider';
import { SharedFrom } from '@/constants/chat';
import {
  useClickConversationCard,
  useClickDialogCard,
  useFetchNextDialogList,
  useGetChatSearchParams,
  useRemoveNextDialog,
} from '@/hooks/chat-hooks';
import { useShowDeleteConfirm, useTranslate } from '@/hooks/common-hooks';
import { useSetSelectedRecord } from '@/hooks/logic-hooks';
import { IDialog } from '@/interfaces/database/chat';
import { PictureInPicture2 } from 'lucide-react';
import styles from './index.less';

const { Text, Title } = Typography;

const Chat = () => {
  const { data: dialogList, loading: dialogLoading } = useFetchNextDialogList();
  const { onRemoveDialog } = useDeleteDialog();
  const { onRemoveConversation } = useDeleteConversation();
  const { handleClickDialog } = useClickDialogCard();
  const { handleClickConversation } = useClickConversationCard();
  const { dialogId, conversationId } = useGetChatSearchParams();
  const { theme } = useTheme();
  const [chatListVisible, setChatListVisible] = useState(true);
  const {
    list: conversationList,
    addTemporaryConversation,
    loading: conversationLoading,
  } = useSelectDerivedConversationList();
  const { activated, handleItemEnter, handleItemLeave } = useHandleItemHover();
  const {
    activated: conversationActivated,
    handleItemEnter: handleConversationItemEnter,
    handleItemLeave: handleConversationItemLeave,
  } = useHandleItemHover();
  const {
    conversationRenameLoading,
    initialConversationName,
    onConversationRenameOk,
    conversationRenameVisible,
    hideConversationRenameModal,
    showConversationRenameModal,
  } = useRenameConversation();
  const {
    dialogSettingLoading,
    initialDialog,
    onDialogEditOk,
    dialogEditVisible,
    clearDialog,
    hideDialogEditModal,
    showDialogEditModal,
  } = useEditDialog();
  const { t } = useTranslate('chat');
  const { currentRecord, setRecord } = useSetSelectedRecord<IDialog>();
  const [controller, setController] = useState(new AbortController());
  const { showEmbedModal, hideEmbedModal, embedVisible, beta } =
    useShowEmbedModal();
  const [selectedDialog, setSelectedDialog] = useState<string | null>(null);
  const [showConversations, setShowConversations] = useState(false);
  const [workspaceItems, setWorkspaceItems] = useState<
    Array<{ id: string; type: string }>
  >([]);
  const { removeDialog } = useRemoveNextDialog();
  const showDeleteConfirm = useShowDeleteConfirm();
  const [showRenderPage, setShowRenderPage] = useState(false);
  const [appListModalVisible, setAppListModalVisible] = useState(false);
  const [iframeCode, setIframeCode] = useState('');
  const [showIframe, setShowIframe] = useState(false);
  const [form] = Form.useForm();

  const handleAppCardEnter = (id: string) => () => {
    handleItemEnter(id);
  };

  const handleConversationCardEnter = (id: string) => () => {
    handleConversationItemEnter(id);
  };

  const handleShowChatConfigurationModal =
    (dialogId?: string): any =>
    (info: any) => {
      info?.domEvent?.preventDefault();
      info?.domEvent?.stopPropagation();
      showDialogEditModal(dialogId);
    };

  // 删除对话处理函数
  const handleRemoveDialog =
    (dialogId: string): MenuItemProps['onClick'] =>
    ({ domEvent }) => {
      domEvent.preventDefault();
      domEvent.stopPropagation();

      // 使用从组件顶层获取的hooks结果
      showDeleteConfirm({
        onOk: async () => {
          // 执行删除操作
          const result = await removeDialog([dialogId]);

          // 如果删除成功，从工作区中同步删除
          if (result === 0) {
            const updatedWorkspaceItems = workspaceItems.filter(
              (item) => !(item.id === dialogId && item.type === 'app'),
            );

            // 更新工作区状态
            setWorkspaceItems(updatedWorkspaceItems);

            // 保存到 localStorage
            localStorage.setItem(
              'workspaceItems',
              JSON.stringify(updatedWorkspaceItems),
            );
          }

          return result;
        },
      });
    };

  const handleShowOverviewModal =
    (dialog: IDialog): any =>
    (info: any) => {
      info?.domEvent?.preventDefault();
      info?.domEvent?.stopPropagation();
      setRecord(dialog);
      showEmbedModal();
    };

  const handleRemoveConversation =
    (conversationId: string): MenuItemProps['onClick'] =>
    ({ domEvent }) => {
      domEvent.preventDefault();
      domEvent.stopPropagation();
      onRemoveConversation([conversationId]);
    };

  const handleShowConversationRenameModal =
    (conversationId: string): MenuItemProps['onClick'] =>
    ({ domEvent }) => {
      domEvent.preventDefault();
      domEvent.stopPropagation();
      showConversationRenameModal(conversationId);
    };

  const handleDialogCardClick = useCallback(
    (dialogId: string) => () => {
      setSelectedDialog(dialogId);
      setShowConversations(true);
      handleClickDialog(dialogId);
    },
    [handleClickDialog],
  );

  const handleConversationCardClick = useCallback(
    (conversationId: string, isNew: boolean) => () => {
      handleClickConversation(conversationId, isNew ? 'true' : '');
      setController((pre) => {
        pre.abort();
        return new AbortController();
      });
    },
    [handleClickConversation],
  );

  const handleCreateTemporaryConversation = useCallback(() => {
    addTemporaryConversation();
  }, [addTemporaryConversation]);

  const toggleChatList = useCallback(() => {
    setChatListVisible((prev) => !prev);
  }, []);

  const handleAddToWorkspace = (appId: string) => () => {
    // 检查是否已在工作区中
    const isAlreadyInWorkspace = workspaceItems.some(
      (item) => item.id === appId && item.type === 'app',
    );

    if (!isAlreadyInWorkspace) {
      const updatedWorkspaceItems = [
        ...workspaceItems,
        { id: appId, type: 'app' },
      ];
      setWorkspaceItems(updatedWorkspaceItems);
      // 保存到 localStorage
      localStorage.setItem(
        'workspaceItems',
        JSON.stringify(updatedWorkspaceItems),
      );
      // 添加消息提示
      message.success(t('addedToWorkspace'));
    }
  };

  // 在组件加载时从 localStorage 加载工作区项目
  useEffect(() => {
    const savedWorkspaceItems = localStorage.getItem('workspaceItems');
    if (savedWorkspaceItems) {
      setWorkspaceItems(JSON.parse(savedWorkspaceItems));
    }
  }, []);

  const handleWorkspaceItemClick = (id: string) => () => {
    setSelectedDialog(id);
    setShowConversations(true);
    handleClickDialog(id);
  };

  const handleBackToApps = useCallback(() => {
    setShowConversations(false);
    setSelectedDialog(null);
  }, []);

  const buildAppItems = (dialog: IDialog) => {
    const dialogId = dialog.id;

    const appItems: MenuProps['items'] = [
      {
        key: '1',
        onClick: handleShowChatConfigurationModal(dialogId),
        label: (
          <Space>
            <EditOutlined />
            {t('edit', { keyPrefix: 'common' })}
          </Space>
        ),
      },
      { type: 'divider' },
      {
        key: '2',
        onClick: handleRemoveDialog(dialogId),
        label: (
          <Space>
            <DeleteOutlined />
            {t('delete', { keyPrefix: 'common' })}
          </Space>
        ),
      },
      { type: 'divider' },
      {
        key: '3',
        onClick: handleShowOverviewModal(dialog),
        label: (
          <Space>
            <PictureInPicture2 className="size-4" />
            {t('embedIntoSite', { keyPrefix: 'common' })}
          </Space>
        ),
      },
    ];

    return appItems;
  };

  const buildConversationItems = (conversationId: string) => {
    const appItems: MenuProps['items'] = [
      {
        key: '1',
        onClick: handleShowConversationRenameModal(conversationId),
        label: (
          <Space>
            <EditOutlined />
            {t('rename', { keyPrefix: 'common' })}
          </Space>
        ),
      },
      { type: 'divider' },
      {
        key: '2',
        onClick: handleRemoveConversation(conversationId),
        label: (
          <Space>
            <DeleteOutlined />
            {t('delete', { keyPrefix: 'common' })}
          </Space>
        ),
      },
    ];

    return appItems;
  };

  const getAppIconForWorkspace = (id: string, type: string) => {
    if (type === 'app') {
      const dialog = dialogList.find((d) => d.id === id);
      if (dialog) {
        return <Avatar src={dialog.icon} shape="square" size={36} />;
      }
    }

    switch (type) {
      case 'default':
        return (
          <Avatar
            style={{ backgroundColor: '#f56a00' }}
            shape="square"
            size={36}
          >
            W
          </Avatar>
        );
      default:
        return <Avatar shape="square" size={36} />;
    }
  };

  const getAppNameForWorkspace = (id: string, type: string) => {
    if (type === 'app') {
      const dialog = dialogList.find((d) => d.id === id);
      if (dialog) {
        return dialog.name;
      }
      return t('unknownApp');
    }

    return '';
  };

  const handleIframeSubmit = (values: { iframeCode: string }) => {
    setIframeCode(values.iframeCode);
    setShowIframe(true);
  };

  const handleResetIframe = () => {
    setIframeCode('');
    setShowIframe(false);
    form.resetFields();
  };

  return (
    <Flex className={styles.chatWrapper}>
      {!showConversations && !showRenderPage ? (
        // 应用列表视图
        <Flex className={styles.mainLayout}>
          {/* 左侧工作区列表 */}
          <Flex className={styles.workspaceContainer} vertical>
            <Flex className={styles.discoverySection} align="center">
              <SearchOutlined className={styles.discoveryIcon} />
              <span className={styles.discoveryText}>{t('discovery')}</span>
            </Flex>

            <Divider style={{ margin: '16px 0' }} />

            <Flex className={styles.workspaceHeader}>
              <Text className={styles.workspaceTitle}>{t('workspace')}</Text>
            </Flex>

            {workspaceItems.length > 0 ? (
              <List
                className={styles.workspaceList}
                dataSource={workspaceItems}
                renderItem={(item) => (
                  <List.Item
                    className={styles.workspaceItem}
                    onClick={handleWorkspaceItemClick(item.id)}
                  >
                    <Space>
                      {getAppIconForWorkspace(item.id, item.type)}
                      <span>{getAppNameForWorkspace(item.id, item.type)}</span>
                    </Space>
                  </List.Item>
                )}
              />
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={t('noWorkspaceItems')}
                className={styles.emptyWorkspace}
              />
            )}
          </Flex>

          {/* 右侧应用列表 */}
          <Flex
            className={styles.appListContainer}
            vertical
            style={{ marginLeft: '20px' }}
          >
            <Flex
              className={styles.appListHeader}
              justify="space-between"
              align="center"
            >
              <Title level={4}>{t('applicationList')}</Title>
              <Space>
                <Button
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  onClick={() => setShowRenderPage(true)}
                >
                  {t('render') || '渲染'}
                </Button>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={handleShowChatConfigurationModal()}
                >
                  {t('createAssistant')}
                </Button>
              </Space>
            </Flex>
            <Divider />
            <Spin spinning={dialogLoading}>
              {dialogList.length > 0 ? (
                <Row gutter={[16, 16]}>
                  {dialogList.map((app) => (
                    <Col xs={24} sm={12} md={8} lg={6} key={app.id}>
                      <Card
                        hoverable
                        className={styles.appCard}
                        onMouseEnter={handleAppCardEnter(app.id)}
                        onMouseLeave={handleItemLeave}
                        onClick={handleDialogCardClick(app.id)}
                      >
                        <Card.Meta
                          avatar={
                            <Avatar src={app.icon} shape="square" size={64} />
                          }
                          title={app.name}
                          description={
                            <Flex vertical gap={8}>
                              <Text
                                type="secondary"
                                ellipsis={{ tooltip: app.description }}
                              >
                                {app.description || t('noDescription')}
                              </Text>
                              <Tag color="blue">CHATFLOW</Tag>
                              <Dropdown
                                menu={{ items: buildAppItems(app) }}
                                className={styles.editButton}
                              >
                                <ChatAppCube className={styles.cubeIcon} />
                              </Dropdown>
                            </Flex>
                          }
                        />
                        {activated === app.id && (
                          <Button
                            type="primary"
                            block
                            icon={<PlusOutlined />}
                            className={styles.addToWorkspaceButton}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddToWorkspace(app.id)();
                            }}
                          >
                            {t('addToWorkspace')}
                          </Button>
                        )}
                      </Card>
                    </Col>
                  ))}
                </Row>
              ) : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={t('noAssistants')}
                >
                  <Button
                    type="primary"
                    onClick={handleShowChatConfigurationModal()}
                  >
                    {t('createAssistant')}
                  </Button>
                </Empty>
              )}
            </Spin>
          </Flex>
        </Flex>
      ) : showRenderPage ? (
        // 渲染页面
        <Flex className={styles.renderPageContainer} vertical>
          <Flex className={styles.renderPageHeader} align="center">
            <Button
              type="text"
              icon={<AppstoreOutlined />}
              onClick={() => setShowRenderPage(false)}
            >
              {t('backToHome') || '返回主页'}
            </Button>
            <Title level={4} style={{ margin: '0 auto' }}>
              {t('renderPage') || '渲染页面'}
            </Title>
          </Flex>
          <Divider />
          <Flex className={styles.renderPageContent} vertical>
            {!showIframe ? (
              <Form
                form={form}
                onFinish={handleIframeSubmit}
                layout="vertical"
                className={styles.iframeForm}
              >
                <Form.Item
                  label={t('pasteIframeCode') || '粘贴iframe代码'}
                  name="iframeCode"
                  rules={[
                    {
                      required: true,
                      message: t('pleasePasteIframeCode') || '请粘贴iframe代码',
                    },
                  ]}
                >
                  <Input.TextArea
                    rows={12}
                    placeholder={
                      t('pasteIframeCodePlaceholder') ||
                      '请将iframe代码粘贴到这里...'
                    }
                    style={{ fontFamily: 'monospace' }}
                  />
                </Form.Item>
                <Form.Item>
                  <Space size="large">
                    <Button type="primary" htmlType="submit" size="large">
                      {t('render') || '渲染'}
                    </Button>
                    <Button onClick={handleResetIframe} size="large">
                      {t('reset') || '重置'}
                    </Button>
                  </Space>
                </Form.Item>
              </Form>
            ) : (
              <Flex vertical className={styles.iframeContainer}>
                <Flex
                  justify="space-between"
                  align="center"
                  className={styles.iframeHeader}
                >
                  <Button
                    type="primary"
                    onClick={handleResetIframe}
                    size="large"
                    style={{ backgroundColor: '#1677ff' }}
                  >
                    {t('backToEdit') || '返回编辑'}
                  </Button>
                  <Button
                    type="primary"
                    onClick={() =>
                      window.open(
                        iframeCode.match(/src="([^"]+)"/)?.[1] || '',
                        '_blank',
                      )
                    }
                    size="large"
                  >
                    {t('openInNewTab') || '在新标签页打开'}
                  </Button>
                </Flex>
                <div
                  className={styles.iframeWrapper}
                  dangerouslySetInnerHTML={{ __html: iframeCode }}
                />
              </Flex>
            )}
          </Flex>
        </Flex>
      ) : (
        // 对话视图
        <>
          <Flex
            className={classNames(styles.chatTitleWrapper, {
              [styles.chatTitleWrapperHidden]: !chatListVisible,
            })}
          >
            <Flex flex={1} vertical>
              <Space size={10}>
                <Button
                  type="text"
                  icon={<AppstoreOutlined />}
                  onClick={handleBackToApps}
                >
                  {t('backToApps')}
                </Button>
              </Space>
              <Flex className={styles.assistantInfoContainer}>
                {dialogList.find((x) => x.id === selectedDialog) && (
                  <Space size={10}>
                    <Avatar
                      src={
                        dialogList.find((x) => x.id === selectedDialog)?.icon
                      }
                      shape={'square'}
                      size={40}
                    />
                    <div className={styles.assistantInfo}>
                      <Text
                        strong
                        ellipsis={{
                          tooltip: dialogList.find(
                            (x) => x.id === selectedDialog,
                          )?.name,
                        }}
                      >
                        {dialogList.find((x) => x.id === selectedDialog)?.name}
                      </Text>
                      <Text
                        type="secondary"
                        className={styles.assistantDescription}
                        ellipsis={{
                          tooltip: dialogList.find(
                            (x) => x.id === selectedDialog,
                          )?.description,
                        }}
                      >
                        {dialogList.find((x) => x.id === selectedDialog)
                          ?.description || t('chat')}
                      </Text>
                    </div>
                  </Space>
                )}
              </Flex>

              <Flex className="new-chat-button-container">
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={handleCreateTemporaryConversation}
                  className={styles.newChatButton}
                >
                  {t('openNewChat')}
                </Button>
              </Flex>

              <Flex vertical gap={10} className={styles.chatTitleContent}>
                <Spin
                  spinning={conversationLoading}
                  wrapperClassName={styles.chatSpin}
                >
                  {conversationList.map((x) => (
                    <Card
                      key={x.id}
                      hoverable
                      onClick={handleConversationCardClick(x.id, x.is_new)}
                      onMouseEnter={handleConversationCardEnter(x.id)}
                      onMouseLeave={handleConversationItemLeave}
                      className={classNames(styles.chatTitleCard, {
                        [theme === 'dark'
                          ? styles.chatTitleCardSelectedDark
                          : styles.chatTitleCardSelected]:
                          x.id === conversationId,
                      })}
                    >
                      <Flex justify="space-between" align="center">
                        <div>
                          <Text
                            ellipsis={{ tooltip: x.name }}
                            style={{ width: 220 }}
                          >
                            {x.name}
                          </Text>
                        </div>
                        {conversationActivated === x.id &&
                          x.id !== '' &&
                          !x.is_new && (
                            <section>
                              <Dropdown
                                menu={{ items: buildConversationItems(x.id) }}
                              >
                                <ChatAppCube
                                  className={styles.cubeIcon}
                                ></ChatAppCube>
                              </Dropdown>
                            </section>
                          )}
                      </Flex>
                    </Card>
                  ))}
                </Spin>
              </Flex>
            </Flex>
          </Flex>
          <Button
            type="text"
            icon={
              chatListVisible ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />
            }
            onClick={toggleChatList}
            className={styles.toggleChatListButton}
          />
          <ChatContainer controller={controller}></ChatContainer>
        </>
      )}

      {dialogEditVisible && (
        <ChatConfigurationModal
          visible={dialogEditVisible}
          initialDialog={initialDialog}
          showModal={showDialogEditModal}
          hideModal={hideDialogEditModal}
          loading={dialogSettingLoading}
          onOk={onDialogEditOk}
          clearDialog={clearDialog}
        ></ChatConfigurationModal>
      )}
      <RenameModal
        visible={conversationRenameVisible}
        hideModal={hideConversationRenameModal}
        onOk={onConversationRenameOk}
        initialName={initialConversationName}
        loading={conversationRenameLoading}
      ></RenameModal>

      {embedVisible && (
        <EmbedModal
          visible={embedVisible}
          hideModal={hideEmbedModal}
          token={currentRecord.id}
          form={SharedFrom.Chat}
          beta={beta}
          isAgent={false}
        ></EmbedModal>
      )}
    </Flex>
  );
};

export default Chat;
