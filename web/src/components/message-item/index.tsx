import { MessageType } from '@/constants/chat';
import { useSetModalState } from '@/hooks/common-hooks';
import { IReference, IReferenceChunk } from '@/interfaces/database/chat';
import classNames from 'classnames';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import {
  useFetchDocumentInfosByIds,
  useFetchDocumentThumbnailsByIds,
} from '@/hooks/document-hooks';
import { IRegenerateMessage, IRemoveMessageById } from '@/hooks/logic-hooks';
import { IMessage } from '@/pages/chat/interface';
import MarkdownContent from '@/pages/chat/markdown-content';
import { getExtension, isImage } from '@/utils/document-util';
import { Avatar, Button, Flex, List, Space, Typography } from 'antd';
import FileIcon from '../file-icon';
import IndentedTreeModal from '../indented-tree/modal';
import NewDocumentLink from '../new-document-link';
import { useTheme } from '../theme-provider';
import { AssistantGroupButton, UserGroupButton } from './group-button';
import styles from './index.less';

const { Text } = Typography;

/**
 * 消息项组件的属性接口
 * @interface IProps
 * @extends {Partial<IRemoveMessageById>} 可选的消息删除功能
 * @extends {IRegenerateMessage} 消息重新生成功能
 * @property {IMessage} item - 消息数据对象
 * @property {IReference} reference - 引用数据对象
 * @property {boolean} [loading] - 加载状态
 * @property {boolean} [sendLoading] - 发送加载状态
 * @property {boolean} [visibleAvatar] - 是否显示头像
 * @property {string} [nickname] - 用户昵称
 * @property {string} [avatar] - 用户头像URL
 * @property {string | null} [avatarDialog] - 对话头像URL
 * @property {Function} [clickDocumentButton] - 点击文档按钮的回调函数
 * @property {number} index - 消息的索引
 * @property {boolean} [showLikeButton] - 是否显示点赞按钮
 * @property {boolean} [showLoudspeaker] - 是否显示扬声器按钮
 */
interface IProps extends Partial<IRemoveMessageById>, IRegenerateMessage {
  item: IMessage;
  reference: IReference;
  loading?: boolean;
  sendLoading?: boolean;
  visibleAvatar?: boolean;
  nickname?: string;
  avatar?: string;
  avatarDialog?: string | null;
  clickDocumentButton?: (documentId: string, chunk: IReferenceChunk) => void;
  index: number;
  showLikeButton?: boolean;
  showLoudspeaker?: boolean;
}

/**
 * 消息项组件 - 展示聊天中的单条消息
 * 包括用户消息和助手消息的不同显示样式、引用文档、相关操作按钮等
 */
