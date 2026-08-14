/** Weltraum-Nebel als Hintergrund der ganzen App.

    Bewusst reines CSS statt eines Canvas-Partikelsystems: die App läuft als
    PWA im Studio auf dem Handy, oft eine Stunde am Stück. Eine Dauerschleife
    über requestAnimationFrame hielte die CPU die ganze Zeit wach; die
    Transform-Animationen hier laufen auf dem Compositor und pausieren von
    selbst, sobald die Seite in den Hintergrund gerät.

    Die Ebenen von hinten nach vorn: Grundfarbe (im Stylesheet), vier
    Gaswolken, Korn (macht aus glatten Verläufen erst Nebel), zwei
    Sternenfelder, Randabdunklung. Alles liegt auf z-index 0, die App auf 1 —
    siehe .app im Stylesheet. */
export function Nebel() {
  return (
    <div className="nebel" aria-hidden="true">
      <span className="nb-wolke nb-w1" />
      <span className="nb-wolke nb-w2" />
      <span className="nb-wolke nb-w3" />
      <span className="nb-wolke nb-w4" />
      <span className="nb-korn" />
      <span className="nb-sterne nb-s1" />
      <span className="nb-sterne nb-s2" />
      <span className="nb-rand" />
    </div>
  )
}
