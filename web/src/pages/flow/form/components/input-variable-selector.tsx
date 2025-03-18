/**
 * 输入变量选择器组件
 * 允许用户定义变量名并选择上一个节点的输出作为当前节点的输入
 */
import { RAGFlowNodeType } from '@/interfaces/database/flow';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Form, Input, Select, Typography } from 'antd';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBuildComponentIdSelectOptions } from '../../hooks/use-get-begin-query';

import styles from './index.less';

const { Title } = Typography;

interface IProps {
  node?: RAGFlowNodeType;
}

// 变量表单部分
const VariableSelectForm = ({ node }: IProps) => {
  const { t } = useTranslation();
  // 获取上一个节点的输出选项
  const sourceOptions = useBuildComponentIdSelectOptions(
    node?.id,
    node?.parentId,
  );
  const form = Form.useFormInstance();

  // 添加两个默认参数
  const [initialized, setInitialized] = useState(false);

  // 初始化默认参数
  useCallback(() => {
    if (!initialized && form) {
      const existingVariables = form.getFieldValue('variables') || [];
      if (existingVariables.length === 0) {
        form.setFieldsValue({
          variables: [
            { variableName: 'arg1', sourceNodeId: undefined },
            { variableName: 'arg2', sourceNodeId: undefined },
          ],
        });
        setInitialized(true);
      } else {
        setInitialized(true);
      }
    }
  }, [form, initialized]);

  return (
    <Form.List name="variables">
      {(fields, { add, remove }) => {
        // 初始化默认参数
        if (!initialized && fields.length === 0) {
          add({ variableName: 'arg1', sourceNodeId: undefined });
          add({ variableName: 'arg2', sourceNodeId: undefined });
          setInitialized(true);
        }

        return (
          <>
            {fields.map(({ key, name, ...restField }) => (
              <div key={key} className={styles.variableRow}>
                {/* 变量名称输入 */}
                <Form.Item
                  {...restField}
                  name={[name, 'variableName']}
                  className={styles.variableName}
                  rules={[
                    { required: true, message: t('flow.variableNameRequired') },
                  ]}
                >
                  <Input
                    placeholder={t('flow.variableName')}
                    className={styles.inputField}
                  />
                </Form.Item>

                {/* 选择上一个节点的输出 */}
                <Form.Item
                  {...restField}
                  name={[name, 'sourceNodeId']}
                  className={styles.variableValue}
                >
                  <Select
                    placeholder="设置变量值"
                    options={sourceOptions}
                    className={styles.selectField}
                  />
                </Form.Item>

                {/* 删除按钮 */}
                <Button
                  type="text"
                  icon={<DeleteOutlined />}
                  onClick={() => remove(name)}
                  className={styles.deleteButton}
                />
              </div>
            ))}

            {/* 添加变量按钮 */}
            <Form.Item>
              <Button
                type="dashed"
                onClick={() =>
                  add({ variableName: '', sourceNodeId: undefined })
                }
                block
                icon={<PlusOutlined />}
                className={styles.addButton}
              >
                {t('flow.addVariable')}
              </Button>
            </Form.Item>
          </>
        );
      }}
    </Form.List>
  );
};

// 主组件
const InputVariableSelector = ({ node }: IProps) => {
  const { t } = useTranslation();
  return (
    <div className={styles.variableContainer}>
      <Title level={5} className={styles.sectionTitle}>
        输入变量
      </Title>
      <div className={styles.variableContent}>
        <VariableSelectForm node={node} />
      </div>
    </div>
  );
};

export default InputVariableSelector;
