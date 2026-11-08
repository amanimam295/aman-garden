/**
 * Botanica Sanctuary - Spotify Music Player Integration
 * Allows visitors to play curated garden soundscapes or enter any custom Spotify playlist,
 * album, or track without leaving the page or opening another tab.
 */

(function () {
    'use strict';

    // Curated garden presets
    const PRESETS = [
        {
            id: '37i9dQZF1DX4sWSpwq3LiO',
            type: 'playlist',
            name: 'Peaceful Piano',
            icon: '🎹'
        },
        {
            id: '37i9dQZF1DXcBWIGoYBM5M',
            type: 'playlist',
            name: 'Lofi Garden',
            icon: '☕'
        },
        {
            id: '37i9dQZF1DWV0gynK7Pt6V',
            type: 'playlist',
            name: 'Classical Rose',
            icon: '🎻'
        },
        {
            id: '37i9dQZF1DWZeKCadgRdKQ',
            type: 'playlist',
            name: 'Deep Focus Bloom',
            icon: '🌧️'
        }
    ];

    const STORAGE_KEY = 'botanica_custom_spotify_item';

    class SpotifyGardenManager {
        constructor() {
            this.panel = null;
            this.minibar = null;
            this.iframe = null;
            this.toggleBtn = null;
            this.inputEl = null;
            this.loadBtn = null;
            this.statusEl = null;
            this.savedContainer = null;
            this.savedChip = null;
            this.savedTitle = null;
            this.savedRemoveBtn = null;
            this.sizeToggleBtn = null;
            this.sizeIcon = null;
            this.playerWrapper = null;
            this.presetButtons = [];

            this.isOpen = false;
            this.isMinimized = false;
            this.isExpandedSize = false; // false = compact (152px), true = full playlist (352px)
            this.currentEmbedUrl = '';
            this.activePresetId = '37i9dQZF1DX4sWSpwq3LiO';
            this.savedItem = null;

            this.init();
        }

        init() {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.setupDOM());
            } else {
                this.setupDOM();
            }
        }

        setupDOM() {
            // Cache elements
            this.panel = document.getElementById('spotify-panel');
            this.minibar = document.getElementById('spotify-minibar');
            this.iframe = document.getElementById('spotify-iframe');
            this.toggleBtn = document.getElementById('btn-spotify-toggle');
            this.inputEl = document.getElementById('spotify-input');
            this.loadBtn = document.getElementById('spotify-load-btn');
            this.statusEl = document.getElementById('spotify-status');
            this.savedContainer = document.getElementById('spotify-saved-container');
            this.savedChip = document.getElementById('spotify-saved-chip');
            this.savedTitle = document.getElementById('spotify-saved-title');
            this.savedRemoveBtn = document.getElementById('spotify-saved-remove');
            this.sizeToggleBtn = document.getElementById('spotify-toggle-size');
            this.sizeIcon = document.getElementById('spotify-size-icon');
            this.playerWrapper = document.getElementById('spotify-player-wrapper');
            this.presetButtons = Array.from(document.querySelectorAll('.spotify-preset-btn'));

            const closeBtn = document.getElementById('spotify-close-btn');
            const minimizeBtn = document.getElementById('spotify-minimize-btn');
            const miniExpandBtn = document.getElementById('spotify-mini-expand-btn');

            // Load saved item from localStorage if available
            this.loadSavedItem();

            // Event Listeners
            if (this.toggleBtn) {
                this.toggleBtn.addEventListener('click', () => this.togglePanel());
            }

            if (closeBtn) {
                closeBtn.addEventListener('click', () => this.closePanel());
            }

            if (minimizeBtn) {
                minimizeBtn.addEventListener('click', () => this.minimizePanel());
            }

            if (this.minibar) {
                this.minibar.addEventListener('click', () => this.restoreFromMinibar());
            }

            if (miniExpandBtn) {
                miniExpandBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.restoreFromMinibar();
                });
            }

            if (this.sizeToggleBtn) {
                this.sizeToggleBtn.addEventListener('click', () => this.togglePlayerSize());
            }

            if (this.loadBtn) {
                this.loadBtn.addEventListener('click', () => this.handleCustomLoad());
            }

            if (this.inputEl) {
                this.inputEl.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        this.handleCustomLoad();
                    }
                });
            }

            // Presets click listeners
            this.presetButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = btn.getAttribute('data-id');
                    const type = btn.getAttribute('data-type') || 'playlist';
                    const name = btn.getAttribute('data-name') || 'Preset';
                    this.loadTrackOrPlaylist(type, id, name);
                });
            });

            // Saved item listeners
            if (this.savedChip) {
                this.savedChip.addEventListener('click', () => {
                    if (this.savedItem) {
                        this.loadTrackOrPlaylist(this.savedItem.type, this.savedItem.id, this.savedItem.title, false);
                    }
                });
            }

            if (this.savedRemoveBtn) {
                this.savedRemoveBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.removeSavedItem();
                });
            }

            // If user has a saved playlist, load it on startup, otherwise keep default preset
            if (this.savedItem) {
                this.loadTrackOrPlaylist(this.savedItem.type, this.savedItem.id, this.savedItem.title, false);
            } else {
                this.highlightPreset(this.activePresetId);
            }
        }

        /**
         * Parses user input string (URL, URI, iframe code, or direct ID)
         */
        parseSpotifyInput(rawInput) {
            if (!rawInput || typeof rawInput !== 'string') return null;
            let str = rawInput.trim();

            // 1. If user pasted an iframe embed code
            const iframeMatch = str.match(/src=["'](https:\/\/open\.spotify\.com\/embed\/[^"']+)["']/i);
            if (iframeMatch) {
                str = iframeMatch[1];
            }

            // 2. Spotify URI format: spotify:playlist:xxxx or spotify:track:xxxx or spotify:album:xxxx
            const uriMatch = str.match(/^spotify:(playlist|album|track|artist|show|episode):([a-zA-Z0-9]+)/i);
            if (uriMatch) {
                const type = uriMatch[1].toLowerCase();
                const id = uriMatch[2];
                return {
                    type: type,
                    id: id,
                    embedUrl: `https://open.spotify.com/embed/${type}/${id}?utm_source=generator&theme=0`
                };
            }

            // 3. Web URL: https://open.spotify.com/(intl-[a-z]{2}/)?(embed/)?(playlist|album|track|artist|show|episode)/id
            const webMatch = str.match(/open\.spotify\.com(?:\/intl-[a-z]{2})?\/(?:embed\/)?(playlist|album|track|artist|show|episode)\/([a-zA-Z0-9]+)/i);
            if (webMatch) {
                const type = webMatch[1].toLowerCase();
                const id = webMatch[2];
                return {
                    type: type,
                    id: id,
                    embedUrl: `https://open.spotify.com/embed/${type}/${id}?utm_source=generator&theme=0`
                };
            }

            // 4. Direct 22-character Spotify Base62 ID fallback
            if (/^[a-zA-Z0-9]{22}$/.test(str)) {
                return {
                    type: 'playlist',
                    id: str,
                    embedUrl: `https://open.spotify.com/embed/playlist/${str}?utm_source=generator&theme=0`
                };
            }

            return null;
        }

        /**
         * Handles the custom URL load action
         */
        handleCustomLoad() {
            if (!this.inputEl) return;
            const inputVal = this.inputEl.value.trim();

            if (!inputVal) {
                this.showStatus('Please paste a Spotify link or playlist ID.', 'error');
                return;
            }

            const parsed = this.parseSpotifyInput(inputVal);
            if (!parsed) {
                this.showStatus('Invalid link. Please copy a playlist or track link from Spotify.', 'error');
                return;
            }

            // Determine friendly label
            const typeCapitalized = parsed.type.charAt(0).toUpperCase() + parsed.type.slice(1);
            const title = `My Custom ${typeCapitalized}`;

            // Save to localStorage for future sessions
            this.saveItem({
                type: parsed.type,
                id: parsed.id,
                title: title,
                originalUrl: inputVal,
                date: Date.now()
            });

            // Load into player
            this.loadTrackOrPlaylist(parsed.type, parsed.id, title, true);
            this.showStatus(`✓ Loaded your ${typeCapitalized}! Enjoy listening in the garden.`, 'success');
            this.inputEl.value = '';
        }

        /**
         * Loads a track, playlist, or album into the iframe
         */
        loadTrackOrPlaylist(type, id, displayName = 'Spotify Music', isCustom = false) {
            const embedUrl = `https://open.spotify.com/embed/${type}/${id}?utm_source=generator&theme=0`;
            
            // Check if already playing this exact item
            if (this.currentEmbedUrl === embedUrl) {
                return;
            }

            this.currentEmbedUrl = embedUrl;

            if (this.iframe) {
                // Update iframe source
                this.iframe.src = embedUrl;
            }

            // Update mini-bar label
            const miniTitle = document.getElementById('spotify-mini-title');
            if (miniTitle) {
                miniTitle.textContent = displayName;
            }

            // Update active preset styling
            this.highlightPreset(isCustom ? null : id);

            // Notify user / dock active state
            if (this.toggleBtn) {
                this.toggleBtn.classList.add('playing');
            }
        }

        highlightPreset(activeId) {
            this.presetButtons.forEach(btn => {
                const id = btn.getAttribute('data-id');
                if (id === activeId) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
            this.activePresetId = activeId;
        }

        /**
         * Displays status message (error or success)
         */
        showStatus(msg, type = 'info') {
            if (!this.statusEl) return;
            this.statusEl.textContent = msg;
            this.statusEl.className = `spotify-status ${type} show`;

            setTimeout(() => {
                if (this.statusEl) {
                    this.statusEl.classList.remove('show');
                }
            }, 4500);
        }

        /**
         * Toggles the main Spotify Panel open/close
         */
        togglePanel() {
            if (this.isMinimized) {
                this.restoreFromMinibar();
                return;
            }

            if (this.isOpen) {
                this.closePanel();
            } else {
                this.openPanel();
            }
        }

        openPanel() {
            this.isOpen = true;
            this.isMinimized = false;
            if (this.panel) {
                this.panel.classList.add('is-open');
                this.panel.classList.remove('is-minimized');
            }
            if (this.minibar) {
                this.minibar.classList.remove('is-visible');
            }
            if (this.toggleBtn) {
                this.toggleBtn.classList.add('active');
            }
        }

        closePanel() {
            this.isOpen = false;
            this.isMinimized = false;
            if (this.panel) {
                this.panel.classList.remove('is-open');
            }
            if (this.minibar) {
                this.minibar.classList.remove('is-visible');
            }
            if (this.toggleBtn) {
                this.toggleBtn.classList.remove('active');
            }
        }

        minimizePanel() {
            this.isOpen = false;
            this.isMinimized = true;
            if (this.panel) {
                this.panel.classList.remove('is-open');
                this.panel.classList.add('is-minimized');
            }
            if (this.minibar) {
                this.minibar.classList.add('is-visible');
            }
            if (this.toggleBtn) {
                this.toggleBtn.classList.remove('active');
            }
        }

        restoreFromMinibar() {
            this.openPanel();
        }

        /**
         * Toggles between compact view (152px) and full playlist view (352px)
         */
        togglePlayerSize() {
            this.isExpandedSize = !this.isExpandedSize;

            if (this.playerWrapper && this.iframe) {
                if (this.isExpandedSize) {
                    this.playerWrapper.classList.remove('compact');
                    this.playerWrapper.classList.add('expanded');
                    this.iframe.height = '352';
                    if (this.sizeIcon) this.sizeIcon.textContent = '⊟';
                    if (this.sizeToggleBtn) this.sizeToggleBtn.title = 'Switch to Compact View';
                } else {
                    this.playerWrapper.classList.remove('expanded');
                    this.playerWrapper.classList.add('compact');
                    this.iframe.height = '152';
                    if (this.sizeIcon) this.sizeIcon.textContent = '⊞';
                    if (this.sizeToggleBtn) this.sizeToggleBtn.title = 'Switch to Full Playlist View';
                }
            }
        }

        /**
         * LocalStorage Persistence
         */
        saveItem(item) {
            this.savedItem = item;
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(item));
            } catch (e) {
                console.warn('LocalStorage unavailable for Spotify item saving.', e);
            }
            this.renderSavedItem();
        }

        loadSavedItem() {
            try {
                const stored = localStorage.getItem(STORAGE_KEY);
                if (stored) {
                    this.savedItem = JSON.parse(stored);
                    this.renderSavedItem();
                }
            } catch (e) {
                console.warn('Failed to load saved Spotify item.', e);
            }
        }

        removeSavedItem() {
            this.savedItem = null;
            try {
                localStorage.removeItem(STORAGE_KEY);
            } catch (e) {
                console.warn(e);
            }
            this.renderSavedItem();
            this.showStatus('Custom playlist removed from quick access.', 'info');
        }

        renderSavedItem() {
            if (!this.savedContainer) return;

            if (this.savedItem) {
                this.savedContainer.style.display = 'block';
                if (this.savedTitle) {
                    this.savedTitle.textContent = this.savedItem.title || 'Saved Custom Playlist';
                }
            } else {
                this.savedContainer.style.display = 'none';
            }
        }
    }

    // Initialize globally
    window.spotifyGardenPlayer = new SpotifyGardenManager();

})();
