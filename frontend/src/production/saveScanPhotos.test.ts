import { expect, it, vi } from 'vitest';
import { ApiRequestError, saveScanPhotos } from './saveScanPhotos';

const photos = ['first', 'second'].map(path => ({ path, captured_at: '2026-11-14T00:00:00Z' }));

it('waits for the other upload before removing an incomplete batch', async () => {
  let finish!: () => void;
  const pending = new Promise<void>(resolve => { finish = resolve; });
  const save = vi.fn();
  const remove = vi.fn().mockResolvedValue(undefined);
  const run = saveScanPhotos(photos, async path => {
    if (path === 'first') throw new Error('Upload failed');
    await pending;
  }, save, remove);
  const rejection = expect(run).rejects.toThrow('Upload failed');
  await Promise.resolve();
  expect(remove).not.toHaveBeenCalled();
  finish();
  await rejection;
  expect(remove).toHaveBeenCalledWith(['first', 'second']);
  expect(save).not.toHaveBeenCalled();
});

it('removes only unused uploads when a retry returns an existing scan', async () => {
  const remove = vi.fn().mockResolvedValue(undefined);
  await saveScanPhotos(photos, async () => {}, async () => ({ images: [photos[0]] }), remove);
  expect(remove).toHaveBeenCalledWith(['second']);
});

it('cleans up rejected scans and preserves photos when the save outcome is unknown', async () => {
  const remove = vi.fn().mockResolvedValue(undefined);
  const upload = async () => {};
  await expect(saveScanPhotos(photos, upload, async () => {
    throw new ApiRequestError(422, 'Invalid image');
  }, remove)).rejects.toThrow('Invalid image');
  expect(remove).toHaveBeenCalledWith(['first', 'second']);
  remove.mockClear();
  await expect(saveScanPhotos(photos, upload, async () => {
    throw new Error('Connection interrupted');
  }, remove)).rejects.toThrow('Connection interrupted');
  expect(remove).not.toHaveBeenCalled();
});
