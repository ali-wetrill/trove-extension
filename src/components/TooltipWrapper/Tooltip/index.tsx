import { LoadingOutlined } from '@ant-design/icons';
import React, { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import ReactTooltip from 'react-tooltip';
import { v4 as uuid } from 'uuid';
import { addTextBlocks, Record } from '../../../app/server/notion';
import { IPostRes, IPostsRes } from '../../../app/server/posts';
import ExtensionError from '../../../entities/ExtensionError';
import Post from '../../../entities/Post';
import User from '../../../entities/User';
import { toArray } from '../../../utils';
import { get, get1 } from '../../../utils/chrome/storage';
import { MessageType, sendMessageToExtension } from '../../../utils/chrome/tabs';
import Dropdown from './Dropdown';
import Highlighter, {
  HighlightType,
  transformUnsavedHighlightDataToCreateHighlightRequestData,
  transformUnsavedHighlightDataToTextList,
} from './helpers/highlight/Highlighter';
import { getTextRangeFromRange } from './helpers/highlight/textRange';
import { isOsKeyPressed } from './helpers/os';
import ListReducer, { ListReducerActionType } from './helpers/reducers/ListReducer';
import { isSelectionInEditableElement, selectionExists } from './helpers/selection';

const TOOLTIP_MARGIN = 10;
const TOOLTIP_HEIGHT = 200;
const MINI_TOOLTIP_HEIGHT = 32;

interface TooltipProps {
  root: ShadowRoot;
}

export default function Tooltip(props: TooltipProps) {
  const [didInitialGetPosts, setDidInitialGetPosts] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isExtensionOn, setIsExtensionOn] = useState(false);

  const [showTooltip, setShowTooltip] = useState(false);
  const [numTempHighlights, setNumTempHighlights] = useState(0);
  // Is user currently saving page
  const [isSavingPage, setIsSavingPage] = useState(false);
  const [isSelectionHovered, setIsSelectionHovered] = useState(false);

  const [dropdownClicked, setDropdownClicked] = useState(false);
  const [defaultPageLoading, setDefaultPageLoading] = useState(true);
  const [dropdownItem, setDropdownItem] = useState<Record | null>(null);

  // Id of Notion page to save highlight/page to
  const [notionPageId, setNotionPageId] = useState<string>('');
  // Id of Notion user
  const [notionUserId, setNotionUserId] = useState<string>('');

  const [posts, dispatchPosts] = useReducer(ListReducer<Post>('id'), []);
  const [user, setUser] = useState<User | null>(null);

  const [highlighter, setHighlighter] = useState(new Highlighter());
  const tooltip = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  const updateNumTempHighlights = () => {
    const newVal = highlighter.getAllUnsavedHighlights().length;
    setNumTempHighlights(newVal);
    return newVal;
  };

  useEffect(() => {
    const newVal = isSavingPage || numTempHighlights > 0;
    setShowTooltip(newVal);
  }, [isSavingPage, numTempHighlights]);

  // /**
  //  * Handler for when mouse cursor enters a Trove mark element. A highlight can be composed of
  //  * multiple marks, which can each have multiple client rects.
  //  * TODO: Maybe move active highlight logic to highlighter?
  //  */
  // const onMarkMouseEnter = useCallback(
  //   (e: MouseEvent, post: Post, mark: HTMLElement) => {
  //     // Don't trigger mouseenter event if user is selecting text (left mouse button down)
  //     if (!post.highlight || e.buttons === 1) return;
  //     highlighter.modifyHighlightTemp(HighlightType.Default);
  //     highlighter.modifyHighlight(post.highlight.id, HighlightType.Active);

  //   },
  //   [highlighter],
  // );

  const addPosts = (postsToAdd: Post | Post[], type: HighlightType) => {
    postsToAdd = toArray(postsToAdd);
    for (const post of postsToAdd) {
      highlighter.addHighlight(post, type);
    }

    // Add post(s) to list of posts
    dispatchPosts({ type: ListReducerActionType.UpdateOrAdd, data: postsToAdd });
  };

  const removePosts = (postsToRemove: Post | Post[]) => {
    postsToRemove = toArray(postsToRemove);
    for (const post of postsToRemove) {
      if (!post.highlight) continue;
      highlighter.removeHighlight(post.highlight.id);
      updateNumTempHighlights();
    }
    // Remove post(s) from list of posts
    dispatchPosts({ type: ListReducerActionType.Remove, data: postsToRemove });
  };

  const addTempHighlight = useCallback(() => {
    const selection = getSelection();
    if (selection?.toString()) {
      const id = uuid();
      const range = selection.getRangeAt(0);
      const textRange = getTextRangeFromRange(range);
      highlighter.addHighlight({ id, textRange, color: user!.color }, HighlightType.Active);
      updateNumTempHighlights();
      selection.removeAllRanges();
    }
  }, [user]);

  useEffect(() => {
    ReactTooltip.rebuild();

    get1('notionDefault').then((r: Record) => {
      if (r) setDropdownItem(r);
      setDefaultPageLoading(false);
    });

    // Get user object
    get(['user', 'isAuthenticated', 'isExtensionOn']).then((data) => {
      setIsAuthenticated(data.isAuthenticated || false);
      setIsExtensionOn(data.isExtensionOn || false);
      if (!data.isAuthenticated || !data.isExtensionOn) return;

      // Set current user
      if (data.user) setUser(new User(data.user));
    });

    chrome.storage.onChanged.addListener((change) => {
      if (change.isExtensionOn !== undefined) {
        setIsExtensionOn(change.isExtensionOn.newValue || false);
      }

      if (change.isAuthenticated !== undefined) {
        setIsAuthenticated(change.isAuthenticated.newValue || false);
      }

      if (change.user !== undefined) {
        setUser(change.user.newValue || null);
      }
    });
  }, []);

  useEffect(() => {
    if (isAuthenticated && isExtensionOn && !didInitialGetPosts) {
      const url = window.location.href;
      sendMessageToExtension({ type: MessageType.GetPosts, url })
        .then((res: IPostsRes) => {
          if (res.success) {
            setDidInitialGetPosts(true);
            const newPosts = res.posts!.map((p) => new Post(p));
            addPosts(newPosts, HighlightType.Default);
          }
        })
        .catch((e) => console.error('Errored while getting posts:', e));
    } else if ((!isAuthenticated || !isExtensionOn) && posts.length > 0) {
      removePosts(posts);
    }
  }, [didInitialGetPosts, isAuthenticated, isExtensionOn, posts]);

  // const onResize = useCallback(() => {
  //   positionTooltip();
  // }, [positionTooltip]);

  // useEffect(() => {
  //   window.addEventListener('resize', onResize);
  //   return () => window.removeEventListener('resize', onResize);
  // }, [onResize]);

  const onSelectionChange = useCallback((e: Event) => {
    // Don't set isSelectionVisible to true here because we only want tooltip to appear after
    // user has finished dragging selection. We set this in positionTooltip instead.
    const selection = getSelection();
    if (!selectionExists(selection)) {
      setIsSelectionHovered(false);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('selectionchange', onSelectionChange);
    return () => document.removeEventListener('selectionchange', onSelectionChange);
  }, [onSelectionChange]);

  const onDocumentMouseUp = useCallback(
    (e: MouseEvent) => {
      if ((e.target as HTMLElement).id === 'TroveTooltipWrapper') {
        return;
      }

      if ((e.target as HTMLElement).classList.contains('TroveTooltip__Dropdown')) {
        setDropdownClicked(false);
      }
    },
    [addTempHighlight],
  );

  useEffect(() => {
    document.addEventListener('mouseup', onDocumentMouseUp);
    return () => document.removeEventListener('mouseup', onDocumentMouseUp);
  }, [onDocumentMouseUp]);

  const onMouseMovePage = useCallback((e: MouseEvent) => {
    // Don't show mini-tooltip when dragging selection or it will repeatedly disappear and appear
    // as cursor enters and leaves selection
    if (e.buttons === 1 || isSelectionInEditableElement()) {
      return;
    }

    // let rect;
    // const selection = getSelection()!;
    // if (
    //   isSelectionHovered &&
    //   !!selectionRect &&
    //   !!tooltipRect &&
    //   isMouseBetweenRects(e, selectionRect, tooltipRect)
    // ) {
    //   // Do nothing
    // } else if (
    //   selectionExists(selection) &&
    //   !!(rect = getHoveredRect(e, selection.getRangeAt(0).getClientRects()))
    // ) {
    //   setIsSelectionHovered(true);
    //   setTooltipRect(tooltip.current!.getBoundingClientRect());
    //   setSelectionRect(rect);
    // } else {
    //   setIsSelectionHovered(false);
    //   setTooltipRect(null);
    //   setSelectionRect(null);
    // }
  }, []);

  useEffect(() => {
    document.addEventListener('mousemove', onMouseMovePage);
    return () => document.removeEventListener('mousemove', onMouseMovePage);
  }, [onMouseMovePage]);

  const onSaveHighlight = async (e?: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    ReactTooltip.hide();

    const unsavedHighlights = highlighter.getAllUnsavedHighlights();
    if (unsavedHighlights.length > 0) {
      const data = transformUnsavedHighlightDataToCreateHighlightRequestData(unsavedHighlights);

      // Show actual highlight when we get response from server
      const p1 = sendMessageToExtension({ type: MessageType.CreateHighlight, data }).then(
        (res: IPostRes) => {
          if (res.success && res.post) {
            highlighter.removeAllUnsavedHighlights();
            addPosts(new Post(res.post), HighlightType.Default);
          } else {
            // Show that highlighting failed
            console.error('Failed to create post:', res.message);
            throw new ExtensionError(res.message!, 'Error creating highlight, try again!');
          }
        },
      );

      // Write highlight text to chosen Notion page
      const p2 = addTextBlocks(
        notionUserId,
        notionPageId,
        transformUnsavedHighlightDataToTextList(unsavedHighlights),
      );
      await Promise.all([p1, p2]).then(() => updateNumTempHighlights());
    }
  };

  const onSavePage = async () => {
    // Write page title hyperlinked with current URL to chosen Notion page
    const href = window.location.href;
    const title = document.title;
    await addTextBlocks(notionUserId, notionPageId, [[title, [['a', href]]]]);
  };

  const renderItem = (item: Record | null) => {
    if (!item) {
      return <span>Click to select a page</span>;
    }
    let icon;
    if (item.icon?.type === 'emoji')
      icon = <span className="TroveDropdown__Icon">{item.icon?.value}</span>;
    else if (item.icon?.type === 'url')
      icon = (
        <img
          src={chrome.extension.getURL('images/noIconNotion.png')}
          className="TroveDropdown__Icon"
        />
      );
    return (
      <span className="TroveDropdown__SelectedItem">
        <span className="TroveDropdown__ItemIconWrapper">
          {item.icon ? (
            icon
          ) : (
            <img
              src={chrome.extension.getURL('images/noIconNotion.png')}
              className="TroveDropdown__Icon"
            />
          )}
        </span>
        <span className="TroveDropdown__SelectedItemName">{item.name}</span>
      </span>
    );
  };

  const onKeyDownPage = useCallback(
    (e: KeyboardEvent) => {
      // Handle case where user logs out or turns ext off, but page isn't refreshed
      if (!isAuthenticated || !isExtensionOn) {
        return;
      }

      // Keyboard shortcuts
      if (isOsKeyPressed(e) && e.key === 'd') {
        e.preventDefault();
        const selection = getSelection()!;
        if (selectionExists(selection) && /\S/.test(selection.toString())) {
          // New post on current selection
          addTempHighlight();
        } else if (highlighter.getAllUnsavedHighlights().length > 0) {
          // Save current highlight
          onSaveHighlight();
        } else if (!selectionExists(selection)) {
          // Save current page
          setIsSavingPage(true);
        }
      } else if (
        e.key === 'Tab' &&
        (isSelectionHovered || highlighter.getAllUnsavedHighlights().length > 0) &&
        !dropdownClicked
      ) {
        // Open dropdown
        e.preventDefault();
        const selection = getSelection()!;
        if (selectionExists(selection) && /\S/.test(selection.toString())) {
          addTempHighlight();
        }

        setDropdownClicked(true);
      }
    },
    [
      dropdownClicked,
      highlighter,
      isAuthenticated,
      isExtensionOn,
      isSelectionHovered,
      addTempHighlight,
    ],
  );

  useEffect(() => {
    document.addEventListener('keydown', onKeyDownPage);
    return () => document.removeEventListener('keydown', onKeyDownPage);
  }, [onKeyDownPage]);

  if (!showTooltip) {
    return null;
  }
  return isSavingPage ? (
    <>
      <div className="TroveTooltip" ref={tooltip}>
        <div className="TroveTooltip__Content">
          <div className="TroveContent__Text">Send page to Notion</div>
          <div className="TroveContent__ButtonList">
            <button
              onClick={() => {
                onSavePage();
                setIsSavingPage(false);
              }}
            >
              Save
            </button>
            <button onClick={() => setIsSavingPage(false)}>Cancel</button>
          </div>
        </div>
      </div>
      <ReactTooltip
        place="top"
        className="TroveTooltip__Hint"
        effect="solid"
        event={'mouseenter'}
        eventOff={'mouseleave'}
        arrowColor="transparent"
        html={true}
        disable={dropdownClicked}
      />
    </>
  ) : (
    <>
      <div className="TroveTooltip" ref={tooltip}>
        <div className="TroveTooltip__Content">
          <div className="TroveContent__Text">
            Send {numTempHighlights > 1 ? `${numTempHighlights} highlights` : 'highlight'} to Notion
          </div>
          {dropdownClicked ? (
            <Dropdown setItem={setDropdownItem} setDropdownClicked={setDropdownClicked} />
          ) : (
            <div
              onMouseEnter={() => ReactTooltip.show(button.current!)}
              onMouseLeave={() => ReactTooltip.hide(button.current!)}
              data-tip={`
                <div class="TroveHint__Content">
                  <p class="TroveHint__Content__PrimaryText">Pick Notion page</p>
                  <p class="TroveHint__Content__SecondaryText">(Tab)</p>
                </div>
              `}
              className="TroveContent__SaveTo"
            >
              <button
                className="TroveContent__SaveTo__Button"
                onClick={() => {
                  const selection = getSelection()!;
                  if (selectionExists(selection) && /\S/.test(selection.toString())) {
                    addTempHighlight();
                  }

                  setDropdownClicked(true);
                  ReactTooltip.hide();
                }}
                ref={button}
              >
                {defaultPageLoading ? (
                  <div>
                    <LoadingOutlined />
                  </div>
                ) : (
                  renderItem(dropdownItem)
                )}
                <div className="TroveContent__SaveTo__IconRight">▾</div>
              </button>
            </div>
          )}
          <div className="TroveContent__ButtonList">
            <button onClick={() => onSaveHighlight()}>Save</button>
            <button
              onClick={() => {
                highlighter.removeAllUnsavedHighlights();
                updateNumTempHighlights();
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
      <ReactTooltip
        place="top"
        className="TroveTooltip__Hint"
        effect="solid"
        event={'mouseenter'}
        eventOff={'mouseleave'}
        arrowColor="transparent"
        html={true}
        disable={dropdownClicked}
      />
    </>
  );
}
