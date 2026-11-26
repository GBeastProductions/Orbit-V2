import { DevAssetItem, EditableThemePayload, PublishedHudLayout, SongDefinition } from '../types/game';

export interface GitHubFileEntry {
  path: string;
  content: string;
  encoding: 'utf-8' | 'base64';
}

export interface StudioExportManifest {
  exportedAtIso: string;
  songs: SongDefinition[];
  themes: EditableThemePayload[];
  hudLayouts: PublishedHudLayout[];
  assets: DevAssetItem[];
}

export function buildStudioRepoFiles(manifest: StudioExportManifest): GitHubFileEntry[] {
  const files: GitHubFileEntry[] = [];

  files.push({
    path: 'public/assets/studio/published_catalog.json',
    encoding: 'utf-8',
    content: JSON.stringify(
      {
        exportedAtIso: manifest.exportedAtIso,
        songs: manifest.songs,
        themes: manifest.themes,
        hudLayouts: manifest.hudLayouts,
      },
      null,
      2,
    ),
  });

  // Also emit individual asset files for clean folder organization in GitHub
  for (const asset of manifest.assets) {
    const safeFolder = asset.folder.replace(/[^a-zA-Z0-9_\-/]/g, '').replace(/^\/+|\/+$/g, '') || 'misc';
    const safeName = asset.name.replace(/[^a-zA-Z0-9_\-.]/g, '_');
    if (asset.dataUrlOrPath.startsWith('data:')) {
      const commaIdx = asset.dataUrlOrPath.indexOf(',');
      if (commaIdx > 0) {
        const meta = asset.dataUrlOrPath.slice(5, commaIdx);
        const rawB64 = asset.dataUrlOrPath.slice(commaIdx + 1);
        const ext = meta.includes('webp')
          ? 'webp'
          : meta.includes('png')
          ? 'png'
          : meta.includes('svg')
          ? 'svg'
          : meta.includes('mpeg') || meta.includes('mp3')
          ? 'mp3'
          : 'jpg';
        const finalName = safeName.includes('.') ? safeName : `${safeName}.${ext}`;
        files.push({
          path: `public/assets/studio/${safeFolder}/${finalName}`,
          encoding: 'base64',
          content: rawB64,
        });
      }
    }
  }

  return files;
}

export async function pushStudioChangesToGitHub(
  firebaseIdToken: string,
  files: GitHubFileEntry[],
  commitMessage: string,
): Promise<{ ok: boolean; commitSha?: string; commitUrl?: string; error?: string }> {
  try {
    const res = await fetch('/api/github/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${firebaseIdToken}`,
      },
      body: JSON.stringify({
        commitMessage: commitMessage.slice(0, 140),
        files,
      }),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      commitSha?: string;
      commitUrl?: string;
      error?: string;
    };
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error || `GitHub push failed (HTTP ${res.status})` };
    }
    return { ok: true, commitSha: data.commitSha, commitUrl: data.commitUrl };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? `${err.message} (Use Patch Export when hosting statically on GitHub Pages.)`
          : 'GitHub push proxy unreachable.',
    };
  }
}

export function downloadStudioPatchBundle(manifest: StudioExportManifest): void {
  const files = buildStudioRepoFiles(manifest);
  const bundle = {
    format: 'orbit-studio-patch-v1',
    exportedAtIso: manifest.exportedAtIso,
    instructions:
      'Extract these files directly into your ORBIT repository root and commit/push to publish statically on GitHub Pages.',
    fileCount: files.length,
    files,
  };
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `orbit-studio-patch-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}
