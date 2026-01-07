import { Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import { join, extname } from 'path';
import { randomUUID } from 'crypto';

type UploadedFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
};

@Injectable()
export class LabelStorageService {
  async saveLabel(userId: string, file: UploadedFile): Promise<string> {
    const dir = join(process.cwd(), 'uploads', 'labels', userId);
    await fs.mkdir(dir, { recursive: true });
    const ext = extname(file.originalname) || this.inferExt(file.mimetype) || '.bin';
    const filename = `${Date.now()}-${randomUUID()}${ext}`;
    const fullPath = join(dir, filename);
    await fs.writeFile(fullPath, file.buffer);
    return fullPath;
  }

  private inferExt(mime?: string | null): string | null {
    if (!mime) return null;
    if (mime === 'application/pdf') return '.pdf';
    if (mime === 'image/png') return '.png';
    if (mime === 'image/jpeg') return '.jpg';
    return null;
  }
}