const MessageItem = ({
  item,
  reference,
  loading = false,
  avatar,
  avatarDialog,
  sendLoading = false,
  clickDocumentButton,
  index,
  removeMessageById,
  regenerateMessage,
  showLikeButton = true,
  showLoudspeaker = true,
  visibleAvatar = true,
}: IProps) => {
  const { theme } = useTheme(); // 获取当前主题
  const isAssistant = item.role === MessageType.Assistant; // 判断是否为助手消息
  const isUser = item.role === MessageType.User; // 判断是否为用户消息
  // 获取文档信息的hook
  const { data: documentList, setDocumentIds } = useFetchDocumentInfosByIds();
  // 获取文档缩略图的hook
  const { data: documentThumbnails, setDocumentIds: setIds } =
    useFetchDocumentThumbnailsByIds();
  // 模态框显示状态控制
  const { visible, hideModal, showModal } = useSetModalState();
  // 当前点击的文档ID
  const [clickedDocumentId, setClickedDocumentId] = useState('');

  // 从引用中提取文档列表
  const referenceDocumentList = useMemo(() => {
    return reference?.doc_aggs ?? [];
  }, [reference?.doc_aggs]);

  /**
   * 处理用户点击文档的回调
   * 设置当前点击的文档ID并显示模态框
   */
  const handleUserDocumentClick = useCallback(
    (id: string) => () => {
      setClickedDocumentId(id);
      showModal();
    },
    [showModal],
  );

  /**
   * 处理重新生成消息的回调
   * 调用传入的regenerateMessage函数并传入当前消息
   */
  const handleRegenerateMessage = useCallback(() => {
    regenerateMessage?.(item);
  }, [regenerateMessage, item]);

  /**
   * 副作用：当消息中包含文档ID时，获取相关文档信息和缩略图
   */
  useEffect(() => {
    const ids = item?.doc_ids ?? [];
    if (ids.length) {
      setDocumentIds(ids);
      const documentIds = ids.filter((x) => !(x in documentThumbnails));
      if (documentIds.length) {
        setIds(documentIds);
      }
    }
  }, [item.doc_ids, setDocumentIds, setIds, documentThumbnails]);

  return (
    <div
      className={classNames(styles.messageItem, {
        [styles.messageItemLeft]: item.role === MessageType.Assistant, // 助手消息靠左显示
        [styles.messageItemRight]: item.role === MessageType.User, // 用户消息靠右显示
      })}
    >
      <section
        className={classNames(styles.messageItemSection, {
          [styles.messageItemSectionLeft]: item.role === MessageType.Assistant,
          [styles.messageItemSectionRight]: item.role === MessageType.User,
        })}
      >
        <div
          className={classNames(styles.messageItemContent, {
            [styles.messageItemContentReverse]: item.role === MessageType.User, // 用户消息内容反转排列
          })}
        >
          {/* 根据消息类型显示不同的头像 */}
          {visibleAvatar &&
            (item.role === MessageType.User ? (
              <Avatar size={40} src={avatar ?? '/tubiao1.png'} />
            ) : avatarDialog ? (
              <Avatar size={40} src={avatarDialog} />
            ) : (
              <Avatar size={40} src={'/tubiao1.png'} />
            ))}

          <Flex vertical gap={8} flex={1}>
            <Space>
              {/* 根据消息类型显示不同的操作按钮组 */}
              {isAssistant ? (
                index !== 0 && (
                  <AssistantGroupButton
                    messageId={item.id}
                    content={item.content}
                    prompt={item.prompt}
                    showLikeButton={showLikeButton}
                    audioBinary={item.audio_binary}
                    showLoudspeaker={showLoudspeaker}
                  ></AssistantGroupButton>
                )
              ) : (
                <UserGroupButton
                  content={item.content}
                  messageId={item.id}
                  removeMessageById={removeMessageById}
                  regenerateMessage={
                    regenerateMessage && handleRegenerateMessage
                  }
                  sendLoading={sendLoading}
                ></UserGroupButton>
              )}

              {/* <b>{isAssistant ? '' : nickname}</b> */}
            </Space>
            {/* 消息内容区域，根据主题和消息类型应用不同样式 */}
            <div
              className={
                isAssistant
                  ? theme === 'dark'
                    ? styles.messageTextDark
                    : styles.messageText
                  : styles.messageUserText
              }
            >
              <MarkdownContent
                loading={loading}
                content={item.content}
                reference={reference}
                clickDocumentButton={clickDocumentButton}
              ></MarkdownContent>
            </div>
            {/* 助手消息的引用文档列表 */}
            {isAssistant && referenceDocumentList.length > 0 && (
              <List
                bordered
                dataSource={referenceDocumentList}
                renderItem={(item) => {
                  return (
                    <List.Item>
                      <Flex gap={'small'} align="center">
                        <FileIcon
                          id={item.doc_id}
                          name={item.doc_name}
                        ></FileIcon>

                        <NewDocumentLink
                          documentId={item.doc_id}
                          documentName={item.doc_name}
                          prefix="document"
                          link={item.url}
                        >
                          {item.doc_name}
                        </NewDocumentLink>
                      </Flex>
                    </List.Item>
                  );
                }}
              />
            )}
            {/* 用户消息的相关文档列表 */}
            {isUser && documentList.length > 0 && (
              <List
                bordered
                dataSource={documentList}
                renderItem={(item) => {
                  // TODO:
                  // const fileThumbnail =
                  //   documentThumbnails[item.id] || documentThumbnails[item.id];
                  const fileExtension = getExtension(item.name);
                  return (
                    <List.Item>
                      <Flex gap={'small'} align="center">
                        <FileIcon id={item.id} name={item.name}></FileIcon>

                        {/* 根据文件类型显示不同的交互方式 */}
                        {isImage(fileExtension) ? (
                          <NewDocumentLink
                            documentId={item.id}
                            documentName={item.name}
                            prefix="document"
                          >
                            {item.name}
                          </NewDocumentLink>
                        ) : (
                          <Button
                            type={'text'}
                            onClick={handleUserDocumentClick(item.id)}
                          >
                            <Text
                              style={{ maxWidth: '40vw' }}
                              ellipsis={{ tooltip: item.name }}
                            >
                              {item.name}
                            </Text>
                          </Button>
                        )}
                      </Flex>
                    </List.Item>
                  );
                }}
              />
            )}
          </Flex>
        </div>
      </section>
      {/* 文档树形结构模态框 */}
      {visible && (
        <IndentedTreeModal
          visible={visible}
          hideModal={hideModal}
          documentId={clickedDocumentId}
        ></IndentedTreeModal>
      )}
    </div>
  );
};

// 使用memo优化组件渲染性能
export default memo(MessageItem);
