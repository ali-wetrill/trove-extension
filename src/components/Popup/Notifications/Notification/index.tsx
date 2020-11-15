import React from 'react';
import ReactQuill from 'react-quill';
import { socket } from '../../../../app/background';
import NotificationObject from '../../../../entities/Notification';
import { get1, set } from '../../../../utils/chrome/storage';
import '../../style.scss';
import '../style.scss';
import './style.scss';

interface NotificationProps {
  notification: NotificationObject;
}

export default function Notification({ notification }: NotificationProps) {

  const handleClick = async () => {
    socket.emit('read notification', notification.id);
    const ns: NotificationObject[] = await get1('notifications')
    const i = ns.findIndex((n) => n.id === notification.id)
    notification.read = true
    ns[i] = notification
    await set({ notifications: ns })
  }

	return (
    <div 
      className={`TbdNotificationWrapper ${!notification.read && 'TbdNotificationWrapper--unread'}`} 
      onClick={() => handleClick()}
    >
      <div className="TbdNotificationWrapper__HeaderWrapper">
        <div className="TbdProfile__Img" style={{ backgroundColor: notification.sender.color }}>
          {notification.sender.displayName[0]}
        </div>
        <div className="TbdNotificationWrapper__HeaderContentWrapper">
          <div className="TbdNotificationWrapper__Notification">
            <span className="TbdNotificationWrapper__DisplayName">
              {`${notification.sender.displayName} `}
            </span>
            <span className="TbdNotificationWrapper__Action">
              tagged you
            </span>
          </div>
          <div className="TbdNotificationWrapper__NotificationDetails">
            {`${notification.time} · ${notification.url}`}
          </div>
        </div>
      </div>
      <div className="TbdNotificationWrapper__Content">
        <ReactQuill 
          className="TroveTooltip__Editor TroveTooltip__Editor--read-only"
          theme="bubble"
          value={notification.content}
          readOnly={true}
        />
      </div>
    </div>
	)
};
