import { api, AxiosRes, BaseParams, BaseRes } from '.';
import IUser from '../models/IUser';
import { get } from '../utils/chrome/storage';

export type IUsersRes = UsersRes & AxiosRes;
export type IUserRes = UserRes & AxiosRes;

export const handleUsernameSearch = async (searchText: string): Promise<IUsersRes> => {
  const args: GetUsersReqBody = { username: searchText }
  return await api.post(`/users`, args);
}

export const getUser = async (id: string): Promise<IUserRes> => {
  const params: UserReqParams = { id }
  return await api.get(`/users/${params.id}`);
}

export const updateDisplayName = async (displayName: string): Promise<IUserRes> => {
  const params: UserReqParams = { id: (await get('user')).user.id };
  const args: UpdateUserReqBody = { displayName }
  return await api.post(`/users/${params.id}/update`, args);
}

export const updateUsername = async (username: string): Promise<IUserRes> => {
  const params: UserReqParams = { id: (await get('user')).user.id };
  const args: UpdateUserReqBody = { username }
  return await api.post(`/users/${params.id}/update`, args);
}

export const updateColor = async (color: string): Promise<IUserRes> => {
  const params: UserReqParams = { id: (await get('user')).user.id };
  const args: UpdateUserReqBody = { color }
  return await api.post(`/users/${params.id}/update`, args);
}

/**
 * POST /users/
 */
interface GetUsersReqBody {
  username: string;
}

/**
 * POST /users/:id/update
 */
interface UpdateUserReqBody {
  color?: string; // Hex code
  displayName?: string;
  email?: string; // either email, or phoneNumber
  phoneNumber?: string;
  username?: string; // alphanum and underscores, 3 < username < 20 characters
}

/**
 * GET /users/:id
 * POST /users/:id/update
 */
interface UserReqParams extends BaseParams {
  id: string;
}

/**
 * POST /users/
 */
type UsersRes = {
  users: IUser[];
} & BaseRes;

/**
 * GET /users/:id
 * POST /users/:id/update
 */
type UserRes = {
  user?: IUser;
} & BaseRes;
