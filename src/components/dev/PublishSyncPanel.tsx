import React, { useState } from 'react';
import { CloudUpload, Download, GitBranch, RotateCcw } from 'lucide-react';
import { auth } from '../../firebase';
import {
  buildStudioRepoFiles,
  downloadStudioPatchBundle,
  pushStudioChangesToGitHub,
} from '../../store/githubSync';
import {
  DevAssetItem,
  EditableThemePayload,
  PublishedHudLayout,
  SongDefinition,
} from '../../types/game';

interface PublishSyncPanelProps {
  draftSongsCount: number;
  draftThemesCount: number;
  hasDraftHud: boolean;
  draftAssetsCount: number;
  exportSongs: SongDefinition[];
  exportThemes: EditableThemePayload[];
  hudLayout: PublishedHudLayout;
  assets: DevAssetItem[];
  onPublishAllCloud: () => Promise<string>;
  onDiscardDrafts: () => void;
}

export const PublishSyncPanel: React.FC<PublishSyncPanelProps> = ({
  draftSongsCount,
  draftThemesCount,
  hasDraftHud,
  draftAssetsCount,
  exportSongs,
  exportThemes,
  hudLayout,
  assets,
  onPublishAllCloud,
  onDiscardDrafts,
}) => {
  const [commitMessage, setCommitMessage] = useState('ORBIT Dev Studio publish');
  const [busy, setBusy] = useState(false);
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const [commitUrl, setCommitUrl] = useState<string | null>(null);

  const totalPending =
    draftSongsCount + draftThemesCount + (hasDraftHud ? 1 : 0) + draftAssetsCount;

  const handleCloudPublish = async () => {
    setBusy(true);
    setResultMsg(null);
    setCommitUrl(null);
    try {
      const msg = await onPublishAllCloud();
      setResultMsg(msg);
    } catch (err) {
      setResultMsg(err instanceof Error ? err.message : 'Firebase publish failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleGitHubPush = async () => {
    setBusy(true);
    setResultMsg(null);
    setCommitUrl(null);
    try {
      const user = auth.currentUser;
      if (!user) {
        setResultMsg('Sign in with your verified developer Google account first.');
        return;
      }
      const token = await user.getIdToken();
      const files = buildStudioRepoFiles({
        exportedAtIso: new Date().toISOString(),
        songs: exportSongs,
        themes: exportThemes,
        hudLayouts: [hudLayout],
        assets,
      });
      const res = await pushStudioChangesToGitHub(token, files, commitMessage);
      if (res.ok) {
        setResultMsg(`Pushed commit ${res.commitSha?.slice(0, 7) || ''} to GitHub.`);
        if (res.commitUrl) setCommitUrl(res.commitUrl);
      } else {
        setResultMsg(res.error || 'GitHub push failed.');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadPatch = () => {
    downloadStudioPatchBundle({
      exportedAtIso: new Date().toISOString(),
      songs: exportSongs,
      themes: exportThemes,
      hudLayouts: [hudLayout],
      assets,
    });
    setResultMsg('Downloaded static GitHub patch bundle (.json).');
  };

  return (
    <div className="space-y-3 text-xs text-slate-200">
      <div className="border border-slate-700 bg-slate-800/80 p-3 space-y-2">
        <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#38BDF8]">
          Publish Live &amp; GitHub Sync
        </span>

        <div className="grid grid-cols-2 gap-1.5 text-[11px]">
          <div className="border border-slate-700 bg-slate-900 px-2.5 py-1.5 flex justify-between">
            <span className="text-slate-400">Draft Songs</span>
            <span className="tabular-nums font-bold text-white">{draftSongsCount}</span>
          </div>
          <div className="border border-slate-700 bg-slate-900 px-2.5 py-1.5 flex justify-between">
            <span className="text-slate-400">Draft Themes</span>
            <span className="tabular-nums font-bold text-white">{draftThemesCount}</span>
          </div>
          <div className="border border-slate-700 bg-slate-900 px-2.5 py-1.5 flex justify-between">
            <span className="text-slate-400">HUD Layout</span>
            <span className="font-bold text-white">{hasDraftHud ? 'Modified' : 'Synced'}</span>
          </div>
          <div className="border border-slate-700 bg-slate-900 px-2.5 py-1.5 flex justify-between">
            <span className="text-slate-400">Draft Assets</span>
            <span className="tabular-nums font-bold text-white">{draftAssetsCount}</span>
          </div>
        </div>
      </div>

      {/* Firebase Live Publish */}
      <div className="border border-slate-700 bg-slate-800/65 p-3 space-y-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleCloudPublish()}
          className="flex w-full items-center justify-center gap-2 border border-emerald-400/70 bg-emerald-500/20 py-2.5 font-bold text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-50 cursor-pointer"
        >
          <CloudUpload className="h-4 w-4" />
          <span>
            {busy ? 'Publishing...' : `Publish Live to Firebase (${totalPending} pending)`}
          </span>
        </button>
        <p className="text-[10px] text-slate-400">
          Updates songs, themes, Overdrive VFX, HUD layout, and compressed assets in real time for all ORBIT players.
        </p>
      </div>

      {/* GitHub Auto-Push */}
      <div className="border border-slate-700 bg-slate-800/65 p-3 space-y-2">
        <label className="block space-y-1">
          <span className="text-[10px] text-slate-400">GitHub Commit Message</span>
          <input
            type="text"
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            className="w-full border border-slate-600 bg-slate-900 px-2 py-1 text-white"
          />
        </label>

        <button
          type="button"
          disabled={busy}
          onClick={() => void handleGitHubPush()}
          className="flex w-full items-center justify-center gap-2 border border-[#38BDF8]/70 bg-[#38BDF8]/20 py-2 font-bold text-white hover:bg-[#38BDF8]/30 disabled:opacity-50 cursor-pointer"
        >
          <GitBranch className="h-4 w-4 text-[#38BDF8]" />
          <span>Auto-Push Changes to GitHub</span>
        </button>

        <button
          type="button"
          onClick={handleDownloadPatch}
          className="flex w-full items-center justify-center gap-2 border border-slate-600 bg-slate-900 py-1.5 font-semibold text-slate-200 hover:border-slate-400 cursor-pointer"
        >
          <Download className="h-3.5 w-3.5" />
          <span>Download GitHub Patch Bundle (.json)</span>
        </button>
      </div>

      {resultMsg && (
        <div className="border border-[#38BDF8]/50 bg-slate-900 p-2.5 text-[11px] text-slate-100 space-y-1">
          <p>{resultMsg}</p>
          {commitUrl && (
            <a
              href={commitUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-block font-mono text-[10px] text-[#38BDF8] underline"
            >
              View Commit on GitHub
            </a>
          )}
        </div>
      )}

      {totalPending > 0 && (
        <button
          type="button"
          onClick={onDiscardDrafts}
          className="flex w-full items-center justify-center gap-1.5 border border-rose-500/40 bg-rose-950/35 py-1.5 text-[11px] font-bold text-rose-300 hover:bg-rose-950/60 cursor-pointer"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>Discard Local Unsaved Drafts</span>
        </button>
      )}
    </div>
  );
};
