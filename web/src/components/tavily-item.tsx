import { useTranslate } from '@/hooks/common-hooks';
import { Form, Input, Typography } from 'antd';

interface IProps {
  name?: string | string[];
  required?: boolean;
}

export function TavilyItem({
  name = ['prompt_config', 'tavily_api_key'],
  required = false,
}: IProps) {
  const { t } = useTranslate('chat');

  return (
    <Form.Item
      label={'Token'}
      tooltip={t('tavilyApiKeyTip')}
      required={required}
    >
      <div className="flex flex-col gap-1">
        <Form.Item
          name={name}
          noStyle
          rules={
            required
              ? [{ required: true, message: '联网搜索功能需要填写有效的Token' }]
              : []
          }
        >
          <Input.Password placeholder={t('tavilyApiKeyMessage')} />
        </Form.Item>
        <Typography.Link href="https://app.tavily.com/home" target={'_blank'}>
          {t('tavilyApiKeyHelp')}
        </Typography.Link>
      </div>
    </Form.Item>
  );
}
