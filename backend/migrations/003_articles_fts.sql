-- Full-text search over articles, replacing the LIKE '%term%' scan over
-- content_text (and excerpt, and title) with an FTS5 index.
--
-- Indexed as an external content table: FTS5 stores only the index and reads the
-- indexed columns back from `articles`, so no article text is duplicated. The
-- triggers below are the standard pattern for keeping such an index in step.
--
-- The update trigger is scoped with `UPDATE OF` so that updates which do not
-- touch indexed columns - the updated_at trigger, or moving a row to the trash -
-- do not pay to re-index the row.

CREATE VIRTUAL TABLE IF NOT EXISTS articles_fts USING fts5(
  title,
  content_text,
  excerpt,
  content='articles',
  content_rowid='id',
  tokenize='unicode61 remove_diacritics 2'
);

CREATE TRIGGER IF NOT EXISTS articles_fts_ai AFTER INSERT ON articles BEGIN
  INSERT INTO articles_fts(rowid, title, content_text, excerpt)
  VALUES (new.id, new.title, new.content_text, new.excerpt);
END;

CREATE TRIGGER IF NOT EXISTS articles_fts_ad AFTER DELETE ON articles BEGIN
  INSERT INTO articles_fts(articles_fts, rowid, title, content_text, excerpt)
  VALUES ('delete', old.id, old.title, old.content_text, old.excerpt);
END;

CREATE TRIGGER IF NOT EXISTS articles_fts_au AFTER UPDATE OF title, content_text, excerpt ON articles BEGIN
  INSERT INTO articles_fts(articles_fts, rowid, title, content_text, excerpt)
  VALUES ('delete', old.id, old.title, old.content_text, old.excerpt);

  INSERT INTO articles_fts(rowid, title, content_text, excerpt)
  VALUES (new.id, new.title, new.content_text, new.excerpt);
END;

-- Index any articles captured before this migration
INSERT INTO articles_fts(articles_fts) VALUES('rebuild');
