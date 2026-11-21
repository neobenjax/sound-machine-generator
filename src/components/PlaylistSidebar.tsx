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
  onDeleteCustomSound: (id: string) => void;
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
  onDeleteCustomSound,
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
    <aside className={`surface-card playlist-panel ${className}`} aria-label="Sound playlists and samples">
      <div className="section-header">
        <h2 className="section-title" style={{ fontSize: '1.05rem' }}>
          Playlists &amp; Samples
        </h2>
        <button
          type="button"
          className="btn-icon"
          title="Create new playlist"
          onClick={() => setCreatingPlaylist((v) => !v)}
        >
          <FolderPlus size={16} />
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
          style={{ display: 'flex', gap: '6px' }}
        >
          <input
            type="text"
            value={newPlaylistName}
            onChange={(e) => setNewPlaylistName(e.target.value)}
            placeholder="Playlist name..."
            style={{ flex: 1, padding: '6px 10px', fontSize: '0.875rem' }}
            autoFocus
          />
          <button type="submit" className="btn-primary" style={{ padding: '6px 12px', minBlockSize: '34px' }}>
            Add
          </button>
        </form>
      )}

      <div className="playlist-tabs" role="tablist" aria-label="Playlists">
        {playlists.map((pl) => (
          <button
            key={pl.id}
            type="button"
            role="tab"
            aria-selected={pl.id === activePlaylistId}
            className={`playlist-chip ${pl.id === activePlaylistId ? 'active' : ''}`}
            onClick={() => onSelectPlaylist(pl.id)}
          >
            {pl.name}
          </button>
        ))}
        <button
          type="button"
          role="tab"
          aria-selected={activePlaylistId === 'all'}
          className={`playlist-chip ${activePlaylistId === 'all' ? 'active' : ''}`}
          onClick={() => onSelectPlaylist('all')}
        >
          All ({sounds.length})
        </button>
      </div>

      {activePlaylist && (
        <p style={{ margin: 0, fontSize: 'var(--text-caption)', color: 'var(--color-text-secondary)' }}>
          {activePlaylist.description}
        </p>
      )}

      <div className="search-input-wrap">
        <Search size={15} />
        <input
          type="search"
          className="input-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter sounds or tags..."
          aria-label="Filter sounds"
        />
      </div>

      <div className="sample-list">
        {filteredSounds.length === 0 ? (
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', textAlign: 'center', padding: '16px' }}>
            No sounds in this playlist yet. Tune a sound and click &ldquo;Save as New&rdquo;.
          </p>
        ) : (
          filteredSounds.map((sound) => {
            const isSelected = sound.id === selectedSoundId;
            return (
              <div key={sound.id} className={`sample-item ${isSelected ? 'selected' : ''}`}>
                <button
                  type="button"
                  className="btn-icon"
                  aria-label={`Audition ${sound.name}`}
                  title="Quick Play"
                  onClick={() => onQuickPlay(sound)}
                >
                  <Play size={14} />
                </button>
                <button
                  type="button"
                  className="sample-select-btn"
                  onClick={() => onSelectSound(sound)}
                >
                  <span className="sample-name">{sound.name}</span>
                  <span className="sample-meta">
                    {sound.layers.length} {sound.layers.length === 1 ? 'layer' : 'layers'}
                    {sound.isCustom ? ' • Saved' : ' • Preset'}
                  </span>
                </button>
                {sound.isCustom && (
                  <button
                    type="button"
                    className="btn-icon btn-danger"
                    aria-label={`Delete ${sound.name}`}
                    title="Delete custom sound"
                    onClick={() => onDeleteCustomSound(sound.id)}
                  >
                    <Trash2 size={14} />
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
