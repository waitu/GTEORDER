import { http } from './http';

export type UploadResponse = { urls: string[] };

export const uploadDesignAssets = async (files: File[]): Promise<UploadResponse> => {
  const fd = new FormData();
  files.forEach((f) => fd.append('files', f));
  const { data } = await http.post<UploadResponse>('/designs/upload', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

export type CreateDesignDto = {
  designSubtype: string;
  assetUrls: string[];
  adminNote?: string | null;
};

export const createDesignOrder = async (payload: CreateDesignDto) => {
  const { data } = await http.post('/designs', payload);
  return data;
};

export default {
  uploadDesignAssets,
  createDesignOrder,
};
