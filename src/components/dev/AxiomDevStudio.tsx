import React, { useEffect, useState } from 'react';
import {
  CloudUpload,
  Flame,
  FolderKanban,
  LayoutGrid,
  Move,
  Music,
  Palette,
  RotateCcw,
  Wrench,
  X,
} from 'lucide-react';
import { DEFAULT_DEV_DOCK_STYLE } from '../../store/studioRegistryStore';
import {
  DevAssetItem,
  EditableThemePayload,
  PlayerProfile,
  PublishedHudLayout,
  SongDefinition,
  ThemeId,
} from '../../types/game';
import { AssetVaultPanel } from './AssetVaultPanel';
import { HudLayoutPanel } from './HudLayoutPanel';
import { OverdriveStudioPanel } from './OverdriveStudioPanel';
import { PublishSyncPanel } from './PublishSyncPanel';
import { SongForgePanel } from './SongForgePanel';
import { ThemeSculptorPanel } from './ThemeSculptorPanel';

export type DevToolTabId =
  | 'themes'
  | 'overdrive'
  | 'songs'
  | 'assets'
  | 'layout'
  | 'publish';

interface AxiomDevStudioProps {
  open: boolean;
  onToggleOpen: (open: boolean) => void;
  activeTab: DevToolTabId;
  onSelectTab: (tab: DevToolTabId) => void;
  profile: PlayerProfile;
  themesMap: Record<string, EditableThemePayload>;
  songs: SongDefinition[];
  selectedSongId: string;
  hudLayout: PublishedHudLayout;
  assets: DevAssetItem[];
  editModeActive: boolean;
  selectedWidgetId: string | null;
  previewCharge: number | null;
  previewActive: boolean;
  draftSongsCount: number;
  draftThemesCount: number;
  hasDraftHud: boolean;
  draftAssetsCount: number;
  exportSongs: SongDefinition[];
  exportThemes: EditableThemePayload[];
  onToggleEditMode: () => void;
  onSelectWidget: (widgetId: string) => void;
  onUpdateHudLayout: (next: PublishedHudLayout) => void;
  onSafeResetLayout: () => void;
  onSaveThemeDraft: (theme: EditableThemePayload) => void;
  onResetBuiltInTheme: (id: ThemeId) => void;
  onApplyPlayerTheme: (id: ThemeId) => void;
  onSaveSongDraft: (song: SongDefinition) => void;
  onSelectSong: (songId: string) => void;
  onPlaytestSong: (song: SongDefinition, startOffsetSec?: number) => void;
  onUpsertAsset: (asset: DevAssetItem) => void;
  onDeleteAsset: (assetId: string) => void;
  onChangePreviewCharge: (val: number | null) => void;
  onTogglePreviewActive: (active: boolean) => void;
  onPublishAllCloud: () => Promise<string>;
  onDiscardDrafts: () => void;
}

const TOOL_TABS: { id: DevToolTabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'themes', label: 'Themes', icon: Palette },
  { id: 'overdrive', label: 'Overdrive', icon: Flame },
  { id: 'songs', label: 'Songs', icon: Music },
  { id: 'assets', label: 'Assets', icon: FolderKanban },
  { id: 'layout', label: 'HUD Edit', icon: LayoutGrid },
  { id: 'publish', label: 'Publish', icon: CloudUpload },
];

