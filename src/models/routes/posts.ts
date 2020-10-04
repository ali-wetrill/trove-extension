import { BaseParams, BaseRes } from '.';
import { Highlight } from '../entities/Highlight';
import { Post } from '../entities/Post';

/**
 * ROUTES for /posts
 *
 * POST /
 * POST /create
 * GET /:id
 */

/** ************************* */
/** ********** REQ ********** */
/** ************************* */

/**
 * POST /
 */
export interface GetPostsReqBody {
  userId: string;
  url: string;
}

/**
 * POST /create
 */
export interface CreatePostReqBody {
  content: string;
  creatorUserId: string;
  taggedUserIds: string[];
  highlight: Highlight;
  url: string;
}

/**
 * GET /:id
 */
export interface GetPostReqParams extends BaseParams {
  id: string;
}

/** ************************* */
/** ********** RES ********** */
/** ************************* */

/**
 * POST /
 */
export type PostsRes = {
  posts?: Post[];
} & BaseRes;

/**
 * POST /
 * GET /:id
 */
export type PostRes = {
  post?: Post;
} & BaseRes;
