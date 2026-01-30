import { Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import { join, extname } from 'path';

type UploadedFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
};

@Injectable()
export class TopupBillStorageService {
  async saveBillImage(params: { userId: string; topupId: string; file: UploadedFile }): Promise<string> {
    const { userId, topupId, file } = params;
    const dir = join(process.cwd(), 'uploads', 'topups', userId);
    await fs.mkdir(dir, { recursive: true });

    const ext = extname(file.originalname) || this.inferExt(file.mimetype) || '.bin';
    const filename = `${topupId}${ext}`;
    const fullPath = join(dir, filename);

    await fs.writeFile(fullPath, file.buffer);
    return fullPath;
  }

  private inferExt(mime?: string | null): string | null {
    if (!mime) return null;
    if (mime === 'image/png') return '.png';
    if (mime === 'image/jpeg') return '.jpg';
    return null;
  }
}
