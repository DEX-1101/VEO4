
export type AspectRatio = '16:9' | '9:16';
export type Model = 'veo-2.0-generate-001' | 'veo-3.0-generate-preview';

export interface ReferenceImage {
  base64: string;
  mimeType: string;
  name: string;
}