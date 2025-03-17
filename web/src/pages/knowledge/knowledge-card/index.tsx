import { KnowledgeRouteKey } from '@/constants/knowledge';
import { IKnowledge } from '@/interfaces/database/knowledge';
import { formatDate } from '@/utils/date';
import {
  CalendarOutlined,
  CloudUploadOutlined,
  FileTextOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Avatar, Badge, Card, Space } from 'antd';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'umi';

import OperateDropdown from '@/components/operate-dropdown';
import { useTheme } from '@/components/theme-provider';
import { useDeleteKnowledge } from '@/hooks/knowledge-hooks';
import { useFetchUserInfo } from '@/hooks/user-setting-hooks';
import { useEditDialog } from '@/pages/chat/hooks';
import KnowledgePublishModal from '../knowledge-publish-modal';
import styles from './index.less';

interface IProps {
  item: IKnowledge;
}

const KnowledgeCard = ({ item }: IProps) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { data: userInfo } = useFetchUserInfo();
  const { theme } = useTheme();
  const { deleteKnowledge } = useDeleteKnowledge();
  const {
    dialogEditVisible,
    initialDialog,
    onDialogEditOk,
    showDialogEditModal,
    hideDialogEditModal,
    dialogSettingLoading,
    clearDialog,
  } = useEditDialog();

  const removeKnowledge = async () => {
    return deleteKnowledge(item.id);
  };

  const publishKnowledge = async () => {
    // 打开新建助理对话框，创建时关联当前知识库
    showDialogEditModal();
  };

  const handleCardClick = () => {
    navigate(`/knowledge/${KnowledgeRouteKey.Dataset}?id=${item.id}`, {
      state: { from: 'list' },
    });
  };

  const handleMenuItemClick = (key: string) => {
    if (key === 'publish') {
      publishKnowledge();
    }
  };

  const operateItems = [
    {
      key: 'publish',
      label: (
        <Space>
          {t('knowledgeList.publish')}
          <CloudUploadOutlined />
        </Space>
      ),
    },
  ];

  return (
    <>
      <Badge.Ribbon
        text={item?.nickname}
        color={userInfo?.nickname === item?.nickname ? '#1677ff' : 'pink'}
        className={classNames(styles.ribbon, {
          [styles.hideRibbon]: item.permission !== 'team',
        })}
      >
        <Card className={styles.card} onClick={handleCardClick}>
          <div className={styles.container}>
            <div className={styles.content}>
              <Avatar size={34} icon={<UserOutlined />} src={item.avatar} />
              <OperateDropdown
                deleteItem={removeKnowledge}
                items={operateItems}
                onMenuItemClick={handleMenuItemClick}
              ></OperateDropdown>
            </div>
            <div className={styles.titleWrapper}>
              <span
                className={theme === 'dark' ? styles.titledark : styles.title}
              >
                {item.name}
              </span>
              <p
                className={
                  theme === 'dark' ? styles.descriptiondark : styles.description
                }
              >
                {item.description}
              </p>
            </div>
            <div className={styles.footer}>
              <div className={styles.footerTop}>
                <div className={styles.bottomLeft}>
                  <FileTextOutlined className={styles.leftIcon} />
                  <span className={styles.rightText}>
                    <Space>
                      {item.doc_num}
                      {t('knowledgeList.doc')}
                    </Space>
                  </span>
                </div>
              </div>
              <div className={styles.bottom}>
                <div className={styles.bottomLeft}>
                  <CalendarOutlined className={styles.leftIcon} />
                  <span className={styles.rightText}>
                    {formatDate(item.update_time)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </Badge.Ribbon>

      {dialogEditVisible && (
        <KnowledgePublishModal
          visible={dialogEditVisible}
          initialDialog={{
            ...initialDialog,
            kb_ids: [item.id],
            kb_names: [item.name],
            name: initialDialog.name || item.name,
            description: initialDialog.description || item.description,
          }}
          hideModal={hideDialogEditModal}
          loading={dialogSettingLoading}
          onOk={onDialogEditOk}
          clearDialog={clearDialog}
          knowledgeId={item.id}
          knowledgeName={item.name}
        />
      )}
    </>
  );
};

export default KnowledgeCard;
