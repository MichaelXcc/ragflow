import { useTranslate } from '@/hooks/common-hooks';
import { Form, Switch } from 'antd';

const ExcelToHtml = () => {
  const { t } = useTranslate('knowledgeDetails');
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <span style={{ marginRight: '8px' }}>{t('html4excel')}</span>
      <Form.Item
        name={['parser_config', 'html4excel']}
        initialValue={false}
        valuePropName="checked"
        tooltip={t('html4excelTip')}
        style={{ margin: 0 }}
      >
        <Switch />
      </Form.Item>
    </div>
  );
};

export default ExcelToHtml;
