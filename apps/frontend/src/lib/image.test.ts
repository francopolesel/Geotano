import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resizeImage } from './image';

// ─── Global mock references ──────────────────────────────────────────────────

let imageInstance: {
  onload: (() => void) | null;
  onerror: (() => void) | null;
  src: string;
  width: number;
  height: number;
} | null = null;

let mockCanvasCtx: { drawImage: ReturnType<typeof vi.fn> } | null = null;

function setupMocks() {
  imageInstance = null;
  mockCanvasCtx = null;

  URL.createObjectURL = vi.fn(() => 'blob:mock-url');
  URL.revokeObjectURL = vi.fn();

  (globalThis as any).Image = class MockImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    src = '';
    width = 800;
    height = 600;

    constructor() {
      imageInstance = this;
    }
  };

  mockCanvasCtx = { drawImage: vi.fn() };
  HTMLCanvasElement.prototype.getContext = vi.fn(() => mockCanvasCtx) as any;
  HTMLCanvasElement.prototype.toDataURL = vi.fn(
    () => 'data:image/jpeg;base64,mocked-result',
  );
}

function mockFile(): File {
  return { name: 'test.jpg', type: 'image/jpeg', size: 1024 } as File;
}

beforeEach(() => {
  vi.clearAllMocks();
  setupMocks();
});

describe('resizeImage', () => {
  it('should be a function', () => {
    expect(typeof resizeImage).toBe('function');
  });

  it('should return a Promise', () => {
    const result = resizeImage(mockFile());
    expect(result).toBeInstanceOf(Promise);
  });

  it('should reject when image fails to load (onerror)', async () => {
    const promise = resizeImage(mockFile());

    expect(imageInstance).not.toBeNull();
    expect(imageInstance!.onerror).toBeInstanceOf(Function);
    imageInstance!.onerror!();

    await expect(promise).rejects.toThrow('Failed to load image');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('should resolve with data URI on successful load (no resize needed)', async () => {
    const promise = resizeImage(mockFile());

    expect(imageInstance).not.toBeNull();
    // Set dimensions smaller than default maxDimension (400) to skip resize
    imageInstance!.width = 300;
    imageInstance!.height = 200;

    expect(imageInstance!.onload).toBeInstanceOf(Function);
    imageInstance!.onload!();

    const result = await promise;
    expect(result).toBe('data:image/jpeg;base64,mocked-result');
    expect(mockCanvasCtx!.drawImage).toHaveBeenCalledWith(
      imageInstance,
      0,
      0,
      300,
      200,
    );
    expect(HTMLCanvasElement.prototype.toDataURL).toHaveBeenCalledWith(
      'image/jpeg',
      0.7,
    );
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('should downscale image when dimensions exceed maxDimension', async () => {
    // Image is 800x600 (default mock dimensions), maxDimension=400
    // → ratio = min(400/800, 400/600) = 0.5
    // → width = 800 * 0.5 = 400, height = 600 * 0.5 = 300
    const promise = resizeImage(mockFile(), 400, 0.8);

    expect(imageInstance).not.toBeNull();
    imageInstance!.onload!();

    const result = await promise;
    expect(result).toBe('data:image/jpeg;base64,mocked-result');
    expect(mockCanvasCtx!.drawImage).toHaveBeenCalledWith(
      imageInstance,
      0,
      0,
      400,
      300,
    );
    expect(HTMLCanvasElement.prototype.toDataURL).toHaveBeenCalledWith(
      'image/jpeg',
      0.8,
    );
  });
});
