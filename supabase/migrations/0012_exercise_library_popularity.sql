-- Bekanntheitsrang je Übung fürs Durchsuchen nach Muskelgruppe (statt nur
-- über die Textsuche): 0 = zuerst gezeigt. Default 0, damit von Hand
-- angelegte Vorlagen (nicht Teil des großen Imports) automatisch ganz
-- oben stehen, statt unter tausenden importierten Katalogzeilen zu
-- versinken — wer eine Übung von Hand einträgt, will sie vermutlich auch
-- wiederfinden. Die 3245 importierten Zeilen bekommen ihren Rang in einem
-- separaten Schreibvorgang (nicht Teil dieser Migration, siehe Historie):
-- bekannte Übungen wie Klimmzüge/Latzug/Rudern für Rücken zuerst, der
-- Rest nach Gerät gestaffelt (Langhantel/Kurzhantel/Körpergewicht/Kabel
-- vor Spezialgerät wie Macebell/Clubbell/Battle Ropes).
alter table exercise_library
  add column if not exists popularity int not null default 0;

create index if not exists idx_exercise_library_muscle_popularity
  on exercise_library(muscle_group, popularity, name);
