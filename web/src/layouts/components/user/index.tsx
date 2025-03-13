import { useFetchUserInfo } from '@/hooks/user-setting-hooks';
import { Avatar } from 'antd';
import React from 'react';
import { history } from 'umi';

import styles from '../../index.less';

const App: React.FC = () => {
  const { data: userInfo } = useFetchUserInfo();

  const toSetting = () => {
    history.push('/user-setting');
  };

  return (
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
  );
};

export default App;
