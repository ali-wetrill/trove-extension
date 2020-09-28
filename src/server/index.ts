import axios from 'axios';
import { AuthRes, ForgotReqBody, GetUserReqParams, GetUsersReqBody, LoginReqBody, SignupReqBody, UpdateUserReqBody, UpdateUserReqParams, UsernameReqBody, UsernameRes, UserRes, UsersRes } from '../models';
import { get } from '../utils/chrome/storage';

// "http://localhost:5000/*" -> add to manifest.json for testing locally

const api = axios.create({
    baseURL: process.env.REACT_APP_BACKEND_URL,
    timeout: 2000,
    headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config) => {
  const token = (await get('token')).token;
  token ? config.headers.Authorization = `bearer ${token}` : null;
  return config;
});

api.interceptors.response.use((response) => {
  // (200-299)
  response.data.success = true;
  return response.data;
}, (error) => {
  // outside of (200-299)
  error.response.data.success = false;
  const errorMessage = error.response.data.message
  if (!errorMessage) error.response.data.message = error.message;
  return error.response.data;
});

/**
 * /auth
 */
export const signup = async (args: SignupReqBody): Promise<AuthRes> => {
  return await api.post(`/auth/signup`, args);
};

export const login = async (args: LoginReqBody): Promise<AuthRes> => {
  return await api.post(`/auth/login`, args);
}

export const forgotPassword = async (args: ForgotReqBody): Promise<AuthRes> => {
  return await api.post(`/auth/forgot`, args)
}

export const checkValidUsername = async (username: string): Promise<UsernameRes> => {
  const args: UsernameReqBody = { username }
  return await api.post(`/auth/username`, args);
}

/**
 * /users
 */
export const handleUsernameSearch = async (searchText: string): Promise<UsersRes> => {
  const args: GetUsersReqBody = { username: searchText }
  return await api.post(`/users`, args);
}

export const getUser = async (id: string): Promise<UserRes> => {
  const params: GetUserReqParams = { id }
  return await api.get(`/users/${params.id}`);
}

export const updateDisplayName = async (displayName: string): Promise<UserRes> => {
  const params: UpdateUserReqParams = { id: (await get('user')).user.id };
  const args: UpdateUserReqBody = { displayName }
  return await api.post(`/users/${params.id}/update`, args);
}

export const updateUsername = async (username: string): Promise<UserRes> => {
  const params: UpdateUserReqParams = { id: (await get('user')).user.id };
  const args: UpdateUserReqBody = { username }
  return await api.post(`/users/${params.id}/update`, args);
}

export const updateColor = async (color: string): Promise<UserRes> => {
  const params: UpdateUserReqParams = { id: (await get('user')).user.id };
  const args: UpdateUserReqBody = { color }
  return await api.post(`/users/${params.id}/update`, args);
}

export const updateEmail = async (email: string): Promise<UserRes> => {
  const params: UpdateUserReqParams = { id: (await get('user')).user.id };
  const args: UpdateUserReqBody = { email }
  return await api.post(`/users/${params.id}/update`, args);
}

export const updatePhoneNumber = async (phoneNumber: number): Promise<UserRes> => {
  const params: UpdateUserReqParams = { id: (await get('user')).user.id };
  const args: UpdateUserReqBody = { phoneNumber }
  return await api.post(`/users/${params.id}/update`, args);
}
