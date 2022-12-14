import { LoadingOutlined } from '@ant-design/icons';
import 'antd/dist/antd.css';
import React, { useEffect, useState } from 'react';
import 'react-quill/dist/quill.bubble.css';
import { ErrorOrigin } from '../../app/server/misc';
import Notification from '../../entities/Notification';
import User from '../../entities/User';
import INotification from '../../models/INotification';
import { get, set } from '../../utils/chrome/storage';
import { sendMessageToExtension, SocketMessageType } from '../../utils/chrome/tabs';
import ErrorBoundary from '../errorBoundary/index';
import Login from '../Login';
import BottomBar from './BottomBar';
import Profile from './Profile';
import './style.scss';

export default function Popup() {
  const [loading, setLoading] = useState(true);
  const [tabKey, setTabKey] = useState('1');

  /**
   * Global state.
   */
  const [isExtensionOn, setIsExtensionOn] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(null!);
  const [spaceId, setSpaceId] = useState('');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    get({
      isAuthenticated: false,
      isExtensionOn: false,
      user: null,
      notifications: [],
      spaceId: null,
    }).then((items) => {
      if (items.isAuthenticated && items.user) {
        setNotifications(items.notifications.map((n: INotification) => new Notification(n)));
        setIsExtensionOn(items.isExtensionOn);
        setUser(new User(items.user));
        setIsAuthenticated(items.isAuthenticated);
        setSpaceId(items.spaceId);
      } else setIsAuthenticated(false);
    });

    chrome.storage.onChanged.addListener((change) => {
      if (change.user !== undefined) {
        if (change.user.newValue !== undefined) setUser(new User(change.user.newValue));
        else setUser(null);
      }
      if (change.notifications !== undefined) {
        if (change.notifications.newValue !== undefined)
          setNotifications(
            change.notifications.newValue.map((n: INotification) => new Notification(n)),
          );
        else setNotifications([]);
      }
      if (change.isExtensionOn !== undefined) {
        if (change.isExtensionOn.newValue !== undefined)
          setIsExtensionOn(change.isExtensionOn.newValue);
        else setIsExtensionOn(false);
      }
      if (change.isAuthenticated !== undefined) {
        if (change.isAuthenticated.newValue !== undefined)
          setIsAuthenticated(change.isAuthenticated.newValue);
        else setIsAuthenticated(false);
      }
      if (change.spaceId !== undefined) {
        if (change.spaceId.newValue !== undefined) setSpaceId(change.spaceId.newValue);
        else setSpaceId('');
      }
    });
  }, []);

  useEffect(() => {
    const zeroNotificationDisplayIcon = async () => {
      if (tabKey === '1' && user?.id) {
        await set({ notificationDisplayIcon: 0 });
        sendMessageToExtension({ type: SocketMessageType.NotificationTrayOpened, userId: user.id });
      }
    };
    zeroNotificationDisplayIcon();
  }, [tabKey, user]);

  if (isAuthenticated === null) {
    return (
      <div className="TbdPopupContainer TbdPopupContainer--loading">
        <LoadingOutlined />
      </div>
    );
  }
  return (
    <ErrorBoundary origin={ErrorOrigin.Popup}>
      <div className="TbdPopupContainer">
        {isAuthenticated ? (
          <>
            {/* <Tabs activeKey={tabKey} onChange={(newTabKey) => setTabKey(newTabKey)}>
              <Tabs.TabPane tab="Notifications" key="1">
                <div className="TbdPopupContainer__TabWrapper">
                  {notifications && <Notifications notifications={notifications} />}
                </div>
              </Tabs.TabPane>
              <Tabs.TabPane tab="Profile" key="2"> */}
            <div className="TbdPopupContainer__TabWrapper">{user && <Profile user={user} />}</div>
            {/* </Tabs.TabPane>
            </Tabs> */}
            <BottomBar isExtensionOn={isExtensionOn} />
          </>
        ) : (
          <Login type="popup" />
        )}
      </div>
    </ErrorBoundary>
  );
}
