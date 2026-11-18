import { join } from 'path';

const publicUploadDirectories = ['avatars', 'license-templates'] as const;

export function configurePublicUploads(app: { useStaticAssets: (path: string, options: { prefix: string }) => unknown }, uploadRoot = join(process.cwd(), 'uploads')) {
  for (const directory of publicUploadDirectories) {
    app.useStaticAssets(join(uploadRoot, directory), { prefix: `/uploads/${directory}/` });
  }
}
