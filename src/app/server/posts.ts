import { api, AxiosRes, BaseParams, BaseRes } from '.';
import { TextRange } from '../../components/TooltipWrapper/Tooltip/helpers/highlight/textRange';
import IPost from '../../models/IPost';
import ITopic from '../../models/ITopic';
import IUser from '../../models/IUser';
import { get1 } from '../../utils/chrome/storage';
import { IUserRes } from './users';

export type IPostsRes = PostsRes & AxiosRes;
export type IPostRes = PostRes & AxiosRes;

export const getPosts = async (url: string): Promise<IPostsRes | IUserRes> => {
  const userId = (await get1('user')).id;
  const args: GetPostsReqBody = { url, userId };
  return await api.post('/posts/', args);
};

export const getPost = async (postId: string): Promise<IPostRes> => {
  const params: BaseParams = { id: postId };
  return await api.get(`/posts/${params.id}`);
};

export const createPosts = async (args: CreatePostsReqBody): Promise<IPostsRes> => {
  return await api.post('/posts/create', args);
};

export const createComment = async (
  parentPostId: string,
  args: CreateCommentReqBody,
): Promise<IPostRes> => {
  const params: BaseParams = { id: parentPostId };
  return await api.post(`/posts/${params.id}/comment/create`, args);
};

export const deletePostAndChildren = async (postId: string): Promise<AxiosRes> => {
  const params: BaseParams = { id: postId };
  return await api.get(`/posts/${params.id}/delete`);
};

export const editPost = async (postId: string, args: EditPostReqBody): Promise<AxiosRes> => {
  const params: BaseParams = { id: postId };
  return await api.post(`/posts/${params.id}/update`, args);
};

export const likePost = async (postId: string): Promise<AxiosRes> => {
  const params: BaseParams = { id: postId };
  return await api.get(`/posts/${params.id}/like/create`);
};

export const unlikePost = async (postId: string): Promise<AxiosRes> => {
  const params: BaseParams = { id: postId };
  return await api.get(`/posts/${params.id}/like/delete`);
};

/**
 * POST /posts/
 * Getting posts for a url versus your posts
 * Args narrow scope of posts. If no args, returns all of your posts
 * If url, then all posts on url
 * If url and userId or username, all posts for the specified user
 */
type GetPostsReqBody = {
  url?: string;
  userId?: string;
  username?: string; // same filtering effect as above, if you want to search by username
};

/**
 * POST /posts/create
 */
export type PostReqBody = {
  url: string;
  highlight: HighlightParam;
  content?: string;
  // topics?: Partial<Topic>[];
};

export interface CreatePostsReqBody {
  posts: Array<PostReqBody>;
}

export type HighlightParam = {
  textRange: TextRange; // Serialized Range object
  url: string;
};

/**
 * POST /posts/:id/comment/create
 */
export interface CreateCommentReqBody {
  content: string;
  url: string;
  taggedUserIds?: string[]; // if you tag someone, they can see this post and tag others
  textRange: TextRange;
  topics?: Partial<ITopic>[];
}

/**
 * POST /posts/:id/update
 */
interface EditPostReqBody {
  content?: string;
  taggedUserIds?: string[];
  topics?: Partial<ITopic>[];
}

/** ************************* */
/** ********** RES ********** */
/** ************************* */

/**
 * POST /posts/
 */
type PostsRes = {
  posts?: IPost[]; // does not include comments for each post
  taggedPosts?: IPost[]; // does not include comments for each post
  user?: IUser;
} & BaseRes;

/**
 * GET /posts/:id
 * POST /posts/create
 * POST /posts/:id/comment/create
 */
type PostRes = {
  thread?: IPost[]; // first index is parent ([parent, child, child of child, ...])
  post?: IPost; // includes comments
} & BaseRes;
