-- Soft delete: deleting an article moves it to the trash instead of removing the
-- row, so a mistaken single or bulk delete can be undone. Rows and their image
-- files stay in place; both are only removed when an article is purged.

ALTER TABLE articles ADD COLUMN deleted_at DATETIME DEFAULT NULL;

-- Every list and filter query discriminates on this column
CREATE INDEX IF NOT EXISTS idx_articles_deleted_at ON articles(deleted_at);
