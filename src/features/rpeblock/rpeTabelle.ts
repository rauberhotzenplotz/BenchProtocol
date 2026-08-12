/** RPE-Tabelle nach Helms/Zourdos: ordnet einem (Wiederholungen, RPE)-Paar
    den Prozentsatz des 1RM zu, den ein Satz mit dieser Wiederholungszahl
    und dieser gefühlten Anstrengung typischerweise darstellt.
    RPE 10 = keine Wiederholung mehr möglich, RPE 8 = 2 Wdh. in Reserve.
    Nur Wdh. 1–8 und RPE 6–10 (0,5er-Schritte) sind erfasst — außerhalb
    davon ist die Schätzung zu ungenau, siehe geschaetztes1RM(). */

export interface RpeTabellenEintrag {
  wdh: number
  rpe: number
  /** Prozent des 1RM, als ganze Zahl (86 = 86 %). */
  prozent: number
}

export const RPE_TABELLE: readonly RpeTabellenEintrag[] = [
  { wdh: 1, rpe: 6, prozent: 86 }, { wdh: 1, rpe: 6.5, prozent: 88 }, { wdh: 1, rpe: 7, prozent: 89 },
  { wdh: 1, rpe: 7.5, prozent: 91 }, { wdh: 1, rpe: 8, prozent: 92 }, { wdh: 1, rpe: 8.5, prozent: 94 },
  { wdh: 1, rpe: 9, prozent: 96 }, { wdh: 1, rpe: 9.5, prozent: 98 }, { wdh: 1, rpe: 10, prozent: 100 },

  { wdh: 2, rpe: 6, prozent: 84 }, { wdh: 2, rpe: 6.5, prozent: 85 }, { wdh: 2, rpe: 7, prozent: 86 },
  { wdh: 2, rpe: 7.5, prozent: 88 }, { wdh: 2, rpe: 8, prozent: 89 }, { wdh: 2, rpe: 8.5, prozent: 91 },
  { wdh: 2, rpe: 9, prozent: 92 }, { wdh: 2, rpe: 9.5, prozent: 94 }, { wdh: 2, rpe: 10, prozent: 96 },

  { wdh: 3, rpe: 6, prozent: 81 }, { wdh: 3, rpe: 6.5, prozent: 82 }, { wdh: 3, rpe: 7, prozent: 84 },
  { wdh: 3, rpe: 7.5, prozent: 85 }, { wdh: 3, rpe: 8, prozent: 86 }, { wdh: 3, rpe: 8.5, prozent: 88 },
  { wdh: 3, rpe: 9, prozent: 89 }, { wdh: 3, rpe: 9.5, prozent: 91 }, { wdh: 3, rpe: 10, prozent: 92 },

  { wdh: 4, rpe: 6, prozent: 79 }, { wdh: 4, rpe: 6.5, prozent: 80 }, { wdh: 4, rpe: 7, prozent: 81 },
  { wdh: 4, rpe: 7.5, prozent: 83 }, { wdh: 4, rpe: 8, prozent: 84 }, { wdh: 4, rpe: 8.5, prozent: 85 },
  { wdh: 4, rpe: 9, prozent: 86 }, { wdh: 4, rpe: 9.5, prozent: 88 }, { wdh: 4, rpe: 10, prozent: 89 },

  { wdh: 5, rpe: 6, prozent: 76 }, { wdh: 5, rpe: 6.5, prozent: 78 }, { wdh: 5, rpe: 7, prozent: 79 },
  { wdh: 5, rpe: 7.5, prozent: 80 }, { wdh: 5, rpe: 8, prozent: 81 }, { wdh: 5, rpe: 8.5, prozent: 83 },
  { wdh: 5, rpe: 9, prozent: 84 }, { wdh: 5, rpe: 9.5, prozent: 85 }, { wdh: 5, rpe: 10, prozent: 86 },

  { wdh: 6, rpe: 6, prozent: 74 }, { wdh: 6, rpe: 6.5, prozent: 75 }, { wdh: 6, rpe: 7, prozent: 76 },
  { wdh: 6, rpe: 7.5, prozent: 78 }, { wdh: 6, rpe: 8, prozent: 79 }, { wdh: 6, rpe: 8.5, prozent: 80 },
  { wdh: 6, rpe: 9, prozent: 81 }, { wdh: 6, rpe: 9.5, prozent: 83 }, { wdh: 6, rpe: 10, prozent: 84 },

  { wdh: 7, rpe: 6, prozent: 73 }, { wdh: 7, rpe: 6.5, prozent: 74 }, { wdh: 7, rpe: 7, prozent: 75 },
  { wdh: 7, rpe: 7.5, prozent: 76 }, { wdh: 7, rpe: 8, prozent: 77 }, { wdh: 7, rpe: 8.5, prozent: 78 },
  { wdh: 7, rpe: 9, prozent: 79 }, { wdh: 7, rpe: 9.5, prozent: 80 }, { wdh: 7, rpe: 10, prozent: 81 },

  { wdh: 8, rpe: 6, prozent: 71 }, { wdh: 8, rpe: 6.5, prozent: 72 }, { wdh: 8, rpe: 7, prozent: 72 },
  { wdh: 8, rpe: 7.5, prozent: 74 }, { wdh: 8, rpe: 8, prozent: 74 }, { wdh: 8, rpe: 8.5, prozent: 76 },
  { wdh: 8, rpe: 9, prozent: 76 }, { wdh: 8, rpe: 9.5, prozent: 78 }, { wdh: 8, rpe: 10, prozent: 79 },
]
