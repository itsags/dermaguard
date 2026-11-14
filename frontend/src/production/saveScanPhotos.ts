export class ApiRequestError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

type ScanImage = { path: string; captured_at: string };

export async function saveScanPhotos(
  images: ScanImage[],
  upload: (path: string, index: number) => Promise<void>,
  save: (images: ScanImage[]) => Promise<{ images: ScanImage[] }>,
  remove: (paths: string[]) => Promise<unknown>,
) {
  const paths = images.map(image => image.path);
  async function cleanup(unused: string[]) {
    if (unused.length) await remove(unused).catch(() => undefined);
  }

  // Wait for every upload to settle so a late success cannot recreate a removed file.
  const uploads = await Promise.allSettled(images.map((image, index) => upload(image.path, index)));
  const failure = uploads.find(result => result.status === 'rejected');
  if (failure) {
    await cleanup(paths);
    throw failure.reason;
  }

  let saved;
  try {
    saved = await save(images);
  } catch (error) {
    // The scan API returns 422 during validation, before inserting a record.
    // A network or server error can also happen after the insert has committed.
    if (error instanceof ApiRequestError && error.status === 422) await cleanup(paths);
    throw error;
  }

  // A repeated request can return the original scan, with different photo paths.
  const retained = new Set(saved.images.map(image => image.path));
  await cleanup(paths.filter(path => !retained.has(path)));
}
