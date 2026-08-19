-- Grundlage für "Pausieren"/"Fortsetzen" im Session-Zustandsmenü: eine
-- laufende Einheit kann angehalten werden, ohne sie zu beenden. null =
-- nicht pausiert (Normalzustand und nach "Fortsetzen").
alter table sessions add column if not exists paused_at timestamptz;
