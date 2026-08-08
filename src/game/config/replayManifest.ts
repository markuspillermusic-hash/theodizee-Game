import type { ReplayClipVariant } from '../types'

export const replayManifest: ReplayClipVariant[] = [
  {
    id: 'echo-01-left', levelId: 'level-01', srcMp4: 'assets/video/echoes/level-01/echo-01-left.mp4',
    durationMs: 12_000, playbackRate: 0.98, tags: ['left', 'quiet', 'macro'],
    caption: '[Wind. Eine grüne Spitze neigt sich nach links ins Licht. Eine große Form streift den Hintergrund.]',
    conditions: [{ field: 'primaryDirection', operator: 'eq', value: 'left' }],
  },
  {
    id: 'echo-01-right', levelId: 'level-01', srcMp4: 'assets/video/echoes/level-01/echo-01-right.mp4',
    durationMs: 12_000, playbackRate: 1.02, tags: ['right', 'restless', 'macro'],
    caption: '[Wind. Eine grüne Spitze richtet sich nach rechts aus. Hektische Bewegung zieht unscharf vorbei.]',
    conditions: [{ field: 'primaryDirection', operator: 'neq', value: 'left' }],
  },
  {
    id: 'echo-02-near', levelId: 'level-02', srcMp4: 'assets/video/echoes/level-02/echo-02-near.mp4',
    durationMs: 18_000, playbackRate: 1, tags: ['near', 'herd', 'dust'],
    caption: '[Hufe im Staub. Gestreifte Körper halten eng zusammen. Hinter ihnen beschleunigt eine dunkle Silhouette.]',
    conditions: [{ field: 'metrics.groupNearRatio', operator: 'gte', value: 0.56 }],
  },
  {
    id: 'echo-02-wide', levelId: 'level-02', srcMp4: 'assets/video/echoes/level-02/echo-02-wide.mp4',
    durationMs: 18_000, playbackRate: 1.03, tags: ['wide', 'herd', 'dust'],
    caption: '[Hufe schlagen versetzt auf. Ein gestreifter Körper verliert kurz die Herde. Das vertraute schnelle Motiv kehrt zurück.]',
  },
  {
    id: 'echo-03-warm', levelId: 'level-03', srcMp4: 'assets/video/echoes/level-03/echo-03-warm.mp4',
    durationMs: 22_000, playbackRate: 0.98, tags: ['warm', 'care', 'return'],
    caption: '[Junge Rufe. Nahrung wird geteilt. Eine Löwin kehrt über die warme Spur zurück – bis fremdes Licht den Raum zerreißt.]',
    conditions: [{ field: 'choices.trail', operator: 'eq', value: 'warm' }],
  },
  {
    id: 'echo-03-cool', levelId: 'level-03', srcMp4: 'assets/video/echoes/level-03/echo-03-cool.mp4',
    durationMs: 22_000, playbackRate: 1.02, tags: ['cool', 'care', 'risk'],
    caption: '[Pfoten folgen einer kühlen Spur. Kleine Körper warten. In der Ferne stehen harte Grenzen und ein verletzliches Licht.]',
  },
  {
    id: 'echo-04-upper', levelId: 'level-04', srcMp4: 'assets/video/echoes/level-04/echo-04-upper.mp4',
    durationMs: 27_000, playbackRate: 1, tags: ['upper', 'smoke', 'protection'],
    caption: '[Rauch. Ein Kind folgt dem oberen Korridor. Eine vertraute Gestalt öffnet den Weg und bleibt hinter der Schwelle zurück.]',
    conditions: [{ field: 'choices.route', operator: 'eq', value: 'upper' }],
  },
  {
    id: 'echo-04-lower', levelId: 'level-04', srcMp4: 'assets/video/echoes/level-04/echo-04-lower.mp4',
    durationMs: 27_000, playbackRate: 1, tags: ['lower', 'smoke', 'protection'],
    caption: '[Rauch. Ein Kind nimmt den tieferen Ausgang. Eine Hand gibt den letzten Impuls, dann schließt sich die Sicht.]',
  },
  {
    id: 'echo-05-amber', levelId: 'level-05', srcMp4: 'assets/video/echoes/level-05/echo-05-amber.mp4',
    durationMs: 35_000, playbackRate: 0.97, tags: ['amber', 'bond', 'stay'],
    caption: '[Gemeinsames Lachen, ein Streit, eine Rückkehr. Am Ende bleibt ein Mensch ruhig bei einem vertrauten Gegenüber.]',
    conditions: [{ field: 'choices.preferredSignal', operator: 'eq', value: 'amber' }],
  },
  {
    id: 'echo-05-violet', levelId: 'level-05', srcMp4: 'assets/video/echoes/level-05/echo-05-violet.mp4',
    durationMs: 35_000, playbackRate: 1.02, tags: ['violet', 'bond', 'search'],
    caption: '[Farbiges Leben, geteilte Wege, viele Versuche. Eine vertraute Melodie bleibt, obwohl ihr Ursprung verstummt.]',
  },
]
