import { ORIGIN } from '../config';
import User from '../entities/User';
import { getCookie } from '../utils/chrome/cookies';
import {
  Message as EMessage,
  MessageType as EMessageType,
  sendMessageToWebsite,
} from '../utils/chrome/external';
import { get, set } from '../utils/chrome/storage';
import {
  Message,
  MessageType,
  sendMessageToExtension,
  SocketMessageType,
} from '../utils/chrome/tabs';
import getImage from './notionServer/getImage';
import getSpaceUsers from './notionServer/getSpaceUsers';
import { forgotPassword, login } from './server/auth';
import {
  addEntryToDB,
  addTextToNotion,
  getDBSchema,
  getNotionPages,
  searchNotionPages,
} from './server/notion';
import {
  createComment,
  createPosts,
  deletePostAndChildren,
  getPosts,
  likePost,
  unlikePost,
} from './server/posts';
import { searchTopics } from './server/search';
import { handleUserSearch, updateUser } from './server/users';

// export const socket = io.connect(BACKEND_URL);

// socket.on('connect', () => {
//   get1('isAuthenticated').then((isAuthenticated) => {
//     if (isAuthenticated) {
//       get1('user').then((user) => {
//         if (user?.id) socket.emit(SocketMessageType.JoinRoom, user.id);
//       });
//     }
//   });
// });

// socket.on(
//   SocketMessageType.Notifications,
//   (notifications: INotification[], notificationDisplayIcon: number) => {
//     set({
//       notifications,
//       notificationDisplayIcon,
//     });
//   },
// );

// socket.on(SocketMessageType.Notification, (n: Notification) => {
//   get({
//     notifications: [],
//     notificationDisplayIcon: 0,
//   }).then((vals) => {
//     const newNotifications = [n].concat(vals.notifications);
//     const popupOpen = chrome.extension.getViews({ type: 'popup' }).length !== 0;
//     if (!popupOpen) {
//       const notificationDisplayIcon = vals.notificationDisplayIcon + 1;
//       set({
//         notifications: newNotifications,
//         notificationDisplayIcon,
//       });
//     } else set({ notifications: newNotifications });
//   });
// });

// Messages sent from extension
chrome.runtime.onMessage.addListener(
  (
    message: Message,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: any) => void,
  ) => {
    switch (message.type) {
      case MessageType.Login: {
        if (!message.loginArgs) break;
        Promise.all([login(message.loginArgs), getNotionPages()]).then(
          ([loginRes, notionPagesRes]) => {
            if (
              notionPagesRes.success &&
              notionPagesRes.spaces &&
              notionPagesRes.spaces.length > 0 &&
              notionPagesRes.defaults &&
              notionPagesRes.results
            ) {
              const spaceId = notionPagesRes.spaces[0].id;
              getSpaceUsers(spaceId).then((res) => {
                if (res.success) {
                  set({
                    spaceUsers: res.users,
                    spacebots: res.bots,
                  });
                }
              });
              const recents = {};
              notionPagesRes.spaces.forEach((s) => {
                recents[s.id] = notionPagesRes.results![spaceId].recents;
              });
              set({
                notionRecents: recents,
                notionDefaults: notionPagesRes.defaults,
                spaceId,
              });
            }
            sendResponse(loginRes);
          },
        );
        break;
      }
      case MessageType.ForgotPassword: {
        if (!message.forgotPasswordArgs) break;
        forgotPassword(message.forgotPasswordArgs).then((res) => {
          sendResponse(res);
        });
        break;
      }
      case MessageType.UpdateUser: {
        if (!message.updateUserArgs) break;
        updateUser(message.updateUserArgs).then((res) => {
          sendResponse(res);
        });
        break;
      }
      case MessageType.CreatePosts: {
        if (!message.posts) break;
        createPosts(message.posts).then((res) => {
          sendResponse(res);
        });
        break;
      }
      case MessageType.CreateComment: {
        if (!message.parentPostId || !message.comment) break;
        createComment(message.parentPostId, message.comment).then((res) => {
          sendResponse(res);
        });
        break;
      }
      case MessageType.GetPosts: {
        if (!message.url) break;
        getPosts(message.url).then((res) => {
          sendResponse(res);
        });
        break;
      }
      case MessageType.LikePost: {
        if (!message.id) break;
        likePost(message.id).then((res) => {
          sendResponse(res);
        });
        break;
      }
      case MessageType.UnlikePost: {
        if (!message.id) break;
        unlikePost(message.id).then((res) => {
          sendResponse(res);
        });
        break;
      }
      case MessageType.GetTabId:
        sendResponse(sender.tab?.id);
        break;
      case MessageType.HandleUserSearch: {
        if (!message.usernamePrefix || !message.numResults) return;
        handleUserSearch({
          usernamePrefix: message.usernamePrefix,
          numResults: message.numResults,
        }).then((res) => {
          sendResponse(res);
        });
        break;
      }
      case MessageType.HandleTopicSearch: {
        searchTopics({
          ...(message.textPrefix ? { textPrefix: message.textPrefix } : {}),
          ...(message.numResults ? { numResults: message.numResults } : {}),
        }).then((res) => {
          sendResponse(res);
        });
        break;
      }
      case MessageType.DeletePost: {
        if (!message.id) break;
        deletePostAndChildren(message.id).then((res) => {
          sendResponse(res);
        });
        break;
      }
      case MessageType.GetNotionUserId: {
        getCookie('https://www.notion.so', 'notion_user_id').then((res) => {
          sendResponse(res);
        });
        break;
      }
      case MessageType.GetNotionPages: {
        getNotionPages(message.spaceId, message.recentIds).then((res) => {
          sendResponse(res);
        });
        break;
      }
      case MessageType.SearchNotionPages: {
        if (!message.query || !message.spaceId) break;
        searchNotionPages(message.query, message.spaceId, message.limit).then((res) => {
          sendResponse(res);
        });
        break;
      }
      case MessageType.GetNotionImage: {
        if (!message.imageOptions) break;
        getImage(message.imageOptions).then((res) => {
          sendResponse(res);
        });
        break;
      }
      case MessageType.AddTextToNotion: {
        if (!message.notionPageId || !message.notionTextChunks) break;
        addTextToNotion(message.notionPageId, message.notionTextChunks).then((res) => {
          sendResponse(res);
        });
        break;
      }
      case MessageType.GetNotionSpaceUsers: {
        if (!message.spaceId) break;
        getSpaceUsers(message.spaceId).then((res) => {
          sendResponse(res);
        });
        break;
      }
      case MessageType.GetNotionDBSchema: {
        if (!message.dbId) break;
        getDBSchema(message.dbId).then((res) => {
          sendResponse(res);
        });
        break;
      }
      case MessageType.AddNotionRow: {
        if (!message.dbId || !message.updates || !message.notionTextChunks) break;
        addEntryToDB(message.dbId, message.updates, message.notionTextChunks).then((res) => {
          sendResponse(res);
        });
        break;
      }
      case SocketMessageType.JoinRoom: {
        if (!message.userId) break;
        // socket.emit(SocketMessageType.JoinRoom, message.userId);
        break;
      }
      case SocketMessageType.LeaveRoom: {
        if (!message.userId) break;
        // socket.emit(SocketMessageType.LeaveRoom, message.userId);
        break;
      }
      case SocketMessageType.NotificationTrayOpened: {
        if (!message.userId) break;
        // socket.emit(SocketMessageType.NotificationTrayOpened, message.userId);
        break;
      }
      case SocketMessageType.ReadNotification: {
        if (!message.notificationId) break;
        // socket.emit(SocketMessageType.ReadNotification, message.notificationId);
        break;
      }
      case MessageType.OpenTab: {
        if (!message.url) break;
        chrome.tabs.create(
          {
            url: message.url,
            active: message.active || false,
          },
          () => sendResponse({ success: true }),
        );
        break;
      }
      case MessageType.GoToPage: {
        if (!message.url) break;
        chrome.tabs.update(
          {
            url: message.url,
          },
          () => sendResponse({ success: true }),
        );
        break;
      }
      case MessageType.Sync:
        break;
    }

    return true;
  },
);

