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
    id: 'echo-04-heil', levelId: 'level-04', srcMp4: 'assets/video/echoes/level-04/echo-04-heil.mp4',
    durationMs: 27_000, playbackRate: 1, tags: ['schutz', 'heil'],
    caption: '[Rauch. Bei jedem Funkenschlag schiebt sich ein Arm ins Bild. Dann eine helle Schwelle, ein Schatten geht hindurch. Der Arm folgt nicht.]',
    conditions: [{ field: 'metrics.throughHits', operator: 'lte', value: 4 }],
  },
  {
    id: 'echo-04-gezeichnet', levelId: 'level-04', srcMp4: 'assets/video/echoes/level-04/echo-04-gezeichnet.mp4',
    durationMs: 27_000, playbackRate: 1, tags: ['schutz', 'gezeichnet'],
    caption: '[Rauch. Der Arm kommt oft zu spaet. Dann eine helle Schwelle, ein Schatten geht hindurch, langsamer, mit Asche auf der Schulter. Der Arm folgt nicht.]',
  },
  {
    id: 'echo-05-amber', levelId: 'level-05', srcMp4: 'assets/video/echoes/level-05/echo-05-amber.mp4',
    durationMs: 35_000, playbackRate: 1, tags: ['amber', 'fenster'],
    caption: '[Nacht ueber einem Hof. Ein warmes Fenster blinkt, ein anderes antwortet. Dann antwortet es spaeter. Dann gar nicht mehr.]',
    conditions: [{ field: 'choices.preferredSignal', operator: 'eq', value: 'amber' }],
  },
  {
    id: 'echo-05-violet', levelId: 'level-05', srcMp4: 'assets/video/echoes/level-05/echo-05-violet.mp4',
    durationMs: 35_000, playbackRate: 1, tags: ['violet', 'fenster'],
    caption: '[Nacht ueber einem Hof. Ein flackerndes Fenster blinkt, ein anderes antwortet. Dann antwortet es schwaecher. Dann gar nicht mehr.]',
    conditions: [{ field: 'choices.preferredSignal', operator: 'eq', value: 'violet' }],
  },
  {
    id: 'echo-05-blue', levelId: 'level-05', srcMp4: 'assets/video/echoes/level-05/echo-05-blue.mp4',
    durationMs: 35_000, playbackRate: 1, tags: ['blue', 'fenster'],
    caption: '[Nacht ueber einem Hof. Drueben brennt eine Kerze und antwortet. Dann steht sie still. Das eigene Fenster blinkt weiter.]',
  },
  {
    id: 'echo-06-viele', levelId: 'level-06', srcMp4: 'assets/video/echoes/level-06/echo-06-viele.mp4',
    durationMs: 30_000, playbackRate: 1, tags: ['leben', 'viele'],
    caption: '[Eine Hand neigt eine Flamme zur naechsten Kerze. Und die zur uebernaechsten. Am Ende ist der ganze Raum hell.]',
    conditions: [{ field: 'choices.light', operator: 'eq', value: 'viele' }],
  },
  {
    id: 'echo-06-wenige', levelId: 'level-06', srcMp4: 'assets/video/echoes/level-06/echo-06-wenige.mp4',
    durationMs: 30_000, playbackRate: 1, tags: ['leben', 'wenige'],
    caption: '[Eine Hand neigt eine Flamme zur naechsten Kerze. Wenige Lichter, weit auseinander. Aber sie brennen, und der Raum ist nicht mehr ganz dunkel.]',
  },
]
