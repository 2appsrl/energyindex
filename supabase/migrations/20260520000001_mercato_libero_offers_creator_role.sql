-- Aggiunge il campo creator_role a mercato_libero_offers per distinguere
-- le offerte "Certificate" (create da superadmin energiapro.biz, validate) dalle
-- "Non certificate" (create da admin/agency, non ancora validate dal team).
--
-- Tutti i valori esistenti restano NULL (per le offerte ARERA / scraping brand,
-- creator_role non si applica). L'ETL energiapro popolera' il campo dal JSON
-- API una volta che il backend energiapro.biz espone include_creator_roles.

ALTER TABLE mercato_libero_offers
  ADD COLUMN IF NOT EXISTS creator_role TEXT
  CHECK (creator_role IS NULL OR creator_role IN ('superadmin', 'admin', 'agency'));

COMMENT ON COLUMN mercato_libero_offers.creator_role IS
  'Ruolo del creator su energiapro.biz: superadmin (=Certificate, validate dal team) | admin/agency (=Non certificate, create da agenzie partner). NULL per offerte ARERA/scraping_brand.';

-- Index composito per la query principale del filtro UI:
-- WHERE source = 'energiapro_commerciali' AND is_active = true AND creator_role = ?
CREATE INDEX IF NOT EXISTS idx_mlo_source_creator_role_active
  ON mercato_libero_offers (source, creator_role, is_active);
