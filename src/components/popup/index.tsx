import { Switch, Tabs } from 'antd';
import 'antd/dist/antd.min.css';
import React, { useEffect, useState } from 'react';
import { Notification as INotification, User as IUser } from '../../models';
import { localGet, localSet } from '../../utils/chromeStorage';
import { notifications as notificationData } from '../../utils/data';
import Notification from './Notification';
import Profile from './Profile';
import './style.scss';

function Popup() {
  /**
   * State for all components in Popup.
   */
  const [notifications, setNotifications] = useState<INotification[]>([]);

  /**
   * Global state.
   */
  const [extensionOn, setExtensionOn] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [user, setUser] = useState<IUser | null>(null);

  useEffect(() => {
    localGet(null).then(items => {
      if (items['extensionOn']) setExtensionOn(items['extensionOn'])
      if (items['authenticated']) setAuthenticated(items['authenticated'])
      if (items['user']) setUser(items['user'])
    });
    
    chrome.storage.onChanged.addListener(changes => {
      if (changes['extensionOn']) setExtensionOn(changes['extensionOn'].newValue)
      if (changes['authenticated']) setAuthenticated(changes['authenticated'].newValue)
      if (changes['user']) setUser(changes['user'].newValue)
    });
  }, [])

  /**
   * Turn extension on/off. Save to global state.
   * @param checked New global on/off value.
   */
  const handleOnOff = async (checked: boolean) => {
    await localSet({ extensionOn: checked })
  }

  /**
   * Establish socket to server to receive notifications.
   */
  useEffect(() => {
    const getNotifications = async (): Promise<void> => {
      const n = notificationData[0]
      let notifs: INotification[] = []
      for (let i=0; i<11; i++) {
        let s: any = {}
        s = Object.assign(s, n)
        s.id = i.toString()
        notifs.push(s)
      }
      setNotifications(notifs)
    }
    getNotifications();
  }, [])

  return (
    <div className="TbdPopupContainer">
      <Tabs defaultActiveKey="1">
        <Tabs.TabPane tab="notifications" key="1">
          <div className="TbdPopupContainer__TabWrapper">
            {notifications.map(n => (
              <Notification key={n.id} notification={n} />
            ))}
          </div>
        </Tabs.TabPane>
        <Tabs.TabPane tab="profile" key="2">
          <div className="TbdPopupContainer__TabWrapper">
            {user && <Profile user={user} />}
          </div>
        </Tabs.TabPane>
      </Tabs>
      <div className="TbdPopupContainer__OnOffWrapper">
        <div className="TbdPopupContainer__OnOffTextWrapper">
          <div>Turn Accord</div>
          <div className="TbdPopupContainer__OnOff">{extensionOn ? 'OFF' : 'ON'}</div>
        </div>
        <Switch onClick={(checked) => { handleOnOff(checked) }} checked={extensionOn} />
      </div>
    </div>
  );
};

export default Popup;