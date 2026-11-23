import { FolderPlus, Play, Search, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { Playlist, SoundRecipe } from '../engine/types';

interface PlaylistSidebarProps {
  playlists: Playlist[];
  activePlaylistId: string;
  onSelectPlaylist: (id: string) => void;
  onCreatePlaylist: (name: string) => void;
  sounds: SoundRecipe[];
  selectedSoundId: string;
  onSelectSound: (sound: SoundRecipe) => void;
  onQuickPlay: (sound: SoundRecipe) => void;
  onRequestDeleteCustomSound: (sound: SoundRecipe) => void;
  className?: string;
}

export function PlaylistSidebar({
  playlists,
  activePlaylistId,
  onSelectPlaylist,
  onCreatePlaylist,
  sounds,
  selectedSoundId,
  onSelectSound,
  onQuickPlay,
  onRequestDeleteCustomSound,
  className = '',
}: PlaylistSidebarProps) {
  const [query, setQuery] = useState('');
  const [creatingPlaylist, setCreatingPlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');

  const filteredSounds = sounds.filter((s) => {
    const matchesPlaylist = activePlaylistId === 'all' || s.playlistId === activePlaylistId;
    const q = query.trim().toLowerCase();
    const matchesQuery =
      !q ||
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.tags.some((t) => t.toLowerCase().includes(q));
    return matchesPlaylist && matchesQuery;
  });

  const activePlaylist = playlists.find((p) => p.id === activePlaylistId);

  return (
    <aside
      className={`flex flex-col gap-3 rounded-xl border border-[#334155] bg-[#1B2336] p-4 ${className}`}
      aria-label="Sound playlists and samples"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-sm font-semibold text-[#F8FAFC]">
          Playlists &amp; Samples
        </h2>
        <button
          type="button"
          onClick={() => setCreatingPlaylist((v) => !v)}
          aria-label="Create new playlist"
          aria-expanded={creatingPlaylist}
          title="Create new playlist"
          className="flex size-9 cursor-pointer items-center justify-center rounded-lg border border-[#475569] bg-[#272F42] text-[#F8FAFC] transition-colors duration-150 hover:border-[#22C55E] hover:text-[#22C55E]"
        >
          <FolderPlus size={16} aria-hidden="true" />
        </button>
      </div>

      {creatingPlaylist && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (newPlaylistName.trim()) {
              onCreatePlaylist(newPlaylistName.trim());
              setNewPlaylistName('');
              setCreatingPlaylist(false);
            }
          }}
          className="flex gap-2"
        >
          <label htmlFor="new-playlist-name" className="sr-only">
            New playlist name
          </label>
          <input
            id="new-playlist-name"
            type="text"
            autoComplete="off"
            value={newPlaylistName}
            onChange={(e) => setNewPlaylistName(e.target.value)}
            placeholder="Playlist name…"
            className="min-w-0 flex-1 rounded-lg border border-[#475569] bg-[#0F172A] px-3 py-1.5 text-sm text-[#F8FAFC] placeholder:text-[#94A3B8]"
            autoFocus
          />
          <button
            type="submit"
            className="min-h-9 cursor-pointer rounded-lg bg-[#22C55E] px-3 py-1.5 text-sm font-semibold text-[#0F172A] transition-opacity duration-150 hover:opacity-90"
          >
            Add
          </button>
        </form>
      )}

      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Playlists">
        {playlists.map((pl) => {
          const isActive = pl.id === activePlaylistId;
          return (
            <button
              key={pl.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelectPlaylist(pl.id)}
              className={`min-h-8 cursor-pointer rounded-md border px-2.5 py-1 text-xs font-medium transition-colors duration-150 ${
                isActive
                  ? 'border-[#22C55E] bg-[#22C55E]/15 font-semibold text-[#22C55E]'
                  : 'border-[#334155] bg-[#272F42] text-[#CBD5E1] hover:border-[#475569] hover:text-[#F8FAFC]'
              }`}
            >
              {pl.name}
            </button>
          );
        })}
        <button
          type="button"
          role="tab"
          aria-selected={activePlaylistId === 'all'}
          onClick={() => onSelectPlaylist('all')}
          className={`min-h-8 cursor-pointer rounded-md border px-2.5 py-1 text-xs font-medium transition-colors duration-150 ${
            activePlaylistId === 'all'
              ? 'border-[#22C55E] bg-[#22C55E]/15 font-semibold text-[#22C55E]'
              : 'border-[#334155] bg-[#272F42] text-[#CBD5E1] hover:border-[#475569] hover:text-[#F8FAFC]'
          }`}
        >
          All ({sounds.length})
        </button>
      </div>

      {activePlaylist && (
        <p className="text-xs leading-relaxed text-[#94A3B8]">{activePlaylist.description}</p>
      )}

      <div className="relative">
        <Search
          size={15}
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[#94A3B8]"
        />
        <label htmlFor="sound-search-input" className="sr-only">
          Search sounds
        </label>
        <input
          id="sound-search-input"
          type="search"
          autoComplete="off"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search sounds or tags…"
          className="w-full rounded-lg border border-[#475569] bg-[#0F172A] py-2 pr-3 pl-9 text-sm text-[#F8FAFC] placeholder:text-[#94A3B8]"
        />
      </div>

      <div className="flex max-h-[560px] flex-col gap-2 overflow-y-auto pr-1">
        {filteredSounds.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[#475569] bg-[#0F172A]/60 p-4 text-center">
            <p className="text-sm text-[#CBD5E1]">No sounds match this filter.</p>
            <button
              type="button"
              onClick={() => {
                setQuery('');
                onSelectPlaylist('all');
              }}
              className="mt-2 cursor-pointer text-xs font-semibold text-[#22C55E] hover:underline"
            >
              Show all {sounds.length} sounds
            </button>
          </div>
        ) : (
          filteredSounds.map((sound) => {
            const isSelected = sound.id === selectedSoundId;
            return (
              <div
                key={sound.id}
                className={`group flex items-center gap-2 rounded-lg border p-2.5 transition-colors duration-150 ${
                  isSelected
                    ? 'border-[#22C55E] bg-[#22C55E]/10'
                    : 'border-[#334155] bg-[#0F172A]/70 hover:border-[#475569] hover:bg-[#272F42]/70'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onQuickPlay(sound)}
                  aria-label={`Play ${sound.name}`}
                  title={`Audition ${sound.name}`}
                  className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-md border border-[#475569] bg-[#272F42] text-[#22C55E] transition-colors duration-150 hover:border-[#22C55E] hover:bg-[#22C55E] hover:text-[#0F172A]"
                >
                  <Play size={14} aria-hidden="true" />
                </button>

                <button
                  type="button"
                  onClick={() => onSelectSound(sound)}
                  className="min-w-0 flex-1 cursor-pointer text-left"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-[#F8FAFC]">
                      {sound.name}
                    </span>
                    <span className="shrink-0 font-display text-xs tabular-nums text-[#94A3B8]">
                      {sound.layers.length}L
                    </span>
                  </div>
                  <p className="mt-0.5 line-clamp-1 text-xs text-[#94A3B8]">
                    {sound.description}
                  </p>
                </button>

                {sound.isCustom && (
                  <button
                    type="button"
                    onClick={() => onRequestDeleteCustomSound(sound)}
                    aria-label={`Delete ${sound.name}`}
                    title={`Delete ${sound.name}`}
                    className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-[#94A3B8] transition-colors duration-150 hover:bg-[#EF4444]/15 hover:text-[#EF4444]"
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