export const AxiomDevStudio: React.FC<AxiomDevStudioProps> = (props) => {
  const {
    open,
    onToggleOpen,
    activeTab,
    onSelectTab,
    profile,
    themesMap,
    songs,
    selectedSongId,
    hudLayout,
    assets,
    editModeActive,
    selectedWidgetId,
    previewCharge,
    previewActive,
    onToggleEditMode,
    onSafeResetLayout,
  } = props;

  const [editThemeId, setEditThemeId] = useState<ThemeId>(profile.theme);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'F8') {
        e.preventDefault();
        onToggleOpen(!open);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onToggleOpen]);

  const dock = hudLayout.devDockStyle || DEFAULT_DEV_DOCK_STYLE;
  const pos = dock.position || 'left';
  const totalDrafts =
    props.draftSongsCount +
    props.draftThemesCount +
    (props.hasDraftHud ? 1 : 0) +
    props.draftAssetsCount;

  // Compact launcher chip when drawer is collapsed
  if (!open) {
    return (
      <div
        className={`fixed z-[70] flex items-center gap-1.5 ${
          pos === 'right'
            ? 'right-3 bottom-3'
            : pos === 'top'
            ? 'top-3 left-1/2 -translate-x-1/2'
            : 'left-3 bottom-3'
        }`}
      >
        <button
          type="button"
          onClick={() => onToggleOpen(true)}
          className="flex items-center gap-2 border px-3 py-2 font-mono text-xs font-bold text-white shadow-xl cursor-pointer transition-transform hover:scale-[1.02]"
          style={{
            backgroundColor: dock.bgColor,
            borderColor: dock.accentColor,
            opacity: dock.opacity,
            backdropFilter: `blur(${dock.blurPx}px)`,
          }}
        >
          <Wrench className="h-3.5 w-3.5" style={{ color: dock.accentColor }} />
          <span>AXIOM DEV</span>
          {totalDrafts > 0 && (
            <span
              className="px-1.5 py-0.5 text-[10px] font-extrabold text-slate-950"
              style={{ backgroundColor: dock.accentColor }}
            >
              {totalDrafts}
            </span>
          )}
        </button>
        {editModeActive && (
          <button
            type="button"
            onClick={onToggleEditMode}
            className="border border-[#38BDF8] bg-[#38BDF8] px-2.5 py-2 font-mono text-xs font-bold text-slate-950 shadow-xl cursor-pointer"
          >
            EXIT EDIT
          </button>
        )}
      </div>
    );
  }

  const railPositionClass =
    pos === 'right'
      ? 'right-3 top-1/2 -translate-y-1/2 flex-col'
      : pos === 'top'
      ? 'top-3 left-1/2 -translate-x-1/2 flex-row'
      : 'left-3 top-1/2 -translate-y-1/2 flex-col';

  const inspectorPositionClass =
    pos === 'right'
      ? 'right-[72px] top-4 bottom-4'
      : pos === 'top'
      ? 'top-[68px] left-1/2 -translate-x-1/2 max-h-[78dvh]'
      : 'left-[72px] top-4 bottom-4';

  const assignAssetToOverdrive = (asset: DevAssetItem) => {
    const theme = themesMap[profile.theme] || Object.values(themesMap)[0];
    if (!theme) return;
    const nextLayers = [
      ...(theme.overdriveLayers || []),
      {
        id: `od_${Date.now().toString().slice(-6)}`,
        name: asset.name.replace(/\.[^.]+$/, ''),
        imageUrl: asset.dataUrlOrPath,
        anchor: 'bottom_border' as const,
        animation: 'flame_rise' as const,
        blendMode: 'screen' as const,
        opacity: 0.9,
        scale: 1,
        speed: 1,
        buildupMinOpacity: 0.14,
        eruptBoost: 1.25,
        enabled: true,
      },
    ];
    props.onSaveThemeDraft({ ...theme, status: 'draft', overdriveLayers: nextLayers });
    onSelectTab('overdrive');
    if (previewCharge === null) props.onChangePreviewCharge(0.85);
  };

  const assignAssetToThemeBackdrop = (asset: DevAssetItem) => {
    const theme = themesMap[editThemeId] || themesMap[profile.theme];
    if (!theme) return;
    props.onSaveThemeDraft({
      ...theme,
      status: 'draft',
      isTransformationSkin: true,
      manifest: {
        ...theme.manifest,
        isFullTransformation: true,
        backdropImageUrl: asset.dataUrlOrPath,
      },
    });
    onSelectTab('themes');
  };

  const assignAssetToThemeOrnament = (asset: DevAssetItem) => {
    const theme = themesMap[editThemeId] || themesMap[profile.theme];
    if (!theme) return;
    props.onSaveThemeDraft({
      ...theme,
      status: 'draft',
      isTransformationSkin: true,
      manifest: {
        ...theme.manifest,
        isFullTransformation: true,
        ornamentImageUrl: asset.dataUrlOrPath,
      },
    });
    onSelectTab('themes');
  };

  return (
    <>
      {/* Axiom Floating Tool Rail */}
      <nav
        aria-label="Axiom Dev Tool Rail"
        className={`fixed z-[75] flex gap-1 border p-1.5 shadow-2xl ${railPositionClass}`}
        style={{
          backgroundColor: dock.bgColor,
          borderColor: dock.borderColor,
          opacity: dock.opacity,
          backdropFilter: `blur(${dock.blurPx}px)`,
        }}
      >
        {TOOL_TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectTab(tab.id)}
              title={dock.showTooltips ? tab.label : undefined}
              className={`flex flex-col items-center justify-center gap-0.5 border cursor-pointer transition-colors ${
                dock.compact ? 'h-9 w-9' : 'h-11 w-12'
              } ${
                active
                  ? 'text-slate-950 font-bold'
                  : 'border-transparent text-slate-300 hover:border-slate-600 hover:text-white'
              }`}
              style={
                active
                  ? { backgroundColor: dock.accentColor, borderColor: dock.accentColor }
                  : undefined
              }
            >
              <Icon className="h-4 w-4" />
              {!dock.compact && (
                <span className="font-mono text-[8px] uppercase leading-none">
                  {tab.label}
                </span>
              )}
            </button>
          );
        })}

        <div className={pos === 'top' ? 'mx-1 w-px bg-slate-700' : 'my-1 h-px bg-slate-700'} />

        <button
          type="button"
          onClick={onToggleEditMode}
          title="Toggle HUD Edit Mode"
          className={`flex flex-col items-center justify-center border cursor-pointer ${
            dock.compact ? 'h-9 w-9' : 'h-10 w-12'
          } ${
            editModeActive
              ? 'border-amber-400 bg-amber-400 text-slate-950 font-bold'
              : 'border-slate-700 bg-slate-900 text-slate-300 hover:text-white'
          }`}
        >
          <Move className="h-3.5 w-3.5" />
          {!dock.compact && <span className="font-mono text-[8px]">EDIT</span>}
        </button>

        <button
          type="button"
          onClick={() => onToggleOpen(false)}
          title="Minimize Axiom Studio (F8)"
          className={`flex items-center justify-center border border-slate-700 bg-slate-900 text-slate-300 hover:text-white cursor-pointer ${
            dock.compact ? 'h-9 w-9' : 'h-9 w-12'
          }`}
        >
          <X className="h-4 w-4" />
        </button>
      </nav>

      {/* Axiom Inspector Drawer */}
      <aside
        aria-label="Axiom Dev Inspector"
        className={`fixed z-[74] flex w-[min(90vw,390px)] flex-col border shadow-2xl ${inspectorPositionClass}`}
        style={{
          backgroundColor: dock.bgColor,
          borderColor: dock.borderColor,
          opacity: dock.opacity,
          backdropFilter: `blur(${dock.blurPx}px)`,
        }}
      >
        <header className="flex items-center justify-between border-b border-slate-700 px-3.5 py-2.5">
          <div className="flex items-center gap-2">
            <Wrench className="h-4 w-4" style={{ color: dock.accentColor }} />
            <div>
              <h2 className="font-mono text-xs font-extrabold uppercase tracking-wider text-white">
                ORBIT AXIOM STUDIO
              </h2>
              <p className="font-mono text-[9px] text-slate-400">
                No-Code Live Builder · F8 Toggle
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onSafeResetLayout}
              title="Safe Reset Dev Dock"
              className="border border-slate-700 bg-slate-900 p-1 text-slate-400 hover:text-white cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onToggleOpen(false)}
              className="border border-slate-700 bg-slate-900 p-1 text-slate-300 hover:text-white cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </header>

        <div className="orbit-scroll flex-1 overflow-y-auto p-3">
          {activeTab === 'themes' && (
            <ThemeSculptorPanel
              themesMap={themesMap}
              selectedThemeId={editThemeId}
              activePlayerTheme={profile.theme}
              assets={assets}
              onSelectEditTheme={setEditThemeId}
              onApplyPlayerTheme={props.onApplyPlayerTheme}
              onSaveThemeDraft={props.onSaveThemeDraft}
              onResetBuiltInTheme={props.onResetBuiltInTheme}
            />
          )}

          {activeTab === 'overdrive' && (
            <OverdriveStudioPanel
              themesMap={themesMap}
              activePlayerTheme={profile.theme}
              assets={assets}
              previewCharge={previewCharge}
              previewActive={previewActive}
              onChangePreviewCharge={props.onChangePreviewCharge}
              onTogglePreviewActive={props.onTogglePreviewActive}
              onSaveThemeDraft={props.onSaveThemeDraft}
              onApplyPlayerTheme={props.onApplyPlayerTheme}
            />
          )}

          {activeTab === 'songs' && (
            <SongForgePanel
              songs={songs}
              selectedSongId={selectedSongId}
              assets={assets}
              profile={profile}
              onSaveSongDraft={props.onSaveSongDraft}
              onSelectSong={props.onSelectSong}
              onPlaytestSong={props.onPlaytestSong}
            />
          )}

          {activeTab === 'assets' && (
            <AssetVaultPanel
              assets={assets}
              onUpsertAsset={props.onUpsertAsset}
              onDeleteAsset={props.onDeleteAsset}
              onAssignToOverdrive={assignAssetToOverdrive}
              onAssignToThemeBackdrop={assignAssetToThemeBackdrop}
              onAssignToThemeOrnament={assignAssetToThemeOrnament}
            />
          )}

          {activeTab === 'layout' && (
            <HudLayoutPanel
              hudLayout={hudLayout}
              editModeActive={editModeActive}
              selectedWidgetId={selectedWidgetId}
              assets={assets}
              onToggleEditMode={onToggleEditMode}
              onSelectWidget={props.onSelectWidget}
              onUpdateLayout={props.onUpdateHudLayout}
              onSafeResetLayout={onSafeResetLayout}
            />
          )}

          {activeTab === 'publish' && (
            <PublishSyncPanel
              draftSongsCount={props.draftSongsCount}
              draftThemesCount={props.draftThemesCount}
              hasDraftHud={props.hasDraftHud}
              draftAssetsCount={props.draftAssetsCount}
              exportSongs={props.exportSongs}
              exportThemes={props.exportThemes}
              hudLayout={hudLayout}
              assets={assets}
              onPublishAllCloud={props.onPublishAllCloud}
              onDiscardDrafts={props.onDiscardDrafts}
            />
          )}
        </div>
      </aside>
    </>
  );
};