// Messages received from outside the extension (messages from frontend website)
chrome.runtime.onMessageExternal.addListener(
  (
    message: EMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: any) => void,
  ) => {
    switch (message.type) {
      case EMessageType.Exists: {
        sendResponse({ success: true });
        break;
      }
      case EMessageType.Login: {
        sendMessageToExtension({ type: SocketMessageType.JoinRoom, userId: message.user!.id });
        set({
          token: message.token,
          isExtensionOn: true,
        })
          .then(() => set({ isAuthenticated: true }))
          .then(() => {
            getNotionPages().then((res) => {
              if (
                res.success &&
                res.spaces &&
                res.spaces.length > 0 &&
                res.defaults &&
                res.results
              ) {
                const spaceId = res.spaces[0].id;
                const recents = {};
                res.spaces.forEach((s) => {
                  recents[s.id] = res.results![spaceId].recents;
                });
                set({
                  user: new User(message.user!),
                  notionRecents: recents,
                  notionDefaults: res.defaults,
                  spaceId,
                });
                getSpaceUsers(spaceId).then((res) => {
                  if (res.success) {
                    set({
                      spaceUsers: res.users,
                      spacebots: res.bots,
                    });
                  }
                });
              }
            });
          })
          .then(() => sendResponse(true));
        break;
      }
      case EMessageType.IsAuthenticated: {
        get({
          isAuthenticated: false,
          token: '',
          user: null,
        }).then((res) => sendResponse(res));
        break;
      }
    }
    return true;
  },
);

// change in notification display icon
chrome.storage.onChanged.addListener((change) => {
  if (change.notificationDisplayIcon !== undefined) {
    if (change.notificationDisplayIcon.newValue !== undefined) {
      chrome.browserAction.setBadgeText({
        text:
          change.notificationDisplayIcon.newValue !== 0
            ? change.notificationDisplayIcon.newValue.toString()
            : '',
      });
      chrome.browserAction.setBadgeBackgroundColor({ color: '#FF0000' });
    } else chrome.browserAction.setBadgeText({ text: '' });
  }
});

// Listen on when a tab becomes active
chrome.tabs.onActivated.addListener((activeInfo) => {
  console.log(`Tab ${activeInfo.tabId} active.`);
});

// Extension installed or updated
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason == 'install') {
    sendMessageToWebsite({ type: EMessageType.Exists });
    chrome.tabs.update({ url: `${ORIGIN}/signup` });
  }
});

// On tab create
chrome.tabs.onCreated.addListener((tab: chrome.tabs.Tab) => {
  // if (tab.id === undefined) return;
  // const tabId = tab.id.toString();
  // set({
  //   [key(tabId, 'isOpen')]: false,
  //   [key(tabId, 'position')]: Point.toJSON(DEFAULT_POSITION)
  // });
});

// When update is available, immediately fetch that update
chrome.runtime.onUpdateAvailable.addListener(function (details) {
  console.log('Updating to version ' + details.version);
  // reloads the extension
  chrome.runtime.reload();
  // reload existing content scripts
});
