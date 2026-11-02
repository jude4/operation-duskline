export const OBJECTIVES = [
  'Enter the loading yard',
  'Find the access card · west loading station',
  'Enter the facility · reach the control room',
  'Recover the data module · research terminal',
  'Reach extraction · north service exit',
  'Mission complete · data secured',
] as const;

export class MissionManager {
  stage = 0;
  hasKey = false;
  hasData = false;
  completed = false;
  constructor(private changed: (text: string) => void) {}
  enterArea(z: number) {
    if (this.stage === 0 && z < 5) this.advance(1, 'PERIMETER BREACHED · Locate the west loading station');
    if (this.stage === 2 && z < -61) this.advance(3, 'CONTROL ROOM REACHED · Recover the classified module');
  }
  acquireKey() {
    if (this.hasKey) return false;
    this.hasKey = true;
    this.advance(2, 'ACCESS CARD ACQUIRED · Main facility unlocked');
    return true;
  }
  acquireData() {
    if (!this.hasKey || this.stage < 3 || this.hasData) return false;
    this.hasData = true;
    this.advance(4, 'DATA MODULE SECURED · Proceed to extraction');
    return true;
  }
  extract() {
    if (!this.hasData || this.completed) return false;
    this.completed = true;
    this.advance(5, 'OPERATION COMPLETE · Uplink established');
    return true;
  }
  reset() { this.stage = 0; this.hasKey = false; this.hasData = false; this.completed = false; }
  private advance(stage: number, text: string) { this.stage = Math.max(this.stage, stage); this.changed(text); }
  get text() { return OBJECTIVES[this.stage]; }
}
