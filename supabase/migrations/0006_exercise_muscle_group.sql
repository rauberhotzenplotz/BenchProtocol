-- Verknüpft eine Übung optional mit einer Muskelgruppe aus dem
-- Volumen-Kontrollblatt (volume_rows.muscle_group), damit sich das
-- Wochenvolumen automatisch aus echten geloggten Sätzen berechnen lässt
-- statt aus einer von Hand gepflegten Zahl.
alter table exercises add column if not exists muscle_group text;
