/**
 * A spine ChatGPT is still drawing, kept for the tab so a reload, as when the browser drops a tab
 * left in the background, picks the same drawing up instead of losing it.
 */
export type SavedSpineJob = {
  /** the book it is for, by its id */
  book: string;
  /** the drawing at prismify */
  job: string;
  /** when it started, so the clock and the time it is given carry on */
  startedAt: number;
  /** the spine on the shelf it is drawn after, by its URL, or 'invent' for one made up; left out for a crop of a photo */
  from?: string;
};

const KEY = 'spineJob';

export const spineJob = {
  saved(): SavedSpineJob | null {
    try {
      const saved = sessionStorage.getItem(KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  },

  save(job: SavedSpineJob) {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(job));
    } catch {
      // without storage it just isn't picked up after a reload
    }
  },

  forget() {
    try {
      sessionStorage.removeItem(KEY);
    } catch {
      // nothing was kept then
    }
  },
};
