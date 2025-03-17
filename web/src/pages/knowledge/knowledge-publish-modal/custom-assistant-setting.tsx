import { TavilyItem } from '@/components/tavily-item';
import { useTranslate } from '@/hooks/common-hooks';
import { useFetchKnowledgeList } from '@/hooks/knowledge-hooks';
import { useFetchTenantInfo } from '@/hooks/user-setting-hooks';
import { ISegmentedContentProps } from '@/pages/chat/interface';
import { Form, Input, Select, Switch, Tag, message } from 'antd';
import classNames from 'classnames';
import { useCallback, useEffect, useMemo, useState } from 'react';

import styles from '@/pages/chat/chat-configuration-modal/index.less';

const emptyResponseField = ['prompt_config', 'empty_response'];

// 扩展接口以包含knowledgeName属性
interface IPureAssistantSettingProps extends ISegmentedContentProps {
  knowledgeName?: string;
  knowledgeId?: string;
}

// 创建一个固定值的知识库组件
const FixedKnowledgeBaseItem = ({
  knowledgeName,
  form,
}: {
  knowledgeName?: string;
  form: any;
}) => {
  const { t } = useTranslate('chat');

  // 使用useEffect设置固定的知识库值
  useEffect(() => {
    if (knowledgeName) {
      // 设置隐藏字段kb_names的值为固定值
      form.setFieldValue('kb_names', [knowledgeName]);
    }
  }, [knowledgeName, form]);

  return (
    <Form.Item label={t('knowledgeBase')} tooltip={t('knowledgeBaseTip')}>
      <div>
        <Tag color="blue">{knowledgeName}</Tag>
        <span style={{ marginLeft: 8, color: 'rgba(0, 0, 0, 0.45)' }}>
          {t('knowledgeBaseFixedTip')}
        </span>
      </div>
    </Form.Item>
  );
};

// 不包含知识库的纯助理设置组件，但接受knowledgeName属性并保留TavilyItem
const PureAssistantSetting = ({
  show,
  form,
  setHasError,
  knowledgeName,
  knowledgeId,
}: IPureAssistantSettingProps) => {
  const { t } = useTranslate('chat');
  const { data } = useFetchTenantInfo(true);
  const { list: knowledgeList } = useFetchKnowledgeList(true);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);

  // 获取当前知识库信息
  const currentKnowledge = useMemo(() => {
    if (!knowledgeId) return null;
    return knowledgeList.find((item) => item.id === knowledgeId);
  }, [knowledgeList, knowledgeId]);

  const handleChange = useCallback(() => {
    // 移除了对知识库的检查，因为我们不需要知识库字段
    const emptyResponse = form.getFieldValue(emptyResponseField);
    const required = false; // 不再需要根据知识库状态设置required

    setHasError(required);
    form.setFields([
      {
        name: emptyResponseField,
        errors: required ? [t('emptyResponseMessage')] : [],
      },
    ]);
  }, [form, setHasError, t]);

  const handleTtsChange = useCallback(
    (checked: boolean) => {
      if (checked && !data.tts_id) {
        message.error(
          `请先设置TTS模型。路径: 设置 >> 模型提供商 >> 系统模型设置`,
        );
        form.setFieldValue(['prompt_config', 'tts'], false);
      }
    },
    [data, form],
  );

  // 处理联网搜索开关状态变化
  const handleWebSearchChange = useCallback(
    (checked: boolean) => {
      setWebSearchEnabled(checked);
      if (checked) {
        // 如果开启联网搜索，设置空的token值
        form.setFieldValue(['prompt_config', 'tavily_api_key'], '');
      } else {
        // 如果关闭联网搜索，清空相关字段
        form.setFieldValue(['prompt_config', 'tavily_api_key'], undefined);
      }
    },
    [form],
  );

  // 设置知识库头像为隐藏字段
  useEffect(() => {
    if (currentKnowledge?.avatar) {
      // 为表单添加隐藏的icon字段，使用知识库头像
      const fileList = [
        {
          uid: '1',
          name: 'file',
          thumbUrl: currentKnowledge.avatar,
          status: 'done',
        },
      ];
      form.setFieldValue('icon', fileList);
    }
  }, [currentKnowledge, form]);

  return (
    <section
      className={classNames({
        [styles.segmentedHidden]: !show,
      })}
    >
      <Form.Item
        name={'name'}
        label={t('assistantName')}
        rules={[{ required: true, message: t('assistantNameMessage') }]}
      >
        <Input placeholder={t('namePlaceholder')} />
      </Form.Item>
      <Form.Item name={'description'} label={t('description')}>
        <Input placeholder={t('descriptionPlaceholder')} />
      </Form.Item>
      {/* 移除了助理头像字段，但在表单中保留了hidden的icon字段 */}
      <Form.Item name="icon" hidden={true} valuePropName="fileList">
        <Input type="hidden" />
      </Form.Item>
      <Form.Item
        name={'language'}
        label={t('language')}
        initialValue={'English'}
        tooltip="coming soon"
        style={{ display: 'none' }}
      >
        <Select
          options={[
            { value: 'Chinese', label: t('chinese', { keyPrefix: 'common' }) },
            { value: 'English', label: t('english', { keyPrefix: 'common' }) },
          ]}
        />
      </Form.Item>
      {/* <Form.Item
        name={emptyResponseField}
        label={t('emptyResponse')}
        tooltip={t('emptyResponseTip')}
      >
        <Input placeholder="" onChange={handleChange} />
      </Form.Item> */}
      <Form.Item
        name={['prompt_config', 'prologue']}
        label={t('setAnOpener')}
        tooltip={t('setAnOpenerTip')}
        initialValue={t('setAnOpenerInitial')}
      >
        <Input.TextArea autoSize={{ minRows: 1 }} />
      </Form.Item>
      <Form.Item
        label={t('quote')}
        valuePropName="checked"
        name={['prompt_config', 'quote']}
        tooltip={t('quoteTip')}
        initialValue={true}
      >
        <Switch />
      </Form.Item>
      <Form.Item
        label={t('keyword')}
        valuePropName="checked"
        name={['prompt_config', 'keyword']}
        tooltip={t('keywordTip')}
        initialValue={false}
      >
        <Switch />
      </Form.Item>
      <Form.Item
        label={t('tts')}
        valuePropName="checked"
        name={['prompt_config', 'tts']}
        tooltip={t('ttsTip')}
        initialValue={false}
      >
        <Switch onChange={handleTtsChange} />
      </Form.Item>

      {/* 添加联网搜索开关 */}
      <Form.Item
        label="联网搜索"
        tooltip="启用后助理可以访问互联网搜索最新信息"
        valuePropName="checked"
        name={['prompt_config', 'web_search_enabled']}
        initialValue={false}
      >
        <Switch onChange={handleWebSearchChange} />
      </Form.Item>

      {/* 仅当开启联网搜索时才显示TavilyItem组件 */}
      {webSearchEnabled && (
        <TavilyItem
          name={['prompt_config', 'tavily_api_key']}
          required={true}
        />
      )}

      {/* 添加固定值的知识库显示组件 */}
      <FixedKnowledgeBaseItem knowledgeName={knowledgeName} form={form} />
    </section>
  );
};

export default PureAssistantSetting;
