import { useFetchUserInfo } from '@/hooks/user-setting-hooks';
import { Avatar, Flex, Modal, Space, Tabs } from 'antd';
import React from 'react';
import { useNavigate } from 'umi';

import { useTranslate } from '@/hooks/common-hooks';
import { useLogout } from '@/hooks/login-hooks';
import {
  UserSettingIconMap,
  UserSettingRouteKey,
} from '@/pages/user-setting/constants';
import UserSettingModel from '@/pages/user-setting/setting-model';
import UserSettingPassword from '@/pages/user-setting/setting-password';
import UserSettingProfile from '@/pages/user-setting/setting-profile';
import SystemInfo from '@/pages/user-setting/setting-system';
import UserSettingTeam from '@/pages/user-setting/setting-team';
import routes from '@/routes';
import styles from '../../index.less';

const data = routes.find((v) => v.path === '/');

// [UserSettingRouteKey.Profile]: ,
// [UserSettingRouteKey.Password]: <PasswordIcon />,
// [UserSettingRouteKey.Model]: <ModelProviderIcon />,
// [UserSettingRouteKey.System]: <MonitorOutlined style={{ fontSize: 24 }} />,
// [UserSettingRouteKey.Team]: <TeamIcon />,
// [UserSettingRouteKey.Logout]: <LogOutIcon />,

export const UserSettingComponent = {
  [UserSettingRouteKey.Profile]: <UserSettingProfile />,
  [UserSettingRouteKey.Password]: <UserSettingPassword />,
  [UserSettingRouteKey.Model]: <UserSettingModel />,
  [UserSettingRouteKey.System]: <SystemInfo />,
  [UserSettingRouteKey.Team]: <UserSettingTeam />,
  [UserSettingRouteKey.Logout]: undefined,
};

const App: React.FC = () => {
  const { data: userInfo } = useFetchUserInfo();
  const navigate = useNavigate();
  const { t } = useTranslate('setting');
  const { logout } = useLogout();
  const maxHeight = document.body.clientHeight - 72 - 50 - 78 - 50;

  const toSetting = () => {
    setIsModalOpen(true);
    // history.push('/user-setting');
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
      {/* <a onClick={test}>
        设置
      </a> */}
      <Modal
        title="系统设置"
        footer={false}
        width={'90%'}
        open={isModalOpen}
        onCancel={handleCancel}
      >
        {/* <UserSetting></UserSetting> */}
        {/* <SideBar  ></SideBar>
        {/* <Flex flex={1} className={styles.outletWrapper}>
          <Outlet context={{ prop: 'a' }}></Outlet>
        </Flex> */}
        <Tabs
          defaultActiveKey="1"
          tabPosition={'left'}
          tabBarStyle={{ paddingLeft: 0 }}
          style={{ height: maxHeight, overflowY: 'auto' }}
          onChange={(v) => {
            if (v === 'logout') {
              logout();
            }
          }}
          items={Object.values(UserSettingRouteKey).map((value) => ({
            label: (
              <Flex justify={'space-between'}>
                <Space>
                  {UserSettingIconMap[value]}
                  {t(value)}
                </Space>
              </Flex>
            ),
            key: value,
            disabled: false,
            children: (
              <div style={{ height: maxHeight, overflowY: 'auto' }}>
                {UserSettingComponent[value]}
              </div>
            ),
          }))}
        />
      </Modal>
    </>
  );
};

export default App;
