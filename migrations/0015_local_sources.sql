-- Buyers who advertise on their own website and nowhere else.
--
-- The eTenders portal carries tenders, not quotations. A municipality or a
-- college running an RFQ under the bid threshold advertises it on its own site,
-- sends it to suppliers on its database, and never touches the national portal.
-- Vhembe TVET College is the case that proves it: three-year contracts for
-- cleaning materials and for stationery, on the doorstep, entirely absent from
-- the mirror.
--
-- Those adverts land in the same table as the portal's, so search, the digest
-- and the register all work on them unchanged. Two columns are needed to tell
-- them apart and to date them.

-- Which feed a row came from: 'etenders', or a local source id.
ALTER TABLE remote_tenders ADD COLUMN source TEXT NOT NULL DEFAULT 'etenders';

-- When this row first appeared in the mirror.
--
-- The portal's adverts are dated by their OCDS release date, because the crawl
-- can reach a page weeks after publication and first sight would be a lie.
-- Scraped sources are the opposite: the whole listing page is re-read every
-- run, so anything not seen yesterday genuinely is new — and most of these
-- notices carry no machine-readable date at all, only a filename.
ALTER TABLE remote_tenders ADD COLUMN first_seen_at TEXT;

UPDATE remote_tenders SET first_seen_at = synced_at WHERE first_seen_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_remote_source ON remote_tenders(source, first_seen_at);
