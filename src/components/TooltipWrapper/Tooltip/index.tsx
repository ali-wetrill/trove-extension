import { DeleteOutlined, ExportOutlined, LoadingOutlined } from '@ant-design/icons';
import classNames from 'classnames';
import React, { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import ReactTooltip from 'react-tooltip';
import { v4 as uuid } from 'uuid';
import { AxiosRes } from '../../../app/server/';
import { HighlightParam, IPostRes, IPostsRes } from '../../../app/server/posts';
import { ORIGIN } from '../../../config/config.prod';
import ExtensionError from '../../../entities/ExtensionError';
import Post from '../../../entities/Post';
import User from '../../../entities/User';
import ITopic from '../../../models/ITopic';
import { hexToRgba, toArray } from '../../../utils';
import { get } from '../../../utils/chrome/storage';
import { MessageType, sendMessageToExtension } from '../../../utils/chrome/tabs';
import Content from '../../content';
import TextareaEditor from './Editor';
import Edge from './helpers/Edge';
import Highlighter, { HighlightType } from './helpers/highlight/Highlighter';
import { getRangeFromTextRange, getTextRangeFromRange } from './helpers/highlight/textRange';
import { getOsKeyChar, isOsKeyPressed } from './helpers/os';
import Point from './helpers/Point';
import ListReducer, { ListReducerActionType } from './helpers/reducers/ListReducer';
import {
  getHoveredRect,
  isMouseBetweenRects,
  isSelectionInEditableElement,
  selectionExists,
} from './helpers/selection';
import InputPill from './inputPill';
import NewComment from './NewComment';
import Pill from './pill';
import UserInfo from './userInfo';

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
  const [user, setUser] = useState<User | null>(null);

  const [hoveredPost, setHoveredPost] = useState<Post | null>(null);
  const [hoveredPostBuffer, setHoveredPostBuffer] = useState<Post | null>(null);
  const [isSelectionHovered, setIsSelectionHovered] = useState(false);
  const [optionsHovered, setOptionsHovered] = useState(false);
  const [likeIconHovered, setLikeIconHovered] = useState(false);
  const [commentIconHovered, setCommentIconHovered] = useState(false);
  const [goToPostHovered, setGoToPostHovered] = useState(false);

  const [hoveredPostLiked, setHoveredPostLiked] = useState(false);
  const [showNewComment, setShowNewComment] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [hoveredPostRect, setHoveredPostRect] = useState<DOMRect | null>(null);
  const [tooltipRect, setTooltipRect] = useState<DOMRect | null>(null);
  const [tooltipCloseFn, setTooltipCloseFn] = useState<((arg?: boolean) => void) | null>(null);

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
  const [topics, setTopics] = useState<Partial<ITopic>[]>([]);
  const postOptionsBar = useRef<HTMLDivElement | null>(null);
  const postOptionDelete = useRef<HTMLDivElement | null>(null);
  const postOptionGoToPost = useRef<HTMLDivElement | null>(null);
  const postOptionEdit = useRef<HTMLDivElement | null>(null);
  const editor = useRef<HTMLTextAreaElement>(null!);

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
    setShowNewComment(false);
    setHoveredPostLiked(hoveredPostBuffer?.liked || false);
    setShowOptions(false);
    positionTooltip();
    setHoveredPost(hoveredPostBuffer);
  }, [hoveredPostBuffer]);

  /**
   * Handler for when mouse cursor enters a Trove mark element. A highlight can be composed of
   * multiple marks, which can each have multiple client rects.
   * TODO: Maybe move active highlight logic to highlighter?
   */
  const onMarkMouseEnter = useCallback(
    (e: MouseEvent, post: Post, mark: HTMLElement) => {
      // Don't trigger mouseenter event if user is selecting text (left mouse button down)
      if (!post.highlight || e.buttons === 1) return;
      highlighter.modifyHighlightTemp(HighlightType.Default);
      highlighter.modifyHighlight(post.highlight.id, HighlightType.Active);

      // Encountered a new mark before having left the last one
      if (hoveredPostBuffer) {
        if (hoveredPostBuffer.id !== post.id && tooltipCloseFn) {
          // Make sure we exit from the previous highlight
          tooltipCloseFn();
        } else if (hoveredPostBuffer.id === post.id) {
          // Do nothing because we are passing between two marks of the same highlight
          return;
        }
      }

      // Have to wrap anonymous function in another function to prevent React from computing it
      // immediately: https://medium.com/swlh/how-to-store-a-function-with-the-usestate-hook-in-react-8a88dd4eede1
      setTooltipCloseFn(() => () => {
        if (!post.highlight) return;
        highlighter.modifyHighlight(post.highlight.id, HighlightType.Default);
        highlighter.modifyHighlightTemp(HighlightType.Active);
        setTooltipRect(null);
        setHoveredPostBuffer(null);
        setHoveredPost(null);
        setTooltipCloseFn(null);
        setHoveredPostRect(null);
      });
      setTooltipRect(null);
      setHoveredPostRect(getHoveredRect(e, mark.getClientRects()));
      setHoveredPostBuffer(post);
    },
    [highlighter, hoveredPostBuffer, tooltipCloseFn],
  );

  /**
   * Attach handlers to highlights. We don't need to return a cleanup function since we're using
   * the .onevent notation (as opposed to addEventListener) to add the listeners, which only
   * accepts one event at a time. We have to include posts as a dependency to add handler to new
   * posts on page.
   * TODO: don't refresh handlers on already existing highlights
   */
  useEffect(() => {
    highlighter.highlights.forEach((highlight, id) => {
      for (const mark of highlight.marks) {
        mark.onmouseenter = (e: MouseEvent) => onMarkMouseEnter(e, highlight.post, mark);
      }
    });
  }, [posts, onMarkMouseEnter]);

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
  const addTempHighlight = useCallback(() => {
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
      highlighter.addHighlightTemp(range, user?.color, HighlightType.Active);
      setIsTempHighlightVisible(true);

      // Recalculate range after adding highlight because range may have shifted. Handles case
      // where highlight starts from offset 0, which would otherwise cause previously calculated
      // range to collapse.
      const newRange = getRangeFromTextRange(textRange);
      setTempHighlightRange(newRange);

      selection.removeAllRanges();
    }
  }, [user]);

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
    ReactTooltip.rebuild();

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

  /**
   * Handle transition between mini-tooltip and editor tooltip.
   */
  const miniTooltipToTooltip = useCallback(() => {
    // Allow transition if selection exists with at least one non-whitespace character
    const selection = getSelection()!;
    if (selectionExists(selection) && /\S/.test(selection.toString())) {
      addTempHighlight();
      setWasMiniTooltipClicked(true);
    }
  }, [addTempHighlight]);

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
      let rect;
      if (
        hoveredPost &&
        !!hoveredPostRect &&
        !!tooltipRect &&
        isMouseBetweenRects(e, hoveredPostRect, tooltipRect)
      ) {
        // Do nothing
        return;
      } else if (hoveredPostBuffer !== hoveredPost) {
        // Waiting for React hook to update hoveredPost
        return;
      } else if (
        hoveredPost &&
        !!hoveredPostRect &&
        !!tooltipRect &&
        !isMouseBetweenRects(e, hoveredPostRect, tooltipRect) &&
        tooltipCloseFn
      ) {
        // Exiting tooltip from hovered post
        tooltipCloseFn();
      } else if (hoveredPost && !tooltipRect) {
        // Calculate and set tooltip rect, this should happen once
        setTooltipRect(tooltip.current!.getBoundingClientRect());
        return;
      }

      // Don't show mini-tooltip when dragging selection or it will repeatedly disappear and appear
      // as cursor enters and leaves selection
      if (e.buttons === 1 || wasMiniTooltipClicked || isSelectionInEditableElement()) {
        return;
      }

      const selection = getSelection()!;
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
    [
      hoveredPost,
      hoveredPostBuffer,
      hoveredPostRect,
      tooltipRect,
      tooltipCloseFn,
      isSelectionHovered,
      selectionRect,
      miniTooltipRect,
      wasMiniTooltipClicked,
    ],
  );

  useEffect(() => {
    document.addEventListener('mousemove', onMouseMovePage);
    return () => document.removeEventListener('mousemove', onMouseMovePage);
  }, [onMouseMovePage]);

  const onClickSubmit = async (e?: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    ReactTooltip.hide();

    if (tempHighlight) {
      const postReq = {
        content: editorValue,
        url: window.location.href,
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
            console.error('Failed to create post:', res.message);
            throw new ExtensionError(res.message!, 'Error creating highlight, try again!');
          }
        },
      );
    }
  };

  const onKeyDownPage = useCallback(
    (e: KeyboardEvent) => {
      // Handle case where user logs out or turns ext off, but page isn't refreshed
      if (!isAuthenticated || !isExtensionOn) {
        return;
      }

      // Keyboard shortcuts
      if (isOsKeyPressed(e) && e.key === 'd') {
        // New post on current selection
        e.preventDefault();
        miniTooltipToTooltip();
      }
    },
    [isAuthenticated, isExtensionOn, miniTooltipToTooltip],
  );

  useEffect(() => {
    document.addEventListener('keydown', onKeyDownPage);
    return () => document.removeEventListener('keydown', onKeyDownPage);
  }, [onKeyDownPage]);

  const onEditorChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditorValue(event.target.value);
  };

  const handleLike = async (e: React.MouseEvent<HTMLDivElement, MouseEvent>, post: Post) => {
    e.stopPropagation();
    setHoveredPostLiked(true);
    await post.likePost();
  };

  const handleUnlike = async (e: React.MouseEvent<HTMLDivElement, MouseEvent>, post: Post) => {
    e.stopPropagation();
    setHoveredPostLiked(false);
    await post.unlikePost();
  };

  const renderLikeIconPath = (post: Post) => {
    if (post.liked) return chrome.extension.getURL('images/heartFilled.png');
    else if (likeIconHovered) return chrome.extension.getURL('images/heartOutlined.png');
    else return chrome.extension.getURL('images/heart.png');
  };

  const renderCommentIconPath = () => {
    if (commentIconHovered) return chrome.extension.getURL('images/commentOutlined.png');
    else return chrome.extension.getURL('images/comment.png');
  };

  const handleShowComment = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    e.stopPropagation();
    setShowNewComment(true);
  };

  useEffect(() => {
    if (tooltip.current) setTooltipRect(tooltip.current.getBoundingClientRect());
  }, [showNewComment]);

  const handleCreateComment = async (content: string, parentPost: Post) => {
    return sendMessageToExtension({
      type: MessageType.CreateComment,
      parentPostId: parentPost.id,
      comment: { url: parentPost.url, content },
    }).then((res: IPostRes) => {
      if (res.success) {
        const comment = new Post(res.post!);
        parentPost.addComment(comment);
        dispatch({ type: ListReducerActionType.Update, data: parentPost });
        setShowNewComment(false);
      }
      return res;
    });
  };

  const handleDeletePost = async (e: React.MouseEvent<HTMLSpanElement, MouseEvent>, post: Post) => {
    e.stopPropagation();
    setDeleteLoading(true);
    const res = (await sendMessageToExtension({
      type: MessageType.DeletePost,
      id: post.id,
    })) as AxiosRes;
    if (res.success) {
      if (tooltipCloseFn) tooltipCloseFn();
      removePosts(post);
      setShowOptions(false);
      setDeleteLoading(false);
    }
  };

  const toggleOptions = useCallback(
    (e: any) => {
      e.stopPropagation();
      const clickedMenuBar = postOptionsBar.current?.isSameNode(e.target);
      const clickedDelete = postOptionDelete.current?.isSameNode(e.target);
      const clickedGoToPost = postOptionGoToPost.current?.isSameNode(e.target);
      const clickedEdit = postOptionEdit.current?.isSameNode(e.target);
      if (clickedMenuBar) {
        setShowOptions(!showOptions);
      } else if (!clickedDelete && !clickedEdit && !clickedGoToPost) {
        setShowOptions(false);
      }
    },
    [showOptions],
  );

  useEffect(() => {
    document.addEventListener('click', toggleOptions);
    return () => document.removeEventListener('click', toggleOptions);
  }, [toggleOptions]);

  const goToPost = async (
    e: React.MouseEvent<HTMLSpanElement, MouseEvent>,
    username: string,
    postId: string,
  ) => {
    e.stopPropagation();
    await sendMessageToExtension({
      type: MessageType.OpenTab,
      url: `${ORIGIN}/${username}/${postId}`,
      active: true,
    });
  };

  /**
   * Render list of topics. A given post indicates we are rendering for a hovered post which is
   * read-only and therefor doesn't need a input pill. No post indicates we must show topics for
   * editor.
   */
  const renderTopics = useCallback(
    (post?: Post) => {
      const pills = (post ? post.topics : topics).map((topic) => (
        <Pill
          key={topic.text}
          color={topic.color!}
          text={topic.text!}
          onClose={() => {
            setTopics(topics.slice().filter((t) => t !== topic));
          }}
          showClose={!post}
          style={{ marginTop: '3px' }}
        />
      ));

      return post && (!post.topics || post.topics.length === 0) ? null : (
        <div className="TbdTooltip__TopicList" style={post ? { marginTop: '7px' } : {}}>
          {!post && <InputPill onSubmit={addTopic} style={{ marginTop: '3px' }} />}
          {pills}
        </div>
      );
    },
    [topics],
  );

  const renderOptions = (post: Post) => {
    return (
      <div
        className="TroveTooltip__OptionsWrapper"
        onClick={(e) => toggleOptions(e)}
        style={{
          ...(post.creator.id !== user?.id ? { display: 'none' } : {}),
        }}
      >
        <div
          className={`TroveTooltip__Options ${
            optionsHovered ? 'TroveTooltip__Options--hovered' : ''
          }`}
          ref={postOptionsBar}
          onMouseEnter={() => setOptionsHovered(true)}
          onMouseLeave={() => setOptionsHovered(false)}
        >
          ···
        </div>
        {showOptions && (
          <div className="TroveTooltip__OptionsMenu">
            <span
              className="TroveTooltip__Options--option"
              style={{ color: 'rgb(224, 36, 94)' }}
              onClick={(e) => handleDeletePost(e, post)}
              ref={postOptionDelete}
            >
              <div className="TroveTooltip__Options--icon">
                {deleteLoading ? <LoadingOutlined /> : <DeleteOutlined />}
              </div>
              Delete
            </span>
            {/* <span
              className="TroveTooltip__Options--option"
              onClick={(e) => goToPost(e, post.creator.username, post.id)}
              ref={postOptionGoToPost}
            >
              <div className="TroveTooltip__Options--icon">
                <ExportOutlined />
              </div>
              Go to post
            </span> */}
            {/* <span
              className="TroveTooltip__Options--option"
              onClick={handleEditPost}
              ref={postOptionEdit}
            >
              <div className="TroveTooltip__Options--icon">
                <EditOutlined />
              </div>
              Edit
            </span> */}
          </div>
        )}
      </div>
    );
  };

  const renderReactionBar = (post: Post) => {
    const renderReaction = (
      icon: string,
      num: number,
      onClick: (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => void,
      hovered: boolean,
      setHovered: React.Dispatch<React.SetStateAction<boolean>>,
      color: string, // hex
      iconClassName: string,
      iconWrapperClassName: string,
      alreadySelected?: boolean,
    ) => {
      return (
        <div
          className="TroveTooltip__Reaction"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onClick={onClick}
        >
          <span
            className={`TroveTooltip__IconWrapper ${iconWrapperClassName}`}
            style={hovered ? { backgroundColor: hexToRgba(color, 0.15) || undefined } : {}}
          >
            <img className={`TroveTooltip__Icon ${iconClassName}`} src={icon} alt="r" />
          </span>
          <span
            className="TroveTooltip__NumReaction"
            style={hovered || alreadySelected ? { color } : {}}
          >
            {num}
          </span>
        </div>
      );
    };

    return (
      <div className="TroveTooltip__ReactionBar">
        {renderReaction(
          renderLikeIconPath(post),
          post.numLikes,
          (e) => {
            hoveredPostLiked ? handleUnlike(e, post) : handleLike(e, post);
          },
          likeIconHovered,
          setLikeIconHovered,
          '#e0245e',
          'TroveTooltip__LikeIcon',
          'TroveTooltip__LikeIconWrapper',
          hoveredPostLiked,
        )}
        <div>
          {renderReaction(
            renderCommentIconPath(),
            post.numComments,
            (e) => handleShowComment(e),
            commentIconHovered,
            setCommentIconHovered,
            '#0d77e2',
            'TroveTooltip__CommentIcon',
            'TroveTooltip__CommentIconWrapper',
          )}
        </div>
        <div
          className="TroveTooltip__Reaction"
          onMouseEnter={() => setGoToPostHovered(true)}
          onMouseLeave={() => setGoToPostHovered(false)}
          onClick={(e) => goToPost(e, post.creator.username, post.id)}
        >
          <span
            className="TroveTooltip__IconWrapper TroveTooltip__GoToPostWrapper"
            style={goToPostHovered ? { backgroundColor: 'rgba(13, 119, 226, 0.15)' } : {}}
            data-tip={`
            <div class="TroveHint__Content--gotopost">
              <p class="TroveHint__Content__PrimaryText">Go to post</p>
            </div>
          `}
          >
            <span
              className="TroveTooltip__GoToPostIcon"
              style={goToPostHovered ? { color: 'rgba(13, 119, 226, 0.5)' } : {}}
            >
              <ExportOutlined />
            </span>
          </span>
          <ReactTooltip
            className="TroveTooltip__Hint"
            effect="solid"
            arrowColor="transparent"
            html={true}
            delayShow={250}
          />
        </div>
      </div>
    );
  };

  const renderNewComment = (post: Post) => {
    if (!user) return;
    return (
      <div className="TrovePost__CommentWrapper">
        <NewComment
          user={user}
          creator={post.creator}
          onCancel={() => setShowNewComment(false)}
          onSubmit={(text) => handleCreateComment(text, post)}
        />
      </div>
    );
  };

  if (!!hoveredPost) {
    // Readonly post
    return (
      <div
        className={classNames('TbdTooltip', {
          'TbdTooltip--position-above': positionEdge === Edge.Top,
          'TbdTooltip--position-below': positionEdge === Edge.Bottom,
          'TbdTooltip--readonly': true,
        })}
        style={{ transform: `translate3d(${position.x}px, ${position.y}px, 0px)` }}
        ref={tooltip}
      >
        <div className="TroveTooltip__PostWrapper">
          <div className="TbdTooltip__Header">
            <UserInfo user={hoveredPost.creator} />
            {renderOptions(hoveredPost)}
          </div>
          {renderTopics(hoveredPost)}
          {hoveredPost.content && (
            <div className="TroveTooltip__TextContent">
              <Content value={hoveredPost.content} taggedUsers={hoveredPost.taggedUsers || []} />
            </div>
          )}
          {renderReactionBar(hoveredPost)}
        </div>
        {showNewComment && renderNewComment(hoveredPost)}
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
        <button className="TroveMiniTooltip__NewPostButton" onClick={miniTooltipToTooltip}>
          <div className="TroveMiniTooltip__Logo"></div>
          <p className="TroveMiniTooltip__NewPostButton__PrimaryText">New post</p>
          <p className="TroveMiniTooltip__NewPostButton__SecondaryText">{`(${getOsKeyChar()}+d)`}</p>
        </button>
      </div>
    ) : (
      <>
        <div
          className={classNames('TbdTooltip', {
            'TbdTooltip--position-above': positionEdge === Edge.Top,
            'TbdTooltip--position-below': positionEdge === Edge.Bottom,
          })}
          style={{ transform: `translate3d(${position.x}px, ${position.y}px, 0px)` }}
          ref={tooltip}
        >
          <div className="TroveTooltip__PostWrapper">
            {renderTopics()}
            <div className="TroveTooltip__TextContent">
              <TextareaEditor
                value={editorValue}
                onChange={onEditorChange}
                outsideRef={editor}
                setText={setEditorValue}
                submit={onClickSubmit}
              />
            </div>
            <button
              className="TroveTooltip__SubmitButton"
              onClick={onClickSubmit}
              data-tip={`
                <div class="TroveHint__Content">
                  <p class="TroveHint__Content__PrimaryText">Submit</p>
                  <p class="TroveHint__Content__SecondaryText">(${getOsKeyChar()}+Enter)</p>
                </div>
              `}
            />
          </div>
        </div>
        <ReactTooltip
          className="TroveTooltip__Hint"
          effect="solid"
          arrowColor="transparent"
          html={true}
          delayShow={250}
        />
      </>
    );
  } else {
    return null;
  }
}
