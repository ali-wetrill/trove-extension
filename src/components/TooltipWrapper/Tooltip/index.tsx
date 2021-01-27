import classNames from 'classnames';
import Color from 'color';
import { Delta, Sources } from 'quill';
import React, { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import ReactQuill, { UnprivilegedEditor } from 'react-quill';
import { v4 as uuid } from 'uuid';
import { HighlightParam, IPostRes, IPostsRes } from '../../../app/server/posts';
import ExtensionError from '../../../entities/ExtensionError';
import Post from '../../../entities/Post';
import User from '../../../entities/User';
import ITopic from '../../../models/ITopic';
import { toArray } from '../../../utils';
import { get } from '../../../utils/chrome/storage';
import { MessageType, sendMessageToExtension } from '../../../utils/chrome/tabs';
import Edge from './helpers/Edge';
import Highlighter, { HighlightType } from './helpers/highlight/Highlighter';
import { getRangeFromTextRange, getTextRangeFromRange } from './helpers/highlight/textRange';
import { getOS, OS } from './helpers/os';
import Point from './helpers/Point';
import ListReducer, { ListReducerActionType } from './helpers/reducers/ListReducer';
import {
  getHoveredRect,
  isMouseBetweenRects,
  isSelectionInEditableElement,
  selectionExists
} from './helpers/selection';
import InputPill from './inputPill';
import Pill from './pill';

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
  const [position, setPosition] = useState(new Point(0, 0));
  const [positionEdge, setPositionEdge] = useState(Edge.Bottom);

  const [posts, dispatch] = useReducer(ListReducer<Post>('id'), []);
  const [topics, setTopics] = useState<Partial<ITopic>[]>([]);
  const [user, setUser] = useState<User | null>(null);

  const [hoveredPost, setHoveredPost] = useState<Post | null>(null);
  const [hoveredPostBuffer, setHoveredPostBuffer] = useState<Post | null>(null);
  const [isSelectionHovered, setIsSelectionHovered] = useState(false);
  const [selectionRect, setSelectionRect] = useState<DOMRect | null>(null);

  const [miniTooltipRect, setMiniTooltipRect] = useState<DOMRect | null>(null);
  const [wasMiniTooltipClicked, setWasMiniTooltipClicked] = useState(false);
  const tooltip = useRef<HTMLDivElement>(null);

  const [highlighter, setHighlighter] = useState(new Highlighter());
  const [isTempHighlightVisible, setIsTempHighlightVisible] = useState(false);
  const [tempHighlight, setTempHighlight] = useState<HighlightParam | null>(null);
  const [tempHighlightId, setTempHighlightId] = useState('');
  const [tempHighlightRange, setTempHighlightRange] = useState<Range | null>(null);

  const [editorValue, setEditorValue] = useState('');
  const quill = useRef<ReactQuill>(null);

  // TODO: maybe assign this to a range state var
  const getTooltipRange = useCallback(
    (range?: Range) => {
      if (range) {
        return range;
      }

      let retRange: Range | null;
      if (hoveredPostBuffer && hoveredPostBuffer.highlight) {
        try {
          retRange = getRangeFromTextRange(hoveredPostBuffer.highlight.textRange);
        } catch (e) {
          retRange = null;
        }

        if (retRange) return retRange;
      }

      if (tempHighlightRange) {
        return tempHighlightRange;
      }

      const selection = getSelection()!;
      if (selectionExists(selection)) {
        retRange = selection.getRangeAt(0);
        return retRange;
      }

      return null;
    },
    [hoveredPostBuffer, tempHighlightRange],
  );

  /**
   * Position and display tooltip according to change in selection.
   */
  const positionTooltip = useCallback(
    (range?: Range) => {
      const tooltipRange = getTooltipRange(range);
      if (!tooltipRange) return;

      const rect = tooltipRange.getBoundingClientRect();
      const height = tooltip.current?.getBoundingClientRect().height || MINI_TOOLTIP_HEIGHT;
      if (rect.bottom + height > document.documentElement.clientHeight) {
        setPositionEdge(Edge.Top);
        setPosition(
          new Point(
            rect.left + window.scrollX,
            rect.top + window.scrollY - height - TOOLTIP_MARGIN,
          ),
        );
      } else {
        setPositionEdge(Edge.Bottom);
        setPosition(new Point(rect.left + window.scrollX, rect.bottom + window.scrollY));
      }
    },
    [tooltip, getTooltipRange],
  );

  useEffect(() => {
    // Reposition tooltip after clicking mini-tooltip to account for possible shift due to change
    // in size
    if (wasMiniTooltipClicked) {
      positionTooltip();
    }
  }, [wasMiniTooltipClicked]);

  useEffect(() => {
    positionTooltip();
    setHoveredPost(hoveredPostBuffer);
  }, [hoveredPostBuffer]);

  // TODO: Maybe move active highlight logic to highlighter?
  const onHighlightMouseEnter = useCallback(
    (e: MouseEvent, post: Post) => {
      if (!post.highlight) return;
      highlighter.modifyHighlightTemp(HighlightType.Default);
      highlighter.modifyHighlight(post.highlight.id, HighlightType.Active);
      setHoveredPostBuffer(post);
    },
    [highlighter],
  );

  const onHighlightMouseLeave = useCallback(
    (e: MouseEvent, post: Post) => {
      if (!post.highlight) return;
      highlighter.modifyHighlight(post.highlight.id, HighlightType.Default);
      highlighter.modifyHighlightTemp(HighlightType.Active);
      // setHoveredPostBuffer(null);
    },
    [highlighter],
  );

  // TODO: Can we put these useeffects in a for loop by event?
  useEffect(() => {
    highlighter.highlights.forEach((highlight, id) => {
      const onMouseEnter = (e: MouseEvent) => onHighlightMouseEnter(e, highlight.post);
      for (const mark of highlight.marks) {
        mark.onmouseenter = onMouseEnter;
      }
    });
  }, [posts, onHighlightMouseEnter]);

  useEffect(() => {
    highlighter.highlights.forEach((highlight, id) => {
      const onMouseLeave = (e: MouseEvent) => onHighlightMouseLeave(e, highlight.post);
      for (const mark of highlight.marks) {
        mark.onmouseleave = onMouseLeave;
      }
    });
  }, [posts, onHighlightMouseLeave]);

  const addPosts = (postsToAdd: Post | Post[], type: HighlightType) => {
    postsToAdd = toArray(postsToAdd);
    for (const post of postsToAdd) {
      highlighter.addHighlight(post, type);
    }

    // Add post(s) to list of posts
    dispatch({ type: ListReducerActionType.UpdateOrAdd, data: postsToAdd });
  };

  const removePosts = (postsToRemove: Post | Post[]) => {
    postsToRemove = toArray(postsToRemove);
    for (const post of postsToRemove) {
      if (!post.highlight) continue;
      highlighter.removeHighlight(post.highlight.id);
    }

    // Remove post(s) from list of posts
    dispatch({ type: ListReducerActionType.Remove, data: postsToRemove });
  };

  // TODO: Store temp highlight stuff inside highlighter
  const addTempHighlight = () => {
    const selection = getSelection();
    if (selection?.toString()) {
      const range = selection.getRangeAt(0);
      const textRange = getTextRangeFromRange(range);
      setTempHighlight({
        textRange: textRange,
        url: window.location.href,
      });

      const id = uuid();
      setTempHighlightId(id);
      setTempHighlightRange(range.cloneRange());
      setIsTempHighlightVisible(true);
      highlighter.addHighlightTemp(range, user?.color, HighlightType.Active);
      selection.removeAllRanges();
    }
  };

  const removeTempHighlight = useCallback(() => {
    highlighter.removeHighlightTemp();
    setTempHighlight(null);
    setTempHighlightId('');
    setTempHighlightRange(null);
    setIsTempHighlightVisible(false);
  }, []);

  const addTopic = (topic: Partial<ITopic>) => {
    if (topics.some((t) => t.text?.toLowerCase() === topic.text?.toLowerCase())) return;
    const newTopics = topics.slice().filter((t) => t.id !== topic.id);
    newTopics.unshift(topic);
    setTopics(newTopics);
  };

  const resetTooltip = () => {
    removeTempHighlight();
    setWasMiniTooltipClicked(false);
    setMiniTooltipRect(null);
    setTopics([]); //? Do we want to reset topics every time?
    setEditorValue('');

    // Making the assumption that whenever we reset tooltip, we are also resetting selection
    setIsSelectionHovered(false);
    setSelectionRect(null);
  };

  useEffect(() => {
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
      sendMessageToExtension({ type: MessageType.GetPosts, url }).then((res: IPostsRes) => {
        if (res.success) {
          setDidInitialGetPosts(true);
          const newPosts = res.posts!.map((p) => new Post(p));
          addPosts(newPosts, HighlightType.Default);
        }
      });
    } else if ((!isAuthenticated || !isExtensionOn) && posts.length > 0) {
      removePosts(posts);
    }
  }, [didInitialGetPosts, isAuthenticated, isExtensionOn, posts]);

  const miniTooltipToTooltip = () => {
    addTempHighlight();
    setWasMiniTooltipClicked(true);
  };

  const onScroll = useCallback(() => {
    setIsSelectionHovered(false);
    setMiniTooltipRect(null);
    setSelectionRect(null);
  }, []);

  useEffect(() => {
    document.addEventListener('scroll', onScroll);
    return () => document.removeEventListener('scroll', onScroll);
  }, [onScroll]);

  const onResize = useCallback(() => {
    positionTooltip();
  }, [positionTooltip]);

  useEffect(() => {
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [onResize]);

  const onSelectionChange = useCallback(() => {
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

  const onMouseDownPage = useCallback((e: MouseEvent) => {
    // Do nothing if selection exists, let onSelectionChange take care of it
    if (selectionExists(getSelection())) {
      return;
    }

    // Do nothing if user clicks Trove tooltip
    const target = e.target as HTMLElement;
    if (target.id === 'TroveTooltipWrapper') {
      return;
    }

    // Remove temp highlight if it exists
    resetTooltip();
  }, []);

  useEffect(() => {
    if (isTempHighlightVisible || isSelectionHovered) {
      document.addEventListener('mousedown', onMouseDownPage);
    } else {
      document.removeEventListener('mousedown', onMouseDownPage);
    }

    return () => document.removeEventListener('mousedown', onMouseDownPage);
  }, [isTempHighlightVisible, isSelectionHovered, onMouseDownPage]);

  const onDocumentMouseUp = useCallback(
    (e: MouseEvent) => {
      if ((e.target as HTMLElement).id === 'TroveTooltipWrapper') {
        return;
      }

      positionTooltip();
    },
    [positionTooltip],
  );

  useEffect(() => {
    document.addEventListener('mouseup', onDocumentMouseUp);
    return () => document.removeEventListener('mouseup', onDocumentMouseUp);
  }, [onDocumentMouseUp]);

  const onMouseMovePage = useCallback(
    (e: MouseEvent) => {
      // Don't show mini-tooltip when dragging selection or it will repeatedly disappear and appear
      // as cursor enters and leaves selection
      if (e.buttons === 1 || wasMiniTooltipClicked || isSelectionInEditableElement()) {
        return;
      }

      const selection = getSelection()!;
      let rect;
      if (
        isSelectionHovered &&
        !!selectionRect &&
        !!miniTooltipRect &&
        isMouseBetweenRects(e, selectionRect, miniTooltipRect)
      ) {
        // Do nothing
      } else if (
        selectionExists(selection) &&
        !!(rect = getHoveredRect(e, selection.getRangeAt(0).getClientRects()))
      ) {
        setIsSelectionHovered(true);
        setMiniTooltipRect(tooltip.current!.getBoundingClientRect());
        setSelectionRect(rect);
      } else {
        setIsSelectionHovered(false);
        setMiniTooltipRect(null);
        setSelectionRect(null);
      }
    },
    [isSelectionHovered, selectionRect, miniTooltipRect, wasMiniTooltipClicked],
  );

  useEffect(() => {
    document.addEventListener('mousemove', onMouseMovePage);
    return () => document.removeEventListener('mousemove', onMouseMovePage);
  }, [onMouseMovePage]);

  const onClickSubmit = async (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    if (tempHighlight) {
      const postReq = {
        content: editorValue.replace(/<(.|\n)*?>/g, '').trim().length === 0 ? '' : editorValue,
        url: window.location.href,
        taggedUserIds: [],
        highlight: tempHighlight,
        topics: topics,
      };

      // Hide tooltip
      resetTooltip();

      // Show actual highlight when we get response from server
      sendMessageToExtension({ type: MessageType.CreatePost, post: postReq }).then(
        (res: IPostRes) => {
          if (res.success && res.post) {
            removeTempHighlight();
            addPosts(new Post(res.post), HighlightType.Default);
          } else {
            // Show that highlighting failed
            throw new ExtensionError(res.message!, 'Error creating highlight, try again!');
          }
        },
      );
    }
  };

  const onKeyDownPage = (e: KeyboardEvent) => {
    if (getOS() === OS.Mac) {
      if (e.metaKey && e.key === 'd' && selectionExists(getSelection())) {
        e.preventDefault();
        miniTooltipToTooltip();
      }
    } else {
      // Assume Windows
      if (e.ctrlKey && e.key === 'd' && selectionExists(getSelection())) {
        e.preventDefault();
        miniTooltipToTooltip();
      }
    }
  };

  useEffect(() => {
    document.addEventListener('keydown', onKeyDownPage);
    return () => document.removeEventListener('keydown', onKeyDownPage);
  }, [onKeyDownPage]);

  const onEditorChange = (
    content: string,
    delta: Delta,
    source: Sources,
    editor: UnprivilegedEditor,
  ) => {
    if (editor.getText() === '') {
      setEditorValue('');
    } else setEditorValue(content);
  };

  useEffect(() => {
    // Workaround to force Quill placeholder to change dynamically
    const editor = props.root.querySelector('.ql-editor');
    if (!!hoveredPost) {
      editor?.setAttribute('data-placeholder', 'No added note');
    } else {
      editor?.setAttribute('data-placeholder', 'Add note');
    }
  }, [hoveredPost]);

  useEffect(() => {
    // Force Quill to focus editor on render
    if (wasMiniTooltipClicked || !hoveredPost) {
      quill.current?.getEditor().focus();
      quill.current?.getEditor().setSelection(editorValue.length - 1, 0);
    }
  }, [hoveredPost, wasMiniTooltipClicked]);

  const renderTopics = useCallback((post?: Post) => {
    const pills = (post ? post.topics : topics).map((topic) => (
      <Pill
        key={topic.text}
        color={topic.color!}
        text={topic.text!}
        onClose={() => {
          setTopics(topics.slice().filter((t) => t !== topic));
        }}
        showClose={!post}
        style={{ marginBottom: '3px' }}
      />
    ));

    // if this is not our hovered post and there is no content
    console.log('user', user)
    console.log('post', post)
    console.log('\n')
    const noMargin = post?.creator.id !== user?.id && post
      && (!post?.content || post?.content.replace(/<(.|\n)*?>/g, '').trim().length === 0)

    return (
      <div
        className={`${post && (!post.topics || post.topics.length === 0) ? '' : 'TbdTooltip__TopicList'}`}
        style={noMargin ? { marginBottom: '0' } : {}}
      >
        {!post && <InputPill onSubmit={addTopic} style={{ marginBottom: '3px' }} />}
        {pills}
      </div>
    );
  }, [topics, user]);

  const renderUserInfo = (post: Post) => {
    const noTopics = !(post.topics?.length > 0)
    const noContent = !post.content || post.content.replace(/<(.|\n)*?>/g, '').trim().length === 0
    return (post && post.creator.id !== user?.id) ? (
      <div className="TroveTooltip__Profile" style={noContent && noTopics ? { marginBottom: '0' } : {}}>
        <div
          className="TroveTooltip__ProfileImg"
          style={{
            backgroundColor: post.creator.color,
            color: Color(post.creator.color).isLight() ? 'black' : 'white',
          }}
        >
          {post.creator.displayName[0]}
        </div>
        <div className="TroveTooltip__ProfileInfo">
          <div className="TroveTooltip__DisplayName">{post.creator.displayName}</div>
          <div className="TroveTooltip__Username" style={{ color: post.creator.color }}>
            {`@${post.creator.username}`}
          </div>
        </div>
      </div>
    ) : null;
  };

  const renderContent = (post: Post) => {
    const content = post.content;
    // if there is no content and this is not your note
    if ((!content 
        || content.replace(/<(.|\n)*?>/g, '').trim().length === 0
      ) && post.creator.id !== user?.id
    ) {
      return null;
    } else {
      return (
        <ReactQuill
          className="TroveTooltip__Editor TroveTooltip__Editor--readonly"
          theme="bubble"
          value={post.content}
          readOnly={true}
        />
      )
    }
  }

  if (hoveredPost) {
    // Readonly post
    return (
      <div
        className={classNames('TbdTooltip', {
          'TbdTooltip--position-above': positionEdge === Edge.Top,
          'TbdTooltip--position-below': positionEdge === Edge.Bottom,
          'TbdTooltip--readonly': true,
        })}
        style={{ transform: `translate3d(${position.x}px, ${position.y}px, 0px)` }}
      >
        {renderUserInfo(hoveredPost)}
        {renderTopics(hoveredPost)}
        {renderContent(hoveredPost)}
        {/* <div className="TbdTooltip__ButtonList">
          <button className="TbdTooltip__RemoveButton" onClick={onClickRemove} />
        </div> */}
      </div>
    );
  } else if (isSelectionHovered || isTempHighlightVisible) {
    // Mini-tooltip/tooltip editor
    return !wasMiniTooltipClicked ? (
      <div
        className={classNames('TroveMiniTooltip', {
          'TbdTooltip--position-above': positionEdge === Edge.Top,
          'TbdTooltip--position-below': positionEdge === Edge.Bottom,
        })}
        style={{ transform: `translate3d(${position.x}px, ${position.y}px, 0px)` }}
        ref={tooltip}
      >
        <div className="TroveMiniTooltip__Logo"></div>
        <button className="TroveMiniTooltip__NewPostButton" onClick={miniTooltipToTooltip}>
          <p className="TroveMiniTooltip__NewPostButton__PrimaryText">New post</p>
          <p className="TroveMiniTooltip__NewPostButton__SecondaryText">{`(${
            getOS() === OS.Windows ? 'ctrl' : 'cmd'
          }+d)`}</p>
        </button>
      </div>
    ) : (
      <div
        className={classNames('TbdTooltip', {
          'TbdTooltip--position-above': positionEdge === Edge.Top,
          'TbdTooltip--position-below': positionEdge === Edge.Bottom,
        })}
        style={{ transform: `translate3d(${position.x}px, ${position.y}px, 0px)` }}
        ref={tooltip}
      >
        {renderTopics()}
        <ReactQuill
          className="TroveTooltip__Editor"
          theme="bubble"
          value={editorValue}
          onChange={onEditorChange}
          placeholder="Add note"
          ref={quill}
        />
        <button className="TbdTooltip__SubmitButton" onClick={onClickSubmit} />
      </div>
    );
  } else {
    return null;
  }
}
