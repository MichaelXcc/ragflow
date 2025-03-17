import { ReactComponent as ChatConfigurationAtom } from '@/assets/svg/chat-configuration-atom.svg';
import {
  ModelVariableType,
  settledModelVariableMap,
} from '@/constants/knowledge';
import { useFetchModelId } from '@/hooks/logic-hooks';
import { IDialog } from '@/interfaces/database/chat';
import ModelSetting from '@/pages/chat/chat-configuration-modal/model-setting';
import PromptEngine from '@/pages/chat/chat-configuration-modal/prompt-engine';
import { IPromptConfigParameters } from '@/pages/chat/interface';
import { getBase64FromUploadFileList } from '@/utils/file-util';
import { removeUselessFieldsFromValues } from '@/utils/form';
import { Divider, Flex, Form, Modal, Segmented, UploadFile } from 'antd';
import { SegmentedValue } from 'antd/es/segmented';
import camelCase from 'lodash/camelCase';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import PureAssistantSetting from './custom-assistant-setting';

import styles from '@/pages/chat/chat-configuration-modal/index.less';

const layout = {
  labelCol: { span: 9 },
  wrapperCol: { span: 15 },
};

const validateMessages = {
  required: '${label} is required!',
  types: {
    email: '${label} is not a valid email!',
    number: '${label} is not a valid number!',
  },
  number: {
    range: '${label} must be between ${min} and ${max}',
  },
};

enum ConfigurationSegmented {
  AssistantSetting = 'Assistant Setting',
  PromptEngine = 'Prompt Engine',
  ModelSetting = 'Model Setting',
}

// 直接使用我们自定义的纯助理设置组件（不包含知识库字段）
const segmentedMap = {
  [ConfigurationSegmented.AssistantSetting]: PureAssistantSetting,
  [ConfigurationSegmented.ModelSetting]: ModelSetting,
  [ConfigurationSegmented.PromptEngine]: PromptEngine,
};

interface IProps {
  visible: boolean;
  hideModal: () => void;
  initialDialog: IDialog;
  loading: boolean;
  onOk: (dialog: IDialog) => void;
  clearDialog: () => void;
  knowledgeId: string;
  knowledgeName: string;
}

const KnowledgePublishModal = ({
  visible,
  hideModal,
  initialDialog,
  loading,
  onOk,
  clearDialog,
  knowledgeId,
  knowledgeName,
}: IProps) => {
  const [form] = Form.useForm();
  const [hasError, setHasError] = useState(false);

  const [value, setValue] = useState<ConfigurationSegmented>(
    ConfigurationSegmented.AssistantSetting,
  );
  const promptEngineRef = useRef<Array<IPromptConfigParameters>>([]);
  const modelId = useFetchModelId();
  const { t } = useTranslation();

  const handleOk = async () => {
    const values = await form.validateFields();
    if (hasError) {
      return;
    }

    // 检查联网搜索开关是否打开但没有填写token
    const webSearchEnabled = values.prompt_config?.web_search_enabled;
    const tavilyApiKey = values.prompt_config?.tavily_api_key;

    if (webSearchEnabled && (!tavilyApiKey || tavilyApiKey.trim() === '')) {
      // 设置错误信息
      form.setFields([
        {
          name: ['prompt_config', 'tavily_api_key'],
          errors: ['联网搜索功能需要填写有效的Token'],
        },
      ]);
      return;
    }

    const nextValues: any = removeUselessFieldsFromValues(
      values,
      'llm_setting.',
    );
    const emptyResponse = nextValues.prompt_config?.empty_response ?? '';

    const icon = await getBase64FromUploadFileList(values.icon);

    // 确保添加当前知识库ID和名称
    const finalValues = {
      dialog_id: initialDialog.id,
      ...nextValues,
      kb_ids: [knowledgeId], // 提交时使用ID
      kb_names: [knowledgeName], // 提交时使用名称
      vector_similarity_weight: 1 - nextValues.vector_similarity_weight,
      prompt_config: {
        ...nextValues.prompt_config,
        parameters: promptEngineRef.current,
        empty_response: emptyResponse,
      },
      icon,
    };
    onOk(finalValues);
  };

  const handleSegmentedChange = (val: SegmentedValue) => {
    setValue(val as ConfigurationSegmented);
  };

  const handleModalAfterClose = () => {
    clearDialog();
    form.resetFields();
  };

  const title = (
    <Flex gap={16}>
      <ChatConfigurationAtom></ChatConfigurationAtom>
      <div>
        <b>{t('chat.publishKnowledgeAsAssistant')}</b>
        <div className={styles.chatConfigurationDescription}>
          {t('chat.publishKnowledgeAsAssistantDescription')}
        </div>
      </div>
    </Flex>
  );

  useEffect(() => {
    if (visible) {
      const icon = initialDialog.icon;
      let fileList: UploadFile[] = [];

      if (icon) {
        fileList = [{ uid: '1', name: 'file', thumbUrl: icon, status: 'done' }];
      }

      // 预填充表单，使用默认值
      const formValues = {
        ...initialDialog,
        llm_setting:
          initialDialog.llm_setting ??
          settledModelVariableMap[ModelVariableType.Precise],
        icon: fileList,
        llm_id: initialDialog.llm_id ?? modelId,
        vector_similarity_weight:
          1 - (initialDialog.vector_similarity_weight ?? 0.3),
        // 直接设置知识库名称和ID，但不在表单中显示
        name: initialDialog.name || knowledgeName,
        description: initialDialog.description || '',
        // 知识库字段不再设置到表单中，而是在提交时添加
      };

      form.setFieldsValue(formValues);

      // 不管表单中原来有什么值，确保web_search_enabled为false
      form.setFieldValue(['prompt_config', 'web_search_enabled'], false);
    }
  }, [initialDialog, form, visible, modelId, knowledgeName, knowledgeId]);

  return (
    <Modal
      title={title}
      width={688}
      open={visible}
      onOk={handleOk}
      onCancel={hideModal}
      confirmLoading={loading}
      destroyOnClose
      afterClose={handleModalAfterClose}
    >
      <Segmented
        size={'large'}
        value={value}
        onChange={handleSegmentedChange}
        options={Object.values(ConfigurationSegmented).map((x) => ({
          label: t(camelCase(x), { keyPrefix: 'chat' }),
          value: x,
        }))}
        block
      />
      <Divider></Divider>
      <Form
        {...layout}
        name="nest-messages"
        form={form}
        style={{ maxWidth: 600 }}
        validateMessages={validateMessages}
        colon={false}
      >
        {Object.entries(segmentedMap).map(([key, Element]) => (
          <Element
            key={key}
            show={key === value}
            form={form}
            setHasError={setHasError}
            knowledgeName={knowledgeName}
            knowledgeId={knowledgeId}
            {...(key === ConfigurationSegmented.ModelSetting
              ? { initialLlmSetting: initialDialog.llm_setting, visible }
              : {})}
            {...(key === ConfigurationSegmented.PromptEngine
              ? { ref: promptEngineRef }
              : {})}
          />
        ))}
      </Form>
    </Modal>
  );
};

export default KnowledgePublishModal;
