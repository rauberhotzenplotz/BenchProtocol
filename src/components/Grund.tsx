/** Der Hintergrund der ganzen App: ein ruhiger Lichtabfall von oben nach
    unten, mehr nicht. Die Gestaltung steckt vollstaendig im Stylesheet
    (.grund), hier steht nur die Flaeche.

    Der Vorgaenger war ein animierter Weltraum-Nebel aus zehn Ebenen — vier
    driftende Gaswolken, Korn, Sternenfelder, Sternschnuppen. Er liegt
    unter design/konsole/ und kommt mit dem alten Design zurueck. */
export function Grund() {
  return <div className="grund" aria-hidden="true" />
}
