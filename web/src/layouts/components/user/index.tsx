import { useFetchUserInfo } from '@/hooks/user-setting-hooks';
import { Avatar, Button, Modal } from 'antd';
import React from 'react';
import { history } from 'umi';

import UserSetting from '@/pages/user-setting/index';
import styles from '../../index.less';

const App: React.FC = () => {
  const { data: userInfo } = useFetchUserInfo();

  const toSetting = () => {
    history.push('/user-setting');
  };

  const test = () => {
    setIsModalOpen(true);
  };

  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const handleCancel = () => {
    setIsModalOpen(false);
  };

  return (
    <>
      <Avatar
        size={32}
        // onHover={toSetting}

        onClick={toSetting}
        className={styles.clickAvailable}
        // src={
        //   userInfo.avatar ??
        //   'https://zos.alipayobjects.com/rmsportal/jkjgkEfvpUPVyRjUImniVslZfWPnJuuZ.png'
        // }
        src={userInfo.avatar ?? '/x.png'}
      />
      <Button type="primary" onClick={test}>
        Primary Button
      </Button>
      <Modal title="Basic Modal" open={isModalOpen} onCancel={handleCancel}>
        <UserSetting></UserSetting>
      </Modal>
    </>
  );
};

export default App;
