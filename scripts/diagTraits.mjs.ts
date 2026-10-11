import { simulateMatch } from '../src/training/engine/sim.ts';
type Slot = [string, string, number, number];
const L: Slot[] = [['GOL','GK',50,88],['LE','LB',15,72],['ZAG','CB',38,72],['ZAG','CB',62,72],['LD','RB',85,72],['PE','LW',15,48],['MC','CM',38,48],['MC','CM',62,48],['PD','RW',85,48],['ATA','ST',35,22],['ATA','ST',65,22]];
const mk = (p: string, traits: Record<number, string> = {}) =>
  L.map((s, i) => ({ id: p + i, role: s[0] as never, position: s[1] as never, overall: 74, slotX: s[2], slotY: s[3], trait: traits[i] }));
function run(label: string, a: Record<number, string>, b: Record<number, string> = {}) {
  const N = 150;
  const tot = { a: { goals: 0, shots: 0, crosses: 0, saves: 0, tackles: 0, passes: 0, passOk: 0, dist: 0, shotsOn: 0, assists: 0 }, b: { goals: 0, shots: 0, crosses: 0, saves: 0, tackles: 0, passes: 0, passOk: 0, dist: 0, shotsOn: 0, assists: 0 } };
  for (let m = 0; m < N; m++) {
    const r = simulateMatch({ format: 11, halfDurationSec: 150, seed: m + 1, teams: { a: mk('a', a), b: mk('b', b) } });
    for (const [id, s] of Object.entries(r.stats)) {
      const t = tot[id[0] as 'a' | 'b'];
      t.goals += s.goals; t.shots += s.shotsOn + s.shotsOff; t.shotsOn += s.shotsOn; t.crosses += s.crosses; t.saves += s.saves; t.tackles += s.tackles;
      t.passes += s.passesOk + s.passesBad; t.passOk += s.passesOk; t.dist += s.distance; t.assists += s.assists;
    }
  }
  const f = (n: number) => (n / N).toFixed(1);
  const x = tot.a, y = tot.b;
  console.log(`${label.padEnd(34)} A: gols ${f(x.goals)} chutes ${f(x.shots)} cruz ${f(x.crosses)} def ${f(x.saves)} desarmes ${f(x.tackles)} passes ${f(x.passes)} dist ${(x.dist / N / 11).toFixed(0)}m | B(padrão): gols ${f(y.goals)} chutes ${f(y.shots)} cruz ${f(y.crosses)} def ${f(y.saves)}`);
}
run('só padrão', {});
run('GK paredão (B padrão)', { 0: 'gk-paredao' });
run('GK líbero', { 0: 'gk-libero' });
run('laterais ofensivos + pontas cruz.', { 1: 'fb-ofensivo', 4: 'fb-ofensivo', 5: 'w-cruzador', 8: 'w-cruzador', 9: 'st-cabeceador' });
run('atacantes artilheiro', { 9: 'st-artilheiro', 10: 'st-artilheiro' });
run('atacantes pivô+velocista', { 9: 'st-pivo', 10: 'st-velocista' });
run('meias box-to-box + chegada', { 6: 'cm-box', 7: 'cm-chegada' });
run('zaga xerife', { 2: 'cb-xerife', 3: 'cb-xerife' });
