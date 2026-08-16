-- Tender preparation: register, compliance matrix, and company document vault.
--
-- Modelled directly on the SA eTenders guide. The shape exists to attack the
-- six disqualification reasons in section 4 of that guide, which reject a bid
-- before anyone evaluates it: late submission, missed compulsory briefing,
-- expired certificates, unsigned documents, blank fields, and a B-BBEE claim
-- that doesn't match the certificate.
--
-- Idempotent to match 0001-0004 — this database is provisioned with
-- `d1 execute`, so migrations may be re-run.

-- One row per tender being pursued.
CREATE TABLE IF NOT EXISTS tenders (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  -- The advertised tender/bid number, e.g. "RFQ 123/2026".
  reference            TEXT NOT NULL,
  title                TEXT NOT NULL,
  -- Issuing department or entity.
  department           TEXT NOT NULL DEFAULT '',
  description          TEXT NOT NULL DEFAULT '',

  -- ISO-8601 with an explicit offset ("2026-09-01T11:00:00+02:00"). Stored
  -- with the offset rather than as a bare local string so a deadline can never
  -- be misread by an hour — the guide notes that one minute late is a rejection.
  closing_at           TEXT NOT NULL,

  -- Briefing sessions are tracked apart from the closing date because missing
  -- a *compulsory* one is an automatic disqualification, no matter how good
  -- the rest of the bid is.
  briefing_at          TEXT,
  briefing_compulsory  INTEGER NOT NULL DEFAULT 0,
  briefing_attended    INTEGER NOT NULL DEFAULT 0,

  -- 'physical' (tender box) or 'electronic' (department portal).
  submission_method    TEXT NOT NULL DEFAULT 'physical',
  -- Box address or portal URL, from the tender's submission instructions.
  submission_detail    TEXT NOT NULL DEFAULT '',

  -- Preference points claimed on SBD 6.1. Checked against the level on the
  -- stored B-BBEE certificate: claiming points the certificate doesn't support
  -- is disqualification reason 5.
  bbbee_claimed_level  INTEGER,

  -- draft | preparing | submitted | won | lost | abandoned
  status               TEXT NOT NULL DEFAULT 'preparing',
  notes                TEXT NOT NULL DEFAULT '',
  created_at           TEXT NOT NULL DEFAULT (datetime('now'))
);

-- The compliance matrix: section 5 of the guide recommends listing every
-- required document and signature up front and ticking them off. Rows are
-- seeded from the mandatory checklist when a tender is created, then edited.
CREATE TABLE IF NOT EXISTS tender_items (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  tender_id          INTEGER NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
  -- Grouping from the guide: preliminary | identity | tax | sbd | sector |
  -- technical | financial
  category           TEXT NOT NULL DEFAULT 'sbd',
  label              TEXT NOT NULL,
  -- Sector-specific items (CIDB, PSIRA) start optional; they only block when
  -- the tender actually calls for them.
  required           INTEGER NOT NULL DEFAULT 1,
  attached           INTEGER NOT NULL DEFAULT 0,
  -- Tracked separately from `attached`: forgetting to sign one page of an SBD
  -- form is the single most common disqualification in the guide.
  signature_required INTEGER NOT NULL DEFAULT 0,
  signed             INTEGER NOT NULL DEFAULT 0,
  -- "If a section does not apply, write N/A rather than leaving it empty."
  note               TEXT NOT NULL DEFAULT '',
  position           INTEGER NOT NULL DEFAULT 0
);

-- The "Master Folder" from section 5, as metadata only. Deliberately holds no
-- files: certified ID copies and tax documents are not stored by this app, so
-- only their validity dates and whereabouts are tracked.
CREATE TABLE IF NOT EXISTS company_documents (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  -- cipc | id_copy | tax_pin | csd_report | bbbee | coida | cidb |
  -- professional_body | other
  kind        TEXT NOT NULL,
  label       TEXT NOT NULL,
  -- Free-text identifier: MAAA number, Tax PIN, certificate number.
  reference   TEXT NOT NULL DEFAULT '',
  issued_on   TEXT,
  -- NULL means it does not expire (e.g. CIPC registration documents).
  expires_on  TEXT,
  -- B-BBEE contribution level, used only by the bbbee row, to check what a
  -- tender claims on SBD 6.1 against what the certificate actually supports.
  bbbee_level INTEGER,
  -- Where the actual file lives, since this app deliberately doesn't hold it.
  location    TEXT NOT NULL DEFAULT '',
  notes       TEXT NOT NULL DEFAULT '',
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tender_items_tender ON tender_items(tender_id, position);
CREATE INDEX IF NOT EXISTS idx_tenders_closing ON tenders(closing_at);
