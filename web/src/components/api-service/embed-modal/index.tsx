import CopyToClipboard from '@/components/copy-to-clipboard';
import HightLightMarkdown from '@/components/highlight-markdown';
import { SharedFrom } from '@/constants/chat';
import { useTranslate } from '@/hooks/common-hooks';
import { IModalProps } from '@/interfaces/common';
import {
  Button,
  Card,
  Modal,
  Tabs,
  TabsProps,
  Typography,
  message,
} from 'antd';
import { useMemo, useState } from 'react';

import { useIsDarkTheme } from '@/components/theme-provider';
import {
  LanguageAbbreviation,
  LanguageAbbreviationMap,
} from '@/constants/common';
import { cn } from '@/lib/utils';
import styles from './index.less';

const { Paragraph, Link } = Typography;

const EmbedModal = ({
  visible,
  hideModal,
  token = '',
  form,
  beta = '',
  isAgent,
  onPublish,
  dialogName = '',
}: IModalProps<any> & {
  token: string;
  form: SharedFrom;
  beta: string;
  isAgent: boolean;
  onPublish?: (iframeSrc: string) => void;
  dialogName?: string;
}) => {
  const { t } = useTranslate('chat');
  const isDarkTheme = useIsDarkTheme();

  const [visibleAvatar, setVisibleAvatar] = useState(false);
  const [locale, setLocale] = useState('');

  const languageOptions = useMemo(() => {
    return Object.values(LanguageAbbreviation).map((x) => ({
      label: LanguageAbbreviationMap[x],
      value: x,
    }));
  }, []);

  const generateIframeSrc = () => {
    let src = `${location.origin}/chat/share?shared_id=${token}&from=${form}&auth=${beta}`;
    if (visibleAvatar) {
      src += '&visible_avatar=1';
    }
    if (locale) {
      src += `&locale=${locale}`;
    }
    return src;
  };

  const iframeSrc = generateIframeSrc();

  const text = `
  ~~~ html
  <iframe
  src="${iframeSrc}"
  style="width: 100%; height: 100%; min-height: 600px"
  frameborder="0"
>
</iframe>
~~~
  `;

  const items: TabsProps['items'] = [
    {
      key: '1',
      label: t('fullScreenTitle'),
      children: (
        <Card
          title={t('fullScreenDescription')}
          extra={<CopyToClipboard text={text}></CopyToClipboard>}
          className={styles.codeCard}
        >
          {/* <div className="p-2">
            <h2 className="mb-3">Option:</h2>

            <Form.Item
              label={t('avatarHidden')}
              labelCol={{ span: 6 }}
              wrapperCol={{ span: 18 }}
            >
              <Checkbox
                checked={visibleAvatar}
                onChange={(e) => setVisibleAvatar(e.target.checked)}
              ></Checkbox>
            </Form.Item>
            <Form.Item
              label={t('locale')}
              labelCol={{ span: 6 }}
              wrapperCol={{ span: 18 }}
            >
              <Select
                placeholder="Select a locale"
                onChange={(value) => setLocale(value)}
                options={languageOptions}
                style={{ width: '100%' }}
              />
            </Form.Item>
          </div> */}
          <HightLightMarkdown>{text}</HightLightMarkdown>
        </Card>
      ),
    },
    // {
    //   key: '2',
    //   label: t('partialTitle'),
    //   children: t('comingSoon'),
    // },
    // {
    //   key: '3',
    //   label: t('extensionTitle'),
    //   children: t('comingSoon'),
    // },
  ];

  const onChange = (key: string) => {
    console.log(key);
  };

  const handlePublish = async () => {
    try {
      message.success('发布成功！');
      // 在新窗口中打开 iframe
      window.open(iframeSrc, '_blank', 'width=800,height=600');
      if (onPublish) {
        onPublish(iframeSrc);
      }
      hideModal?.();
    } catch (error) {
      message.error('发布失败，请重试');
      console.error('发布失败:', error);
    }
  };

  return (
    <Modal
      title={t('embedIntoSite', { keyPrefix: 'common' })}
      open={visible}
      style={{ top: 300 }}
      width={'50vw'}
      onOk={hideModal}
      onCancel={hideModal}
      footer={[
        <Button key="publish" type="primary" onClick={handlePublish}>
          发布
        </Button>,
        <Button key="cancel" onClick={hideModal}>
          取消
        </Button>,
      ]}
    >
      <Tabs defaultActiveKey="1" items={items} onChange={onChange} />
      <div className="text-base font-medium mt-4 mb-1">
        {t(isAgent ? 'flow' : 'chat', { keyPrefix: 'header' })}
        <span className="ml-1 inline-block">ID</span>
      </div>
      <Paragraph
        copyable={{ text: token }}
        className={cn(styles.id, {
          [styles.darkId]: isDarkTheme,
        })}
      >
        {token}
      </Paragraph>
      {/* TODO: 如何使用智能体ID文档链接 */}
      {/* <Link
        href={
          isAgent
            ? 'https://ragflow.io/docs/dev/http_api_reference#create-session-with-agent'
            : 'https://ragflow.io/docs/dev/http_api_reference#create-session-with-chat-assistant'
        }
        target="_blank"
      >
        {t('howUseId', { keyPrefix: isAgent ? 'flow' : 'chat' })}
      </Link> */}
    </Modal>
  );
};

export default EmbedModal;
