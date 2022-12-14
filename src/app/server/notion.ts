import { api, AxiosRes, BaseRes } from '.';
import { getCookie } from '../../utils/chrome/cookies';
import { get1 } from '../../utils/chrome/storage';
import { Record } from '../notionTypes';
import { PropertyUpdate } from '../notionTypes/dbUpdate';
import { SchemaValue } from '../notionTypes/schema';

export type ISchemaRes = SchemaRes & AxiosRes;
export type IGetPageNamesRes = GetPageNamesRes & AxiosRes;
export type ISearchPagesRes = SearchPagesRes & AxiosRes;

export const getNotionPages = async (
  spaceId?: string | null,
  recentIds?: string[] | null,
  userId?: string,
): Promise<IGetPageNamesRes> => {
  const notionToken = await getCookie('https://www.notion.so', 'token_v2');
  const notionUserId = await get1('notionUserId');
  const config = { headers: { 'notion-token': notionToken } };
  if (userId) config.headers['x-notion-active-user-header'] = userId;
  else if (notionUserId) config.headers['x-notion-active-user-header'] = notionUserId;
  const args: GetPageNamesReqBody = {
    ...(spaceId ? { spaceId } : {}),
    ...(recentIds ? { recentIds } : {}),
  };
  return await api.post('/notion/getPages', args, config);
};

export const searchNotionPages = async (
  query: string,
  spaceId: string,
  limit?: number,
): Promise<ISearchPagesRes> => {
  const notionToken = await getCookie('https://www.notion.so', 'token_v2');
  const notionUserId = await get1('notionUserId');
  const config = { headers: { 'notion-token': notionToken } };
  if (notionUserId) config.headers['x-notion-active-user-header'] = notionUserId;
  const args: SearchPagesReqBody = { query, spaceId, limit };
  return await api.post('/notion/search', args, config);
};

export const addTextToNotion = async (
  pageId: string,
  textChunks: string[] | any[],
): Promise<AxiosRes> => {
  const notionToken = await getCookie('https://www.notion.so', 'token_v2');
  const notionUserId = await get1('notionUserId');
  const config = { headers: { 'notion-token': notionToken } };
  if (notionUserId) config.headers['x-notion-active-user-header'] = notionUserId;
  const data: WriteTextReqBody = { userId: notionUserId, pageId, textChunks };
  return await api.post('/notion/writeText', data, config);
};

export const getDBSchema = async (dbId: string): Promise<ISchemaRes> => {
  const notionToken = await getCookie('https://www.notion.so', 'token_v2');
  const notionUserId = await get1('notionUserId');
  const config = { headers: { 'notion-token': notionToken } };
  if (notionUserId) config.headers['x-notion-active-user-header'] = notionUserId;
  const data: GetSchemaReqBody = { pageId: dbId };
  return await api.post('/notion/getSchema', data, config);
};

export const addEntryToDB = async (
  dbId: string,
  updates: PropertyUpdate[],
  textChunks: string[] | unknown[],
): Promise<AxiosRes> => {
  const notionToken = await getCookie('https://www.notion.so', 'token_v2');
  const notionUserId = await get1('notionUserId');
  const config = { headers: { 'notion-token': notionToken } };
  if (notionUserId) config.headers['x-notion-active-user-header'] = notionUserId;
  const data: AddRowReqBody = { pageId: dbId, userId: notionUserId, updates, textChunks };
  return await api.post('/notion/addRow', data, config);
};

/**
 * POST /notion/writeText
 */
export interface WriteTextReqBody {
  userId: string;
  pageId: string;
  textChunks: string[] | any[];
}

/**
 * POST /notion/getPages
 */
export interface GetPageNamesReqBody {
  spaceId?: string;
  recentIds?: string[];
}

/**
 * POST /notion/search
 */
export interface SearchPagesReqBody {
  limit?: number;
  query: string;
  spaceId: string;
}

/**
 * POST /notion/getSchema
 */
type GetSchemaReqBody = {
  pageId: string;
};

/**
 * POST /notion/addRow
 */
type AddRowReqBody = {
  userId: string;
  pageId: string;
  updates: PropertyUpdate[];
  textChunks: string[] | unknown[];
};

/**
 * POST /notion/getPages
 */
type GetPageNamesRes = {
  userId: string;
  email: string;
  spaces?: Array<Record>;
  results?: {
    [spaceId: string]: {
      recents?: Record[];
      pages?: Record[];
      databases?: Record[];
    };
  };
  defaults?: {
    [spaceId: string]: Record;
  };
} & BaseRes;

/**
 * POST /notion/search
 */
type SearchPagesRes = {
  spaceId?: string;
  pages?: Record[];
  databases?: Record[];
} & BaseRes;

/**
 * POST /notion/getSchema
 */
export type SchemaRes = {
  schema: Array<SchemaValue>;
  isSupported: boolean;
} & BaseRes;
