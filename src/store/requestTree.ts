import { v4 as uuidv4 } from 'uuid';
import { ApiRequest, RequestFolder, HttpMethod } from '../types';

export const createDefaultRequest = (overrides?: Partial<ApiRequest>): ApiRequest => ({
  id: uuidv4(),
  name: 'New Request',
  method: 'GET' as HttpMethod,
  url: '',
  headers: [],
  params: [],
  body: { type: 'none' },
  auth: { type: 'none' },
  preScript: '',
  script: '',
  ...overrides,
});

export const findAndUpdateRequest = (
  folders: RequestFolder[],
  requests: ApiRequest[],
  requestId: string,
  updates: Partial<ApiRequest>
): { folders: RequestFolder[]; requests: ApiRequest[]; found: boolean } => {
  // Check in requests array
  const reqIndex = requests.findIndex(r => r.id === requestId);
  if (reqIndex !== -1) {
    const updatedRequests = [...requests];
    updatedRequests[reqIndex] = { ...updatedRequests[reqIndex], ...updates };
    return { folders, requests: updatedRequests, found: true };
  }

  // Check in folders
  for (let i = 0; i < folders.length; i++) {
    const folder = folders[i];
    const result = findAndUpdateRequest(folder.folders, folder.requests, requestId, updates);
    if (result.found) {
      const updatedFolders = [...folders];
      updatedFolders[i] = { ...folder, folders: result.folders, requests: result.requests };
      return { folders: updatedFolders, requests, found: true };
    }
  }

  return { folders, requests, found: false };
};

export const findRequest = (
  folders: RequestFolder[],
  requests: ApiRequest[],
  requestId: string
): ApiRequest | null => {
  const req = requests.find(r => r.id === requestId);
  if (req) return req;

  for (const folder of folders) {
    const found = findRequest(folder.folders, folder.requests, requestId);
    if (found) return found;
  }

  return null;
};

export const findAndDeleteRequest = (
  folders: RequestFolder[],
  requests: ApiRequest[],
  requestId: string
): { folders: RequestFolder[]; requests: ApiRequest[]; found: boolean } => {
  const reqIndex = requests.findIndex(r => r.id === requestId);
  if (reqIndex !== -1) {
    return { folders, requests: requests.filter(r => r.id !== requestId), found: true };
  }

  for (let i = 0; i < folders.length; i++) {
    const folder = folders[i];
    const result = findAndDeleteRequest(folder.folders, folder.requests, requestId);
    if (result.found) {
      const updatedFolders = [...folders];
      updatedFolders[i] = { ...folder, folders: result.folders, requests: result.requests };
      return { folders: updatedFolders, requests, found: true };
    }
  }

  return { folders, requests, found: false };
};

export const findAndUpdateFolder = (
  folders: RequestFolder[],
  folderId: string,
  updates: Partial<RequestFolder>
): { folders: RequestFolder[]; found: boolean } => {
  for (let i = 0; i < folders.length; i++) {
    if (folders[i].id === folderId) {
      const updatedFolders = [...folders];
      updatedFolders[i] = { ...folders[i], ...updates };
      return { folders: updatedFolders, found: true };
    }

    const result = findAndUpdateFolder(folders[i].folders, folderId, updates);
    if (result.found) {
      const updatedFolders = [...folders];
      updatedFolders[i] = { ...folders[i], folders: result.folders };
      return { folders: updatedFolders, found: true };
    }
  }

  return { folders, found: false };
};

export const findAndDeleteFolder = (
  folders: RequestFolder[],
  folderId: string
): { folders: RequestFolder[]; found: boolean } => {
  const folderIndex = folders.findIndex(f => f.id === folderId);
  if (folderIndex !== -1) {
    return { folders: folders.filter(f => f.id !== folderId), found: true };
  }

  for (let i = 0; i < folders.length; i++) {
    const result = findAndDeleteFolder(folders[i].folders, folderId);
    if (result.found) {
      const updatedFolders = [...folders];
      updatedFolders[i] = { ...folders[i], folders: result.folders };
      return { folders: updatedFolders, found: true };
    }
  }

  return { folders, found: false };
};

export const addRequestToFolder = (
  folders: RequestFolder[],
  folderId: string,
  request: ApiRequest
): { folders: RequestFolder[]; found: boolean } => {
  for (let i = 0; i < folders.length; i++) {
    if (folders[i].id === folderId) {
      const updatedFolders = [...folders];
      updatedFolders[i] = {
        ...folders[i],
        requests: [...folders[i].requests, request],
      };
      return { folders: updatedFolders, found: true };
    }

    const result = addRequestToFolder(folders[i].folders, folderId, request);
    if (result.found) {
      const updatedFolders = [...folders];
      updatedFolders[i] = { ...folders[i], folders: result.folders };
      return { folders: updatedFolders, found: true };
    }
  }

  return { folders, found: false };
};

export const addSubFolder = (
  folders: RequestFolder[],
  parentFolderId: string,
  newFolder: RequestFolder
): { folders: RequestFolder[]; found: boolean } => {
  for (let i = 0; i < folders.length; i++) {
    if (folders[i].id === parentFolderId) {
      const updatedFolders = [...folders];
      updatedFolders[i] = {
        ...folders[i],
        folders: [...folders[i].folders, newFolder],
      };
      return { folders: updatedFolders, found: true };
    }

    const result = addSubFolder(folders[i].folders, parentFolderId, newFolder);
    if (result.found) {
      const updatedFolders = [...folders];
      updatedFolders[i] = { ...folders[i], folders: result.folders };
      return { folders: updatedFolders, found: true };
    }
  }

  return { folders, found: false };
};

