-- Slice 4 ARERA: UNIQUE constraint per UPSERT idempotente in ETL.
-- offer_code da solo non basta perche' la stessa offerta puo' avere piu'
-- versioni con valid_from diversi (versioning).

ALTER TABLE arera_offers
  ADD CONSTRAINT arera_offers_offer_code_valid_from_unique
  UNIQUE (offer_code, valid_from);
